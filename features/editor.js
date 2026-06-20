// features/editor.js — Редактор разметки
App.Editor = {
    isEditorMode: false,
    lastTimestamp: null,
    magnetEnabled: true,
    waveform: null, // Ссылка на объект waveform

    init() {
        // Обработчики событий шины
        App.EventBus.on('editor:toggle', () => this.toggle());
        App.EventBus.on('editor:activate-line', ({ index, lineEl }) => this.activateLine(index, lineEl));
        App.EventBus.on('editor:deactivate-line', ({ lineEl }) => this.deactivateLine(lineEl));
        App.EventBus.on('editor:mark-added', ({ time }) => this.lastTimestamp = time);
        App.EventBus.on('editor:add-mark', () => this.addTimestampMark());
        
        // Привязка событий к UI элементам
        this.bindEditorEvents();
        
        // Настройка остальных функций
        this.setupEditorToggle();
        this.setupKeyboard();
        this.setupContextMenu();
        
        console.log('✅ Editor initialized');
    },

    // ==================== ПРИВЯЗКА СОБЫТИЙ К UI ====================
    bindEditorEvents() {
        // 1. Кнопка "Назад" (выход из режима редактора)
        const backBtn = document.getElementById('editorBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (this.isEditorMode) {
                    this.toggle();
                }
            });
        }

        // 2. Выпадающее меню редактора (делегирование событий)
        const editorMenuBtn = document.getElementById('editorMenuBtn');
        const editorDropdown = document.getElementById('editorDropdown');
        
        if (editorMenuBtn && editorDropdown) {
            // Открытие/закрытие самого меню
            editorMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = editorDropdown.style.display === 'none' || !editorDropdown.style.display;
                editorDropdown.style.display = isHidden ? 'block' : 'none';
            });

            // Обработка кликов по пунктам меню
            editorDropdown.addEventListener('click', (e) => {
                const btn = e.target.closest('.menu-btn');
                if (btn && btn.dataset.action) {
                    this.handleMenuAction(btn.dataset.action);
                    editorDropdown.style.display = 'none';
                }
            });
        }

        // 3. Кнопки управления вейвформой (делегирование на общем контейнере)
        const waveformControls = document.querySelector('.waveform-controls');
        if (waveformControls) {
            waveformControls.addEventListener('click', (e) => {
                const btn = e.target.closest('.waveform-btn');
                if (!btn) return;
                
                const action = btn.dataset.action;
                if (action) {
                    switch (action) {
                        case 'zoom-in': this.handleZoomIn(); break;
                        case 'zoom-out': this.handleZoomOut(); break;
                        case 'amp-up': this.handleAmplitudeUp(); break;
                        case 'amp-down': this.handleAmplitudeDown(); break;
                        default: console.warn(`[Editor] Неизвестное действие: ${action}`);
                    }
                } else {
                    // Fallback на текст кнопки
                    const text = btn.textContent.trim();
                    switch (text) {
                        case '➕': this.handleZoomIn(); break;
                        case '➖': this.handleZoomOut(); break;
                        case '📈': this.handleAmplitudeUp(); break;
                        case '📉': this.handleAmplitudeDown(); break;
                    }
                }
            });
        }

        // 4. Кнопки плеера внутри редактора
        const editorPlayBtn = document.getElementById('editorPlayBtn');
        if (editorPlayBtn) {
            editorPlayBtn.addEventListener('click', () => {
                if (App.Player && typeof App.Player.togglePlay === 'function') {
                    App.Player.togglePlay();
                } else {
                    App.EventBus.emit('player:toggle-play');
                }
            });
        }

        const editorMarkBtn = document.getElementById('editorMarkBtn');
        if (editorMarkBtn) {
            editorMarkBtn.addEventListener('click', () => {
                this.addTimestampMark();
            });
        }
        
        // 5. Закрытие меню при клике вне его
        document.addEventListener('click', (e) => {
            if (editorDropdown && !editorDropdown.contains(e.target) && e.target !== editorMenuBtn) {
                editorDropdown.style.display = 'none';
            }
        });
    },

    // ==================== ОБРАБОТКА ДЕЙСТВИЙ МЕНЮ ====================
    handleMenuAction(action) {
        const actions = {
            'toggleMagnet': () => this.toggleMagnet(),
            'clrTextFormat': () => this.clearTextFormatting(),
            'splitDot': () => this.splitTextBy('.'),
            'splitComma': () => this.splitTextBy(','),
            'clearMarks': () => this.clearTimeMarks(),
            'audioAnalyze': () => this.analyzeAudio(),
            'saveToFile': () => this.exportLyrics(),
            'cancelOperation': () => this.cancelCurrentOperation(),
        };
        
        if (actions[action]) {
            actions[action]();
        } else {
            console.warn(`[Editor] Действие '${action}' не реализовано`);
            this.showNotification(`⚠️ Действие "${action}" не реализовано`, 'warning');
        }
    },

    // ==================== WAVEFORM КОНТРОЛЫ ====================


handleZoomIn() {
    const waveformInstance = this.waveform;
    
    if (waveformInstance && typeof waveformInstance.zoomIn === 'function') {
        waveformInstance.zoomIn();
        console.log('[Editor] Zoom In');
        this.showNotification('🔍 Масштаб увеличен', 'success');
    } else {
        console.warn('[Editor] Waveform not available for zoom in');
        this.showNotification('⚠️ Волновая форма не загружена', 'warning');
    }
},

handleZoomOut() {
    const waveformInstance = this.waveform;
    
    if (waveformInstance && typeof waveformInstance.zoomOut === 'function') {
        waveformInstance.zoomOut();
        console.log('[Editor] Zoom Out');
        this.showNotification('🔍 Масштаб уменьшен', 'success');
    } else {
        console.warn('[Editor] Waveform not available for zoom out');
        this.showNotification('⚠️ Волновая форма не загружена', 'warning');
    }
},

handleAmplitudeUp() {
    const waveformInstance = this.waveform;
    
    if (waveformInstance && typeof waveformInstance.adjustAmplitude === 'function') {
        waveformInstance.adjustAmplitude(1.2);
        console.log('[Editor] Amplitude Up');
        this.showNotification('🔊 Амплитуда увеличена', 'success');
    } else {
        console.warn('[Editor] Waveform not available for amplitude adjustment');
        this.showNotification('⚠️ Волновая форма не загружена', 'warning');
    }
},

handleAmplitudeDown() {
    const waveformInstance = this.waveform;
    
    if (waveformInstance && typeof waveformInstance.adjustAmplitude === 'function') {
        waveformInstance.adjustAmplitude(0.8);
        console.log('[Editor] Amplitude Down');
        this.showNotification('🔊 Амплитуда уменьшена', 'success');
    } else {
        console.warn('[Editor] Waveform not available for amplitude adjustment');
        this.showNotification('⚠️ Волновая форма не загружена', 'warning');
    }
},
    // ==================== ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ ДЛЯ МЕНЮ ====================
    clearTextFormatting() {
        App.Store.lines.forEach(line => {
            if (line.text) {
                line.text = line.text.replace(/<[^>]*>/g, '');
            }
        });
        App.Store.setLines([...App.Store.lines]);
        this.showNotification('🧹 Форматирование очищено', 'success');
    },

    splitTextBy(separator) {
        if (!separator) return;
        
        const newLines = [];
        App.Store.lines.forEach(line => {
            if (line.text.includes(separator)) {
                const parts = line.text.split(separator).filter(p => p.trim());
                parts.forEach((part, index) => {
                    newLines.push({
                        time: index === 0 ? line.time : -1,
                        text: part.trim() + (index < parts.length - 1 ? separator : '')
                    });
                });
            } else {
                newLines.push({ ...line });
            }
        });
        
        App.Store.setLines(newLines);
        this.showNotification(`✂️ Разделено по "${separator}"`, 'success');
    },

    clearTimeMarks() {
        App.Store.lines.forEach(line => {
            line.time = -1;
        });
        App.Store.setLines([...App.Store.lines]);
        this.lastTimestamp = null;
        this.showNotification('🗑️ Временные метки удалены', 'success');
    },

    analyzeAudio() {
        this.showNotification('⏳ Анализ аудио...', 'info');
        // Здесь должна быть логика анализа
        setTimeout(() => {
            this.showNotification('✅ Анализ завершён', 'success');
        }, 1500);
    },

    cancelCurrentOperation() {
        this.showNotification('❌ Операция отменена', 'warning');
        document.querySelectorAll('.line-editing').forEach(el => this.deactivateLine(el));
    },

    // ==================== ОСНОВНЫЕ МЕТОДЫ РЕДАКТОРА ====================
    setupEditorToggle() {
        const editorBtn = document.getElementById('toggleEditorBtn');
        editorBtn?.addEventListener('click', () => {
            const isEditorMode = !App.Store.state.isEditorMode;
            App.Store.updateState({ isEditorMode });
            
            const editorControls = document.getElementById('editorControls');
            if (editorControls) {
                editorControls.style.display = isEditorMode ? 'block' : 'none';
            }
            
            // При открытии редактора инициализируем waveform
            if (isEditorMode && App.Player.audio.src) {
                setTimeout(() => {
                    // Сначала пробуем получить waveform через App.Waveform
                    if (App.Waveform && typeof App.Waveform.scheduleLoad === 'function') {
                        App.Waveform.scheduleLoad(App.Player.audio.src);
                        // Сохраняем ссылку на waveform из App.Waveform
                        setTimeout(() => {
                            if (App.Waveform.instance) {
                                this.waveform = App.Waveform.instance;
                                console.log('[Editor] Waveform instance attached');
                            }
                        }, 200);
                    } else {
                        // Или инициализируем через собственный метод
                        this.initWaveform();
                    }
                }, 100);
            }
        });
    },

    toggle() {
        this.isEditorMode = !this.isEditorMode;
        App.Store.setEditorMode(this.isEditorMode);

        const player = document.getElementById('playerContainer');
        const editorControls = document.getElementById('editorControls');

        if (this.isEditorMode) {
            player.classList.add('editor-mode');
            if (editorControls) editorControls.style.display = 'block';
            this.updatePlayerHeight();
            App.LyricsRenderer.render(App.Store.lines);
            
            // Инициализируем waveform при открытии
            if (App.Player.audio && App.Player.audio.src) {
                setTimeout(() => {
                    this.initWaveform();
                }, 200);
            }
        } else {
            player.classList.remove('editor-mode');
            if (editorControls) editorControls.style.display = 'none';
            this.restorePlayerHeight();
        }
    },

    updatePlayerHeight() {
        const player = document.getElementById('playerContainer');
        if (!player) return;
        player.style.height = 'auto';
    },

    restorePlayerHeight() {
        const player = document.getElementById('playerContainer');
        if (!player) return;
        player.style.height = 'auto';
    },

initWaveform() {
    if (!App.Player?.audio?.src) {
        console.warn('[Editor] No audio source for waveform');
        return;
    }

    // Если уже есть waveform в App.Waveform - используем его
    if (App.Waveform && typeof App.Waveform.init === 'function') {
        this.waveform = App.Waveform; // Сохраняем ссылку на модуль
        console.log('[Editor] Waveform instance obtained from App.Waveform');
        return;
    }

        // Если waveform уже создан локально, обновляем его
        if (this.waveform) {
            if (typeof this.waveform.updateAudio === 'function') {
                this.waveform.updateAudio(App.Player.audio.src);
            }
            return;
        }

        const container = document.getElementById('waveformContainer');
        const canvas = document.getElementById('waveformCanvas');
        
        if (!container || !canvas) {
            console.error('[Editor] Waveform container or canvas not found');
            return;
        }

        // Проверяем, загружен ли модуль
        if (typeof WaveformModule !== 'undefined') {
            try {
                this.waveform = new WaveformModule(App.Player);
                if (typeof this.waveform.setContainer === 'function') {
                    this.waveform.setContainer(container, canvas);
                }
                console.log('[Editor] Waveform initialized successfully');
            } catch (error) {
                console.error('[Editor] Failed to initialize waveform:', error);
                this.showNotification('Ошибка инициализации волновой формы', 'error');
            }
        } else {
            console.warn('[Editor] WaveformModule not available');
            this.showNotification('Модуль волновой формы не загружен', 'warning');
        }
    },



    // ==================== РАБОТА СО СТРОКАМИ ====================
    activateLine(index, lineEl) {
        document.querySelectorAll('.line-editing').forEach(el => this.deactivateLine(el));

        const textSpan = lineEl.querySelector('.line-text');
        const textInput = lineEl.querySelector('.line-input');

        lineEl.classList.add('line-editing');
        if (textSpan) textSpan.style.display = 'none';
        if (textInput) {
            textInput.style.display = 'block';
            textInput.focus();
        }

        this.setupLineEditing(lineEl, index, textSpan, textInput);
    },

    deactivateLine(lineEl) {
        const textSpan = lineEl.querySelector('.line-text');
        const textInput = lineEl.querySelector('.line-input');

        lineEl.classList.remove('line-editing');
        if (textSpan) textSpan.style.display = 'block';
        if (textInput) textInput.style.display = 'none';
    },

    setupLineEditing(lineEl, index, textSpan, textInput) {
        if (textInput.dataset.eh) return;
        textInput.dataset.eh = 'true';

        textInput.addEventListener('keydown', (e) => {
            if (!this.isEditorMode || !lineEl.classList.contains('line-editing')) return;

            const cursorPos = textInput.selectionStart;
            const textLength = textInput.value.length;
            const atStart = cursorPos === 0;
            const atEnd = cursorPos === textLength;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!atStart) {
                    textInput.setSelectionRange(0, 0);
                } else if (index > 0) {
                    this.saveAndMove(index, textInput, textSpan, lineEl, index - 1, 'end');
                }
            }
            else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!atEnd) {
                    textInput.setSelectionRange(textLength, textLength);
                } else if (index < App.Store.lines.length - 1) {
                    this.saveAndMove(index, textInput, textSpan, lineEl, index + 1, 'start');
                }
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                const before = textInput.value.substring(0, cursorPos);
                const after = textInput.value.substring(cursorPos);
                if (!before.trim() || !after.trim()) return;

                App.Store.lines[index].text = before;
                App.Store.lines.splice(index + 1, 0, { time: -1, text: after });
                App.Store.setLines([...App.Store.lines]);

                setTimeout(() => {
                    const next = document.querySelector(`.line[data-index="${index + 1}"]`);
                    if (next) this.activateLine(index + 1, next);
                }, 10);
            }
            else if (e.key === 'Delete' && atEnd && index < App.Store.lines.length - 1) {
                e.preventDefault();
                App.Store.lines[index].text += App.Store.lines[index + 1].text;
                App.Store.lines.splice(index + 1, 1);
                App.Store.setLines([...App.Store.lines]);
            }
            else if (e.key === 'Backspace' && atStart && index > 0) {
                e.preventDefault();
                const prevLen = App.Store.lines[index - 1].text.length;
                App.Store.lines[index - 1].text += App.Store.lines[index].text;
                App.Store.lines.splice(index, 1);
                App.Store.setLines([...App.Store.lines]);

                setTimeout(() => {
                    const prev = document.querySelector(`.line[data-index="${index - 1}"]`);
                    if (prev) {
                        this.activateLine(index - 1, prev);
                        const inp = prev.querySelector('.line-input');
                        if (inp) inp.setSelectionRange(prevLen, prevLen);
                    }
                }, 10);
            }
        });
    },

    saveAndMove(currentIdx, input, textSpan, lineEl, newIdx, cursorPos) {
        const newText = input.value.trim();
        if (newText !== App.Store.lines[currentIdx].text) {
            App.Store.lines[currentIdx].text = newText;
            textSpan.textContent = newText;
            App.EventBus.emit('state:save', { now: true });
        }

        this.deactivateLine(lineEl);

        setTimeout(() => {
            const next = document.querySelector(`.line[data-index="${newIdx}"]`);
            if (next) {
                this.activateLine(newIdx, next);
                const inp = next.querySelector('.line-input');
                if (inp) {
                    inp.focus();
                    if (cursorPos === 'start') inp.setSelectionRange(0, 0);
                    else if (cursorPos === 'end') inp.setSelectionRange(inp.value.length, inp.value.length);
                }
            }
        }, 10);
    },

    // ==================== РАБОТА С МЕТКАМИ ВРЕМЕНИ ====================
    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.isEditorMode && 
                e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                this.addTimestampMark();
            }
        });
    },

    setupContextMenu() {
        const lyricsDisplay = document.getElementById('lyricsDisplay');
        if (!lyricsDisplay) return;

        lyricsDisplay.addEventListener('contextmenu', (e) => {
            if (!this.isEditorMode) return;

            const lineEl = e.target.closest('.line');
            if (!lineEl) return;

            e.preventDefault();
            const index = parseInt(lineEl.dataset.index);

            if (this.lastTimestamp !== null) {
                if (confirm(`Привязать метку ${App.Parser.formatTime(this.lastTimestamp)} к строке ${index + 1}?`)) {
                    App.Store.lines[index].time = this.lastTimestamp;
                    App.Store.setLines([...App.Store.lines]);
                    this.showNotification('Метка привязана!', 'success');
                }
            }
        });
    },

    addTimestampMark() {
        if (!App.Player.audio) return;

        const currentTime = App.Player.audio.currentTime;
        const finalTime = this.magnetEnabled ? this.findNearestSilence(currentTime) : currentTime;

        App.Player.audio.currentTime = finalTime;
        this.lastTimestamp = finalTime;

        App.EventBus.emit('editor:mark-added', { time: finalTime });
        
        // Добавляем метку на waveform
        const waveformInstance = this.waveform || (App.Waveform && App.Waveform.instance);
        if (waveformInstance && typeof waveformInstance.addTimestampMark === 'function') {
            waveformInstance.addTimestampMark(finalTime);
        } else if (App.Waveform && typeof App.Waveform.addTimestampMark === 'function') {
            App.Waveform.addTimestampMark(finalTime);
        }

        this.showNotification(`📍 Метка: ${App.Parser.formatTime(finalTime)}`, 'success');
    },

    findNearestSilence(clickTime) {
        // Упрощённая версия — в реальном коде используйте анализ waveform
        return clickTime;
    },

    toggleMagnet() {
        this.magnetEnabled = !this.magnetEnabled;
        this.showNotification(
            this.magnetEnabled ? '🔗 Магнит включён' : '🔗 Магнит выключен',
            'success'
        );
    },

    // ==================== ЭКСПОРТ ====================
    exportLyrics() {
        const text = App.Parser.exportToText(App.Store.lines);
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'karaoke_lyrics.txt';
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('✅ Файл сохранён', 'success');
    },

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================
    showNotification(message, type = 'info') {
        if (App.UIManager && typeof App.UIManager.showNotification === 'function') {
            App.UIManager.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
            if (type === 'error') {
                alert(message);
            }
        }
    }
};
