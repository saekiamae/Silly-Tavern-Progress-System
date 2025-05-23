const SandboxGlobal = function(e) {
    if (e === globalThis) return globalThis;
    for (const t in e) this[t] = e[t]
};
class ExecContext {
    constructor(e, t, n, r, s, i, o, a, c, p, l, d) {
        this.ctx = e, this.constants = t, this.tree = n, this.getSubscriptions = r, this.setSubscriptions = s, this.changeSubscriptions = i, this.setSubscriptionsGlobal = o, this.changeSubscriptionsGlobal = a, this.evals = c, this.registerSandboxFunction = p, this.allowJit = l, this.evalContext = d;
        this.defaultContextForUndeclared = null; // Added field
    }
}

function createContext(e, t) {
    const n = new SandboxGlobal(t.globals),
        r = {
            sandbox: e,
            globalsWhitelist: new Set(Object.values(t.globals)),
            prototypeWhitelist: new Map([...t.prototypeWhitelist].map((e => [e[0].prototype, e[1]]))),
            options: t,
            globalScope: new Scope(null, t.globals, n),
            sandboxGlobal: n
        };
    return r.prototypeWhitelist.set(Object.getPrototypeOf([][Symbol.iterator]()), new Set), r
}

function createExecContext(sandbox, executionTree, evalContext) {
    const evals = new Map,
        execContext = new ExecContext(sandbox.context, executionTree.constants, executionTree.tree, new Set, new WeakMap, new WeakMap, sandbox.setSubscriptions, sandbox.changeSubscriptions, evals, (e => sandbox.sandboxFunctions.set(e, execContext)), !!evalContext, evalContext);
    if (evalContext) {
        const func = evalContext.sandboxFunction(execContext);
        evals.set(Function, func), evals.set(eval, evalContext.sandboxedEval(func)), evals.set(setTimeout, evalContext.sandboxedSetTimeout(func)), evals.set(setInterval, evalContext.sandboxedSetInterval(func))
    }
    return execContext
}
class CodeString {
    constructor(e) {
        this.ref = {
            str: ""
        }, e instanceof CodeString ? (this.ref = e.ref, this.start = e.start, this.end = e.end) : (this.ref.str = e, this.start = 0, this.end = e.length)
    }
    substring(e, t) {
        if (!this.length) return this;
        (e = this.start + e) < 0 && (e = 0), e > this.end && (e = this.end), (t = void 0 === t ? this.end : this.start + t) < 0 && (t = 0), t > this.end && (t = this.end);
        const n = new CodeString(this);
        return n.start = e, n.end = t, n
    }
    get length() {
        const e = this.end - this.start;
        return e < 0 ? 0 : e
    }
    char(e) {
        if (this.start !== this.end) return this.ref.str[this.start + e]
    }
    toString() {
        return this.ref.str.substring(this.start, this.end)
    }
    trimStart() {
        const e = /^\s+/.exec(this.toString()),
            t = new CodeString(this);
        return e && (t.start += e[0].length), t
    }
    slice(e, t) {
        return e < 0 && (e = this.end - this.start + e), e < 0 && (e = 0), void 0 === t && (t = this.end - this.start), t < 0 && (t = this.end - this.start + t), t < 0 && (t = 0), this.substring(e, t)
    }
    trim() {
        const e = this.trimStart(),
            t = /\s+$/.exec(e.toString());
        return t && (e.end -= t[0].length), e
    }
    valueOf() {
        return this.toString()
    }
}

function keysOnly(e) {
    const t = Object.assign({}, e);
    for (const e in t) t[e] = !0;
    return t
}
const reservedWords = new Set(["instanceof", "typeof", "return", "throw", "try", "catch", "if", "finally", "else", "in", "of", "var", "let", "const", "for", "delete", "false", "true", "while", "do", "break", "continue", "new", "function", "async", "await", "switch", "case"]);
class Scope {
    constructor(e, t = {}, n) {
        this.const = {}, this.let = {}, this.var = {};
        const r = void 0 !== n || null === e;
        this.parent = e, this.allVars = t, this.let = r ? this.let : keysOnly(t), this.var = r ? keysOnly(t) : this.var, this.globals = null === e ? keysOnly(t) : {}, this.functionThis = n
    }
    get(e, t = !1) {
        const n = this.functionThis;
        if ("this" === e && void 0 !== n) return new Prop({
            this: n
        }, e, !0, !1, !0);
        if (reservedWords.has(e)) throw new SyntaxError("Unexepected token '" + e + "'");
        if (null === this.parent || !t || void 0 !== n) {
            if (this.globals.hasOwnProperty(e)) return new Prop(n, e, !1, !0, !0);
            if (e in this.allVars && (!(e in {}) || this.allVars.hasOwnProperty(e))) return new Prop(this.allVars, e, this.const.hasOwnProperty(e), this.globals.hasOwnProperty(e), !0);
            if (null === this.parent) return new Prop(void 0, e)
        }
        return this.parent.get(e, t)
    }
    set(e, t) {
        if ("this" === e) throw new SyntaxError('"this" cannot be assigned');
        if (reservedWords.has(e)) throw new SyntaxError("Unexepected token '" + e + "'");
        const n = this.get(e);
        if (void 0 === n.context) throw new ReferenceError(`Variable '${e}' was not declared.`);
        if (n.isConst) throw new TypeError(`Cannot assign to const variable '${e}'`);
        if (n.isGlobal) throw new SandboxError(`Cannot override global variable '${e}'`);
        if (!(n.context instanceof Object)) throw new SandboxError("Scope is not an object");
        return n.context[n.prop] = t, n
    }
    declare(e, t, n = undefined, r = !1) {
        if ("this" === e) throw new SyntaxError('"this" cannot be declared');
        if (reservedWords.has(e)) throw new SyntaxError("Unexepected token '" + e + "'");
        if ("var" === t && void 0 === this.functionThis && null !== this.parent) return this.parent.declare(e, t, n, r);
        if ((!this[t].hasOwnProperty(e) || "const" === t || this.globals.hasOwnProperty(e)) && e in this.allVars) throw new SandboxError(`Identifier '${e}' has already been declared`);
        return r && (this.globals[e] = !0), this[t][e] = !0, this.allVars[e] = n, new Prop(this.allVars, e, this.const.hasOwnProperty(e), r)
    }
}
class LocalScope {}
class SandboxError extends Error {}

function isLisp(e) {
    return Array.isArray(e) && "number" == typeof e[0] && 0 !== e[0] && 88 !== e[0]
}
class Prop {
    constructor(e, t, n = !1, r = !1, s = !1) {
        this.context = e, this.prop = t, this.isConst = n, this.isGlobal = r, this.isVariable = s
    }
    get(e) {
        const t = this.context;
        if (void 0 === t) throw new ReferenceError(`${this.prop} is not defined`);
        if (null === t) throw new TypeError(`Cannot read properties of null, (reading '${this.prop}')`);
        return e.getSubscriptions.forEach((e => e(t, this.prop))), t[this.prop]
    }
}
class ExecReturn {
    constructor(e, t, n, r = !1, s = !1) {
        this.auditReport = e, this.result = t, this.returned = n, this.breakLoop = r, this.continueLoop = s
    }
}
const optional = {};

function generateArgs(e, t) {
    const n = {};
    return e.forEach(((e, r) => {
        e.startsWith("...") ? n[e.substring(3)] = t.slice(r) : n[e] = t[r]
    })), n
}
const sandboxedFunctions = new WeakSet;

function createFunction(e, t, n, r, s, i) {
    if (r.ctx.options.forbidFunctionCreation) throw new SandboxError("Function creation is forbidden");
    let o;
    return o = void 0 === i ? (...i) => {
        const o = generateArgs(e, i);
        return executeTree(n, r, t, void 0 === s ? [] : [new Scope(s, o)]).result
    } : function(...i) {
        const o = generateArgs(e, i);
        return executeTree(n, r, t, void 0 === s ? [] : [new Scope(s, o, this)]).result
    }, r.registerSandboxFunction(o), sandboxedFunctions.add(o), o
}

function createFunctionAsync(e, t, n, r, s, i) {
    if (r.ctx.options.forbidFunctionCreation) throw new SandboxError("Function creation is forbidden");
    if (!r.ctx.prototypeWhitelist?.has(Promise.prototype)) throw new SandboxError("Async/await not permitted");
    let o;
    return o = void 0 === i ? async (...i) => {
        const o = generateArgs(e, i);
        return (await executeTreeAsync(n, r, t, void 0 === s ? [] : [new Scope(s, o)])).result
    }: async function(...i) {
        const o = generateArgs(e, i);
        return (await executeTreeAsync(n, r, t, void 0 === s ? [] : [new Scope(s, o, this)])).result
    }, r.registerSandboxFunction(o), sandboxedFunctions.add(o), o
}

function assignCheck(e_prop, t_execCtx, n_opType = "assign") {
    // --- MODIFICATION START ---
    if (void 0 === e_prop.context) {
        if (t_execCtx && t_execCtx.defaultContextForUndeclared) {
            const defaultCtx = t_execCtx.defaultContextForUndeclared;
            const varName = e_prop.prop;

            if (varName === '__proto__' || varName === 'constructor' || varName === 'prototype') {
                throw new SandboxError(`Assignment to forbidden property '${varName}' in default context is not allowed.`);
            }
            e_prop.context = defaultCtx;
            e_prop.isConst = false;
            e_prop.isGlobal = false;
            e_prop.isVariable = true;
        } else {
            throw new ReferenceError(`Cannot ${n_opType} value to undefined.`);
        }
    }
    // --- MODIFICATION END ---

    if ("object" != typeof e_prop.context && "function" != typeof e_prop.context) throw new SyntaxError(`Cannot ${n_opType} value to a primitive.`);
    if (e_prop.isConst) throw new TypeError(`Cannot set value to const variable '${e_prop.prop}'`);
    if (e_prop.isGlobal) throw new SandboxError(`Cannot ${n_opType} property '${e_prop.prop}' of a global object`);
    if (null === e_prop.context) throw new TypeError("Cannot set properties of null");
    if ("function" == typeof e_prop.context[e_prop.prop] && !e_prop.context.hasOwnProperty(e_prop.prop)) throw new SandboxError(`Override prototype property '${e_prop.prop}' not allowed`);
    "delete" === n_opType ? e_prop.context.hasOwnProperty(e_prop.prop) && (t_execCtx.changeSubscriptions.get(e_prop.context)?.forEach((t => t({
        type: "delete",
        prop: e_prop.prop
    }))), t_execCtx.changeSubscriptionsGlobal.get(e_prop.context)?.forEach((t => t({
        type: "delete",
        prop: e_prop.prop
    })))) : e_prop.context.hasOwnProperty(e_prop.prop) ? (t_execCtx.setSubscriptions.get(e_prop.context)?.get(e_prop.prop)?.forEach((e => e({
        type: "replace"
    }))), t_execCtx.setSubscriptionsGlobal.get(e_prop.context)?.get(e_prop.prop)?.forEach((e => e({
        type: "replace"
    })))) : (t_execCtx.changeSubscriptions.get(e_prop.context)?.forEach((t => t({
        type: "create",
        prop: e_prop.prop
    }))), t_execCtx.changeSubscriptionsGlobal.get(e_prop.context)?.forEach((t => t({
        type: "create",
        prop: e_prop.prop
    }))));
}
const arrayChange = new Set([
    [].push, [].pop, [].shift, [].unshift, [].splice, [].reverse, [].sort, [].copyWithin
]);
class KeyVal {
    constructor(e, t) {
        this.key = e, this.val = t
    }
}
class SpreadObject {
    constructor(e) {
        this.item = e
    }
}
class SpreadArray {
    constructor(e) {
        this.item = e
    }
}
class If {
    constructor(e, t) {
        this.t = e, this.f = t
    }
}
const literalRegex = /(\$\$)*(\$)?\${(\d+)}/g,
    ops = new Map;

// --- MODIFICATION START: Define operator set ---
const ASSIGNMENT_LIKE_OPERATORS_AND_DELETE = new Set([
    9,  // =
    25, // ++p (prefix increment)
    26, // p++ (postfix increment)
    27, // --p (prefix decrement)
    28, // p-- (postfix decrement)
    61, // delete
    65, // -=
    66, // +=
    67, // /=
    68, // **=
    69, // *=
    70, // %=
    71, // ^=
    72, // &=
    73, // |=
    74, // >>>=
    75, // >>=
    76  // <<=
]);
// --- MODIFICATION END ---

function addOps(e, t) {
    ops.set(e, t)
}

function valueOrProp(e, t) {
    return e instanceof Prop ? e.get(t) : e !== optional ? e : void 0
}

function execMany(e, t, n, r, s, i, o) {
    t === execSync ? _execManySync(e, n, r, s, i, o) : _execManyAsync(e, n, r, s, i, o).catch(r)
}

function _execManySync(e, t, n, r, s, i) {
    const o = [];
    for (let a = 0; a < t.length; a++) {
        let c;
        try {
            c = syncDone((n => execSync(e, t[a], r, s, n, i))).result
        } catch (e) {
            return void n(e)
        }
        if (c instanceof ExecReturn && (c.returned || c.breakLoop || c.continueLoop)) return void n(void 0, c);
        if (isLisp(t[a]) && 8 === t[a][0]) return void n(void 0, new ExecReturn(s.ctx.auditReport, c, !0));
        o.push(c)
    }
    n(void 0, o)
}
async function _execManyAsync(e, t, n, r, s, i) {
    const o = [];
    for (let a = 0; a < t.length; a++) {
        let c;
        try {
            let n;
            c = !0 === (n = asyncDone((n => execAsync(e, t[a], r, s, n, i)))).isInstant ? n.instant : (await n.p).result
        } catch (e) {
            return void n(e)
        }
        if (c instanceof ExecReturn && (c.returned || c.breakLoop || c.continueLoop)) return void n(void 0, c);
        if (isLisp(t[a]) && 8 === t[a][0]) return void n(void 0, new ExecReturn(s.ctx.auditReport, c, !0));
        o.push(c)
    }
    n(void 0, o)
}

function asyncDone(e) {
    let t, n = !1;
    const r = new Promise(((r, s) => {
        e(((e, i) => {
            e ? s(e) : (n = !0, t = i, r({
                result: i
            }))
        }))
    }));
    return {
        isInstant: n,
        instant: t,
        p: r
    }
}

function syncDone(e) {
    let t, n;
    if (e(((e, r) => {
        n = e, t = r
    })), n) throw n;
    return {
        result: t
    }
}
async function execAsync(e, t, n, r, s, i) { // e=ticks, t=lisp, n=scope, r=execContext, s=callback, i=purpose
    let o_cb = s;
    const a_promise = new Promise((resolve_promise => {
        o_cb = (err, res) => {
            s(err, res), resolve_promise();
        };
    }));

    if (!_execNoneRecurse(e, t, n, r, o_cb, !0, i) && isLisp(t)) {
        let s_lhs_prop_val, a_op = t[0];
        try {
            let res_obj;
            res_obj = asyncDone((cb => execAsync(e, t[1], n, r, cb, i)));
            s_lhs_prop_val = !0 === res_obj.isInstant ? res_obj.instant : (await res_obj.p).result;
        } catch (err) {
            return void o_cb(err);
        }

        let c_rhs_prop_val, p_lhs_resolved_val = s_lhs_prop_val;
        // --- MODIFICATION START for execAsync LHS resolution ---
        if (s_lhs_prop_val instanceof Prop) {
            if (!ASSIGNMENT_LIKE_OPERATORS_AND_DELETE.has(a_op)) {
                try {
                    p_lhs_resolved_val = s_lhs_prop_val.get(r);
                } catch (err) {
                    return void o_cb(err);
                }
            }
        }
        // --- MODIFICATION END for execAsync LHS resolution ---

        if (20 === a_op || 21 === a_op) {
            if (null == p_lhs_resolved_val) return void o_cb(void 0, optional);
            a_op = 20 === a_op ? 1 : 5;
        }

        if (p_lhs_resolved_val === optional) {
            if (1 === a_op || 5 === a_op) return void o_cb(void 0, p_lhs_resolved_val);
            p_lhs_resolved_val = void 0;
        }

        if (t.length > 2) {
            try {
                let res_obj;
                res_obj = asyncDone((cb => execAsync(e, t[2], n, r, cb, i)));
                c_rhs_prop_val = !0 === res_obj.isInstant ? res_obj.instant : (await res_obj.p).result;
            } catch (err) {
                return void o_cb(err);
            }
        } else {
            c_rhs_prop_val = optional;
        }

        let l_rhs_resolved_val = c_rhs_prop_val;
        try {
            l_rhs_resolved_val = c_rhs_prop_val instanceof Prop ? c_rhs_prop_val.get(r) : c_rhs_prop_val;
        } catch (err) {
            return void o_cb(err);
        }

        if (l_rhs_resolved_val === optional && (l_rhs_resolved_val = void 0), ops.has(a_op)) try {
            ops.get(a_op)?.(execAsync, o_cb, e, p_lhs_resolved_val, l_rhs_resolved_val, s_lhs_prop_val, r, n, c_rhs_prop_val, i);
        } catch (err) {
            o_cb(err);
        } else o_cb(new SyntaxError("Unknown operator: " + a_op));
    }
    await a_promise;
}

function execSync(e, t, n, r, s, i) { // e=ticks, t=lisp, n=scope, r=execContext, s=callback, i=purpose
    if (!_execNoneRecurse(e, t, n, r, s, !1, i) && isLisp(t)) {
        let o, a = t[0];
        try {
            o = syncDone((s_cb => execSync(e, t[1], n, r, s_cb, i))).result;
        } catch (err) {
            return void s(err);
        }

        let c, p = o;
        // --- MODIFICATION START for execSync LHS resolution ---
        if (o instanceof Prop) {
            if (!ASSIGNMENT_LIKE_OPERATORS_AND_DELETE.has(a)) {
                try {
                    p = o.get(r);
                } catch (err) {
                    return void s(err);
                }
            }
        }
        // --- MODIFICATION END for execSync LHS resolution ---

        if (20 === a || 21 === a) { // Optional chaining ops (must be after LHS resolution attempt if not assignment)
            if (null == p) return void s(void 0, optional); // p here is the resolved value or the Prop if assignment
            a = 20 === a ? 1 : 5;
        }
        if (p === optional) { // This check is for optional chaining results
            if (1 === a || 5 === a) return void s(void 0, p); // Propagate optional if op is . or ()
            p = void 0; // Otherwise, treat 'optional' as undefined
        }


        if (t.length > 2) {
            try {
                c = syncDone((s_cb => execSync(e, t[2], n, r, s_cb, i))).result;
            } catch (err) {
                return void s(err);
            }
        } else {
            c = optional;
        }

        let l = c;
        try {
            l = c instanceof Prop ? c.get(r) : c;
        } catch (err) {
            return void s(err);
        }

        if (l === optional && (l = void 0), ops.has(a)) try {
            ops.get(a)?.(execSync, s, e, p, l, o, r, n, c, i);
        } catch (err) {
            s(err);
        } else s(new SyntaxError("Unknown operator: " + a));
    }
}
addOps(1, ((e, t, n, r, s, i, o, a) => {
    if (null === r) throw new TypeError(`Cannot get property ${s} of null`);
    const c = typeof r;
    if ("undefined" === c && void 0 === i) {
        const e = a.get(s);
        if (e.context === o.ctx.sandboxGlobal) {
            o.ctx.options.audit && o.ctx.auditReport?.globalsAccess.add(s);
            const e = o.ctx.globalsWhitelist.has(o.ctx.sandboxGlobal[s]) ? o.evals.get(o.ctx.sandboxGlobal[s]) : void 0;
            if (e) return void t(void 0, e)
        }
        return e.context && e.context[s] === globalThis ? void t(void 0, o.ctx.globalScope.get("this")) : void t(void 0, e)
    }
    if (void 0 === r) throw new SandboxError("Cannot get property '" + s + "' of undefined");
    if ("object" !== c) "number" === c ? r = new Number(r) : "string" === c ? r = new String(r) : "boolean" === c && (r = new Boolean(r));
    else if (void 0 === r.hasOwnProperty) return void t(void 0, new Prop(void 0, s));
    const p = "function" === c,
        l = p || !(r.hasOwnProperty(s) || "number" == typeof s);
    if (o.ctx.options.audit && l && "string" == typeof s) {
        let e = Object.getPrototypeOf(r);
        do {
            e.hasOwnProperty(s) && (o.ctx.auditReport && !o.ctx.auditReport.prototypeAccess[e.constructor.name] && (o.ctx.auditReport.prototypeAccess[e.constructor.name] = new Set), o.ctx.auditReport?.prototypeAccess[e.constructor.name].add(s))
        } while (e = Object.getPrototypeOf(e))
    }
    if (l)
        if (p) {
            if (!["name", "length", "constructor"].includes(s) && (r.hasOwnProperty(s) || "__proto__" === s)) {
                const e = o.ctx.prototypeWhitelist.get(r.prototype),
                    n = o.ctx.options.prototypeReplacements.get(r);
                if (n) return void t(void 0, new Prop(n(r, !0), s));
                if (!e || e.size && !e.has(s)) throw new SandboxError(`Static method or property access not permitted: ${r.name}.${s}`)
            }
        } else if ("constructor" !== s) {
            let e = r;
            for (; e = Object.getPrototypeOf(e);)
                if (e.hasOwnProperty(s)) {
                    const n = o.ctx.prototypeWhitelist.get(e),
                        i = o.ctx.options.prototypeReplacements.get(e.constuctor);
                    if (i) return void t(void 0, new Prop(i(r, !1), s));
                    if (n && (!n.size || n.has(s))) break;
                    throw new SandboxError(`Method or property access not permitted: ${e.constructor.name}.${s}`)
                }
        }
    if (o.evals.has(r[s])) return void t(void 0, o.evals.get(r[s]));
    if (r[s] === globalThis) return void t(void 0, o.ctx.globalScope.get("this"));
    const d = i.isGlobal || p && !sandboxedFunctions.has(r) || o.ctx.globalsWhitelist.has(r);
    t(void 0, new Prop(r, s, !1, d))
})), addOps(5, ((e, t, n, r, s, i, o) => {
    if (o.ctx.options.forbidFunctionCalls) throw new SandboxError("Function invocations are not allowed");
    if ("function" != typeof r) throw new TypeError(`${"symbol"==typeof i.prop?"Symbol":i.prop} is not a function`);
    const a = s.map((e => e instanceof SpreadArray ? [...e.item] : [e])).flat().map((e => valueOrProp(e, o)));
    if ("function" != typeof i) {
        if (i.context[i.prop] === JSON.stringify && o.getSubscriptions.size) {
            const e = new Set,
                t = n => {
                    if (n && "object" == typeof n && !e.has(n)) {
                        e.add(n);
                        for (const e of Object.keys(n)) o.getSubscriptions.forEach((t => t(n, e))), t(n[e])
                    }
                };
            t(a[0])
        }
        if (i.context instanceof Array && arrayChange.has(i.context[i.prop]) && (o.changeSubscriptions.get(i.context) || o.changeSubscriptionsGlobal.get(i.context))) {
            let e, t = !1;
            if ("push" === i.prop) e = {
                type: "push",
                added: a
            }, t = !!a.length;
            else if ("pop" === i.prop) e = {
                type: "pop",
                removed: i.context.slice(-1)
            }, t = !!e.removed.length;
            else if ("shift" === i.prop) e = {
                type: "shift",
                removed: i.context.slice(0, 1)
            }, t = !!e.removed.length;
            else if ("unshift" === i.prop) e = {
                type: "unshift",
                added: a
            }, t = !!a.length;
            else if ("splice" === i.prop) e = {
                type: "splice",
                startIndex: a[0],
                deleteCount: void 0 === a[1] ? i.context.length : a[1],
                added: a.slice(2),
                removed: i.context.slice(a[0], void 0 === a[1] ? void 0 : a[0] + a[1])
            }, t = !!e.added.length || !!e.removed.length;
            else if ("reverse" === i.prop || "sort" === i.prop) e = {
                type: i.prop
            }, t = !!i.context.length;
            else if ("copyWithin" === i.prop) {
                const n = void 0 === a[2] ? i.context.length - a[1] : Math.min(i.context.length, a[2] - a[1]);
                e = {
                    type: "copyWithin",
                    startIndex: a[0],
                    endIndex: a[0] + n,
                    added: i.context.slice(a[1], a[1] + n),
                    removed: i.context.slice(a[0], a[0] + n)
                }, t = !!e.added.length || !!e.removed.length
            }
            t && (o.changeSubscriptions.get(i.context)?.forEach((t => t(e))), o.changeSubscriptionsGlobal.get(i.context)?.forEach((t => t(e))))
        }
        i.get(o), t(void 0, i.context[i.prop](...a))
    } else t(void 0, i(...a))
})), addOps(22, ((e, t, n, r, s) => {
    let i = {};
    for (const e of s) e.key instanceof SpreadObject ? i = {
        ...i,
        ...e.key.item
    } : i[e.key] = e.val;
    t(void 0, i)
})), addOps(6, ((e, t, n, r, s) => t(void 0, new KeyVal(r, s)))), addOps(12, ((e, t, n, r, s, i, o) => {
    t(void 0, s.map((e => e instanceof SpreadArray ? [...e.item] : [e])).flat().map((e => valueOrProp(e, o))))
})), addOps(23, ((e, t, n, r, s) => t(void 0, s))), addOps(35, ((e, t, n, r, s) => {
    switch (s) {
        case "true":
            return t(void 0, !0);
        case "false":
            return t(void 0, !1);
        case "null":
            return t(void 0, null);
        case "undefined":
            return t(void 0, void 0);
        case "NaN":
            return t(void 0, NaN);
        case "Infinity":
            return t(void 0, 1 / 0)
    }
    t(new Error("Unknown symbol: " + s))
})), addOps(7, ((e, t, n, r, s) => t(void 0, Number(s)))), addOps(83, ((e, t, n, r, s) => t(void 0, BigInt(s)))), addOps(2, ((e, t, n, r, s, i, o) => t(void 0, o.constants.strings[parseInt(s)]))), addOps(85, ((e, t, n, r, s, i, o) => {
    const a = o.constants.regexes[parseInt(s)];
    if (!o.ctx.globalsWhitelist.has(RegExp)) throw new SandboxError("Regex not permitted");
    t(void 0, new RegExp(a.regex, a.flags))
})), addOps(84, ((e, t, n, r, s, i, o, a) => {
    const c = o.constants.literals[parseInt(s)],
        [, p, l] = c,
        d = [];
    let u;
    const f = [];
    for (; u = literalRegex.exec(p);) u[2] || (d.push(l[parseInt(u[3], 10)]), f.push(u[3]));
    e(n, d, a, o, ((e, n) => {
        const r = {};
        if (e) t(e);
        else {
            for (const e of Object.keys(n)) {
                const t = f[e];
                r[t] = n[e]
            }
            t(void 0, p.replace(/(\\\\)*(\\)?\${(\d+)}/g, ((e, t, n, s) => {
                if (n) return e;
                return (t || "") + `${valueOrProp(r[s],o)}`
            })))
        }
    }))
})), addOps(18, ((e, t, n, r, s) => {
    t(void 0, new SpreadArray(s))
})), addOps(17, ((e, t, n, r, s) => {
    t(void 0, new SpreadObject(s))
})), addOps(24, ((e, t, n, r, s) => t(void 0, !s))), addOps(64, ((e, t, n, r, s) => t(void 0, ~s))), addOps(25, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, ++i.context[i.prop])
})), addOps(26, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop]++)
})), addOps(27, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, --i.context[i.prop])
})), addOps(28, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop]--)
})), addOps(9, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop] = s)
})), addOps(66, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop] += s)
})), addOps(65, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop] -= s)
})), addOps(67, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop] /= s)
})), addOps(69, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop] *= s)
})), addOps(68, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop] **= s)
})), addOps(70, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop] %= s)
})), addOps(71, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop] ^= s)
})), addOps(72, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop] &= s)
})), addOps(73, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop] |= s)
})), addOps(76, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop] <<= s)
})), addOps(75, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop] >>= s)
})), addOps(74, ((e, t, n, r, s, i, o) => {
    assignCheck(i, o), t(void 0, i.context[i.prop] >>= s) // Note: Original code has >>>= for 74, but this op implies >>= as well for some reason. Assuming original mapping is intended.
})), addOps(57, ((e, t, n, r, s) => t(void 0, r > s))), addOps(56, ((e, t, n, r, s) => t(void 0, r < s))), addOps(55, ((e, t, n, r, s) => t(void 0, r >= s))), addOps(54, ((e, t, n, r, s) => t(void 0, r <= s))), addOps(52, ((e, t, n, r, s) => t(void 0, r == s))), addOps(32, ((e, t, n, r, s) => t(void 0, r === s))), addOps(53, ((e, t, n, r, s) => t(void 0, r != s))), addOps(31, ((e, t, n, r, s) => t(void 0, r !== s))), addOps(29, ((e, t, n, r, s) => t(void 0, r && s))), addOps(30, ((e, t, n, r, s) => t(void 0, r || s))), addOps(77, ((e, t, n, r, s) => t(void 0, r & s))), addOps(78, ((e, t, n, r, s) => t(void 0, r | s))), addOps(33, ((e, t, n, r, s) => t(void 0, r + s))), addOps(47, ((e, t, n, r, s) => t(void 0, r - s))), addOps(59, ((e, t, n, r, s) => t(void 0, +s))), addOps(58, ((e, t, n, r, s) => t(void 0, -s))), addOps(48, ((e, t, n, r, s) => t(void 0, r / s))), addOps(79, ((e, t, n, r, s) => t(void 0, r ^ s))), addOps(50, ((e, t, n, r, s) => t(void 0, r * s))), addOps(51, ((e, t, n, r, s) => t(void 0, r % s))), addOps(80, ((e, t, n, r, s) => t(void 0, r << s))), addOps(81, ((e, t, n, r, s) => t(void 0, r >> s))), addOps(82, ((e, t, n, r, s) => t(void 0, r >>> s))), addOps(60, ((e, t, n, r, s, i, o, a) => {
    e(n, s, a, o, ((e, n) => {
        t(void 0, typeof valueOrProp(n, o))
    }))
})), addOps(62, ((e, t, n, r, s) => t(void 0, r instanceof s))), addOps(63, ((e, t, n, r, s) => t(void 0, r in s))), addOps(61, ((e, t, n, r_val_lhs, s_val_rhs, i_prop_lhs, o_execCtx, a_scope, c_prop_rhs, p_purpose) => {
    if (void 0 !== i_prop_lhs.context) {
        assignCheck(i_prop_lhs, o_execCtx, "delete");
        if (i_prop_lhs.isVariable) {
            t(void 0, !1);
        } else {
            t(void 0, delete i_prop_lhs.context?.[i_prop_lhs.prop]);
        }
    } else {
        t(void 0, !0);
    }
})), addOps(8, ((e, t, n, r, s) => t(void 0, s))), addOps(34, ((e, t, n, r, s, i, o, a) => {
    t(void 0, a.declare(r, "var", s))
})), addOps(3, ((e, t, n, r, s, i, o, a, c) => {
    t(void 0, a.declare(r, "let", s, c && c.isGlobal))
})), addOps(4, ((e, t, n, r, s, i, o, a) => {
    t(void 0, a.declare(r, "const", s))
})), addOps(11, ((e, t, n, r, s, i, o, a) => {
    if (r = [...r], "string" == typeof i[2] || i[2] instanceof CodeString) {
        if (!o.allowJit || !o.evalContext) throw new SandboxError("Unevaluated code detected, JIT not allowed");
        i[2] = s = o.evalContext.lispifyFunction(new CodeString(i[2]), o.constants)
    }
    r.shift() ? t(void 0, createFunctionAsync(r, s, n, o, a)) : t(void 0, createFunction(r, s, n, o, a))
})), addOps(37, ((e, t, n, r, s, i, o, a) => {
    if ("string" == typeof i[2] || i[2] instanceof CodeString) {
        if (!o.allowJit || !o.evalContext) throw new SandboxError("Unevaluated code detected, JIT not allowed");
        i[2] = s = o.evalContext.lispifyFunction(new CodeString(i[2]), o.constants)
    }
    const c = r.shift(),
        p = r.shift();
    let l;
    l = 88 === c ? createFunctionAsync(r, s, n, o, a, p) : createFunction(r, s, n, o, a, p), p && a.declare(p, "var", l), t(void 0, l)
})), addOps(10, ((e, t, n, r, s, i, o, a) => {
    if ("string" == typeof i[2] || i[2] instanceof CodeString) {
        if (!o.allowJit || !o.evalContext) throw new SandboxError("Unevaluated code detected, JIT not allowed");
        i[2] = s = o.evalContext.lispifyFunction(new CodeString(i[2]), o.constants)
    }
    const c = r.shift(),
        p = r.shift();
    let l;
    p && (a = new Scope(a, {})), l = 88 === c ? createFunctionAsync(r, s, n, o, a, p) : createFunction(r, s, n, o, a, p), p && a.declare(p, "let", l), t(void 0, l)
})), addOps(38, ((e, t, n, r, s, i, o, a) => {
    const [c, p, l, d, u, f, h] = r;
    let g = !0;
    const x = new Scope(a, {}),
        y = {
            $$obj: void 0
        },
        b = new Scope(x, y);
    if (e === execAsync)(async () => {
        let r;
        for (r = asyncDone((t => e(n, d, x, o, t))), y.$$obj = !0 === (r = asyncDone((t => e(n, l, x, o, t)))).isInstant ? r.instant : (await r.p).result, r = asyncDone((t => e(n, p, b, o, t))), c && (g = !0 === (r = asyncDone((t => e(n, f, b, o, t)))).isInstant ? r.instant : (await r.p).result); g;) {
            const i = {};
            r = asyncDone((t => e(n, h, new Scope(b, i), o, t))), !0 === r.isInstant ? r.instant : (await r.p).result;
            const a = await executeTreeAsync(n, o, s, [new Scope(x, i)], "loop");
            if (a instanceof ExecReturn && a.returned) return void t(void 0, a);
            if (a instanceof ExecReturn && a.breakLoop) break;
            r = asyncDone((t => e(n, u, b, o, t))), g = !0 === (r = asyncDone((t => e(n, f, b, o, t)))).isInstant ? r.instant : (await r.p).result
        }
        t()
    })().catch(t);
    else {
        for (syncDone((t => e(n, d, x, o, t))), y.$$obj = syncDone((t => e(n, l, x, o, t))).result, syncDone((t => e(n, p, b, o, t))), c && (g = syncDone((t => e(n, f, b, o, t))).result); g;) {
            const r = {};
            syncDone((t => e(n, h, new Scope(b, r), o, t)));
            const i = executeTree(n, o, s, [new Scope(x, r)], "loop");
            if (i instanceof ExecReturn && i.returned) return void t(void 0, i);
            if (i instanceof ExecReturn && i.breakLoop) break;
            syncDone((t => e(n, u, b, o, t))), g = syncDone((t => e(n, f, b, o, t))).result
        }
        t()
    }
})), addOps(86, ((e, t, n, r, s, i, o, a, c, p) => {
    if ("switch" === p && "continue" === r || !p) throw new SandboxError("Illegal " + r + " statement");
    t(void 0, new ExecReturn(o.ctx.auditReport, void 0, !1, "break" === r, "continue" === r))
})), addOps(13, ((e, t, n, r, s, i, o, a) => {
    e(n, valueOrProp(r, o) ? s.t : s.f, a, o, t)
})), addOps(15, ((e, t, n, r, s, i, o, a) => {
    e(n, valueOrProp(r, o) ? s.t : s.f, a, o, t)
})), addOps(16, ((e, t, n, r, s) => t(void 0, new If(r, s)))), addOps(14, ((e, t, n, r, s) => t(void 0, new If(r, s)))), addOps(40, ((e, t, n, r, s, i, o, a) => {
    e(n, r, a, o, ((r, i) => {
        if (r) t(r);
        else if (i = valueOrProp(i, o), e === execSync) {
            let r, c = !1;
            for (const p of s)
                if (c || (c = !p[1] || i === valueOrProp(syncDone((t => e(n, p[1], a, o, t))).result, o))) {
                    if (!p[2]) continue;
                    if (r = executeTree(n, o, p[2], [a], "switch"), r.breakLoop) break;
                    if (r.returned) return void t(void 0, r);
                    if (!p[1]) break
                } t()
        } else(async () => {
            let r, c = !1;
            for (const p of s) {
                let s;
                if (c || (c = !p[1] || i === valueOrProp(!0 === (s = asyncDone((t => e(n, p[1], a, o, t)))).isInstant ? s.instant : (await s.p).result, o))) {
                    if (!p[2]) continue;
                    if (r = await executeTreeAsync(n, o, p[2], [a], "switch"), r.breakLoop) break;
                    if (r.returned) return void t(void 0, r);
                    if (!p[1]) break
                }
            }
            t()
        })().catch(t)
    }))
})), addOps(39, ((e, t, n, r, s, i, o, a, c, p) => {
    const [l, d, u] = s;
    executeTreeWithDone(e, ((r, s) => {
        executeTreeWithDone(e, (i => {
            i ? t(i) : r ? executeTreeWithDone(e, t, n, o, d, [new Scope(a)], p) : t(void 0, s)
        }), n, o, u, [new Scope(a, {})])
    }), n, o, r, [new Scope(a)], p)
})), addOps(87, ((e, t) => {
    t()
})), addOps(45, ((e, t, n, r, s, i, o) => {
    if (!o.ctx.globalsWhitelist.has(r) && !sandboxedFunctions.has(r)) throw new SandboxError(`Object construction not allowed: ${r.constructor.name}`);
    t(void 0, new r(...s))
})), addOps(46, ((e, t, n, r, s) => {
    t(s)
})), addOps(43, ((e, t, n, r) => t(void 0, r.pop()))), addOps(0, ((e, t) => t()));
const unexecTypes = new Set([11, 37, 10, 38, 39, 40, 14, 16, 60]),
    currentTicks = {
        current: {
            ticks: BigInt(0)
        }
    };

function _execNoneRecurse(e, t, n, r, s, i, o) {
    const a = i ? execAsync : execSync;
    if (r.ctx.options.executionQuota && r.ctx.options.executionQuota <= e.ticks && ("function" != typeof r.ctx.options.onExecutionQuotaReached || !r.ctx.options.onExecutionQuotaReached(e, n, r, t))) return s(new SandboxError("Execution quota exceeded")), !0;
    if (e.ticks++, currentTicks.current = e, t instanceof Prop) try {
        s(void 0, t.get(r))
    } catch (e) {
        s(e)
    } else if (t === optional) s();
    else if (Array.isArray(t) && !isLisp(t)) 0 === t[0] ? s() : execMany(e, a, t, s, n, r, o);
    else if (isLisp(t))
        if (42 === t[0]) execMany(e, a, t[1], s, n, r, o);
        else if (44 === t[0]) i ? r.ctx.prototypeWhitelist?.has(Promise.prototype) ? execAsync(e, t[1], n, r, (async (e, t) => {
            if (e) s(e);
            else try {
                s(void 0, await valueOrProp(t, r))
            } catch (e) {
                s(e)
            }
        }), o).catch(s) : s(new SandboxError("Async/await is not permitted")) : s(new SandboxError("Illegal use of 'await', must be inside async function"));
        else {
            if (!unexecTypes.has(t[0])) return !1;
            try {
                ops.get(t[0])?.(a, s, e, t[1], t[2], t, r, n, void 0, o)
            } catch (e) {
                s(e)
            }
        } else s(void 0, t);
    return !0
}

function executeTree(e, t, n, r = [], s) {
    return syncDone((i => executeTreeWithDone(execSync, i, e, t, n, r, s))).result
}
async function executeTreeAsync(e, t, n, r = [], s) {
    let i;
    return !0 === (i = asyncDone((i => executeTreeWithDone(execAsync, i, e, t, n, r, s)))).isInstant ? i.instant : (await i.p).result
}

function executeTreeWithDone(e, t, n, r, s, i = [], o) { // r is execContext, i is scopes array
    if (!s) return void t();
    if (!(s instanceof Array)) throw new SyntaxError("Bad execution tree");

    // --- MODIFICATION START ---
    if (i.length > 0 && typeof i[0] === 'object' && i[0] !== null &&
        !(i[0] instanceof Scope) && !(i[0] instanceof LocalScope)) {
        r.defaultContextForUndeclared = i[0];
    } else {
        r.defaultContextForUndeclared = null;
    }
    // --- MODIFICATION END ---

    let a, c = r.ctx.globalScope;
    for (; a = i.shift();) {
        if ("object" == typeof a) {
            c = a instanceof Scope ? a : new Scope(c, a, a instanceof LocalScope ? void 0 : null);
        }
    }

    r.ctx.options.audit && !r.ctx.auditReport && (r.ctx.auditReport = {
        globalsAccess: new Set,
        prototypeAccess: {}
    });
    e === execSync ? _executeWithDoneSync(t, n, r, s, c, o) : _executeWithDoneAsync(t, n, r, s, c, o).catch(t);
}


function _executeWithDoneSync(e, t, n, r, s, i) {
    if (!(r instanceof Array)) throw new SyntaxError("Bad execution tree");
    let o = 0;
    for (o = 0; o < r.length; o++) {
        let a, c;
        const p = r[o];
        try {
            execSync(t, p, s, n, ((e, t) => {
                c = e, a = t
            }), i)
        } catch (e) {
            c = e
        }
        if (c) return void e(c);
        if (a instanceof ExecReturn) return void e(void 0, a);
        if (isLisp(p) && 8 === p[0]) return void e(void 0, new ExecReturn(n.ctx.auditReport, a, !0))
    }
    e(void 0, new ExecReturn(n.ctx.auditReport, void 0, !1))
}
async function _executeWithDoneAsync(e, t, n, r, s, i) {
    if (!(r instanceof Array)) throw new SyntaxError("Bad execution tree");
    let o = 0;
    for (o = 0; o < r.length; o++) {
        let a, c;
        const p = r[o];
        try {
            await execAsync(t, p, s, n, ((e, t) => {
                c = e, a = t
            }), i)
        } catch (e) {
            c = e
        }
        if (c) return void e(c);
        if (a instanceof ExecReturn) return void e(void 0, a);
        if (isLisp(p) && 8 === p[0]) return void e(void 0, new ExecReturn(n.ctx.auditReport, a, !0))
    }
    e(void 0, new ExecReturn(n.ctx.auditReport, void 0, !1))
}

function parseHexToInt(e) {
    return !e.match(/[^a-f0-9]/i) ? parseInt(e, 16) : NaN
}

function validateAndParseHex(e, t, n) {
    const r = parseHexToInt(e);
    if (Number.isNaN(r) || void 0 !== n && n !== e.length) throw new SyntaxError(t + ": " + e);
    return r
}

function parseHexadecimalCode(e) {
    const t = validateAndParseHex(e, "Malformed Hexadecimal", 2);
    return String.fromCharCode(t)
}

function parseUnicodeCode(e, t) {
    const n = validateAndParseHex(e, "Malformed Unicode", 4);
    if (void 0 !== t) {
        const e = validateAndParseHex(t, "Malformed Unicode", 4);
        return String.fromCharCode(n, e)
    }
    return String.fromCharCode(n)
}

function isCurlyBraced(e) {
    return "{" === e.charAt(0) && "}" === e.charAt(e.length - 1)
}

function parseUnicodeCodePointCode(e) {
    if (!isCurlyBraced(e)) throw new SyntaxError("Malformed Unicode: +" + e);
    const t = validateAndParseHex(e.slice(1, -1), "Malformed Unicode");
    try {
        return String.fromCodePoint(t)
    } catch (e) {
        throw e instanceof RangeError ? new SyntaxError("Code Point Limit:" + t) : e
    }
}
const singleCharacterEscapes = new Map([
    ["b", "\b"],
    ["f", "\f"],
    ["n", "\n"],
    ["r", "\r"],
    ["t", "\t"],
    ["v", "\v"],
    ["0", "\0"]
]);

function parseSingleCharacterCode(e) {
    return singleCharacterEscapes.get(e) || e
}
const escapeMatch = /\\(?:(\\)|x([\s\S]{0,2})|u(\{[^}]*\}?)|u([\s\S]{4})\\u([^{][\s\S]{0,3})|u([\s\S]{0,4})|([0-3]?[0-7]{1,2})|([\s\S])|$)/g;

function unraw(e) {
    return e.replace(escapeMatch, (function(e, t, n, r, s, i, o, a, c) {
        if (void 0 !== t) return "\\";
        if (void 0 !== n) return parseHexadecimalCode(n);
        if (void 0 !== r) return parseUnicodeCodePointCode(r);
        if (void 0 !== s) return parseUnicodeCode(s, i);
        if (void 0 !== o) return parseUnicodeCode(o);
        if ("0" === a) return "\0";
        if (void 0 !== a) throw new SyntaxError("Octal Deprecation: " + a);
        if (void 0 !== c) return parseSingleCharacterCode(c);
        throw new SyntaxError("End of string")
    }))
}

function createLisp(e) {
    return [e.op, e.a, e.b]
}
const NullLisp = createLisp({
        op: 0,
        a: 0,
        b: 0
    }),
    lispTypes = new Map;
class ParseError extends Error {
    constructor(e, t) {
        super(e + ": " + t.substring(0, 40)), this.code = t
    }
}
let lastType;
const inlineIfElse = /^:/,
    elseIf = /^else(?![\w$])/,
    ifElse = /^if(?![\w$])/,
    space = /^\s/,
    expectTypes = {
        splitter: {
            types: {
                opHigh: /^(\/|\*\*|\*(?!\*)|%)(?!=)/,
                op: /^(\+(?!(\+))|-(?!(-)))(?!=)/,
                comparitor: /^(<=|>=|<(?!<)|>(?!>)|!==|!=(?!=)|===|==)/,
                boolOp: /^(&&|\|\||instanceof(?![\w$])|in(?![\w$]))/,
                bitwise: /^(&(?!&)|\|(?!\|)|\^|<<|>>(?!>)|>>>)(?!=)/
            },
            next: ["modifier", "value", "prop", "incrementerBefore"]
        },
        inlineIf: {
            types: {
                inlineIf: /^\?(?!\.(?!\d))/
            },
            next: ["expEnd"]
        },
        assignment: {
            types: {
                assignModify: /^(-=|\+=|\/=|\*\*=|\*=|%=|\^=|&=|\|=|>>>=|>>=|<<=)/,
                assign: /^(=)(?!=)/
            },
            next: ["modifier", "value", "prop", "incrementerBefore"]
        },
        incrementerBefore: {
            types: {
                incrementerBefore: /^(\+\+|--)/
            },
            next: ["prop"]
        },
        expEdge: {
            types: {
                call: /^(\?\.)?[(]/,
                incrementerAfter: /^(\+\+|--)/
            },
            next: ["splitter", "expEdge", "dot", "inlineIf", "expEnd"]
        },
        modifier: {
            types: {
                not: /^!/,
                inverse: /^~/,
                negative: /^-(?!-)/,
                positive: /^\+(?!\+)/,
                typeof: /^typeof(?![\w$])/,
                delete: /^delete(?![\w$])/
            },
            next: ["modifier", "value", "prop", "incrementerBefore"]
        },
        dot: {
            types: {
                arrayProp: /^(\?\.)?\[/,
                dot: /^(\?)?\.(?=\s*[a-zA-Z$_])/
            },
            next: ["splitter", "assignment", "expEdge", "dot", "inlineIf", "expEnd"]
        },
        prop: {
            types: {
                prop: /^[a-zA-Z$_][a-zA-Z\d$_]*/
            },
            next: ["splitter", "assignment", "expEdge", "dot", "inlineIf", "expEnd"]
        },
        value: {
            types: {
                createObject: /^\{/,
                createArray: /^\[/,
                number: /^(0x[\da-f]+(_[\da-f]+)*|(\d+(_\d+)*(\.\d+(_\d+)*)?|\.\d+(_\d+)*))(e[+-]?\d+(_\d+)*)?(n)?(?!\d)/i,
                string: /^"(\d+)"/,
                literal: /^`(\d+)`/,
                regex: /^\/(\d+)\/r(?![\w$])/,
                boolean: /^(true|false)(?![\w$])/,
                null: /^null(?![\w$])/,
                und: /^undefined(?![\w$])/,
                arrowFunctionSingle: /^(async\s+)?([a-zA-Z$_][a-zA-Z\d$_]*)\s*=>\s*({)?/,
                arrowFunction: /^(async\s*)?\(\s*((\.\.\.)?\s*[a-zA-Z$_][a-zA-Z\d$_]*(\s*,\s*(\.\.\.)?\s*[a-zA-Z$_][a-zA-Z\d$_]*)*)?\s*\)\s*=>\s*({)?/,
                inlineFunction: /^(async\s+)?function(\s*[a-zA-Z$_][a-zA-Z\d$_]*)?\s*\(\s*((\.\.\.)?\s*[a-zA-Z$_][a-zA-Z\d$_]*(\s*,\s*(\.\.\.)?\s*[a-zA-Z$_][a-zA-Z\d$_]*)*)?\s*\)\s*{/,
                group: /^\(/,
                NaN: /^NaN(?![\w$])/,
                Infinity: /^Infinity(?![\w$])/,
                void: /^void(?![\w$])\s*/,
                await: /^await(?![\w$])\s*/,
                new: /^new(?![\w$])\s*/
            },
            next: ["splitter", "expEdge", "dot", "inlineIf", "expEnd"]
        },
        initialize: {
            types: {
                initialize: /^(var|let|const)\s+([a-zA-Z$_][a-zA-Z\d$_]*)\s*(=)?/,
                return: /^return(?![\w$])/,
                throw: /^throw(?![\w$])\s*/
            },
            next: ["modifier", "value", "prop", "incrementerBefore", "expEnd"]
        },
        spreadObject: {
            types: {
                spreadObject: /^\.\.\./
            },
            next: ["value", "prop"]
        },
        spreadArray: {
            types: {
                spreadArray: /^\.\.\./
            },
            next: ["value", "prop"]
        },
        expEnd: {
            types: {},
            next: []
        },
        expFunction: {
            types: {
                function: /^(async\s+)?function(\s*[a-zA-Z$_][a-zA-Z\d$_]*)\s*\(\s*((\.\.\.)?\s*[a-zA-Z$_][a-zA-Z\d$_]*(\s*,\s*(\.\.\.)?\s*[a-zA-Z$_][a-zA-Z\d$_]*)*)?\s*\)\s*{/
            },
            next: ["expEdge", "expEnd"]
        },
        expSingle: {
            types: {
                for: /^(([a-zA-Z$_][\w$]*)\s*:)?\s*for\s*\(/,
                do: /^(([a-zA-Z$_][\w$]*)\s*:)?\s*do(?![\w$])\s*(\{)?/,
                while: /^(([a-zA-Z$_][\w$]*)\s*:)?\s*while\s*\(/,
                loopAction: /^(break|continue)(?![\w$])\s*([a-zA-Z$_][\w$]*)?/,
                if: /^((([a-zA-Z$_][\w$]*)\s*:)?\s*)if\s*\(/,
                try: /^try\s*{/,
                block: /^{/,
                switch: /^(([a-zA-Z$_][\w$]*)\s*:)?\s*switch\s*\(/
            },
            next: ["expEnd"]
        }
    },
    closings = {
        "(": ")",
        "[": "]",
        "{": "}",
        "'": "'",
        '"': '"',
        "`": "`"
    };

function testMultiple(e, t) {
    let n = null;
    for (let r = 0; r < t.length; r++) {
        if (n = t[r].exec(e), n) break
    }
    return n
}
const emptyString = new CodeString(""),
    okFirstChars = /^[+\-~ !]/,
    aNumber = expectTypes.value.types.number,
    wordReg = /^((if|for|else|while|do|function)(?![\w$])|[\w$]+)/,
    semiColon = /^;/,
    insertedSemicolons = new WeakMap,
    quoteCache = new WeakMap;

function restOfExp(e, t, n, r, s, i, o = {}) {
    if (!t.length) return t;
    o.words = o.words || [];
    let a = !0;
    const c = (n = n || []).includes(semiColon);
    c && (n = n.filter((e => e !== semiColon)));
    const p = insertedSemicolons.get(t.ref) || [],
        l = quoteCache.get(t.ref) || new Map;
    if (quoteCache.set(t.ref, l), r && l.has(t.start - 1)) return t.substring(0, l.get(t.start - 1) - t.start);
    let d, u = !1,
        f = !1,
        h = "",
        g = !1,
        x = !1;
    for (d = 0; d < t.length && !f; d++) {
        let y = t.char(d);
        if ('"' === r || "'" === r || "`" === r) {
            if ("`" !== r || "$" !== y || "{" !== t.char(d + 1) || u) {
                if (y === r && !u) return t.substring(0, d)
            } else {
                d += restOfExp(e, t.substring(d + 2), [], "{").length + 2
            }
            u = !u && "\\" === y
        } else if (closings[y]) {
            if (!x && p[d + t.start]) {
                if (x = !0, c) break;
                d--, h = ";";
                continue
            }
            if (g && "{" === y && (g = !1), y === s) {
                f = !0;
                break
            } {
                const n = restOfExp(e, t.substring(d + 1), [], y);
                if (l.set(n.start - 1, n.end), d += n.length + 1, a = !1, i) {
                    let e;
                    (e = testMultiple(t.substring(d).toString(), i)) && (o.regRes = e, f = !0)
                }
            }
        } else if (r) {
            if (y === closings[r]) return t.substring(0, d)
        } else {
            let e, r, s = t.substring(d).toString();
            if (i) {
                let e;
                if (e = testMultiple(s, i)) {
                    o.regRes = e, d++, f = !0;
                    break
                }
            }
            if (r = aNumber.exec(s)) d += r[0].length - 1, s = t.substring(d).toString();
            else if (h != y) {
                let r = null;
                if (";" === y || p[d + t.start] && !a && !x) {
                    if (c) r = [";"];
                    else if (p[d + t.start]) {
                        x = !0, d--, h = ";";
                        continue
                    }
                    y = s = ";"
                } else x = !1;
                r || (r = testMultiple(s, n)), r && (f = !0), !f && (e = wordReg.exec(s)) && (g = !0, e[0].length > 1 && (o.words.push(e[1]), o.lastAnyWord = e[1], e[2] && (o.lastWord = e[2])), e[0].length > 2 && (d += e[0].length - 2))
            }
            if (a && (okFirstChars.test(s) ? f = !1 : a = !1), f) break
        }
        h = y
    }
    if (r) throw new SyntaxError("Unclosed '" + r + "'");
    return o && (o.oneliner = g), t.substring(0, d)
}
restOfExp.next = ["splitter", "expEnd", "inlineIf"];
const startingExecpted = ["initialize", "expSingle", "expFunction", "value", "modifier", "prop", "incrementerBefore", "expEnd"],
    setLispType = (e, t) => {
        e.forEach((e => {
            lispTypes.set(e, t)
        }))
    },
    closingsCreate = {
        createArray: /^\]/,
        createObject: /^\}/,
        group: /^\)/,
        arrayProp: /^\]/,
        call: /^\)/
    },
    typesCreate = {
        createArray: 12,
        createObject: 22,
        group: 23,
        arrayProp: 19,
        call: 5,
        prop: 1,
        "?prop": 20,
        "?call": 21
    };
setLispType(["createArray", "createObject", "group", "arrayProp", "call"], ((e, t, n, r, s, i) => {
    let o = emptyString;
    const a = [];
    let c = !1,
        p = r[0].length;
    const l = p;
    for (; p < n.length && !c;) o = restOfExp(e, n.substring(p), [closingsCreate[t], /^,/]), p += o.length, o.trim().length && a.push(o), "," !== n.char(p) ? c = !0 : p++;
    const d = ["value", "modifier", "prop", "incrementerBefore", "expEnd"];
    let u, f;
    switch (t) {
        case "group":
        case "arrayProp":
            u = lispifyExpr(e, n.substring(l, p));
            break;
        case "call":
        case "createArray":
            u = a.map((t => lispify(e, t, [...d, "spreadArray"])));
            break;
        case "createObject":
            u = a.map((t => {
                let n;
                t = t.trimStart();
                let r = "";
                if (f = expectTypes.expFunction.types.function.exec("function " + t), f) r = f[2].trimStart(), n = lispify(e, new CodeString("function " + t.toString().replace(r, "")));
                else {
                    const s = restOfExp(e, t, [/^:/]);
                    r = lispify(e, s, [...d, "spreadObject"]), 1 === r[0] && (r = r[2]), n = lispify(e, t.substring(s.length + 1))
                }
                return createLisp({
                    op: 6,
                    a: r,
                    b: n
                })
            }))
    }
    const h = "arrayProp" === t ? r[1] ? 20 : 1 : "call" === t ? r[1] ? 21 : 5 : typesCreate[t];
    i.lispTree = lispify(e, n.substring(p + 1), expectTypes[s].next, createLisp({
        op: h,
        a: i.lispTree,
        b: u
    }))
}));
const modifierTypes = {
    inverse: 64,
    not: 24,
    positive: 59,
    negative: 58,
    typeof: 60,
    delete: 61
};
setLispType(["inverse", "not", "negative", "positive", "typeof", "delete"], ((e, t, n, r, s, i) => {
    const o = restOfExp(e, n.substring(r[0].length), [/^([^\s.?\w$]|\?[^.])/]);
    i.lispTree = lispify(e, n.substring(o.length + r[0].length), restOfExp.next, createLisp({
        op: modifierTypes[t],
        a: i.lispTree,
        b: lispify(e, o, expectTypes[s].next)
    }))
}));
const incrementTypes = {
    "++$": 25,
    "--$": 27,
    "$++": 26,
    "$--": 28
};
setLispType(["incrementerBefore"], ((e, t, n, r, s, i) => {
    const o = restOfExp(e, n.substring(2), [/^[^\s.\w$]/]);
    i.lispTree = lispify(e, n.substring(o.length + 2), restOfExp.next, createLisp({
        op: incrementTypes[r[0] + "$"],
        a: lispify(e, o, expectTypes[s].next),
        b: 0
    }))
})), setLispType(["incrementerAfter"], ((e, t, n, r, s, i) => {
    i.lispTree = lispify(e, n.substring(r[0].length), expectTypes[s].next, createLisp({
        op: incrementTypes["$" + r[0]],
        a: i.lispTree,
        b: 0
    }))
}));
const adderTypes = {
    "&&": 29,
    "||": 30,
    instanceof: 62,
    in: 63,
    "=": 9,
    "-=": 65,
    "+=": 66,
    "/=": 67,
    "**=": 68,
    "*=": 69,
    "%=": 70,
    "^=": 71,
    "&=": 72,
    "|=": 73,
    ">>>=": 74,
    "<<=": 76,
    ">>=": 75
};
setLispType(["assign", "assignModify", "boolOp"], ((e, t, n, r, s, i) => {
    i.lispTree = createLisp({
        op: adderTypes[r[0]],
        a: i.lispTree,
        b: lispify(e, n.substring(r[0].length), expectTypes[s].next)
    })
}));
const opTypes = {
    "&": 77,
    "|": 78,
    "^": 79,
    "<<": 80,
    ">>": 81,
    ">>>": 82,
    "<=": 54,
    ">=": 55,
    "<": 56,
    ">": 57,
    "!==": 31,
    "!=": 53,
    "===": 32,
    "==": 52,
    "+": 33,
    "-": 47,
    "/": 48,
    "**": 49,
    "*": 50,
    "%": 51
};

function extractIfElse(e, t) {
    let n, r, s = 0,
        i = t.substring(0, 0),
        o = emptyString,
        a = !0,
        c = {};
    for (;
        (i = restOfExp(e, t.substring(i.end - t.start), [elseIf, ifElse, semiColon], void 0, void 0, void 0, c)).length || a;) {
        a = !1;
        const p = t.substring(i.end - t.start).toString();
        if (p.startsWith("if")) i.end++, s++;
        else if (p.startsWith("else")) n = t.substring(0, i.end - t.start), i.end++, s--, s || i.end--;
        else {
            if (!(r = /^;?\s*else(?![\w$])/.exec(p))) {
                n = o.length ? n : t.substring(0, i.end - t.start);
                break
            }
            n = t.substring(0, i.end - t.start), i.end += r[0].length - 1, s--, s || (i.end -= r[0].length - 1)
        }
        if (!s) {
            o = extractIfElse(e, t.substring(i.end - t.start + (/^;?\s*else(?![\w$])/.exec(p)?.[0].length || 0))).all;
            break
        }
        c = {}
    }
    return n = n || t.substring(0, i.end - t.start), {
        all: t.substring(0, Math.max(n.end, o.end) - t.start),
        true: n,
        false: o
    }
}
setLispType(["opHigh", "op", "comparitor", "bitwise"], ((e, t, n, r, s, i) => {
    const o = [expectTypes.inlineIf.types.inlineIf, inlineIfElse];
    switch (t) {
        case "opHigh":
            o.push(expectTypes.splitter.types.opHigh);
        case "op":
            o.push(expectTypes.splitter.types.op);
        case "comparitor":
            o.push(expectTypes.splitter.types.comparitor);
        case "bitwise":
            o.push(expectTypes.splitter.types.bitwise), o.push(expectTypes.splitter.types.boolOp)
    }
    const a = restOfExp(e, n.substring(r[0].length), o);
    i.lispTree = lispify(e, n.substring(a.length + r[0].length), restOfExp.next, createLisp({
        op: opTypes[r[0]],
        a: i.lispTree,
        b: lispify(e, a, expectTypes[s].next)
    }))
})), setLispType(["inlineIf"], ((e, t, n, r, s, i) => {
    let o = !1;
    const a = n.substring(0, 0);
    let c = 1;
    for (; !o && a.length < n.length;) a.end = restOfExp(e, n.substring(a.length + 1), [expectTypes.inlineIf.types.inlineIf, inlineIfElse]).end, "?" === n.char(a.length) ? c++ : c--, c || (o = !0);
    a.start = n.start + 1, i.lispTree = createLisp({
        op: 15,
        a: i.lispTree,
        b: createLisp({
            op: 16,
            a: lispifyExpr(e, a),
            b: lispifyExpr(e, n.substring(r[0].length + a.length + 1))
        })
    })
})), setLispType(["if"], ((e, t, n, r, s, i) => {
    let o = restOfExp(e, n.substring(r[0].length), [], "(");
    const a = extractIfElse(e, n.substring(r[1].length)),
        c = r[0].length - r[1].length + o.length + 1;
    let p = a.true.substring(c),
        l = a.false;
    o = o.trim(), p = p.trim(), l = l.trim(), "{" === p.char(0) && (p = p.slice(1, -1)), "{" === l.char(0) && (l = l.slice(1, -1)), i.lispTree = createLisp({
        op: 13,
        a: lispifyExpr(e, o),
        b: createLisp({
            op: 14,
            a: lispifyBlock(p, e),
            b: lispifyBlock(l, e)
        })
    })
})), setLispType(["switch"], ((e, t, n, r, s, i) => {
    const o = restOfExp(e, n.substring(r[0].length), [], "(");
    let a = n.toString().indexOf("{", r[0].length + o.length + 1);
    if (-1 === a) throw new SyntaxError("Invalid switch");
    let c, p = insertSemicolons(e, restOfExp(e, n.substring(a + 1), [], "{"));
    const l = /^\s*(case\s|default)\s*/,
        d = [];
    let u = !1;
    for (; c = l.exec(p.toString());) {
        if ("default" === c[1]) {
            if (u) throw new SyntaxError("Only one default switch case allowed");
            u = !0
        }
        const t = restOfExp(e, p.substring(c[0].length), [/^:/]);
        let n = emptyString,
            r = a = c[0].length + t.length + 1;
        const s = /^\s*\{/.exec(p.substring(r).toString());
        let i = [];
        if (s) r += s[0].length, n = restOfExp(e, p.substring(r), [], "{"), r += n.length + 1, i = lispifyBlock(n, e);
        else {
            const t = restOfExp(e, p.substring(r), [l]);
            if (t.trim().length) {
                for (;
                    (n = restOfExp(e, p.substring(r), [semiColon])).length && (r += n.length + (";" === p.char(r + n.length) ? 1 : 0), !l.test(p.substring(r).toString())););
                i = lispifyBlock(p.substring(a, n.end - p.start), e)
            } else i = [], r += t.length
        }
        p = p.substring(r), d.push(createLisp({
            op: 41,
            a: "default" === c[1] ? 0 : lispifyExpr(e, t),
            b: i
        }))
    }
    i.lispTree = createLisp({
        op: 40,
        a: lispifyExpr(e, o),
        b: d
    })
})), setLispType(["dot", "prop"], ((e, t, n, r, s, i) => {
    let o = r[0],
        a = r[0].length,
        c = "prop";
    if ("dot" === t) {
        r[1] && (c = "?prop");
        const e = n.substring(r[0].length).toString().match(expectTypes.prop.types.prop);
        if (!e || !e.length) throw new SyntaxError("Hanging  dot");
        o = e[0], a = o.length + r[0].length
    }
    i.lispTree = lispify(e, n.substring(a), expectTypes[s].next, createLisp({
        op: typesCreate[c],
        a: i.lispTree,
        b: o
    }))
})), setLispType(["spreadArray", "spreadObject"], ((e, t, n, r, s, i) => {
    i.lispTree = createLisp({
        op: "spreadArray" === t ? 18 : 17,
        a: 0,
        b: lispify(e, n.substring(r[0].length), expectTypes[s].next)
    })
})), setLispType(["return", "throw"], ((e, t, n, r, s, i) => {
    i.lispTree = createLisp({
        op: "return" === t ? 8 : 46,
        a: 0,
        b: lispifyExpr(e, n.substring(r[0].length))
    })
})), setLispType(["number", "boolean", "null", "und", "NaN", "Infinity"], ((e, t, n, r, s, i) => {
    i.lispTree = lispify(e, n.substring(r[0].length), expectTypes[s].next, createLisp({
        op: "number" === t ? r[10] ? 83 : 7 : 35,
        a: 0,
        b: r[10] ? r[1] : r[0]
    }))
})), setLispType(["string", "literal", "regex"], ((e, t, n, r, s, i) => {
    i.lispTree = lispify(e, n.substring(r[0].length), expectTypes[s].next, createLisp({
        op: "string" === t ? 2 : "literal" === t ? 84 : 85,
        a: 0,
        b: r[1]
    }))
})), setLispType(["initialize"], ((e, t, n, r, s, i) => {
    const o = "var" === r[1] ? 34 : "let" === r[1] ? 3 : 4;
    r[3] ? i.lispTree = createLisp({
        op: o,
        a: r[2],
        b: lispify(e, n.substring(r[0].length), expectTypes[s].next)
    }) : i.lispTree = lispify(e, n.substring(r[0].length), expectTypes[s].next, createLisp({
        op: o,
        a: r[2],
        b: 0
    }))
})), setLispType(["function", "inlineFunction", "arrowFunction", "arrowFunctionSingle"], ((e, t, n, r, s, i) => {
    const o = "function" !== t && "inlineFunction" !== t,
        a = o && !r[r.length - 1],
        c = o ? 2 : 3,
        p = r[1] ? 88 : 0,
        l = r[c] ? r[c].replace(/\s+/g, "").split(/,/g) : [];
    o || l.unshift((r[2] || "").trimStart());
    let d = !1;
    l.forEach((e => {
        if (d) throw new SyntaxError("Rest parameter must be last formal parameter");
        e.startsWith("...") && (d = !0)
    }));
    const u = restOfExp(e, n.substring(r[0].length), a ? [/^[,)}\]]/, semiColon] : [/^}/]),
        f = a ? "return " + u : u.toString();
    i.lispTree = lispify(e, n.substring(r[0].length + f.length + 1), expectTypes[s].next, createLisp({
        op: o ? 11 : "function" === t ? 37 : 10,
        a: [p, ...l],
        b: e.eager ? lispifyFunction(new CodeString(f), e) : f
    }))
}));
const iteratorRegex = /^((let|var|const)\s+)?\s*([a-zA-Z$_][a-zA-Z\d$_]*)\s+(in|of)(?![\w$])/;
setLispType(["for", "do", "while"], ((e, t, n, r, s, i) => {
    let o, a, c = 0,
        p = 88,
        l = [],
        d = 0,
        u = 0,
        f = 88,
        h = 88;
    switch (t) {
        case "while": {
            c = n.toString().indexOf("(") + 1;
            const t = restOfExp(e, n.substring(c), [], "(");
            o = lispifyReturnExpr(e, t), a = restOfExp(e, n.substring(c + t.length + 1)).trim(), "{" === a.char(0) && (a = a.slice(1, -1));
            break
        }
        case "for": {
            c = n.toString().indexOf("(") + 1;
            const t = [];
            let r, s = emptyString;
            for (let r = 0; r < 3 && (s = restOfExp(e, n.substring(c), [/^[;)]/]), t.push(s.trim()), c += s.length + 1, ")" !== n.char(c - 1)); r++);
            if (1 === t.length && (r = iteratorRegex.exec(t[0].toString()))) "of" === r[4] ? (d = lispifyReturnExpr(e, t[0].substring(r[0].length)), l = [ofStart2, ofStart3], o = ofCondition, h = ofStep, u = lispify(e, new CodeString((r[1] || "let ") + r[3] + " = $$next.value"), ["initialize"])) : (d = lispifyReturnExpr(e, t[0].substring(r[0].length)), l = [inStart2, inStart3], h = inStep, o = inCondition, u = lispify(e, new CodeString((r[1] || "let ") + r[3] + " = $$keys[$$keyIndex]"), ["initialize"]));
            else {
                if (3 !== t.length) throw new SyntaxError("Invalid for loop definition");
                p = lispifyExpr(e, t.shift(), startingExecpted), o = lispifyReturnExpr(e, t.shift()), h = lispifyExpr(e, t.shift())
            }
            a = restOfExp(e, n.substring(c)).trim(), "{" === a.char(0) && (a = a.slice(1, -1));
            break
        }
        case "do": {
            f = 0;
            const t = !!r[3];
            a = restOfExp(e, n.substring(r[0].length), t ? [/^\}/] : [semiColon]), o = lispifyReturnExpr(e, restOfExp(e, n.substring(n.toString().indexOf("(", r[0].length + a.length) + 1), [], "("));
            break
        }
    }
    const g = [f, l, d, p, h, o, u];
    i.lispTree = createLisp({
        op: 38,
        a: g,
        b: lispifyBlock(a, e)
    })
})), setLispType(["block"], ((e, t, n, r, s, i) => {
    i.lispTree = createLisp({
        op: 42,
        a: lispifyBlock(restOfExp(e, n.substring(1), [], "{"), e),
        b: 0
    })
})), setLispType(["loopAction"], ((e, t, n, r, s, i) => {
    i.lispTree = createLisp({
        op: 86,
        a: r[1],
        b: 0
    })
}));
const catchReg = /^\s*(catch\s*(\(\s*([a-zA-Z$_][a-zA-Z\d$_]*)\s*\))?|finally)\s*\{/;
setLispType(["try"], ((e, t, n, r, s, i) => {
    const o = restOfExp(e, n.substring(r[0].length), [], "{");
    let a, c, p = catchReg.exec(n.substring(r[0].length + o.length + 1).toString()),
        l = "",
        d = 0;
    p[1].startsWith("catch") ? (p = catchReg.exec(n.substring(r[0].length + o.length + 1).toString()), l = p[2], c = restOfExp(e, n.substring(r[0].length + o.length + 1 + p[0].length), [], "{"), d = r[0].length + o.length + 1 + p[0].length + c.length + 1, (p = catchReg.exec(n.substring(d).toString())) && p[1].startsWith("finally") && (a = restOfExp(e, n.substring(d + p[0].length), [], "{"))) : a = restOfExp(e, n.substring(r[0].length + o.length + 1 + p[0].length), [], "{");
    const u = [l, lispifyBlock(insertSemicolons(e, c || emptyString), e), lispifyBlock(insertSemicolons(e, a || emptyString), e)];
    i.lispTree = createLisp({
        op: 39,
        a: lispifyBlock(insertSemicolons(e, o), e),
        b: u
    })
})), setLispType(["void", "await"], ((e, t, n, r, s, i) => {
    const o = restOfExp(e, n.substring(r[0].length), [/^([^\s.?\w$]|\?[^.])/]);
    i.lispTree = lispify(e, n.substring(r[0].length + o.length), expectTypes[s].next, createLisp({
        op: "void" === t ? 87 : 44,
        a: lispify(e, o),
        b: 0
    }))
})), setLispType(["new"], ((e, t, n, r, s, i) => {
    let o = r[0].length;
    const a = restOfExp(e, n.substring(o), [], void 0, "(");
    o += a.length + 1;
    const c = [];
    if ("(" === n.char(o - 1)) {
        const t = restOfExp(e, n.substring(o), [], "(");
        let r;
        o += t.length + 1;
        let s = 0;
        for (;
            (r = restOfExp(e, t.substring(s), [/^,/])).length;) s += r.length + 1, c.push(r.trim())
    }
    i.lispTree = lispify(e, n.substring(o), expectTypes.expEdge.next, createLisp({
        op: 45,
        a: lispify(e, a, expectTypes.initialize.next),
        b: c.map((t => lispify(e, t, expectTypes.initialize.next)))
    }))
}));
const ofStart2 = lispify(void 0, new CodeString("let $$iterator = $$obj[Symbol.iterator]()"), ["initialize"]),
    ofStart3 = lispify(void 0, new CodeString("let $$next = $$iterator.next()"), ["initialize"]),
    ofCondition = lispify(void 0, new CodeString("return !$$next.done"), ["initialize"]),
    ofStep = lispify(void 0, new CodeString("$$next = $$iterator.next()")),
    inStart2 = lispify(void 0, new CodeString("let $$keys = Object.keys($$obj)"), ["initialize"]),
    inStart3 = lispify(void 0, new CodeString("let $$keyIndex = 0"), ["initialize"]),
    inStep = lispify(void 0, new CodeString("$$keyIndex++")),
    inCondition = lispify(void 0, new CodeString("return $$keyIndex < $$keys.length"), ["initialize"]);

function lispify(e, t, n, r, s = !1) {
    if (r = r || NullLisp, n = n || expectTypes.initialize.next, void 0 === t) return r;
    const i = (t = t.trimStart()).toString();
    if (!t.length && !n.includes("expEnd")) throw new SyntaxError("Unexpected end of expression");
    if (!t.length) return r;
    const o = {
        lispTree: r
    };
    let a;
    for (const r of n)
        if ("expEnd" !== r) {
            for (const n in expectTypes[r].types)
                if ("expEnd" !== n && (a = expectTypes[r].types[n].exec(i))) {
                    lastType = n;
                    try {
                        lispTypes.get(n)?.(e, n, t, a, r, o)
                    } catch (e) {
                        if (s && e instanceof SyntaxError) throw new ParseError(e.message, i);
                        throw e
                    }
                    break
                } if (a) break
        } if (!a && t.length) {
        if (s) throw new ParseError(`Unexpected token after ${lastType}: ${t.char(0)}`, i);
        throw new SyntaxError(`Unexpected token after ${lastType}: ${t.char(0)}`)
    }
    return o.lispTree
}
const startingExpectedWithoutSingle = startingExecpted.filter((e => "expSingle" !== e));

function lispifyExpr(e, t, n) {
    if (!t.trimStart().length) return NullLisp;
    const r = [];
    let s, i = 0;
    if ((n = n || expectTypes.initialize.next).includes("expSingle") && testMultiple(t.toString(), Object.values(expectTypes.expSingle.types))) return lispify(e, t, ["expSingle"], void 0, !0);
    for (n === startingExecpted && (n = startingExpectedWithoutSingle);
         (s = restOfExp(e, t.substring(i), [/^,/])).length;) r.push(s.trimStart()), i += s.length + 1;
    if (1 === r.length) return lispify(e, t, n, void 0, !0);
    if (n.includes("initialize")) {
        const s = expectTypes.initialize.types.initialize.exec(r[0].toString());
        if (s) return createLisp({
            op: 42,
            a: r.map(((t, n) => lispify(e, n ? new CodeString(s[1] + " " + t) : t, ["initialize"], void 0, !0))),
            b: 0
        });
        if (expectTypes.initialize.types.return.exec(r[0].toString())) return lispify(e, t, n, void 0, !0)
    }
    const o = r.map((t => lispify(e, t, n, void 0, !0)));
    return createLisp({
        op: 43,
        a: o,
        b: 0
    })
}

function lispifyReturnExpr(e, t) {
    return createLisp({
        op: 8,
        a: 0,
        b: lispifyExpr(e, t)
    })
}

function lispifyBlock(e, t, n = !1) {
    if (!(e = insertSemicolons(t, e)).trim().length) return [];
    const r = [];
    let s, i = 0,
        o = 0,
        a = {},
        c = !1,
        p = !1;
    for (;
        (s = restOfExp(t, e.substring(i), [semiColon], void 0, void 0, void 0, a)).length && (p = !(!e.char(i + s.length) || ";" === e.char(i + s.length)), i += s.length + (p ? 0 : 1), /^\s*else(?![\w$])/.test(e.substring(i).toString()) || a.words?.includes("do") && /^\s*while(?![\w$])/.test(e.substring(i).toString()) ? c = !0 : (c = !1, r.push(e.substring(o, i - (p ? 0 : 1))), o = i), a = {}, !n););
    return c && r.push(e.substring(o, i - (p ? 0 : 1))), r.map((e => e.trimStart())).filter((e => e.length)).map((e => lispifyExpr(t, e.trimStart(), startingExecpted)))
}

function lispifyFunction(e, t, n = !1) {
    if (!e.trim().length) return [];
    const r = lispifyBlock(e, t, n);
    return hoist(r), r
}

function hoist(e, t = []) {
    if (isLisp(e)) {
        if (!isLisp(e)) return !1;
        const [n, r, s] = e;
        if (39 === n || 13 === n || 38 === n || 40 === n) hoist(r, t), hoist(s, t);
        else if (34 === n) t.push(createLisp({
            op: 34,
            a: r,
            b: 0
        }));
        else if (37 === n && r[1]) return t.push(e), !0
    } else if (Array.isArray(e)) {
        const n = [];
        for (const r of e) hoist(r, t) || n.push(r);
        n.length !== e.length && (e.length = 0, e.push(...t, ...n))
    }
    return !1
}
const closingsNoInsertion = /^(\})\s*(catch|finally|else|while|instanceof)(?![\w$])/,
    colonsRegex = /^((([\w$\])"'`]|\+\+|--)\s*\r?\n\s*([\w$+\-!~]))|(\}\s*[\w$!~+\-{("'`]))/;

function insertSemicolons(e, t) {
    let n = t,
        r = emptyString,
        s = {};
    const i = insertedSemicolons.get(t.ref) || new Array(t.ref.str.length);
    for (;
        (r = restOfExp(e, n, [], void 0, void 0, [colonsRegex], s)).length;) {
        let e = !1,
            t = r,
            o = r.length;
        if (s.regRes) {
            e = !0;
            const [, , i, , , a] = s.regRes;
            if (o = "++" === s.regRes[3] || "--" === s.regRes[3] ? r.length + 1 : r.length, t = n.substring(0, o), a) {
                const t = closingsNoInsertion.exec(n.substring(r.length - 1).toString());
                t ? e = "while" === t[2] && "do" !== s.lastWord : "function" === s.lastWord && "}" === s.regRes[5][0] && "(" === s.regRes[5].slice(-1) && (e = !1)
            } else i && ("if" !== s.lastWord && "while" !== s.lastWord && "for" !== s.lastWord && "else" !== s.lastWord || (e = !1))
        }
        e && (i[t.end] = !0), n = n.substring(o), s = {}
    }
    return insertedSemicolons.set(t.ref, i), t
}

function checkRegex(e) {
    let t = 1,
        n = !1,
        r = !1,
        s = !1;
    for (; t < e.length && !r && !s;) r = "/" === e[t] && !n, n = "\\" === e[t] && !n, s = "\n" === e[t], t++;
    const i = e.substring(t);
    if (s = s || !r || /^\s*\d/.test(i), s) return null;
    const o = /^[a-z]*/.exec(i);
    return /^\s+[\w$]/.test(e.substring(t + o[0].length)) ? null : {
        regex: e.substring(1, t - 1),
        flags: o && o[0] || "",
        length: t + (o && o[0].length || 0)
    }
}
const notDivide = /(typeof|delete|instanceof|return|in|of|throw|new|void|do|if)$/,
    possibleDivide = /^([\w$\])]|\+\+|--)[\s/]/;

function extractConstants(e, t, n = "") {
    let r, s, i = [],
        o = !1,
        a = "",
        c = -1,
        p = [],
        l = "";
    const d = [],
        u = [];
    let f = null,
        h = 0;
    for (h = 0; h < t.length; h++)
        if (l = t[h], a) l === a && ("*" === a && "/" === t[h + 1] ? (a = "", h++) : "\n" === a && (a = ""));
        else {
            if (o) {
                o = !1, i.push(l);
                continue
            }
            if (r)
                if ("`" === r && "$" === l && "{" === t[h + 1]) {
                    const n = extractConstants(e, t.substring(h + 2), "{");
                    p.push(n.str), i.push("${", p.length - 1, "}"), h += n.length + 2
                } else if (r === l) {
                    if ("`" === r) {
                        const t = createLisp({
                            op: 36,
                            a: unraw(i.join("")),
                            b: []
                        });
                        t.tempJsStrings = p, e.literals.push(t), d.push("`", e.literals.length - 1, "`")
                    } else e.strings.push(unraw(i.join(""))), d.push('"', e.strings.length - 1, '"');
                    r = null, i = []
                } else i.push(l);
            else {
                if ("'" === l || '"' === l || "`" === l) p = [], r = l;
                else {
                    if (closings[n] === l && !u.length) return {
                        str: d.join(""),
                        length: h
                    };
                    closings[l] ? (u.push(l), d.push(l)) : closings[u[u.length - 1]] === l ? (u.pop(), d.push(l)) : "/" !== l || "*" !== t[h + 1] && "/" !== t[h + 1] ? "/" === l && !f && (s = checkRegex(t.substring(h))) ? (e.regexes.push(s), d.push("/", e.regexes.length - 1, "/r"), h += s.length - 1) : d.push(l) : (a = "*" === t[h + 1] ? "*" : "\n", c = h)
                }
                f && space.test(l) || (f = possibleDivide.exec(t.substring(h))) && notDivide.test(t.substring(0, h + f[1].length)) && (f = null)
            }
            o = !(!r || "\\" !== l)
        } if (a && "*" === a) throw new SyntaxError(`Unclosed comment '/*': ${t.substring(c)}`);
    return {
        str: d.join(""),
        length: h
    }
}

function parse(e, t = !1, n = !1) {
    if ("string" != typeof e) throw new ParseError(`Cannot parse ${e}`, e);
    let r = " " + e;
    const s = {
        strings: [],
        literals: [],
        regexes: [],
        eager: t
    };
    r = extractConstants(s, r).str;
    for (const e of s.literals) e[2] = e.tempJsStrings.map((e => lispifyExpr(s, new CodeString(e)))), delete e.tempJsStrings;
    return {
        tree: lispifyFunction(new CodeString(r), s, n),
        constants: s
    }
}

function createEvalContext() {
    return {
        sandboxFunction: sandboxFunction,
        sandboxedEval: sandboxedEval,
        sandboxedSetTimeout: sandboxedSetTimeout,
        sandboxedSetInterval: sandboxedSetInterval,
        lispifyFunction: lispifyFunction
    }
}

function sandboxFunction(e, t) {
    return function SandboxFunction(...n) {
        const r = parse(n.pop() || "");
        return createFunction(n, r.tree, t || currentTicks.current, {
            ...e,
            constants: r.constants,
            tree: r.tree
        }, void 0, "anonymous")
    }
}

function sandboxedEval(e) {
    return function(t) {
        return e(t)()
    }
}

function sandboxedSetTimeout(e) {
    return function(t, ...n) {
        return "string" != typeof t ? setTimeout(t, ...n) : setTimeout(e(t), ...n)
    }
}

function sandboxedSetInterval(e) {
    return function(t, ...n) {
        return "string" != typeof t ? setInterval(t, ...n) : setInterval(e(t), ...n)
    }
}

function subscribeSet(e, t, n, r) {
    if (!(e instanceof Object)) throw new Error("Invalid subscription object, got " + ("object" == typeof e ? "null" : typeof e));
    const s = r.setSubscriptions.get(e) || new Map;
    r.setSubscriptions.set(e, s);
    const i = s.get(t) || new Set;
    let o;
    s.set(t, i), i.add(n);
    const a = e[t];
    return a instanceof Object && (o = r.changeSubscriptions.get(a) || new Set, o.add(n), r.changeSubscriptions.set(a, o)), {
        unsubscribe: () => {
            i.delete(n), o?.delete(n)
        }
    }
}
class SandboxExec {
    constructor(e, t) {
        this.evalContext = t, this.setSubscriptions = new WeakMap, this.changeSubscriptions = new WeakMap, this.sandboxFunctions = new WeakMap;
        const n = Object.assign({
            audit: !1,
            forbidFunctionCalls: !1,
            forbidFunctionCreation: !1,
            globals: SandboxExec.SAFE_GLOBALS,
            prototypeWhitelist: SandboxExec.SAFE_PROTOTYPES,
            prototypeReplacements: new Map
        }, e || {});
        this.context = createContext(this, n)
    }
    static get SAFE_GLOBALS() {
        return {
            Function: Function,
            console: {
                debug: console.debug,
                error: console.error,
                info: console.info,
                log: console.log,
                table: console.table,
                warn: console.warn
            },
            isFinite: isFinite,
            isNaN: isNaN,
            parseFloat: parseFloat,
            parseInt: parseInt,
            decodeURI: decodeURI,
            decodeURIComponent: decodeURIComponent,
            encodeURI: encodeURI,
            encodeURIComponent: encodeURIComponent,
            escape: escape,
            unescape: unescape,
            Boolean: Boolean,
            Number: Number,
            BigInt: BigInt,
            String: String,
            Object: Object,
            Array: Array,
            Symbol: Symbol,
            Error: Error,
            EvalError: EvalError,
            RangeError: RangeError,
            ReferenceError: ReferenceError,
            SyntaxError: SyntaxError,
            TypeError: TypeError,
            URIError: URIError,
            Int8Array: Int8Array,
            Uint8Array: Uint8Array,
            Uint8ClampedArray: Uint8ClampedArray,
            Int16Array: Int16Array,
            Uint16Array: Uint16Array,
            Int32Array: Int32Array,
            Uint32Array: Uint32Array,
            Float32Array: Float32Array,
            Float64Array: Float64Array,
            Map: Map,
            Set: Set,
            WeakMap: WeakMap,
            WeakSet: WeakSet,
            Promise: Promise,
            Intl: Intl,
            JSON: JSON,
            Math: Math,
            Date: Date,
            RegExp: RegExp
        }
    }
    static get SAFE_PROTOTYPES() {
        const e = [SandboxGlobal, Function, Boolean, Number, BigInt, String, Date, Error, Array, Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, Map, Set, WeakMap, WeakSet, Promise, Symbol, Date, RegExp],
            t = new Map;
        return e.forEach((e => {
            t.set(e, new Set)
        })), t.set(Object, new Set(["entries", "fromEntries", "getOwnPropertyNames", "is", "keys", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "toLocaleString", "toString", "valueOf", "values"])), t
    }
    subscribeGet(e, t) {
        return t.getSubscriptions.add(e), {
            unsubscribe: () => t.getSubscriptions.delete(e)
        }
    }
    subscribeSet(e, t, n, r) {
        return subscribeSet(e, t, n, r)
    }
    subscribeSetGlobal(e, t, n) {
        return subscribeSet(e, t, n, this)
    }
    getContext(e) {
        return this.sandboxFunctions.get(e)
    }
    executeTree(e, t = []) {
        return executeTree({
            ticks: BigInt(0)
        }, e, e.tree, t)
    }
    executeTreeAsync(e, t = []) {
        return executeTreeAsync({
            ticks: BigInt(0)
        }, e, e.tree, t)
    }
}
class Sandbox extends SandboxExec {
    constructor(e) {
        super(e, createEvalContext())
    }
    static audit(e, t = []) {
        const n = {};
        for (const e of Object.getOwnPropertyNames(globalThis)) n[e] = globalThis[e];
        const r = new SandboxExec({
            globals: n,
            audit: !0
        });
        return r.executeTree(createExecContext(r, parse(e, !0), createEvalContext()), t)
    }
    static parse(e) {
        return parse(e)
    }
    compile(e, t = !1) {
        const n = parse(e, t);
        return (...e) => {
            const t = createExecContext(this, n, this.evalContext);
            return {
                context: t,
                run: () => this.executeTree(t, [...e]).result
            }
        }
    }
    compileAsync(e, t = !1) {
        const n = parse(e, t);
        return (...e) => {
            const t = createExecContext(this, n, this.evalContext);
            return {
                context: t,
                run: () => this.executeTreeAsync(t, [...e]).then((e => e.result))
            }
        }
    }
    compileExpression(e, t = !1) {
        const n = parse(e, t, !0);
        return (...e) => {
            const t = createExecContext(this, n, this.evalContext);
            return {
                context: t,
                run: () => this.executeTree(t, [...e]).result
            }
        }
    }
    compileExpressionAsync(e, t = !1) {
        const n = parse(e, t, !0);
        return (...e) => {
            const t = createExecContext(this, n, this.evalContext);
            return {
                context: t,
                run: () => this.executeTreeAsync(t, [...e]).then((e => e.result))
            }
        }
    }
}
export {
    Sandbox as
        default
};
