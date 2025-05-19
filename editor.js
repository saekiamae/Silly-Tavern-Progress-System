

SillyTavern.PS.createEditableJSWindow = (parentElement, initialJS, onSaveCallback) => {
    if (typeof $ === 'undefined') {
        console.error("jQuery is not loaded. Please include jQuery before using this script.");
        return;
    }

    const CM_VERSION = "5.65.16"; // Use a specific version for stability
    const CM_BASE_URL = `https://cdnjs.cloudflare.com/ajax/libs/codemirror/${CM_VERSION}/`;

    let codemirrorInstance = null;
    let windowId = 'editable-js-window-' + Date.now(); // Unique ID for multiple windows

    // --- Helper function to load scripts/css ---
    function loadResource(url, type) {
        return new Promise((resolve, reject) => {
            let element;
            if (type === 'script') {
                element = document.createElement('script');
                element.src = url;
                element.onload = resolve;
                element.onerror = () => reject(`Failed to load script: ${url}`);
            } else if (type === 'css') {
                element = document.createElement('link');
                element.rel = 'stylesheet';
                element.href = url;
                element.onload = resolve;
                element.onerror = () => reject(`Failed to load CSS: ${url}`);
            }
            if (element) {
                document.head.appendChild(element);
            } else {
                reject(`Invalid resource type: ${type}`);
            }
        });
    }

    // --- Function to ensure CodeMirror is loaded ---
    function ensureCodeMirror() {
        if (typeof CodeMirror !== 'undefined') {
            return Promise.resolve();
        }
        console.log("CodeMirror not found. Loading...");
        return Promise.all([
            loadResource(CM_BASE_URL + 'codemirror.min.css', 'css'),
            loadResource(CM_BASE_URL + 'theme/material-darker.min.css', 'css'), // Example theme
            loadResource(CM_BASE_URL + 'codemirror.min.js', 'script')
        ]).then(() => {
            return loadResource(CM_BASE_URL + 'mode/javascript/javascript.min.js', 'script');
        }).then(() => {
            console.log("CodeMirror and JavaScript mode loaded successfully.");
        }).catch(error => {
            console.error("Error loading CodeMirror:", error);
            throw error;
        });
    }

    // --- CSS for the window (injected) ---
    function injectCSS() {
        if (document.getElementById('editable-js-window-styles')) {
            return; // Styles already injected
        }
        const css = `
            .editable-js-window {
                position: absolute;
                top: 50px;
                left: 50px;
                width: 500px;
                min-width: 250px; /* Minimum resizable width */
                height: 400px;
                min-height: 200px; /* Minimum resizable height */
                background-color: #263238;
                border: 1px solid #546e7a;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                font-family: sans-serif;
                border-radius: 5px;
                overflow: hidden; /* Crucial for containing CM and its scrollbars */
            }
            .editable-js-window-titlebar {
                background-color: #1e272c;
                color: #b0bec5;
                padding: 8px 12px;
                cursor: move;
                font-weight: bold;
                user-select: none;
                border-bottom: 1px solid #546e7a;
                flex-shrink: 0; /* Prevent titlebar from shrinking */
            }
            .editable-js-window-content {
                flex-grow: 1; /* Allow content to expand */
                position: relative; /* For CodeMirror positioning */
                overflow: hidden; /* Ensure CM handles its own scrolling, not this div */
            }
            .editable-js-window .CodeMirror {
                height: 100% !important; /* Make CM fill its container */
                font-size: 14px;
                border: none;
            }
            .editable-js-window-footer {
                padding: 10px;
                background-color: #1e272c;
                text-align: right;
                border-top: 1px solid #546e7a;
                flex-shrink: 0; /* Prevent footer from shrinking */
            }
            .editable-js-window-save-btn {
                padding: 8px 15px;
                background-color: #00796b;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-weight: bold;
            }
            .editable-js-window-save-btn:hover {
                background-color: #004d40;
            }

            /* Resize Handles */
            .editable-js-window-resize-handle {
                position: absolute;
                background: transparent; /* Make them invisible but grabbable */
                z-index: 5; /* Above content, below window border potentially if border is thick */
            }
            .ew-handle { /* East-West (right) */
                width: 10px; /* Grabbable area */
                height: calc(100% - 10px); /* Avoid overlapping corner handle */
                top: 0;
                right: -5px; /* Half outside */
                cursor: ew-resize;
            }
            .ns-handle { /* North-South (bottom) */
                width: calc(100% - 10px); /* Avoid overlapping corner handle */
                height: 10px; /* Grabbable area */
                left: 0;
                bottom: -5px; /* Half outside */
                cursor: ns-resize;
            }
            .nwse-handle { /* Corner (bottom-right) */
                width: 12px;
                height: 12px;
                right: -6px;
                bottom: -6px;
                cursor: nwse-resize;
                z-index: 6; /* Higher z-index for corner */
            }
        `;
        const styleElement = document.createElement('style');
        styleElement.id = 'editable-js-window-styles';
        styleElement.type = 'text/css';
        styleElement.appendChild(document.createTextNode(css));
        document.head.appendChild(styleElement);
    }

    // --- Create and display the window ---
    function createWindow() {
        injectCSS();

        const $window = $('<div>', { class: 'editable-js-window', id: windowId })
            .css({
                top: (parentElement.offset()?.top || 0) + 30 + 'px',
                left: (parentElement.offset()?.left || 0) + 30 + 'px'
            });

        const $titleBar = $('<div>', { class: 'editable-js-window-titlebar', text: 'JavaScript Editor' });
        const $content = $('<div>', { class: 'editable-js-window-content' });
        const $textarea = $('<textarea>'); // CodeMirror replaces this
        const $footer = $('<div>', { class: 'editable-js-window-footer' });
        const $saveButton = $('<button>', { class: 'editable-js-window-save-btn', text: 'Save' });

        $content.append($textarea);
        $footer.append($saveButton);
        $window.append($titleBar, $content, $footer);

        // --- Resize Handles ---
        const $handleR = $('<div>', { class: 'editable-js-window-resize-handle ew-handle' }).data('type', 'ew');
        const $handleB = $('<div>', { class: 'editable-js-window-resize-handle ns-handle' }).data('type', 'ns');
        const $handleBR = $('<div>', { class: 'editable-js-window-resize-handle nwse-handle' }).data('type', 'nwse');
        $window.append($handleR, $handleB, $handleBR);

        parentElement.append($window);

        // --- Draggability ---
        let isDragging = false;
        let dragOffsetX, dragOffsetY;
        $titleBar.on('mousedown.editableWindow', function(e) {
            // Ensure mousedown on title bar doesn't happen when clicking on a scrollbar of CodeMirror if visible near title
            if (e.target !== this) return;
            isDragging = true;
            dragOffsetX = e.clientX - $window.offset().left;
            dragOffsetY = e.clientY - $window.offset().top;
            $('body').css('user-select', 'none'); // Prevent text selection globally
        });

        // --- Resizability ---
        let isResizing = false;
        let resizeType = '';
        let resizeStartX, resizeStartY, initialWidth, initialHeight;
        const minWidth = parseInt($window.css('min-width'), 10) || 200;
        const minHeight = parseInt($window.css('min-height'), 10) || 150;

        $window.on('mousedown.editableWindow', '.editable-js-window-resize-handle', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent dragging window when starting resize

            isResizing = true;
            resizeType = $(this).data('type');
            resizeStartX = e.clientX;
            resizeStartY = e.clientY;
            initialWidth = $window.width();
            initialHeight = $window.height();
            $('body').css('cursor', $(this).css('cursor')); // Set body cursor
            $window.css('user-select', 'none'); // Prevent selection in window during resize
        });

        // Global mouse move and up for drag and resize (namespaced for safety)
        $(document).on('mousemove.editableWindow-' + windowId, function(e) {
            if (isDragging) {
                $window.css({
                    left: e.clientX - dragOffsetX,
                    top: e.clientY - dragOffsetY
                });
            } else if (isResizing) {
                let newWidth = initialWidth;
                let newHeight = initialHeight;
                const deltaX = e.clientX - resizeStartX;
                const deltaY = e.clientY - resizeStartY;

                if (resizeType.includes('ew') || resizeType.includes('nwse')) { // Right or Bottom-Right
                    newWidth = Math.max(minWidth, initialWidth + deltaX);
                }
                if (resizeType.includes('ns') || resizeType.includes('nwse')) { // Bottom or Bottom-Right
                    newHeight = Math.max(minHeight, initialHeight + deltaY);
                }

                $window.css({ width: newWidth + 'px', height: newHeight + 'px' });

                if (codemirrorInstance) {
                    // Refresh CodeMirror to adjust to new size
                    // Use a slight timeout to ensure DOM has updated if performance is an issue
                    // but usually direct refresh is fine.
                    codemirrorInstance.refresh();
                }
            }
        }).on('mouseup.editableWindow-' + windowId, function() {
            if (isDragging) {
                isDragging = false;
                $('body').css('user-select', '');
            }
            if (isResizing) {
                isResizing = false;
                $('body').css('cursor', '');
                $window.css('user-select', '');
                if (codemirrorInstance) {
                    codemirrorInstance.refresh(); // Final refresh
                }
            }
        });

        // Initialize CodeMirror
        codemirrorInstance = CodeMirror.fromTextArea($textarea[0], {
            value: initialJS || '',
            mode: 'javascript',
            theme: 'material-darker',
            lineNumbers: true,
            indentUnit: 4,
            matchBrackets: true,
            autoCloseBrackets: true,
            styleActiveLine: true,
            gutters: ["CodeMirror-linenumbers"] // Removed linting for simplicity
        });

        // Set value after CM is fully initialized to ensure it's picked up
        codemirrorInstance.setValue(initialJS || '');
        // Refresh to ensure proper layout, especially after DOM manipulations or if initially hidden
        setTimeout(() => {
            if (codemirrorInstance) codemirrorInstance.refresh();
        }, 100);


        $saveButton.on('click', function() {
            if (codemirrorInstance && typeof onSaveCallback === 'function') {
                onSaveCallback(codemirrorInstance.getValue());
            }
        });

        const $closeButton = $('<span style="float:right; cursor:pointer; margin-left: 10px; line-height:1; font-size: 1.2em;" title="Close">×</span>');
        $closeButton.on('click', function() {
            $(document).off('.editableWindow-' + windowId); // Clean up global listeners
            $window.remove();
            // Potentially nullify codemirrorInstance if needed for GC, though it's scoped
        });
        $titleBar.append($closeButton);


        return $window; // Return the jQuery object for the window
    }

    ensureCodeMirror()
        .then(() => {
            createWindow();
        })
        .catch(error => {
            console.error("Could not create editable JS window:", error);
            parentElement.append(`<div style="color:red; border:1px solid red; padding:10px;">Error: Could not load CodeMirror. ${error.message || error}</div>`);
        });
}
