const PS = SillyTavern.PS;


// --- Helper to update main container visibility ---
function _updateMainVisibility(mainDiv, elementsContainer) {
    if (elementsContainer.children().length > 0) {
        mainDiv.css('display', 'block');
    } else {
        mainDiv.css('display', 'none');
    }
}


// --- Helper to create a single element ---
function _createElementDiv(itemData, mainDiv, elementsContainer, chatIdx, onRemoveCallback) {
    const baseDefaults = {
        font: 'Arial, sans-serif',
        text: 'Modifier',
        reason: '',
    };
    const effectiveItem = { ...baseDefaults, ...itemData };

    const elementCss = {
        'padding': '1px 8px',
        'margin-bottom': '4px',
        'border-radius': '5px',
        'box-shadow': '0 1px 2px rgba(0,0,0,0.08)',
        'display': 'flex',
        'justify-content': 'space-between',
        'align-items': 'center',
        'width': '100%',
        'box-sizing': 'border-box',
        'font-family': effectiveItem.font
    };

    if (itemData.hasOwnProperty('bcolor')) {
        elementCss['background-color'] = itemData.bcolor;
    }
    if (itemData.hasOwnProperty('tcolor')) {
        elementCss['color'] = itemData.tcolor;
    }

    const elementDiv = $('<div></div>').css(elementCss);
    elementDiv.data('itemData', effectiveItem);

    const textContentDiv = $('<div></div>').css({
        'flex-grow': '1',
        'margin-right': '6px'
    });

    const textP = $('<p></p>').text(effectiveItem.text).css({
        'margin': '0',
        'font-weight': 'bold',
        'font-size': '0.9em'
    });
    textContentDiv.append(textP);

    if (effectiveItem.reason && String(effectiveItem.reason).trim() !== '') {
        const reasonP = $('<p></p>').text(effectiveItem.reason).css({
            'margin': '2px 0 0 0',
            'font-style': 'italic',
            'font-size': '0.85em',
            'opacity': '0.85'
        });
        textContentDiv.append(reasonP);
        textP.css('margin-bottom', '3px');
    }
    elementDiv.append(textContentDiv);

    const buttonsContainer = $('<div></div>').css({
        'display': 'flex',
        'align-items': 'center', // Corrected: Was 'align-items:' in user's snippet
        'flex-shrink': '0'
    });

    const dragHandleIcon = $('<span>⠿</span>').addClass('stv-drag-handle').css({
        'cursor': 'grab',
        'padding': '0 6px 0 0px',
        'font-size': '18px',
        'color': '#777',
        'height': '22px',
        'display': 'inline-flex',
        'align-items': 'center',
        'justify-content': 'center'
    }).hover(
        function() { $(this).css('color', '#333'); },
        function() { $(this).css('color', '#777'); }
    );
    buttonsContainer.append(dragHandleIcon);

    // Define common styles for buttons to ensure consistency and easy updates
    const commonButtonBaseStyles = {
        'border': 'none',
        'width': '22px',
        'height': '22px',
        'font-size': '15px',
        'cursor': 'pointer',
        'font-weight': 'bold',

        'display': 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'padding': '0',
        'border-radius': '10%',

        // Styles for "background showing only when hovering"
        'background-color': 'transparent',
        'color': '#777'
    };

    const buttonHoverIn = function() {
        $(this).css({
            'background-color': '#555555',
            'color': 'white'
        });
    };
    const buttonHoverOut = function() {
        $(this).css({
            'background-color': 'transparent',
            'color': '#777'
        });
    };

    const editButton = $('<button>📝</button>').css({
        ...commonButtonBaseStyles,
        'border-radius': '10%',
        // No margin-left needed here, spacing from dragHandleIcon is via dragHandleIcon's padding-right
    }).hover(buttonHoverIn, buttonHoverOut);

    editButton.on('click', function(e) {
        e.stopPropagation();
        let index = elementDiv.index();
        PS.editRequestCallback(chatIdx, index);
    });
    buttonsContainer.append(editButton);


    const removeButton = $('<button>❌</button>').css({
        ...commonButtonBaseStyles,
        'margin-left': '4px'      // Add a small margin to space it from the edit button
    }).hover(buttonHoverIn, buttonHoverOut);

    // --- UNCHANGED CALLBACK LOGIC for removeButton ---
    removeButton.on('click', function(e) {
        e.stopPropagation();
        elementDiv.fadeOut(150, function() {
            // Inside fadeOut callback, 'this' refers to elementDiv
            let index = $(this).index();
            $(this).remove();
            _updateMainVisibility(mainDiv, elementsContainer);
            if (typeof onRemoveCallback === 'function') {
                onRemoveCallback(chatIdx, index);
            }
        });
    });
    buttonsContainer.append(removeButton);
    elementDiv.append(buttonsContainer);

    return elementDiv;
}


function createCollapsibleListContainer(chatIdx, backendReorderCallback) {

    const mainDiv = $('<div class="stv-elements-main"></div>').css({
        'width': '100%',
        'border-radius': '5px',
        'overflow': 'hidden',
        'font-family': 'Arial, sans-serif',
        'padding-bottom': '12px',
        'padding-left': '12px',
        'padding-right': '24px',
        'background-color': 'transparent'
    });

    const stvBar = $(`<div>${PS.modifiersTitle}<span>▼</span></div>`).css({
        'padding': '1px 10px',
        'padding-bottom': '5px',
        'cursor': 'pointer',
        'font-weight': 'bold',
        'display': 'flex',
        'justify-content': 'space-between',
        'align-items': 'center',
        'font-size': '0.95em'
    });
    const stvBarIcon = stvBar.find('span');

    const elementsContainer = $('<div></div>').addClass('stv-elements-container').css({
        'padding': '6px',
        'background-color': 'transparent',
        'min-height': '10px'
    });

    let isExpanded = false;
    elementsContainer.hide();
    stvBarIcon.text('►');

    stvBar.on('click', function() {
        // Prevent slide if sortable is active (dragging)
        if (elementsContainer.hasClass('sorting-active')) {
            return; // Do nothing if a drag is in progress
        }
        isExpanded = !isExpanded;
        if (isExpanded) {
            elementsContainer.slideDown(200);
        } else {
            elementsContainer.slideUp(200);
        }
        stvBarIcon.text(isExpanded ? '▼' : '►');
    });

    mainDiv.append(stvBar).append(elementsContainer);

    if ($.fn.sortable) {
        elementsContainer.sortable({
            handle: '.stv-drag-handle',
            axis: 'y',
            containment: elementsContainer,
            tolerance: 'pointer',
            revert: 150,
            start: function(event, ui) {
                elementsContainer.addClass('sorting-active'); // Add flag class
                ui.item.css({
                    'box-shadow': '0 4px 8px rgba(0,0,0,0.2)',
                    'opacity': '0.85'
                });
                ui.placeholder.css({
                    'height': ui.item.outerHeight(),
                    'margin-bottom': ui.item.css('margin-bottom'),
                    'background-color': '#777777',
                    'border': '1px dashed #99ccff',
                    'border-radius': ui.item.css('border-radius') || '5px',
                    'visibility': 'visible',
                    'box-sizing': 'border-box' // Added for consistency
                });
                // Change cursor on the helper's (dragged item's) handle
                ui.helper.find('.stv-drag-handle').css('cursor', 'grabbing');
                ui.item.data('fromIndex', ui.item.index());
            },
            stop: function(event, ui) {
                elementsContainer.removeClass('sorting-active'); // Remove flag class
                ui.item.css({
                    'box-shadow': '0 1px 2px rgba(0,0,0,0.08)',
                    'opacity': '1'
                });
                // Reset cursor on the item's handle
                ui.item.find('.stv-drag-handle').css('cursor', 'grab');
            },
            update: function(event, ui) {
                const movedItemElement = ui.item;
                const fromIndex = movedItemElement.data('fromIndex');
                const newIndex = movedItemElement.index();
                const movedItemData = movedItemElement.data('itemData');

                if (typeof backendReorderCallback === 'function') {
                    backendReorderCallback(chatIdx, fromIndex, newIndex);
                }
            }
        });
    } else {
        console.warn("jQuery UI Sortable is not loaded. Reordering will not be available.");
    }
    return mainDiv;
}



PS.updateModifiers = (idx, localContextList) => {
    //ensure correct elements path on the site and clear the container
    const $chat = $('#chat');
    const $mes = $chat.find(`[mesid="${idx}"]`);
    if (!$mes) return;
    const $mblock = $mes.find('.mes_block');
    let $STVMain = $mblock.find('.stv-elements-main');
    if($STVMain.length === 0){
        const $mtex = $mblock.find('.mes_text');
        $STVMain = $mtex.after(createCollapsibleListContainer(idx, PS.modifierReorderCallback)).next();
    }
    const $elementsContainer = $STVMain.find('.stv-elements-container');
    $elementsContainer.empty();
    //fill the container with proper modifiers
    for (let localContext of localContextList) {
        const el = _createElementDiv(localContext.PSM, $STVMain, $elementsContainer, idx, PS.modifierRemoveCallback);
        $elementsContainer.append(el);
    }
    $elementsContainer.sortable('refresh');

    _updateMainVisibility($STVMain, $elementsContainer);
}




