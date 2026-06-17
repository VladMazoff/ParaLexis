// core/player.js — Управление аудио и повторами
App.Player = {
    audio: null,
    repeatCurrent: null,
    repeatInterval: null,

    init() {
        this.audio = document.getElementById('audioPlayer');
        if (!this.audio) {
            console.error('Audio element not found');
            return;
        }

        // События аудио → EventBus
        this.audio.addEventListener('play', () => App.EventBus.emit('player:play'));
        this.audio.addEventListener('pause', () => App.EventBus.emit('player:pause'));
        this.audio.addEventListener('ended', () => {
            App.EventBus.emit('player:ended');
            this.stopRepeat();
        });
        this.audio.addEventListener('loadedmetadata', () => {
            App.EventBus.emit('player:loadedmetadata', { duration: this.audio.duration });
        });
        this.audio.addEventListener('timeupdate', () => {
            App.EventBus.emit('player:timeupdate', {
                time: this.audio.currentTime,
                duration: this.audio.duration
            });
        });

        // Подписки на команды
        App.EventBus.on('player:toggle', () => this.toggle());
        App.EventBus.on('player:seek', ({ time }) => this.seek(time));
        App.EventBus.on('player:set-rate', (rate) => this.setRate(rate));
        App.EventBus.on('state:settings-updated', (s) => {
            if (s.playbackRate !== undefined) this.audio.playbackRate = s.playbackRate;
        });

        console.log('✅ Player initialized');
    },

    toggle() {
        if (!this.audio) return;
        this.audio.paused ? this.audio.play() : this.audio.pause();
    },

    seek(time) {
        if (!this.audio || isNaN(time)) return;
        this.audio.currentTime = time;
        if (this.audio.paused) this.audio.play();
    },

    setRate(rate) {
        if (!this.audio || isNaN(rate)) return;
        this.audio.playbackRate = rate;
        App.Store.updateSettings({ playbackRate: rate });
    },

    // === Repeat Manager ===
    toggleRepeat(lineIndex) {
        if (this.repeatCurrent) {
            if (this.repeatCurrent.lineIndex === lineIndex) {
                this.toggle();
                return;
            }
            this.stopRepeat(false);
        }

        const lines = App.Store.lines;
        const settings = App.Store.settings;

        let start = lineIndex;
        for (let i = lineIndex; i >= 0; i--) {
            if (lines[i].time > 0) { start = i; break; }
        }

        let endTime = this.audio.duration || 0;
        for (let i = start + 1; i < lines.length; i++) {
            if (lines[i].time > 0) { endTime = lines[i].time; break; }
        }

        this.repeatCurrent = {
            lineIndex,
            startIndex: start,
            startTime: lines[start].time,
            endTime,
            count: 0,
            max: settings.repeatCount
        };

        App.EventBus.emit('repeat:started', this.repeatCurrent);
        this._playRepeat();
    },

    _playRepeat() {
        if (!this.repeatCurrent) return;

        this.audio.currentTime = this.repeatCurrent.startTime;
        this.audio.play();

        this.repeatInterval = setInterval(() => {
            if (!this.repeatCurrent || !this.audio) return;

            if (this.audio.currentTime >= this.repeatCurrent.endTime - 0.1) {
                clearInterval(this.repeatInterval);
                this.repeatCurrent.count++;

                const remaining = this.repeatCurrent.max - this.repeatCurrent.count;
                App.EventBus.emit('repeat:tick', { remaining, current: this.repeatCurrent });

                if (remaining > 0) {
                    setTimeout(() => this._playRepeat(), 500);
                } else {
                    const endTime = this.repeatCurrent.endTime;
                    const shouldContinue = App.Store.settings.continueAfterRepeat;
                    this.stopRepeat(true);
                    if (shouldContinue) {
                        this.audio.currentTime = endTime;
                        this.audio.play();
                    }
                }
            }
        }, 50);
    },

    stopRepeat(resetToInitial = false) {
        if (this.repeatInterval) clearInterval(this.repeatInterval);
        this.repeatCurrent = null;
        App.EventBus.emit('repeat:stopped', { resetToInitial });
    },

    findNearestTimeAbove(index) {
        const lines = App.Store.lines;
        for (let i = index; i >= 0; i--) {
            if (lines[i].time > 0) return lines[i].time;
        }
        return -1;
    },

    formatTime(sec) {
        if (isNaN(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }
};
