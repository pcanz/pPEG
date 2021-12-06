#   Operator Expressions

By an operator expression I mean almost any symbolic sequence of operators and operands, in particular infix binary operators. A simple example is an arithmetic expression, such as: `1+2*3`. 

The problem is how to parse an operator expression, the parse tree for: `1+2*3` could be:
``` eg
		          *         or        + 
		         / \                 / \ 
		        +   3               1   *
		       / \                     / \
		      1   2                   2   3

		     ((1+2)*3)      or     (1+(2*3))
```
In Lisp s-expression style functional form this can be expressed as:
``` eg            
            (* (+ 1 2) 3)       or     (+ 1 (* 2 3))
```
The operator symbols act as functions with two (or more) arguments. For arithmetic operators we expect the second option where `*` has priority over `+`. But if we do not know that `+` means addition or that `*` means multiply, then the first option (left associative) is more natural.

##	Precedence

The operator *precedence* determines how tightly the operator binds its operands. If the `+` had a higher precedence than the `*` then the parse tree would be: `((1+2)*3)`. But in arithmetic the `*` operator has a higher precedence and binds its operands more tightly than the `+` operator, so the parse tree is: `(1+(2*3))`.

After the parser has built a parse tree then an application process can "walk" the tree to evaluate the expression. It is only then that the semantic meaning of the operators (addition or multiplication) becomes relevant.

More complex operator expressions may include logical operators, comparison operators, assignment, and many other special purpose application specific operators. As far as the syntax is concerned the operators may be used for any purpose in any kind of DSL (Domain Specific Language).

The focus here is only on the translation of an operator expression into a syntax parse tree. Arithmetic expressions are useful as familiar examples.

##	Associativity

Operator associativity determines how operators with the *same* precedence should be parsed.

For example, arithmetic negation `1-2-3` is left associative:
``` eg
             -              not         -
            / \                        / \
           -   3                      1   -
          / \                            / \
         1   2                          2   3

        ((1-2)-3)           not       (1-(2-3))
```
In contrast, the convention for an exponent operator is right associative `xfy`. The expression binds from right to left. Given that a `^` exponent operator is right associative, then `x^2^3` should be parsed as:
``` eg 
          ^          not           ^
         / \                      / \
        x   ^                    ^   3
           / \                  / \
          2   3                1   2

        (x^(2^3))     not      ((x^2)^3)
```
Now we can look at how a pPEG grammars parse operator expressions.


##  Operator Expression Grammar Rules

A grammar for simple arithmetic:

    add = mul ("+" mul)*
    mul = val ("*" val)*
    val = [0-9]+

Here are some example pPEG parse tree results:

    "1"     ==> ["val", "1"]

    "1+2"   ==> ["add", [["val", "1"], ["val", "2"]]]

    "1*2"   ==> ["mul", [["val", "1"], ["val", "2"]]]

    "1+2+3" ==> ["add", [["val", "1"], ["val", "2"], ["val", "3"]]]

    "1+2*3" ==> ["add", [["val", "1"], ["mul", [["val", "2"], ["val", "3"]]]]]

    1+2*3 => (+ 1 (* 2 3))

The grammar matches the operators as quoted literals so they do not appear in the parse tree (since they are not named rules). The rule names appear as in the ptree as functions with a list of arguments. Rules that do not match any operator are redundant and do not appear in the parse tree.

Operator precedence is determined by the order that the rules are called in. The `add` rule calls the `mul` rule, so the `add` has a lower precedence than the `mul`, and the `mul` will bind its argument more tightly.

The parse tree compares quite well with the functional form, with the rule names standing in for the operator symbols:

    "1+2*3" ==> ["add", [["val", "1"], ["mul", [["val", "2"], ["val", "3"]]]]]

    1+2*3 => (+ 1 (* 2 3))

A rule for parenthesis can be added with a higher precedence that can over-ride the operator precedence:

    add = mul ("+" mul)*
    mul = var ("*" var)*
    var = val / "(" add ")"
    val = [0-9]+

    "(1+2)*3" ==> ["mul", [["add", [["val", "1"], ["val", "2"]]], ["val", "3"]]]

    (1+2)*3 => (* (+ 1 2) 3)

The parentheses are in the `var` rule which is called from the `mul` rule so it will bind tighter than the other operators. The parentheses are matched as anonymous literals and thus do not appear in the parse tree.

The `var` rule can be extended to allow identifiers (or other things):

    add = mul ("+" mul)*
    mul = var ("*" var)*
    var = val / id / "(" add ")"
    val = [0-9]+
    id  = [a-z]+

    "(x+y)*3" => ["mul", [["add", [["id", "x"], ["id", "y"]]], ["val", "3"]]]

    (x+y)*3 => (* (+ x y) 3)

Other operators can be slotted into precedence order, and white-space can be allowed before or after any expression or operator:

    exp = " " sub " "
    sub = add (" - " add)*
    add = div (" + " div)*
    div = mul (" / " mul)*
    mul = pow (" * " pow)*
    pow = var (" ^ " var)*
    var = val / id / "(" exp ")"
    val = [0-9]+
    id  = [a-z]+

    "x+y^2" => ["add", [["id", "x"], ["pow", [["id", "y"], ["val", "2"]]]]]

    x+y^2 => (+ x (^ y 2))

This works very well for a modest number of operators, but it forces every operator to have its own rule with its own precedence level (determined by the order the rules are called in). This becomes cumbersome and inefficient if there are too many operators requiring too many rules.

For a larger number of operators we can use an `<infix>` extension function.


##  Infix Extension

Let's start again, but this time with the aid of an `<infix>` extension function. This requires a named operator rule, which can match multiple operator symbols.

For example:

    expr = val (op val)* <infix>
    op   = " + " / " - "
    val  = [0-9]+

    "1" ==> ["val", 1]

    "1+2" ==> ["+", [["val", "1"], ["val", "2"]]]

    "1+2-3" ==> ["-", [["+", [["val", "1"], ["val", "2"]]], ["val", "3"]]]

    1+2-3 => (- (+ 1 2) 3)

The `<infix>` function transforms the rule result into a functional form using the operator symbols to label the ptree nodes. The operator symbols replace the rule name, and the `expr` rule name does not appear in the ptree.

By default the `<infix>` function generates a left associative ptree without any operator precedence. But we can fix that by using a rule name convention for the operator names. The `<infix>` function interprets a rule name ending with `_x`, where x is a digit, as a left associative operator with precedence `x`, and an operator rule name ending in `_xR` is right associative.

For example:

    expr  = val (op val)* <infix>
    op    = " " (op_1 / op_2 / op_3R) " "
    val   = [0-9]+
    op_1  = [-+]
    op_2  = [*/]
    op_3R = '^'

    "1" ==> ["val", 1]

    "1+2" ==> ["+", [["val", "1"], ["val", "2"]]]

    "1+2*3" ==> ["+", [["val", "1"], ["*", [["val", "2"], ["val", "3"]]]]]

    1+2*3 => (+ 1 (* 2 3))

The addative operators have be labelled `op_1` so they are left associative with a low precedence binding power. The product operators labeled `op_2` have a higher precedence with a binding power of 2. In the expression `1+2*3` the `*` has a higher binding power relative to the `+` so it will bind its operands tighter. 

The exponent operator `^` is labelled `op_3R` so it is right associative and it has the highest precedence with a binding power of 3, so it will bind its operands the tightest.

The `<infix>` extension enables a single operator expression rule to match any number of operators grouped in up to ten levels of precedence. A grammar may have more than one operator expression rule.

For example here is an operator expression for the GO-language which has 19 operators (plus two prefix operatos) in five precedence levels:

    exp   = " " opx " "
    opx   = pre (op pre)* <infix>
    pre   = pfx? var
    var   = val / id / "(" exp ")"
    val   = [0-9]+
    id    = [a-z]+
    pfx   = [-+]
    op    = " " (op_1/op_2/op_4/op_5/op_3) " "
    op_1  = '||'
    op_2  = '&&'
    op_3  = '<'/'>'/'>='/'<='/'=='/'!='
    op_4  = [-+|^]
    op_5  = [*/%&]/'<<'/'>>''/'&^'

All the infix operators in GO are left associative.

The `<infix>` function is an amazingly simple way to parse all kinds of operator expressions.
 
To do this magic the `<infix>` function implements the Pratt parser algorith, explained in [PrattParsing].

The Pratt algorithm needs to know the relative binding power of all the operators, and we can do that in a pPEG grammar with a rule name convention for the operators. This nicley integrates the Pratt algorithm into the grammar rules. The operator precedence is clearly specified in the grammar rules, not off somewhere else in the code implementing the Pratt implementation.

Pratt claimed his technique is trivial to implement, easy to use, extremely efficient, and very flexible. Why then is it not better known? 

Pratt suggested that a preoccupation with BNF grammars and their various offspring, along with their related automata and theorems, has precluded development in directions that are not visibly in the domain of automata theory.

With pPEG we don't have to abandon BNR style grammar rules to use a Pratt parser, we can integrate the Pratt algorithm into the grammar rules. BNF grammar rules are traditionally used to specify a context free grammar, but they work just as well for a PEG grammar.

A PEG grammar struggles with large scale operator expressions, a Pratt parser is much better for that. The `<infix>` extension enables pPEG grammar rules to be extended with the power of Pratt parsing. 


[PrattParsing]: https://github.com/pcanz/pPEG/blob/master/docs/PrattParsing.md

