// ==UserScript==
// @name         Claude prompt manager
// @namespace    http://tampermonkey.net/
// @version      2024-07-20
// @description  Manage claude prompts in a github gist
// @author       You
// @match        https://claude.ai/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=claude.ai
// @updateURL    https://github.com/ashwin-pc/useful-scripts/raw/main/userscripts/claude_prompt_manager.user.js
// @downloadURL  https://github.com/ashwin-pc/useful-scripts/raw/main/userscripts/claude_prompt_manager.user.js
// @grant        none
// ==/UserScript==

// Prompt Manager - Arc Boost
// Description: Save and reuse prompts using GitHub Gists as a database

// Function to get or set configuration
function getConfig() {
  return {
    githubToken: localStorage.getItem('githubToken'),
    gistId: localStorage.getItem('gistId'),
    fileName: localStorage.getItem('fileName') || 'prompts.json'
  };
}

function setConfig(config) {
  localStorage.setItem('githubToken', config.githubToken);
  localStorage.setItem('gistId', config.gistId);
  localStorage.setItem('fileName', config.fileName);
}

// Function to prompt the user for configuration
function promptForConfig() {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap');

        dialog {
          padding: 16px;
          background: #1e1e1e;
          color: #e0e0e0;
          border-radius: 8px;
          border: none;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          font-family: 'Inter', sans-serif;
          max-width: 320px;
          width: 100%;
        }
        dialog::backdrop {
          background-color: rgba(0, 0, 0, 0.7);
        }
        .dialog h2 {
          color: #ffffff;
          font-size: 18px;
          margin: 0 0 12px 0;
          font-weight: 500;
        }
        .dialog p {
          color: #b0b0b0;
          font-size: 14px;
          margin: 0 0 16px 0;
        }
        .dialog input {
          width: 100%;
          padding: 8px;
          margin-bottom: 16px;
          background-color: #2d2d2d;
          border: 1px solid #444;
          border-radius: 4px;
          font-size: 14px;
          color: #e0e0e0;
          box-sizing: border-box;
        }
        .dialog input:focus {
          outline: none;
          border-color: #4d9cf6;
        }
        .dialog input::placeholder {
          color: #777;
        }
        .button-group {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        button {
          padding: 8px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s, color 0.2s;
        }
        button[type="submit"] {
          background-color: #4d9cf6;
          color: #ffffff;
        }
        button[type="submit"]:hover {
          background-color: #3a7dbd;
        }
        #cancelButton {
          background-color: #3a3a3a;
          color: #e0e0e0;
        }
        #cancelButton:hover {
          background-color: #4a4a4a;
        }
      </style>
      <form method="dialog" class="dialog">
        <h2>Prompt Manager Configuration</h2>
        <p>Enter your GitHub Personal Access Token, Gist ID, and file name:</p>
        <input type="password" id="tokenInput" required placeholder="GitHub Token">
        <input type="text" id="gistIdInput" required placeholder="Gist ID">
        <input type="text" id="fileNameInput" required placeholder="File Name (default: prompts.json)">
        <div class="button-group">
          <button type="button" id="cancelButton">Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    `;
    document.body.appendChild(dialog);

    const form = dialog.querySelector('form');
    const cancelButton = dialog.querySelector('#cancelButton');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const config = {
        githubToken: dialog.querySelector('#tokenInput').value.trim(),
        gistId: dialog.querySelector('#gistIdInput').value.trim(),
        fileName: dialog.querySelector('#fileNameInput').value.trim() || 'prompts.json'
      };
      dialog.close();
      resolve(config);
    });

    cancelButton.addEventListener('click', () => {
      dialog.close();
      resolve(null);
    });

    dialog.addEventListener('close', () => {
      document.body.removeChild(dialog);
    });

    dialog.showModal();
  });
}

// Function to get or update configuration
async function getOrUpdateConfig() {
  let config = getConfig();
  if (!config.githubToken || !config.gistId) {
    const newConfig = await promptForConfig();
    if (newConfig) {
      setConfig(newConfig);
      config = newConfig;
    } else {
      throw new Error('Configuration cancelled');
    }
  }
  return config;
}

// Function to clear the stored configuration
function clearConfig() {
  localStorage.removeItem('githubToken');
  localStorage.removeItem('gistId');
  localStorage.removeItem('fileName');
  alert('Configuration has been cleared. You will be prompted for new settings on the next operation.');
}

// Function to fetch prompts from GitHub Gist
async function fetchPrompts() {
  const config = await getOrUpdateConfig();
  try {
    const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
      headers: {
        'Authorization': `token ${config.githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!response.ok) {
      throw new Error(`GitHub API Error: ${response.status}`);
    }
    const data = await response.json();
    const content = data.files[config.fileName]?.content;
    if (!content) {
      return [];
    }
    const parsedPrompts = JSON.parse(content);

    // Convert old format to new format if necessary
    return parsedPrompts.map(prompt => {
      if (typeof prompt === 'string') {
        return { title: 'Untitled', content: prompt };
      }
      return prompt;
    });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return [];
  }
}

// Function to save prompts to GitHub Gist
async function savePrompts(prompts) {
  const config = await getOrUpdateConfig();
  try {
    debugger

    const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${config.githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          [config.fileName]: {
            content: JSON.stringify(prompts, null, 2)
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    console.log('Prompts saved successfully');
  } catch (error) {
    console.error('Error saving prompts:', error);
    if (error.message.includes('Not Found')) {
      await createGistFile(prompts);
    }
  }
}

// Function to create a new file in the Gist if it doesn't exist
async function createGistFile(prompts) {
  const config = await getOrUpdateConfig();
  try {
    const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${config.githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          [config.fileName]: {
            content: JSON.stringify(prompts, null, 2)
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    console.log('New file created in Gist successfully');
  } catch (error) {
    console.error('Error creating new file in Gist:', error);
  }
}

function createPersistentButton() {
  const button = document.createElement('button');
  button.id = 'persistent-prompt-manager';
  button.innerHTML = '🕒'; // Clock emoji as icon
  button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.8);
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        cursor: pointer;
        transition: all 0.3s;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        z-index: 1000;
        opacity: 0.5;
        pointer-events: none;
    `;
  button.title = 'Prompt Manager';
  document.body.appendChild(button);
  return button;
}

// Function to handle focus and blur events
function handleFocusEvents() {
  const button = document.getElementById('persistent-prompt-manager');
  let activeElement = null;

  function onFocus(event) {
    const element = event.target;
    if (element.tagName.toLowerCase() === 'textarea' ||
      (element.getAttribute('contenteditable') === 'true' && element.classList.contains('ProseMirror'))) {
      activeElement = element;
      button.style.opacity = '1';
      button.style.pointerEvents = 'auto';
    }
  }

  function onBlur() {
    setTimeout(() => {
      if (!document.activeElement ||
        (document.activeElement.tagName.toLowerCase() !== 'textarea' &&
          !(document.activeElement.getAttribute('contenteditable') === 'true' &&
            document.activeElement.classList.contains('ProseMirror')))) {
        activeElement = null;
        button.style.opacity = '0.5';
        button.style.pointerEvents = 'none';
      }
    }, 100);
  }

  document.addEventListener('focus', onFocus, true);
  document.addEventListener('blur', onBlur, true);

  return () => activeElement;
}

function showPromptDialog(prompts, inputElement) {
  const dialog = document.createElement('dialog');
  dialog.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap');

      dialog {
        padding: 16px;
        background: #1e1e1e;
        color: #e0e0e0;
        border-radius: 8px;
        border: none;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        font-family: 'Inter', sans-serif;
        max-width: 500px;
        width: 100%;
      }
      dialog::backdrop {
        background-color: rgba(0, 0, 0, 0.7);
      }
      .prompt-dialog h2 {
        color: #ffffff;
        font-size: 18px;
        margin: 0 0 12px 0;
        font-weight: 500;
      }
      #searchInput {
        width: 100%;
        padding: 8px;
        margin-bottom: 12px;
        background-color: #2d2d2d;
        border: 1px solid #444;
        border-radius: 4px;
        font-size: 14px;
        color: #e0e0e0;
        box-sizing: border-box;
      }
      .prompt-list {
        list-style-type: none;
        padding: 0;
        max-height: 50vh;
        overflow-y: auto;
        margin-bottom: 16px;
      }
      .prompt-item {
        position: relative;
        padding: 8px 10px;
        background: #2b2b27;
        border: 1px solid #373732;
        border-radius: 5px;
        margin-bottom: 5px;
        cursor: pointer;
        transition: background-color 0.3s;
      }
      .prompt-item:hover {
        background-color: #373732;
      }
      .prompt-title {
        font-weight: bold;
        margin-bottom: 4px;
      }
      .prompt-text {
        white-space: pre-wrap;
        word-break: break-word;
        font-family: monospace;
        font-size: 0.9em;
        max-height: 100px;
        overflow-y: auto;
      }
      .prompt-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 5px;
      }
      .action-icon {
        cursor: pointer;
        margin-left: 10px;
        font-size: 1.2em;
      }
      .action-buttons {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 20px;
      }
      .action-buttons button {
        padding: 8px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s, color 0.2s;
      }
      #savePrompt {
        background-color: #4d9cf6;
        color: #ffffff;
      }
      #savePrompt:hover {
        background-color: #3a7dbd;
      }
      #closeDialog {
        background-color: #3a3a3a;
        color: #e0e0e0;
      }
      #closeDialog:hover {
        background-color: #4a4a4a;
      }
      #clearConfig {
        background-color: transparent;
        color: #888;
        font-size: 12px;
        padding: 4px 8px;
        border: 1px solid #888;
      }
      #clearConfig:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }

      /* Scrollbar Styles */
      .prompt-list::-webkit-scrollbar,
      .prompt-text::-webkit-scrollbar {
        width: 10px;
      }
      .prompt-list::-webkit-scrollbar-track,
      .prompt-text::-webkit-scrollbar-track {
        background: #1e1e1e;
      }
      .prompt-list::-webkit-scrollbar-thumb,
      .prompt-text::-webkit-scrollbar-thumb {
        background: #4a4a4a;
        border-radius: 5px;
      }
      .prompt-list::-webkit-scrollbar-thumb:hover,
      .prompt-text::-webkit-scrollbar-thumb:hover {
        background: #555;
      }

      /* For Firefox */
      .prompt-list,
      .prompt-text {
        scrollbar-width: thin;
        scrollbar-color: #4a4a4a #1e1e1e;
      }
    </style>
    <div class="prompt-dialog">
      <h2>Recent Prompts</h2>
      <input type="text" id="searchInput" placeholder="Search prompts...">
      <ul class="prompt-list">
        ${prompts.map((prompt, index) => `
          <li class="prompt-item" data-index="${index}">
            <div class="prompt-title">${escapeHtml(prompt.title)}</div>
            <div class="prompt-text">${escapeHtml(prompt.content)}</div>
            <div class="prompt-actions">
              <span class="action-icon append-icon" title="Append">➕</span>
              <span class="action-icon replace-icon" title="Replace">🔄</span>
              <span class="action-icon delete-icon" title="Delete">🗑️</span>
            </div>
          </li>
        `).join('')}
      </ul>
      <div class="action-buttons">
        <button id="clearConfig">Clear Config</button>
        <div>
          <button id="savePrompt">Save Current</button>
          <button id="closeDialog">Close</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const promptList = dialog.querySelector('.prompt-list');
  const searchInput = dialog.querySelector('#searchInput');

  function filterPrompts(query) {
    const lowercaseQuery = query.toLowerCase();
    promptList.querySelectorAll('.prompt-item').forEach(item => {
      const title = item.querySelector('.prompt-title').textContent.toLowerCase();
      const content = item.querySelector('.prompt-text').textContent.toLowerCase();
      if (title.includes(lowercaseQuery) || content.includes(lowercaseQuery)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  }

  searchInput.addEventListener('input', (e) => {
    filterPrompts(e.target.value);
  });

  promptList.addEventListener('click', (e) => {
    const promptItem = e.target.closest('.prompt-item');
    if (!promptItem) return;

    const index = promptItem.dataset.index;
    const prompt = prompts[index];

    if (e.target.classList.contains('append-icon')) {
      insertPromptText(inputElement, prompt.content, false);
      dialog.close();
    } else if (e.target.classList.contains('replace-icon')) {
      insertPromptText(inputElement, prompt.content, true);
      dialog.close();
    } else if (e.target.classList.contains('delete-icon')) {
      if (confirm('Are you sure you want to delete this prompt?')) {
        prompts.splice(index, 1);
        savePrompts(prompts);
        promptItem.remove();
      }
    }
  });

  dialog.querySelector('#savePrompt').addEventListener('click', async () => {
    let newPromptContent;
    if (inputElement.tagName.toLowerCase() === 'textarea') {
      newPromptContent = inputElement.value.trim();
    } else if (inputElement.getAttribute('contenteditable') === 'true') {
      // Get the HTML content
      let content = inputElement.innerHTML;

      // Replace ProseMirror-specific empty lines
      content = content.replace(/<br class="ProseMirror-trailingBreak">/g, '\n');

      // Continue with general HTML cleaning
      newPromptContent = content
        .replace(/<div>|<p>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/div>|<\/p>/gi, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n') // Replace 3 or more newlines with just 2
        .trim();

      // Decode HTML entities
      const textArea = document.createElement('textarea');
      textArea.innerHTML = newPromptContent;
      newPromptContent = textArea.value;

      // Final cleanup: ensure single newline at the end if content isn't empty
      if (newPromptContent) {
        newPromptContent = newPromptContent.replace(/\n*$/, '\n');
      }
    }

    if (newPromptContent) {
      const title = prompt('Enter a title for this prompt:', 'New Prompt');
      if (title) {
        prompts.unshift({ title, content: newPromptContent });
        prompts.splice(10); // Keep only the 10 most recent prompts
        await savePrompts(prompts);
        dialog.close();
        showPromptDialog(prompts, inputElement); // Refresh the dialog
      }
    }
  });

  dialog.querySelector('#closeDialog').addEventListener('click', () => {
    dialog.close();
  });

  dialog.querySelector('#clearConfig').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the Prompt Manager configuration?')) {
      clearConfig();
      dialog.close();
    }
  });

  dialog.addEventListener('close', () => {
    dialog.remove();
  });

  dialog.showModal();
}

function insertPromptText(inputElement, text, replace = false) {
  if (inputElement.tagName.toLowerCase() === 'textarea') {
    if (replace) {
      inputElement.value = text;
    } else {
      inputElement.value += (inputElement.value ? '\n' : '') + text;
    }
  } else if (inputElement.getAttribute('contenteditable') === 'true') {
    if (replace) {
      inputElement.innerHTML = '';
    }
    // Create a new div for each line of the text
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      const p = document.createElement('p');
      p.textContent = line;
      inputElement.appendChild(p);
    });
  }
  // Trigger input event to notify any listeners (like character count)
  inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Add a button to clear the configuration
function addClearConfigButton() {
  const button = document.createElement('button');
  button.textContent = 'Clear Prompt Manager Config';
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    padding: 10px;
    background-color: #f44336;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  `;
  button.addEventListener('click', clearConfig);
  document.body.appendChild(button);
}

// Main setup function
function setupPromptManager() {
  const button = createPersistentButton();
  const getActiveElement = handleFocusEvents();

  button.addEventListener('click', async () => {
    const activeElement = getActiveElement();
    if (activeElement) {
      try {
        const prompts = await fetchPrompts();
        showPromptDialog(prompts, activeElement);
      } catch (error) {
        console.error('Error setting up Prompt Manager:', error);
        alert('Error setting up Prompt Manager. Please check your configuration and try again.');
      }
    }
  });
}

(function () {
  'use strict';

  // Initialize everything when the page loads
  if (document.readyState === 'complete') {
    setupPromptManager();
  } else {
    window.addEventListener('load', setupPromptManager);
  }
})();