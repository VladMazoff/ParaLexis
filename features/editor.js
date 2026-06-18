// features/editor.js — Редактор разметки
App.Editor = {
    isEditorMode: false,
    lastTimestamp: null,
    magnetEnabled: true,

    init() {
        App.EventBus.on('editor:toggle', () => this.toggle());
        App.EventBus.on('editor:activate-line', ({ index, lineEl }) => this.activateLine(index, lineEl));
        App.EventBus.on('editor:deactivate-line', ({ lineEl }) => this.deactivateLine(lineEl));
        App.EventBus.on('editor:mark-added', ({ time }) => this.lastTimestamp = time);
        App.EventBus.on('editor:add-mark', () => this.addTimestampMark());
        this.setupEditorToggle();
        
        console.log('✅ Editor initialized');
        this.setupKeyboard();
        this.setupContextMenu();
        console.log('✅ Editor initialized');
    },

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
                // Даём время на отображение контейнера
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
        const editorControls = document.getElementById('editorControls');
        if (!player || !editorControls) return;

        if (!player.dataset.originalHeight) {
            player.dataset.originalHeight = player.offsetHeight + 'px';
        }

        const newHeight = editorControls.offsetHeight + 20;
        player.style.height = newHeight + 'px';
        player.style.minHeight = newHeight + 'px';

        const main = document.getElementById('mainContent');
        if (main) main.style.marginTop = (newHeight + 20) + 'px';
    },

    restorePlayerHeight() {
        const player = document.getElementById('playerContainer');
        const main = document.getElementById('mainContent');

        if (player) {
            player.style.height = '';
            player.style.minHeight = '';
        }

        setTimeout(() => {
            const h = player?.offsetHeight || 90;
            if (main) main.style.marginTop = (h + 20) + 'px';
        }, 100);
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
