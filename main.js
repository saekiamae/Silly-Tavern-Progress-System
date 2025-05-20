import './constants.js';
import './utils.js';
import './editor.js'
import './text.js'
import './backend.js';
import './modifiers.js';
import './window.js';

const PS = SillyTavern.PS;



PS.process = (idx, parse, updateModifiers) => {
    const ctx = SillyTavern.getContext();
    let start = idx;
    let end = idx + 1;
    if (idx === -1){
        start = ctx.chat.length - 1;
        end = ctx.chat.length;
    }
    else if (idx === -2){
        start = 0;
        end = ctx.chat.length;
    }
    //global updatable state, shared between all ps modifiers
    const state = {};

    //context dictionary, used for parsing text
    const contextDict = {};

    // main processing
    for (let cid = 0; cid < end; cid++) {
        //grab current msg object from our chat and get list of ps modifiers.
        const msg = ctx.chat.at(cid);
        if (!msg) continue; //Shouldn't happen
        if (!msg.hasOwnProperty('PS')) msg.PS = [];
        let swipeID = 0;
        if (msg.hasOwnProperty('swipe_id')) swipeID = msg.swipe_id;
        if (!msg.PS[swipeID]) msg.PS[swipeID] = [];

        const psl = msg.PS[swipeID];
        const localContextList = [];

        // run existing modifiers first
        for (let psm of psl) localContextList.push(PS.exec(psm, state));
        let fixDict = true;
        if (cid >= start){
            //parse message for <{json clauses}>
            if (parse) {
                msg.mes = PS.processTextForJS(msg.mes, localContextList, cid, state);
                for (let local of localContextList){
                    contextDict[local.PSM.ID] = local;
                }
                fixDict = false;
                const newDict = {...contextDict};
                // because original Silly Tavern overwrites messages, let's move it to the end of event queue
                setTimeout(() => {
                    PS.updateMessageUI(msg, cid, newDict);
                }, 0);
            }
            if (updateModifiers) PS.updateModifiers(cid, localContextList, idx !== -2);
        }
        // update our dictionary if it wasn't done yet
        if (fixDict) {
            for (let local of localContextList){
                contextDict[local.ID] = local;
            }
        }
    }

    for (let callback of PS.onStateUpdate) callback(state, start); //run custom callbacks

    // Show/update/hide windows
    const openedWindows = {};
    Object.entries(state).forEach(([objID, obj]) => {
        if (typeof obj === 'object' && obj.__PSTYPE__ === 'o' && obj.opened) {
            PS.showPSObject(objID, obj); //opens or updates proper window
            openedWindows[objID] = obj;
        }
    });

    Object.keys(PS.current.openedWindows).forEach(objID => {
        if (!openedWindows.hasOwnProperty(objID)) PS.hidePSObject(objID);
    });

    PS.current.chatID = ctx.chat.length - 1;
    PS.current.state = state;
    PS.current.openedWindows = openedWindows;
}



jQuery(() => {
    // create proper containers for our windows
    const mdivs = $('#movingDivs');
    if (mdivs.length !== 0) {
        mdivs.before(`<div id="${PS.winContainer}"></div>`);
        mdivs.before(`<div id="${PS.editContainer}"></div>`)
    }

    // add listeners
    const context = SillyTavern.getContext();
    if (context && context.eventSource) {

        context.eventSource.on(context.event_types.CHAT_CHANGED, (cid) => {
            //console.log('CHAT_CHANGED event triggered. Data:', cid);
            $(`#${PS.winContainer}`).empty(); // just for safety
            $(`#${PS.editContainer}`).empty(); // just for safety
            PS.process(-2, true, true);
        });

        context.eventSource.on(context.event_types.MESSAGE_SENT, (idx) => {
            //console.log('MESSAGE_SENT event triggered. Message:', idx);
            PS.process(idx, true, true);
        });

        context.eventSource.on(context.event_types.MESSAGE_RECEIVED, (idx) => {
            //console.log('MESSAGE_RECEIVED event triggered. Message:', idx);
            PS.process(idx, true, true);
        });

        context.eventSource.on(context.event_types.MESSAGE_EDITED, (idx) => {
            //console.log('MESSAGE_EDITED event triggered. Data:', idx);
            PS.process(idx, true, true);
        });

        context.eventSource.on(context.event_types.MESSAGE_SWIPED, (idx) => {
            //console.log('MESSAGE_SWIPED event triggered. Data:', idx);
            PS.process(idx, true, true);
        });

        context.eventSource.on(context.event_types.MESSAGE_DELETED, (idx) => {
            //console.log('MESSAGE_DELETED event triggered. Data:', idx);
            PS.process(idx, false);
        });
        /*
        context.eventSource.on(context.event_types.MESSAGE_UPDATED, (idx) => {
            console.log('MESSAGE_UPDATED event triggered. Data:', idx);
            PS.process(idx, true);
        });
        */
        context.registerMacro('PSAll', () => {
            //const state = PS.state(-1);
            const state = PS.current.state;
            return JSON.stringify(state);
        });

        console.log('Progress System Loaded Successfully');

    } else {
        console.error('SillyTavern context or eventSource not available for PS processing.');
    }
});
