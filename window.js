// object view definition file
const PS = SillyTavern.PS;


function createEntryDiv(font = null) {
    let style = `display: flex; align-items: center; min-height: 32px; padding: 4px 12px; border-bottom: 1px solid #333; box-sizing: border-box;`;
    if (font) style += ` font-family: ${escapeHTML(font)};`;
    return $(`<div class="stv-entry" style="${style}"></div>`);
}

function createLabel(text, obj = { options: {}}, forId = null) {
    let tcolor = obj.lcolor || obj.tcolor || '#ccc';
    let style = `font-weight: bold; width: ${PS.LABEL_WIDTH}; flex-shrink: 0; margin-right: 12px; white-space: nowrap; color: ${tcolor}; overflow: hidden; text-overflow: ellipsis;`;
    const $label = $(`<label style="${style}">${PS.escapeHTML(text)}:</label>`);
    if (forId) $label.attr('for', forId);
    return $label;
}

function createControlArea() {
    return $('<div class="stv-control-area" style="flex-grow: 1; display: flex; justify-content: center; align-items: center; height: 100%;"></div>');
}

// Default display update function for simple text elements
function defaultUpdateTextDisplay($element, value, obj, formatDisplayFunc) {
    $element.text(formatDisplayFunc(value, obj));
}

// Core Click-to-Edit Logic
function makeEditable($displayElement, $inputElement, objToUpdate, valuePropertyName, fullKeyPathToObject, onValueUpdateCallback, options = {}) {
    const {
        inputType = 'text',
        inputAttributes = {},
        formatDisplayFunc = val => val, // Formats value for display (primarily for text or input)
        parseInputFunc = val => val,     // Parses input string back to raw value
        onCommitExtra = null,            // Extra function on successful commit
        // Custom function to update the $displayElement's appearance
        updateDisplayFunc = ($el, val, o) => defaultUpdateTextDisplay($el, val, o, formatDisplayFunc)
    } = options;

    // Initial display update
    updateDisplayFunc($displayElement, objToUpdate[valuePropertyName], objToUpdate);

    $displayElement.on('click', function(e) {
        e.stopPropagation();
        $(this).hide();
        $inputElement
            .val(objToUpdate[valuePropertyName]) // Use raw value for input editing
            .show()
            .focus()
            .select();
    });

    function commitChange() {
        const rawNewValue = parseInputFunc($inputElement.val(), objToUpdate);
        const oldRawValue = objToUpdate[valuePropertyName];

        // Update display using the custom or default display updater
        updateDisplayFunc($displayElement, rawNewValue, objToUpdate);
        $inputElement.hide();
        $displayElement.show();

        if (rawNewValue !== oldRawValue) {
            // commenting out the below line - I don't want to modify original object
            // objToUpdate[valuePropertyName] = rawNewValue;
            if (onValueUpdateCallback) {
                onValueUpdateCallback(fullKeyPathToObject, rawNewValue);
            }
        }
        if (onCommitExtra) {
            onCommitExtra(rawNewValue); // Pass new raw value
        }
    }

    let isEscaping = false;

    $inputElement.on('blur', function() {
            if (isEscaping) {
                isEscaping = false; // Reset flag
                return; // Don't commit if blur was due to Escape
            }
            commitChange();
        }
    );
    $inputElement.on('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            $inputElement.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            isEscaping = true; // Set flag *before* operations that cause blur
            // Revert display to original value
            updateDisplayFunc($displayElement, objToUpdate[valuePropertyName], objToUpdate);
            $inputElement.hide();
            $displayElement.show();
        }
    });
}


function getGroupHeader(groupKey, groupData, obj = {}) {
    const displayName = PS.escapeHTML(groupData.args.name || groupKey);
    let iconClass = 'down fa-circle-chevron-down';
    const initiallyExpanded = groupData.args.expanded !== undefined ? groupData.args.expanded : true;
    if (!initiallyExpanded) {
        iconClass = 'right fa-circle-chevron-right';
    }
    var fcolor = obj.args.vtcolor || '#eee';
    var html = `<div class="inline-drawer-toggle inline-drawer-header stv-group-header" style="display: flex; justify-content: space-between; align-items: center; height: 30px; padding: 4px 12px; background-color: #383838; cursor: pointer; border-bottom: 1px solid #222; color: ${fcolor}; box-sizing: border-box;">
		<b style="font-size: 1.05em;">${displayName}</b>
		<div class="inline-drawer-icon fa-solid interactable ${iconClass}" tabindex="0" style="font-size: 1.1em;"></div>
	</div>`;
    return $(html);
}

function getGroupBody(objData, currentPath, onValueUpdateCallback) {
    var $drawer = $(`<div class="inline-drawer stv-group-body" style="padding-left: 15px; background-color: #252525; border-bottom: 1px solid #222;"></div>`);

    const entries = Object.entries(objData)
        .filter(([key]) => objData[key].__PSTYPE__ !== undefined);

    const itemsToRender = entries.map(([key, value]) => {
        let priority = PS.DEFAULT_PRIORITY;
        if (typeof value !== 'object' || value === null) {
            return { key, value, priority, isGroup: false, isInvalid: true };
        }
        priority = value.args.priority ?? PS.DEFAULT_PRIORITY;
        const isGroup = value.__PSTYPE__ === 'o';
        return { key, value, priority, isGroup, isInvalid: false };
    }).filter(item => !item.isInvalid);

    itemsToRender.sort((a, b) => a.priority - b.priority);

    for (const item of itemsToRender) {
        const { key, value, isGroup } = item;
        const itemPath = [...currentPath, key];
        if (isGroup) {
            $drawer.append(getGroupEntry(key, value, itemPath, onValueUpdateCallback));
        } else if (value.hasOwnProperty('val')) {
            if (typeof value.val === 'number') {
                $drawer.append(getNumberEntry(key, value, itemPath, onValueUpdateCallback));
            } else if (typeof value.val === 'string') {
                $drawer.append(getStringEntry(key, value, itemPath, onValueUpdateCallback));
            }
        }
    }
    return $drawer;
}

function getGroupEntry(key, objGroupData, currentPathToGroup, onValueUpdateCallback) {

    var $groupContainer = $(`<div class="group-entry-container"></div>`);
    var $header = getGroupHeader(key, objGroupData, objGroupData);
    var $body = getGroupBody(objGroupData, currentPathToGroup, onValueUpdateCallback);

    const initiallyExpanded = objGroupData.expanded !== undefined ? objGroupData.expanded : true;

    if (!initiallyExpanded) {
        $body.hide();
    }

    $header.on('click', function() {
        const $icon = $(this).find('.inline-drawer-icon');
        if ($body.is(':visible')) {
            $icon.removeClass('fa-circle-chevron-down down').addClass('fa-circle-chevron-right right');
        } else {
            $icon.removeClass('fa-circle-chevron-right right').addClass('fa-circle-chevron-down down');
        }
        $body.slideToggle(200);
    });

    $groupContainer.append($header);
    $groupContainer.append($body);
    return $groupContainer;
}

function getStringEntry(key, obj, itemPathToObject, onValueUpdateCallback) {
    var entryIdBase = 'stv-str-' + PS.generateRandomId();
    var font = obj.args.font || null;
    const labelText = obj.args.name || key;

    var $entry = createEntryDiv(font);
    $entry.addClass('string-entry');
    $entry.append(createLabel(labelText, obj, entryIdBase + '-input'));

    var $controlArea = createControlArea();
    const $displayElement = $(`<span id="${entryIdBase}-display" style="cursor: pointer; width: 100%; text-align: center; padding: 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #eee;"></span>`);
    const $inputElement = $(`<input id="${entryIdBase}-input" type="text" style="display:none; width: 100%; height: 24px; box-sizing: border-box; background-color: #1e1e1e; color: #eee; border: 1px solid #444; padding: 0 8px; border-radius: 3px; text-align: center;">`);

    $controlArea.append($displayElement).append($inputElement);
    $entry.append($controlArea);

    makeEditable($displayElement, $inputElement, obj, 'val', itemPathToObject, onValueUpdateCallback);

    return $entry;
}

// Function to update the bar display (used by makeEditable for bar style)
function updateBarDisplay($displayWrapper, value, obj) {
    // obj is the item { style: 'b', val: ..., min: ..., max: ..., color: ... }
    // value is the current obj.val
    const min = obj.args.min !== undefined ? parseFloat(obj.args.min) : PS.DEFAULT_MIN_VALUE;
    const max = obj.args.max !== undefined ? parseFloat(obj.args.max) : PS.DEFAULT_MAX_VALUE;
    const barColor = obj.args.barcolor || '#4CAF50';
    const percentage = Math.max(0, Math.min(100, ((parseFloat(value) - min) / (max - min)) * 100));

    $displayWrapper.empty(); // Clear previous bar

    const $barBlock = $(`<div style="width: 100%; display: flex; align-items: center; height: 100%; cursor: pointer;"></div>`); // Added cursor pointer
    const $barContainer = $(`
        <div class="bar-container" style="flex-grow: 1; width: 150px; height: 22px; background-color: #1a1a1a; border-radius: 4px; border: 1px solid #444; position: relative; overflow: hidden;">
            <div class="bar-fill" style="width: ${percentage}%; height: 100%; background-color: ${PS.escapeHTML(barColor)}; transition: width 0.2s ease-out; border-radius: 3px;"></div>
            <div class="bar-text" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.85em; font-weight: bold; text-shadow: 0 0 2px black;">
                ${PS.escapeHTML(parseFloat(value.toFixed(2)))} / ${PS.escapeHTML(String(max))}
            </div>
        </div>
    `);
    $barBlock.append($barContainer);
    $displayWrapper.append($barBlock);
}


function getNumberEntry(key, obj, itemPathToObject, onValueUpdateCallback) {
    var min = obj.args.min !== undefined ? parseFloat(obj.args.min) : PS.DEFAULT_MIN_VALUE;
    var max = obj.args.max !== undefined ? parseFloat(obj.args.max) : PS.DEFAULT_MAX_VALUE;
    var step = obj.args.step !== undefined ? parseFloat(obj.args.step) : ((max - min) <= 20 && Number.isInteger(min) && Number.isInteger(max) ? 1 : (max - min) / 100);
    var font = obj.args.font || null;
    var fcolor = obj.args.vcolor || obj.args.tcolor || '#eee';
    const labelText = obj.args.name || key;

    var $entry = createEntryDiv(font);
    var style = (obj.args.style || 'n').trim();
    var entryIdBase = 'stv-num-' + PS.generateRandomId();
    const inputBaseStyle = `font-weight: bold; text-align: center; height: 24px; box-sizing: border-box; padding: 0 8px; background-color: #1e1e1e; color: ${fcolor}; border: 1px solid #444; border-radius: 3px;`;
    const displayBaseStyle = `cursor: pointer; font-weight: bold; text-align: center; padding: 0 8px; color: ${fcolor};`;

    let makeEditableOptions = {
        inputType: 'number',
        inputAttributes: { min, max, step },
        parseInputFunc: val => parseFloat(val)
        // updateDisplayFunc will be set for bar style
    };

    if (style == 'n') {
        $entry.addClass('number-entry-n');
        $entry.append(createLabel(labelText, obj, entryIdBase + '-input'));
        var $controlArea = createControlArea();
        const $displayElement = $(`<span id="${entryIdBase}-display" style="${displayBaseStyle} width: 90px;"></span>`);
        const $inputElement = $(`<input id="${entryIdBase}-input" type="number" min="${min}" max="${max}" step="${step}" style="display:none; ${inputBaseStyle} width: 90px;">`);
        $controlArea.append($displayElement).append($inputElement);
        $entry.append($controlArea);
        makeEditable($displayElement, $inputElement, obj, 'val', itemPathToObject, onValueUpdateCallback, makeEditableOptions);
    }
    else if (style == 's') {
        $entry.addClass('number-entry-s');
        $entry.append(createLabel(labelText, obj, entryIdBase + '-input'));
        var $controlArea = createControlArea();
        const $valueContainer = $(`<div style="display: flex; align-items: center; color: ${fcolor}; height: 100%;"></div>`);
        const $displayElement = $(`<span id="${entryIdBase}-display" style="${displayBaseStyle}"></span>`);
        const $inputElement = $(`<input id="${entryIdBase}-input" type="number" min="${min}" max="${max}" step="${step}" style="display:none; ${inputBaseStyle} width: 80px;">`);

        const slashFormatDisplay = (val, o) => `${val} / ${o.max}`;
        const slashEditableOptions = { ...makeEditableOptions, formatDisplayFunc: slashFormatDisplay };

        const $inputWrapperForSlash = $(`<div style="display:flex; align-items:center;"></div>`);
        $inputWrapperForSlash.append($inputElement);
        $inputWrapperForSlash.append(`<span class="slash-suffix" style="font-weight: bold; margin-left: 5px; margin-right: 5px; color: #aaa;">/</span><span class="slash-max" style="font-weight: bold; color: #ccc;">${max}</span>`);
        $inputElement.on('show', () => { $displayElement.hide(); $inputWrapperForSlash.find('.slash-suffix, .slash-max').show(); })
            .on('hide', () => { $inputWrapperForSlash.find('.slash-suffix, .slash-max').hide(); $displayElement.show(); });
        $inputWrapperForSlash.find('.slash-suffix, .slash-max').hide();
        $valueContainer.append($displayElement).append($inputWrapperForSlash);
        $controlArea.append($valueContainer);
        $entry.append($controlArea);
        makeEditable($displayElement, $inputElement, obj, 'val', itemPathToObject, onValueUpdateCallback, slashEditableOptions);
    }
    else if (style == 'r') {
        $entry.addClass('number-entry-r');
        $entry.append(createLabel(labelText, entryIdBase + '-range'));
        var $controlArea = createControlArea();
        const $rangeAndNumberBlock = $(`<div style="display: flex; align-items: center; width: 100%; height: 100%;"></div>`);
        const $rangeInput = $(`<input id="${entryIdBase}-range" type="range" value="${obj.val}" min="${min}" max="${max}" step="${step}" style="flex-grow: 1; margin: 0 10px; accent-color: #5a9ced; cursor: pointer; background-color: transparent;">`);
        const $numberDisplay = $(`<span id="${entryIdBase}-num-display" style="${displayBaseStyle} width: 70px;">${obj.val}</span>`);
        const $numberInput = $(`<input id="${entryIdBase}-num-input" type="number" min="${min}" max="${max}" step="${step}" style="display:none; ${inputBaseStyle} width: 70px;">`);

        $rangeAndNumberBlock.append($rangeInput).append($numberDisplay).append($numberInput);
        $controlArea.append($rangeAndNumberBlock);
        $entry.append($controlArea);

        $rangeInput.on('input', function() {
            const sliderVal = parseFloat($(this).val());
            $numberDisplay.text(sliderVal); // Update clickable number display
            $numberInput.val(sliderVal);    // Update hidden input for editing
            if (obj.val !== sliderVal) {
                // commenting out the below line - I don't want to modify original object
                // obj.val = sliderVal;
                if (onValueUpdateCallback) {
                    onValueUpdateCallback(itemPathToObject, sliderVal);
                }
            }
        });
        const sliderUpdateFunc = (newVal) => { $rangeInput.val(newVal); }; // Sync slider if number edited
        const sliderEditableOptions = { ...makeEditableOptions, onCommitExtra: sliderUpdateFunc };
        makeEditable($numberDisplay, $numberInput, obj, 'val', itemPathToObject, onValueUpdateCallback, sliderEditableOptions);
    }
    else if (style == 'b') {
        $entry.addClass('number-entry-b');
        $entry.append(createLabel(labelText, obj, entryIdBase + '-input')); // Label for the input
        var $controlArea = createControlArea();

        // This wrapper will be the $displayElement for makeEditable
        const $barDisplayWrapper = $(`<div id="${entryIdBase}-bar-display-wrapper" style="width: 100%; height: 100%;"></div>`);
        const $inputElement = $(`<input id="${entryIdBase}-input" type="number" min="${min}" max="${max}" step="${step}" style="display:none; ${inputBaseStyle} width: 90px; margin: auto;">`); // Centered input

        $controlArea.append($barDisplayWrapper).append($inputElement);
        $entry.append($controlArea);

        // Add the custom bar update function to options
        const barEditableOptions = {
            ...makeEditableOptions,
            updateDisplayFunc: updateBarDisplay // Custom function to render the bar
            // onCommitExtra could be used if bar update needed more than just the value from obj
        };
        makeEditable($barDisplayWrapper, $inputElement, obj, 'val', itemPathToObject, onValueUpdateCallback, barEditableOptions);
    } else {
        $entry.append(createLabel(labelText, obj));
        var $fallbackControl = createControlArea();
        $fallbackControl.append(`<span style="color: #aaa;">Unknown style: ${escapeHTML(style)}</span>`);
        $entry.append($fallbackControl);
    }
    return $entry;
}

function getWindowContent(objData, rootObjectName, onValueUpdateCallback) {
    // This function remains unchanged from your original, it's correct.
    const style = [
        'display: flex',
        'flex-direction: column',
        'background-color: #2c2c2c',
        'flex: 1 1 auto',
        'min-height: 0',
        'overflow-y: auto',
        'box-sizing: border-box',
        'position: relative' // Ensures content stays within this container
    ].join('; ');
    const $content = $(`<div class="scrollY stv-window-content" style="${style}"></div>`);

    if (typeof getGroupBody === 'function') {
        $content.append(getGroupBody(objData, [rootObjectName], onValueUpdateCallback));
    } else {
        $content.html('<p style="color:white; padding:10px;">Content area (getGroupBody function not found)</p>');
    }
    return $content;
}

function getPSWindow(objectName, obj) {
    // **MODIFICATION FOR TITLE START AND GENERATION OF ID**
    let windowTitle = PS.escapeHTML(objectName); // Default title
    var windowId = 'PSWin-' + windowTitle;
    if (obj && typeof obj.args.name === 'string') {
        windowTitle = PS.escapeHTML(obj.args.name);
    }
    // **MODIFICATION FOR TITLE END**

    var $win = $(`<div class="drawer-content flexGap5 stv-window" id="${windowId}" style="
        box-sizing: border-box;
		min-width: ${PS.LABEL_WIDTH};
        width: fit-content;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        opacity: 1;
        border-radius: 8px;
        box-shadow: 0 0 15px rgba(0,0,0,0.5);
        position: fixed;
        background-color: #2c2c2c;
        z-index: 1000;
        overflow: hidden;
        "></div>`);

    const controlBarHtml = `
    <div class="flex-container stv-window-header-bar" style="
        flex: 0 0 auto; display: flex; align-items: center;
        padding: 8px 12px; background-color: #363636;
        border-bottom: 1px solid #111; border-top-left-radius: 7px; border-top-right-radius: 7px;
        cursor: grab; user-select: none; box-sizing: border-box;">
        <div id="${windowId}-drag-icon" class="fa-fw fa-solid fa-grip hoverglow" style="color: #bbb; font-size: 1.1em; margin-right: 10px;" title="Drag to move"></div>
        <div class="stv-window-title" style="flex-grow: 1; text-align: center; font-weight: bold; color: #eee; font-size: 1.15em;">${windowTitle}</div>
        <div id="${windowId}-close" class="fa-solid fa-circle-xmark hoverglow dragClose" style="cursor: pointer; color: #bbb; font-size: 1.3em; margin-left: 10px;" title="Close"></div>
    </div>`;

    $win.html(controlBarHtml);

    $win.find(`#${windowId}-close`).off('click').on('click', function (event) {
        event.stopPropagation();
        PS.objectCloseCallback(objectName);
    });

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialWindowCssLeft = 0;
    let initialWindowCssTop = 0;

    const $headerBar = $win.find('.stv-window-header-bar');
    const dragNamespace = '.stvWindowDragIndependent-' + windowId;

    function handleDragStart(e) {
        if (e.button !== 0) {
            return;
        }
        isDragging = true;

        dragStartX = e.clientX;
        dragStartY = e.clientY;

        const currentRenderedOffset = $win.offset();
        $win.css({
            'left': currentRenderedOffset.left + 'px',
            'top': currentRenderedOffset.top + 'px',
            'transform': 'none',
            'margin': '0px'
        });

        initialWindowCssLeft = parseFloat($win.css('left'));
        initialWindowCssTop = parseFloat($win.css('top'));

        $headerBar.css('cursor', 'grabbing');
        $('body').css({
            'user-select': 'none',
            'cursor': 'grabbing'
        });

        $(document).on(`mousemove${dragNamespace}`, handleDragMove);
        $(document).on(`mouseup${dragNamespace}`, handleDragEnd);

        e.preventDefault();
        e.stopPropagation();
    }

    function handleDragMove(e) {
        if (!isDragging) return;

        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        $win.css('transform', `translate(${deltaX}px, ${deltaY}px)`);
        e.preventDefault();
    }

    function handleDragEnd(e) {
        if (isDragging) {
            if (e.button === 0) {
                isDragging = false;

                const finalDeltaX = e.clientX - dragStartX;
                const finalDeltaY = e.clientY - dragStartY;

                const newLeft = initialWindowCssLeft + finalDeltaX;
                const newTop = initialWindowCssTop + finalDeltaY;

                $win.css({
                    'left': newLeft + 'px',
                    'top': newTop + 'px',
                    'transform': 'none',
                    'margin': '0px'
                });

                $headerBar.css('cursor', 'grab');
                $('body').css({
                    'user-select': '',
                    'cursor': ''
                });
                $(document).off(`mousemove${dragNamespace} mouseup${dragNamespace}`);
            }
        }
    }

    $headerBar.on(`mousedown${dragNamespace}`, handleDragStart);

    $win.on('remove', function() {
        $(document).off(dragNamespace);
    });

    if ($win.css('position') === 'fixed' && ( $win.css('left') === 'auto' || $win.css('top') === 'auto')) {
        $win.css({left: '20px', top: '20px', margin: '0px'});
    }

    return $win;
}



function updatePSObject($win, objectName, obj){
    //Clear all content of the window besides the main bar
    $win.children().slice(1).remove();
    // fill window's content
    $win.append(getWindowContent(obj, objectName, PS.objectValueUpdateCallback));
}



PS.showPSObject = (objectName, obj) => {
    const winName = PS.escapeHTML(objectName);
    let $win = $(`#PSWin-${winName}`);
    if ($win.length === 0){
        $win = getPSWindow(objectName, obj);
        const stvWinDiv = $(`#${PS.winContainer}`);
        stvWinDiv.append($win);
    }
    updatePSObject($win, objectName, obj);
}



PS.hidePSObject = (objectName) => {
    const winName = PS.escapeHTML(objectName);
    const $win = $(`#PSWin-${winName}`);
    if ($win.length > 0) $win.remove();
}
