// ==UserScript==
// @name         GitHub PR Redirect
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  Add a button to GitHub PR list page to redirect to a custom URL
// @match        https://github.com/*/*/pulls
// @match        https://github.com/*/*/pulls?*
// @grant        none
// @updateURL    https://github.com/ashwin-pc/useful-scripts/raw/main/userscripts/github_prs_redirect.user.js
// @downloadURL  https://github.com/ashwin-pc/useful-scripts/raw/main/userscripts/github_prs_redirect.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Function to get the redirect URL
    function getRedirectUrl() {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const org = pathParts[0];
        const repo = pathParts[1];
        const searchQuery = document.querySelector('.subnav-search-input')?.value || '';
        const query = `repo:${org}/${repo} ${searchQuery}`;
        const encodedQuery = encodeURIComponent(query);
        return `https://master.d2nh42yr3e6msv.amplifyapp.com/?q=${encodedQuery}`;
    }

    // Function to handle button click
    function handleButtonClick(event) {
        event.preventDefault();
        const redirectUrl = getRedirectUrl();
        window.location.href = redirectUrl;
    }

    // Function to add the redirect button
    function addRedirectButton() {
        const button = document.createElement('button');
        button.id = 'custom-search-button';
        button.type = 'button';
        button.className = 'Button Button--secondary Button--medium AppHeader-button color-fg-muted';
        button.style.marginLeft = '8px';
        button.setAttribute('aria-label', 'Custom Search');
        button.innerHTML = `
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-search">
                <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"></path>
            </svg>`;
        button.addEventListener('click', handleButtonClick);

        const actionsContainer = document.querySelector('.AppHeader-actions');
        if (actionsContainer) {
            actionsContainer.insertBefore(button, actionsContainer.firstChild);
        }
    }

    // Initialize the script
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        addRedirectButton();
    } else {
        window.addEventListener('DOMContentLoaded', addRedirectButton);
    }

})();
