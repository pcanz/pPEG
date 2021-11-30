#   Operator Expressions

By an operator expression I mean almost any symbolic sequence of operators and operands, in particular binary infix operators. A simple example is an arithmetic expression, such as: `1+2*3`. 

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
            (* (+ 1 2) 3)   or     (+ 1 (* 2 3))
```
The operator symbols act as functions with two (or more) arguments. For arithmetic operators we expect the second option where `*` has priority over `+`. But if we do not know that `+` means addition or that `*` means multiply, then the first option is more natural, as in:

``` eg
            1~2#3  =>  (# (~ 1 2) 3)  rather than:  1~2#3  =>  (~ 1 (# 2 3))
```
The natural default is to associate the operators with their arguments from left to right.

##	Precedence

The operator *precedence* determines how tightly the operator binds its operands. If the `+` was given a higher precedence than the `*` then the parse tree would be: `((1+2)*3)`. But in arithmetic the `*` operator has higher precedence and binds its operands more tightly than the `+` operator, so the parse tree is: `(1+(2*3))`.

After the parser has built a parse tree then an application process can "walk" the tree to evaluate the expression. It is only then that the semantic meaning of the operators (addition or multiplication) becomes relevant.

More complex operator expressions may include logical operators, comparison operators, assignment, and many other special purpose application specific operators. As far as the syntax is concerned the operators may be used for any purpose in any kind of DSL (Domain Specific Language).

The focus here is only on the translation of an operator expression into a syntax parse tree. Arithmetic expressions are useful as familiar examples.

##	Associativity

Associativity determines how operators with the *same* precedence should be parsed.

For example, `1-2-3` could be parsed as:
``` eg
             -              or          -
            / \                        / \
           -   3                      1   -
          / \                            / \
         1   2                          2   3

        ((1-2)-3)           or        (1-(2-3))
```
The first option is left associative, which is correct for most arithmetic operators. The operand subexpressions are bound from left to right.

In contrast, the convention for an exponent operator is right associative. The expression binds from right to left. Given that the `^` exponent operator is right associative, then `x^2^3` should be parsed as:
``` eg        
          ^          not           ^
         / \                      / \
        x   ^                    ^   3
           / \                  / \
          2   3                1   2

        (x^(2^3))     not      ((x^2)^3)
```
However, if we use a function form with more than two arguments then the distinction vanishes:
           -                      ^
         / | \                  / | \
        1  2  3                x  2  3

      1-2-3 => (- 1 2 3)      x^2^3 => (^ x 2 3)

If the parser generates a parse tree in functional form then there is only one form, there is no need to worry about associativity in the grammar or the parser.

When an application evalates a functional form then the application can decide to evaluate its argument list from left to right or right to left. It can apply a fold-left or fold-right (or reduce, or accumulate) function as appropriate.

Now we can look at how a pPEG grammars deal with operator expressions.

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

The operators are matched as quoted literals (not named rules), so they do not appear in the parse tree. The rule names appear as functions with a list of arguments. Redundant rules that do not match any operator do not appear in the parse tree.

Operator precedence is determined by the order that the rules are called in. The `add` rule calls the `mul` rule, so the `add` has a lower precedence than the `mul`, and the `mul` will bind its argument more tightly.

The parse tree compares quite well with the functional form, with the rule names standing in for the operator symbols:

    "1+2*3" ==> ["add", [["val", "1"], ["mul", [["val", "2"], ["val", "3"]]]]]

    1+2*3 => (+ 1 (* 2 3))

Operator associativity is a semantic issue. The rule names appear as functions which may have more than two arguments. The application can evaluate either a left or a right reduction of their argument list (most arithmetic operators are left associative).

    "1+2+3" ==> ["add",[["val","1"],["val","2"],["val","3"]]]

    1+2+3 => (+ 1 2 3)

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

Other operators can be slotted into the precedence order, and white-space can be allowed before or after any expression or operator:

    exp = " " add " "
    add = sub (" + " sub)*
    sub = mul (" - " mul)*
    mul = div (" * " div)*
    div = pow (" / " pow)*
    pow = var (" ^ " var)*
    var = val / id / "(" exp ")"
    val = [0-9]+
    id  = [a-z]+

    "x+y^2" => ["add", [["id", "x"], ["pow", [["id", "y"], ["val", "2"]]]]]

    x+y^2 => (+ x (^ y 2))

This works very well for a small number of operators, but it becomes cumbersome and inefficient if there are too many operators (requiring too many rules).

To reduce the number of rules required the grammar could match all operators with the same precedence in the same rule:

    exp  = " " cmp " "
    cmp  = sum (op1 sum)*
    sum  = prod (op2 prod)*
    prod = pow (op3 pow)*
    pow  = var (" ^ " var)*
    var  = val / id / "(" exp ")"
    val  = [0=9]+
    id   = [a-z]+
    op1  = " < " / " > " / " >= " / " <= " / " == " / " != "
    op2  = " + " / " - "
    op3  = " * " / " / "

The parse tree now includes the operators, and it is the operators rather than the rule names that determine the oppropriate function. So the application will need to do some more work to process this kind of parse tree:

    "x+y>2" ==> ["cmp", [
                    ["sum", [["id", "x"],["op2","+"],["id", "y"]]],
                    ["op1", ">"],
                    ["val", "2"]]]

    x+y>2 => (> (+ x y) 2)

This makes life more difficult for the application. Fortunatley there is a better way. 


##  Infix Operators

Let's start again, but this time with the aid of a `<infix>` extension function that transforms the rule result and substritutes the operator symbol for the rule name:

    add = mul (op1 mul)* <infix>
    mul = val (op2 val)* <infix>
    val = [0-9]+
    op1 = " + " / " - "
    op2 = " * " / " / "

    "1+2*3" ==> ["+", [["val", "1"], ["*", [["val", "2"], ["val", "3"]]]]]

The `<infix>` has essentially replaced the rule name by the operator symbol. The result is the same as the function form that is generted by a grammar that has a rule name for each operator.

    1+2*3 => (+ 1 (* 2 3))

The grammar rules determine the operator precedence, and the `<infix>` function transforms the rule result into a functional form. 

More rules could be added for extra levels of presedence, just as we saw earlier.

But if the `<infix>` is given a list of operators ordered by their precedence then the grammar only needs a single rule for the full operator expression. The `<infix>` function will transform the rule result into a ptree in functional form.

For example:

    exp = " " opx " "
    opx = pre (" " op " " pre)* <infix>
    pre = pfx? var
    var = val / id / "(" exp ")"
    val = [0-9]+
    id  = [a-z]+
    op  = [<>=%^&|*/+-]+
    pfx = [-+~]

    "x+y>2" ==> [">", [["+", [["id", "x"],["id", "y"]]],["val", "2"]]]

By default the `<infix>` function will associate the operators from left to right, all with the same precedence. 

If the `<infix>` is configured with a list of operator binding powers then it can implement operator precedence.

The `<infix>` could be configured with a pseudo grammar rule like this:

    <infix> = [
        "||",
        "&&",
        "< <= == != > >=",
        "+ - | ^",
        "* / % << >> & &^",
    ]

The rule body is a JSON format for a list of strings. Each string contains one or more space separated operator symbol with the same precedence. The precedence of each string of operators increases through the list, later operators bind tighter. This list of operators is for the GO language which has only five precedence levels (C++ has 17 levels).

The `<infix>` function is an amazingly simple way to parse all kinds of operator expressions.


###  How Infix Works

The `<infix>` function transforms a rule result ptree list of operands and operators such as:

    ["var","x"],["op","+"],["var","y"],["op","*"],["val","2"]

It does not matter what the rule names for the operators or operands are, it only requires the binary operators to be between their operands, in the same order that they are matched in the source text.

In a pPEG parser machine an extension function has access to the parse tree as it is being constructed. So the `<infix>` function can read the list of tokens generated by the operator expression rule. It transforms this list into a parse tree rule result that is exactly the same as the ptree result that would result from a much larger pPEG grammar that defined all the operators in their own separate grammar rules.

The `<infix>` function implements a Pratt parser.


####  Pratt Parser

This Pratt parser uses an amazing little alorithm that was invented in 1973, but it has been largley ignored for many years. 

Fortunatley there has been a revival of interest in Pratt parsing in recent years and there are several nice blog posts that explain how it works:

*   A nice introduction [Nystrom]
*   Another neat explination [matklad]
*   A survery of Pratt parser posts [survey]

The key idea is to assign a numeric binding power value to the operators that can be used to determine the operator precedence and that controls how the parse tree is constructed.





[Nystrom]: https://journal.stuffwithstuff.com/2011/03/19/pratt-parsers-expression-parsing-made-easy/
[matklad]: https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
[survey]: https://www.oilshell.org/blog/2017/03/31.html
[Parsing Techniques]: https://www.amazon.ca/Parsing-Techniques-Practical-Monographs-Computer-ebook/dp/B0017AMLL8/ref=sr_1_2?gclid=Cj0KCQiA7oyNBhDiARIsADtGRZY2jq_9Be-PSMhzCN063R6-1iD77wBaFXfAj00s-0AkQznH961WuwgaAqKfEALw_wcB&hvadid=229967343506&hvdev=c&hvlocphy=9000685&hvnetw=g&hvqmt=e&hvrand=6051650027826917021&hvtargid=kwd-301544705503&hydadcr=16052_10267847&keywords=parsing+techniques&qid=1638139070&sr=8-2





---
More rule can be added for extra levels of presedence:

    exp  = " " exp1 " "
    exp1 = exp2 (op1 exp2)* <infix>
    exp2 = exp3 (op2 exp3)* <infix>
    exp3 = exp4 (op3 exp4)* <infix>
    exp4 = var (" ^ " var)*
    var  = val / id / "(" exp ")"
    val  = [0=9]+
    id   = [a-z]+
    op1  = " < " / " > " / " >= " / " <= " / " == " / " != "
    op2  = " + " / " - "
    op3  = " * " / " / "

    "x+y>2" ==> [">", [["+", [["id", "x"],["id", "y"]]],["val", "2"]]]

Prefix operators can be handled separatley:

    exp  = " " exp1 " "
    exp1 = exp2 (op1 exp2)* <infix>
    exp2 = exp3 (op2 exp3)* <infix>
    exp3 = exp4 (op3 exp4)* <infix>
    exp4 = pre (" ^ " pre)*
    pre  = pfx? var
    var  = val / id / "(" exp ")"
    val  = [0=9]+
    id   = [a-z]+
    op1  = " < " / " > " / " >= " / " <= " / " == " / " != "
    op2  = " + " / " - "
    op3  = " * " / " / "
    pfx  = [-+~]


##  Operator Precedence

The grammar can sbe colapsed to a single rule for an operator expression. This simply builds a flat list for the full operator expression:

---

---
The opeerators are associated left to right without any operator precedence:

    "1+2*3" ==> ["*", [["+", [["val", 1], ["val", 2]]], ["va;", 3]]]

The precedence needs to be made explicit:

    "1+(2*3)" ==> ["+", [["val", 1], ["*", [["val", 2], ["va;", 3]]]]]

---

This transform function can be packaged into a pPEG grammar extension function:

    exp = " " opx " "
    opx = var (" " op " " var)* <infix>
    var = val / id / "(" exp ")"
    val = [0-9]+
    id  = [a-z]+
    op  = [<>=^*/+-]+

    "1+2<5"  ==>  ["<",[["+",[["val",1],["val",2]]],["val",5]]]
---



