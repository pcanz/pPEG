#   Context Sensitive Grammars

Most practical computer languages can be defined with a Context Free Grammar (CFG) or a Parser Expression Grammar (PEG). But there are some syntactic snags that are beyond the power of a CFG or a PEG and require a Context Sensitive Grammar (CSG).

There is no easy way to specify a formal CSG. Features with syntax that require a CSG need a grammar rule escape-hatch to implement pragmatic work around solutions.

What exactly is a CSG? And how do we know it when we see it? The theory is fine, but in practice it is not very helpful. We need to be able to spot the need for a CSG, and we need to know how to work around the problem.


##  Grammar Theory

The definition of a CSG is based on the Chomsky grammar class hierarchy. Basically this says tha a CFG can only have a single nonterminal on the left hand side of a production. In other words a single name on the left hand side of the grammar rule definition.

Formal grammar theory is based on finite state automata theory. A CFG corresponds to the power of a pushdown automata. There are a huge number of clever algorithms for CFG parser based on automata theory. A CSG corresponds to a linear bounded automata.

That's all well and good, but not much help in spotting some syntax that requires a CSG when you stumble upon it.

It is a little more helpful to know how to test certain forms of input string that a parser based on a particular type of grammar can or can not recognize.

A CFG parser *can* match a string of the form: A^n B^n, that is, some A repeated n times, followed by some B repeated exactly the same number of times.

    S = A S? B 

A CFG parser can *not* match a string of the form: A^n B^n C^n, that requires a CSG.

A PEG grammar can specify any unambiguous CFG, but it also goes a little further than a CFG. Here is a PEG grammar for A^n B^n C^n:

    S = &(A 'c') 'a'+  B !any
    A = 'a' A? 'b'
    B = 'b' B? 'c'

This is a rather contrived example to prove the point. Unfortunately a PEG can not handle the features that require a CSG that come up in practice.


##  Practical Examples

The name itself: "Context Free Grammar" makes the point that CFG rules can not take into account any global context. A CFG (or PEG) parser can not take into account how the parser has matched prior input.

A key reason that a CSG may be required occurs when the parser must match exactly the *same* string as it has already matched somewhere earlier in the input. This is a key distinguishing feature:

*   A CSG can require the *same* input text to be matched again later.

Quite often a CFG can still be used, and the requirement to match exactly the same string later can be turned into a constraint requirement applied to the parse tree. In other words the problem can be pushed off till later.

This is very common. A good example is the CFG for XML (and HTML). The CFG grammar allows the parser to match open and close tag names that do not necessarily match, but adds this requirement in the form of a constraint on the parse tree.

    elem = '<' tag atts '>' content '</' tag '>'

There are lots of other examples. Guido van Rossum described several issues like this that the original Python parser ignored, some of which he later tackled with a new PEG based parser implementation. 

The show stopper happens when the parser can not simply ignore the requirement to match the *same* string again, the syntax can not allow the parser to continue without being able to match exactly the same input as some previous match. 

Often it is the *length* of the match that is the critical factor. For example to match an open quote to a closing quote, where the number of quote marks must match.

The syntax for a Markdown back-tick quoted string of `code` is an example. These quote marks can use any number of back-ticks in order to quote a lesser number inside the quoted `code` string.  

A PEG like this won't work:

    code  = ticks ~ticks* ticks
    ticks = '`'+

The parser has no way to match the *same* `ticks` string in the opening and closing `ticks`.

A possible work-around is to define as many as needed:

    code  = t1 / t2 /t3 / ...
    t1    = '`' ~'`'* '`'
    t2    = '``' ~'``'* '``'
    t3    = '```' ~'```'* '```'
    ...

This is not a very satisfactory solution.

In Rust the `##"raw-string"##` syntax has the same problem:

    raw-string = fence '"' ~('"' fence)* '"' fence
    fence      = '#'+

The parser has no way to ensure tha `fence` is the same before and after the string, and this can not be deferred to a parse tree check.


###  Indented Blocks

Nested blocks of indented code, as used in Python or Haskell, are also a problem. 

This grammar for a simple indented block won't work:

    block  = indent line (nl indent line)*
    indent = ' '+
    line   = ~[\n\r]*
    nl     = '\n' / '\r' '\n'?

There is no way to check that indented lines in the `block` have exactly the *same* indent.

The Python parser avoided this problem by implementing indentation in the lexical scanner. The scanner keeps track of the current indentation and emits an INDENT token when the indention increases, and a UNDENT tokens when the indentation decreases.

The parser can then treat the indentation tokens like brackets:

    block  = INDENT (line / block)* UNDENT

This has proved very effective but it is aspecial purpose solution that is outside the grammar parser.


##  Semantic Actions

One way to tackle the CSG syntax problems in the previous examples is to allow semantic actions to be attached to grammar rules.

    code   = ticks1 ~ticks2* ticks2
    ticks1 = '`'+
    ticks2 = '`'+  { ticks2 == ticks1 }

The semantic action in curly brackets must be able to see the current partial parse tree so that it can compare the matched strings, and cause the `tick2` rule to fail if they don't match.

This is difficult to implement in a recursive decent parser. Restricting the semantic actions so that they can only access the result of their own rule simplifies the implementation:

    code   = ticks1 ~ticks2* ticks2
    ticks1 = '`'+  { ticks = <ticks1> }
    ticks2 = '`'+  { <ticks2> == ticks }

The `ticks1` semantic action puts the rule result `<tick1>` into a variable `ticks` in a context that is visible to other semantic actions.  

In general the variable `ticks` may need to be pushed onto a stack to allow for recursive grammar rules. The problem now is how to pop values off the stack correctly.

    code   = ticks1 ~ticks2* ticks2 { ticks.pop() }
    ticks1 = '`'+  { ticks.push(tick1) }
    ticks2 = '`'+  { ticks2 == ticks }

Semantic actions that allow arbitrary programming language code are certainly able to solve this kind of CSG problem, but the price to pay may be too high:

*   The grammar is not portable, it is implementation language specific.

*   The grammar specification is harder to read and understand.

Semantic actions require careful design to ensure they are idempotent for grammar backtracking. It is all too easy to turn a clean grammar into a messy hacked together parser with no hope of a formal specification. 

Semantic actions can be very useful, but they should be clearly separated. Most practical uses of semantic actions can be fully decoupled from the grammar syntax specification. They can be implemented as parse tree transformations.

Handling CSG requirements is the exception, by their very nature they can not be separated out from the grammar specification. Some restricted form of semantic actions are required, or some different way to solve the problem.


##  Grammar Extensions

An escape-hatch for implementing grammar rule extensions provides a slightly different solution. This allows a custom extension to be defined with a programming language code that can invoked from  the grammar by using an angle bracket notation. This is similar to a semantic action but the programming language function is packaged into a named grammar element.

The Markdown code quote marks could be expressed as special purpose extension:

    code = <code>

Where the `<code>` extension is a programming language function that matches the Markdown syntax.

This can be generalize to:

    code = '`'+ <quote>

Where the `<quote>` extension is a parser function that matches forward in the input until it finds the *same* text that was matched immediately before it in the rule. The `<quote>` extension is a generic parser function that can be used to match any quote marks.

The `<quote>` function returns text matched between the quote marks as a rule result: `["quote", "....matched text..."]`.

The Rust raw string syntax needs a slightly different `<quoter>` function that reverses the text string matched for the opening quote mark:

    raw = '#'+ '"' <quoter>

The `<quoter>` extension function could be used for other quote marks, such as:

    cmt = '/*' <quoter>

But this does not require a context sensitive grammar, it can be expressed in pPEG as:

    cmt = '/*' ~'*/'* '*/'

Portable grammars should try to avoid extension functions as much as possible.

Following this advice the XML grammar should use a normal pPEG rule such as:

    elem = '<' tag atts '>' content '</' tag '>'
    tag  = [a-zA-Z]+

As mentioned earlier this requires a semantic check to ensure the *same* start and end tags have been matched.

However, if the grammar is required to enforce this check, then an extension function can be used. The `<same name>` function can be used to match the same text that the `name` rule previously matched: 

    elem = '<' tag atts '>' content '</' <same tag> '>'
    tag  = [a-zA-Z]+

The `<same name>` function searches back through sibling nodes in the parse tree to find the nearest previous `["name", ...]`. This allows nested content to match nested name elements.

The `<same name>` extension can be used to match inset indentations for nested blocks:

    block   = inset line (<same inset> line / block)*
    inset   = [ \t]+
    line    = ~[\n\r]* nl?
    nl      = \n \r? / \r

But this will not work properly because `inset` rule will match any new inset, and we only want it to match larger insets.

A special `<inset>` function is needed to match a white-space inset if and only if is larger than the previously matched `<inset>`. It generates a parse tree result: `["inset", "    "]`, so the `<same inset>` function can be used to match the same inset again, just as it does for a normal rule result.

    block   = <inset> line (<same inset> line / block)*
    line    = ~[\n\r]* nl?
    nl      = \n \r? / \r

The `<inset>` extension can match space and or tab characters to meet specific design requirements.

In summary, a small library of extension functions can be used to cope with the occasional CSG syntax requirements that are found in practice.


##  Conclusion

Most practical computer languages can be defined with a Context Free Grammar (CFG) or a Parser Expression Grammar (PEG). But there are some syntactic snags that are beyond the power of a CFG or a PEG and require a Context Sensitive Grammar (CSG).

A practical solution or work-around to cope with CSG syntax is required. Often a CFG can still be used by adding a requirement that must be enforced by the semantic processing of the parser output. However there are a few practical use-case examples that can not be solved this way. The grammar rules need an escape-hatch.

Semantic actions can be used, but this is not a satisfactory solution because the grammar can now be extended with arbitrary programming language code. It is usually better to keep the grammar syntax issues fully decoupled from the subsequent semantic processing.

Grammar extensions provide an escape-hatch that can be more tightly focussed on solving CSG syntax problems. A small library of extension functions can cope with the occasional gnarly syntax problems that do occur in practice. 

