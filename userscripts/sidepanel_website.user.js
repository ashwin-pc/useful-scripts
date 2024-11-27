// ==UserScript==
// @name         Floating Website Sidepanel
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a floating button that expands into a sidepanel containing a website of your choice
// @author       You
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    // Prevent script from running in iframes
    if (window !== window.top) return;

    try {
        // Configuration and state variables
        const DEFAULT_WEBSITE = 'https://example.com';
        const DRAG_THRESHOLD = 200; // ms to determine if it's a drag or click
        let currentWebsite = GM_getValue('sidepanel_website', DEFAULT_WEBSITE);
        let isPanelOpen = false;
        let dragStartTime = 0;

        // Initialize drag state
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset;
        let yOffset;

        // Function to ensure coordinates are within viewport
        function getValidPosition(x, y) {
            const buttonSize = 32;
            const padding = 10;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            return {
                x: Math.min(Math.max(x, padding), viewportWidth - buttonSize - padding),
                y: Math.min(Math.max(y, padding), viewportHeight - buttonSize - padding)
            };
        }

        // Load saved position with validation and fallback
        try {
            const savedPos = getValidPosition(
                GM_getValue('button_x', 20),
                GM_getValue('button_y', 20)
            );
            xOffset = savedPos.x;
            yOffset = savedPos.y;
        } catch (error) {
            console.warn('Failed to load saved position:', error);
            xOffset = 20;
            yOffset = 20;
        }

        // Create and append styles
        const styles = document.createElement('style');
        styles.textContent = `
                .floating-button {
                    width: 32px;
                    height: 32px;
                    background-color: #2d3748;
                    border-radius: 16px;
                    cursor: move;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #e2e8f0;
                    font-size: 18px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    transition: transform 0.2s ease;
                    user-select: none;
                    position: fixed;
                }

                .floating-button:hover {
                    transform: scale(1.1);
                    background-color: #4a5568;
                }

                .side-panel {
                    position: fixed;
                    top: 0;
                    right: -400px;
                    width: 400px;
                    height: 100vh;
                    background-color: white;
                    box-shadow: -2px 0 5px rgba(0,0,0,0.2);
                    z-index: 9998;
                    transition: right 0.3s ease-in-out;
                }

                .side-panel.open {
                    right: 0;
                }

                .panel-header {
                    background-color: #1a202c;
                    display: flex;
                    align-items: center;
                    color: white;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }

                .panel-header input {
                    flex-grow: 1;
                    margin: 0 12px;
                    padding: 8px 12px;
                    border: none;
                    background-color: rgba(255,255,255,0.1);
                    color: white;
                    font-size: 14px;
                    transition: all 0.2s ease;
                }

                .panel-header input:focus {
                    outline: none;
                    background-color: rgba(255,255,255,0.15);
                }

                .panel-header input::placeholder {
                    color: #718096;
                }

                .close-button {
                    cursor: pointer;
                    padding: 0 20px;
                    color: #a0aec0;
                    font-size: 20px;
                    transition: all 0.2s ease;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transform: translateY(-3px);
                }

                .close-button:hover {
                    background-color: rgba(255,255,255,0.1);
                    color: white;
                }
            `;
        document.head.appendChild(styles);

        // Create floating button
        const button = document.createElement('div');
        button.className = 'floating-button';
        button.innerHTML = '⋮';
        button.title = 'Double-click to reset position';
        button.style.left = xOffset + 'px';
        button.style.top = yOffset + 'px';

        // Create side panel
        const panel = document.createElement('div');
        panel.className = 'side-panel';

        // Create panel header
        const header = document.createElement('div');
        header.className = 'panel-header';

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.value = currentWebsite;
        urlInput.placeholder = 'Enter website URL';

        const closeButton = document.createElement('div');
        closeButton.className = 'close-button';
        closeButton.textContent = '×';

        header.appendChild(urlInput);
        header.appendChild(closeButton);

        // Create iframe with security attributes
        const iframe = document.createElement('iframe');
        iframe.src = currentWebsite;
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups');
        iframe.setAttribute('referrerpolicy', 'no-referrer');

        // Add iframe wrapper with proper height
        const iframeWrapper = document.createElement('div');
        iframeWrapper.style.cssText = 'width: 100%; height: calc(100% - 30px); position: relative;';
        iframe.style.cssText = 'width: 100%; height: 100%; border: none; position: absolute; top: 0; left: 0;';
        iframeWrapper.appendChild(iframe);

        // Assemble panel
        panel.appendChild(header);
        panel.appendChild(iframeWrapper);

        // Add elements to page
        document.body.appendChild(button);
        document.body.appendChild(panel);

        // Reset position functionality
        function resetButtonPosition() {
            const defaultPos = getValidPosition(20, 20);
            xOffset = defaultPos.x;
            yOffset = defaultPos.y;
            button.style.left = xOffset + 'px';
            button.style.top = yOffset + 'px';
            try {
                GM_setValue('button_x', xOffset);
                GM_setValue('button_y', yOffset);
            } catch (error) {
                console.warn('Failed to save reset position:', error);
            }
        }

        // Drag functionality
        function dragStart(e) {
            dragStartTime = Date.now();
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === button) {
                isDragging = true;
                button.style.transition = 'none';
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                const validPos = getValidPosition(currentX, currentY);
                currentX = validPos.x;
                currentY = validPos.y;

                xOffset = currentX;
                yOffset = currentY;

                requestAnimationFrame(() => {
                    button.style.left = currentX + 'px';
                    button.style.top = currentY + 'px';
                });
            }
        }

        function dragEnd(e) {
            if (isDragging) {
                const dragEndTime = Date.now();
                const dragDuration = dragEndTime - dragStartTime;

                initialX = currentX;
                initialY = currentY;
                isDragging = false;
                button.style.transition = 'transform 0.2s ease';

                try {
                    GM_setValue('button_x', currentX);
                    GM_setValue('button_y', currentY);
                } catch (error) {
                    console.warn('Failed to save position:', error);
                }

                if (dragDuration < DRAG_THRESHOLD) {
                    isPanelOpen = !isPanelOpen;
                    panel.classList.toggle('open');
                }
            }
        }

        // Event listeners
        button.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        button.addEventListener('dblclick', resetButtonPosition);

        // URL input handler
        urlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                let url = urlInput.value.trim();
                try {
                    if (!url.match(/^https?:\/\//i)) {
                        url = 'https://' + url;
                    }
                    const urlObject = new URL(url);

                    iframe.src = url;
                    currentWebsite = url;
                    GM_setValue('sidepanel_website', url);
                } catch (error) {
                    console.warn('Invalid URL:', error);
                    urlInput.value = currentWebsite;
                    urlInput.style.backgroundColor = 'rgba(255,0,0,0.1)';
                    setTimeout(() => {
                        urlInput.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    }, 1000);
                }
            }
        });

        // Close button handler
        closeButton.addEventListener('click', function() {
            panel.classList.remove('open');
            isPanelOpen = false;
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            const validPos = getValidPosition(xOffset, yOffset);
            xOffset = validPos.x;
            yOffset = validPos.y;
            button.style.left = xOffset + 'px';
            button.style.top = yOffset + 'px';
            try {
                GM_setValue('button_x', xOffset);
                GM_setValue('button_y', yOffset);
            } catch (error) {
                console.warn('Failed to save position after resize:', error);
            }
        });

    } catch (error) {
        console.error('Failed to initialize sidepanel:', error);
    }
})();
