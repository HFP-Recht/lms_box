export const StatusUI = {
    init() {
        if (document.getElementById('status-bar-container')) return;

        const header = document.getElementById('assignment-header');
        const container = document.createElement('div');
        container.id = 'status-bar-container';
        container.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: flex-end;
            margin-top: -10px;
            margin-bottom: 10px;
            font-size: 0.9em;
            color: #666;
        `;

        container.innerHTML = `
            <span id="auth-status" style="margin-right: 15px;">🔌 Laden...</span>
            <span id="save-status"></span>
        `;

        header.appendChild(container);
    },

    setAuthStatus(name) {
        const el = document.getElementById('auth-status');
        if (!el) return;
        if (name) {
            el.innerHTML = `👤 <strong>${name}</strong>`;
            el.style.color = '#28a745';
        } else {
            el.innerHTML = `⚠️ Nicht angemeldet`;
            el.style.color = '#dc3545';
        }
    },

    setSaveStatus(state) { // 'saving', 'saved', 'error', 'local'
        const el = document.getElementById('save-status');
        if (!el) return;

        switch (state) {
            case 'saving':
                el.innerHTML = '⏳ Speichert...';
                el.style.color = '#007bff';
                break;
            case 'saved':
                el.innerHTML = '☁️ Gespeichert';
                el.style.color = '#28a745';
                setTimeout(() => { if (el.innerHTML.includes('Gespeichert')) el.innerHTML = ''; }, 3000);
                break;
            case 'error':
                el.innerHTML = '❌ Speicherfehler';
                el.style.color = '#dc3545';
                break;
            case 'local':
                el.innerHTML = '💾 Lokal gespeichert';
                el.style.color = '#6c757d';
                break;
            default:
                el.innerHTML = '';
        }
    }
};
