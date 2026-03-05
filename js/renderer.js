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
 * ✅ NEW: Simple HTML to Plain Text converter for backwards compatibility.
 */
function htmlToPlainText(html) {
    if (!html) return '';
    if (!html.includes('<')) return html; // Already plain text

    let text = html;
    // Replace common block elements with newlines
    text = text.replace(/<p>/gi, '');
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<li>/gi, '• ');
    text = text.replace(/<\/li>/gi, '\n');
    text = text.replace(/<ul>/gi, '');
    text = text.replace(/<\/ul>/gi, '\n');
    text = text.replace(/<ol>/gi, '');
    text = text.replace(/<\/ol>/gi, '\n');

    // Strip remaining tags
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    text = tempDiv.textContent || tempDiv.innerText || '';

    // Clean up multiple newlines
    return text.replace(/\n\s*\n/g, '\n\n').trim();
}

/**
 * ✅ NEW: Auto-resizes textarea based on content.
 */
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
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

    const textareas = [];
    lawStepsContainer.innerHTML = '';

    steps.forEach((step) => {
        const textareaId = `textarea-${step.id}`;

        const stepDiv = document.createElement('div');
        stepDiv.className = 'law-step';
        stepDiv.innerHTML = `
            <h3>${step.title}</h3>
            <p>${step.description}</p>
            <textarea id="${textareaId}" class="plain-text-editor" placeholder="Ihre Antwort hier eingeben..."></textarea>
            <div class="hint-container" id="hint-container-${step.id}"></div>
        `;
        lawStepsContainer.appendChild(stepDiv);

        const textarea = document.getElementById(textareaId);
        textareas.push({ id: step.id, element: textarea });

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
        textareas.forEach(item => {
            const content = item.element.value.trim();
            if (content) {
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
            textareas.forEach(item => {
                if (savedAnswers[item.id]) {
                    // Backwards Compatibility: Convert HTML to Plain Text if necessary
                    item.element.value = htmlToPlainText(savedAnswers[item.id]);
                    autoResize(item.element); // Resize loaded content
                }
            });
        } catch (e) { console.error("Could not parse saved law case answers:", e); }
    }

    textareas.forEach(item => {
        item.element.addEventListener('input', () => {
            saveAllAnswers();
            autoResize(item.element);
        });
    });

    localStorage.setItem(`${TITLE_PREFIX}${assignmentId}_sub_${subId}_caseText`, data.caseText);
}

/**
 * Renders a standard Plain Text editor (Textarea).
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

    const textarea = document.createElement('textarea');
    textarea.id = 'plain-text-editor';
    textarea.className = 'plain-text-editor';
    textarea.placeholder = "Schildern Sie hier Ihre Lösung...";
    contentRenderer.appendChild(textarea);

    const savedContent = localStorage.getItem(storageKey) || '';
    textarea.value = htmlToPlainText(savedContent);
    autoResize(textarea); // Resize loaded content

    textarea.addEventListener('input', () => {
        const content = textarea.value.trim();
        if (content) {
            localStorage.setItem(storageKey, content);
        } else {
            localStorage.removeItem(storageKey);
        }
        autoResize(textarea);
        // ✅ NEW: Dispatch event for auto-save
        window.dispatchEvent(new CustomEvent('assignment-updated'));
    });
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

    const createRevealableElement = (content) => {
        const container = document.createElement('div');
        container.className = 'solution-reveal-container';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'solution-content';
        contentDiv.innerHTML = content;

        const coverDiv = document.createElement('div');
        coverDiv.className = 'solution-cover';
        coverDiv.textContent = 'Klicken zum Aufdecken';

        container.appendChild(contentDiv);
        container.appendChild(coverDiv);

        container.addEventListener('click', () => {
            container.classList.add('revealed');
        });

        return container;
    };

    // ✅ FIX: Solution unlock logic is now placed here to run for ALL assignment types.
    const displaySolution = () => {
        const solutionData = subAssignmentData.solution;
        const solutionMap = new Map(solutionData.solutions.map(s => [s.id, s.answer]));
        const displayContainer = document.getElementById('solution-display-container');
        displayContainer.innerHTML = ''; // Clear previous content

        const title = document.createElement('h3');
        title.textContent = `Musterlösung${solutionData.page ? ` (Seite ${solutionData.page})` : ''}`;
        displayContainer.appendChild(title);

        if (subAssignmentData.type === 'law_case') {
            const steps = [
                { id: 'step_1', title: '1. Sachverhalt analysieren' }, { id: 'step_2', title: '2. Relevante Regel finden' },
                { id: 'step_3', title: '3. Regel analysieren' }, { id: 'step_4', title: '4. Regel auf Sachverhalt anwenden und Rechtsfolge bestimmen' }
            ];
            steps.forEach(step => {
                const answer = solutionMap.get(step.id) || 'Für diesen Schritt wurde keine Lösung gefunden.';
                const stepDiv = document.createElement('div');
                stepDiv.style.marginTop = '20px';
                stepDiv.style.paddingTop = '15px';
                stepDiv.style.borderTop = '1px solid #eee';

                const stepLabel = document.createElement('p');
                stepLabel.style.fontWeight = 'bold';
                stepLabel.textContent = `${step.title}:`;
                stepDiv.appendChild(stepLabel);

                stepDiv.appendChild(createRevealableElement(answer));
                displayContainer.appendChild(stepDiv);
            });
        } else { // Default 'quill' type
            subAssignmentData.questions.forEach((question, index) => {
                const answer = solutionMap.get(question.id) || 'Für diese Frage wurde keine Lösung gefunden.';
                const questionDiv = document.createElement('div');
                questionDiv.style.marginTop = '20px';
                questionDiv.style.paddingTop = '15px';
                questionDiv.style.borderTop = '1px solid #eee';

                const questionLabel = document.createElement('p');
                questionLabel.style.fontWeight = 'bold';
                questionLabel.textContent = `Frage ${index + 1}:`;
                questionDiv.appendChild(questionLabel);

                const questionText = document.createElement('p');
                questionText.style.fontStyle = 'italic';
                questionText.innerHTML = parseMarkdown(question.text);
                questionDiv.appendChild(questionText);

                questionDiv.appendChild(createRevealableElement(answer));
                displayContainer.appendChild(questionDiv);
            });
        }

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
        // setupSolutionUnlockUI(); // DISABLED: Solutions are always shown
        displaySolution();
    } else {
        solutionSection.style.display = 'none';
    }
}