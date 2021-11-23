
/*
    Step 4: 
    pPEG boot grammar, 
    8-instruction parser machine,
*/

const boot_grammar = `
    Peg   = " " (rule " ")+
    rule  = id " = " alt

    alt   = seq (" / " seq)*
    seq   = rep (' ' rep)*
    rep   = pre sfx?
    pre   = pfx? term
    term  = id / sq / dq / chs / group

    id    = [a-zA-Z]+
    pfx   = [&!~]
    sfx   = [+?*]

    sq    = "'" ~"'"* "'"
    dq    = '"' ~'"'* '"'
    chs   = '[' ~']'* ']'
    group = "( " alt " )"
`;

const boot_code = {
    "Peg":
        ["seq",[["dq","\" \""], ["rep",[
            ["seq",[["id","rule"], ["dq","\" \""]]], ["sfx","+"]]]]],
    "rule":
        ["seq",[["id","id"],["dq","\" = \""],["id","alt"]]],
    "alt":
        ["seq",[["id","seq"],
            ["rep",[["seq",[["dq","\" / \""],["id","seq"]]],["sfx","*"]]]]],
    "seq":
        ["seq",[["id","rep"],
            ["rep",[["seq",[["sq","' '"],["id","rep"]]],["sfx","*"]]]]],
    "rep":
        ["seq",[["id","pre"],["rep",[["id","sfx"],["sfx","?"]]]]],
    "pre":
        ["seq",[["rep",[["id","pfx"],["sfx","?"]]],["id","term"]]],
    "term":
        ["alt",[["id","id"],["id","sq"],["id","dq"],["id","chs"],["id","group"]]],
    "id":
        ["rep",[["chs","[a-zA-Z_]"],["sfx","+"]]],
    "pfx":
        ["chs","[&!~]"],
    "sfx":
        ["chs","[+?*]"],
    "sq":
        ["seq",[["dq","\"'\""],
            ["rep",[["pre",[["pfx","~"],["dq","\"'\""]]],["sfx","*"]]],
            ["dq","\"'\""]]],
    "dq":
        ["seq",[["sq","'\"'"],
            ["rep",[["pre",[["pfx","~"],["sq","'\"'"]]],["sfx","*"]]],
            ["sq","'\"'"]]],
    "chs":
        ["seq",[["sq","'['"],
            ["rep",[["pre",[["pfx","~"],["sq","']'"]]],["sfx","*"]]],
            ["sq","']'"]]],
    "group":
        ["seq",[["dq","\"( \""],["id","alt"],["dq","\" )\""]]],
    "$start":
        ["id", "Peg"]
}; 
    
function parse(grammar_code, input) {
    let env = {
        code: grammar_code,
        input: input,
        pos: 0,    // cursor position
        tree: [],  // for building the parse tree
    }
    const result =  eval(env.code["$start"], env);
    if (!result) return null;
    return env.tree[0]; // ptree result
}

function eval(exp, env) {
    // console.log(exp);
    switch (exp[0]) {

    case "id": { // (id name)
        const name = exp[1],
            expr = env.code[name],
            start = env.pos,
            stack = env.tree.length;
        if (!expr) throw "undefined rule: "+name;
        const result = eval(expr, env);
        if (!result) return false;
        if (env.tree.length === stack) { // terminal string value..
            env.tree.push([name, env.input.slice(start, env.pos)]);
            return true; // => (name, "matched..")
        }
        if (env.tree.length - stack > 1) { // nested rule results..
            const tree = [name, env.tree.slice(stack)]; // stack...top
            env.tree = env.tree.slice(0, stack);
            env.tree.push(tree);
            return true; // => (name (...rule_results))
        }
        return true; //  elide this rule label => ()
    }

    case "seq": { // (seq (args...))
        for (const arg of exp[1]) {
            const result = eval(arg, env);
            if (!result) return false;
        }
        return true;
    }

    case "alt": { // (alt (args...))
        const start = env.pos,
            stack = env.tree.length;
        for (const arg of exp[1]) {
            const result = eval(arg, env);
            if (result) return true;
            if (env.tree.length > stack) {
                env.tree = env.tree.slice(0, stack);
            }
            env.pos = start; // try the next one
        }
        return false;
    }

    case "sq": { // (sq "'txt..'")
        const input = env.input, txt = exp[1];
        let pos = env.pos;
        for (let i=1; i < txt.length-1; i+=1) {
            if (txt[i] !== input[pos]) return false;
            pos += 1;
        }
        env.pos = pos;
        return true;
    }

    case "dq": { // (dq '"txt.."')
        const input = env.input, txt = exp[1];
        let pos = env.pos;
        for (let i=1; i < txt.length-1; i+=1) {
            const c = txt[i];
            if (!c) return false;
            if (c === ' ') {
                while (input[pos] <= ' ') pos += 1;
                continue;
            }
            if (c !== input[pos]) return false;
            pos += 1;
        }
        env.pos = pos;
        return true;
    }

    case "chs": { // (chs, "[str..]"]
        const str = exp[1];
        let pos = env.pos;
        for (let i = 1; i < str.length-1; i += 1) {
            const ch = env.input[pos];
            if (!ch) return false;
            if (i+2 < str.length-1 && str[i+1] == '-') {
                if (ch < str[i] || ch > str[i+2]) {
                    i += 2;
                    continue;
                }
            } else {
                if (ch !== str[i]) continue;
            }
            env.pos += 1;
            return true;
        }
        return false;
    }

    case "rep": {
        const [_rep, [expr, [_sfx, sfx]]] = exp,
            start = env.pos,
            stack = env.tree.length;
        let min = 0, max = 0; // sfx === "*"
        if (sfx === "+") min = 1;
        else if (sfx === "?") max = 1;
        let count = 0, pos = env.pos;
        while (true) { // min..max        
            const result = eval(expr, env);
            if (result === false) break;
            if (pos === env.pos) break; // no progress
            count += 1;
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

    case "pre": { // [pre, [sign, expr]]
        const [_pre, [[_pfx, sign], term]] = exp,
            start = env.pos,
            stack = env.tree.length,
            result = eval(term, env);
        env.pos = start; // reset
        if (env.tree.length > stack) {
            env.tree = env.tree.slice(0, stack);
        }
        if (sign === "~") {
            if (result === false && env.pos < env.input.length) {
                env.pos += 1; // match a character
                return true;
            }
            return false;
        }
        if (sign === "!") return !result;
        return result; // &
    }

    default: ``
        throw "undefined instruction: "+exp[0];

    } // switch
}

console.log( JSON.stringify(parse(boot_code, boot_grammar)) ); 

/* ptree ==>
["Peg",[["rule",[["id","Peg"],["seq",[["dq","\" \""],["rep",[["seq",[["id","rule"],["dq","\" \""]]],["sfx","+"]]]]]]],["rule",[["id","rule"],["seq",[["id","id"],["dq","\" = \""],["id","alt"]]]]],["rule",[["id","alt"],["seq",[["id","seq"],["rep",[["seq",[["dq","\" / \""],["id","seq"]]],["sfx","*"]]]]]]],["rule",[["id","seq"],["seq",[["id","rep"],["rep",[["seq",[["sq","' '"],["id","rep"]]],["sfx","*"]]]]]]],["rule",[["id","rep"],["seq",[["id","pre"],["rep",[["id","sfx"],["sfx","?"]]]]]]],["rule",[["id","pre"],["seq",[["rep",[["id","pfx"],["sfx","?"]]],["id","term"]]]]],["rule",[["id","term"],["alt",[["id","id"],["id","sq"],["id","dq"],["id","chs"],["id","group"]]]]],["rule",[["id","id"],["rep",[["chs","[a-zA-Z]"],["sfx","+"]]]]],["rule",[["id","pfx"],["chs","[&!~]"]]],["rule",[["id","sfx"],["chs","[+?*]"]]],["rule",[["id","sq"],["seq",[["dq","\"'\""],["rep",[["pre",[["pfx","~"],["dq","\"'\""]]],["sfx","*"]]],["dq","\"'\""]]]]],["rule",[["id","dq"],["seq",[["sq","'\"'"],["rep",[["pre",[["pfx","~"],["sq","'\"'"]]],["sfx","*"]]],["sq","'\"'"]]]]],["rule",[["id","chs"],["seq",[["sq","'['"],["rep",[["pre",[["pfx","~"],["sq","']'"]]],["sfx","*"]]],["sq","']'"]]]]],["rule",[["id","group"],["seq",[["dq","\"( \""],["id","alt"],["dq","\" )\""]]]]]]]
*/