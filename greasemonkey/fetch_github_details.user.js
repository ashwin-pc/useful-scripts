// ==UserScript==
// @name         GitHub Details
// @namespace    http://tampermonkey.net/
// @version      2024-07-11
// @description  Fetch and display detailed information for GitHub issues and pull requests
// @author       You
// @match        https://github.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function getConfig() {
        return {
            githubToken: localStorage.getItem('githubToken')
        };
    }

    function setConfig(config) {
        localStorage.setItem('githubToken', config.githubToken);
    }

    function createTokenDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'Box Box--overlay d-flex flex-column anim-fade-in fast';
        dialog.style.position = 'fixed';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.zIndex = '100';
        dialog.style.maxWidth = '450px';
        dialog.style.width = '90%';

        dialog.innerHTML = `
            <div class="Box-header">
                <h3 class="Box-title">GitHub Token Required</h3>
            </div>
            <div class="Box-body">
                <p class="mb-2">Please enter your GitHub Personal Access Token:</p>
                <input type="password" id="tokenInput" class="form-control width-full mb-2" required>
                <div class="d-flex flex-justify-end">
                    <button id="cancelButton" class="btn mr-2">Cancel</button>
                    <button id="saveButton" class="btn btn-primary">Save</button>
                </div>
            </div>
        `;

        return dialog;
    }

    function promptForToken() {
        return new Promise((resolve) => {
            const dialog = createTokenDialog();
            const backdrop = document.createElement('div');
            backdrop.className = 'bg-gray-dark';
            backdrop.style.position = 'fixed';
            backdrop.style.top = '0';
            backdrop.style.right = '0';
            backdrop.style.bottom = '0';
            backdrop.style.left = '0';
            backdrop.style.zIndex = '99';
            backdrop.style.opacity = '0.5';

            document.body.appendChild(backdrop);
            document.body.appendChild(dialog);

            const saveButton = dialog.querySelector('#saveButton');
            const cancelButton = dialog.querySelector('#cancelButton');
            const tokenInput = dialog.querySelector('#tokenInput');

            function closeDialog() {
                document.body.removeChild(dialog);
                document.body.removeChild(backdrop);
            }

            saveButton.addEventListener('click', () => {
                const token = tokenInput.value.trim();
                if (token) {
                    closeDialog();
                    resolve(token);
                } else {
                    alert('Please enter a valid token.');
                }
            });

            cancelButton.addEventListener('click', () => {
                closeDialog();
                resolve(null);
            });

            tokenInput.focus();
        });
    }

    async function getOrUpdateConfig() {
        let config = getConfig();
        if (!config.githubToken) {
            const token = await promptForToken();
            if (token) {
                config.githubToken = token;
                setConfig(config);
            } else {
                throw new Error('GitHub token is required');
            }
        }
        return config;
    }

    function clearConfig() {
        localStorage.removeItem('githubToken');
        alert('GitHub token has been cleared. You will be prompted for a new token on the next operation.');
    }

    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .arc-boost-button.loading {
                color: transparent;
            }

            .arc-boost-button.loading::after {
                content: '';
                position: absolute;
                width: 16px;
                height: 16px;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                margin: auto;
                border: 2px solid transparent;
                border-top-color: white;
                border-radius: 50%;
                animation: button-loading-spinner 1s ease infinite;
            }

            @keyframes button-loading-spinner {
                from { transform: rotate(0turn); }
                to { transform: rotate(1turn); }
            }

            #arc-boost-details-dialog {
                padding: 20px;
                border: 1px solid rgb(63, 117, 46);
                border-radius: 8px;
                max-width: 80%;
                max-height: 80vh;
            }

            #arc-boost-details-dialog::backdrop {
                background-color: rgb(0 0 0 / 75%);
            }

            #arc-boost-details-dialog > h2 {
                font-size: 1rem !important;
                padding-bottom: 20px;
            }

            #arc-boost-details-content {
                white-space: pre-wrap;
                max-height: 60vh;
            }

            .arc-dialog-actions {
                padding-top: 10px;
            }

            .arc-boost-button {
                margin-left: 8px;
            }

            .arc-boost-copy-button {
                margin-right: 8px;
            }

            #arc-clear-token-button {
                opacity: 0.6;
                transition: opacity 0.3s ease;
            }

            #arc-clear-token-button:hover {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }

    function createDialog() {
        const dialog = document.createElement('dialog');
        dialog.id = 'arc-boost-details-dialog';
        dialog.className = 'markdown-body';
        dialog.innerHTML = `
            <h2 id="arc-boost-dialog-title">Details</h2>
            <pre id="arc-boost-details-content"></pre>
            <div class="arc-dialog-actions">
              <button id="arc-boost-copy-button" class="arc-boost-copy-button Button--primary Button--small Button">Copy to Clipboard</button>
              <button id="arc-boost-close-button" class="Button--secondary Button--small Button">Close</button>
            </div>
        `;
        document.body.appendChild(dialog);

        const closeBtn = dialog.querySelector('#arc-boost-close-button');
        closeBtn.onclick = function () {
            dialog.close();
        }

        const copyBtn = dialog.querySelector('#arc-boost-copy-button');
        copyBtn.onclick = function () {
            const content = document.getElementById('arc-boost-details-content').textContent;
            navigator.clipboard.writeText(content).then(() => {
                alert('Content copied to clipboard!');
            }, () => {
                alert('Failed to copy content. Please try again.');
            });
        }

        return dialog;
    }

    function addButton(text, onclick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.onclick = onclick;
        button.className = 'arc-boost-button Button--secondary Button--small Button';
        button.id = 'arc-boost-fetch-button';

        const possibleLocations = [
            '.pr-review-tools',
            '.gh-header-actions',
            '.gh-header-title',
            '.pagehead-actions',
            '.gh-header'
        ];

        for (const selector of possibleLocations) {
            const location = document.querySelector(selector);
            if (location) {
                location.appendChild(button);
                console.log('Button added to', selector);
                return button;
            }
        }

        document.body.appendChild(button);
        console.log('Button added to body');
        return button;
    }

    function getContext() {
        const [, owner, repo, type, number] = window.location.pathname.split('/');
        return { owner, repo, type, number };
    }

    async function makeGitHubRequest(url, options = {}) {
        const config = await getOrUpdateConfig();
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Authorization': `token ${config.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return response.json();
            } else {
                return response.text();
            }
        } catch (error) {
            console.error('Error in makeGitHubRequest:', error);
            throw error;
        }
    }

    async function getPrInfo(owner, repo, prNumber) {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
        const prInfo = await makeGitHubRequest(apiUrl);
        return {
            title: prInfo.title,
            body: prInfo.body,
            baseBranch: prInfo.base.ref,
            owner,
            repo,
            prNumber
        };
    }

    async function getIssueInfo(owner, repo, issueNumber) {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
        const issueInfo = await makeGitHubRequest(apiUrl);

        // Fetch reactions for the issue
        const reactionsUrl = `${apiUrl}/reactions`;
        const reactions = await makeGitHubRequest(reactionsUrl);

        return {
            title: issueInfo.title,
            body: issueInfo.body,
            state: issueInfo.state,
            labels: issueInfo.labels,
            assignees: issueInfo.assignees,
            createdAt: issueInfo.created_at,
            updatedAt: issueInfo.updated_at,
            closedAt: issueInfo.closed_at,
            author: issueInfo.user.login,
            reactions: summarizeReactions(reactions),
            owner,
            repo,
            issueNumber
        };
    }

    async function getFileContent(owner, repo, filePath, branch) {
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
        try {
            const response = await makeGitHubRequest(url);
            return atob(response.content);
        } catch (error) {
            if (error.message.includes('status 404')) {
                return null; // File not found
            }
            throw error;
        }
    }

    async function getPrDiff(owner, repo, prNumber) {
        const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
        const response = await makeGitHubRequest(url, {
            headers: {
                'Accept': 'application/vnd.github.v3.diff'
            }
        });
        return response; // This will already be text due to the content type
    }


    async function parseDiff(diff) {
        const fileRegex = /^diff --git a\/(.*) b\/(.*)/gm;
        const files = [];
        let match;
        while ((match = fileRegex.exec(diff)) !== null) {
            files.push(match[1]);
        }
        return { files, fullDiff: diff };
    }

    async function getIssueComments(owner, repo, issueNumber) {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
        const comments = await makeGitHubRequest(apiUrl)

        // Fetch reactions for each comment
        const commentsWithReactions = await Promise.all(comments.map(async comment => {
            const reactionsUrl = `${comment.url}/reactions`;
            const reactions = await makeGitHubRequest(reactionsUrl);
            return {
                author: comment.user.login,
                body: comment.body,
                createdAt: comment.created_at,
                updatedAt: comment.updated_at,
                reactions: summarizeReactions(reactions)
            };
        }));

        return commentsWithReactions;
    }

    function summarizeReactions(reactions) {
        const summary = {
            '+1': 0,
            '-1': 0,
            'laugh': 0,
            'confused': 0,
            'heart': 0,
            'hooray': 0,
            'rocket': 0,
            'eyes': 0
        };

        reactions.forEach(reaction => {
            if (summary.hasOwnProperty(reaction.content)) {
                summary[reaction.content]++;
            }
        });

        return summary;
    }

    function formatReactions(reactions) {
        const emojiMap = {
            '+1': '👍',
            '-1': '👎',
            'laugh': '😄',
            'confused': '😕',
            'heart': '❤️',
            'hooray': '🎉',
            'rocket': '🚀',
            'eyes': '👀'
        };

        return Object.entries(reactions)
            .filter(([, count]) => count > 0)
            .map(([reaction, count]) => `${emojiMap[reaction]} ${count}`)
            .join(' ');
    }

    async function fetchDetails() {
        const button = document.getElementById('arc-boost-fetch-button');
        button.classList.add('loading');
        button.disabled = true;

        try {
            const { owner, repo, type, number } = getContext();
            let concatenatedContent = '';
            let dialogTitle = '';

            if (type === 'pull') {
                dialogTitle = 'Pull Request Details';
                const prInfo = await getPrInfo(owner, repo, number);
                const diffContent = await getPrDiff(owner, repo, number);
                const { files, fullDiff } = await parseDiff(diffContent);

                concatenatedContent += `Pull Request #${number}\n`;
                concatenatedContent += `Title: ${prInfo.title}\n\n`;
                concatenatedContent += `Description:\n${prInfo.body}\n\n`;
                concatenatedContent += `Base Branch: ${prInfo.baseBranch}\n\n`;
                concatenatedContent += `Full diff for PR #${number}:\n\n${fullDiff}\n\n`;
                concatenatedContent += `Files changed in PR #${number}:\n\n`;

                for (const file of files) {
                    console.log(`Fetching: ${file}`);
                    const content = await getFileContent(owner, repo, file, prInfo.baseBranch);
                    if (content === null) {
                        concatenatedContent += `\n\n--- ${file} ---\n\nFile not found in base branch. This might be a new file added in the PR.\n`;
                    } else {
                        concatenatedContent += `\n\n--- ${file} ---\n\n${content}`;
                    }
                }
            } else if (type === 'issues') {
                dialogTitle = 'Issue Details';
                const issueInfo = await getIssueInfo(owner, repo, number);
                const comments = await getIssueComments(owner, repo, number);

                concatenatedContent += `Issue #${number}\n`;
                concatenatedContent += `Title: ${issueInfo.title}\n\n`;
                concatenatedContent += `Description:\n${issueInfo.body}\n\n`;
                concatenatedContent += `State: ${issueInfo.state}\n`;
                concatenatedContent += `Labels: ${issueInfo.labels.map(label => label.name).join(', ')}\n`;
                concatenatedContent += `Assignees: ${issueInfo.assignees.map(assignee => assignee.login).join(', ')}\n`;
                concatenatedContent += `Author: ${issueInfo.author}\n`;
                concatenatedContent += `Created: ${issueInfo.createdAt}\n`;
                concatenatedContent += `Updated: ${issueInfo.updatedAt}\n`;
                if (issueInfo.closedAt) {
                    concatenatedContent += `Closed: ${issueInfo.closedAt}\n`;
                }
                concatenatedContent += `Reactions: ${formatReactions(issueInfo.reactions)}\n`;
                concatenatedContent += `\nComments:\n\n`;

                for (const comment of comments) {
                    concatenatedContent += `--- Comment by ${comment.author} on ${comment.createdAt} ---\n`;
                    concatenatedContent += `${comment.body}\n`;
                    concatenatedContent += `Reactions: ${formatReactions(comment.reactions)}\n\n`;
                }
            } else {
                throw new Error('Unsupported page type');
            }

            showDialog(concatenatedContent, dialogTitle);
        } catch (error) {
            console.error('Error:', error);
            alert('Error fetching details. Check console for more information.');
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    function showDialog(content, title) {
        const dialog = document.getElementById('arc-boost-details-dialog');
        const contentDiv = document.getElementById('arc-boost-details-content');
        const titleElement = document.getElementById('arc-boost-dialog-title');
        if (!dialog || !contentDiv || !titleElement) {
            console.error('Dialog elements not found');
            return;
        }
        titleElement.textContent = title;
        contentDiv.textContent = content;
        dialog.showModal();
    }

    // Main setup function
    function initScript() {
        addStyles();
        createDialog();
        addButton('Fetch Details', fetchDetails);

        // Add a less obtrusive clear config button
        const clearButton = document.createElement('button');
        clearButton.textContent = '🔑';
        clearButton.title = 'Clear GitHub Token';
        clearButton.id = 'arc-clear-token-button';
        clearButton.className = 'btn btn-sm btn-invisible';
        clearButton.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 100;
            font-size: 12px;
            padding: 4px 8px;
        `;
        clearButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the GitHub token?')) {
                clearConfig();
            }
        });
        document.body.appendChild(clearButton);
    }

    // Run the script
    if (document.readyState === 'complete') {
        initScript();
    } else {
        window.addEventListener('load', initScript);
    }
})();