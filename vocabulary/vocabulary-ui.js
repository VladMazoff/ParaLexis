// vocabulary-ui.js - Module Pattern + Singleton
var VocabularyUI = (function() {
    var instance = null;
    var core = null;
    
    // ========== Приватные переменные ==========
    var _modal = null,
        _floatBtn = null,
        _menuItem = null,
        _hoverTip = null,
        _ctxMenu = null,
        _currWord = '',
        _transCloud = null,
        _transTimeout = null,
        _state = { sort: 'date', search: '', isModalOpen: false },
        _transSettings = { sourceLang: 'de', targetLang: 'ru' },
        _actionHandlers = {},
        _hoverThrottled = null,
        _leaveHandler = null;

    // ========== Утилиты ==========
    function throttle(fn, wait) {
        var last = 0;
        return function() {
            var now = Date.now();
            if (now - last >= wait) {
                last = now;
                return fn.apply(this, arguments);
            }
        };
    }

    function escapeHtml(text) {
        var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    function isOnline() {
        return navigator.onLine !== false;
    }

    // ========== Инициализация ==========
    function init(coreInstance) {
        core = coreInstance;
        createFloatBtn();
        addToMenu();
        createModal();
        setupEvents();
        updateCount();
        initHover();
        initCtxMenu();
        setupActionHandlers();
        setTimeout(updateFloatPos, 100);
    }

    function setupActionHandlers() {
        _actionHandlers = {
            'translate': handleTranslate,
            'remove-translation': handleRemoveTrans,
            'remove-word': handleRemoveWord,
            'copy-word': handleCopyWord,
            'copy-translation': handleCopyTrans
        };
    }

    // ========== UI Компоненты ==========
    function createFloatBtn() {
        var existing = document.querySelector('.vocabulary-floating-btn');
        if (existing) {
            _floatBtn = existing;
            return;
        }
        
        _floatBtn = document.createElement('div');
        _floatBtn.className = 'vocabulary-floating-btn';
        _floatBtn.innerHTML = '⭐' + core.count;
        
        _floatBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            showModal();
        });
        
        document.body.appendChild(_floatBtn);
        _floatBtn.style.position = 'fixed';
        _floatBtn.style.zIndex = '1000';
        
        window.addEventListener('resize', updateFloatPos);
        window.addEventListener('scroll', updateFloatPos);
        updateFloatPos();
    }

    function updateFloatPos() {
        if (!_floatBtn) return;
        
        var lyrics = document.getElementById('lyricsDisplay');
        var player = document.getElementById('playerContainer');
        
        if (!lyrics || !player) {
            _floatBtn.style.top = '120px';
            _floatBtn.style.right = '20px';
            return;
        }
        
        try {
            var lRect = lyrics.getBoundingClientRect();
            var pRect = player.getBoundingClientRect();
            var top = pRect.bottom + 15;
            if (lRect.top > 0) top = Math.max(top, lRect.top + 15);
            var right = Math.max(20, window.innerWidth - lRect.right + 20);
            _floatBtn.style.top = top + 'px';
            _floatBtn.style.right = right + 'px';
        } catch (e) {
            _floatBtn.style.top = '120px';
            _floatBtn.style.right = '20px';
        }
    }

    function addToMenu() {
        var menu = document.getElementById('dropdownMenu');
        if (!menu) return;
        
        var existing = document.querySelector('.vocabulary-menu-item');
        if (existing) {
            _menuItem = existing;
            return;
        }
        
        _menuItem = document.createElement('button');
        _menuItem.className = 'dropdown-item vocabulary-menu-item';
        _menuItem.innerHTML = '⭐ Избранное (<span class="vocabulary-count">' + core.count + '</span>)';
        
        _menuItem.addEventListener('click', function(e) {
            e.stopPropagation();
            showModal();
            if (menu.classList.contains('show')) menu.classList.remove('show');
        });
        
        var textBtn = document.getElementById('dropdownText');
        if (textBtn && textBtn.parentNode === menu) {
            menu.insertBefore(_menuItem, textBtn.nextSibling);
        } else {
            menu.appendChild(_menuItem);
        }
    }

    // ========== Модальное окно ==========
    function createModal() {
        _modal = document.createElement('div');
        _modal.className = 'vocabulary-modal';
        _modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;';
        _modal.innerHTML = getModalHTML();
        document.body.appendChild(_modal);
        setupModalEvents();
    }

    function getModalHTML() {
        return '<div class="vocabulary-modal-overlay"></div>' +
               '<div class="vocabulary-modal-content">' +
               '<div class="vocabulary-modal-header">' +
               '<h3>Избранные слова</h3>' +
               '<button class="vocabulary-close-btn" aria-label="Закрыть">&times;</button>' +
               '</div>' +
               '<div class="vocabulary-controls">' +
               '<button class="vocabulary-clear-btn" title="Очистить все слова">🗑️</button>' +
               '<button class="vocabulary-sort-btn" title="Сортировка по алфавиту/по дате">a..z</button>' +
               '<button class="vocabulary-copy-btn" title="Копировать все слова">📋</button>' +
               '<button class="vocabulary-translate-all-btn" title="Перевести все слова без перевода">🌐 Все</button>' +
               '<input type="text" class="vocabulary-search" placeholder="Поиск слова...">' +
               '</div>' +
               '<div class="vocabulary-list-container">' +
               '<div class="vocabulary-list"></div>' +
               '</div>' +
               '</div>';
    }

    function setupModalEvents() {
        if (!_modal) return;
        
        var closeBtn = _modal.querySelector('.vocabulary-close-btn');
        var overlay = _modal.querySelector('.vocabulary-modal-overlay');
        var clearBtn = _modal.querySelector('.vocabulary-clear-btn');
        var sortBtn = _modal.querySelector('.vocabulary-sort-btn');
        var copyBtn = _modal.querySelector('.vocabulary-copy-btn');
        var search = _modal.querySelector('.vocabulary-search');
        var translateAll = _modal.querySelector('.vocabulary-translate-all-btn');
        
        closeBtn && closeBtn.addEventListener('click', hideModal);
        overlay && overlay.addEventListener('click', hideModal);
        
        clearBtn && clearBtn.addEventListener('click', function() {
            if (core.count > 0 && confirm('Удалить все ' + core.count + ' слов?')) {
                core.clearAll();
                showToast('Все слова удалены');
            }
        });
        
        sortBtn && sortBtn.addEventListener('click', function() {
            _state.sort = _state.sort === 'date' ? 'alphabet' : 'date';
            updateModalList();
            updateSortBtn();
        });
        
        copyBtn && copyBtn.addEventListener('click', function() {
            if (core.count === 0) {
                showToast('Словарь пуст');
                return;
            }
            fallbackCopy(core.export('comma'));
        });
        
        search && search.addEventListener('input', function(e) {
            _state.search = e.target.value.trim();
            updateModalList();
        });
        
        translateAll && translateAll.addEventListener('click', function() {
            var words = core.wordsWithoutTranslations;
            if (words.length === 0) {
                showToast('Всё уже переведено', 'info');
                return;
            }
            if (!isOnline()) {
                showToast('Требуется интернет', 'error');
                return;
            }
            batchTranslate(words);
        });
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && _state.isModalOpen) hideModal();
        });
    }

    function showModal() {
        if (_state.isModalOpen) return;
        _state.isModalOpen = true;
        _modal.style.display = 'block';
        document.body.classList.add('vocabulary-modal-open');
        _state.search = '';
        var search = _modal.querySelector('.vocabulary-search');
        if (search) search.value = '';
        updateModalList();
        updateSortBtn();
        setupGlobalClick();
        setTimeout(function() { search && search.focus(); }, 100);
    }

    function hideModal() {
        if (!_state.isModalOpen) return;
        _state.isModalOpen = false;
        _modal.style.display = 'none';
        document.body.classList.remove('vocabulary-modal-open');
        _state.search = '';
        var search = _modal.querySelector('.vocabulary-search');
        if (search) search.value = '';
        hideTransCloud();
    }

    // ========== Список слов ==========
    function updateModalList() {
        var list = _modal.querySelector('.vocabulary-list');
        if (!list) return;
        
        var words = _state.search ? core.search(_state.search) : core.getSorted(_state.sort);
        
        if (words.length === 0) {
            var msg = _state.search ? 'Ничего не найдено' : 'Словарь пуст';
            list.innerHTML = '<div class="vocabulary-empty-state">' + msg + '</div>';
            return;
        }
        
        list.innerHTML = generateListHTML(words);
        updateSortBtn();
    }

    function generateListHTML(words) {
        var html = '';
        for (var i = 0; i < words.length; i++) {
            var item = words[i];
            var hasTrans = item.translation && item.translation.trim() !== '';
            var wordEsc = escapeHtml(item.word);
            var transEsc = hasTrans ? escapeHtml(item.translation) : '';
            
            html += '<div class="vocabulary-item" data-word="' + wordEsc + '">' +
                   '<button class="vocabulary-remove-word" title="Удалить слово" data-action="remove-word">×</button>' +
                   '<div class="vocabulary-word-content">' +
                   '<div class="vocabulary-word" title="Кликните чтобы скопировать слово" data-action="copy-word">' + wordEsc + '</div>';
            
            if (hasTrans) {
                html += '<div class="vocabulary-translation" title="Кликните чтобы скопировать слово и перевод" data-action="copy-translation">' + transEsc + '</div>';
            }
            
            html += '</div><div class="vocabulary-translation-actions">';
            
            if (hasTrans) {
                html += '<button class="vocabulary-remove-translation-btn" title="Удалить перевод" data-action="remove-translation">❌</button>';
            } else {
                html += '<button class="vocabulary-translate-btn" title="Перевести слово" data-action="translate">🌐</button>';
            }
            
            html += '</div></div>';
        }
        return html;
    }

    function setupGlobalClick() {
        var container = _modal.querySelector('.vocabulary-list-container');
        if (!container || container._clickHandlerSet) return;
        
        container.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var item = btn.closest('.vocabulary-item');
            var word = item ? item.dataset.word : null;
            if (!word) return;
            e.stopPropagation();
            var handler = _actionHandlers[btn.dataset.action];
            handler && handler(word, btn);
        });
        container._clickHandlerSet = true;
    }

    // ========== Действия со словами ==========
    function handleTranslate(word, btn) {
        var orig = btn.innerHTML;
        btn.innerHTML = '<span class="vocabulary-translation-loading"></span>';
        btn.disabled = true;
        
        translateAPI(word)
            .then(function(trans) {
                addWord(word, trans, { showAnimation: true, showToast: true });
                updateModalList();
            })
            .catch(function(err) {
                btn.innerHTML = orig;
                btn.disabled = false;
                showToast('Ошибка перевода: ' + err.message, 'error');
            });
    }

    function handleRemoveTrans(word) {
        core.removeTranslation(word);
        updateModalList();
        showToast('Перевод для "' + word + '" удален');
    }

    function handleRemoveWord(word) {
        if (confirm('Удалить слово "' + word + '"?')) {
            core.remove(word);
            showToast('Слово "' + word + '" удалено');
        }
    }

    function handleCopyWord(word) {
        copyToClip(word, function() {
            showToast('Скопировал: ' + word);
        });
    }

    function handleCopyTrans(word, btn) {
        var transEl = btn.closest('.vocabulary-item').querySelector('.vocabulary-translation');
        var trans = transEl ? transEl.textContent : '';
        var text = word + ' - ' + trans;
        copyToClip(text, function() {
            showToast('Скопировал: ' + word + ' - ' + trans);
        });
    }

    // ========== Добавление слов ==========
    function addWord(word, trans, opts) {
        var options = {
            showAnimation: true,
            closeCloud: false,
            showToast: true
        };
        
        if (opts) {
            for (var key in opts) {
                if (opts.hasOwnProperty(key)) options[key] = opts[key];
            }
        }
        
        var added = core.add(word, trans);
        if (!added) return false;
        
        if (options.showAnimation) showWordAnim(word);
        updateCount();
        
        if (options.closeCloud && _transCloud) {
            setTimeout(hideTransCloud, 800);
        }
        
        return true;
    }

    function showWordAnim(word) {
        if (!_floatBtn) return;
        
        var origHTML = _floatBtn.innerHTML;
        var count = core.count;
        var wasEmpty = !origHTML.includes('⭐') || origHTML === '⭐';
        
        var origStyle = _floatBtn.style.cssText;
        var origClass = _floatBtn.className;
        
        // 1. Показываем слово
        _floatBtn.innerHTML = '⭐ ' + word;
        _floatBtn.style.background = '#fff3cd';
        _floatBtn.style.color = '#856404';
        _floatBtn.style.transform = 'scale(1.5)';
        _floatBtn.style.transition = 'all 0.3s ease';
        
        // 2. Уменьшаем
        setTimeout(function() {
            _floatBtn.innerHTML = '⭐ ' + (word.length > 10 ? word.substring(0, 10) + '...' : word);
            _floatBtn.style.background = '#ffeaa7';
            _floatBtn.style.transform = 'scale(1.2)';
        }, 2000);
        
        // 3. Возвращаем счетчик
        setTimeout(function() {
            _floatBtn.innerHTML = '⭐' + (count > 0 ? count : '');
            _floatBtn.style.background = '#ffd43b';
            _floatBtn.style.transform = 'scale(1)';
            
            if (wasEmpty || origHTML !== _floatBtn.innerHTML) {
                _floatBtn.style.boxShadow = '0 0 0 5px rgba(255, 212, 59, 0.5)';
                setTimeout(function() { _floatBtn.style.boxShadow = ''; }, 300);
            }
        }, 2500);
        
        // 4. Возвращаем оригинал
        setTimeout(function() {
            _floatBtn.style.cssText = origStyle;
            _floatBtn.className = origClass;
            _floatBtn.innerHTML = '⭐' + (count > 0 ? count : '');
            _floatBtn.style.display = count > 0 ? 'flex' : 'none';
        }, 2800);
    }

    // ========== Hover перевод ==========
    function initHover() {
        var lyrics = document.getElementById("lyricsDisplay");
        if (!lyrics) {
            setTimeout(initHover, 800);
            return;
        }
        
        if (!_hoverTip) {
            _hoverTip = document.createElement("div");
            _hoverTip.className = "vocab-hover-tip";
            _hoverTip.style.cssText = "position:absolute;z-index:10001;background:white;border:1px solid #ddd;" +
                                     "border-radius:4px;padding:6px 10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);" +
                                     "font-size:1em;max-width:200px;display:none;pointer-events:none;";
            document.body.appendChild(_hoverTip);
        }
        
        if (_hoverThrottled) lyrics.removeEventListener("mousemove", _hoverThrottled);
        if (_leaveHandler) lyrics.removeEventListener("mouseleave", _leaveHandler);
        
        var currWord = null;
        
        var hideTip = function() {
            _hoverTip.style.display = "none";
            currWord = null;
        };
        
        var moveHandler = throttle(function(e) {
            var target = e.target;
            while (target && target !== lyrics) {
                if (target.classList && target.classList.contains("line-text")) break;
                target = target.parentNode;
            }
            
            if (!target || !target.classList || !target.classList.contains("line-text")) {
                hideTip();
                return;
            }
            
            var result = getWordUnderCursor(target, e.clientX, e.clientY);
            if (!result || !result.word) {
                hideTip();
                return;
            }
            
            var word = result.word;
            if (word === currWord) return;
            
            var trans = core.getTranslation(word);
            if (!trans) {
                hideTip();
                return;
            }
            
            showHoverTip(word, trans, result.rect);
            currWord = word;
        }, 60);
        
        var leaveHandler = function() { hideTip(); };
        
        lyrics.addEventListener("mousemove", moveHandler, false);
        lyrics.addEventListener("mouseleave", leaveHandler, false);
        
        _hoverThrottled = moveHandler;
        _leaveHandler = leaveHandler;
    }

    function getWordUnderCursor(target, x, y) {
        var textNode = target.firstChild;
        if (!textNode || textNode.nodeType !== 3) return null;
        
        var text = textNode.textContent;
        var words = text.split(/\s+/);
        var pos = 0;
        
        for (var i = 0; i < words.length; i++) {
            var w = words[i];
            if (!w.trim()) {
                pos += w.length + 1;
                continue;
            }
            
            var range = document.createRange();
            range.setStart(textNode, pos);
            range.setEnd(textNode, pos + w.length);
            
            var rects = range.getClientRects();
            if (!rects || rects.length === 0) {
                pos += w.length + 1;
                continue;
            }
            
            for (var j = 0; j < rects.length; j++) {
                var rect = rects[j];
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    var clean = w.replace(/[.,!?;:"'„"«»()[\]{}…]/g, "").replace(/^\s+|\s+$/g, "");
                    if (clean) return { word: clean.toLowerCase(), rect: rect };
                }
            }
            pos += w.length + 1;
        }
        return null;
    }

    function showHoverTip(word, trans, rect) {
        if (!_hoverTip) return;
        _hoverTip.innerHTML = "<strong>" + word + "</strong><br><em>" + trans + "</em>";
        _hoverTip.style.display = "block";
        
        var w = _hoverTip.offsetWidth || 120;
        var h = _hoverTip.offsetHeight || 40;
        var left = rect.left + (rect.width / 2) - (w / 2);
        var top = rect.top - h - 10;
        
        if (left < 8) left = 8;
        if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
        if (top < 8) top = rect.bottom + 8;
        
        _hoverTip.style.left = left + "px";
        _hoverTip.style.top = top + "px";
    }

    // ========== Контекстное меню ==========
    function initCtxMenu() {
        var lyrics = document.getElementById('lyricsDisplay');
        if (!lyrics) {
            setTimeout(initCtxMenu, 500);
            return;
        }
        
        lyrics.addEventListener('contextmenu', function(e) {
            if (e.button !== 2) return;
            if (window.editor && window.editor.isEditorMode) return;
            
            var line = e.target.closest('.line');
            if (!line) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            var wordInfo = getWordAtPos(line, e.clientX, e.clientY);
            if (!wordInfo || !wordInfo.word.trim()) {
                hideCtxMenu();
                return;
            }
            
            showCtxMenu(wordInfo, e.clientX, e.clientY);
        });
    }

    function getWordAtPos(line, x, y) {
        var textEl = line.querySelector('.line-text');
        if (!textEl) return null;
        
        var text = textEl.textContent;
        if (!text.trim()) return null;
        
        var range = document.createRange();
        var textNode = textEl.firstChild;
        if (!textNode) return null;
        
        var words = text.split(/\s+/);
        var pos = 0;
        
        for (var i = 0; i < words.length; i++) {
            var word = words[i];
            if (!word.trim()) {
                pos++;
                continue;
            }
            
            var start = pos;
            var end = pos + word.length;
            range.setStart(textNode, start);
            range.setEnd(textNode, end);
            
            var rect = range.getBoundingClientRect();
            if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                return {
                    word: word.replace(/[.,!?;:()\[\]{}"']/g, ''),
                    index: i,
                    rect: rect
                };
            }
            pos += word.length + 1;
        }
        return null;
    }

    function showCtxMenu(info, x, y) {
        if (!info || !info.word) return;
        _currWord = info.word;
        createCtxMenu();
        
        if (!_ctxMenu) return;
        _ctxMenu.style.display = 'flex';
        _ctxMenu.classList.add('visible');
        
        var w = _ctxMenu.offsetWidth;
        var h = _ctxMenu.offsetHeight;
        var left = x - w / 2;
        var top = y + 20;
        
        if (left < 10) left = 10;
        if (left + w > window.innerWidth - 10) left = window.innerWidth - w - 10;
        if (top + h > window.innerHeight - 10) top = y - h - 10;
        
        _ctxMenu.style.left = left + 'px';
        _ctxMenu.style.top = top + 'px';
        
        var star = _ctxMenu.querySelector('.vocab-context-star');
        if (star && core) {
            var inDict = core._findWordIndex(_currWord.toLowerCase()) !== -1;
            star.style.opacity = inDict ? '0.5' : '1';
            star.title = inDict ? 'Уже в словаре' : 'Добавить в словарь';
        }
    }

    function createCtxMenu() {
        if (_ctxMenu) return _ctxMenu;
        
        _ctxMenu = document.createElement('div');
        _ctxMenu.className = 'vocabulary-context-menu';
        _ctxMenu.innerHTML = `
            <button class="vocab-context-btn vocab-context-copy" title="Скопировать слово">📋</button>
            <button class="vocab-context-btn vocab-context-star" title="Добавить в словарь">⭐</button>
            <button class="vocab-context-btn vocab-context-translate" title="Перевести слово">🌐</button>
        `;
        
        document.body.appendChild(_ctxMenu);
        
        _ctxMenu.querySelector('.vocab-context-copy').addEventListener('click', function() {
            copyWord(_currWord);
            hideCtxMenu();
        });
        
        _ctxMenu.querySelector('.vocab-context-star').addEventListener('click', function() {
            addToVocab(_currWord);
            hideCtxMenu();
        });
        
        _ctxMenu.querySelector('.vocab-context-translate').addEventListener('click', function() {
            translateCtx(_currWord);
            hideCtxMenu();
        });
        
        document.addEventListener('click', function(e) {
            if (_ctxMenu && !_ctxMenu.contains(e.target)) hideCtxMenu();
        });
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && _ctxMenu) hideCtxMenu();
        });
        
        return _ctxMenu;
    }

    function hideCtxMenu() {
        if (_ctxMenu) {
            _ctxMenu.style.display = 'none';
            _currWord = '';
        }
    }

    function copyWord(text) {
        if (!text) return;
        var area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        try {
            area.select();
            var ok = document.execCommand('copy');
            if (ok) showToast('Скопировал: ' + text);
        } finally {
            document.body.removeChild(area);
        }
    }

    function addToVocab(word) {
        if (!word || !word.trim()) return;
        var clean = word.trim();
        var trans = core.getTranslation(clean);
        addWord(clean, trans);
    }

    function translateCtx(word) {
        if (!word || !word.trim()) return;
        var clean = word.trim();
        var cached = core.getTranslation(clean);
        if (cached) {
            showTransCloud(clean, cached, true);
        } else {
            fetchAndShow(clean);
        }
    }

    // ========== Облако перевода ==========
    function fetchAndShow(word) {
        var cached = core.getTranslation(word);
        if (cached) {
            console.log('✅ Найдено:', word, '→', cached);
            var cloud = showTransCloud(word, cached, true);
            var btn = cloud.querySelector('.translation-cloud-add-btn');
            if (btn) {
                btn.textContent = '⭐ ';
                btn.className = 'translation-cloud-add-btn translation-loaded';
                btn.disabled = true;
            }
            return Promise.resolve(cached);
        }
        
        if (!isOnline()) {
            console.log('❌ Нет интернета:', word);
            var cloud = showTransCloud(word, null, true);
            var loading = cloud.querySelector('.translation-loading');
            if (loading) loading.innerHTML = '<span style="color:#dc3545;">⚠️ Слово не в избранных</span>';
            return Promise.reject(new Error('Слово не найдено'));
        }
        
        console.log('🌐 Ищем онлайн:', word);
        var cloud = showTransCloud(word, null, true);
        
        return translateAPI(word)
            .then(function(trans) {
                var loading = cloud.querySelector('.translation-loading');
                if (loading) loading.style.display = 'none';
                
                var btn = cloud.querySelector('.translation-cloud-add-btn');
                if (btn) {
                    btn.setAttribute('data-translation', trans);
                    btn.textContent = '⭐ ';
                    btn.className = 'translation-cloud-add-btn translation-loaded';
                }
                
                var div = cloud.querySelector('div:nth-child(2)');
                if (div && !div.querySelector('.translation-text')) {
                    var span = document.createElement('span');
                    span.className = 'translation-text';
                    span.textContent = trans;
                    div.appendChild(span);
                }
                return trans;
            })
            .catch(function(err) {
                var loading = cloud.querySelector('.translation-loading');
                if (loading) loading.innerHTML = '<span style="color:#dc3545;">⚠️</span>';
                
                var btn = cloud.querySelector('.translation-cloud-add-btn');
                if (btn) btn.textContent = '⭐ Добавить без перевода';
                throw err;
            });
    }

    function showTransCloud(word, trans, showBtn) {
        hideTransCloud();
        
        var cloud = document.createElement('div');
        cloud.className = 'vocabulary-translation-cloud';
        cloud.innerHTML = getTransCloudHTML(word, trans, !trans && showBtn);
        
        positionCloud(cloud);
        document.body.appendChild(cloud);
        setupDrag(cloud);
        setupAutoHide(cloud);
        
        var btn = cloud.querySelector('.translation-cloud-add-btn');
        if (btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var w = this.getAttribute('data-word');
                var t = this.getAttribute('data-translation');
                if (w) {
                    addWord(w, t, { showAnimation: true, closeCloud: true, showToast: true });
                    this.disabled = true;
                    this.textContent = '⭐ Добавлено!';
                    this.style.background = '#28a745';
                    this.style.color = 'white';
                }
            });
        }
        
        _transCloud = cloud;
        return cloud;
    }

    function getTransCloudHTML(word, trans, loading) {
        var wordEsc = escapeHtml(word);
        var transEsc = trans ? escapeHtml(trans) : '';
        var html = '<div><span class="translation-cloud-word" style="cursor:grab;user-select:none;">' + wordEsc + '</span>';
        
        if (loading && !trans) {
            html += ' <span class="translation-loading"><span class="vocabulary-translation-loading"></span></span>';
        }
        
        html += '</div><div style="display:flex;align-items:center;gap:8px;">';
        var btnText = trans ? '⭐ ' : '⭐ Добавить в словарь';
        var btnClass = trans ? 'translation-cloud-add-btn translation-loaded' : 'translation-cloud-add-btn';
        
        html += '<button class="' + btnClass + '" data-word="' + wordEsc + '"';
        if (trans) html += ' data-translation="' + transEsc + '"';
        html += '>' + btnText + '</button>';
        
        if (trans) html += ' <span class="translation-text">' + transEsc + '</span>';
        html += '</div>';
        return html;
    }

    function positionCloud(cloud) {
        var saved = localStorage.getItem('vocabulary-cloud-position');
        var lastX = window.innerWidth / 2;
        var lastY = window.innerHeight / 2;
        
        if (saved) {
            try {
                var pos = JSON.parse(saved);
                if (pos.x > 20 && pos.x < window.innerWidth - 320 && pos.y > 20 && pos.y < window.innerHeight - 200) {
                    cloud.style.left = pos.x + 'px';
                    cloud.style.top = pos.y + 'px';
                    return;
                }
            } catch (e) {}
        }
        
        var x = Math.min(lastX + 20, window.innerWidth - 320);
        var y = Math.min(lastY + 20, window.innerHeight - 200);
        cloud.style.left = x + 'px';
        cloud.style.top = y + 'px';
    }

    function setupDrag(cloud) {
        var header = cloud.querySelector('.translation-cloud-word');
        if (!header) return;
        
        var dragging = false, startX, startY, startLeft, startTop;
        
        header.addEventListener('mousedown', function(e) {
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            var style = window.getComputedStyle(cloud);
            startLeft = parseInt(style.left) || 0;
            startTop = parseInt(style.top) || 0;
            
            cloud.style.cursor = 'grabbing';
            cloud.style.boxShadow = '0 8px 25px rgba(0,0,0,0.25)';
            cloud.style.opacity = '0.95';
            e.preventDefault();
        });
        
        var move = function(e) {
            if (!dragging) return;
            var dx = e.clientX - startX;
            var dy = e.clientY - startY;
            var left = Math.max(10, Math.min(startLeft + dx, window.innerWidth - cloud.offsetWidth - 10));
            var top = Math.max(10, Math.min(startTop + dy, window.innerHeight - cloud.offsetHeight - 10));
            cloud.style.left = left + 'px';
            cloud.style.top = top + 'px';
        };
        
        var up = function() {
            if (dragging) {
                dragging = false;
                cloud.style.cursor = '';
                cloud.style.boxShadow = '';
                cloud.style.opacity = '';
                var pos = { x: parseInt(cloud.style.left), y: parseInt(cloud.style.top) };
                localStorage.setItem('vocabulary-cloud-position', JSON.stringify(pos));
            }
        };
        
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
        cloud._dragHandlers = { move: move, up: up };
    }

    function setupAutoHide(cloud) {
        var timeout;
        function schedule() {
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                if (cloud.parentNode) hideTransCloud();
            }, 15000);
        }
        
        cloud.addEventListener('mouseenter', function() { clearTimeout(timeout); });
        cloud.addEventListener('mouseleave', schedule);
        
        var clickOut = function(e) {
            if (!cloud.parentNode) {
                document.removeEventListener('click', clickOut);
                return;
            }
            var inside = cloud.contains(e.target);
            var isBtn = e.target.classList.contains('vocabulary-translate-btn') || 
                       e.target.classList.contains('vocabulary-word');
            if (!inside && !isBtn) hideTransCloud();
        };
        
        setTimeout(function() { document.addEventListener('click', clickOut); }, 100);
        
        var scroll = function() { if (cloud.parentNode) hideTransCloud(); };
        var resize = function() { if (cloud.parentNode) hideTransCloud(); };
        
        window.addEventListener('scroll', scroll, { passive: true });
        window.addEventListener('resize', resize);
        
        cloud._eventHandlers = { click: clickOut, scroll: scroll, resize: resize };
        cloud._hideTimeout = timeout;
        schedule();
    }

    function hideTransCloud() {
        if (_transCloud && _transCloud.parentNode) {
            var cloud = _transCloud;
            
            if (cloud._dragHandlers) {
                document.removeEventListener('mousemove', cloud._dragHandlers.move);
                document.removeEventListener('mouseup', cloud._dragHandlers.up);
            }
            
            if (cloud._eventHandlers) {
                document.removeEventListener('click', cloud._eventHandlers.click);
                window.removeEventListener('scroll', cloud._eventHandlers.scroll);
                window.removeEventListener('resize', cloud._eventHandlers.resize);
            }
            
            if (cloud._hideTimeout) clearTimeout(cloud._hideTimeout);
            
            cloud.style.opacity = '0';
            cloud.style.transform = 'translateY(10px)';
            
            setTimeout(function() {
                if (cloud.parentNode) cloud.parentNode.removeChild(cloud);
            }, 300);
            
            _transCloud = null;
        }
        
        if (_transTimeout) {
            clearTimeout(_transTimeout);
            _transTimeout = null;
        }
    }

    // ========== API перевод ==========
    function translateAPI(word) {
        return new Promise(function(resolve, reject) {
            var clean = word.replace(/[^a-zA-ZäöüßÄÖÜа-яА-ЯёЁ0-9\s'-]/g, ' ').trim();
            
            var dict = {
                'und': 'и', 'oder': 'или', 'aber': 'но', 'als': 'как', 'wie': 'как',
                'wo': 'где', 'was': 'что', 'wer': 'кто', 'warum': 'почему',
                'weil': 'потому что', 'wenn': 'если', 'der': '(арт. м.р.)',
                'die': '(арт. ж.р.)', 'das': '(арт. ср.р.)', 'ein': '(неопр. арт.)',
                'ich': 'я', 'du': 'ты', 'er': 'он', 'sie': 'она', 'es': 'оно',
                'wir': 'мы', 'ihr': 'вы', 'sein': 'быть', 'haben': 'иметь',
                'werden': 'становиться', 'können': 'мочь', 'müssen': 'должен',
                'sollen': 'должен', 'wollen': 'хотеть', 'machen': 'делать',
                'gehen': 'идти', 'kommen': 'приходить', 'sehen': 'видеть',
                'geben': 'давать', 'nehmen': 'брать'
            };
            
            var local = dict[clean.toLowerCase()];
            if (local) {
                console.log('Локальный словарь:', clean, '→', local);
                resolve(local);
                return;
            }
            
            var providers = [{
                name: 'MyMemory',
                url: 'https://api.mymemory.translated.net/get',
                params: { q: clean, langpair: 'de|ru', mt: 1, onlyprivate: 0, de: 'a@b.c' },
                parse: function(data) {
                    if (data && data.responseData && data.responseData.translatedText) {
                        var trans = data.responseData.translatedText.trim();
                        var errors = ['PLEASE SELECT', 'QUOTA EXCEEDED', 'INVALID', 'NO MATCH'];
                        var hasErr = errors.some(function(p) { return trans.toUpperCase().includes(p); });
                        if (!hasErr && trans.toLowerCase() !== clean.toLowerCase() && trans.length > 0) {
                            return trans;
                        }
                    }
                    if (data && data.matches && data.matches.length > 0) {
                        for (var i = 0; i < data.matches.length; i++) {
                            var m = data.matches[i];
                            if (m.translation && m.translation.trim() && m.translation.toLowerCase() !== clean.toLowerCase()) {
                                return m.translation.trim();
                            }
                        }
                    }
                    return null;
                }
            }];
            
            function tryProv(idx) {
                if (idx >= providers.length) {
                    reject(new Error('Не удалось перевести'));
                    return;
                }
                
                var prov = providers[idx];
                var url = prov.url;
                if (prov.params) {
                    var params = new URLSearchParams();
                    for (var key in prov.params) params.append(key, prov.params[key]);
                    url += '?' + params.toString();
                }
                
                var timeout = setTimeout(function() {
                    reject(new Error('Таймаут'));
                }, 10000);
                
                fetch(url)
                    .then(function(res) {
                        clearTimeout(timeout);
                        if (!res.ok) throw new Error(prov.name + ': ' + res.status);
                        return res.json();
                    })
                    .then(function(data) {
                        var trans = prov.parse(data);
                        if (trans && trans.trim() !== '' && trans.toLowerCase() !== clean.toLowerCase()) {
                            resolve(trans);
                        } else {
                            tryProv(idx + 1);
                        }
                    })
                    .catch(function(err) {
                        clearTimeout(timeout);
                        tryProv(idx + 1);
                    });
            }
            
            tryProv(0);
        });
    }

    // ========== Пакетный перевод ==========
    function batchTranslate(words) {
        var total = words.length;
        var done = 0, failed = 0;
        var cancelled = false;
        
        var toast = document.createElement('div');
        toast.className = 'vocabulary-toast';
        toast.style.cssText = 'position:fixed;bottom:80px;right:30px;background:#17a2b8;color:white;' +
                             'padding:12px 20px;border-radius:6px;z-index:10001;min-width:250px;';
        toast.innerHTML = '<div style="margin-bottom:5px;font-weight:bold;">Пакетный перевод</div>' +
                         '<div>Прогресс: <span class="progress-count">0/' + total + '</span></div>' +
                         '<div style="margin-top:5px;font-size:12px;">Успешно: <span class="success-count">0</span>, Ошибок: <span class="error-count">0</span></div>' +
                         '<button class="cancel-translate-btn" style="margin-top:10px;padding:5px 10px;background:#dc3545;color:white;border:none;border-radius:3px;cursor:pointer;">Отменить</button>';
        
        document.body.appendChild(toast);
        
        toast.querySelector('.cancel-translate-btn').addEventListener('click', function() {
            cancelled = true;
            toast.querySelector('.progress-count').textContent = 'Отменено';
            setTimeout(function() {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 2000);
        });
        
        function translateNext(idx) {
            if (cancelled || idx >= words.length) {
                if (!cancelled) {
                    setTimeout(function() {
                        if (toast.parentNode) toast.parentNode.removeChild(toast);
                        showToast('Перевод завершен: ' + done + ' успешно, ' + failed + ' ошибок', failed === 0 ? 'success' : 'warning');
                    }, 1000);
                }
                return;
            }
            
            translateAPI(words[idx])
                .then(function(trans) {
                    if (!cancelled) {
                        core.setTranslation(words[idx], trans);
                        done++;
                        updateModalList();
                    }
                }, function() {
                    if (!cancelled) failed++;
                })
                .then(function() {
                    if (!cancelled) {
                        toast.querySelector('.progress-count').textContent = (idx + 1) + '/' + total;
                        toast.querySelector('.success-count').textContent = done;
                        toast.querySelector('.error-count').textContent = failed;
                        setTimeout(function() { translateNext(idx + 1); }, 1000);
                    }
                });
        }
        
        translateNext(0);
    }

    // ========== Утилиты UI ==========
    function updateCount() {
        var count = core.count;
        if (_floatBtn) {
            _floatBtn.innerHTML = '⭐' + (count > 0 ? count : '');
            _floatBtn.style.display = count > 0 ? 'flex' : 'none';
        }
        if (_menuItem) {
            _menuItem.innerHTML = '⭐ Избранное (' + count + ')';
        }
        if (_state.isModalOpen) {
            var header = _modal.querySelector('.vocabulary-modal-header h3');
            if (header) header.textContent = 'Избранные слова' + (count > 0 ? ' (' + count + ')' : '');
        }
    }

    function updateSortBtn() {
        var btn = _modal.querySelector('.vocabulary-sort-btn');
        if (!btn) return;
        if (_state.sort === 'date') {
            btn.textContent = 'a..z';
            btn.title = 'Сортировка по алфавиту';
        } else {
            btn.textContent = 'date';
            btn.title = 'Сортировка по дате';
        }
    }

    function copyToClip(text, callback) {
        var area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        area.style.opacity = '0';
        document.body.appendChild(area);
        try {
            area.select();
            var ok = document.execCommand('copy');
            if (ok && callback) callback();
            else showToast('Не удалось скопировать', 'error');
        } catch (err) {
            showToast('Ошибка копирования', 'error');
        } finally {
            document.body.removeChild(area);
        }
    }

    function fallbackCopy(text) {
        copyToClip(text, function() {});
    }

    function showToast(msg, type) {
        var old = document.querySelector('.vocabulary-toast');
        if (old) old.parentNode.removeChild(old);
        
        var colors = { success: '#28a745', error: '#dc3545', info: '#17a2b8' };
        var toast = document.createElement('div');
        toast.className = 'vocabulary-toast';
        toast.textContent = msg;
        toast.style.cssText = 'position:fixed;bottom:30px;right:30px;' +
                             'background:' + (colors[type] || colors.success) + ';' +
                             'color:white;padding:12px 20px;border-radius:6px;z-index:10001;' +
                             'box-shadow:0 4px 12px rgba(0,0,0,0.15);' +
                             'animation:vocabularyToastIn 0.3s ease;max-width:300px;';
        
        document.body.appendChild(toast);
        
        setTimeout(function() {
            if (toast.parentNode) {
                toast.style.animation = 'vocabularyToastOut 0.3s ease';
                setTimeout(function() {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 300);
            }
        }, 3000);
    }

    function setupEvents() {
        core.addEventListener('vocabulary:changed', function() {
            updateModalList();
            updateFloatPos();
        });
    }

    function injectStyles() {
        var style = document.createElement('style');
        style.textContent = `
            .vocabulary-context-menu {
                position:fixed;z-index:10002;background:#5d3968;border-radius:6px;
                box-shadow:0 4px 20px rgba(0,0,0,0.15);display:none;flex-direction:row;padding:4px;
            }
            .vocabulary-context-menu.visible { display:flex; animation:vocabularyFadeIn 0.2s ease; }
            .vocab-context-btn {
                background:#7d5188;border:1px solid #2b143d;color:#fff;border-radius:4px;
                padding:6px 10px;cursor:pointer;font-size:14px;transition:all 0.2s ease;
            }
            .vocab-context-btn:hover { background:#ad42cb; transform:scale(1.05); }
            .vocab-context-btn:active { transform:scale(0.95); }
            @keyframes vocabularyFadeIn {
                from { opacity:0; transform:translateY(-5px); }
                to { opacity:1; transform:translateY(0); }
            }
            @keyframes vocabularyToastIn {
                from { opacity:0; transform:translateY(20px); }
                to { opacity:1; transform:translateY(0); }
            }
            @keyframes vocabularyToastOut {
                from { opacity:1; transform:translateY(0); }
                to { opacity:0; transform:translateY(20px); }
            }
        `;
        document.head.appendChild(style);
    }

    // ========== Публичный API ==========
    return {
        // Основные методы
        init: function(coreInstance) {
            if (!instance) {
                instance = this;
                init(coreInstance);
                setTimeout(injectStyles, 100);
            }
            return instance;
        },
        
        // UI действия
        showModal: showModal,
        hideModal: hideModal,
        addWord: addWord,
        translateWord: fetchAndShow,  // Алиас для совместимости
        showToast: showToast,
        
        // Интеграция
        fetchAndShowTranslation: fetchAndShow,
        translateWordAPI: translateAPI,
        showTranslationCloud: showTransCloud,
        hideTranslationCloud: hideTransCloud,
        isOnline: isOnline,
        
        // Геттеры
        getCore: function() { return core; },
        getState: function() { return _state; }
    };
})();

// Экспорт
if (typeof window !== 'undefined') {
    window.VocabularyUI = VocabularyUI;
}