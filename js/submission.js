//
// ─────────────────────────────────────────────────────────────────
//   :::::: F I L E :   j s / s u b m i s s i o n . j s ::::::
// ─────────────────────────────────────────────────────────────────
//
import { SCRIPT_URL, ORG_PREFIX } from './config.js';
import { StatusUI } from './status-ui.js';

const ANSWER_PREFIX = 'modular-answer_';
const QUESTIONS_PREFIX = 'modular-questions_';
const TITLE_PREFIX = 'title_';
const TYPE_PREFIX = 'type_';

// ✅ NEW: Key for storing student info as an object
const STUDENT_INFO_KEY = 'studentInfo';

/**
 * ✅ NEW: Ensures we have student info. Shows a blocking modal if missing.
 * usage: await requireStudentInfo();
 */
export async function requireStudentInfo() {
    let storedInfo = localStorage.getItem(STUDENT_INFO_KEY);
    if (storedInfo) {
        try {
            const parsed = JSON.parse(storedInfo);
            StatusUI.setAuthStatus(parsed.name);
            return parsed;
        } catch (e) {
            console.error("Could not parse student info.", e);
        }
    }

    // If we are here, we need to ask the user.
    return new Promise((resolve) => {
        // Check if modal already exists
        if (document.getElementById('login-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'login-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.85); display: flex;
            justify-content: center; align-items: center; z-index: 3000;
        `;

        modal.innerHTML = `
            <div style="background: white; padding: 2.5em; border-radius: 12px; text-align: center; max-width: 450px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <h2 style="margin-top: 0; color: #333;">Willkommen! 👋</h2>
                <p style="color: #666; margin-bottom: 20px;">Damit deine Arbeit <strong>automatisch gespeichert</strong> werden kann, benötigen wir kurz deinen Namen.</p>
                
                <div style="text-align: left; margin-bottom: 15px;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #444;">Klasse:</label>
                    <input type="text" id="login-class" placeholder="z.B. 8A" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px;">
                </div>

                <div style="text-align: left; margin-bottom: 25px;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #444;">Vorname & Nachname:</label>
                    <input type="text" id="login-name" placeholder="z.B. Max Muster" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px;">
                </div>

                <button id="login-submit" style="width: 100%; padding: 12px; background-color: #28a745; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: background 0.2s;">Starten 🚀</button>
            </div>
        `;

        document.body.appendChild(modal);

        const btn = document.getElementById('login-submit');
        const inputClass = document.getElementById('login-class');
        const inputName = document.getElementById('login-name');

        const saveAndClose = () => {
            const k = inputClass.value.trim();
            const n = inputName.value.trim();

            if (!k || !n) {
                alert("Bitte fülle beide Felder aus.");
                return;
            }

            const info = { klasse: k, name: n };
            localStorage.setItem(STUDENT_INFO_KEY, JSON.stringify(info));
            StatusUI.setAuthStatus(n);
            modal.remove();
            resolve(info);
        };

        btn.addEventListener('click', saveAndClose);
        inputName.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveAndClose(); });
    });
}

// ✅ NEW: Sync Identity across tabs/iframes
window.addEventListener('storage', (e) => {
    if (e.key === STUDENT_INFO_KEY && e.newValue) {
        try {
            const info = JSON.parse(e.newValue);
            StatusUI.setAuthStatus(info.name);
            // Optionally remove modal if it's open in this tab
            const modal = document.getElementById('login-modal');
            if (modal) modal.remove();
        } catch (err) { }
    }
});

// ✅ REMOVED: The getSubmissionToken function is no longer needed.

async function gatherAllDataForSubmission(studentInfo) {
    if (!studentInfo) return null;

    const allDataPayload = {};
    const answerRegex = new RegExp(`^${ANSWER_PREFIX}(.+)_sub_(.+)$`);

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const match = key.match(answerRegex);
        if (match) {
            const [, assignmentId, subId] = match;
            if (!allDataPayload[assignmentId]) allDataPayload[assignmentId] = {};

            allDataPayload[assignmentId][subId] = {
                answer: localStorage.getItem(key) || '',
                title: localStorage.getItem(`${TITLE_PREFIX}${assignmentId}_sub_${subId}`) || '',
                type: localStorage.getItem(`${TYPE_PREFIX}${assignmentId}_sub_${subId}`) || '',
                questions: JSON.parse(localStorage.getItem(`${QUESTIONS_PREFIX}${assignmentId}_sub_${subId}`) || '[]')
            };
        }
    }

    if (Object.keys(allDataPayload).length === 0) {
        alert("Es wurden keine gespeicherten Daten zum Senden gefunden.");
        return null;
    }

    // ✅ UPDATED: Identifier is now a combination of class and name.
    const identifier = `${studentInfo.klasse}_${studentInfo.name}`;

    return {
        identifier,
        payload: {
            assignments: allDataPayload,
            createdAt: new Date().toISOString()
        }
    };
}


/**
 * ✅ NEW: Creates and shows a custom confirmation dialog.
 * @param {object} studentInfo - The student's {klasse, name}.
 * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false if canceled.
 */
function showConfirmationDialog(studentInfo) {
    return new Promise((resolve) => {
        // Remove existing dialog if any
        const existingDialog = document.getElementById('confirm-dialog');
        if (existingDialog) existingDialog.remove();

        const dialog = document.createElement('div');
        dialog.id = 'confirm-dialog';
        dialog.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.6); display: flex;
            justify-content: center; align-items: center; z-index: 2000;
        `;

        dialog.innerHTML = `
            <div style="background: white; padding: 2em; border-radius: 8px; text-align: center; max-width: 400px;">
                <p>Du bist dabei, ein Backup ALLER gespeicherten Aufträge zu senden unter den folgenden Daten:</p>
                <div style="margin: 1em 0; padding: 0.5em; background: #f0f0f0; border-radius: 4px;">
                    <strong>Klasse:</strong> ${studentInfo.klasse}<br>
                    <strong>Name:</strong> ${studentInfo.name}
                </div>
                <p>Fortfahren?</p>
                <button id="confirm-send" style="padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">Senden</button>
                <button id="confirm-edit" style="padding: 10px 20px; background-color: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">Daten ändern</button>
                <button id="confirm-cancel" style="padding: 10px 20px; background-color: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">Abbrechen</button>
            </div>
        `;
        document.body.appendChild(dialog);

        document.getElementById('confirm-send').onclick = () => {
            dialog.remove();
            resolve(true); // Proceed with sending
        };
        document.getElementById('confirm-edit').onclick = () => {
            localStorage.removeItem(STUDENT_INFO_KEY); // Clear stored data
            dialog.remove();
            submitAllAssignments(); // Restart the process
            resolve(false); // Stop current submission
        };
        document.getElementById('confirm-cancel').onclick = () => {
            dialog.remove();
            resolve(false); // Cancel
        };
    });
}


export async function submitAllAssignments(silent = false) {
    // In silent mode, we don't block. We just check if we have info.
    // However, if we call requireStudentInfo() on load, we should have it.
    let studentInfo = null;

    if (silent) {
        const stored = localStorage.getItem(STUDENT_INFO_KEY);
        if (stored) {
            try { studentInfo = JSON.parse(stored); } catch (e) { }
        }
        if (!studentInfo) return; // Silent abort if no user info
    } else {
        studentInfo = await requireStudentInfo();
    }

    if (!studentInfo) return;

    // Only ask for confirmation if NOT silent
    if (!silent) {
        const isConfirmed = await showConfirmationDialog(studentInfo);
        if (!isConfirmed) return;
    }

    const submissionData = await gatherAllDataForSubmission(studentInfo);
    if (!submissionData) return;

    if (!SCRIPT_URL || SCRIPT_URL.includes('YOUR_CLOUD_FUNCTION_TRIGGER_URL')) {
        if (!silent) alert('Konfigurationsfehler: Die Abgabe-URL ist nicht in js/config.js festgelegt.');
        return;
    }

    const submitButton = document.getElementById('submit-all');
    if (!silent) {
        submitButton.textContent = 'Wird übermittelt...';
        submitButton.disabled = true;
    } else {
        StatusUI.setSaveStatus('saving');
    }

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'submit',
                identifier: submissionData.identifier,
                payload: submissionData.payload,
                org: ORG_PREFIX
            })
        });
        const result = await response.json();

        if (response.ok && result.status === 'success') {
            if (!silent) {
                alert('Daten wurden erfolgreich übermittelt.');
            } else {
                StatusUI.setSaveStatus('saved');
            }
        } else {
            throw new Error(result.message || 'Ein unbekannter Server-Fehler ist aufgetreten.');
        }
    } catch (error) {
        console.error('Submission failed:', error);
        if (!silent) {
            alert(`Fehler beim Senden der Daten.\n\nFehler: ${error.message}`);
        } else {
            StatusUI.setSaveStatus('error');
        }
    } finally {
        if (!silent) {
            submitButton.textContent = 'Alle Aufträge abgeben';
            submitButton.disabled = false;
        }
    }
}
