// features/editor.js — Редактор разметки
App.Editor = {
    isEditorMode: false,
    lastTimestamp: null,
    magnetEnabled: true,
    waveform: null, // Добавляем ссылку на waveform

    init() {
        App.EventBus.on('editor:toggle', () => this.toggle());
        App.EventBus.on('editor:activate-line', ({ index, lineEl }) => this.activateLine(index, lineEl));
        App.EventBus.on('editor:deactivate-line', ({ lineEl }) => this.deactivateLine(lineEl));
        App.EventBus.on('editor:mark-added', ({ time }) => this.lastTimestamp = time);
        App.EventBus.on('editor:add-mark', () => this.addTimestampMark());
        
        this.setupEditorToggle();
        this.setupKeyboard();
        this.setupContextMenu();
        this.bindEditorEvents(); // 👈 Добавляем привязку событий
        
        console.log('✅ Editor initialized');
    },

    // ==================== НОВЫЙ МЕТОД: ПРИВЯЗКА СОБЫТИЙ ====================
    bindEditorEvents() {
        // 1. Кнопка "Назад" (выход из режима редактора)
        const backBtn = document.getElementById('editorBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.toggle());
        }

        // 2. Выпадающее меню редактора (делегирование событий)
        const editorMenuBtn = document.getElementById('editorMenuBtn');
        const editorDropdown = document.getElementById('editorDropdown');
        
        if (editorMenuBtn && editorDropdown) {
            // Открытие/закрытие самого меню
            editorMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                editorDropdown.style.display = editorDropdown.style.display === 'none' ? 'block' : 'none';
            });

            // Обработка кликов по пунктам меню
            editorDropdown.addEventListener('click', (e) => {
                const btn = e.target.closest('.menu-btn');
                if (btn && btn.dataset.action) {
                    this.handleMenuAction(btn.dataset.action);
                    editorDropdown.style.display = 'none'; // Скрываем меню после выбора
                }
            });
        }

        // 3. Кнопки управления вейвформой (делегирование на общем контейнере)
        const waveformControls = document.querySelector('.waveform-controls');
        if (waveformControls) {
            waveformControls.addEventListener('click', (e) => {
                const btn = e.target.closest('.waveform-btn');
                if (!btn) return;
                
                // Определяем действие по data-action атрибуту
                const action = btn.dataset.action;
                switch (action) {
                    case 'zoom-in': this.handleZoomIn(); break;
                    case 'zoom-out': this.handleZoomOut(); break;
                    case 'amp-up': this.handleAmplitudeUp(); break;
                    case 'amp-down': this.handleAmplitudeDown(); break;
                    default: console.warn(`[Editor] Неизвестное действие: ${action}`);
                }
            });
        }

        // 4. Кнопки плеера внутри редактора
        const editorPlayBtn = document.getElementById('editorPlayBtn');
        if (editorPlayBtn) {
            editorPlayBtn.addEventListener('click', () => {
                // Вызываем глобальный плеер
                if (App.Player && App.Player.togglePlay) {
                    App.Player.togglePlay();
                } else {
                    App.EventBus.emit('player:toggle-play');
                }
            });
        }

        const editorMarkBtn = document.getElementById('editorMarkBtn');
        if (editorMarkBtn) {
            editorMarkBtn.addEventListener('click', () => {
                this.addTimestampMark(); // Добавляем метку
            });
        }
        
        // 5. Закрытие меню при клике вне его
        document.addEventListener('click', (e) => {
            if (editorDropdown && !editorDropdown.contains(e.target) && e.target !== editorMenuBtn) {
                editorDropdown.style.display = 'none';
            }
        });

        // 6. Кнопка магнита (если есть отдельная)
        const magnetBtn = document.getElementById('toggleMagnetBtn');
        if (magnetBtn) {
            magnetBtn.addEventListener('click', () => this.toggleMagnet());
        }

        // 7. Кнопка сохранения/экспорта
        const saveBtn = document.getElementById('exportLyricsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.exportLyrics());
        }
    },

    // ==================== ОБРАБОТКА ДЕЙСТВИЙ МЕНЮ ====================
    handleMenuAction(action) {
        const actions = {
            'toggleMagnet': () => this.toggleMagnet(),
            'clrTextFormat': () => this.clearTextFormat(),
            'splitDot': () => this.splitTextBy('.'),
            'splitComma': () => this.splitTextBy(','),
            'clearMarks': () => this.clearAllMarks(),
            'audioAnalyze': () => this.analyzeAudioPauses(),
            'saveToFile': () => this.exportLyrics(),
            'cancelOperation': () => this.cancelOperation(),
            // Добавьте сюда другие действия, если они есть
        };
        
        if (actions[action]) {
            actions[action]();
        } else {
            console.warn(`[Editor] Действие '${action}' не реализовано`);
        }
    },

    // ==================== WAVEFORM КОНТРОЛЫ ====================
    handleZoomIn() {
        // Используем App.Waveform вместо this.waveform
        if (App.Waveform && typeof App.Waveform.zoomIn === 'function') {
            App.Waveform.zoomIn();
        } else {
            console.warn('[Editor] Waveform не доступен для zoomIn');
        }
    },

    handleZoomOut() {
        if (App.Waveform && typeof App.Waveform.zoomOut === 'function') {
            App.Waveform.zoomOut();
        } else {
            console.warn('[Editor] Waveform не доступен для zoomOut');
        }
    },

    handleAmplitudeUp() {
        if (App.Waveform && typeof App.Waveform.adjustAmplitude === 'function') {
            App.Waveform.adjustAmplitude(1.2);
        } else {
            console.warn('[Editor] Waveform не доступен для adjustAmplitude');
        }
    },

    handleAmplitudeDown() {
        if (App.Waveform && typeof App.Waveform.adjustAmplitude === 'function') {
            App.Waveform.adjustAmplitude(0.8);
        } else {
            console.warn('[Editor] Waveform не доступен для adjustAmplitude');
        }
    },

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================
    
    clearTextFormat() {
        // Очистка форматирования текста
        App.Store.lines.forEach(line => {
            if (line.text) {
                line.text = line.text.replace(/<[^>]*>/g, '').trim();
            }
        });
        App.Store.setLines([...App.Store.lines]);
        App.UIManager.showNotification('Форматирование очищено', 'success');
    },

    splitTextBy(separator) {
        const newLines = [];
        App.Store.lines.forEach(line => {
            if (line.text && line.text.includes(separator)) {
                const parts = line.text.split(separator);
                parts.forEach((part, i) => {
                    if (part.trim()) {
                        newLines.push({
                            time: i === 0 ? line.time : -1,
                            text: part.trim() + (i < parts.length - 1 ? separator : '')
                        });
                    }
                });
            } else {
                newLines.push({ ...line });
            }
        });
        App.Store.setLines(newLines);
        App.UIManager.showNotification(`Разбито по "${separator}"`, 'success');
    },

    clearAllMarks() {
        // Очистка всех временных меток
        App.Store.lines.forEach(line => line.time = -1);
        App.Store.setLines([...App.Store.lines]);
        
        if (App.Waveform && typeof App.Waveform.clearAllMarks === 'function') {
            App.Waveform.clearAllMarks();
        }
        
        App.UIManager.showNotification('Все метки удалены', 'success');
    },

    analyzeAudioPauses() {
        // Анализ пауз в аудио (заглушка)
        App.UIManager.showNotification('Анализ аудио...', 'info');
        // Здесь можно добавить реальную логику анализа
        setTimeout(() => {
            App.UIManager.showNotification('Анализ завершен', 'success');
        }, 1500);
    },

    cancelOperation() {
        App.UIManager.showNotification('Операция отменена', 'info');
    },

    // ==================== СУЩЕСТВУЮЩИЕ МЕТОДЫ ====================

    setupEditorToggle() {
        const editorBtn = document.getElementById('toggleEditorBtn');
        editorBtn?.addEventListener('click', () => {
            const isEditorMode = !App.Store.state.isEditorMode;
            App.Store.updateState({ isEditorMode });
            
            const editorControls = document.getElementById('editorControls');
            if (editorControls) {
                editorControls.style.display = isEditorMode ? 'block' : 'none';
            }
            
            // Если открыли редактор и есть аудио - пробуем загрузить waveform
            if (isEditorMode && App.Player.audio.src) {
                setTimeout(() => {
                    App.Waveform.scheduleLoad(App.Player.audio.src);
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

            // Простое контекстное меню через confirm
            if (this.lastTimestamp !== null) {
                if (confirm(`Привязать метку ${App.Parser.formatTime(this.lastTimestamp)} к строке ${index + 1}?`)) {
                    App.Store.lines[index].time = this.lastTimestamp;
                    App.Store.setLines([...App.Store.lines]);
                    App.UIManager.showNotification('Метка привязана!', 'success');
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
        App.Waveform.addTimestampMark(finalTime);

        App.UIManager.showNotification(`📍 Метка: ${App.Parser.formatTime(finalTime)}`, 'success');
    },

    findNearestSilence(clickTime) {
        // Упрощённая версия — в реальном коде используйте анализ waveform
        return clickTime;
    },

    toggleMagnet() {
        this.magnetEnabled = !this.magnetEnabled;
        App.UIManager.showNotification(this.magnetEnabled ? '🔗 Магнит вкл' : '🔗 Магнит выкл');
    },

    exportLyrics() {
        const text = App.Parser.exportToText(App.Store.lines);
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'karaoke_lyrics.txt';
        a.click();
        URL.revokeObjectURL(url);
    }
};
