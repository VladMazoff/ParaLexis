// data/lyrics-parser.js — Чистые функции парсинга
App.Parser = {
    parseTime(timeStr) {
        const match = timeStr.match(/^(\d+):(\d+(?:\.\d+)?)$/);
        return match ? parseInt(match[1], 10) * 60 + parseFloat(match[2]) : -1;
    },

    formatTime(sec) {
        if (isNaN(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    },

    formatTimeForSave(sec) {
        if (isNaN(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return s === Math.floor(s) 
            ? m + ':' + (s < 10 ? '0' : '') + s 
            : m + ':' + s.toFixed(1);
    },

    parseText(text) {
        const lines = [];
        const rawLines = text.split('\n');
        let currentTime = -1;
        let block = null;

        const flushBlock = () => {
            if (block) {
                lines.push({
                    time: block.time !== -1 ? block.time : -1,
                    text: block.text,
                    translation: block.translation || '',
                    notes: block.notes || ''
                });
                block = null;
            }
        };

        rawLines.forEach(raw => {
            const trim = raw.trim();
            const timeMatch = trim.match(/^(\d+):(\d+(?:\.\d+)?)$/);

            if (timeMatch && trim === raw.trim()) {
                flushBlock();
                currentTime = this.parseTime(trim);
                return;
            }

            if (trim.startsWith('=')) {
                if (block) {
                    const trans = raw.substring(1).trim();
                    if (trans) block.translation = (block.translation ? block.translation + ' ' : '') + trans;
                }
                return;
            }

            if (trim.startsWith('!:') && trim.length > 2) {
                if (block) block.notes = raw.substring(2).trim();
                return;
            }

            flushBlock();
            block = { time: currentTime, text: trim === '' ? '' : raw, translation: '', notes: '' };

            const sameLineMatch = raw.match(/^(\d+):(\d+(?:\.\d+)?)(.*)$/);
            if (sameLineMatch) {
                block.time = this.parseTime(sameLineMatch[1] + ':' + sameLineMatch[2]);
                block.text = sameLineMatch[3].trim();
            }

            currentTime = -1;
        });

        flushBlock();

        while (lines.length && !lines[lines.length - 1].text && 
               !lines[lines.length - 1].translation && 
               !lines[lines.length - 1].notes) {
            lines.pop();
        }

        return lines;
    },

    exportToText(lines) {
        return lines.map(line => {
            let result = '';
            if (line.time > 0) result += this.formatTimeForSave(line.time) + '\n';
            result += line.text + '\n';
            return result;
        }).join('\n');
    },

    init() {
        console.log('✅ Parser initialized');
    }
};
