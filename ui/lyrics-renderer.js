// ui/lyrics-renderer.js — Отображение строк, скроллинг, бабблы
App.LyricsRenderer = {
    container: null,
    scrollUpOffs: 1,
    scrollDnOffs: 2,

    init() {
        this.container = document.getElementById('lyricsDisplay');
        if (!this.container) {
            console.error('Lyrics display not found');
            return;
        }

        App.EventBus.on('state:lines-updated', (lines) => this.render(lines));
        App.EventBus.on('state:current-line-updated', (idx) => this.highlightLine(idx));
        App.EventBus.on('player:timeupdate', ({ time }) => this.onTimeUpdate(time));
        App.EventBus.on('state:settings-updated', () => this.updateBubblesVisibility());
        App.EventBus.on('repeat:tick', ({ remaining, current }) => this.updateRepeatButtons(remaining, current));
        App.EventBus.on('repeat:stopped', ({ resetToInitial }) => {
            if (resetToInitial) this.resetRepeatButtons();
        });

        console.log('✅ LyricsRenderer initialized');
    },

    escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    render(lines) {
        if (!this.container) return;

        const settings = App.Store.settings;
        const repeatCount = settings.repeatCount;

        let html = '';
        lines.forEach((line, i) => {
            const time = line.time <= 0 ? '--:--' : App.Parser.formatTime(line.time);
            const timeStyle = line.time <= 0 ? 'color:#ccc' : '';

            html += `<div class="line line-editable" data-index="${i}" data-time="${line.time}">
                <div class="line-time-container">
                    <span class="line-time" style="${timeStyle}">${time}</span>
                    <button class="repeat-btn">${repeatCount}x▶</button>
                </div>
                <span class="line-text">${this.escapeHtml(line.text)}</span>
                <textarea class="line-input" style="display:none">${this.escapeHtml(line.text)}</textarea>
                <button class="save-line-btn" title="Сохранить" style="display:none"></button>`;

            if (line.translation || line.notes) {
                html += `<div class="extra-bubble">
                    ${line.translation ? `<div class="bubble-translation">${this.escapeHtml(line.translation)}</div>` : ''}
                    ${line.notes ? `<div class="bubble-notes">${this.escapeHtml(line.notes)}</div>` : ''}
                </div>`;
            }
            html += '</div>';
        });

        this.container.innerHTML = html;
        this.attachLineHandlers();

        if (App.Store.settings.mode === 'beginner' && App.Store.currentLine >= 0) {
            this.showBubble(App.Store.currentLine);
        }
    },

    attachLineHandlers() {
        const lines = this.container.querySelectorAll('.line');
        const isEditorMode = App.Store.state.isEditorMode;

        lines.forEach((lineEl, idx) => {
            const textSpan = lineEl.querySelector('.line-text');
            const textInput = lineEl.querySelector('.line-input');
            const saveBtn = lineEl.querySelector('.save-line-btn');
            const repeatBtn = lineEl.querySelector('.repeat-btn');

            lineEl.addEventListener('click', (ev) => {
                if (ev.target.classList.contains('repeat-btn') || 
                    ev.target.classList.contains('save-line-btn')) return;
                if (lineEl.classList.contains('line-editing')) return;

                if (isEditorMode) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    App.EventBus.emit('editor:activate-line', { index: idx, lineEl });
                } else {
                    if (lineEl.classList.contains('active')) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        App.EventBus.emit('player:toggle');
                        return;
                    }
                    App.EventBus.emit('repeat:clear');
                    App.EventBus.emit('player:seek-to-line', { index: idx });
                }
            });

            repeatBtn?.addEventListener('click', (ev) => {
                ev.stopPropagation();
                App.EventBus.emit('repeat:toggle', { index: idx });
            });

            textInput?.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' && ev.ctrlKey) {
                    ev.preventDefault();
                    this.saveLineEdit(idx, textInput, textSpan, lineEl);
                }
                if (ev.key === 'Escape') {
                    textInput.value = App.Store.lines[idx].text;
                    App.EventBus.emit('editor:deactivate-line', { lineEl });
                }
            });

            saveBtn?.addEventListener('click', () => {
                this.saveLineEdit(idx, textInput, textSpan, lineEl);
            });
        });
    },

    saveLineEdit(index, input, textSpan, lineEl) {
        const newText = input.value.trim();
        if (newText && newText !== App.Store.lines[index].text) {
            App.Store.lines[index].text = newText;
            textSpan.textContent = newText;
            App.EventBus.emit('state:save', { now: true });
        }
        App.EventBus.emit('editor:deactivate-line', { lineEl });
    },

    onTimeUpdate(time) {
        const active = this.findActiveLineForTime(time);
        if (active !== App.Store.currentLine) {
            App.Store.setCurrentLine(active);
        }
    },

    findActiveLineForTime(time) {
        if (time < 0.5) return 0;

        const lines = App.Store.lines;
        let active = -1;
        let lastValidTimeIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].time > 0) {
                lastValidTimeIndex = i;
                if (time >= lines[i].time) active = i;
            }
        }

        if (active === -1) return lastValidTimeIndex !== -1 ? lastValidTimeIndex : 0;

        for (let j = active + 1; j < lines.length; j++) {
            if (lines[j].time > 0 && time >= lines[j].time - 0.1) {
                active = j;
                break;
            }
        }

        return active;
    },

    highlightLine(activeIndex) {
        if (activeIndex < 0) return;

        const lines = App.Store.lines;
        const container = this.container;
        if (!container) return;

        let start = activeIndex, end = activeIndex;
        const cur = lines[activeIndex];
        const isEmpty = l => !l || !l.text || !l.text.trim();

        if (cur.time > 0) {
            for (let i = activeIndex + 1; i < lines.length; i++) {
                if (lines[i].time > 0 || isEmpty(lines[i])) break;
                end = i;
            }
        } else {
            let timeIdx = -1;
            for (let i = activeIndex; i >= 0; i--) {
                if (lines[i].time > 0) { timeIdx = i; break; }
            }
            if (timeIdx !== -1) {
                start = timeIdx;
                for (let i = timeIdx + 1; i <= activeIndex; i++) {
                    if (!isEmpty(lines[i])) end = i;
                }
                if (!isEmpty(cur)) {
                    for (let i = activeIndex + 1; i < lines.length; i++) {
                        if (lines[i].time > 0 || isEmpty(lines[i])) break;
                        end = i;
                    }
                }
            }
        }

        container.querySelectorAll('.line.active').forEach(el => el.classList.remove('active'));

        for (let i = start; i <= end; i++) {
            const el = container.querySelector(`.line[data-index="${i}"]`);
            el?.classList.add('active');
        }

        const centerIdx = Math.floor((start + end) / 2);
        if (App.Store.settings.mode === 'beginner') {
            this.showBubble(centerIdx);
        } else if (App.Store.settings.mode === 'hint' && App.Player.audio?.paused) {
            this.showBubble(centerIdx);
        } else {
            this.hideAllBubbles();
        }

        this.scrollToLine(centerIdx);
    },

    scrollToLine(index) {
        const lineEl = this.container?.querySelector(`.line[data-index="${index}"]`);
        if (!lineEl || this.isLineInViewZone(lineEl)) return;

        const targetTop = lineEl.offsetTop - this.scrollUpOffs * (lineEl.offsetHeight || 28);
        const maxScroll = this.container.scrollHeight - this.container.clientHeight;
        const finalTop = Math.max(0, Math.min(targetTop, maxScroll));

        this.container.scrollTo({ top: finalTop, behavior: 'smooth' });
    },

    isLineInViewZone(lineEl) {
        if (!lineEl || !this.container) return true;
        const contRect = this.container.getBoundingClientRect();
        const lineRect = lineEl.getBoundingClientRect();
        const lineHeight = lineEl.offsetHeight || 28;
        const zoneTop = contRect.top + this.scrollUpOffs * lineHeight;
        const zoneBottom = contRect.bottom - this.scrollDnOffs * lineHeight;
        return (lineRect.top >= zoneTop || lineRect.bottom > zoneTop) &&
               (lineRect.bottom <= zoneBottom || lineRect.top < zoneBottom);
    },

    showBubble(idx) {
        const lineEl = this.container?.querySelector(`.line[data-index="${idx}"]`);
        if (!lineEl) return;

        const bubble = lineEl.querySelector('.extra-bubble');
        if (!bubble) return;

        const settings = App.Store.settings;
        const mode = settings.mode;
        const showTranslation = mode === 'beginner' ? settings.beginner?.showTranslation ?? true : settings.hint?.showTranslation ?? true;
        const showNotes = mode === 'beginner' ? settings.beginner?.showNotes ?? true : settings.hint?.showNotes ?? true;

        const transEl = bubble.querySelector('.bubble-translation');
        const notesEl = bubble.querySelector('.bubble-notes');

        if (transEl) transEl.style.display = showTranslation && transEl.textContent.trim() ? 'block' : 'none';
        if (notesEl) notesEl.style.display = showNotes && notesEl.textContent.trim() ? 'block' : 'none';

        const hasContent = (showTranslation && transEl?.textContent.trim()) || 
                          (showNotes && notesEl?.textContent.trim());

        if (!hasContent) {
            bubble.classList.remove('visible', 'top', 'bottom');
            return;
        }

        bubble.classList.add('visible');

        bubble.classList.remove('top', 'bottom');
        const rect = lineEl.getBoundingClientRect();
        const bubbleHeight = bubble.offsetHeight + 16;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        bubble.classList.add(
            spaceBelow >= bubbleHeight ? 'bottom' : 
            spaceAbove >= bubbleHeight ? 'top' : 
            spaceBelow > spaceAbove ? 'bottom' : 'top'
        );
    },

    hideAllBubbles() {
        this.container?.querySelectorAll('.extra-bubble').forEach(b => {
            b.classList.remove('visible', 'top', 'bottom');
        });
    },

    updateBubblesVisibility() {
        this.hideAllBubbles();
        if (App.Store.settings.mode === 'beginner' && App.Store.currentLine >= 0) {
            this.showBubble(App.Store.currentLine);
        }
    },

    updateRepeatButtons(remaining, current) {
        const isPlaying = !App.Player.audio?.paused;
        const icon = isPlaying ? '⏸️' : '▶️';

        for (let i = current.startIndex; i < App.Store.lines.length; i++) {
            if (i > current.startIndex && App.Store.lines[i].time > 0) break;
            const btn = this.container?.querySelector(`.line[data-index="${i}"] .repeat-btn`);
            if (btn) {
                btn.innerHTML = `${remaining}x${icon}`;
                btn.classList.toggle('playing', isPlaying);
            }
            const line = this.container?.querySelector(`.line[data-index="${i}"]`);
            line?.classList.add('repeating');
        }
    },

    resetRepeatButtons() {
        const settings = App.Store.settings;
        this.container?.querySelectorAll('.line.repeating').forEach(line => {
            line.classList.remove('repeating');
            const btn = line.querySelector('.repeat-btn');
            if (btn) {
                btn.innerHTML = `${settings.repeatCount}x▶`;
                btn.classList.remove('playing');
            }
        });
    }
};
