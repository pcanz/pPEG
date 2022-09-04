#   A Portable PEG Parser

Grammar rules that are easy to use in everyday programming.

pPEG defines three things:

1. A grammar specification language.

2. A format for parse-tree data structures.

3. A parser virtual machine to execute a grammar.

pPEG aims to be:

1. As simple as possible.

2. Easy to use in any programming language.

3. Easy to implement in any programming language.

The focus is on simplicity and ease of use, with a direct grammar interpreter. The performance of a pPEG parser  can compete with parser code generators.

The grammar source language is a text string in the host programming language, and the parse tree output is a simple list structure, a subset of JSON.

A pPEG parser can be implemented in less than a thousand lines of code without any external dependencies.

For implementations see the [INDEX].

For an interactive demo try the [dingus].

##  Examples

Here are a couple of examples, the first is in JavaScript, the second is in Python, other programming language have similar implementations. These examples should illustrate how easy it is to specify a grammar and use it to parse an input string and generate a parse tree. The details are not important for the moment, they will be explained shortly.

The first grammar is for a CSV (Comma Separated Value) format:

    import peg from '../pPEG.mjs';
 
    const csv = peg.compile(`
        CSV     = Hdr Row+
        Hdr     = Row
        Row     = field (',' field)* _EOL*
        field   = _string / _text / ''

        _string = '"' (~'"' / '""')* '"'
        _text   = ~(',' / _EOL)+
    `); // _EOL matches end-of-line characters.

    const test = `A,B,C
    a1,b1,c1
    a2,"b,2",c2
    a3,b3,c3
    `;

    const p = csv.parse(test);

    console.log(JSON.stringify(p));

    /*
    ["CSV",[["Hdr",[["Row",[["field","A"],["field","B"],["field","C"]]]]],
        ["Row",[["field","a1"],["field","b1"],["field","c1"]]],
        ["Row",[["field","a2"],["field","\"b,2\""],["field","c2"]]],
        ["Row",[["field","a3"],["field","b3"],["field","c3"]]],["field",""]]]
    */

Notice that the grammar only requires six lines of text to specify a CSV format that is compatible with the [RFC 4180] standard.

This grammar compiles directly into a parser, and the resulting parse trees are simple and easy to process, as shown here in JSON format.

An application can translate the CSV parse tree into a data structure for processing, or into an HTML table for presentation, or whatever is required.

There are many different variations of the CSV format and grammar rules are a good way to specify the exact details. The grammar can be modified to meet specific requirements.

A program script using regular expressions could be used to parse this CSV syntax. But it would be hard to make it as easy to read and modify as the pPEG version.

Here is another example, a grammar for [s-expressions], this time in Python:

    import pPEG

    sexp = pPEG.compile("""
        list  = _ '(' elem* ')' _
        elem  = list / atom _
        atom  = ~('(' / ')' / _WS)+
    """) # _WS matches white-space characters.

    test = """
        (foo bar (blat 42) (f(g(x))))
    """

    p = sexp.parse(test)

    print(p)

    """
    ["list",[["atom","foo"],["atom","bar"],
        ["list",[["atom","blat"],["atom","42"]]],
        ["list",[["atom","f"],
            ["list",[["atom","g"],["atom","x"]]]]]]]
    """

This three line grammar defines atoms as text symbols, but it could easily be extended with string and number types. A hand written program to implement a parser for this grammar would need to use recursive descent.

These examples should illustrate the general idea, now for the details.


##  The pPEG Grammar Language

A pPEG grammar rule expression can be:

    name        to match a named grammar rule, or an implicit rule

    'abc'       to match a string of characters    
    'abc'i      to match a case-insensitive string of characters

    ''          to match an empty string, and consume no input

    [abc]       to match any one of the characters in brackets
    [a-z]       to match any character from 'a' to 'z' inclusive

    []          always fails to match

    <extend>    to match input as defined by an `extend` function.

The square brackets around a set of characters is similar to regex notation.

If x and y are grammar expressions then:

    x y         will match a sequence of x followed by y, or fail

    x / y       will match x or y or fail (an ordered committed choice)

    x*          will match x zero or more times
    x+          will match x one or more times
    x?          will match x or ''

    x*n         match x exactly n times, where n is a number
    x*n..       match x a minimum of n times (n or more times)
    x*n..m      match x a minimum of n up to a maximum of m times

    !x          matches if and only if x fails, and consumes no input 
    &x          matches if and only if x matches, and consumes no input
    ~x          matches any character if x does not match, or fails

The expression `~x` can be informally read as "anything except x", more correctly it matches any character provided that `x` does not match.

The expression: `~[abc]` is the same as the regex notation: `[^abc]`, but pPEG does not support the `^` regex notation. The expression: `~'abc'` will match any character if and only if the string `'abc'` does not match.

    any  = ~[]     # matches any character
    eof  = !any    # matches the end of input

The `<extend>` notation is an escape-hatch that allows a grammar to be extended with custom programming language parser functions. Extension functions may occasionally be needed to define gnarly syntax that is beyond the power of a Context Free Grammar, or any syntax that could not be defined with PEG grammar rules.

##   Implicit Rules

It is usually an error for a grammar to use a rule name that is not defined in the grammar. The exception is implicit rule names that have pre-defined built-in definitions.

Implicit rule names all start with an underscore, followed by a capital letter or a digit:

        Implicit = '_' [A-Z0-9] [a-zA-Z0-9_-]*

When writing a grammar it is best to avoid defining grammar rule names that could have an implicit definition (i.e. names starting with an underscore followed by a capital letter or digit). Doing that will guarantee an error message if the definition of a rule name has been forgotten.

But implicit rules names are just ordinary rule names that can be defined as usual. An explicit grammar rule definition will take precedence over any implicit definition.


###  Implicit Character Codes

All Unicode character codes can be identified with an implicit rule name. These names are literally interpreted as the hexadecimal value for a character code.

For example, the rule name `_1234` implicitly matches the Unicode hex value `1234`, as if it had been defined with a string escape code like this:

    _1234 = '\u1234'

Implicit character code rule names are particularly useful for control codes which can not otherwise be defined in a pPEG grammar without the help of programming language string escape codes. 

For example:

    _9  = '\t'   # Unicode 9 is a tab character
    _A  = '\n'   # a line-feed character 
    _D  = '\r'   # a carriage return character

Implicit character code rule names may use a hyphen to define a range of character codes. For example:

    _0-FFFF = [\u0000-\uFFFF] 

Implicit rule names that directly represent character codes should not be redefined. Implicit rule names for character codes should be read as a literal names for character codes. 


### Other Implicit Rules

In addition to the intrinsic character code rule names pPEG defines a few other implicit rule names:

    _TAB = _9
    _LF  = _A               # Line Feed
    _CR  = _D               # Carriage Return
    _BS  = _5C              # \ back-slash
    _DQ  = _22              # " double quote char
    _BT  = _60              # ` back-tick quote
    _ANY = _0-10FFFF        # matches any Unicode character

    _EOL = _A-D             # End Of Line (_LF/_B/_C/_CR)
    _WS  = _9-D / ' '       # White-Space
    _NL  = _LF / _CR _LF?   # New Line conventions
    _EOF = !_ANY            # End Of File, end of parse input

    _    = _WS*             # match any white-space..

The end-of-line rule `_EOL` matches `_CR` or `_LF`, but it will also match vertical-tab or form-feed characters, which are normally not used. 

The `_WS` rule for white-space will match a space character or control characters for tab and the end-of-line codes.  It only matches ASCII white-space, and not other Unicode white-space category characters. A grammar can define its own white-space rule if that is required.

By convention the underscore rule `_` is used to match white-space. For convenience it is defined to match the same as `_WS*` (any number of white-space characters). This is a useful default, but it is expected that grammars will often define their own `_` rule for specific white-space matching.

Additional implicit rule names, such as for Unicode categories, may be added in the future. Adding additional implicit rule names in the future will not create any problems with backward compatibility because explicit grammar rule definitions will always take precedence over any implicit definitions.


##  Escape Codes

The use of implicit rule names allows pPEG grammars to be written without the use of string escape codes. This allows grammars to be copied verbatim from quoted strings into raw strings, or into text files.

In the pPEG grammar itself the space-separator `_` rule is the only rule that requires control codes:

    _ = ([ \t\n\r]+ / '#' ~[\n\r]*)*

With implicit rule names if can be defined without escape codes:

    _ = (_WS+ / '#' ~_EOL*)*

For pPEG grammar portability it is best to avoid the use of escape codes. If a grammar is written in a programming language as a quoted string literal value, then escape codes may be used. But this use of escape codes is only to express the text of the grammar. The escape codes are a programming language encoding notation that has no significance in the actual pPEG grammar text string. 


##  Portable Grammars

If a grammar is expressed in a raw string, or in a text file, then there are no escapes codes. This makes for easy to read grammar rules.

For example, here is a fragment of the JSON grammar:
    
    Str    = '"' chars* '"'
    chars  = ~(_0-1F / '\' / '"')+ / '\' esc
    esc    = ["\/bfnrt] / 'u' [0-9a-fA-F]*4

It is natural to write literal back-slash and quote characters. The use of an implicit rule name for the character range in the `chars` rule also looks reasonably natural and obvious.

But if this grammar is ported into a C style string then it will need to be modified to escape the backslash and quote characters:

    "    Str    = '\"' chars* '\"'                  \n"
    "    chars  = ~(_0-1F/'\\'/'\"')+ / '\\' esc    \n"
    "    esc    = [\"\\/bfnrt] / 'u' [0-9a-fA-F]*4  \n"

To be able to port the grammar verbatim it needs to be written without any literal quote or back-slash characters, like this:

    Str    = _DQ chars* _DQ
    chars  = ~(_0-1F / _BS / _DQ)+ / _BS esc
    esc    = [/bfnrt] / _BS / _DQ / 'u' [0-9a-fA-F]*4

Or using implicit rules to directly express character codes:

    Str    = _22 chars* _22
    chars  = ~(_0-1F/_5C/_22)+ / _5C esc
    esc    = [/bfnrt] / _5C / _22 / 'u' [0-9a-fA-F]*4

The implicit rules are not quite as nice and easy to read as the literal characters, but it does have the merit or being directly portable. Of course this is a worst case example, most grammar rules do not require back-slash or double quote characters.

If a grammar is intended as a standard specification where verbatim portability is important, then eliminating the use of literal quote marks and back-slash characters is worthwhile. But for other grammars this will be a minor detail and a stylistic preference.


##  The pPEG Grammar Grammar

Here is the pPEG definition of itself:

    Peg   = _ rule+ _
    rule  = id _ '=' _ alt

    alt   = seq ('/'_ seq)*
    seq   = rep*
    rep   = pre sfx? _
    pre   = pfx? term
    term  = call / quote / chars / group / extn
 
    group = '('_ alt ')'
    pfx   = [~!&]
    sfx   = [+?] / '*' range?
    range = num ('..' num?)?
    num   = [0-9]+

    call  = id _ !'='
    id    = [a-zA-Z_] [a-zA-Z0-9_-]*

    quote = ['] sq ['] 'i'?
    sq    = ~[']*
    chars = '[' chs ']'
    chs   = ~']'*
    extn  = '<' ~'>'* '>'
    _     = (_WS+ / '#' ~_EOL*)*

This pPEG grammar is based on the original [PEG] as defined by Bryan Ford.

The use of `=` in rule definitions instead of `<-` is a cosmetic style choice. Octal character codes are not used, and Unicode chars, not bytes, are matched. For simplicity and portability pPEG does not use double-quotes, or back-slash escape characters. 

The prefix operator `~x` matches anything other than `x`. This can be used to match any character: `~[]`, eliminating the need for a special `.` to match any character. The `~` operator often provides a simpler way to express PEG rules.

The ability to specify a numeric min to max number of repetitions, and the ability to specify case-insensitive strings of characters, are syntactic sugar that make some grammars easier to specify. 


##  The Parse Tree

There is no standard parse tree structure for a PEG, but the parse tree structure is important. pPEG defines a particular kind of parse tree that we will call a ptree.

The pPEG parser builds a ptree by using the rule names to label the rule results.

A rule name can label an input string that the rule has matched, or the rule name may label a list of component rule results.

There are only two rule result formats:

1. `["rule", "string..."]`  for a string matching rule result.

2. `["rule", [...rule_result]]` a rule matching named component rules.

If a rule contains a mixture of component rules and anonymous literal matches then only the named rule components will appear in the ptree. Anonymous matches include matching a quoted string, or matching a character in a set of characters. Anonymous matches will not appear in the parse tree, and that is usually what we want. If an anonymous literal match is required in the ptree then it can always be included by defining it in a named rule.

A rule name that starts with a lower case letter can return a ptree rule result in either format (1) or format (2). There are several cases to consider:

1.  If the rule result has an empty list of component rules then the rule will label the input text that the rule has matched, using ptree format (1).

2.  If a rule result is a single component rule result then adding an extra rule name label as a wrapper would be redundant, so the rule result is simply the component rule result, which could be format (1) or (2).

3.  If a rule result has nested lists of rule results it will be flattened into a single flat list in format (2). 

This ensures that the parser generates a minimal ptree that prunes out many redundant rule names and literal matches. This is usually just what is wanted, but there are exceptions when the ptree contains rule names that are not required, or is missing rule names that are required.

A convention for rule names enables the grammar to explicitly include or exclude rule results:

1. A rule name that begins with a capital letter will always appear in the ptree, and will always be in format (2). The list or component rule results may have zero or more elements.

2. A rule name that begins with an underscore will never appear in the ptree. These rule names are treated as if they are anonymous expressions.

3. A rule name that begins with a lower case letter should be used by default, and it will return a dynamic result as defined above.

It is important to know that the syntax that the grammar defines is not affected in any way by the choice of rule names. It is only the ptree results that may change.

The ptree construction rules may look a little complicated, but in practice they are reasonably intuitive and not difficult to understand. Examples will help.


##  Arithmetic Expressions Example

Here is one way to write a grammar for arithmetic expressions:

    exp = add
    add = sub ('+' sub)*
    sub = mul ('-' mul)*
    mul = div ('*' div)*
    div = pow ('/' pow)*
    pow = val ('^' val)*
    val = _ (sym / num / grp) _
    grp = '(' exp ')'
    sym = [a-zA-Z]+
    num = [0-9]+

A separate grammar rule has been defined for each operator in order to demonstrate how pPEG generates minimal ptree results. 

The ptree result parsing: `1+2*3` is:

    add
    ├─num "1"
    └─mul
      ├─num "2"
      └─num "3"

Or in JSON format:

    ["add",[["num","1"],["mul",[["num","2"],["num","3"]]]]]

Another example, parsing: `x^2^3-1`

    sub
    ├─pow
    │ ├─sym "x"
    │ ├─num "2"
    │ └─num "3"
    └─num "1"

    ["sub",[["pow",[["sym","x"],["num","2"],["num","3"]]],["num","1"]]]

Only the relevant rule names appear in the ptree result, all redundant rule names and literal matches are eliminated. The default ptree construction works well here and only lower case rule names are needed.

If an infix `+` operator is matched then the `add` rule will label a list of two or more rule results in the ptree. But if there is no `+` then the `add` rule becomes redundant, and will not appear in the ptree result. Similarly for all the other operator rules.

Some rule names will never appear in the ptree. The `exp` rule will never appear because it would be a redundant wrapper on the `add` result, or whatever rule result is actually matched. The `grp` rule and the `val` rule will never appear in the ptree for similar reasons.

The grammar rules ensure the correct operator precedence. The `add` rule has the lowest binding power, and the `pow` rule binds the tightest. An expression in parentheses will over-ride the default precedence.

The ptree is not a traditional AST (Abstract Syntax Tree), instead it is a more like a Lisp s-expression with the rule names acting as function names on a list of arguments. When seen this way the ptree is quite similar to this s-expression:

    1+2+3+4  ==>  (+ 1 2 3 4)

The corresponding ptree is:

    1+2+3+4  ==>  ["add", [["num", "1"],["num", "2"],["num", "3"],["num", "4"]]]

The `add` rule name can label a host programming language function that defines how the argument list will be evaluated. Most of the arithmetic operators are left associative and will use a left list reduction, but the `pow` exponential operator can use a right reduction to evaluate its arguments.

To reduce the number of rules each operator rule could match a group of operators with the same precedence and associativity. But a better way to deal with a larger number of operators is to extend the pPEG grammar with a version of the Pratt parser algorithm as explained in [Operator Expressions].


##  JSON Grammar Example

A pPEG version of the [JSON] grammar specifications illustrates how upper case rule names and underscore rule names can be used to manicure the ptree.

A pPEG JSON parser is a useful example since JSON is so widely known and has a well defined grammar.

    json   = value
    value  = _ (Obj / Arr / Str / num / val) _
    Obj    = '{'_ (memb (','_ memb)*)? '}'
    memb   = Str _ ':' value
    Arr    = '[' (value (',' value)*)? ']'
    Str    = '"' chars* '"'
    chars  = ~(_0-1F / '"' / '\')+ / '\' esc
    esc    = ["\/bfnrt] / 'u' [0-9a-fA-F]*4
    num    = _int _frac? _exp?
    _int   = '-'? [1-9] [0-9]* / '-'? '0' 
    _frac  = '.' [0-9]+
    _exp   = [eE] [+-]? [0-9]+
    val    = 'true' / 'false' / 'null'

The pPEG grammar language enables the published JSON grammar specification to be reduced from 22 multi-line CFG rules down to 13 one-line pPEG rules. 

The `json` rule name and the `value` rule name both name a single component result, so these rule names are redundant in the parse tree, and they will not appear in any results. The JSON parse tree root will be one of the `value` alternatives.

The `Obj`, `Arr`, and `Str` rules can match a list of zero or more component results. The use of capital letter rule names ensures these rule names will always appear in the parse tree, even if they only have zero or one component result.

We want the `num` result to simply match a string that will be translated into a programming langue numeric data type. The component rules are not really needed, and they have been given underscore names. 

The `val` rule has no component rules so it will appear in the parse tree as the label for the string value that it matched.

For example, parsing this JSON source text:

    { "answer": 42,
      "mixed": [1, 2.3, "a\tstring", true, [4, 5]],  
      "empty": {}
    }

Results in this parse tree:

    ["Obj",[
        ["memb",[["Str",[["chars","answer"]]],["num","42"]]],
        ["memb",[["Str",[["chars","mixed"]]],
            ["Arr",[["num","1"],["num","2.3"],
            ["Str",[["chars","a"],["esc","t"],["chars",string"]]],
            ["val","true"],
            ["Arr",[["num","4"],["num","5"]]]]]]],
        ["memb",[["Str",[["chars","empty"]]],["Obj",[]]]]]]

The rule name labels make it easy to translate the parse tree nodes into programming language data types.


##  Pragmatic Parser Functions

The primary motivation for the pPEG `<extn>` feature is for syntax that is beyond the power of a PEG, but they may also be used for pragmatic implementation reasons.  

For example, in the JSON grammar the `num` rule returns a string that must be translated into a numeric data type in the programming language, and similarly for a string type. For these rules custom functions could be used to translate the input string directly into a programming language data type:  

    json   = value
    value  = _ (Obj / Arr / str / num / val) _
    Obj    = '{'_ (memb (','_ memb)*)? '}'
    memb   = str _ ':' value
    Arr    = '[' (value (',' value)*)? ']'
    str    = <string>
    num    = <number>
    val    = 'true' / 'false' / 'null'

The `<string>` and `<number>` identify custom parser functions implemented in the host programming language.

A pPEG implementation can choose to interpret the string of characters between angle brackets in any way it chooses. For example, the string may be treated like a command line where the first word is used as a key to a custom function, and the rest of the string is passed in as arguments.


##  The Parser Virtual Machine

The parser machine essentially takes a pPEG parse tree as instruction code that it uses to parse an input string.  

Given a parse tree for the pPEG grammar itself, the parser machine can parse any new user defined pPEG grammar. The resulting parse tree for the new grammar can then be used as the instruction code for the parser machine to parse input strings that use the new grammar.

The ptree format has been illustrated here as a JSON structure because JSON is a simple format that is well understood in most programming languages. But the ptree only uses a subset of JSON (Array and String values). In essence the ptree is a Lisp s-expression. A tiny Lisp-like interpreter can be used to evaluate a ptree expression.

In practice a small compiler step can be used to translate a pPEG grammar ptree into the actual parser machine instruction functions. The compiler step enables semantic errors in the grammar to be detected and reported, and it allows the ptree expression to be translated into a format that the parser machine can execute more efficiently.

Programmers using pPEG do not need to know the details of the parser machine. The details for how to implement a pPEG parser are covered in a separate document: [The pPEG Machine].


##  Conclusion

The pPEG grammar language is a modified version of the original [PEG] definition. A pPEG can parse its own grammar, so users may choose to change and extend the pPEG grammar language, and extend the parser machine, if they so desire.

The standard parse tree format (ptree) aims to be as simple and as portable as possible. This is the interface for applications that use a pPEG parser. The grammar rule names are used to label the nodes in the ptree to make processing a ptree as simple as possible. 

The ptree is a minimal representation for the parser output, but the pPEG grammar rules can be designed to generate a ptree that best suites the application processing.  The ptree is not a traditional AST (Abstract Syntax Tree). The ptree directly represents the pattern matching of the input string as specified by the pPEG grammar rules. An application may translate the ptree into a suitable AST if that is required.

The pPEG grammar allows custom extensions to cope with any gnarly bits of syntax that can not be expressed with PEG rules (e.g. a context sensitive grammar). Extensions can also be used for performance, using implementation specific program language code.

pPEG is portable and easy to implement in almost any programming language.

For more information see: [pPEG Documents...]


[INDEX]: https://github.com/pcanz/pPEG/blob/master/INDEX.md
[dingus]: https://pcanz.github.io/pPEGjs/dingus.html
[ANTLR]: https://www.antlr.org
[RFC 4180]: https://www.ietf.org/rfc/rfc4180.txt
[s-expressions]: https://en.wikipedia.org/wiki/S-expression
[PEG]: https://bford.info/pub/lang/peg.pdf
[JSON]: https://www.json.org/json-en.html
[Operator Expressions]: https://github.com/pcanz/pPEG/blob/master/docs/operator-expressions.md
[The pPEG Machine]: https://github.com/pcanz/pPEG/blob/master/docs/pPEG-machine.md
[pPEG Documents...]: https://github.com/pcanz/pPEG/blob/master/docs/README.md 
