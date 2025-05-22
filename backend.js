import Sandbox from './sandbox.js';


const PS = SillyTavern.PS;



PS.current = {
    chatID: -1,
    openedWindows: {},
    state: {},
    context: []
};



//binding for tests
PS.Sandbox = Sandbox;



PS.onStateUpdate = [];



class UnsafeSandbox {
    constructor() {
        // No complex setup needed for the unsafe version.
    }

    /**
     * "Compiles" the code by returning a function that, when called,
     * will execute the code within the specified contexts.
     * @param {string} code The JavaScript code string to execute.
     * @returns {function(...object): any} A function that takes context objects as arguments
     * (the first is the defaultContext, subsequent ones are other scopes) and executes the code.
     */
    compile(code) {
        return function(...contexts) {
            if (!contexts || contexts.length === 0) {
                throw new Error("UnsafeSandbox execution requires at least a defaultContext.");
            }

            const defaultContext = contexts[0];
            if (typeof defaultContext !== 'object' || defaultContext === null) {
                throw new TypeError("The defaultContext (first argument) must be an object.");
            }
            const otherContexts = contexts.slice(1);

            const argNames = ['__defaultContext__'];
            const argValues = [defaultContext];
            let declarations = '';
            const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

            otherContexts.forEach((scope, index) => {
                if (typeof scope === 'object' && scope !== null) {
                    const scopeArgName = `__scope${index}__`;
                    argNames.push(scopeArgName);
                    argValues.push(scope);

                    for (const key in scope) {
                        if (Object.hasOwnProperty.call(scope, key)) {
                            // Ensure the key is a valid identifier to be used as a var name
                            // and doesn't clash with our internal or other scope argument names.
                            if (validIdentifierRegex.test(key) &&
                                key !== '__defaultContext__' &&
                                !argNames.includes(key) && // Prevent clash with __scopeX__ names
                                key !== '__returnValue__') {
                                // Declare variables from otherContexts to make them available
                                // in a scope "outside" the `with` block but inside the function.
                                declarations += `var ${key} = ${scopeArgName}['${key}'];\n`;
                            }
                        }
                    }
                } else if (scope !== undefined) { // Allow undefined/null for non-object other contexts
                    // If a non-object (but defined) scope is passed, create an empty arg for it
                    // to maintain argument order, but don't try to extract properties.
                    const scopeArgName = `__scope${index}__`;
                    argNames.push(scopeArgName);
                    argValues.push(scope);
                }
            });

            // The user's code is wrapped in an IIFE to:
            // 1. Allow `return` statements in the user code to work as expected.
            // 2. Ensure `var` declarations in user code are local to that IIFE,
            //    preventing clashes with variables injected from `otherContexts`.
            // 3. Set `this` within the user code's execution to be the `defaultContext`.
            const functionBody = `
                ${declarations}
                var __returnValue__;
                with (__defaultContext__) {
                   __returnValue__ = (function() {
                        // User code is placed her3e
                        ${code}
                    }).call(__defaultContext__);
                }
                return __returnValue__;
            `;

            try {
                const func = new Function(...argNames, functionBody);
                return func(...argValues);
            } catch (e) {
                // console.error("Error during UnsafeSandbox execution:", e);
                // console.error("Generated Function Body:\n", functionBody);
                // console.error("Argument Names:", argNames);
                // console.error("Argument Values:", argValues);
                throw e;
            }
        };
    }
}



PS.exec = (psm, globalScope = {}) => {
    if (psm.data === undefined) psm.data = {};
    const localScope = {
        PSM: {
            args: {
                id: psm.id ?? PS.generateRandomId(4),
                bcolor: '#880088',
            },
            data: psm.data,
            id: function(value) {
                this.args.id = value;
                return this;
            },
            text: function(value) {
                this.args.text = value;
                return this;
            },
            reason: function(value) {
                this.args.reason = value;
                return this;
            },
            bcolor: function(value) {
                this.args.bcolor = value;
                return this;
            },
            tcolor: function(value) {
                this.args.tcolor = value;
                return this;
            },
            font: function(value) {
                this.args.font = value;
                return this;
            }
        },
        PSO: (name = '') => {
            return {
                __PSTYPE__: 'o',
                args: {
                    name: name,
                },
                opened: false,
                name: function(value) {
                    this.args.name = value;
                    return this;
                },
                priority: function(value) {
                    this.args.priority = value;
                    return this;
                },
                open: function() {
                    this.opened = true;
                    return this;
                },
                close: function() {
                    this.opened = false;
                    return this;
                }
            };
        },
        PSV: (initValue, name) => {
            return {
                __PSTYPE__: 'v',
                args: {
                    name: name,
                    min: PS.DEFAULT_MIN_VALUE,
                    max: PS.DEFAULT_MAX_VALUE,
                    style: 'n',
                },
                val: initValue,
                name: function(value) {
                    this.args.name = value;
                    return this;
                },
                priority: function(value) {
                    this.args.priority = value;
                    return this;
                },
                style: function(value) {
                    this.args.style = value;
                    return this;
                },
                tcolor: function(value) {
                    this.args.tcolor = value;
                    return this;
                },
                barcolor: function(value) {
                    this.args.barcolor = value;
                    return this;
                },
                min: function(value) {
                    this.args.min = value;
                    return this;
                },
                max: function(value) {
                    this.args.max = value;
                    return this;
                },
                set: function(newValue) {
                    this.val = newValue;
                    return this;
                },
                add: function(newValue) {
                    this.val += newValue;
                    return this;
                },
                sub: function(newValue) {
                    this.val -= newValue;
                    return this;
                },
                mult: function(newValue) {
                    this.val *= newValue;
                    return this;
                },
                div: function(newValue) {
                    this.val /= newValue;
                    return this;
                },
                valueOf() {
                    return this.val;
                }
            };
        }
    };

    const globals = {...Sandbox.SAFE_GLOBALS, console};
    const prototypeWhitelist = new Map(Sandbox.SAFE_PROTOTYPES);

    if (PS.safe < 2) localScope.ST = PS.getST(prototypeWhitelist);
    const code = psm.code;
    let output = '';
    if (PS.safe){
        //safe but slow execution
        const sandbox = new Sandbox({globals, prototypeWhitelist});
        try{
            const exec = sandbox.compile(code);
            const result  = exec(globalScope, localScope).run();
            output = PS.getString(result);
        }
        catch (err){
            console.error("Safe Sandbox execution failed:", err);
            output = '{ERROR}';
        }

    }
    else {
        //unsafe but fast execution
        const unsafeSandbox = new UnsafeSandbox();
        try {
            const exec = unsafeSandbox.compile(code);
            const result = exec(globalScope, localScope);
            output = PS.getString(result);
        } catch (err) {
            console.error("Unsafe Sandbox execution failed:", err);
            output = '{ERROR}';
        }
    }
    psm.id = localScope.PSM.args.id;
    localScope.psm_raw = psm;
    localScope.output = output;
    return localScope;
}



PS.getST= (prototypeWhitelist = new Map()) => {
    const ctx = SillyTavern.getContext();

    const obj = {};

    const commands = ctx.SlashCommandParser.commands;

    for (const com of Object.values(commands)) {
        function f (...args) {
            let output = '';
            try {
                output = com.callback(f.args, ...args);
            }
            catch(error){
                console.error("ST command '" + com.name + "' execution failed:", error);
            }
            f.args = {...f.default};
            return output;
        }
        const kwargs = {};
        const allowed =  new Set();
        for (let kwarg of com.namedArgumentList){
            kwargs[kwarg.name] = kwarg.defaultValue;
            const setter = (value) => {
                f.args[kwarg.name] = value;
                return f;
            }
            for (let name of [kwarg.name, ...(kwarg.aliases ?? [])]){
                try {
                    f[name] = setter;
                    allowed.add(name);
                }
                catch(err) {
                    if (err instanceof TypeError) {
                        f['_' + name] = setter;
                        allowed.add('_' + name);
                    }
                    else{
                        console.error("Failed to generate slash command '" + com.name + "' for kwarg: " + name);
                    }
                }
            }

        }
        //sandbox requirement
        prototypeWhitelist.set(f, allowed);

        //bind objects to our function
        f.default = kwargs;
        f.args = {...kwargs};
        obj[com.name] = f;
        for (const alias of com.aliases) {
            obj[alias] = f;
        }
    }

    obj.S = (text) => ctx.executeSlashCommands(text);

    return obj;
}



PS.getChatPS = (create=false, msgID=-1) => {
    const chat = SillyTavern.getContext().chat;
    if (!chat) return null;
    const msg = chat.at(msgID);
    if (!msg) return null;
    if (!msg.hasOwnProperty('PS')){
        if (create) msg.PS = [];
        else return null;
    }
    let swipeID = 0;
    if (msg.hasOwnProperty('swipe_id')) swipeID = msg.swipe_id;
    if (!msg.PS[swipeID]){
        if (create) msg.PS[swipeID] = [];
        else return null;
    }
    return msg.PS[swipeID];
};



PS.addChatPS = (jsText, msgID=-1) => {
    const psl = PS.getChatPS(true, msgID);
    if (!psl) return;
    const psm = {
        code: jsText,
        data: {}
    }
    psl.push(psm);
    return psm;
}



PS.modifierRemoveCallback = (chatIdx, elementIdx) => {
    const psl = PS.getChatPS(false, chatIdx);
    if (psl === null) return;
    psl.splice(elementIdx, 1);
    SillyTavern.getContext().saveChat();
    PS.process(chatIdx, false);
}



PS.modifierReorderCallback = (chatIdx, elementIdx, destIdx)=>{
    const psl = PS.getChatPS(false, chatIdx);
    if (psl === null) return;
    const [element] = psl.splice(elementIdx, 1); // Remove element at fromIndex
    psl.splice(destIdx, 0, element); // Insert element at toIndex
    SillyTavern.getContext().saveChat();
    PS.process(chatIdx, false);
}



PS.objectValueUpdateCallback = (keyPathToValue, newValue)=> {
    const path = keyPathToValue.join('.');
    PS.addChatPS(`
    ${path}.val = ${newValue};
    PSM.text = "${path} set to ${newValue}";
    PSM.reason = "Modified manually within object window";
    `);
    SillyTavern.getContext().saveChat();
    PS.process(-1, false, true);
}



PS.objectCloseCallback = (objName) => {
    PS.addChatPS(`
    ${objName}.close();
    PSM.text = "Object ${objName} closed manually";
    `);
    SillyTavern.getContext().saveChat();
    PS.process(-1, false, true);
}



PS.editRequestCallback = (chatIdx, idx) => {
    const psl = PS.getChatPS(false, chatIdx);
    if (psl === null) return;
    const psm = psl.at(idx);
    if (!psm) {
        console.warn("Error in editRequest that shouldn't happen!");
        return;
    }
    PS.editModifier(psm, chatIdx);
}



PS.editModifier = (psm, cid) => {
    const editSaveCallback = (newCode) => {
        if (psm.code !== newCode){
            psm.code = newCode;
            SillyTavern.getContext().saveChat();
            PS.process(cid, false, true);
        }
    }
    PS.createEditableJSWindow($(`#${PS.editContainer}`), psm.code, editSaveCallback);
}



PS.state = (chatIdx = -1, withOptions=false) => {
    const chat = SillyTavern.getContext().chat;
    if (chatIdx === -1) chatIdx = chat.length - 1;
    const globalScope = {};
    for (let cid = 0; cid < chatIdx; cid++) {
        const psl = PS.getChatPS(false, cid);
        if (!psl) continue;
        for (let ps of psl) {
            PS.exec(ps, 1, globalScope);
        }
    }
    return globalScope;
};

