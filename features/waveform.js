
// features/waveform.js — Peaks.js интеграция
App.Waveform = {
    peaks: null,
    zoomLevel: 2,
    amplitudeScale: 1.0,
    pendingLoad: null,
    isInitializing: false,
    audioUrl: null,
    syncEnabled: false,
    progressiveLoading: false,
    loadedBytes: 0,
    totalBytes: 0,
    chunkSize: 1024 * 1024, // 1 МБ
    loadStartTime: null,

    init() {
        App.EventBus.on('player:audio-loaded', ({ url }) => {
            this.audioUrl = url;
            this.scheduleLoad(url);
        });
        App.EventBus.on('player:timeupdate', ({ time }) => this.updatePlayhead(time));
        App.EventBus.on('player:seek', ({ time }) => this.seek(time));
        App.EventBus.on('ui:editor-mode-changed', () => this.onEditorToggle());

        console.log('✅ Waveform initialized');
    },

    scheduleLoad(audioUrl) {
        this.pendingLoad = audioUrl;
        this.audioUrl = audioUrl;

        if (typeof peaks === 'undefined') {
            console.log('⏳ Waveform: peaks.js ещё не загружен, откладываем...');
            return;
        }

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

        // Ждём пока контейнер станет видимым
        this.waitForContainer(container, () => {
            this.startProgressiveWaveformLoad(audioUrl);
        });
    },

    waitForContainer(container, callback, attempts = 0) {
        const maxAttempts = 20;
        const rect = container.getBoundingClientRect();
        
        const isVisible = container.style.display !== 'none' && 
                         container.offsetParent !== null;
        const hasSize = rect.width > 0 && rect.height > 0;
        
        if (isVisible && hasSize) {
            callback();
            return;
        }
        
        if (attempts >= maxAttempts) {
            console.warn('Waveform: контейнер не получил размеры после ожидания');
            // Всё равно пробуем загрузить
            callback();
            return;
        }
        
        if (container.style.display === 'none') {
            container.style.display = 'block';
            container.style.visibility = 'hidden';
            void container.offsetHeight;
        }
        
        setTimeout(() => {
            this.waitForContainer(container, callback, attempts + 1);
        }, 100);
    },

    // ==================== ПРОГРЕССИВНАЯ ЗАГРУЗКА ====================

    startProgressiveWaveformLoad(audioUrl) {
        if (!audioUrl) {
            this.createFallbackWaveform('Аудиофайл не загружен');
            return;
        }
        
        this.audioUrl = audioUrl;
        this.progressiveLoading = true;
        this.loadedBytes = 0;
        this.totalBytes = 0;
        
        this.setupWaveformContainer();
        this.showProgressiveLoadingIndicator();
        this.loadAudioHeaders(audioUrl);
    },

    loadAudioHeaders(url) {
        const self = this;
        const xhr = new XMLHttpRequest();
        xhr.open('HEAD', url, true);
        
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                const length = xhr.getResponseHeader('Content-Length');
                self.totalBytes = length ? parseInt(length, 10) : 0;
                console.log('Audio size:', self.totalBytes, 'bytes');
            }
            self.startChunkedLoading(url);
        };
        
        xhr.onerror = function() {
            console.warn('HEAD request error, starting chunked loading anyway');
            self.startChunkedLoading(url);
        };
        
        xhr.send();
    },

    startChunkedLoading(url) {
        const self = this;
        const CHUNK_SIZE = this.chunkSize;
        
        const loadNextChunk = function(start) {
            const xhr = new XMLHttpRequest();
            let end;
            
            if (self.totalBytes > 0) {
                end = Math.min(start + CHUNK_SIZE - 1, self.totalBytes - 1);
            } else {
                end = start + CHUNK_SIZE - 1;
            }
            
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            
            if (self.totalBytes > 0) {
                xhr.setRequestHeader('Range', 'bytes=' + start + '-' + end);
            }
            
            xhr.onload = function() {
                if (xhr.status === 206 || xhr.status === 200) {
                    const arrayBuffer = xhr.response;
                    if (arrayBuffer && arrayBuffer.byteLength > 0) {
                        self.appendWaveformChunk(arrayBuffer, start === 0);
                        
                        const loaded = start + arrayBuffer.byteLength;
                        self.loadedBytes = loaded;
                        self.updateProgressiveProgress(loaded);
                        
                        if (self.totalBytes > 0) {
                            if (loaded < self.totalBytes) {
                                setTimeout(() => loadNextChunk(loaded), 10);
                            } else {
                                self.finalizeProgressiveWaveform();
                            }
                        } else if (xhr.status === 200 && arrayBuffer.byteLength === CHUNK_SIZE) {
                            setTimeout(() => loadNextChunk(loaded), 10);
                        } else {
                            self.finalizeProgressiveWaveform();
                        }
                    } else {
                        self.finalizeProgressiveWaveform();
                    }
                } else {
                    self.createFallbackWaveform('Ошибка загрузки: статус ' + xhr.status);
                }
            };
            
            xhr.onerror = function() {
                console.error('Chunk loading error');
                if (start === 0) {
                    self.createFallbackWaveform('Ошибка загрузки аудио');
                } else {
                    self.finalizeProgressiveWaveform();
                }
            };
            
            xhr.send();
        };
        
        loadNextChunk(0);
    },

    appendWaveformChunk(arrayBuffer, isFirstChunk) {
        if (!this.peaks && isFirstChunk) {
            this.initializePeaksWithProgressiveMode(arrayBuffer);
        } else if (this.peaks && this.peaks.waveform && this.peaks.waveform.waveformData) {
            try {
                this.peaks.waveform.waveformData.setData(arrayBuffer);
                
                const zoomview = this.peaks.views.getView('zoomview');
                const overview = this.peaks.views.getView('overview');
                
                if (zoomview && zoomview.drawWaveform) zoomview.drawWaveform();
                if (overview && overview.drawWaveform) overview.drawWaveform();
                
                this.forceFullWidth();
            } catch (e) {
                console.warn('Не удалось добавить чанк', e);
            }
        }
    },

    initializePeaksWithProgressiveMode(initialBuffer) {
        const zoomviewContainer = document.getElementById('zoomview-container');
        const overviewContainer = document.getElementById('overview-container');
        
        if (!zoomviewContainer || !overviewContainer) {
            this.createFallbackWaveform('Контейнеры не найдены');
            return;
        }
        
        const audioContext = this.createAudioContext();
        const options = {
            containers: { zoomview: zoomviewContainer, overview: overviewContainer },
            mediaElement: App.Player.audio,
            withCredentials: false,
            emitCueEvents: false,
            bindKeyboard: false,
            zoomLevels: [64, 128, 256, 512, 1024],
            nudgeIncrement: 0.01,
            overview: {
                waveformColor: 'gold', 
                playedWaveformColor: 'green',
                playheadColor: '#ff0000', 
                playheadWidth: 2, 
                showPlayheadTime: false
            },
            zoomview: {
                waveformColor: 'blue', 
                playedWaveformColor: 'red',
                playheadColor: '#ff0000', 
                playheadWidth: 2, 
                showPlayheadTime: true,
                amplitude: this.amplitudeScale,
                scale: this.amplitudeScale
            }
        };
        
        if (audioContext) {
            options.webAudio = { 
                audioContext: audioContext, 
                scale: 128 * this.amplitudeScale, 
                multiChannel: false 
            };
        } else {
            // Ключевой момент: используем dataUri с пустым буфером
            options.dataUri = { arraybuffer: '' };
        }
        
        const self = this;
        peaks.init(options, function(err, peaksInstance) {
            if (err) {
                console.error('Peaks init error:', err);
                self.createFallbackWaveform('Ошибка инициализации волны');
                return;
            }
            
            self.peaks = peaksInstance;
            self.syncEnabled = true;
            
            if (initialBuffer && self.peaks.waveform && self.peaks.waveform.waveformData) {
                try {
                    self.peaks.waveform.waveformData.setData(initialBuffer);
                    
                    const zoomview = self.peaks.views.getView('zoomview');
                    const overview = self.peaks.views.getView('overview');
                    
                    if (zoomview && zoomview.drawWaveform) zoomview.drawWaveform();
                    if (overview && overview.drawWaveform) overview.drawWaveform();
                    
                    self.forceFullWidth();
                    self.setupEventHandlers();
                    
                    setTimeout(function() {
                        if (self.peaks && self.peaks.zoom) {
                            self.peaks.zoom.setZoom(self.zoomLevel);
                        }
                    }, 100);
                    
                } catch (e) {
                    console.error('Error setting initial buffer:', e);
                }
            }
        });
    },

    setupWaveformContainer() {
        const container = document.getElementById('waveformContainer');
        if (!container) return;
        
        const containerHeight = 120; // Фиксированная высота
        const zoomviewHeight = Math.floor(containerHeight * 0.7);
        const overviewHeight = Math.floor(containerHeight * 0.3);
        
        container.style.cssText = 'width: 100%; height: ' + containerHeight + 'px; max-width: 100%; margin: 0; padding: 0; overflow: hidden; display: flex; flex-direction: column; position: relative;';
        
        container.innerHTML = [
            '<div class="waveform-section zoomview-section" style="width: 100%; height: ' + zoomviewHeight + 'px; flex: 0 0 ' + zoomviewHeight + 'px; min-height: ' + zoomviewHeight + 'px;">',
            '<div id="zoomview-container" style="width: 100%; height: 100%; background: #f0f0f0; display: block;"></div>',
            '</div>',
            '<div class="waveform-section overview-section" style="width: 100%; height: ' + overviewHeight + 'px; flex: 0 0 ' + overviewHeight + 'px; min-height: ' + overviewHeight + 'px; border-top: 1px solid #ccc;">',
            '<div id="overview-container" style="width: 100%; height: 100%; background: #e8e8e8; display: block;"></div>',
            '</div>'
        ].join('');
    },

    createAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            return AudioContext ? new AudioContext() : null;
        } catch (e) {
            return null;
        }
    },

    showProgressiveLoadingIndicator() {
        const container = document.getElementById('waveformContainer');
        if (!container) return;
        
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'progressiveLoading';
        loadingDiv.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(248,249,250,0.95); z-index: 10; display: flex; align-items: center; justify-content: center; flex-direction: column; color: #495057; font-family: Arial, sans-serif;';
        
        loadingDiv.innerHTML = [
            '<div style="margin-bottom: 15px; font-size: 16px;">🎵 Строим аудиоволну по частям...</div>',
            '<div style="width: 80%; max-width: 300px; background: #e9ecef; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">',
            '<div id="progressBar" style="width: 0%; height: 10px; background: #007bff; transition: width 0.3s ease;"></div>',
            '</div>',
            '<div id="progressText" style="font-size: 14px;">0% (0 байт)</div>',
            '<div id="progressSpeed" style="font-size: 12px; color: #6c757d; margin-top: 5px;"></div>'
        ].join('');
        
        container.style.position = 'relative';
        container.appendChild(loadingDiv);
        
        this.loadStartTime = Date.now();
    },

    updateProgressiveProgress(loaded) {
        if (!this.totalBytes) return;
        
        const percent = Math.min(100, Math.round((loaded / this.totalBytes) * 100));
        const bar = document.getElementById('progressBar');
        const text = document.getElementById('progressText');
        const speed = document.getElementById('progressSpeed');
        
        if (bar) bar.style.width = percent + '%';
        
        if (text) {
            const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
            const totalMB = (this.totalBytes / (1024 * 1024)).toFixed(1);
            text.textContent = percent + '% (' + loadedMB + ' МБ / ' + totalMB + ' МБ)';
        }
        
        if (speed && this.loadStartTime) {
            const elapsed = (Date.now() - this.loadStartTime) / 1000;
            if (elapsed > 0) {
                const speedKbps = (loaded / elapsed / 1024).toFixed(1);
                speed.textContent = 'Скорость: ' + speedKbps + ' КБ/с';
            }
        }
    },

    finalizeProgressiveWaveform() {
        const loading = document.getElementById('progressiveLoading');
        if (loading) {
            loading.style.transition = 'opacity 0.5s ease';
            loading.style.opacity = '0';
            setTimeout(() => { 
                if (loading.parentNode) {
                    loading.parentNode.removeChild(loading);
                }
            }, 500);
        }
        
        this.progressiveLoading = false;
        this.forceFullWidth();
        console.log('✅ Waveform loaded');
    },

    forceFullWidth() {
        const containers = ['zoomview-container', 'overview-container'];
        
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (!container) return;
            
            container.style.width = '100%';
            container.style.maxWidth = '100%';
            container.style.margin = '0';
            container.style.padding = '0';
            container.style.overflow = 'hidden';
            
            const konvaContainers = container.querySelectorAll('.konvajs-content');
            konvaContainers.forEach(konvaContainer => {
                konvaContainer.style.width = '100%';
                konvaContainer.style.maxWidth = '100%';
                konvaContainer.style.margin = '0';
                konvaContainer.style.padding = '0';
                konvaContainer.style.overflow = 'hidden';
                
                const canvases = konvaContainer.querySelectorAll('canvas');
                canvases.forEach(canvas => {
                    const originalHeight = canvas.style.height;
                    canvas.style.width = '100%';
                    canvas.style.maxWidth = '100%';
                    canvas.style.margin = '0';
                    canvas.style.padding = '0';
                    canvas.style.display = 'block';
                    if (originalHeight) {
                        canvas.style.height = originalHeight;
                    }
                });
            });
        });
        
        if (this.peaks && this.peaks.views) {
            try {
                const zoomview = this.peaks.views.getView('zoomview');
                const overview = this.peaks.views.getView('overview');
                if (zoomview && zoomview.fitToContainer) zoomview.fitToContainer();
                if (overview && overview.fitToContainer) overview.fitToContainer();
            } catch (e) {}
        }
    },

    setupEventHandlers() {
        if (!this.peaks) return;
        
        const self = this;
        this.peaks.on('zoomview.click', function(time) { 
            self.handleSeek(time, 'Zoomview'); 
        });
        this.peaks.on('overview.click', function(time) { 
            self.handleSeek(time, 'Overview'); 
        });
    },

    handleSeek(time, source) {
        if (!this.syncEnabled || !App.Player.audio) return;
        
        const clickTimeSec = typeof time === 'object' ? time.time : time;
        App.Player.audio.currentTime = clickTimeSec;
        App.EventBus.emit('player:seek', { time: clickTimeSec });
    },

    // ==================== ПУБЛИЧНЫЕ МЕТОДЫ ====================

    updatePlayhead(time) {
        // Peaks сам синхронизируется с mediaElement
    },

    seek(time) {
        // Peaks сам синхронизируется
    },

    zoomIn() {
        if (this.peaks?.zoom) {
            const currentZoom = this.peaks.zoom.getZoom();
            const newZoom = Math.max(0, currentZoom - 1);
            this.peaks.zoom.setZoom(newZoom);
            this.zoomLevel = newZoom;
        }
    },

    zoomOut() {
        if (this.peaks?.zoom) {
            const currentZoom = this.peaks.zoom.getZoom();
            const newZoom = Math.min(4, currentZoom + 1);
            this.peaks.zoom.setZoom(newZoom);
            this.zoomLevel = newZoom;
        }
    },

    adjustAmplitude(factor) {
        this.amplitudeScale *= factor;
        this.amplitudeScale = Math.max(0.1, Math.min(5.0, this.amplitudeScale));
        if (this.audioUrl) {
            this.destroy();
            setTimeout(() => this.startProgressiveWaveformLoad(this.audioUrl), 100);
        }
    },

    addTimestampMark(time) {
        if (this.peaks && time !== undefined) {
            try {
                this.peaks.points.add({
                    time: time,
                    labelText: App.Parser.formatTime(time),
                    color: '#ff0000',
                    editable: true
                });
            } catch (e) {}
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
            if (container) {
                container.style.display = 'block';
                setTimeout(() => {
                    if (this.audioUrl) {
                        this.startProgressiveWaveformLoad(this.audioUrl);
                    }
                }, 50);
            }
        } else {
            if (container) {
                container.style.display = 'none';
            }
            this.destroy();
        }
    },

    destroy() {
        this.isInitializing = false;
        this.syncEnabled = false;
        this.progressiveLoading = false;
        
        if (this.peaks) {
            try { 
                this.peaks.destroy(); 
            } catch(e) {}
            this.peaks = null;
        }
        
        const container = document.getElementById('waveformContainer');
        if (container) {
            container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 120px; color: #666; width: 100%;">Waveform отключен</div>';
        }
    },

    createFallbackWaveform(message) {
        const container = document.getElementById('waveformContainer');
        if (container) {
            const duration = App.Player.audio?.duration || 0;
            const formatted = App.Player.formatTime(duration);
            container.innerHTML = [
                '<div style="display: flex; align-items: center; justify-content: center; height: 120px; background: #f8f9fa; color: #6c757d; border: 1px solid #dee2e6; border-radius: 4px; width: 100%;">',
                '<div style="text-align: center;"><div>' + message + '</div><small>Длительность: ' + formatted + '</small></div>',
                '</div>'
            ].join('');
        }
    },

    isReady() {
        return this.peaks !== null && this.syncEnabled;
    }
};

