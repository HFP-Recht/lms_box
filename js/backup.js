
/**
 * Export all LMS-related local storage data to a JSON file.
 */
export function exportBackup() {
    const data = {};
    const keysToBackup = ['studentInfo'];
    const prefixlist = ['modular-', 'title_', 'type_'];

    // Gather specific keys
    keysToBackup.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) data[key] = value;
    });

    // Gather prefixed keys
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (prefixlist.some(p => key.startsWith(p))) {
            data[key] = localStorage.getItem(key);
        }
    }

    if (Object.keys(data).length === 0) {
        alert("Keine Daten zum Sichern gefunden.");
        return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Trigger file input and import data.
 */
export function importBackupTrigger() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                let count = 0;

                Object.keys(data).forEach(key => {
                    localStorage.setItem(key, data[key]);
                    count++;
                });

                alert(`${count} Datensätze erfolgreich wiederhergestellt. Die Seite wird neu geladen.`);
                location.reload();
            } catch (err) {
                console.error(err);
                alert("Fehler beim Importieren der Datei. Ist es ein gültiges Backup?");
            }
        };
        reader.readAsText(file);
    };
    input.click();
}
