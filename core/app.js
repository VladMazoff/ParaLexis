// core/app.js — Event Bus + Store + Namespace
window.App = window.App || {};

// === Event Bus ===
App.EventBus = {
    _events: {},
    on(event, callback) {
        if (!this._events[event]) this._events[event] = [];
        this._events[event].push(callback);
        return () => this.off(event, callback);
    },
    off(event, callback) {
        if (!this._events[event]) return;
        this._events[event] = this._events[event].filter(cb => cb !== callback);
    },
    emit(event, data) {
        if (this._events[event]) {
            this._events[event].forEach(cb => {
                try { cb(data); } catch(e) { console.error(e); }
            });
        }
    }
};

// === Store (только данные, без DOM!) ===
App.Store = {
    state: {
        lines: [],
        currentLine: -1,
        settings: {
            mode: 'beginner',
            repeatCount: 5,
            playbackRate: 1.0,
            continueAfterRepeat: false,
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            activeLineColor: '#4CAF50',
            backgroundColor: '#f4f4f4',
            textColor: '#333333'
        },
        audioFile: '',
        lyricsFile: '',
        isCompact: false,
        isEditorMode: false,
        theme: 'light'
    },

    get lines() { return this.state.lines; },
    get currentLine() { return this.state.currentLine; },
    get settings() { return this.state.settings; },

    setLines(lines) {
        this.state.lines = lines;
        App.EventBus.emit('state:lines-updated', lines);
    },
    setCurrentLine(index) {
        this.state.currentLine = index;
        App.EventBus.emit('state:current-line-updated', index);
    },
    updateSettings(patch) {
        Object.assign(this.state.settings, patch);
        App.EventBus.emit('state:settings-updated', this.state.settings);
    },
    setAudioFile(name) {
        this.state.audioFile = name;
        App.EventBus.emit('state:audio-file-changed', name);
    },
    setLyricsFile(name) {
        this.state.lyricsFile = name;
        App.EventBus.emit('state:lyrics-file-changed', name);
    },
    setCompact(isCompact) {
        this.state.isCompact = isCompact;
        App.EventBus.emit('ui:compact-changed', isCompact);
    },
    setEditorMode(isEditor) {
        this.state.isEditorMode = isEditor;
        App.EventBus.emit('ui:editor-mode-changed', isEditor);
    },
    setTheme(theme) {
        this.state.theme = theme;
        App.EventBus.emit('ui:theme-changed', theme);
    }
};
