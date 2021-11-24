#   Operator Expressions

A grammar for simple arithmetic:

    add = mul ("+" mul)*
    mul = val ("*" val)*
    val = [0-9]+

Here are some example parse tree results:

    "1"     ==> ["val", "1"]
    "1+2"   ==> ["add", [["val", "1"], ["val", "2"]]]
    "1*2"   ==> ["mul", [["val", "1"], ["val", "2"]]]
    "1+2+3" ==> ["add", [["val", "1"], ["val", "2"], ["val", "3"]]]
    "1+2*3" ==> ["add", [["val", "1"], ["mul", [["val", "2"], ["val", "3"]]]]]

The operators are matched as quoted literals (not named rules), so they do not appear in the parse tree. The rule names appear as operator functions with a list of arguments. Redundant rules that do not match any operator do not appear in the parse tree.

Operator precedence is determined by the order that the rules are called in. The `add` rule calls the `mul` rule, so the `add` has a lower precedence than the `mul`, and the `mul` will bind its argument more tightly.  

Operator associativity is a semantic issue, the rule names appear as functions with two or more arguments. The function can do a left or right reduction on their argument list as appropriate (most arithmetic operators are left associative).

A rule for parenthesis can be added with higher precedence:

    add = mul ("+" mul)*
    mul = var ("*" var)*
    var = val / "(" add ")"
    val = [0-9]+

    "(1+2)*3" ==> ["mul", [["add", [["val", "1"], ["val", "2"]]], ["val", "3"]]]

The parentheses are in the `var` rule which is called from the `mul` rule so it will bind tighter than the other operators. The parentheses are matched as anonymous literals and thus do not appear in the parse tree.

The `var` rule can be extended to allow identifiers (or other things):

    add = mul ("+" mul)*
    mul = var ("*" var)*
    var = val / id / "(" add ")"
    val = [0-9]+
    id  = [a-z]+

    "(x+y)*3" ==> ["mul", [["add", [["id", "x"], ["id", "y"]]], ["val", "3"]]]

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

    " x + y^2 " ==> ["add", [["id", "x"], ["pow", [["id", "y"], ["val", "2"]]]]]

This works well for a small number of operators, but it becomes cumbersome and inefficient if there are too many operators.


##  Many Operators

For larger grammars with more operators the grammar may match multiple operators at the same precedence level, and thereby reduce the number of rules required:

    exp  = " " cmp " "
    cmp  = sum (" " op1 " " sum)*
    sum  = prod (" " op2 " " prod)*
    prod = pow (" " op3 " " pow)*
    pow  = var (" ^ " var)*
    var  = val / id / "(" exp ")"
    val  = [0=9]+
    id   = [a-z]+
    op1  = "<" / ">" / ">=" / "<=" / "==" / "!="
    op2  = "+" / "-"
    op3  = "*" / "/"

    " x+y > 2 " ==> ["cmp", [["sum", [["id", "x"],["op2","+"],["id", "y"]]],
                             ["op1", ">"],
                             ["val", "2"]]]

Or the grammar can simply build a flat list for the full operator expression:

    exp = " " opx " "
    opx = var (" " op " " var)*
    var = val / id / "(" exp ")"
    val = [0-9]+
    id  = [a-z]+
    op  = [<>=^*/+-]+

    " x+y > 2 " ==> ["opx",[["val","1"],["op","+"],["val","2"],["op","<"],["val","5"]]

This parse tree can be transformed into a parse tree with the correct operator precedence by processing the parse tree using a function inspired by the Pratt parser algorithm, with the result:

    ["opx",["<",[["+",[["val",1],["val",2]]],["val",5]]]]

This transform function can be packaged into a pPEG grammar extension function:

    exp = " " opx " "
    opx = var (" " op " " var)* <infix>
    var = val / id / "(" exp ")"
    val = [0-9]+
    id  = [a-z]+
    op  = [<>=^*/+-]+

    "1+2 < 5"  ==>  ["opx",["<",[["+",[["val",1],["val",2]]],["val",5]]]]

The `<infix>` function is an amazingly simple powerful and flexible way to parse all kinds of operator expressions.

The only information that the `<infix>` function requires is a list of the operator symbols ordered by their precedence, in other words ordered by the strength of their binding power.

Prefix operators can be handled separatley:

    exp = " " opx " "
    opx = pre (" " op " " pre)* <infix>
    pre = pfx* val
    var = val / id / "(" exp ")"
    val = [0-9]+
    id  = [a-z]+
    pfx = [-+!~]
    op  = [<>=^*/+-]+


##  Pratt Parser

The `<infix>` function is derived from the Pratt parser algorithm. This amazing little alorithm was invented in 1973, but it has been largley ignored for many years. There is no mention of it in [Parsing Techniques] which is the "bible" of all parser algorithms. Fortunatley there has been a revival of interest in recent years and there are several nice blog posts that explain how it works:

*   A nice introduction [Nystrom]
*   Another neat explination [matklad]
*   A survery of Pratt parser posts [survey]

##  Implementaion in pPEG

In pPEG an extension function has access to the parse tree as it is being constructed. So the `<infix>` function can read a list of tokens generated by the operator expression rule. It transforms this list into a parse tree rule result that is exactly the same as the ptree result that would result from a much larger pPEG grammar that defined all the operators in their own separate rules.




[Nystrom]: https://journal.stuffwithstuff.com/2011/03/19/pratt-parsers-expression-parsing-made-easy/
[matklad]: https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
[survey]: https://www.oilshell.org/blog/2017/03/31.html




