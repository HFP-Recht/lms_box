import { SCRIPT_URL, ORG_PREFIX } from './config.js'; // Import ORG_PREFIX
import { renderSubAssignment } from './renderer.js';
import { printAssignmentAnswers } from './printer.js';
import { submitAllAssignments } from './submission.js';

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('assignmentId');
    const subId = urlParams.get('subId');
    const variant = urlParams.get('variant'); // ✅ NEW: Get the variant from the URL

    if (!assignmentId || !subId || !variant) { // ✅ UPDATED: Also check for variant
        document.getElementById('main-title').textContent = 'Fehler';
        document.getElementById('content-renderer').innerHTML = '<p>Keine `assignmentId`, `subId` oder `variant` in der URL gefunden.</p>';
        return;
    }

    document.getElementById('submit-all').addEventListener('click', submitAllAssignments);
    // ✅ UPDATED: Pass the variant to the print function
    document.getElementById('print-answers').addEventListener('click', () => printAssignmentAnswers(assignmentId, variant));

    // ✅ UPDATED: Add the variant parameter to the fetch URL
    const fetchUrl = `${SCRIPT_URL}?assignmentId=${assignmentId}&org=${ORG_PREFIX}&variant=${variant}`;
    
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