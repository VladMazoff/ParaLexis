// data/storage.js — Хранение состояния
App.Storage = {
    db: null,
    dbName: 'KaraokePlayerDB',
    dbVersion: 1,
    saveTimer: null,
    bgSaveTimer: null,

    init() {
        this.initDB().then(() => {
            this.loadState();
            App.EventBus.on('state:save', ({ now }) => this.scheduleSave(now));
            App.EventBus.on('state:lines-updated', () => this.scheduleSave(false));
            App.EventBus.on('state:settings-updated', () => this.scheduleSave(false));
        });

        window.addEventListener('beforeunload', () => this.saveState());
        console.log('✅ Storage initialized');
    },

    initDB() {
        return new Promise((resolve, reject) => {
            try {
                const req = indexedDB.open(this.dbName, this.dbVersion);
                req.onerror = (e) => { console.error('DB error:', e); resolve(); };
                req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    ['audioFiles', 'textFiles'].forEach(store => {
                        if (!db.objectStoreNames.contains(store)) {
                            db.createObjectStore(store, { keyPath: 'name' });
                        }
                    });
                };
            } catch (e) {
                console.error('DB init failed:', e);
                resolve();
            }
        });
    },

    saveToDB(file, type) {
        if (!this.db) return Promise.reject('DB not available');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const tx = this.db.transaction([type + 'Files'], 'readwrite');
                const req = tx.objectStore(type + 'Files').put({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: file.lastModified,
                    content: e.target.result
                });
                req.onsuccess = () => resolve(file.name);
                req.onerror = (e) => reject(e.target.error);
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    loadFromDB(name, type) {
        if (!this.db) return Promise.reject('DB not available');
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([type + 'Files'], 'readonly');
            const req = tx.objectStore(type + 'Files').get(name);
            req.onsuccess = (e) => {
                const data = e.target.result;
                data ? resolve(new File([data.content], data.name, {
                    type: data.type,
                    lastModified: data.lastModified
                })) : reject('File not found');
            };
            req.onerror = (e) => reject(e.target.error);
        });
    },

    scheduleSave(now) {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        now ? this.saveState() : (this.saveTimer = setTimeout(() => this.saveState(), 5000));
    },

    saveState() {
        try {
            const state = {
                ...App.Store.state,
                currentTime: App.Player.audio?.currentTime || 0,
                timestamp: Date.now()
            };
            localStorage.setItem('karaokeState', JSON.stringify(state));
        } catch (e) {
            console.error('Save error:', e);
        }
    },

    loadState() {
        try {
            const saved = localStorage.getItem('karaokeState');
            if (!saved) return;

            const state = JSON.parse(saved);
            if (!state.timestamp || state.timestamp < Date.now() - 7 * 24 * 60 * 60 * 1000) return;

            if (state.settings) App.Store.updateSettings(state.settings);
            if (state.lines?.length) App.Store.setLines(state.lines);
            if (state.theme) App.Store.setTheme(state.theme);
            if (state.isCompact) App.Store.setCompact(true);

            if (state.audioFile) {
                App.Store.setAudioFile(state.audioFile);
                this.loadFromDB(state.audioFile, 'audio')
                    .then(file => {
                        const url = URL.createObjectURL(file);
                        App.Player.audio.src = url;
                        App.EventBus.emit('player:audio-loaded', { file: state.audioFile, url });
                    })
                    .catch(() => {});
            }

            if (state.lyricsFile) {
                App.Store.setLyricsFile(state.lyricsFile);
                this.loadFromDB(state.lyricsFile, 'text')
                    .then(file => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const lines = App.Parser.parseText(e.target.result);
                            App.Store.setLines(lines);
                        };
                        reader.readAsText(file, 'UTF-8');
                    })
                    .catch(() => {});
            }

            if (state.currentTime && state.audioFile) {
                App.Player.audio.addEventListener('loadedmetadata', function onMeta() {
                    App.Player.audio.currentTime = Math.min(state.currentTime, App.Player.audio.duration);
                    App.Player.audio.removeEventListener('loadedmetadata', onMeta);
                });
            }

            App.EventBus.emit('state:restored', state);
        } catch (e) {
            console.error('Load state error:', e);
        }
    }
};
