#   Context Sensitive Grammars

Most practical computer languages can be defined with a Context Free Grammar (CFG) or a Parser Expression Grammar (PEG). But there are some syntactic snags that are beyond the power of a CFG or a PEG and require a Context Sensitive Grammar (CSG).

What exactly is a CSG? And how do we know it when we see it? The theory is fine, but in practice it is not very helpful. We need to be able to spot the need for a CSG, and we need to know how to work around the problem.

A pPEG can be extended to parse the occasional CSG syntax that appears in practice.

##  Grammar Theory

The definition of a CSG is based on the Chomsky grammar class hierarchy. Basically this says tha a CFG can only have a single nonterminal on the left hand side of a production. In other words a single name on the left hand side of the grammar rule definition.

Formal grammar theory is based on finite state automata theory. A CFG corresponds to the power of a pushdown automata. There are a huge number of clever algorithms for CFG parser based on automata theory. A CSG corresponds to a linear bounded automata.

That's all well and good, but not much help in spotting some syntax that requires a CSG when you stumble upon it.

It is a little more helpful to know how to test certain forms of input string that a parser based on a particular type of grammar can or can not recognize.

A CFG parser *can* match a string of the form: A<sup>n</sup>B<sup>n</sup>, that is, some A repeated n times, followed by some B repeated exactly the same number of times.

    S = A S? B 

A CFG parser can *not* match a string of the form: A<sup>n</sup>B<sup>n</sup>C<sup>n</sup>, that requires a CSG.

A PEG grammar can specify any unambiguous CFG, but it also goes a little further than a CFG. Here is a PEG grammar for A<sup>n</sup>B<sup>n</sup>C<sup>n</sup>:

    S = &(A 'c') 'a'+  B !any
    A = 'a' A? 'b'
    B = 'b' B? 'c'

This is a rather contrived example to prove the point. Unfortunately a PEG can not handle CSG syntax that does occasionaly occur in practice.


##  Practical Examples

The name itself: "Context Free Grammar" makes the point that CFG rules can not take into account any global context. A CFG (or PEG) parser can not take into account how the parser has matched prior input.

If the parser must match exactly the *same* string as it has already matched somewhere earlier in the input, then this requires a context sensitive grammar. This is a key distinguishing feature:

*   A CSG can require the *same* input text to be matched again later.

Quite often a CFG can still be used, and the requirement to match exactly the same string later can be turned into a constraint requirement applied to the parse tree. In other words the problem can be pushed off till later.

This is very common. A good example is the CFG for XML (and HTML). The CFG grammar allows the parser to match open and close tag names that do not necessarily match, but adds this requirement in the form of a constraint on the parse tree.

    elem = '<' tag atts '>' content '</' tag '>'

There are lots of other examples. Guido van Rossum described several issues like this that the original Python parser ignored, some of which he later tackled with a new PEG based parser implementation. 

The show stopper happens when the parser can not simply ignore the requirement to match the *same* string again. That is, the syntax can not allow the parser to continue without being able to match exactly the same input as some previous match. 

Often it is the *length* of the match that is the critical factor. For example to match an open quote to a closing quote, where the number of quote marks must match.

### Quote Marks

The syntax for a Markdown back-tick quoted string of `code` is an example. These quote marks can use any number of back-ticks in order to quote a lesser number inside the quoted `code` string.  

A PEG like this won't work:

    code  = ticks ~ticks* ticks
    ticks = '`'+

The parser has no way to match the *same* `ticks` string in the opening and closing `ticks`.

The standard work-around is to define a sufficient number of rules one for each different run of quote marks:

    code  = ... / t3 / t2 / t1
    t1    = '`' ~'`'* '`'
    t2    = '``' ~'``'* '``'
    t3    = '```' ~'```'* '```'
    ...

This works, but it is not be a very satisfactory solution.

In Rust the `##"raw-string"##` syntax has the same problem:

    raw-string = fence '"' ~('"' fence)* '"' fence
    fence      = '#'+

The parser has no way to ensure tha `fence` is the same before and after the string, and this requirement can not be deferred to a parse tree check.


###  Indented Blocks

Nested blocks of indented code, as used in Python or Haskell, are also a problem. 

This grammar for a simple indented block won't work:

    block  = indent line (nl indent line)*
    indent = ' '+
    line   = ~[\n\r]*
    nl     = '\n' / '\r' '\n'?

There is no way to check that indented lines in the `block` have exactly the *same* indent.

The Python parser avoids this problem by implementing indentation in the lexical scanner. The scanner pushes the inset on to a stack and emits an INDENT token when the indention increases, and a UNDENT tokens when the stack is popped and the indentation decreases.

The parser can then treat the indentation tokens like brackets:

    block  = INDENT (line / block)* UNDENT

This has proved very effective but it requires special purpose code that is outside the grammar syntax.


##  Semantic Actions

One way to tackle the CSG syntax problems in the previous examples is to allow semantic actions to be attached to grammar rules.

    code   = ticks1 ~ticks2* ticks2
    ticks1 = '`'+
    ticks2 = '`'+  { ticks2 == ticks1 }

The semantic action in curly brackets must be able to see the current partial parse tree so that it can compare the matched strings, and cause the `tick2` rule to fail if they don't match.

In general the match result may need to be pushed onto a stack to allow for recursive grammar rules.

    elem = '<' tag1 '>' content '</' tag2 '>' { tag = tags.pop(); }
    tag1 = [a-z]+ { tags.push(tag); tag = tag1; }
    tag2 = [a-z]+ { tag2 == tag1 }

Semantic actions that allow arbitrary programming language code are certainly able to solve this kind of CSG problem, but the price to pay may be too high:

*   The grammar is not portable, it is programming language specific.

*   The grammar specification is harder to read and understand.

Semantic actions require careful design to ensure they are idempotent for grammar backtracking. It is all too easy to turn a clean grammar into a messy hacked together parser with no hope of a formal specification. 

Semantic actions can be very useful, but they should be clearly separated. Most practical uses of semantic actions can be fully decoupled from the grammar syntax specification. They can be implemented as parse tree transformations.

Handling CSG requirements is the exception, by their very nature they may be essential to the parser and can not be separated out from the grammar specification. Some restricted form of semantic actions are required, or some different way to solve the problem.


##  Grammar Extensions

An escape-hatch for implementing grammar rule extensions provides a slightly different solution. This allows a custom extension to be defined with a programming language code that can invoked from  the grammar by using an angle bracket notation. This is similar to a semantic action but the programming language function is packaged into a named grammar element.

The Markdown code quote marks could be expressed as special purpose extension:

    code = <code>

Where the `<code>` extension is a programming language function that matches the Markdown syntax.

This can be generalize to:

    code = '`'+ <quote>

Where the `<quote>` extension is a parser function that matches forward in the input until it finds the *same* text that was matched immediately before it in the rule. The `<quote>` extension is a generic parser function that can be used to match any quote marks.

The `<quote>` function returns text matched between the quote marks as a rule result: `["quote", "....matched text..."]`.

The Rust raw string syntax could have its own custon extension:

    raw = <raw>

Or a more generic `<quoter>` function could be used. This works much the same as the `<quote>`, but it reverses the text string matched by the opening quote mark:

    raw = '#'+ '"' <quoter>

The `<indent>` extension can be used to match indented blocks:

    block = <indent> (<inset> line / block)* <undent>

The `<indent>` matches a white-space inset and compares it with the current inset. If this inset is the same or smaller than the current inset then the `<indent>` will fail. If the inset is larger than the current inset then then it will be pushed onto an inset stack and it becomes the new current inset.

The `<inset>` function maches a white-space inset if and only if it is the same as the current inset. 

The `<undent>` pops the inset stack, and the new top of the stack becomes the current inset.

### A Generic Extension

The need to match exactly the *same* input that the parser has matched earlier is a common root cause for syntax that requires a CSG. A generic extension that implements this capability can be a useful tool.

The generic `<eq name>` extension matches with a `name` rule and fails if the match is not exactly the same as the input that was matched by the previous `name` rule. 

For example:

    elem    = '<' tag '>' content '</' <eq tag> '>'
    content = (text / elem)*
    tag     = [a-zA-Z]+

This grammar requires the closing tag to match the opening tag, and the parser will fail if this is not the case.

The way it works is that the `<eq tag>` extension looks for the first previous sibling ptree element to find the previous `tag` rule result, and then matches the same result at the current position, or fails. 

Notice that the `elem` rule can have content that contains nested `elem` results with their own `tag`'s. But these `tags`'s are not siblings in the ptree. The different `elem`'s will match their own `tag` values separatley within each `elem`.

The `<eq name>` extension will also look for the nearest previous `name` rule match in ancestors rule results to allow it to be used in a sub-rule. If there is no previous match then the `<eq name>` will match an `''` empty string.

The `<eq name>` extension could be used for most of the other examples too. 

For the Markdown code example:

    Code = tics code tics
    code = ~<eq tics>*
    tics = [`]+

The Rust raw string syntax:

    Raw   = fence '"' raw '"' fence
    raw   = ~('"' <eq fence>)*
    fence = '#'+

The indented block example is more complicated because each new indent must check that it is larger than the previous inset.

    Blk    = indent line (<eq inset> !' ' line / Blk)*
    indent = &(<eq inset> ' ') inset
    inset  = ' '+
    line   = ~[\n\r]* '\r'? '\n'

The first `<eq inset>` will not find a previous `inset` rule result so it will match an empty string. 

The `<eq name>` extension aims to directly address the limitation of a CFG or PEG to match the *same* input that was matched earlier. In general this would require a CSG. 

In practice the occasional syntax that can not be specified with PEG grammar rules can be handled with a small library of custom extensions.


##  Conclusion

Most practical computer languages can be defined with a Context Free Grammar (CFG) or a Parser Expression Grammar (PEG). But some syntax require a Context Sensitive Grammar (CSG).

A practical work-around to cope with CSG syntax is required. Often a PEG can still be used together with a semantic processing that verifies a restriction on the parser tree. However there are a few practical use-case examples that can not be solved this way. The grammar rules need an escape-hatch.

Semantic actions can be used, but this is not a satisfactory solution because the grammar can now be extended with arbitrary programming language code. It is usually better to keep a clean separation between the grammar syntax issues and the subsequent semantic processing.

Grammar extensions provide an escape-hatch that can be more tightly focussed on solving CSG syntax problems. A small library of extension functions can be used to cover the occasional gnarly syntax problems that do occur in practice. 

