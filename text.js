const PS = SillyTavern.PS;



PS.processTextForJS = (text, localContextList, idx=-1, globalScope={}) => {
    if (typeof text !== 'string') {
        console.error("Invalid argument: text must be a string");
        return text; // Or throw an error
    }

    const regex = /<{([\s\S]*?)}>/g;

    return text.replace(regex, (match, data) => {
        const psm = PS.addChatPS(data, idx);
        const localScope = PS.exec(psm, globalScope);
        localContextList.push(localScope);
        return `<&${localScope.PSM.args.id}&>`;
    });
}



PS.preProcessMessage = (inputText, messageId, contextDict) => {
    const regex = /<&([^&]+)&>/g;
    let localButtonIndex = 0;

    return inputText.replace(regex, (match, data) => {
        const context = contextDict[data];
        if (!context) return match;

        const esdata = PS.escapeHTML(data); // Or JSON.stringify(data) if data is complex
        const buttonId = `custom-btn-msg${messageId}-idx${localButtonIndex++}`;

        const bcolor = context.PSM.args['bcolor'] ?? 'transparent';
        const tcolor = context.PSM.args['tcolor'] ?? 'white';

        return context.output !== '' ? `<button id="${buttonId}"
                        class="action-button"
                        style="background-color: ${bcolor}; color: ${tcolor}; padding: 0 4px; border: none; border-radius: 3px; cursor: pointer;"
                        data-action-payload="${esdata}">
                    ${PS.escapeHTML(context.output)}
                </button>` : '';
    });
}



PS.postProcessMessage = (parentElementSelector, cid, contextDict) => {
    $(parentElementSelector).find('.custom-action-button').each(function() {
        if (!$(this).data('handler-bound')) {
            $(this).on('click', function() {
                const id = $(this).data('action-payload');
                const context = contextDict[id];
                if (!context) return;
                PS.editModifier(context.psm_raw, cid);
            });
            $(this).data('handler-bound', true);
        }
    });
}



PS.customSanitizerOverrides = {
    ADD_TAGS: ['button', 'custom-style'], // Allow button tag
    ADD_ATTR: ['id', 'class', 'style', 'data-action-payload'],
};



PS.updateMessageUI = (msg, cid, contextDict) =>{
    const $chat = $('#chat');
    const $mes = $chat.find(`[mesid="${cid}"]`);
    if ($mes.length > 0) {
        const $mtex = $mes.find('.mes_text');
        const newMsg = PS.preProcessMessage(msg.mes, cid, contextDict);
        $mtex.html(SillyTavern.getContext().messageFormatting(newMsg, msg.name, msg.is_system, msg.is_user, cid, PS.customSanitizerOverrides));
        PS.postProcessMessage($mtex, cid, contextDict);
    }
}

