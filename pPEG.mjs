/*
    pPEG in JavaScript

    exports: peg.compile(`...grammar...`)

    No dependencies, this is the only file you need.
*/

const pPEG_grammar = `
    Peg   = " " (rule " ")+
    rule  = id " = " alt

    alt   = seq (" / " seq)*
    seq   = rep (" " rep)*
    rep   = pre sfx?
    pre   = pfx? term
    term  = call / sq / dq / chs / group / extn

    id    = [a-zA-Z_] [a-zA-Z0-9_]*
    pfx   = [&!~]
    sfx   = [+?] / '*' range?
    range = num (dots num?)?
    num   = [0-9]+
    dots  = '..'

    call  = id !" ="
    sq    = "'" ~"'"* "'" 'i'?
    dq    = '"' ~'"'* '"' 'i'?
    chs   = '[' ~']'* ']'
    group = "( " alt " )"
    extn  = '<' ~'>'* '>'

    _space_ = ('#' ~[\n\r]* / [ \t\n\r]*)*
`;

const pPEG_rules =
[["rule",[["id","Peg"],
    ["seq",[["dq","\" \""],["rep",[["seq",[["id","rule"],["dq","\" \""]]],["sfx","+"]]]]]]],
["rule",[["id","rule"],
    ["seq",[["id","id"],["dq","\" = \""],["id","alt"]]]]],
["rule",[["id","alt"],
    ["seq",[["id","seq"],["rep",[["seq",[["dq","\" / \""],["id","seq"]]],["sfx","*"]]]]]]],
["rule",[["id","seq"],
    ["seq",[["id","rep"],["rep",[["seq",[["dq","\" \""],["id","rep"]]],["sfx","*"]]]]]]],
["rule",[["id","rep"],
    ["seq",[["id","pre"],["rep",[["id","sfx"],["sfx","?"]]]]]]],
["rule",[["id","pre"],
    ["seq",[["rep",[["id","pfx"],["sfx","?"]]],["id","term"]]]]],
["rule",[["id","term"],
    ["alt",[["id","call"],["id","sq"],["id","dq"],["id","chs"],["id","group"],["id","extn"]]]]],
["rule",[["id","id"],
    ["seq",[["chs","[a-zA-Z_]"],
        ["rep",[["chs","[a-zA-Z0-9_]"],["sfx","*"]]]]]]],
["rule",[["id","pfx"],
    ["chs","[&!~]"]]],
["rule",[["id","sfx"],
    ["alt",[["chs","[+?]"],["seq",[["sq","'*'"],["rep",[["id","range"],["sfx","?"]]]]]]]]],
["rule",[["id","range"],
    ["seq",[["id","num"],["rep",[["seq",[["id","dots"],["rep",[["id","num"],["sfx","?"]]]]],
        ["sfx","?"]]]]]]],
["rule",[["id","num"],
    ["rep",[["chs","[0-9]"],["sfx","+"]]]]],
["rule",[["id","dots"],
    ["sq","'..'"]]],
["rule",[["id","call"],
    ["seq",[["id","id"],["pre",[["pfx","!"],["dq","\" =\""]]]]]]],
["rule",[["id","sq"],
    ["seq",[["dq","\"'\""],["rep",[["pre",[["pfx","~"],["dq","\"'\""]]],
        ["sfx","*"]]],["dq","\"'\""],["rep",[["sq","'i'"],["sfx","?"]]]]]]],
["rule",[["id","dq"],
    ["seq",[["sq","'\"'"],["rep",[["pre",[["pfx","~"],["sq","'\"'"]]],["sfx","*"]]],
        ["sq","'\"'"],["rep",[["sq","'i'"],["sfx","?"]]]]]]],
["rule",[["id","chs"],
    ["seq",[["sq","'['"],["rep",[["pre",[["pfx","~"],["sq","']'"]]],
        ["sfx","*"]]],["sq","']'"]]]]],
["rule",[["id","group"],
    ["seq",[["dq","\"( \""],["id","alt"],["dq","\" )\""]]]]],
["rule",[["id","extn"],
    ["seq",[["sq","'<'"],["rep",[["pre",[["pfx","~"],["sq","'>'"]]],
        ["sfx","*"]]],["sq","'>'"]]]]],
["rule",[["id","_space_"],
    ["rep",[["alt",[["seq",[["sq","'#'"],["rep",[["pre",[["pfx","~"],["chs","[\n\r]"]]],
        ["sfx","*"]]]]],["rep",[["chs","[ \t\n\r]"],["sfx","*"]]]]],["sfx","*"]]]]]]
;

const pPEG_codex = compiler(pPEG_rules);
// console.log("\nPEG_code\n", JSON.stringify(pPEG_codex.code));

// pPEG machine instructions --------------------------------------------------

function ID(exp, env) { // [ID, idx, name]
    const start = env.pos,
        stack = env.tree.length,
        name = exp[2],
        expr = env.code[exp[1]];
    if (env.trace) trace_enter(exp, env);
    if (env.depth > env.max_depth) {
        throw "grammar error, max depth of recursion exceeded in rules:\n ... "+
            env.rule_names.slice(-6).join(" ");
    }
    env.depth += 1;
    env.rule_names[env.depth] = name;
    env.start[env.depth] = start;
    env.stack[env.depth] = stack;
    const result = expr[0](expr, env);
    env.depth -= 1;
    if (result === false) {
        if (env.trace) trace_result(exp, env, false);
        return false;
    } 
    if (name[0] === '_') { // no results required..
        if (env.tree.length > stack) { // nested rule results...
            env.tree = env.tree.slice(0, stack); // deleted
        } 
        if (env.trace) trace_result(exp, env, true, start);
        return true;
    }
    if (env.tree.length === stack) { // terminal string value..
        const result = [name, env.input.slice(start, env.pos)]
        env.tree.push(result);
        if (env.trace) trace_result(exp, env, result);
        return true;
    }
    if (env.tree.length-stack > 1 || name[0] <= "Z") {
        const result = [name, env.tree.slice(stack)]; // stack..top
        env.tree = env.tree.slice(0, stack); // delete stack..
        env.tree.push(result);
        if (env.trace) trace_result(exp, env, result);
        return true;
    }
    if (env.trace) trace_result(exp, env, env.tree[env.tree.length-1]);
    return true; //  elide this rule label
} // ID

function ALT(exp, env) { // [ALT, [...exp], [...guards]]
    if (env.trace) trace_rep(exp, env);
    const start = env.pos, stack = env.tree.length;
    const ch = env.input[start];
    for (let i=0; i< exp[1].length; i+=1) {
        if (!env.trace && exp.length > 2) {
            const x = exp[2][i]; // guard ch
            if (x !== null && ch !== x) continue; // forget this alt
        }
        const arg = exp[1][i];
        const result = arg[0](arg, env);
        if (result) return true; 
        if (env.tree.length > stack) {
            env.tree = env.tree.slice(0, stack);
        }
        env.pos = start; // reset pos and try the next alt
    }
    return false;
} // ALT

function SEQ(exp, env) { // [SEQ, min, max, [...exp]]
    if (env.trace) trace_rep(exp, env);
    const [_, min, max, args] = exp;
    let count = 0;
    while (true) { // min..max
        let i=0, start = env.pos;
        for (i=0; i<args.length; i+=1) {
            const arg = args[i];
            const result = arg[0](arg, env);
            if (result === false) {
                if (env.pos > start && env.pos > env.fault_pos) {
                    env.fault_pos = env.pos; 
                    env.fault_rule = env.rule_names[env.depth];
                    env.fault_exp = exp[3][i];
                }
                return (count >= min);
            }
        }
        count += 1;
        if (count === max) break; // max 0 means any`
        if (env.pos === start) break; // no progress
        start = env.pos; // next start in min..max
    } // min..max
    return (count >= min);
}

function REP(exp, env) { // [REP, min, max, exp]
    if (env.trace) trace_rep(exp, env);
    const [_rep, min, max, expr] = exp;
    const start = env.pos,
        stack = env.tree.length;
    let count = 0, pos = env.pos;
    while (true) { // min..max        
        const result = expr[0](expr, env);
        if (result === false) break;
        count += 1;
        if (pos === env.pos) break; // no progress
        if (count === max) break; // max 0 means any`
        pos = env.pos;
    }
    if (count < min) {
        if (env.tree.length > stack) {
            env.tree = env.tree.slice(0, stack);
        }
        return false;
    }
    return true;
}

function PRE(exp, env) { // [PRE, sign, expr]
    const [_pre, sign, term] = exp,
        start = env.pos,
        stack = env.tree.length,
        trace = env.trace,
        peak = env.peak;
    env.trace = false;
    const result = term[0](term, env);
    env.peak = peak;
    env.trace = trace;
    if (trace) trace_pre(exp, env, result);
    if (env.tree.length > stack) {
        env.tree = env.tree.slice(0, stack);
    }
    env.pos = start;
    if (sign === "~") {
        if (result === true || env.pos >= env.input.length) return false;
        env.pos += 1;
        if (env.peak < env.pos) env.peak = env.pos;
        return true;
    }
    if (sign === "!") return !result;
    return result;
}

function SQ(exp, env) { // [SQ, icase, "..."]
    const start = env.pos,
        input = env.input,
        icase = exp[1], // case insensitive
        str = exp[2], len = str.length;
    if (len === 0) return true; // '' empty str
    let pos = env.pos;
    for (let i=0; i < len; i+=1) {
        let char = input[pos]; // undefined if pos >= input.length
        if (icase && pos < input.length) char = char.toUpperCase();  
        if (str[i] !== char) {
            env.pos = start;
            if (env.trace) trace_chars_fail(exp, env);
            return false;
        }
        pos += 1;
    }
    env.pos = pos;
    if (pos > env.peak) env.peak = pos;
    if (env.trace) trace_chars_match(exp, env, start);
    return true;
}

function DQ(exp, env) { // ["dq", icase, "..."]
    const input = env.input, start = env.pos,
            icase = exp[1],
            str = exp[2], len = str.length;
    let pos = env.pos;
    if (len === 0) return true; // "" empty str
    const space = env.codex.space; // _space_ rule exp
    for (let i=0; i < len; i+=1) {
        if (str[i] === " ") {
            if (space) { // custom _space_ rule...
                env.pos = pos;
                space[0](space, env);  
                pos = env.pos;
            } else { // or default ....
                const input = env.input, len = input.length;
                while (pos < len) {
                    const ch = input[pos];
                    if (ch == " " || ch == "\n" || 
                        ch == "\r" || ch == "\t") {
                        pos += 1;
                    } else break;
                }
            }
            continue;
        }
        let char = input[pos]; // undefined if pos >= input.length
        if (icase && pos < input.length) char = char.toUpperCase();  
        if (str[i] !== char) {
            // env.pos = start; // skip_space may have advanced
            if (env.trace) trace_chars_fail(exp, env);
            return false;
        }
        pos += 1;
    }
    env.pos = pos;
    if (pos > env.peak) env.peak = pos;
    if (env.trace) trace_chars_match(exp, env, start);
    return true;
}

function CHS(exp, env) { // [CHS, neg, min, max, str]
    const input = env.input, start = env.pos;
    const [_, neg, min, max, str] = exp;
    let pos = env.pos, count = 0;
    while (pos < input.length) { // min..max
        let hit = false;
        for (let i = 0; i < str.length; i += 1) {
            const ch = env.input[pos];
            if (i+2 < str.length && str[i+1] == '-') {
                if (ch < str[i] || ch > str[i+2]) {
                    i += 2;
                    continue;
                }
            } else {
                if (ch !== str[i]) continue;
            }
            hit = true;
            break;
        }
        if (neg) hit = !hit;
        if (!hit) break;
        count += 1;
        pos += 1;
        if (count === max) break;
    } // min..max loop
    if (count < min) {
        if (env.trace) trace_chars_fail(exp, env);
        return false;
    }
    env.pos = pos;
    if (pos > env.peak) env.peak = pos;
    if (env.trace) trace_chars_match(exp, env, start);
    return true; 
}

function EXTN(exp, env) { // [EXTN, "<xxx>"]
    const ext = exp[1].slice(1,-1).split(' ');
    const fn = env.extend[ext[0]] || builtin(ext[0]);
    if (!fn) {
        throw "missing extension: "+exp[1];
    }
    const result = fn(exp, env);
    if (env.trace) trace_extn(exp, env, result);
    if (result) return true; // allow any JS truthy return
    return false;
}

// bultins -- predefined extension functions -------------------------------

const builtins = {
    "?": trace_trigger,
    "same": same_match,
    "infix": infix,
}

function builtin(key) {
    return builtins[key] || undefined;
}

function same_match(exp, env) {
    console.log(exp);
    console.log(env.tree);
    return true;
}

// <infix> -------------------------------------------------

const BIND_POWER = {
    _0__ : 1, _1__ : 3, _2__ : 5, _3__ : 7, _4__ : 9, 
    _5__ : 11, _6__ : 13, _7__ : 15, _8__ : 17, _9__ : 19, 
    __0_ : 2, __1_ : 4, __2_ : 6, __3_ : 8, __4_ : 10, 
    __5_ : 12, __6_ : 14, __7_ : 16, __8_ : 18, __9_ : 20, 
}

function infix(exp, env) {
    const stack = env.stack[env.depth];
    if (env.tree.length - stack < 3) return true
    let next = stack-1; // tree stack index
    env.tree[stack] = pratt(0);
    env.tree.length = stack+1;  
    return true;

    function pratt(lbp) {
        let result = env.tree[next+=1];
         while (true) {
            const op = env.tree[next+=1];
            let rbp = op? BIND_POWER[op[0].slice(-4)] || 0 : -1;
            if (rbp < lbp) {
                next -= 1; // restore op
                break;
            }
            rbp = rbp%2===0? rpb-1 : rbp+1;
            result = [op[1], [result, pratt(rbp)]];
        }
        return result;
    }
}

// fault reporting -------------------------------------------------------

function line_report(str, pos, note="") {
    let i = pos; // start of line..
    while (i > 0 && str[i-1] !== "\n" && str[i-1] !== "\r") i-=1;
    let j = pos; // end of line..
    while (j < str.length && str[j] !== "\n" && str[j] !== "\r") j+=1;
    let line = line_info(str, pos); // {row, col}
    let inset = line_label(-1);  //  ...inset...^
    for (let n=i; n<pos; n+=1) inset += " ";
    let before = lines_before(str, line.row, i, j, 3);
    let after = lines_after(str, line.row, j, 2);
    return before+inset+"^"+after+note;
}

function line_number(str, pos) {
    return line_info(str, pos).at;
}

function line_info(str, pos) {
    let i = 0, sol = 0, cr = 1, lf = 1;
    while (i < pos) {
        if (str[i] === "\r") {cr += 1; i += 1; }
        if (str[i] === "\n") {lf += 1; i += 1; }
        sol = i;
        while (i < pos && str[i] !== "\n" && str[i] !== "\r") i+=1;
    }
    const row = lf >= cr? lf : cr,
        col = pos-sol+1,
        at = ""+row+"."+col;
    return {row, col, at};
}

function lines_before(str, ln, i, j, n) {
    let before = "";
    while (true) {
        before = line_label(ln)+str.slice(i, j)+"\n"+before;
        n -= 1;
        if (i === 0 || n === 0) return before;
        ln -= 1;
        if (i>0 && str[i-1] === "\n") i -= 1;   
        if (i>0 && str[i-1] === "\r") i -= 1;
        j = i;
        while (i > 0 && str[i-1] !== "\n" && str[i-1] !== "\r") i-=1;
    }
}

function lines_after(str, ln, i, n) {
    let after = "";
    while (n>0 && i < str.length) {
        ln += 1;
        let j = i;
        if (str[j] === "\n") j += 1;   
        if (j < str.length && str[j] === "\r") j += 1;
        let k = j;
        while (k < str.length && str[k] !== "\n" && str[k] !== "\r") k+=1;
        after += "\n"+line_label(ln)+str.slice(j, k);
        i = k;
        n -= 1;
    }
    return after;
}

function line_label(n) {
    const blank = "         ";
    if (n < 0) return blank;
    let ln = " "+n+" | ";
    while (ln.length < blank.length) ln = " "+ln;
    return ln;
}

// trace ----------------------------------------------------------

function trace_trigger(exp, env) {  // <?> extension
    if (env.trace) return true;   // nested <?>
    env.trace = true;
    env.trace_depth = env.depth; // active enter/exit current rule
    trace_report("        "+env.rule_names[env.trace_depth]);
    return true;
}

function trace_enter(exp, env) {
    if (env.trace_depth === -1) { // not active
        if (env.trace !== exp[2]) return;
        env.trace_depth = env.depth; // active enter/exit current rule
    }
    trace_report(indent(env)+exp[2]);
}

function trace_result(exp, env, result, start) {
    if (env.trace_depth === -1) return; // not active
    if (result === false) {
        trace_report(indent(env)+exp_show(exp)+" != "+show_line(env));
    } else if (result === true) {
        trace_report(indent(env)+exp[2]+" == "+show_input(env, start, env.pos));
    } else {
        let show = JSON.stringify(result);
        if (show.length > 70) show = show.slice(0,60)+" ... ]";
        trace_report(indent(env)+exp[2]+" => "+show);
    }
    if (env.depth === env.trace_depth) {
        if (env.trace === true) env.trace = false; // <?> toggle
        env.trace_depth = -1;
    }
}

function trace_rep(exp, env) {
    if (env.trace_depth === -1) return; // not active
    trace_report(indent(env)+exp_show(exp));
}

function trace_chars_match(exp, env, start) {
    if (env.trace_depth === -1) return; // not active
    trace_report(indent(env)+exp_show(exp)+" == "+ 
        show_input(env, start, env.pos));
}

function trace_chars_fail(exp, env) {
    if (env.trace_depth === -1) return; // not active
    trace_report(indent(env)+exp_show(exp)+" != "+show_line(env));
}

function trace_pre(exp, env, result) {
    if (env.trace_depth === -1) return; // not active
    const [_pre, sign, term] = exp;
    if (sign === "!") result = !result
    let flag = result? " == " : " != "
    trace_report(indent(env)+exp_show(term)+flag);
}

function trace_extn(exp, env, result) {
    if (env.trace_depth === -1) return; // not active
    trace_report(indent(env)+exp[1]);
}

function show_line(env) {
    let eol = env.pos;
    while (env.input[eol] >= " ") eol += 1;
    if (eol - env.pos > 2) return show_input(env, env.pos, eol);
    return show_input(env, env.pos, env.input.length);
}

function show_input(env, i, j) {
    let s = env.input.slice(i, j);
    if (s.length > 40) s = s.slice(0,30)+" ...";
    return str_esc(s);
}

function indent(env) {
    let s = line_number(env.input, env.pos);
    while (s.length < 8) s += " ";
    for (let i=env.trace_depth; i < env.depth; i+=1) s += "|  ";
    return s;
}

// exp decode display ------------------------------------------------

function exp_show(exp) {
    switch (exp[0]) {
        case ID: return exp[2];
        case SQ: return "'"+str_esc(exp[2])+"'";
        case DQ: return '"'+str_esc(exp[2])+'"';
        case CHS: {
            const [_, neg, min, max, str] = exp;
            let sign = neg? "~" : "";
            return sign+"["+str_esc(str)+"]"+sfx_show(min,max);
        };
        case PRE: {
            const [_pre, sign, term] = exp;
            return sign+exp_show(term);
        };
        case REP: {
            const [_rep, min, max, expr] = exp;
            return exp_show(expr)+sfx_show(min,max);
        };
        case ALT: {
            let xs = exp[1].map(exp_show);
            return "("+xs.join("/")+")";
        };
        case SEQ: {
            const [_, min, max, args] = exp;
            let xs = args.map(exp_show);
            return "("+xs.join(" ")+")"+sfx_show(min,max);
        };
        default: return "(...)";
    }
}

function sfx_show(n,m) {
    if (n===0 && m===0) return "*";
    if (n===0 && m===1) return "?"
    if (n===1 && m===0) return "+";
    if (n===1 && m===1) return "";
    if (m===0) return "*"+n+"..";
    return "*"+n+".."+m;
}

function str_esc(s) {
    let r = "";
    for (let c of s) {
        if (c >= " ") { r += c; }
        else if (c === "\n") { r += "\\n"; }
        else if (c === "\r") { r += "\\r"; }
        else if (c === "\t") { r += "\\t"; }
        else {
            let n = c.charCodeAt(0);
            let xxxx = n.toString(16);
            while (xxxx.length < 4) xxxx = '0'+xxxx;
            r += "\\u"+xxxx; 
        }
    }
    return r;
}

//  compiler -- ptree rules => instruction code ----------------------------

function compiler(rules) { // -> { rules, names, code, start, space }
    let names = {}, first;
    for (let i=0; i<rules.length; i+=1) {
        const [_rule, [[_id, name], _exp]] = rules[i];
        if (i==0) first = name;
        names[name] = i;  
    }
    let start = [ID, 0, first]; // start rule
    let code = [];
    for (const rule of rules) {
        const [_rule, [[_id, name], exp]] = rule;
        code.push(emit(exp));
    }
    for (let i=0; i<code.length; i+=1) { 
        optimize(code[i], code);
    }
    let space, sp = names["_space_"];
    if (sp) space = code[sp];
    return {rules, names, code, start, space};

    function emit(exp) {  // ptree -> [Op, args..]
        switch(exp[0]) {
            case "id": {
                const name = exp[1],
                    index = names[name];
                if (index === undefined) throw "Undefined rule: "+name;
                return [ID, index, name];                
            }
            case "alt": return [ALT, exp[1].map(emit)];
            case "seq": return [SEQ, 1, 1, exp[1].map(emit)];
            case "rep": {
                const [expn, [suffix, sfx]] = exp[1];
                const [min, max] = min_max(suffix, sfx);
                const expr = emit(expn);
                if (expr[0] === SEQ) {
                    const [_SEQ, n, m, ex] = expr;
                    if (n===1 && m===1) {
                        return [SEQ, min, max, ex];
                    }
                }
                if (expr[0] === CHS) {
                    const [_CHS, neg, n, m, str] = expr;
                    if (n===1 && m===1) {
                        return [CHS, neg, min, max, str];
                    }
                }
                if (expr[0] === SQ) {
                    const [_SQ, icase, str] = expr;
                    if (str.length===1) {
                        return [CHS, false, min, max, str];
                    }
                }
                return [REP, min, max, expr]; 
            };
            case "pre": {
                const [[_pfx, pfx], term] = exp[1];
                const expr =  emit(term);
                if (pfx === '~') {
                    if (expr[0] === SQ) {
                        const [_SQ, icase, str] = expr;
                        if (!icase) return [CHS, true, 1, 1, str];
                    } else if (expr[0] === CHS) {
                        const [_CHS, neg, min, max, str] = expr;
                        if (!neg) return [CHS, true, min, max, str];
                    }
                }
                return [PRE, pfx, expr]; 
            };
            case "sq": return sq_dq(SQ, exp[1]);
            case "dq": return sq_dq(DQ, exp[1]);
 
            case "chs": {
                let str = exp[1].slice(1,-1);
                str = escape_codes(str);
                return [CHS, false, 1, 1, str];
            };
            
            case "extn": return [EXTN, exp[1]];

            default: throw "Undefined ptree node: " + exp;
        }
    }

    function sq_dq(fx, txt) {
        let icase = txt.slice(-1) === "i";
        let str = icase? txt.slice(1,-2) : txt.slice(1,-1);
        str = escape_codes(str);
        if (icase) str = str.toUpperCase();
        return [fx, icase, str];
    };

    function min_max(suffix, sfx) { // -> [min, max]
        // sfx   = ~'+?' / '*' range?
        // range = num (dots num?)?
        let min = 0, max = 0; // for sfx == "*""
        if (suffix === "sfx") {
            if (sfx === "+") { min = 1; }
            else if (sfx === "?") { max = 1; }
        } else if (suffix === "num") { 
            min =  parseInt(sfx, 10);  max = min;
        } else if (suffix === "range") { // *N..M
            // ["range", [[num, min],["dots", ".."]]]
            if (sfx.length === 2) { // *N..
                min =  parseInt(sfx, 10);
            } else { // *N..M 
                // ["range", [[num, min],["dots", ".."],["num", max]]]
                min = parseInt(sfx[0][1], 10);
                max = parseInt(sfx[2][1], 10);
            }
        } else throw "unknown suffix: "+exp;
        return [min, max];
    }

    function optimize(exp, code) {
        switch(exp[0]) {
            case SEQ: { // [SEQ, n, m, exps]
                for (const ex of exp[3]) optimize(ex, code);
                return;
            }
            case ALT: { // [ALT, exps]
                const exprs = exp[1];
                let guards = [];
                for (let i=0; i < exprs.length; i+=1) {
                    guards.push(first_char(exprs[i], code));
                }
                exp.push(guards);
                // console.log("ALT-guards",exp);
                return;
            }
            default: return;
        }
    }
    
    function first_char(exp, code) {
        switch (exp[0]) {
            case ID: {
                return first_char(code[exp[1]], code);
            }
            case SEQ: return first_char(exp[3][0], code);
            case SQ: return exp[2][0];
            case DQ: {
                const c = exp[2][0];
                if (c === " ") return null;
                return c;
            }
            default: return null;
        }
    }

} // compiler

const escape_code1 = {
    't': '\t',
    'n': '\n',
    'r': '\r',
    '\\': '\\'
}

function escape_codes(str) {
    let s = "";
    for (let i=0; i<str.length; i+=1) {
        const c = str[i];
        if (c !== '\\') {
            s += c;
            continue;
        }
        let x = str[i+1];
        let code = escape_code1[x];
        if (code) {
            i += 1;
            s += code;
            continue;
        }
        if (x === 'u' && i+5 < str.length) {
            let hex = str.slice(i+2, i+6);
            s += String.fromCharCode(parseInt(hex, 16));
            i += 5;
            continue;
        }
        s += '\\'; // literal back-slash
    }
    return s;
}


// ----------------------------------------------------------------------

function fault_report(report) {
    // console.log("Error:", report);
    return ["$error", report];
}

function trace_report(report) {
    console.log(report); // TODO output in env ?
}

function parse(codex, input, extend, options) {
    let env = {
        codex, // {rules, names, code, start, space}
        code: codex.code,
        extend: {},
        input,
        pos: 0,
        peak: 0, // pos high water mark
        depth: -1, // rule recursion
        max_depth: 100,
        rule_names: [], // dynamic stack
        tree: [], // ptree construction
        start: [], // for extn
        stack: [], // for extn
        fault_pos: -1,
        fault_rule: null,
        fault_exp: null,
        trace: false, // rule name or true
        trace_depth: -1, // active trace depth
        // trace_log: [], // trace report
        options: {},
    }
    if (extend) env.extend = extend;
    if (options) {
        env.options = options;
        if (options.trace) env.trace = options.trace;
    }
    const start = codex.start;
    const result = start[0](start, env);
    if (env.pos < input.length) {
        let report = "";
        if (result) {
            if (env.options.short) return env.tree[0]; // OK
            report += "Fell short at line: "+line_number(input, env.pos)+"\n";
            if (env.fault_pos > -1) { //(env.pos === env.peak) {
                report += line_report(input, env.peak);
            }
            return fault_report(report);
        }
        if (env.fault_pos > -1) { //}=== env.peak) {
            report += "In rule: "+env.fault_rule+
                ", expected: "+exp_show(env.fault_exp)+", ";
        }
        report += "failed at line: "+line_number(input, env.peak)+"\n";
        report += line_report(input, env.peak);
        return fault_report(report);
    }
    if (input.length === 0) {
        if (result && env.tree.length === 1) return env.tree[0];
        return ["$error", "empty input string"]
    }
    if (env.tree.length !== 1) { // can this happen?
        throw "bad tree? " + JSON.stringify(env.tree);
    }
    return env.tree[0];
}

function compile(grammar, extend, options) {
    const peg = parse(pPEG_codex, grammar, {}, options);
    // console.log(JSON.stringify(peg));
    if (peg[0] === "$error") throw peg[1];
    const codex = compiler(peg[1]);
    // console.log("codex\n",JSON.stringify(codex));
    const parser = function parser(input, options) {
        return parse(codex, input, extend, options);
    }
    return {
        parse: parser,
        codex,
    };
}

const peg = { compile };

export default peg; 
