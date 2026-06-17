// features/waveform.js — Peaks.js интеграция (исправленная)
App.Waveform = {
    peaks: null,
    zoomLevel: 2,
    amplitudeScale: 1.0,
    pendingLoad: null,      // ← Отложенная загрузка

    init() {
        App.EventBus.on('player:audio-loaded', ({ url }) => this.scheduleLoad(url));
        App.EventBus.on('player:timeupdate', ({ time }) => this.updatePlayhead(time));
        App.EventBus.on('player:seek', ({ time }) => this.seek(time));
        App.EventBus.on('ui:editor-mode-changed', () => this.onEditorToggle());

        // Если peaks уже доступен и есть отложенная загрузка
        if (typeof peaks !== 'undefined' && this.pendingLoad) {
            this.scheduleLoad(this.pendingLoad);
        }

        console.log('✅ Waveform initialized');
    },

    // Отложенная загрузка: ждём когда peaks будет доступен И контейнер видим
    scheduleLoad(audioUrl) {
        this.pendingLoad = audioUrl;

        if (typeof peaks === 'undefined') {
            console.log('⏳ Waveform: peaks.js ещё не загружен, откладываем...');
            return;
        }

        // Проверяем видимость контейнера
        const container = document.getElementById('waveformContainer');
        if (!container) {
            console.error('Waveform: контейнер не найден');
            return;
        }

        // Если редактор не активен — контейнер скрыт, откладываем
        if (!App.Store.state.isEditorMode) {
            console.log('⏳ Waveform: редактор не активен, откладываем...');
            return;
        }

        this.load(audioUrl);
    },

    load(audioUrl) {
        if (this.peaks) {
            this.destroy();
        }

        const container = document.getElementById('waveformContainer');
        if (!container) return;

        // Принудительно показать контейнер перед инициализацией
        const wasHidden = container.style.display === 'none';
        if (wasHidden) {
            container.style.display = 'block';
            container.style.visibility = 'hidden';
        }

        // Создаём вложенные контейнеры
        let zoomview = document.getElementById('zoomview-container');
        let overview = document.getElementById('overview-container');

        if (!zoomview || !overview) {
            container.innerHTML = `
                <div id="zoomview-container" style="width:100%;height:70%;background:#f0f0f0;"></div>
                <div id="overview-container" style="width:100%;height:30%;background:#e8e8e8;border-top:1px solid #ccc;"></div>
            `;
            zoomview = document.getElementById('zoomview-container');
            overview = document.getElementById('overview-container');
        }

        // Принудительно вычислить размеры
        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            console.error('Waveform: контейнер имеет нулевые размеры', rect);
            if (wasHidden) {
                container.style.display = 'none';
                container.style.visibility = '';
            }
            return;
        }

        zoomview.style.width = '100%';
        zoomview.style.height = '70%';
        overview.style.width = '100%';
        overview.style.height = '30%';

        const options = {
            containers: { zoomview, overview },
            mediaElement: App.Player.audio,
            zoomLevels: [64, 128, 256, 512, 1024],
            overview: {
                waveformColor: 'gold',
                playedWaveformColor: 'green',
                playheadColor: '#ff0000'
            },
            zoomview: {
                waveformColor: 'blue',
                playedWaveformColor: 'red',
                playheadColor: '#ff0000',
                showPlayheadTime: true
            }
        };

        const self = this;
        peaks.init(options, function(err, instance) {
            if (wasHidden) {
                container.style.visibility = '';
            }

            if (err) {
                console.error('Peaks init error:', err);
                self.showFallback('Ошибка инициализации волны');
                return;
            }

            self.peaks = instance;
            self.pendingLoad = null;
            self.setupHandlers();
            console.log('✅ Waveform loaded');
        });
    },

    setupHandlers() {
        if (!this.peaks) return;

        this.peaks.on('zoomview.click', (time) => {
            App.EventBus.emit('player:seek', { 
                time: typeof time === 'object' ? time.time : time 
            });
        });

        this.peaks.on('overview.click', (time) => {
            App.EventBus.emit('player:seek', { 
                time: typeof time === 'object' ? time.time : time 
            });
        });
    },

    updatePlayhead(time) {
        // Peaks сам синхронизируется с mediaElement
    },

    seek(time) {
        // Peaks сам синхронизируется
    },

    zoomIn() {
        if (this.peaks?.zoom) {
            this.zoomLevel = Math.max(0, this.zoomLevel - 1);
            this.peaks.zoom.setZoom(this.zoomLevel);
        }
    },

    zoomOut() {
        if (this.peaks?.zoom) {
            this.zoomLevel = Math.min(4, this.zoomLevel + 1);
            this.peaks.zoom.setZoom(this.zoomLevel);
        }
    },

    adjustAmplitude(factor) {
        this.amplitudeScale *= factor;
        this.amplitudeScale = Math.max(0.1, Math.min(5.0, this.amplitudeScale));
        const currentUrl = App.Player.audio?.src;
        if (currentUrl) {
            this.destroy();
            setTimeout(() => this.scheduleLoad(currentUrl), 100);
        }
    },

    addTimestampMark(time) {
        if (this.peaks?.points) {
            this.peaks.points.add({
                time: time,
                labelText: App.Parser.formatTime(time),
                color: '#ff0000',
                editable: true
            });
        }
    },

    clearAllMarks() {
        if (!this.peaks?.points) return;
        this.peaks.points.getPoints().forEach(p => this.peaks.points.removeById(p.id));
    },

    onEditorToggle() {
        const isEditor = App.Store.state.isEditorMode;
        const container = document.getElementById('waveformContainer');

        if (isEditor) {
            if (container) container.style.display = 'block';
            if (App.Player.audio?.src) {
                this.scheduleLoad(App.Player.audio.src);
            }
        } else {
            if (container) container.style.display = 'none';
            this.destroy();
        }
    },

    destroy() {
        if (this.peaks) {
            try { this.peaks.destroy(); } catch(e) {}
            this.peaks = null;
        }
    },

    showFallback(message) {
        const container = document.getElementById('waveformContainer');
        if (container) {
            container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:120px;color:#666;">${message}</div>`;
        }
    }
};
