
/*
    Step 1: 
    date grammar, 
    4-instruction parser machine,
    no parse tree generation.
*/

    const date_grammar = `
        date  = year '-' month '-' day
        year  = d d d d
        month = d d
        day   = d d
        d     = '0'/'1'/'2'/'4'/'5'/'6'/'7'/'8'/'9'
    `;

    const date_ptree = ["Peg",[
        ["rule", [["id", "date"],
            ["seq", [["id", "year"], ["sq", "'-'"],
                ["id", "month"], ["sq", "'-'"], ["id", "day"]]]]],
        ["rule", [["id", "year"],
            ["seq", [["id", "d"],["id", "d"],
                ["id", "d"],["id", "d"]]]]],
        ["rule", [["id", "month"],
            ["seq", [["id", "d"], ["id", "d"]]]]],
        ["rule", [["id", "day"],
            ["seq", [["id", "d"], ["id", "d"]]]]],
        ["rule", [["id", "d"],
            ["alt", [["sq", "'0'"], ["sq", "'1'"], ["sq", "'2'"],
                ["sq", "'3'"], ["sq", "'4'"], ["sq", "'5'"], ["sq", "'6'"],
                ["sq", "'7'"], ["sq", "'8'"], ["sq", "'9'"]]]]]
    ]];

    const date_code = {
        "date":
            ["seq", [["id", "year"], ["sq", "'-'"],
                ["id", "month"], ["sq", "'-'"], ["id", "day"]]],
        "year":
            ["seq", [["id", "d"],["id", "d"],
                ["id", "d"],["id", "d"]]],
        "month":
            ["seq", [["id", "d"], ["id", "d"]]],
        "day":
            ["seq", [["id", "d"], ["id", "d"]]],
        "d":
            ["alt", [["sq", "'0'"], ["sq", "'1'"], ["sq", "'2'"],
                ["sq", "'3'"], ["sq", "'4'"], ["sq", "'5'"], ["sq", "'6'"],
                ["sq", "'7'"], ["sq", "'8'"], ["sq", "'9'"]]],
        "$start": ["id", "date"]
    }

    function parse(grammar_code, input) {
        let env = {
            rules: grammar_code,
            input: input,
            pos: 0, // cursor position
        }
        const start = env.rules["$start"];
        return eval(start, env);
    }

    function eval(exp, env) {
        console.log(exp);
        switch (exp[0]) {

        case "id": { // (id name)
            const name = exp[1],
                expr = env.rules[name];
            if (!expr) throw "undefined rule: "+name;
            return eval(expr, env);
        }

        case "seq": { // (seq (args...))
            for (const arg of exp[1]) {
                const result = eval(arg, env);
                if (!result) return false;
            }
            return true;
        }

        case "alt": { // (alt (args...))
            const start = env.pos;
            for (const arg of exp[1]) {
                const result = eval(arg, env);
                if (result) return true;
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

        default: 
            throw "undefined instruction: "+exp[0];
        
        } // switch
    }

    console.log( parse(date_code, "2021-03-04") ); // ==> ptree

