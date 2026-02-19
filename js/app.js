import { SCRIPT_URL, CONTENT_ORG } from './config.js'; // Import CONTENT_ORG
import { renderSubAssignment } from './renderer.js';
import { printAssignmentAnswers } from './printer.js';
import { submitAllAssignments, requireStudentInfo } from './submission.js';
import { StatusUI } from './status-ui.js';

let autoSaveTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Status UI
    StatusUI.init();

    // 2. Force Login (or load existing)
    await requireStudentInfo();

    // 3. Setup Auto-Save Listener (Debounced 5s)
    window.addEventListener('assignment-updated', () => {
        StatusUI.setSaveStatus('local'); // Show local save immediately

        if (autoSaveTimer) clearTimeout(autoSaveTimer);

        autoSaveTimer = setTimeout(() => {
            submitAllAssignments(true); // silent = true
        }, 5000); // 5 seconds debounce
    });

    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('assignmentId');
    const subId = urlParams.get('subId');

    if (!assignmentId || !subId) {
        document.getElementById('main-title').textContent = 'Fehler';
        document.getElementById('content-renderer').innerHTML = '<p>Keine `assignmentId` oder `subId` in der URL gefunden.</p>';
        return;
    }

    document.getElementById('submit-all').addEventListener('click', submitAllAssignments);
    document.getElementById('print-answers').addEventListener('click', () => printAssignmentAnswers(assignmentId));

    // ✅ UPDATED: Add the org parameter to the fetch URL
    // Use CONTENT_ORG to read the shared assignment definitions
    const fetchUrl = `${SCRIPT_URL}?assignmentId=${assignmentId}&org=${CONTENT_ORG}`;

    fetch(fetchUrl)
        .then(response => {
            if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            if (data.status === 'error') throw new Error(data.message);

            document.getElementById('main-title').textContent = data.assignmentTitle;
            const subAssignmentData = data.subAssignments[subId];
            if (!subAssignmentData) throw new Error(`Teilaufgabe "${subId}" nicht gefunden.`);

            renderSubAssignment(data, assignmentId, subId);
        })
        .catch(error => {
            console.error('Fehler beim Laden der Aufgabe:', error);
            document.getElementById('main-title').textContent = 'Fehler';
            document.getElementById('content-renderer').innerHTML = `<p>${error.message}</p><p>Stellen Sie sicher, dass die assignmentId korrekt ist und die Server-Skript-URL in <code>js/config.js</code> konfiguriert ist.</p>`;
        });
});