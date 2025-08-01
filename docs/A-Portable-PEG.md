# A Portable PEG

The original PEG (Parser Expression Grammar) paper by [Bryan Ford 2004](https://bford.info/pub/lang/peg/) defines a PEG grammar for the PEG grammar language. Many PEG projects have defined their own variations of this original PEG grammar language.

Some PEG implementations are parser-combinator libraries for different programming languages [1], some are parser generators for particular languages [2], and others have integrated the use of PEG into a specific language [3].

The portable-PEG (pPEG) grammar language aims to enable standard grammar specifications that are portable across programming language. It is derived directly from Ford's original PEG with minimum modifications and extensions.

This note starts by reducing Ford's original PEG down to a primitive core that is just sufficient to define itself. This is used to bootstrap a practical PEG with additional features.

The pPEG grammar language is backward compatible with the Ford's origin PEG grammar, with some specific changes. In particular, the escape codes have been simplified to improve the portability of grammars between different programming languages.

The pPEG grammar adds some syntactic sugar, and an extension feature that can be used as an escape-hatch for any special purpose requirements.

## The Original PEG

The starting point is this grammar from  [Bryan Ford 2004](https://bford.info/pub/lang/peg/):
```
# Hierarchical syntax
Grammar    <- Spacing Definition+ EndOfFile
Definition <- Identifier LEFTARROW Expression
Expression <- Sequence (SLASH Sequence)*
Sequence   <- Prefix*
Prefix     <- (AND / NOT)? Suffix
Suffix     <- Primary (QUESTION / STAR / PLUS)?
Primary    <- Identifier !LEFTARROW
            / OPEN Expression CLOSE
            / Literal / Class / DOT

# Lexical syntax
Identifier <- IdentStart IdentCont* Spacing
IdentStart <- [a-zA-Z_]
IdentCont  <- IdentStart / [0-9]

Literal    <- ['] (!['] Char)* ['] Spacing
            / ["] (!["] Char)* ["] Spacing
   
Class      <- '[' (!']' Range)* ']' Spacing 
Range      <- Char '-' Char / Char
Char       <- '\\' [nrt'"\[\]\\]
            / '\\' [0-2][0-7][0-7]
            / '\\' [0-7][0-7]?
            / !'\\' .

LEFTARROW  <- '<-' Spacing
SLASH      <- '/' Spacing
AND        <- '&' Spacing
NOT        <- '!' Spacing
QUESTION   <- '?' Spacing
STAR       <- '*' Spacing
PLUS       <- '+' Spacing
OPEN       <- '(' Spacing
CLOSE      <- ')' Spacing
DOT        <- '.' Spacing

Spacing    <- (Space / Comment)*
Comment    <- '#' (!EndOfLine .)* EndOfLine
Space      <- ' ' / '\t' / EndOfLine
EndOfLine  <- '\r\n' / '\n' / '\r'
EndOfFile  <- !.
```
The first step is to strip out features that are not required for a core grammar that is still able to define itself.

* No double-quotes -- this is a redundant feature.
* No escape codes -- for simplicity (they will be added in the full PEG).
* No comments -- for simplicity (they will be added in the full PEG).

An extension function `<whitespace>` is introduced to match white-space characters, and the definition of the `.` symbol is extended to match any Unicode character.

* Define `_` rule as `<whitespace>*`.
* Define `.` to match any Unicode character.

The original grammar is simplified by eliminating token rule names for symbolic syntax, such as `LEFTARROW`, and matching these symbols directly as literals. This significantly reduces the size of the core grammar and makes it easier to read.

There are a number of other simplifications and minor corrections that are detailed in the end notes [4].

Ford's original PEG then boils down to this primal core grammar:
```
Grammar    <- _ Definition+
Definition <- Identifier _ '<-' _ Expression
Expression <- Sequence ('/'_ Sequence)*
Sequence   <- Prefix+
Prefix     <- [!&]? Suffix
Suffix     <- Primary [*+?]? _
Primary    <- Identifier _ !'<-'
            / '('_ Expression ')'
            / Literal / Class / '.'
Identifier <- [a-zA-Z_]+
Literal    <- ['] (!['] .)* [']
Class      <- ’[’ Range* ’]’ 
Range      <- !']' . ('-' !] .)?
_          <- <whitespace>*
```
It is a bit of a surprise that the original PEG specification can be simplified to this much smaller grammar without any loss of expressive power, other than escape codes.

## Core Grammar

The next step is to re-write the core grammar with rule names and other conventions that will be useful later.  The grammar language itself is not changed, so this next step can be viewed as simply a cosmetic style change.
```
Peg     = _ rule+
rule    = id _ '=' _ alt
alt     = seq ('/'_ seq)*
seq     = pre+
pre     = pfx? rep
rep     = prime sfx? _
pfx     = [!&]
sfx     = [*+?]
prime   = id _ !'='
        / '('_ alt ')'
        / literal / class / '.'
id      = [a-z_]+
literal = ['] (!['] .)* [']
class   = '[' range* ']' 
range   = !']' . ('-' !']' .)?
_       = <whitespace>*
```
Notice that all the features in this core grammar (other than the `&` prefix) are used to define this grammar. 

The symbol `.` and the `<whitespace>`  are pre-defined and are beyond the expressive power of this core grammar. After the core grammar is extended the new pPEG grammar will be able to express these pre-defined features.

## Additional Features
### Negation

The `~` tilde prefix operator is syntactic sugar for `(!x .)`to be written as: `~x`, this matches anything other than `x` (more correctly it matches any next character when x fails).
```
[]     an empty character set will never match anything
~[]    will match any next character, the same as .
~[x]   is equivalent to a Regex [^x] (but in a PEG [^x] matches: '^'/'x')
```
Using the `~` negation operator eliminates the need for the `.` dot symbol, it only remains for compatibility with the original PEG grammar.

The original PEG gives the repetition suffix precedence over a negation prefix. This means that the repetition is performed before the negation:
```
!x+  ==> !(x+)
```
But the `~` negation gives the prefix precedence:
```
~x+  ==> (~x)+
```
This changes the precedence of all the prefixes: `! & ~`, but it makes makes no difference to the original grammar, since in that case the use of both a prefix and a suffix together has no practical purpose.

### Numeric Repeats

The standard repeat operators are: `x?` to repeat `x` `0..1` times (an optional `x`), `x*` for `0..`(zero or more times), and `x+`for `1..` (one or more times).

It is sometimes helpful to be able to specify a numeric range `min..max` for the number of repeats. The expression: `x*3` will repeat the expression `x` exactly 3 times, `x*4..` repeats as many times as possible with a minimum of 4, and: `x*5..7` repeats `x` the in the inclusive range `min..max`.
### Case Insensitive Matches

It is sometimes useful to be able to match a string without regard to upper or lower case. This is awkward to write, so for convenience the literal string to be given an optional `i` suffix to match a case insensitive string.
### Extension Functions

In practice grammars occasionally need to contain syntax that is too gnarly to be expressed in a PEG (or any context free grammar). We need an escape hatch to allow a grammar to employ custom extension functions.

For example, the `` `code` `` format in Markdown uses some number of back-ticks as quote marks. The grammar for that syntax is something like this:
```
code = tics ~tics* tics
tics = '`'+
```
But the number of back-tick quote marks must match (to allow the string to contain a smaller number). There is no way express this other than to spell them all out:
```
code = '```' ~'```'* '```'
     / '``' ~'``'* '``'
     / '`' ~'`'* '`'
```
A PEG grammar has no general way to specify the *same* matching number of tick marks.

To express this syntax a custom extension function can be used like this:
```
code = tics ~<same tics>* tics
tics = '`'+
```
The `<same tics>` extension function matches the `tics` rule *only* if it matches the *same* text that was matched by the previous `tics` rule.

Extension functions are implemented in the host programming language, so they provide an escape hatch that can be used for anything.

Other PEG implementations [1],[2],[3], have extended the original PEG to allow the grammar rules to execute semantic actions, but that injects a full programming language directly into the grammar, and that should be avoided for portability. 

Extension functions *could* be used to implement semantic actions, but that is not the intent. Semantic actions can almost always be handled by processing the parse-tree *after* the parser has executed the grammar. Extension functions are intended for syntax that can not be expressed in the grammar in any other way.

### Escape Codes

A small set of escape codes is introduced to allow Unicode character to be matched as point-code values, regardless of how the host programming language encodes these characters. Three common white-space control codes can also be represented with their familiar escape code notations:
```
\t           \u0009 HT
\n           \u000a LF
\r           \u000c CR

\x12         2 hex code digits
\u12324      4 hex code digits
\U12345678   8 hex code digits
```
This is a sub-set of the escape codes defined in the original PEG grammar. The Unicode hex escapes codes replace the original ASCII octal escape codes.

Notice that there are no escape codes for quotes, square brackets, or the back-slash itself, a literal back-slash character can be represented directly as: `'\'` or `[\]`. 

For portability between programming languages it is best to avoid escape codes. However, this small set is reasonably robust. If the grammar is in a programming language C-string with escape codes then it will be translated by the programming language before the PEG parser sees the grammar text. On the other hand, if the grammar is in a programming language raw-string (a format with no escape codes) then the PEG parser will translate these escape codes. There is never any need for troublesome double escape translations.
### Rule Definitions

The new PEG rules may be defined with an `=` or `:` (rather than `<-`). These rule definitions, and rule name conventions, are used to simplify the parse tree that a parser will generate. The `:` rules are anonymous literal matches that will not appear in the parse tree.

The new PEG grammar language goes beyond the original PEG to defines how a parser should interpret the grammar, and the form of the parse tree that it generates. But this does not effect the language syntax that the grammar rules define.

## A Portable PEG

Before we add any new features we will modify the original core grammar slightly to take account of issues that arose from the discussion of new features:

* The prefix operators have precedence over the repeat suffix operators.
* Escape codes are used for the whitespace control code characters.

This core grammar is as simple as possible, just sufficient to define itself. It can be used as a bootstrap for the full pPEG grammar.
```
Peg   = _ rule+
rule  = id _ '=' _ alt
alt   = seq ('/'_ seq)*
seq   = rep+
rep   = pre sfx? _
pre   = pfx? prime
pfx   = [~!&]
sfx   = [*+?]
prime = call / quote / class / group
group = '('_ alt ')'
call  = id _ !'='
id    = [a-zA-Z_]+
quote = ['] ~[']* [']
class = '[' ~']'* ']'
_     = [ \t\n\r]*
```

This full pPEG grammar adds all the new features:
```
Peg    = _ rule+
rule   = id _ def _ alt
def    = '=' ':'? / ':' '='?
alt    = seq ('/'_ seq)*
seq    = rep+
rep    = pre sfx? _
pre    = pfx? prime

pfx    = [~!&]
sfx    = [+?] / '*' nums?
nums   = min ('..' max)?
min    = [0-9]+
max    = [0-9]

prime  = call / quote / class / group / extn
call   = id _ !def
group  = '('_ alt ')'
id     = [a-zA-Z_] [a-zA-Z0-9_-]*
 
quote  = ['] (!['] char)* ['] 'i'?
class  = '[' range* ']' / dot
range  = !']' char ('-' !']' char)?
dot    = '.'

char   = '\' esc / .
esc    = [tnr] / 'x' hex*2 / 'u' hex*4 / 'U' hex*8
hex    = [0-9a-fA-F]
 
extn   = '<' ~'>'* '>'

_      : (SPACE / COMMENT)*
SPACE  : [ \t\n\r]+
COMMENT: '#' ~[\n\r]*
```
The escape codes are defined and used in this self defining grammar.

The definition of the `.` symbol is no longer essential, `~[]` could be used, but the dot is retained for compatibility with the original PEG.

The last three rules (from `_` on) are defined with `:`  as anonymous literal matches that will not appear in the parse tree.  A parser for a traditional grammar would use an lexical token pre-pass to perform a similar task.

Although this `Peg` grammar is a good self defining specification, in practice a parser may use a simpler version that the core grammar can bootstrap. The escape codes do not need to be explicit in the grammar, and the `char` rule can simply match any Unicode character.

The core grammar can bootstrap this pragmatic parser grammar:
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

## Conclusion

Ford's original PEG has been reduced to a minimal core grammar that defines itself. 

This core grammar is used to bootstrap a new PEG grammar that supports and enhances all the features of the original PEG. The changes are for simplicity and portability.

The new portable pPEG grammar also defines a parse tree structure, and automates a parser, but that is independent of the PEG grammar language itself and is not discussed here.

## References

[Bryan Ford 2004](https://bford.info/pub/lang/peg/) the original PEG specification. 

[1] PEG parser combinator libraries: [Pigeon GO](https://github.com/mna/pigeon), [Parboiled JAVA](https://github.com/sirthias/parboiled/wiki)  
[2] PEG parser generators: [peg/leg C](https://www.piumarta.com/software/peg/), [Peggy JS](https://peggyjs.org/index.html), [Pegasus .NET](https://github.com/otac0n/Pegasus)  
[3] PEG used in the Python Parser: [Python PEG](https://peps.python.org/pep-0617/)

[4] **End Notes:**

Some more details on how the original PEG was simplified.

* The `EndOfFile` is eliminated (falling short is considered a failure).
* Many uses of the `Spacing` rule were redundant and could be eliminated.
* The `Space` rule is replaced by the: `_ = <whitespace>*` rule.
* The `EndOfLine` rule is not required, line breaks are absorbed as white-space.
* The `Comment` rule is improved by deleting the `EndOfLine` requirement.
*  Improve: `Sequence <- Prefix*`  to be: `Sequence <- Prefix+`
