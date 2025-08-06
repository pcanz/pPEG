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

The focus is on simplicity and ease of use, with a direct grammar interpreter.

The grammar source language is a text string in the host programming language, and the parse tree output is a simple list structure, a subset of JSON.

A pPEG parser can be implemented in less than a thousand lines of code without any external dependencies.

The Python implementation is a good place to get started [pPEGpy].

For implementations in different languages see the [INDEX].

For an interactive demo try the [dingus].

##  Examples

Here are a couple of examples, the first is in JavaScript, the second is in Python, other programming language have similar implementations. These examples should illustrate how easy it is to specify a grammar and use it to parse an input string and generate a parse tree. The details are not important for the moment, they will be explained shortly.

The first grammar is for a CSV (Comma Separated Value) format:
```
    import peg from '../pPEG.mjs';
 
    const csv = peg.compile(`
        CSV     = Hdr Row+
        Hdr     = Row
        Row     = field (',' field)* '\r'? '\n'
        field   = _string / _text / ''

        _text   = ~[,\n\r]+
        _string = '"' (~'"' / '""')* '"'
    `);

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
```
Notice that the grammar only requires six lines of text to specify a CSV format that is compatible with the [RFC 4180] standard.

This grammar compiles directly into a parser, and the resulting parse trees are simple and easy to process, as shown here in JSON format.

An application can translate the CSV parse tree into a data structure for processing, or into an HTML table for presentation, or whatever is required.

There are many different variations of the CSV format and grammar rules are a good way to specify the exact details. The grammar can be modified to meet specific requirements.

A program script using regular expressions could be used to parse this CSV syntax. But it would be hard to make it as easy to read and modify as the pPEG version.

Here is another example, a grammar for [s-expressions], this time in Python:
``` python
    import pPEG

    sexp = pPEG.compile("""
        list  = _ '(' elem* ')' _
        elem  = list / atom _
        atom  = ~[() \t\n\r]+
        _     = [ \t\n\r]*
    """)

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
```
This three line grammar defines atoms as text symbols, but it could easily be extended with string and number types. A hand written program to implement a parser for this grammar requires more than a regex.

These examples should illustrate the general idea, now for the details.


##  The pPEG Grammar Language

A pPEG grammar rule expression can be:
```
    name        to match a named grammar rule

    'abc'       to match a string of characters
    'abc'i      to match a case-insensitive string of characters

    ''          to match an empty string, and consume no input
    .           to match any single character

    [abc]       to match any one of the characters in brackets
    [a-z]       to match any character from 'a' to 'z' inclusive

    []          always fails to match

    <extend>    to match input as defined by an `extend` function.
```
The square brackets around a set of characters is similar to regex notation.

If x and y are grammar expressions then:
```
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
```
The expression `~x` can be informally read as "anything except x", more correctly it matches any character provided that `x` does not match.
```
    ~x  is shorthand for:  (!x .)
```
The expression: `~[abc]` is the same as the regex notation: `[^abc]`, but pPEG does not support the `^` regex notation. The expression: `~'abc'` will match any character if and only if the string `'abc'` does not match.
```
    any  = ~[]     # or . matches any character
    eof  = !any    # matches the end of input
```
The `<extend>` notation is an escape-hatch that allows a grammar to be extended with custom programming language parser functions.

Extension functions may occasionally be needed to define syntax that is beyond the power of a Context Free Grammar, or any syntax that could not be defined with PEG grammar rules.

##  Escape Codes

Characters in a pPEG quoted string, or in a square brackets character-set, may be represented using an escape code.

A small sub-set of standard programming language escape codes is supported:

    \t           \u0009 TAB
    \n           \u000A LF
    \r           \u000D CR

    \x12         2 hex digits
    \u1234       4 hex digits
    \U12345678   8 hex digits

A backslash character followed by any other character(s) is simply a literal backslash character.

For portability a pEG grammar should not use any other escape codes, even when a programming language string might allow other escape codes.

In pPEG the backslash character can not be used to escape itself (and this is never required to write a pPEG grammar). Not using a backslash to escape itself removes some potential for errors when porting a grammar from a string that supports these escapes into a raw string that does not.


##  The pPEG Grammar Grammar

Here is a pPEG definition of itself:
```
Peg   = _ rule+
rule  = id _ def _ alt
def   = '=' ':'? / ':' '='?
alt   = seq ('/' _ seq)*
seq   = rep+
rep   = pre sfx? _
pre   = pfx? term
term  = call / quote / class / dot / group / extn
group = '(' _ alt ')'
call  = id _ !def
id    = [a-zA-Z_] [a-zA-Z0-9_-]*
pfx   = [~!&]
sfx   = [+?] / '*' nums?
nums  = min ('..' max)?
min   = [0-9]+
max   = [0-9]*
quote = ['] ~[']* ['] 'i'?
class = '[' ~']'* ']'
dot   = '.'
extn  = '<' ~'>'* '>'
_     = ([ \t\n\r]+ / '#' ~[\n\r]*)*
```
This grammar defines a parser, for a more formal specification see: [A Portable PEG].

For simplicity and portability double quotes are not used. 

The `~` operator often provides a simpler way to express PEG rules.

The ability to specify a numeric min to max number of repetitions, and the ability to specify case-insensitive strings of characters, are syntactic sugar that make some grammars easier to specify. 

The use of `=` in rule definitions (instead of the original `<-`) defines how the parse tree result is generated, the details are discussed in the next section.

Rule definitions can be modified to refine the parse tree without changing the syntax that the grammar rules define:

- A rule defined with `:` instead of `=` defines an anonymous rule that will not appear in the parse tree. Or use a rule name that starts with an underscore.

- A rule using `:=` will appear in the parse tree as a parent node, regardless of the number of children. Or use a rule name that starts with a capital letter.

- A rule using `=:` will appear as a leaf node (if ever needed). 

For the full details of how pPEG is derived from the original [PEG] defined by Bryan Ford, see: [A Portable PEG].


##  The Parse Tree

There is no standard parse tree structure for a PEG, but the parse tree structure is important. pPEG defines a particular kind of parse tree that we will call a p-tree.

The pPEG parser builds a p-tree by using the rule names to label the rule results.

A rule name can label an input string that the rule has matched, or the rule name may label a list of component rule results.

There are only two rule result formats:

1. `["rule", "string..."]`  a leaf node, for a string matching rule result.

2. `["rule", [...rule_result]]` a head node, matching named component rules.

If a rule contains a mixture of component rules and anonymous literal matches then only the named rule components will appear in the p-tree. Anonymous matches include matching a quoted string, or matching a character in a set of characters. Anonymous matches will not appear in the parse tree, and that is usually what we want. If an anonymous literal match is required in the p-tree then it can always be included by defining it in a named rule.

A rule name that starts with a lower case letter can return a p-tree rule result in either format (1) or format (2). There are several cases to consider:

1.  If the rule result has an empty list of component rules then the rule will label the input text that the rule has matched, using p-tree format (1).

2.  If a rule result is a single component rule result then adding an extra rule name label as a wrapper would be redundant, so the rule result is simply the component rule result, which could be format (1) or (2).

3.  If a rule result has nested lists of rule results it will be flattened into a single flat list in format (2). 

This ensures that the parser generates a minimal p-tree that prunes out many redundant rule names and literal matches. This is usually just what is wanted, but there are exceptions when the p-tree contains rule names that are not required, or is missing rule names that are required.

A convention for rule names enables the grammar to explicitly include or exclude rule results:

1. A rule name that begins with a capital letter (or is defined with `:=` instead of `=`), will always appear in the p-tree, and will always be in format (2). The list or component rule results may have zero or more elements.

2. A rule name that begins with an underscore (or is defined with a `:` instead of a `=`), will never appear in the p-tree. These rule names are treated as if they are anonymous expressions.

3. A rule name that begins with a lower case letter should be used by default, and (when defined with a `=`), it will return a dynamic result as defined above.

It is important to know that the syntax that the grammar defines is not affected in any way by the choice of rule names (or definition sign). It is only the p-tree results that may change.

The p-tree construction rules may look a little complicated, but in practice they are reasonably intuitive and not difficult to understand. Examples will help.

A pPEG implementation may also provide an alternative for the p-tree that has index values to the span of input text that the rule matched.

##  Arithmetic Expressions Example

Here is one way to write a grammar for arithmetic expressions:
```
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
    _   : [ \t\n\r]*
```
A separate grammar rule has been defined for each operator in order to demonstrate how pPEG generates minimal p-tree results. 

The p-tree result parsing: `1+2*3` is:
```
    add
    ├─num "1"
    └─mul
      ├─num "2"
      └─num "3"
```
Or in JSON format:
```
    ["add",[["num","1"],["mul",[["num","2"],["num","3"]]]]]
```
Another example, parsing: `x^2^3-1`
```
    sub
    ├─pow
    │ ├─sym "x"
    │ ├─num "2"
    │ └─num "3"
    └─num "1"
```
Or in JSON format:
```
    ["sub",[["pow",[["sym","x"],["num","2"],["num","3"]]],["num","1"]]]
```
Only the relevant rule names appear in the p-tree result, all redundant rule names and literal matches are eliminated. The default p-tree construction works well here and only lower case rule names are needed.

If an infix `+` operator is matched then the `add` rule will label a list of two or more rule results in the p-tree. But if there is no `+` then the `add` rule becomes redundant, and will not appear in the p-tree result. Similarly for all the other operator rules.

Some rule names will never appear in the p-tree. The `exp` rule will never appear because it would be a redundant wrapper on the `add` result, or whatever rule result is actually matched. The `grp` rule and the `val` rule will never appear in the p-tree for similar reasons.

The grammar rules ensure the correct operator precedence. The `add` rule has the lowest binding power, and the `pow` rule binds the tightest. An expression in parentheses will over-ride the default precedence.

The p-tree is not a traditional AST (Abstract Syntax Tree), instead it is a more like a Lisp s-expression with the rule names acting as function names on a list of arguments. When seen this way the p-tree is quite similar to this s-expression:
```
    1+2+3+4  ==>  (+ 1 2 3 4)
```
The corresponding p-tree is:
```
    1+2+3+4  ==>  ["add", [["num", "1"],["num", "2"],["num", "3"],["num", "4"]]]
```
The `add` rule name can label a host programming language function that defines how the argument list will be evaluated. Most of the arithmetic operators are left associative and will use a left list reduction, but the `pow` exponential operator can use a right reduction to evaluate its arguments.

To reduce the number of rules each operator rule could match all operators with the same precedence and associativity. But a better way to deal with a larger number of operators is to extend the pPEG grammar with a version of the Pratt parser algorithm as explained in [Operator Expressions].


##  JSON Grammar Example

A pPEG version of the [JSON] grammar specifications illustrates how upper case rule names and underscore rule names can be used to manicure the p-tree.

A pPEG JSON parser is a useful example since JSON is so widely known and has a well defined grammar.
```
    json   = value
    value  = _ (Obj / Arr / Str / num / val) _
    Obj    = '{'_ (memb (','_ memb)*)? '}'
    memb   = Str _ ':' _ value
    Arr    = '['_ (value (','_ value)*)? ']'
    Str    = '"' chars* '"'
    chars  = ~[\x00-\x1F"\]+ / '\' esc
    esc    = ["\/bfnrt] / 'u' [0-9a-fA-F]*4
    val    = 'true' / 'false' / 'null'
    num    = int frac? exp?
    int    : '-'? [1-9] [0-9]* / '-'? '0' 
    frac   : '.' [0-9]+
    exp    : [eE] [+-]? [0-9]+
    _      : [ \t\n\r]* 
```
The pPEG grammar language enables the published JSON grammar specification to be reduced from 22 multi-line CFG rules down to 14 one-line pPEG rules. 

The `json` rule name and the `value` rule name both name a single component result, so these rule names are redundant in the parse tree, and they will not appear in any results. The JSON parse tree root will be one of the `value` alternatives.

The `Obj`, `Arr`, and `Str` rules can match a list of zero or more component results. The use of capital letter rule names ensures these rule names will always appear in the parse tree, even if they only have zero or one component result.

We want the `num` result to simply match a string that will be translated into a programming langue numeric data type. The component rules are not really needed, and they have been given underscore names. 

The `val` rule has no component rules so it will appear in the parse tree as the label for the string value that it matched.

For example, parsing this JSON source text:
```
    { "answer": 42,
      "mixed": [1, 2.3, "a\tstring", true, [4, 5]],  
      "empty": {}
    }
```
Results in this parse tree:
```
    ["Obj",[
        ["memb",[["Str",[["chars","answer"]]],["num","42"]]],
        ["memb",[["Str",[["chars","mixed"]]],
            ["Arr",[["num","1"],["num","2.3"],
            ["Str",[["chars","a"],["esc","t"],["chars",string"]]],
            ["val","true"],
            ["Arr",[["num","4"],["num","5"]]]]]]],
        ["memb",[["Str",[["chars","empty"]]],["Obj",[]]]]]]
```
The rule name labels make it easy to translate the parse tree nodes into programming language data types.


##  Parser Extension Functions

The primary motivation for the pPEG `<extension>` feature is for syntax that is beyond the power of a PEG.

For example the Rust raw string format:
```
    raw_string  = hash '"' ~('"' <same hash>)* '"' hash
    hash        = '#'+
```
The hash prefix can always use more `#` characters than any number appearing in the raw-string content before a quote mark.  This syntax is context sensitive and beyond the power of a PEG (or any CFG). The `<same hash>` extension function will match the same characters that are matched by the `hash` rule.

An `<extension>` function is an escape-hatch that can be used for almost anything, but for portability it should avoided if at all possible.

A pPEG implementation can choose to interpret the string of characters between angle brackets in any way it chooses. For example, the string may be treated like a command line where the first word is used as a key to a custom function, and the rest of the string is passed in as arguments.

Extension functions may also be used to enhance error reporting and performance.

##  The Parser Virtual Machine

The parser machine essentially takes a pPEG parse tree as instruction code that it uses to parse an input string.  

Given a parse tree for the pPEG grammar itself, the parser machine can parse any new user defined pPEG grammar. The resulting parse tree for the new grammar can then be used as the instruction code for the parser machine to parse input strings that use the new grammar.

The p-tree format has been illustrated here as a JSON structure because JSON is a simple format that is well understood in most programming languages. But the p-tree only uses a subset of JSON (Array and String values). In essence the p-tree is a Lisp s-expression. A tiny Lisp-like interpreter can be used to evaluate a p-tree expression.

In practice a small compiler step can be used to translate a pPEG grammar p-tree into the actual parser machine instruction functions. The compiler step enables semantic errors in the grammar to be detected and reported, and it allows the p-tree expression to be translated into a format that the parser machine can execute more efficiently.

Programmers using pPEG do not need to know the details of the parser machine. The details for how to implement a pPEG parser are covered in a separate document: [The pPEG Machine].


##  Portability

The pPEG grammar source text can contain any Unicode characters, but the character encoding is a programming language implementation decision. Many modern programming languages use UTF-8, but some popular languages use UTF-16.

A grammar text may be written in a quoted string with back-slash escape codes, or in a raw string without any escape codes, or as plain text in a file. Ideally the grammar text should not require any changes when ported between these different representations.

For example, this rule for white-space can be used in any representation:
```
    _ = [ \t\n\r]*
``` 
If this rule is written in a programming language string with escape codes then pPEG will see the ASCII control code characters. If it is written in a plain text file then the pPEG compiler will see the escape codes and translate them into control code characters.

The pPEG grammar does not rely on double-quote, back-tick, or back-slash characters for any grammar features. Using these characters in a grammar may require the grammar to be edited with escape codes when the grammar is ported into some programming language.

For portability the parse tree structure is represented as JSON, but only JSON strings and arrays are used, and how these are implemented depends on the host programming language.


##  Conclusion

The pPEG grammar language is slightly enhanced version of the original [PEG] definition. A pPEG can parse its own grammar, so users may choose to change and extend the pPEG grammar language, and extend the parser machine, if they so desire.

The standard parse tree format (p-tree) aims to be as simple and as portable as possible. This is the interface for applications that use a pPEG parser. The grammar rule names are used to label the nodes in the p-tree to make processing a p-tree as simple as possible. 

The p-tree is a minimal representation for the parser output, but the pPEG grammar rules can be designed to generate a p-tree that best suites the application processing.  The p-tree is not a traditional AST (Abstract Syntax Tree). The p-tree directly represents the pattern matching of the input string as specified by the pPEG grammar rules. An application may translate the p-tree into a suitable AST if that is required.

The pPEG grammar allows custom extensions to cope with any gnarly bits of syntax that can not be expressed with PEG rules (e.g. a context sensitive grammar). Extensions can also be used for performance, using implementation specific program language code.

pPEG is portable and easy to implement in almost any programming language.

For more information see: [pPEG Documents...]

[pPEGpy]: https://github.com/pcanz/pPEGpy
[INDEX]: https://github.com/pcanz/pPEG/blob/master/INDEX.md
[dingus]: https://pcanz.github.io/pPEGjs/dingus.html
[A Portable PEG]: https://github.com/pcanz/pPEG/blob/master/docs/A-Portable-PEG.md
[ANTLR]: https://www.antlr.org
[RFC 4180]: https://www.ietf.org/rfc/rfc4180.txt
[s-expressions]: https://en.wikipedia.org/wiki/S-expression
[PEG]: https://bford.info/pub/lang/peg.pdf
[JSON]: https://www.json.org/json-en.html
[Operator Expressions]: https://github.com/pcanz/pPEG/blob/master/docs/operator-expressions.md
[The pPEG Machine]: https://github.com/pcanz/pPEG/blob/master/docs/pPEG-machine.md
[pPEG Documents...]: https://github.com/pcanz/pPEG/blob/master/docs/README.md 
