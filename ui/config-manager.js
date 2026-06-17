// ui/config-manager.js — Модальное окно настроек
App.ConfigManager = {
    modal: null,

    init() {
        this.modal = document.getElementById('settingsModal');
        if (!this.modal) return;

        document.getElementById('saveSettings')?.addEventListener('click', () => this.save());
        document.getElementById('closeSettings')?.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        this.setupLivePreview();
        App.EventBus.on('config:open', () => this.open());

        console.log('✅ ConfigManager initialized');
    },

    open() {
        const s = App.Store.settings;
        document.getElementById('repeatCount').value = s.repeatCount;
        document.getElementById('continueAfterRepeat').checked = s.continueAfterRepeat;
        document.getElementById('fontSize').value = s.fontSize;
        document.getElementById('fontFamily').value = s.fontFamily;
        document.getElementById('activeLineColor').value = s.activeLineColor;
        document.getElementById('backgroundColor').value = s.backgroundColor;
        document.getElementById('textColor').value = s.textColor;

        this.createPreviewArea();
        this.updatePreview();
        this.modal.style.display = 'flex';
    },

    close() {
        this.modal.style.display = 'none';
    },

    save() {
        App.Store.updateSettings({
            repeatCount: parseInt(document.getElementById('repeatCount').value),
            continueAfterRepeat: document.getElementById('continueAfterRepeat').checked,
            fontSize: document.getElementById('fontSize').value,
            fontFamily: document.getElementById('fontFamily').value,
            activeLineColor: document.getElementById('activeLineColor').value,
            backgroundColor: document.getElementById('backgroundColor').value,
            textColor: document.getElementById('textColor').value
        });

        this.applySettings();
        this.close();
        App.UIManager.showNotification('Настройки сохранены!', 'success');
    },

    applySettings() {
        const s = App.Store.settings;
        document.body.style.backgroundColor = s.backgroundColor;
        document.body.style.color = s.textColor;
        document.body.style.fontFamily = s.fontFamily;
        document.body.style.fontSize = s.fontSize;

        let style = document.getElementById('dynamic-styles');
        if (style) style.remove();

        style = document.createElement('style');
        style.id = 'dynamic-styles';
        style.textContent = `
            .line.active { background: ${s.activeLineColor} !important; color: white !important; }
            .line.active .line-time { color: #e8f5e9 !important; }
        `;
        document.head.appendChild(style);
    },

    setupLivePreview() {
        const preview = (id, fn) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => fn(el.value));
            el.addEventListener('input', () => fn(el.value));
        };

        preview('fontSize', (v) => {
            const p = document.getElementById('fontPreview');
            if (p) p.style.fontSize = v;
        });

        preview('fontFamily', (v) => {
            const p = document.getElementById('fontPreview');
            if (p) p.style.fontFamily = v;
        });

        preview('activeLineColor', (v) => {
            const p = document.getElementById('activeLinePreview');
            if (p) { p.style.background = v; p.style.color = 'white'; }
        });

        preview('backgroundColor', (v) => {
            const p = document.getElementById('previewArea');
            if (p) p.style.background = v;
        });

        preview('textColor', (v) => {
            const p = document.getElementById('fontPreview');
            if (p) p.style.color = v;
        });
    },

    createPreviewArea() {
        if (document.getElementById('previewContainer')) return;

        const container = document.createElement('div');
        container.id = 'previewContainer';
        container.style.cssText = 'margin:15px 0;padding:15px;border:1px solid #ddd;border-radius:8px;background:white;';

        container.innerHTML = `
            <div style="font-weight:bold;margin-bottom:10px;color:#333;">Предпросмотр:</div>
            <div id="previewArea" style="padding:15px;border-radius:6px;min-height:80px;">
                <div id="fontPreview" style="margin-bottom:10px;padding:8px;">Это пример обычного текста</div>
                <div id="activeLinePreview" style="padding:10px 12px;border-radius:6px;margin:5px 0;font-weight:bold;">Это активная строка</div>
                <div style="display:flex;align-items:center;margin-top:10px;font-size:12px;">
                    <span style="color:#666;margin-right:10px;font-family:monospace;">1:23</span>
                    <span>Строка с временем</span>
                </div>
            </div>
        `;

        const settingsContent = document.querySelector('.settings-content');
        const buttons = document.querySelector('.settings-buttons');
        if (settingsContent && buttons) {
            settingsContent.insertBefore(container, buttons);
        }
    },

    updatePreview() {
        const s = App.Store.settings;
        const fp = document.getElementById('fontPreview');
        const ap = document.getElementById('activeLinePreview');
        const pa = document.getElementById('previewArea');

        if (fp) { fp.style.fontSize = s.fontSize; fp.style.fontFamily = s.fontFamily; fp.style.color = s.textColor; }
        if (ap) { ap.style.background = s.activeLineColor; ap.style.color = 'white'; }
        if (pa) pa.style.background = s.backgroundColor;
    }
};
