// ui/ui-manager.js — Темы, компактный режим, меню, скорость
App.UIManager = {
    currentTheme: 'light',

    init() {
        this.loadTheme();
        this.initMenu();
        this.initPlaybackControls();
        this.initCompactMode();
        this.initSpeedControl();
        this.initThemeButtons();
        this.applyTheme(this.currentTheme);

        App.EventBus.on('player:play', () => this.updatePlayButtons('⏸️'));
        App.EventBus.on('player:pause', () => this.updatePlayButtons('▶️'));
        App.EventBus.on('player:ended', () => this.updatePlayButtons('▶️'));
        App.EventBus.on('ui:theme-changed', (theme) => this.applyTheme(theme));
        App.EventBus.on('ui:compact-changed', (isCompact) => this.applyCompactState(isCompact));

        console.log('✅ UIManager initialized');
    },

    initMenu() {
        const menuBtn = document.getElementById('menuBtn');
        const dropdown = document.getElementById('dropdownMenu');
        if (!menuBtn || !dropdown) return;

        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        document.getElementById('dropdownMedia')?.addEventListener('click', () => {
            document.getElementById('audioFile')?.click();
            dropdown.classList.remove('show');
        });

        document.getElementById('dropdownText')?.addEventListener('click', () => {
            document.getElementById('lyricsFile')?.click();
            dropdown.classList.remove('show');
        });

        document.getElementById('dropdownEdit')?.addEventListener('click', () => {
            App.EventBus.emit('editor:toggle');
            dropdown.classList.remove('show');
        });

        document.getElementById('dropdownSettings')?.addEventListener('click', () => {
            App.EventBus.emit('config:open');
            dropdown.classList.remove('show');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== menuBtn) {
                dropdown.classList.remove('show');
            }
        });
    },

    initPlaybackControls() {
        const togglePlayback = () => App.EventBus.emit('player:toggle');

        ['playPauseBtn', 'playPauseBtnCompact', 'editorPlayBtn'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', togglePlayback);
        });

        ['progress', 'progressCompact'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => {
                const dur = App.Player.audio?.duration || 0;
                App.EventBus.emit('player:seek', { time: (el.value / 100) * dur });
            });
        });
    },

    updatePlayButtons(icon) {
        ['playPauseBtn', 'playPauseBtnCompact', 'editorPlayBtn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.innerHTML = icon;
        });
    },

    initSpeedControl() {
        const slider = document.getElementById('speedSlider');
        const display = document.getElementById('speedValue');
        if (!slider || !display) return;

        const savedRate = App.Store.settings.playbackRate || 1.0;
        slider.value = savedRate;
        display.textContent = savedRate.toFixed(1) + 'x';
        if (App.Player.audio) App.Player.audio.playbackRate = savedRate;

        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            display.textContent = value.toFixed(1) + 'x';
            App.EventBus.emit('player:set-rate', value);
        });
    },

    initCompactMode() {
        const toggle = () => {
            const player = document.getElementById('playerContainer');
            App.Store.setCompact(!player.classList.contains('compact'));
        };

        document.getElementById('toggleCompactBtn')?.addEventListener('click', toggle);
        document.getElementById('toggleCompactBtnCompact')?.addEventListener('click', toggle);

        try {
            if (localStorage.getItem('karaokeCompactMode') === 'true') {
                App.Store.setCompact(true);
            }
        } catch(e) {}
    },

    applyCompactState(isCompact) {
        const player = document.getElementById('playerContainer');
        const lyrics = document.getElementById('lyricsDisplay');
        const main = document.getElementById('mainContent');
        const btn1 = document.getElementById('toggleCompactBtn');
        const btn2 = document.getElementById('toggleCompactBtnCompact');

        if (isCompact) {
            player.classList.add('compact');
            if (lyrics) lyrics.style.top = '50px';
            if (main) main.style.marginTop = '70px';
            if (btn1) btn1.textContent = 'Развернуть ↓';
            if (btn2) btn2.textContent = '↓';
        } else {
            player.classList.remove('compact');
            if (lyrics) lyrics.style.top = '90px';
            if (main) main.style.marginTop = '110px';
            if (btn1) btn1.textContent = 'Свернуть ↑';
            if (btn2) btn2.textContent = '↑';
        }

        try {
            localStorage.setItem('karaokeCompactMode', isCompact);
        } catch(e) {}
    },

    initThemeButtons() {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                App.Store.setTheme(btn.dataset.theme);
            });
        });
    },

    loadTheme() {
        try {
            const saved = localStorage.getItem('karaokeTheme');
            if (saved && ['light', 'dark', 'neutral'].includes(saved)) {
                this.currentTheme = saved;
            } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
                this.currentTheme = 'dark';
            }
        } catch(e) {
            this.currentTheme = 'light';
        }
        document.body.classList.add('theme-' + this.currentTheme);
    },

    applyTheme(theme) {
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-neutral');
        document.body.classList.add('theme-' + theme);
        this.currentTheme = theme;

        document.querySelectorAll('.theme-btn').forEach(btn => {
            const isActive = btn.dataset.theme === theme;
            btn.classList.toggle('active', isActive);
            btn.style.transform = isActive ? 'scale(1.1)' : '';
            btn.style.boxShadow = isActive ? '0 0 8px rgba(0,0,0,0.3)' : '';
        });

        try {
            localStorage.setItem('karaokeTheme', theme);
        } catch(e) {}

        this.showNotification('Тема: ' + {light:'Светлая', dark:'Тёмная', neutral:'Нейтральная'}[theme]);
    },

    showNotification(message, type = 'info') {
        const colors = { success: '#28a745', error: '#dc3545', warning: '#ffc107', info: '#17a2b8' };
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            background: ${colors[type] || colors.info}; color: white;
            padding: 10px 15px; border-radius: 5px; z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2); max-width: 300px;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
};
