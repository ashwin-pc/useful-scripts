// ==UserScript==
// @name         OpenSearch Dashboard URL Parameter Monitor
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Monitor and display OpenSearch Dashboard URL parameters with state differences
// @author       Ashwin Pc
// @match        http://localhost:5601/*
// @match        https://localhost:5601/*
// @require      https://cdn.jsdelivr.net/npm/rison@0.1.1/js/rison.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/deep-diff/1.0.2/deep-diff.min.js
// @grant        none
// @updateURL    https://raw.githubusercontent.com/ashwin-pc/useful-scripts/main/userscripts/osd_url_state_monitor.user.js
// @downloadURL  https://raw.githubusercontent.com/ashwin-pc/useful-scripts/main/userscripts/osd_url_state_monitor.user.js
// ==/UserScript==

(function() {
    'use strict';

    let previousState = null;

    function parseUrlParams(url) {
        const urlObj = new URL(url);
        const hashParams = new URLSearchParams(urlObj.hash.substring(1));

        try {
            return {
                _a: hashParams.get('_a') ? rison.decode(hashParams.get('_a')) : null,
                _g: hashParams.get('_g') ? rison.decode(hashParams.get('_g')) : null,
                _q: hashParams.get('_q') ? rison.decode(hashParams.get('_q')) : null
            };
        } catch (e) {
            console.error('Error decoding RISON:', e);
            return {
                _a: hashParams.get('_a'),
                _g: hashParams.get('_g'),
                _q: hashParams.get('_q')
            };
        }
    }

    function formatDiff(diff) {
        if (!diff) return 'No changes';

        return diff.map(change => {
            const path = change.path.join('.');
            switch (change.kind) {
                case 'N':
                    return `Added ${path}: ${JSON.stringify(change.rhs)}`;
                case 'D':
                    return `Deleted ${path}: ${JSON.stringify(change.lhs)}`;
                case 'E':
                    return `Changed ${path}: ${JSON.stringify(change.lhs)} → ${JSON.stringify(change.rhs)}`;
                case 'A':
                    return `Array changed at ${path}[${change.index}]: ${JSON.stringify(change.item)}`;
                default:
                    return `Unknown change type in ${path}`;
            }
        });
    }

    function getTimestamp() {
        const now = new Date();
        return now.toLocaleTimeString();
    }

    function logUrlParams() {
        const currentState = parseUrlParams(window.location.href);
        const differences = previousState ? DeepDiff.diff(previousState, currentState) : null;

        console.groupCollapsed(`[${getTimestamp()}] URL State Change`);

        // Log current state
        console.group('Current State');
        console.log('_a:', currentState._a);
        console.log('_g:', currentState._g);
        console.log('_q:', currentState._q);
        console.groupEnd();

        // Log differences if there was a previous state
        if (previousState) {
            console.group('Changes from Previous State');
            const formattedDiffs = formatDiff(differences);
            if (Array.isArray(formattedDiffs)) {
                formattedDiffs.forEach(diff => console.log(diff));
            } else {
                console.log(formattedDiffs);
            }
            console.groupEnd();
        }

        console.groupEnd();

        // Update previous state
        previousState = JSON.parse(JSON.stringify(currentState)); // Deep clone
    }

    // Initial log
    logUrlParams();

    // Watch for URL changes
    let lastUrl = window.location.href;

    // Using both hashchange and popstate for better coverage
    window.addEventListener('hashchange', function() {
        logUrlParams();
    });

    // For navigation changes that don't trigger hashchange
    window.addEventListener('popstate', function() {
        logUrlParams();
    });

    // Additional check using MutationObserver for SPA-style updates
    const observer = new MutationObserver(function() {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            logUrlParams();
        }
    });

    observer.observe(document, {
        subtree: true,
        childList: true
    });
})();
