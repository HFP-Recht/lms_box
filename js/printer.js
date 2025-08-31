import { SCRIPT_URL } from './config.js';

const ANSWER_PREFIX = 'modular-answer_';
const QUESTIONS_PREFIX = 'modular-questions_';
const TITLE_PREFIX = 'title_';
const TYPE_PREFIX = 'type_'; // Added TYPE_PREFIX

// gatherAssignmentData function remains IDENTICAL to the previous version.
// It correctly gathers all necessary data, including the new 'type'.
// Omitted for brevity. Please use the function from the previous version.
async function gatherAssignmentData(assignmentId) {
    const studentIdentifier = localStorage.getItem('studentIdentifier') || 'Unbekannter Schüler';
    let mainTitle = `Aufgabe: ${assignmentId}`;
    let serverSubAssignments = {};

    try {
        const response = await fetch(`${SCRIPT_URL}?assignmentId=${assignmentId}`);
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
        const data = await response.json();
        if (data.status === 'error') throw new Error(data.message);

        if (data.assignmentTitle) mainTitle = data.assignmentTitle;
        if (data.subAssignments && typeof data.subAssignments === 'object') {
            serverSubAssignments = data.subAssignments;
        }
    } catch (e) {
        console.warn(`Could not fetch full assignment data from server for printing. Falling back to localStorage data only. Reason: ${e.message}`);
    }

    const localSubAssignments = {};
    const prefixes = {
        answer: ANSWER_PREFIX,
        questions: QUESTIONS_PREFIX,
        title: TITLE_PREFIX,
        type: TYPE_PREFIX // Added type
    };

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        let keyType = null;
        let keyContent = '';

        for (const [name, prefix] of Object.entries(prefixes)) {
            if (key.startsWith(prefix)) {
                keyType = name;
                keyContent = key.substring(prefix.length);
                break;
            }
        }

        if (keyType) {
            const expectedStart = `${assignmentId}_sub_`;
            if (keyContent.startsWith(expectedStart)) {
                const subId = keyContent.substring(expectedStart.length);

                if (!localSubAssignments[subId]) {
                    localSubAssignments[subId] = {};
                }
                
                // Also get caseText if it exists
                if (localStorage.getItem(`${TITLE_PREFIX}${assignmentId}_sub_${subId}_caseText`)) {
                    localSubAssignments[subId].caseText = localStorage.getItem(`${TITLE_PREFIX}${assignmentId}_sub_${subId}_caseText`);
                }

                const value = localStorage.getItem(key);
                switch (keyType) {
                    case 'answer':
                        localSubAssignments[subId].answer = value || '';
                        break;
                    case 'title':
                        localSubAssignments[subId].title = value || subId;
                        break;
                    case 'questions':
                        try {
                            localSubAssignments[subId].questions = JSON.parse(value || '[]');
                        } catch (err) {}
                        break;
                    case 'type':
                        localSubAssignments[subId].type = value || 'quill';
                        break;
                }
            }
        }
    }

    const finalSubAssignments = {};
    const masterSubIdList = new Set([
        ...Object.keys(serverSubAssignments),
        ...Object.keys(localSubAssignments)
    ]);

    for (const subId of masterSubIdList) {
        const serverData = serverSubAssignments[subId] || {};
        const localData = localSubAssignments[subId] || {};

        finalSubAssignments[subId] = {
            answer: localData.answer || '',
            title: serverData.title || localData.title || subId,
            questions: (serverData.questions && serverData.questions.length > 0) 
                       ? serverData.questions 
                       : (localData.questions || []),
            type: serverData.type || localData.type || 'quill',
            caseText: serverData.caseText || localData.caseText || ''
        };
    }
    
    if (masterSubIdList.size === 0) {
        finalSubAssignments['info'] = {
            title: 'Keine Aufgaben gefunden',
            questions: [{text: 'Es konnten keine Aufgabeninformationen geladen werden.'}]
        };
    }

    return { studentIdentifier, assignmentTitle: mainTitle, subAssignments: finalSubAssignments };
}


function convertMarkdownToHTML(text) {
    if (!text) return text;
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
    return text;
}

function generatePrintHTML(data) {
    let bodyContent = `<h1>${convertMarkdownToHTML(data.assignmentTitle)}</h1><p><strong>Schüler/in:</strong> ${data.studentIdentifier}</p><hr>`;
    const sortedSubIds = Object.keys(data.subAssignments).sort();

    for (const subId of sortedSubIds) {
        const subData = data.subAssignments[subId];
        bodyContent += `<div class="sub-assignment"><h2>${convertMarkdownToHTML(subData.title)}</h2>`;

        // ✅ NEW: Conditional rendering based on assignment type
        if (subData.type === 'law_case') {
            // Render the law case layout
            bodyContent += `<h3>Fall:</h3><div class="case-text-box">${subData.caseText.replace(/\n/g, '<br>')}</div>`;

            const steps = [
                { title: '1. Sachverhalt analysieren', description: 'Was ist passiert? Wer ist beteiligt? Wer macht was geltend? Welche rechtlichen Fragen stellen sich?' },
                { title: '2. Relevante Regel finden', description: 'Welches Rechtsgebiet ist betroffen? In welcher Rechtsvorschrift ist die Frage geregelt?' },
                { title: '3. Regel analysieren', description: 'Welche rechtlichen Voraussetzungen, sogenannten Tatbestandsmerkmale, müssen erfüllt sein? Welches sind die Rechtsfolgen davon?' },
                { title: '4. Regel auf Sachverhalt anwenden und Rechtsfolge bestimmen', description: 'Sind die Voraussetzungen im Einzelfall erfüllt?' }
            ];
            
            let answers = {};
            try {
                answers = JSON.parse(subData.answer || '{}');
            } catch(e) { console.error("Could not parse law case answers for printing."); }

            steps.forEach((step, index) => {
                const stepId = `step_${index + 1}`;
                const answerHtml = answers[stepId] || '<div class="answer-box empty-answer-box"></div>';
                bodyContent += `
                    <div class="law-step-print">
                        <h4>${step.title}</h4>
                        <p class="description-print"><em>${step.description}</em></p>
                        <div class="answer-box">${answerHtml}</div>
                    </div>
                `;
            });

        } else {
            // Render the default quill layout
            if (subData.questions && subData.questions.length > 0) {
                const questionsHTML = subData.questions.map(q => `<li>${convertMarkdownToHTML(q.text)}</li>`).join('');
                bodyContent += `<h3>Fragen:</h3><ol>${questionsHTML}</ol>`;
            }
            
            bodyContent += `<h3>Antwort:</h3>`;
            const isAnswerEmpty = !subData.answer || subData.answer.trim() === '' || subData.answer.trim() === '<p><br></p>';
            if (isAnswerEmpty) {
                bodyContent += `<div class="answer-box empty-answer-box"></div>`;
            } else {
                bodyContent += `<div class="answer-box">${subData.answer}</div>`;
            }
        }
        
        bodyContent += `</div>`;
    }

    const css = `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; margin: 2em; }
        h1, h2, h3, h4 { color: #333; }
        h1 { font-size: 2em; border-bottom: 2px solid #ccc; padding-bottom: 0.5em; }
        h2 { font-size: 1.5em; background-color: #f0f0f0; padding: 0.5em; margin-top: 2em; border-left: 5px solid #007bff; }
        h3 { font-size: 1.1em; margin-bottom: 0.5em; margin-top: 1.5em; }
        .sub-assignment { page-break-inside: avoid; margin-bottom: 2em; }
        .answer-box { padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-top: 0; background-color: #f9f9f9; }
        .answer-box p { margin-top: 0; }
        .empty-answer-box { position: relative; min-height: 9em; background-color: #ffffff; }
        .empty-answer-box::before { content: '✏'; position: absolute; top: 8px; left: 10px; color: #aaa; font-size: 0.9em; font-style: italic; }
        ol { padding-left: 20px; }
        hr { border: 0; border-top: 1px solid #ccc; }
        /* ✅ NEW: Styles for law case printout */
        .case-text-box { background-color: #e9ecef; padding: 1em; border-radius: 4px; margin-bottom: 1.5em; }
        .law-step-print { margin-top: 1.5em; }
        .law-step-print h4 { margin-bottom: 0.25em; }
        .law-step-print .description-print { margin-top: 0; color: #6c757d; }
        @media print { 
            h2, .case-text-box { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; } 
        }
    `;

    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Druckansicht: ${data.assignmentTitle}</title><style>${css}</style></head><body>${bodyContent}</body></html>`;
}

export async function printAssignmentAnswers(assignmentId) {
    const data = await gatherAssignmentData(assignmentId);
    if (!data) return;

    const htmlContent = generatePrintHTML(data);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Popup-Fenster wurde blockiert. Bitte erlaube Popups für diese Seite.");
        return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 500);
}