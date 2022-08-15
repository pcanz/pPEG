#   A pPEG Virtual Machine

This note is about the implementation of pPEG in a host programming language, it assumes a basic understanding of [pPEG] grammars and parse trees.

A PEG grammar is a good way to *specify* syntax, but it can also be read as *instructions* that say how to parse that syntax. In other words the grammar rules can be read as a program for a parser virtual machine.

Consider this simple PEG grammar:

    date  = year '-' month '-' day
    year  = d d d d
    month = d d
    day   = d d
    d     = '0'/'1'/'2'/'4'/'5'/'6'/'7'/'8'/'9'

The `date` grammar can be read as a specification for the syntax of a date format. It says that a `date` is defined as a `year` followed by a literal dash character `'-'` followed by a `month`, then another `'-'` and finally a `day`.  Where a `year` is defined as four `d`s, and a `d` is a digit character (either a '0', or a '1', or ...).

The same grammar rules can also be read as instructions for a parser. Read this way it says that to parse a `date` we must match a sequence. First a `year` rule, and to match a `year` we must match a sequence of four `d`s. To match a `d` the next input character must be a digit character ('0' or '1', or ...), which it will advance over. After matching four `d`s we have matched the `year`. Then we must match a `-`, and so on.

These instructions can be defined with Lisp-like expressions:

    date  = (seq (id 'year') (sq '-') (id 'month') (sq '-') (id 'day'))
    year  = (seq (id 'd') (id 'd') (id 'd') (id 'd'))
    month = (seq (id 'd') (id 'd'))
    day   = (seq (id 'd') (id 'd'))
    d     = (alt (sq '0') (sq '1') (sq '2') ... (sq '9'))

These rule expressions can be used as the instruction code for a parser. The parser machine evaluates the list expressions by treating the first element as a function followed by its arguments.

For the `date` grammar only four instruction functions are required:

    id    evaluate the rule named by an identifier

    seq   evaluate arguments left to right and fail if any argument fails.

    alt   find the first argument that matches, or fail.

    sq    match a single-quote string value and consume it, or fail.

It is easy enough to implement a simple Lisp interpreter in almost any programming language. A nice example is: "(How to Write a (Lisp) Interpreter (in Python))" [Norvig].

We do not need a full Lisp interpreter, but the basic idea of a function to evaluate a Lisp-like expression in an environment gives us a good model.


##  An Execution Model

The PEG rules for the `date` grammar is plain text string, expressed here as a JavaScript string:

    const date_grammar = `
        date  = year '-' month '-' day
        year  = d d d d
        month = d d
        day   = d d
        d     = '0'/'1'/'2'/'4'/'5'/'6'/'7'/'8'/'9'
    `;

We could hand translate these grammar rules into parser instructions. That is, a Lisp-like list of rule definitions with their instruction code expressions.

But if we look at the pPEG parse tree for the `date` grammar we can see that the body of each rule is exactly the Lisp-like expression that we need for parser machine instructions.

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

The parser instructions are expressed here in JavaScript, but it is a JSON format that can be implemented in almost any programming language. 

We can easily transform the ptree into this code for the parser machine:

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

Here is a minimal implementation of a `parse` function that can evaluate the `date_code` parser instructions.  A JavaScript version is shown here, but it should be easy enough to read, and other languages can be similar:

    function parse(grammar_code, input) {
        let env = {
            rules: grammar_code,
            input: input,
            pos: 0, // cursor position
        }
        const start = env.rules["$start"];
        return eval(start, env);
    }

The `parse` function packages the `grammar_code` into an environment `env` structure, and extracts the `start` instruction code to call the first rule definition. 

The `eval` function evaluates the grammar code expressions `exp` in the context of the `env`: 

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

This code can be run as a toy model of a parser engine. It acts as a top down recursive decent parser that will match valid input strings. 

For a successful parse it will end up with the cursor position at the end of the string, and return true:

    console.log( parse(date_code, "2021-03-04") ); // ==> true

The `console.log` in the `eval` function shows what is going on. 

The toy model only has four instructions, and it does not yet build a parse tree, but it has established the basic structure.

To recap: the parser machine evaluates grammar code parser instructions which correspond to the rule names in the parse tree for the grammar. The ptree data structure is shown here as JSON that can be implemented in almost any programming language.

The `eval` function is also simple enough to implement in almost any programming language. A parser engine may be implemented in many different ways in different programming languages, but the JavaScript model illustrates the basic structure.
 

##  Parse Tree Result

The toy model needs to be extended to generate a parse tree.

The parse tree results are built by the `id` instruction. In a recursive descent parser the parse tree could be returned as the instruction result. But it turns out to be slightly simpler to have the `id` instruction build the parse tree explicitly on a stack in the `env`.  The instruction functions simply return true or false for success or failure.

The `alt` instruction returns true for the first successful match it can find, but if an alternative fails then it resets the cursor position before trying the next alternative. Now it will also need to reset the parse tree stack.

The `parse` function revised to return a parse tree result: 

    function parse(grammar_code, input) {
        let env = {
            code: grammar_code,
            input: input,
            pos: 0,    // cursor position
            tree: [],  // for building the parse tree
        }
        const result = eval(env.code["$start"], env);
        if (!result) return null;
        return env.tree[0]; // ptree result
    }

Here is the new `id` instruction:

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

The parse tree construction is only shown here for the default lower-case rule names, it can be easily enhanced for the special case underscore and upper-case rule names. 

Our parser machine can now generate a parse tree for the date grammar:

    console.log( JSON.stringify(parse(date_code, "2021-03-04")) ); // ==> ptree

    ["date", [
        ["year", [["d", "2"],["d", "0"],["d", "2"],["d", "1"]]],
        ["month", [["d", "0"],["d", "3"]]],
        ["day", [["d", "0"],["d", "4"]]]
    ]]


##  Full Machine Instructions

The full parser machine needs these instructions:

    id    evaluate the rule named by an identifier

    seq   evaluate arguments left to right and fail if any argument fails.

    alt   find the first argument that matches, or fail.

    sq    match a single-quote string value and consume it, or fail.

    dq    match as for sq except that a space matches any whote-space.

    chs   match any character in a set of characters.

    rep   repeat an instruction expression.

    pre   prefix operator for an instruction expression.

    extn  call an extension host programming language function.

The `dq` instruction is the same as the `sq` instruction except that a space character will match any number of white-space characters.

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

The `chs` instruction matches any one of a set of characters:

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

The `rep` instruction is more interesting. The pPEG grammar `rep` rule will return a ptree node of this form:

    ["rep",[expr, ["sfx", sfx]]]

Where the `expr` is the expression to be repeated. 
        
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

The full pPEG grammar also allows a numeric repeat range, this simplified version of the `rep` instruction needs to be extended to accept numeric min and max values.

This `rep` instruction interprets the parse tree directly, a more efficient implementation can decode the min and max in a compiler step to generate a `rep` instruction format that contains the min and max values. More on that later.

We can try our parser machine on a new `date` grammar:

    const date_grammar = `
        date  = year '-' month '-' day
        year  = [0-9]+
        month = [0-9]+
        day   = [0-9]+
    `;

The ptree for this grammar transforms into this parser machine code:

    const date_code = {
        "date":
            ["seq", [["id", "year"], ["sq", "'-'"],
                ["id", "month"], ["sq", "'-'"], ["id", "day"]]]]],
        "year":
            ["rep", [["chs", "[0-9]"],["sfx", "+"]]],
        "month":
            ["rep", [["chs", "[0-9]"],["sfx", "+"]]],
        "day":
            ["rep", [["chs", "[0-9]"],["sfx", "+"]]],
        "$start":
            ["id", "date"]
    }

Our parser machine can now generate a parse tree for this date grammar:

    console.log( JSON.stringify(parse(date_code, "2021-03-04")) ); // ==> ptree

    ["date", [
        ["year", "2021"],
        ["month", "03"],
        ["day", "04"]
    ]]

We have not used the `pre` instruction yet, but we will need it next.

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

We can now move on from the `date` grammar to the pPEG grammar itself. 

##  PEG Grammar Grammar

We will start with this minimal PEG grammar that is just sufficient to define itself. 

    const boot_grammar = `
        Peg   = _ rule+ _
        rule  = id _'='_ alt

        alt   = seq (_'/'_ seq)*
        seq   = rep (' ' rep)*
        rep   = pre sfx?
        pre   = pfx? term
        term  = id / sq / chs / group

        id    = [a-zA-Z_]+
        pfx   = [&!~]
        sfx   = [+?*]

        sq    = ['] ~[']* [']
        chs   = '[' ~']'* ']'
        group = '('_ alt ')'_
        _     = [ \t\n\r]*
    `;

It would be nice to have a smaller self-definition, but trying to eliminate any more features makes the definition harder to express and more verbose.

For simplicity the minimal grammar restricts space separated sequences to a single line.

The prefix symbols `&` and `!` are defined here, but they are not used in this grammar.


##  Grammar Parser

Imagine for a moment that we have a pPEG parser. If we parse the source text of the PEG grammar itself, then the ptree will be the same grammar-code that the parser machine is running.

The first time around we will have to hand code the ptree for the minimal grammar. We can use the hand-written ptree as the grammar-code for the parser machine. If we then parse the source text of the minimal grammar we should get exactly the same ptree (confirming that we got it right).

We can then bootstrap larger PEG grammars using our minimal grammar.

Once a full pPEG implementation is available it can be used to parse a full PEG grammar, and that will generate a ptree that can be used as the instruction code for any new parser machine implementations. The ptree can be transported in JSON so the new implementation may be on a new platform in a different programming language. 

But let's see how we can get there from scratch.

Here is a hand translation for a minimal PEG grammar:

    // Peg   = _ rule+ _
    ["rule",[["id","Peg"],
        ["seq",[["id","_"], ["rep",[["id","rule"],["sfx",'+"]],
            ["id","_"]]]]],
    // rule  = id _'='_ alt
    ["rule",[["id","rule"],
        ["seq",[["id","id"],["id","_"],["sq","'='"],
            ["id","_"],["id","alt"]]]]],
    // alt   = seq (_'/'_ seq)*
    ["rule",[["id","alt"],
        ["seq",[["id","seq"],
            ["rep",[["seq",[["id","_"],["sq","'/'"],["id","_"],
                ["id","seq"]]],["sfx","*"]]]]]]],
    // seq   = rep (' ' rep)*
    ["rule",[["id","seq"],
        ["seq",[["id","rep"],
            ["rep",[["seq",[["sq","' '"],["id","rep"]]],["sfx","*"]]]]]]],
    // rep   = pre sfx?
    ["rule",[["id","rep"],
        ["seq",[["id","pre"],["rep",[["id","sfx"],["sfx","?"]]]]]]],
    // pre   = pfx? term
    ["rule",[["id","pre"],
        ["seq",[["rep",[["id","pfx"],["sfx","?"]]],["id","term"]]]]],
    // term  = id / sq / dq / chs / group
    ["rule",[["id","term"],
        ["alt",[["id","call"],["id","sq"],["id","dq"],["id","chs"],["id","group"]]]]],
    // id    = [a-zA-Z]+
    ["rule",[["id","id"],
        ["rep",[["chs","[a-zA-Z_]"],["sfx","+"]]]]],
    // pfx   = [&!~]
    ["rule",[["id","pfx"],
        ["chs","[&!~]"]]],
    // sfx   = [+?*]
    ["rule",[["id","sfx"],
        ["chs","[+?*]"]]],
    // sq    = "'" ~"'"* "'"
    ["rule",[["id","sq"],
        ["seq",[["dq","\"'\""],
            ["rep",[["pre",[["pfx","~"],["dq","\"'\""]]],["sfx","*"]]],
            ["dq","\"'\""]]]]],
    // dq    = '"' ~'"'* '"'
    ["rule",[["id","dq"],
        ["seq",[["sq","'\"'"],
            ["rep",[["pre",[["pfx","~"],["sq","'\"'"]]],["sfx","*"]]],
            ["sq","'\"'"]]]]],
    // chs   = '[' ~']'* ']'
    ["rule",[["id","chs"],
        ["seq",[["sq","'['"],
            ["rep",[["pre",[["pfx","~"],["sq","']'"]]],["sfx","*"]]],
            ["sq","']'"]]]]],
    // group = '('_ alt _')'
    ["rule",[["id","group"],
        ["seq",[["sq","'('"],["id","_"],["id","alt"],
            ["id","_"],["sq","')'"]]]]],
    // _  = [ \t\n\r]*
    ["rule",[["id","_"],
        ["rep",[["chs","[ \t\n\r]"],["sfx","*"]]]]]];

Transformed into parser code:
    
    const boot_code = {
        "Peg":
            ["seq",[["id","_"],["rep",[["id","rule"],["sfx",'+"]],["id","_"]]],
        "rule":
            ["seq",[["id","id"],["id","_"],["sq","'='"],
                ["id","_"],["id","alt"]]],
        "alt":
            ["seq",[["id","seq"],
                ["rep",[["seq",[["id","_"],["sq","'/'"],["id","_"],
                    ["id","seq"]]],["sfx","*"]]]]],
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
            ["seq",[["sq","'('"],["id","_"],["id","alt"],
                ["id","_"],["sq","')'"]]],
        "_":
            ["rep",[["chs","[ \t\n\r]"],["sfx","*"]]]],
        "$start":
            ["id", "Peg"]
    }; 

Running the parser machine with our `boot_code` to parse the text of the minimal grammar `boot_grammar` should generate a ptree that is exactly the same as the hand translated ptree that was used for the `boot_code`.

Hand translating grammar rules into grammar code is not much fun, thankfully we only need to do it once. From here on we can bootstrap enhanced PEG grammar languages.

To port pPEG to a new programming language the new parser machine implementation can be fed instruction code that are generated as a ptree by an existing pPEG implementation. The JSON ptree is plain text that can be translated into parser machine code in the new programming language.


##  A Full PEG Grammar

The full pPEG grammar adds these features:

*   Accept multi-line sequence rules.

*   A richer set of identifiers for rule names.

*   Numeric repeats of min to max times as: X*3..5

*   A string may be made case-insensitive by appending an 'i' flag

*   Comments using "#" to the end of the line. 

*   An extension escape-hatch.

    const PEG_grammar = `      
        Peg   = _ rule+ _
        rule  = id _'='_ alt

        alt   = seq ('/'_ seq)*
        seq   = rep*
        rep   = pre sfx? _
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
        group = '('_ alt ')'
        extn  = '<' ~'>'* '>'

        _     = ('#' ~[\n\r]* / [ \t\n\r]*)*
    `;

Notice that the PEG comments are defined using line-end escape code characters (`[\n\r]`). These escape codes are in the JavaScript source text for the grammar, the PEG grammar itself does not define any special escape codes of its own.

The full pPEG grammar defines the syntax for all the new features but it does not use them to define itself, so the parse tree for the full grammar can be generated by parsing the full grammar with the boot grammar:

    const PEG_ptree = parse(boot_code, PEG_grammar);


#   Compiler

The pPEG API (in any programming language) should allow a grammar to be compiled into a parser before the parser is used to parse any input.

First we need a function to transform the `PEG_ptree` format into the `PEG_code` that the parser machine can use.

    const PEG_code = parser_code(PEG_ptree);

For a parser machine that directly interprets the ptree rule expressions the `parser_code` function can be a trivial transformation. More efficient parser machines can have instruction formats that require more elaborate translation.

With the `PEG_code` we can now write a pPEG `compile` API function:

    function compile(grammar) {
        const ptree = parse(PEG_code, grammar);
        let code = parser_code(ptree);
        const parser = function (input) {
            return parse(code, input);
        }
        return {
            parse: parser,
        };
    }

The `compile` function calls the `parse` function to parse the grammar source text, and it will report grammar syntax errors in the grammar at compile-time. This parser error reporting will of course be exactly the same as for parsing any input with any grammar. 

The `parser_code` function is now the heart of the `compile` function, and it can be extended to do a lot more. In particular it should check that all the referenced rule names have been defined, and none are defined more than once.


##  Parser Machine Instructions

Direct execution of the grammar ptree is simple and elegant, but the parse tree may be compiled into more efficient parser machine instruction code formats.

An implementation may use any desired instruction code format. Here is an example:

    id idx name
    
        To evaluate a rule expression via an index idx. In many languages an array index access can be very fast. The name string is only used to label parse tree rule results, although the index could be used for that purpose too in an internal ptree format.

    seq [...expr]

        To evaluate a sequence of parser instruction expressions.

    alt [...expr] [...guards]

        To return the first successful parser instruction expression. The guards can contain a character (or set of characters) that must be matched as the first character. This allows some alternatives to be quickly skipped over when the current input character does not match the guard.

    rep min max expr

        To repeat the evaluation of an expression a min up to a max number of times. The suffix repeat operators are transformed into numeric ranges:

                    min max 
            *       0   0   meaning any number of times
            +       1   0
            ?       0   1
            n       n   n
            n..     n   0
            n..m    n   m

    pre sign expr

        Predicate to match an expr without advancing the input position.
        The sign = '&' or '!' or '~'.

    sq icase str

        Single quote string match, the icase boolean is for case insensitve matching.

    dq icase str

        Double quote string match, with special space character matching.

    chs neg min max ranges

        Match any character in the set of character values encoded in the ranges. The ranges may simply be the string of characters ranges directly from the grammar, or it may be a more efficient tree of character code ranges.

        For efficiency this is a composite instruction that may be repeated min to max times, the same as the rep instruction (defaults to: min=1, max=1).

        The neg boolean negates a match with the current input character. A '~' prefix can be compiled down into a negation of a repeated character set so that an expression such as `~[a-z]+` can be executed with a single parser machine instruction. 

    extn str

        Calls a host language function with the str and the environment as argument values.
        
        The first token of the string str may be used as a key name to identify the function to be called.

There are only nine instructions so an implementation may well choose to first implement instructions that directly execute the ptree format, and later add a compiler and more efficient instruction forms.  

Each instructions can be implemented as a separate function, but that adds an extra function call from the `eval` function. However, in a language with first class functions the instruction code can use the instruction function itself instead of using a function name symbol. In this case the `eval` function is no longer required, the instruction expressions can be self evaluated with their own function:

    const result = expr[0](expr);


##  Error Reporting

Recursive descent parsers are not very helpful when it comes to reporting errors. On failure the parser simply unwinds the stack without leaving any trace of what caused the failure. A typical parse will try to match lots of potential alternatives and it is hard to know which failure point is the one of interest.

Fortunately there is a simple heuristic that works remarkably well. The maximum input position (the peak high water mark) that the parser reaches before failing almost always indicates the cause of the problem. In theory other points of failure may be of interest, but in practice the maximum point of failure is the best place to look.

The only parser instructions that can advance the input cursor position are the instructions that match a sting of characters (in single or double quotes), or a character that is in (or not in) a quoted set of characters. When these instructions advance the input position they can check to see if this is a new maximum position and record that in the parser environment.

After a parse failure the maximum point of failure can be displayed like this:

    Error: parse failed at line: 1.7

        1 | 2021-3-4
                  ^

Looking at the date grammar the problem is obvious, the month requires two digits:

    date  = year '-' month '-' day
    year  = d d d d
    month = d d
    day   = d d
    d     = ~[0-9]

The error report can be more helpful if it also reports the rule that failed and what input was expected at the point of failure:

    Error: In rule: month, expected: d, failed at line: 1.7

        1 | 2021-3-4
                  ^

For a slightly different error:

    Error: In rule: date, expected: '-', failed at line: 1.5

        1 | 2021/04/05
                ^

Another example showing an error parsing with a JSON grammar:

    Error: In rule: Arr, expected: value, failed at line: 2.14

        1 | { "one": 1,
        2 |   "two": [1, ],
                         ^
        3 |   "three": [1, [2, 3]]
        4 | }

The problem is how to keep track of the rule name, and what was expected to match, without adding a lot of overhead that would impact the parser performance. 

There is little point is reporting a failure inside a single component rule. We can never really say that the parser was ever "inside" a single component rule, the rule simply matches the input or fails.

For a trivial grammar with only one rule with only one component the failure report will not be able to say that it was "inside" rule `s`: 

    s = 'a'

Using `s` to parse "x" will fail and generate this bare bones report:

    Error: failed at line: 1.1

    1 | x
        ^

Now consider this one rule grammar with two components:

    s = 'a' 'b'

Using `s` to parse "ax" will fail and generate this report:

    Error: In rule: s, expected: 'b', failed at line: 1.2

    1 | ax
         ^

Rule `s` has two components, so the report can say that the failure occurred inside rule `s`. 

The names of single component rules can be reported when they fail inside some other rule:

    s = x y
    x = 'a'
    y = 'b'

Using `s` to parse "ax" will generate this report:

    Error: In rule: s, expected: y, failed at line: 1.2
    
    1 | ax
         ^

We will only report being "inside" a rule if the rule has started to match some input. If a rule fails without matching any input then we can not say that the parser failed "inside" that rule.

Unfortunately this means that the previous grammar will not be able to report the rule name if the first component fails.

Using `s` to parse "xx" will generate this report:

    Error: failed at line: 1.1
    
    1 | xx
        ^

Accepting this limitation allows the failure reporting information to be recorded with a very small parser overhead. We only need to record failures that occur in a sequence rule instruction. 

When a sequence has matched one (or more) items before an item fails then the input cursor will be reset to the start position, and there may then be an alternative that will match. In practice this is quite rare, such a failure will usually result in a total parse failure.

Before the sequence instruction returns a failure it can make a very quick check to see if it has matched any input before the failure. Information for a potential failure report is only required if some input has been matched. In practice many grammars will complete a successful parse without ever needing to record any information (any LL(k) grammar).

It is common for a rule to fail to match without consuming any input. This will happen whenever the grammar is trying to find an alternative to match at the current input position. These failures should be fast and efficient, and no failure information needs to be recorded. 

When a sequence fails after matching some input then it can use the current depth of recursion to identify the name of the grammar rule that is currently being executed. The failure is "inside" this rule.

The sequence instruction can also record the element in the sequence that has failed. This can later be decoded to display the element that the grammar had expected to match.


### Error Report Details

The peak (maximum high water mark) position can be tracked by code like this in all the string and character matching instructions, if they have made a successful match:

    if (env.peak < env.pos) env.peak = env.pos;

The line number can be calculated from the final `env.peak` input cursor position when the error report is generated.

The instructions for the lookahead predicates `&` and `!` do not consume any input and they reset the input position to their starting position. They must also reset the peak position.

The code in the failure exit of the sequence instruction needed to record potential failure information can look something like:

        if (result === false) {
            if (env.pos > start && env.pos > env.fault_pos) {
                env.fault_pos = env.pos; 
                env.fault_rule = env.rule_names[env.depth-1];
                env.fault_exp = exp[3][i]; // the item that failed
            }
            env.pos = start;
            return false;
        }

The `fault-pos` is needed to check that the fault information is relevant to the final peak input cursor position that the fault report is being generated for. The `fault_rule` is the rule name for the current recursion depth. The `fault-exp` is the item in the sequence that failed. This item is an instruction expression that can be decoded later to report the input match that was expected at the point of failure.

The parser should be tracking the recursion depth in order to report any run-away recursive loops that exceed a maximum depth. But to report the rule name it will also need to track the name of the rule that has entered this depth. This adds overhead to the parser, but it is not a large cost and it can also be useful for other diagnostics.


##  Parser Trace

A good grammar can be very expressive, elegant and succinct, easy to read and understand. But the design of a good grammar is not easy, and all the implications of grammar rules are not always immediately apparent.

When a good grammar fails to parse an input string the failure error reporting should be sufficient to identify the problem in the input. But if there is a bug in the grammar then it can be much harder to understand the root cause of the error.

The ability to trace the actions of a parser step by step is an essential aid in grammar design and development. The trace should show how the grammar rules are being executed in terms of the grammar specification, not in terms of the actual parser machine instructions.

The trace feature therefore needs to be able to relate the parser machine actions back to the grammar rule expressions. Different pPEG implementations may necessarily be quite different.

Here is an example of the sort of information that a trace feature should report.

    const dg = peg.compile(`
        Date  = <?> year '-' month '-' day
        year  = d*4
        month = d*2  
        day   = d+
        d     = [0-9]
    `);

    const dt = dg.parse("2021-04-05");

            Date
    1.1     |  <?>
    1.1     |  year
    1.1     |  |  d*4..4
    1.1     |  |  d
    1.2     |  |  |  [0-9] == 2
    1.2     |  |  d => ["d","2"]
    1.2     |  |  d
    1.3     |  |  |  [0-9] == 0
    1.3     |  |  d => ["d","0"]
    1.3     |  |  d
    1.4     |  |  |  [0-9] == 2
    1.4     |  |  d => ["d","2"]
    1.4     |  |  d
    1.5     |  |  |  [0-9] == 1
    1.5     |  |  d => ["d","1"]
    1.5     |  year => ["year",[["d","2"],["d","0"],["d","2"],["d","1"]]]
    1.6     |  '-' == -
    1.6     |  month
    1.6     |  |  d*2..2
    1.6     |  |  d
    1.7     |  |  |  [0-9] == 0
    1.7     |  |  d => ["d","0"]
    1.7     |  |  d
    1.8     |  |  |  [0-9] == 4
    1.8     |  |  d => ["d","4"]
    1.8     |  month => ["month",[["d","0"],["d","4"]]]
    1.9     |  '-' == -
    1.9     |  day
    1.9     |  |  d+
    1.9     |  |  d
    1.10    |  |  |  [0-9] == 0
    1.10    |  |  d => ["d","0"]
    1.10    |  |  d
    1.11    |  |  |  [0-9] == 5
    1.11    |  |  d => ["d","5"]
    1.11    |  |  d
    1.11    |  |  |  [0-9] !=
    1.11    |  |  d !=
    1.11    |  day => ["day",[["d","0"],["d","5"]]]
    1.11    Date => ["Date",[["year",[["d","2"],["d","0"],["d","2"],["d","1"]]], ... ]

This trace was triggered by a `<?>` extension inserted into the grammar, a trace can also be triggered with an option parameter on the `.parse` function.

##  Parser Machine Implementation

To port pPEG to a new programming language the first decision is how to represent the source text for the grammar. A grammar needs a multi-line string, and although most programming languages have a literal string syntax that can accommodate multiple lines that may only be for raw strings that do not process escape codes. In that case the pPEG grammar `compile` function must implement at least the basic escape codes.

In general it is a good idea to implement escape codes anyway in order to allow the grammar source string to originate in an escaped string, or a raw string, or in plain text from a file.

The implementation can start with two strings, one for the pPEG grammar and another string for the parse tree of that grammar in Json format (a bootstrap generated by some other pPEG implementation). The Json pPEG parse tree can be translated into parser instruction codes for the new implementation. 

The new implementation may choose to use a standard Json parser to read the parse tree into the programming language data structures before it is translated into the new parser machine instruction format.

The initial parser instruction format can interpret the ptree data structure directly so the initial translation can be very minimal. Later refinements can implement optimizations to enhance performance.

In the JavaScript implementation there was about a x5 speed-up between simple parser machine instructions that directly interpreted the ptree format and a more sophisticated instruction format (as described earlier).

The parser machine only requires nine instructions so it is reasonably easy to implement. To get started the initial prototype does not even need to implement all the instructions. Features such as numeric repeats and case-insensitive matching are not essential and can be ignored until the final stage.

For a starter kit development example in JavaScript see <https://github.com/pcanz/pPEGjs>.

A pPEG implementation is a small development project, and a lot of fun. It can be developed incrementally, and refined later for performance. The error reporting and trace features require as much code as the parser machine itself.

The JavaScript version has roughly the same performance as ANTLR4 (running a Json grammar). In theory the performance could be improved even further, but that could require a larger development effort. 


##  Conclusion

A PEG grammar can be read as instructions for a parser, the instructions can be expressed as Lisp-like s-expressions which can be evaluated by a small special purpose Lisp style interpreter with nine instructions.

A pPEG parser machine can be implemented as a small one person project in a few hundred lines of code. A full implementation with good performance and good error reporting can be expected to require less than one thousand lines of code, with zero external dependencies.


[pPEG]: https://github.com/pcanz/pPEG
[Norvig]: https://norvig.com/lispy.html

