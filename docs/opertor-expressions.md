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

##  Too Many Operators

For larger grammars with more operators the grammar may match multiple operators at the same precedence level, and thereby reduce the number of rules required:

    exp = " " cmp " "
    cmp = add (" " op1 " " add)*
    op1 = "<" / ">" / ">=" / "<=" / "==" / "!="
    add = sub (" + " sub)*
    sub = mul (" - " mul)*
    mul = div (" * " div)*
    div = pow (" / " pow)*
    pow = var (" ^ " var)*
    var = val / id / "(" exp ")"
    val = ~"0..9"+
    id  = ~'a..z'+

    " x+y > 2 " ==> ["cmp", [["add", ["id", "x"], ["id", "y"]],
                             ["op1", ">"],
                             ["val", "2"]]]

Or the grammar can simply build a list of tokens as the parse tree:

    exp = " " opex " "
    opx = var (" " op " " var)*
    op  = "<" / ">" / ">=" / "<=" / "==" / "!=" /
          "+" / "-" / "*" / "/" / "^"
    var = val / id / "(" exp ")"
    val = [0-9]+
    id  = [a-z]+

    " x+y > 2 " ==> ["opx", [
                      ["opx", [["id", "x"], ["op", "+"], ["id", "y"]],
                      ["op", ">"],
                      ["val", "2"]]]

This parse tree can be transformed into a parse tree with the correct operator precedence by processing the parse tree using a function inspired by Pratt's parser algorithm:

    const precedence = {
        "<":1 , ">":2 , ">=":3 , "<=":4 , "==":5 , "!=":6 ,
        "+":7 , "-":8 , "*":9 , "/":10 , "^":11
    ]

    function opx(exp) {
        const [opx, x, op, y] = exp;

    }



---

Operator expressions for simple arithmetic expressions are the classic example used to demonstrate and explain an AST (Abstract Syntax Tree).

For example:

    1+2*3  ==>   (+ 1 (* 2 3))

Or as a tree diagram:

         +
        / \
       1   *
          / \
         2   3    

Grammar theory often start with a abstract grammar based on mathematical induction. 

For our example the base case for an expression e is a digit, and if e is an expression then  e+e is an expression, and e*e is an expression:

    e = 0|1|2|...|9|
    e = e + e
    e = e * e

This abstract grammar is ambiguous, it can generate the AST we want, but it can also generate:

    1+2*3  ==>  (* (+ 1 2) 3)

         *
        / \
       +   3
      / \
     1   2    

This is fine in theory, but in practice a [CFG] (Context Free Grammar) is more helpful. The fact that `*` has higher precedence than `+` can be encoded into the grammar rules:

    sum = sum '+' mul | mul
    mul = mul '*' val | val
    val = [0-9]+

This CFG parser can generate the desired AST. 

    1+2*3  ==>   (+ 1 (* 2 3))

Automated generation of a parser from a CFG grammar specification has been very well studied, and lots of different algorithms and techniques have been established. It is not an easy problem and generating of an efficient CFG parser requires heavy machinery.

A [PEG] (Parser Expression Grammar) can express any unambiguous CFG grammar. In a PEG alternatives are ordered with a deterministic committed choice. PEG rules map almost directly into a top down recursive descent parser.  

    sum = mul ('+' mul)*
    mul = val ('*' val)*
    val = ~'0..9'+

This particular PEG notation differs slightly from the original [PEG] definition, but it should be easy enough to follow. For details see [PEGe].

There is no standard form for a PEG parse tree, it can be processed into any AST format that best suits the application.

Without left recursion the PEG parse tree can not 




##  PEG Parse Tree

We will define a specific form that uses the rule name as label for the value that the rule has matched:

    1+2*3  ==>  (sum (val 1) (mul (val 2) (val 3)))

More specifically the parse tree has two node forms:

    ["rule", "string"]

    ["rule", [... list of rule results ...]]

For example:

    1+2*3  ==>  ["sum", [
                    ["val", "1"],
                    ["mul", [["val", "2"], ["val", "3"]]]]]





