// main.js — Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // 1. Фундамент (уже загружен через <script src="core/app.js">)

    // 2. Инициализация модулей
    App.Player.init();
    App.Storage.init();
    App.Parser.init();
    App.LyricsRenderer.init();
    App.UIManager.init();
    App.ConfigManager.init();
    App.Waveform.init();
    App.Editor.init();

    // 3. Загрузка файлов
    setupFileInputs();
    setupProgressSync();
    setupModeSelector();
 

    console.log('🎵 Karaoke Player ready');
});

function setupFileInputs() {
    const audioInput = document.getElementById('audioFile');
    const lyricsInput = document.getElementById('lyricsFile');

    audioInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        App.Player.audio.src = url;
        App.Store.setAudioFile(file.name);
        App.Storage.saveToDB(file, 'audio').catch(() => {});

        App.EventBus.emit('player:audio-loaded', { file: file.name, url });
    });

    lyricsInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const lines = App.Parser.parseText(ev.target.result);
            App.Store.setLines(lines);
            App.Store.setLyricsFile(file.name);
            App.Storage.saveToDB(file, 'text').catch(() => {});
        };
        reader.readAsText(file, 'UTF-8');
    });
}

function setupProgressSync() {
    const progress = document.getElementById('progress');
    const progressCompact = document.getElementById('progressCompact');
    const currentTime = document.getElementById('currentTime');
    const currentTimeCompact = document.getElementById('currentTimeCompact');
    const duration = document.getElementById('duration');
    const durationCompact = document.getElementById('durationCompact');

    App.EventBus.on('player:timeupdate', ({ time, duration: dur }) => {
        const pct = dur ? (time / dur) * 100 : 0;
        if (progress) progress.value = pct;
        if (progressCompact) progressCompact.value = pct;

        const formatted = App.Player.formatTime(time);
        const durFormatted = App.Player.formatTime(dur);

        if (currentTime) currentTime.textContent = formatted;
        if (currentTimeCompact) currentTimeCompact.textContent = formatted;
        if (duration) duration.textContent = durFormatted;
        if (durationCompact) durationCompact.textContent = durFormatted;
    });

    App.EventBus.on('player:loadedmetadata', ({ duration: dur }) => {
        const formatted = App.Player.formatTime(dur);
        if (duration) duration.textContent = formatted;
        if (durationCompact) durationCompact.textContent = formatted;
    });
}

function setupModeSelector() {
    const modeBtns = document.querySelectorAll('.mode-btn');
    const configAlias = document.querySelector('.config-alias');
    const propertyTranslate = document.getElementById('configPropertyTranslate');
    const propertyNote = document.getElementById('configPropertyNote');
    const configModeProperties = document.getElementById('configModeProperties');

    const modeNames = { pro: 'Профи', hint: 'Помощник', beginner: 'Новичок' };

    function updateFlagsDisplay() {
        if (!configModeProperties) return;
        const mode = App.Store.settings.mode;
        configModeProperties.style.display = mode === 'pro' ? 'none' : 'block';

        if (mode !== 'pro') {
            const flags = mode === 'hint' ? App.Store.settings.hint : App.Store.settings.beginner;
            if (propertyTranslate) propertyTranslate.classList.toggle('checked', flags?.showTranslation ?? true);
            if (propertyNote) propertyNote.classList.toggle('checked', flags?.showNotes ?? true);
        }
    }

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const mode = btn.dataset.mode;
            App.Store.updateSettings({ mode });

            if (configAlias) configAlias.textContent = '(' + modeNames[mode] + ')';
            updateFlagsDisplay();

            if (mode === 'beginner' && App.Store.currentLine >= 0) {
                App.LyricsRenderer.showBubble(App.Store.currentLine);
            } else if (mode === 'pro') {
                App.LyricsRenderer.hideAllBubbles();
            }
        });
    });

    const initialMode = App.Store.settings.mode;
    const initialBtn = document.querySelector(`.mode-btn[data-mode="${initialMode}"]`);
    if (initialBtn) initialBtn.classList.add('active');
    if (configAlias) configAlias.textContent = '(' + modeNames[initialMode] + ')';
    updateFlagsDisplay();

    [propertyTranslate, propertyNote].forEach((el, idx) => {
        el?.addEventListener('click', () => {
            const isChecked = el.classList.toggle('checked');
            const prop = idx === 0 ? 'showTranslation' : 'showNotes';
            const mode = App.Store.settings.mode;

            if (mode === 'hint') {
                const hint = { ...App.Store.settings.hint, [prop]: isChecked };
                App.Store.updateSettings({ hint });
            } else if (mode === 'beginner') {
                const beginner = { ...App.Store.settings.beginner, [prop]: isChecked };
                App.Store.updateSettings({ beginner });
            }

            if (App.Store.currentLine >= 0 && mode !== 'pro') {
                App.LyricsRenderer.showBubble(App.Store.currentLine);
            }
        });
    });

    const modeCheckbox = document.getElementById('modeCheckbox');
    modeCheckbox?.addEventListener('click', () => {
        const wasChecked = modeCheckbox.classList.contains('checked');
        const targetMode = wasChecked ? 'pro' : 'beginner';
        const targetBtn = document.querySelector(`.mode-btn[data-mode="${targetMode}"]`);
        targetBtn?.click();
    });
}


// В конце main.js
window.__debug = {
    waveform: () => {
        console.log('Waveform state:', {
            isPeaksReady: App.Waveform.isPeaksReady,
            pendingLoad: App.Waveform.pendingLoad,
            retryCount: App.Waveform.retryCount,
            isEditorMode: App.Store.state.isEditorMode,
            container: !!document.getElementById('waveformContainer'),
            audioSrc: App.Player.audio?.src
        });
    }
};


