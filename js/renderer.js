import { SCRIPT_URL, ORG_PREFIX } from './config.js'; // Import ORG_PREFIX

const ANSWER_PREFIX = 'modular-answer_';
const QUESTIONS_PREFIX = 'modular-questions_';
const TITLE_PREFIX = 'title_';
const TYPE_PREFIX = 'type_';
const SOLUTION_KEYS_STORE = 'modular-assignment-keys-store';

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function parseMarkdown(text) {
    if (!text) return '';
    const highlightColor = '#007bff';
    let html = text.replace(/\*\*(.*?)\*\*/g, `<strong style="color: ${highlightColor};">$1</strong>`);
    html = html.replace(/([_*])(.*?)\1/g, `<em style="color: ${highlightColor};">$2</em>`);
    return html;
}

/**
 * ✅ NEW: Renders the law case study layout with 4 Quill editors and hints.
 */
function renderLawCase(data, assignmentId, subId) {
    const caseTextContainer = document.getElementById('case-text-container');
    const lawStepsContainer = document.getElementById('law-steps-container');
    const storageKey = `${ANSWER_PREFIX}${assignmentId}_sub_${subId}`;

    caseTextContainer.innerHTML = `<p>${data.caseText.replace(/\n/g, '<br>')}</p>`;

    const steps = [
        { id: 'step_1', title: '1. Sachverhalt analysieren', description: 'Was ist passiert? Wer ist beteiligt? Wer macht was geltend? Welche rechtlichen Fragen stellen sich?' },
        { id: 'step_2', title: '2. Relevante Regel finden', description: 'Welches Rechtsgebiet ist betroffen? In welcher Rechtsvorschrift ist die Frage geregelt?' },
        { id: 'step_3', title: '3. Regel analysieren', description: 'Welche rechtlichen Voraussetzungen, sogenannten Tatbestandsmerkmale, müssen erfüllt sein? Welches sind die Rechtsfolgen davon?' },
        { id: 'step_4', title: '4. Regel auf Sachverhalt anwenden und Rechtsfolge bestimmen', description: 'Sind die Voraussetzungen im Einzelfall erfüllt?' }
    ];

    const quillInstances = [];
    lawStepsContainer.innerHTML = '';

    steps.forEach((step) => {
        const editorId = `quill-editor-${step.id}`;

        const stepDiv = document.createElement('div');
        stepDiv.className = 'law-step';
        stepDiv.innerHTML = `
            <h3>${step.title}</h3>
            <p>${step.description}</p>
            <div id="${editorId}" class="quill-editor-small"></div>
            <div class="hint-container" id="hint-container-${step.id}"></div>
        `;
        lawStepsContainer.appendChild(stepDiv);

        const quill = new Quill(`#${editorId}`, {
            theme: 'snow',
            modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered' }, { 'list': 'bullet' }]] }
        });
        quillInstances.push({ id: step.id, instance: quill });

        // ✅ NEW: Hint logic
        const hintData = (data.hints || []).find(h => h.id === step.id);
        if (hintData) {
            const hintContainer = document.getElementById(`hint-container-${step.id}`);
            const hintButton = document.createElement('button');
            hintButton.className = 'hint-btn';
            hintButton.textContent = 'Tipp anzeigen';
            hintContainer.appendChild(hintButton);

            hintButton.addEventListener('click', () => {
                const existingHintBox = hintContainer.querySelector('.hint-box');
                if (existingHintBox) {
                    existingHintBox.remove();
                    hintButton.textContent = 'Tipp anzeigen';
                } else {
                    const hintBox = document.createElement('div');
                    hintBox.className = 'hint-box';
                    hintBox.innerHTML = hintData.text; // Use innerHTML to allow basic formatting in hints
                    hintContainer.appendChild(hintBox);
                    hintButton.textContent = 'Tipp ausblenden';
                }
            });
        }
    });



    const saveAllAnswers = debounce(() => {
        const allAnswers = {};
        quillInstances.forEach(item => {
            const content = item.instance.root.innerHTML;
            if (content && content !== '<p><br></p>') {
                allAnswers[item.id] = content;
            }
        });
        if (Object.keys(allAnswers).length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(allAnswers));
        } else {
            localStorage.removeItem(storageKey);
        }
        // ✅ NEW: Dispatch event for auto-save
        window.dispatchEvent(new CustomEvent('assignment-updated'));
    }, 500);

    const savedAnswersRaw = localStorage.getItem(storageKey);
    if (savedAnswersRaw) {
        try {
            const savedAnswers = JSON.parse(savedAnswersRaw);
            quillInstances.forEach(item => {
                if (savedAnswers[item.id]) {
                    item.instance.root.innerHTML = savedAnswers[item.id];
                }
            });
        } catch (e) { console.error("Could not parse saved law case answers:", e); }
    }

    quillInstances.forEach(item => {
        item.instance.on('text-change', saveAllAnswers);
    });

    localStorage.setItem(`${TITLE_PREFIX}${assignmentId}_sub_${subId}_caseText`, data.caseText);
}

/**
 * Renders a standard Quill editor.
 */
function renderQuill(data, assignmentId, subId) {
    const contentRenderer = document.getElementById('content-renderer');
    contentRenderer.innerHTML = '';
    const storageKey = `${ANSWER_PREFIX}${assignmentId}_sub_${subId}`;

    const questionsList = document.createElement('ol');
    data.questions.forEach(q => {
        const listItem = document.createElement('li');
        listItem.innerHTML = parseMarkdown(q.text);
        questionsList.appendChild(listItem);
    });
    contentRenderer.appendChild(questionsList);

    const editorDiv = document.createElement('div');
    editorDiv.id = 'quill-editor';
    contentRenderer.appendChild(editorDiv);
    const quill = new Quill('#quill-editor', { theme: 'snow' });

    quill.root.innerHTML = localStorage.getItem(storageKey) || '';

    quill.on('text-change', debounce(() => {
        const htmlContent = quill.root.innerHTML;
        if (htmlContent && htmlContent !== '<p><br></p>') {
            localStorage.setItem(storageKey, htmlContent);
        } else {
            localStorage.removeItem(storageKey);
        }
        // ✅ NEW: Dispatch event for auto-save
        window.dispatchEvent(new CustomEvent('assignment-updated'));
    }, 500));
}

/**
 * Main rendering router.
 */
export function renderSubAssignment(assignmentData, assignmentId, subId) {
    const subAssignmentData = assignmentData.subAssignments[subId];
    const solutionSection = document.getElementById('solution-section');
    const solutionUnlockContainer = document.getElementById('solution-unlock-container');
    const solutionDisplayContainer = document.getElementById('solution-display-container');

    document.getElementById('sub-title').textContent = subAssignmentData.title || subId;

    localStorage.setItem(`${QUESTIONS_PREFIX}${assignmentId}_sub_${subId}`, JSON.stringify(subAssignmentData.questions || []));
    localStorage.setItem(`${TITLE_PREFIX}${assignmentId}_sub_${subId}`, subAssignmentData.title || subId);
    localStorage.setItem(`${TYPE_PREFIX}${assignmentId}_sub_${subId}`, subAssignmentData.type);

    if (subAssignmentData.type === 'law_case') {
        renderLawCase(subAssignmentData, assignmentId, subId);
    } else if (subAssignmentData.type === 'quill') {
        renderQuill(subAssignmentData, assignmentId, subId);
    } else {
        document.getElementById('content-renderer').innerHTML = `<p>Unbekannter Aufgabentyp: ${subAssignmentData.type}</p>`;
    }

    // ✅ FIX: Solution unlock logic is now placed here to run for ALL assignment types.
    const displaySolution = () => {
        const solutionData = subAssignmentData.solution;
        const solutionMap = new Map(solutionData.solutions.map(s => [s.id, s.answer]));
        let html = `<h3>Musterlösung (Seite ${solutionData.page})</h3>`;

        if (subAssignmentData.type === 'law_case') {
            const steps = [
                { id: 'step_1', title: '1. Sachverhalt analysieren' }, { id: 'step_2', title: '2. Relevante Regel finden' },
                { id: 'step_3', title: '3. Regel analysieren' }, { id: 'step_4', title: '4. Regel auf Sachverhalt anwenden und Rechtsfolge bestimmen' }
            ];
            steps.forEach(step => {
                const answer = solutionMap.get(step.id) || 'Für diesen Schritt wurde keine Lösung gefunden.';
                html += `<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
                            <p style="font-weight: bold;">${step.title}:</p>
                            <div style="padding: 10px; background-color: #e9f3ff; border-radius: 4px;">${answer}</div>
                         </div>`;
            });
        } else { // Default 'quill' type
            subAssignmentData.questions.forEach((question, index) => {
                const answer = solutionMap.get(question.id) || 'Für diese Frage wurde keine Lösung gefunden.';
                html += `<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
                            <p style="font-weight: bold;">Frage ${index + 1}:</p>
                            <p style="font-style: italic;">${parseMarkdown(question.text)}</p>
                            <div style="padding: 10px; background-color: #e9f3ff; border-radius: 4px;">${answer}</div>
                         </div>`;
            });
        }

        solutionDisplayContainer.innerHTML = html;
        solutionDisplayContainer.style.display = 'block';
        solutionUnlockContainer.style.display = 'none';
    };

    const setupSolutionUnlockUI = () => {
        const allKeys = JSON.parse(localStorage.getItem(SOLUTION_KEYS_STORE) || '{}');
        const prefilledKey = allKeys[assignmentId] || '';
        solutionUnlockContainer.innerHTML = `<input type="text" id="solution-key-input" placeholder="Lösungsschlüssel eingeben..." value="${prefilledKey}" style="margin-right: 10px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"><button id="solution-unlock-btn">Lösung anzeigen</button><p id="solution-status" style="color: #721c24; margin-top: 5px;"></p>`;
        const unlockBtn = document.getElementById('solution-unlock-btn');
        const keyInput = document.getElementById('solution-key-input');
        const statusEl = document.getElementById('solution-status');
        const verifyKey = async () => {
            const enteredKey = keyInput.value.trim();
            if (!enteredKey) return;
            statusEl.textContent = 'Prüfe Schlüssel...';
            unlockBtn.disabled = true;
            try {
                const response = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'verifySolutionKey',
                        assignmentId: assignmentId,
                        key: enteredKey,
                        org: ORG_PREFIX // ✅ NEW: Send the organization prefix
                    })
                });
                const result = await response.json();
                if (result.isValid) {
                    const currentKeys = JSON.parse(localStorage.getItem(SOLUTION_KEYS_STORE) || '{}');
                    currentKeys[assignmentId] = enteredKey;
                    localStorage.setItem(SOLUTION_KEYS_STORE, JSON.stringify(currentKeys));
                    displaySolution();
                } else {
                    statusEl.textContent = 'Falscher Schlüssel. Bitte erneut versuchen.';
                    const currentKeys = JSON.parse(localStorage.getItem(SOLUTION_KEYS_STORE) || '{}');
                    if (currentKeys[assignmentId]) {
                        delete currentKeys[assignmentId];
                        localStorage.setItem(SOLUTION_KEYS_STORE, JSON.stringify(currentKeys));
                    }
                }
            } catch (error) {
                statusEl.textContent = 'Fehler bei der Überprüfung des Schlüssels.';
            } finally {
                unlockBtn.disabled = false;
            }
        };
        unlockBtn.addEventListener('click', verifyKey);
        keyInput.addEventListener('keydown', (e) => { statusEl.textContent = ''; if (e.key === 'Enter') verifyKey(); });
        if (prefilledKey) { verifyKey(); }
    };

    if (subAssignmentData.solution && Array.isArray(subAssignmentData.solution.solutions) && subAssignmentData.solution.solutions.length > 0) {
        solutionSection.style.display = 'block';
        setupSolutionUnlockUI();
    } else {
        solutionSection.style.display = 'none';
    }
}