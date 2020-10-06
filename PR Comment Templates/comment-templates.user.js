// ==UserScript==
// @name         Bitbucket PR comment templates
// @namespace    http://tampermonkey.net/
// @version      1.0.4
// @description  Add templates to the bitbucket PR comment interface
// @author       Nate Rabins
// @match        */projects/*/repos/*/pull-requests/*
// @grant        none
// ==/UserScript==

const TEMPLATES = [
    { name: 'Test', output: 'This is a test template' },
    { name: 'Test 2', output: 'This is another test template. You\'re doing great!' },
    { name: 'Multiline', output: 
`This is multiline.
A line here (we skipped the above).
And a line here, with no skip.` },
    { name: 'Emojis', output: '✅🙁' }
];

const TAB_CONTAINER_SELECTOR = "#pull-requests-container";
const COMMENT_WRAPPER_SELECTOR = ".comment-editor-wrapper";
const TOOLBAR_SELECTOR = ".editor-toolbar-primary";

let commentEditorObserver;
let tabObserver;

(function () {
    'use strict';

    setUpTabObserver();
    setUpCommentEditorObserver();
})();

function setUpTabObserver() {
    const tabContainer = document.querySelector(TAB_CONTAINER_SELECTOR);
    if (!tabContainer) {
        console.error('No tab container found for comment template user script!');
        return;
    }

    tabObserver = new MutationObserver(handleTabChange);
    tabObserver.observe(tabContainer, { attributes: false, childList: true, subTree: false });
}

function handleTabChange(mutationsList, observer) {
    console.log('a change!');

    for (const mutation of mutationsList) {
        if (mutation.addedNodes.length > 0) {
            setUpCommentEditorObserver();
        }
    }
}

function setUpCommentEditorObserver() {
    // Handle initial load (the editor can be open if content has previously been entered)
    const toolbar = document.querySelector(TOOLBAR_SELECTOR);
    if (toolbar) {
        setUpSelect(toolbar);
    }

    // Also watch the editor container for changes (the toolbar is regenerated upon opening)
    if (commentEditorObserver) {
        // Kill previous instance
        commentEditorObserver.disconnect();
    }

    const container = document.querySelector(COMMENT_WRAPPER_SELECTOR);
    if (container) {
        commentEditorObserver = new MutationObserver(handleCommentEditorChange);
        commentEditorObserver.observe(container, { attributes: false, childList: true, subTree: false });
    }
}

function handleCommentEditorChange(mutationsList, observer) {
    for (const mutation of mutationsList) {
        const editors = [...mutation.addedNodes].filter(node => node.classList.contains('editor'));
        if (editors.length == 0) {
            continue;
        }

        // The element should be there now
        const toolbar = document.querySelector(TOOLBAR_SELECTOR);
        if (!toolbar) {
            console.error('Parent editor was added but no .editor-toolbar-primary found!');
            return;
        }
        setUpSelect(toolbar);
    }
}

function setUpSelect(toolbar) {
    const selectEl = document.createElement('select');
    selectEl.style = "margin: 0px 8px; border-radius: 4px; padding: 3px; cursor: pointer;";

    const noneOption = document.createElement('option');
    noneOption.value = "";
    noneOption.innerText = "Apply Template";
    noneOption.disabled = true;
    noneOption.selected = true;
    selectEl.appendChild(noneOption);

    // Templates
    for (let i = 0; i < TEMPLATES.length; i++) {
        const template = TEMPLATES[i];
        const optionEl = document.createElement('option');
        optionEl.value = i;
        optionEl.innerText = template.name;
        selectEl.appendChild(optionEl);
    }

    selectEl.addEventListener('change', function (e) {
        const selectedIndex = selectEl.selectedIndex - 1; // Account for initial disabled option
        const value = TEMPLATES[selectedIndex];
        const codeMirror = document.querySelector('.CodeMirror').CodeMirror;
        codeMirror.setValue(value.output);
    });

    selectEl.addEventListener('focusout', function (e) {
        selectEl.value = "";
    });

    toolbar.appendChild(selectEl);
}
