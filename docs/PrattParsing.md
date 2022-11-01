#   Pratt Parsing Deconstructed

A very neat and powerful parser algorithm was published back in 1973 by Vaughn Pratt[^1], but for many years this method has been largely ignored. 

Pratt claimed his technique is trivial to implement, easy to use, extremely efficient, and very flexible. Why then is it not better known? 

Pratt suggested that a preoccupation with BNF grammars and their various offspring, along with their related automata and theorems, has precluded development in directions that are not visibly in the domain of automata theory.

Fortunately there has been a revival of interest more recently, and there are nice blog posts by [matklad] and [Nystrom] that explain how it works. Another variant that is closer to the original Pratt paper has been popularized by Douglas [Crockford], and there is also a [survey] of other posts.

I must admit that I found Pratt's paper hard to follow, but the key idea of using numeric binding powers for each operator was crystal clear. I ended up implementing the Pratt algorithm in a slightly different way that may be easier to understand and explain. So here it is.

##  The Problem

The problem is how to parse an operator expression. I'll stick to simple arithmetic expressions like `1+2*3`. The problem boils down to how to put the brackets in correctly. Should it be `((1+(*3))` or should it be `(1+(2*3))`? For arithmetic the correct answer is `(1+(2*3))`.

An even simpler problem is how to add up a list of numbers, say `1+2+3+4`, in this case you can add from the left: `(((1+2)+3)+4)` or you can add from the right: `(1+(2+(3+4)))` it makes no difference, they both produce the same answer. But not so with with subtraction, `(((1-2)-3)-4)` is not the same as `(1-(2-(3-4)))`.

For most arithmetic operators starting from the left and going step by step to the right gives the correct answer. These expressions are left associative. But exponential power is an exception: `(x^(2^3))` = `x^8`, not `((x^2)^3)` = `x^6`. For this operator right association is the correct convention.

##  Binding Power

The key idea behind the Pratt algorithm is to assign a numeric weight to the binding power of each operator. In arithmetic the `*` operator is given a higher binding power than the `+` so that `1+2*3` will bind the `(2*3)` before the addition as `(1+(2*3))`.

The expression `1-2-3-4` associates from left to right as `(((1-2)-3)-4)`. But all the operator have the same binding power, so how do we know if they should associate from left to right or right to left? The tick is to give the operator two binding powers, one to the left and the other to the right.

Let's assume that the `-` operator has a binding power of say 2 to the left and 3 to the right, so in `1-2-3` the first `-` will have a binding power of 3 to its right and the second `-` will have a binding power of 2 to its left.  The first `-` operator has a higher binding power than the next one, so it binds its operands tighter: `(1-2)`, and the expression will associated from the left.

The `+` operator can be given the same binding power as the `-` because both these operators associate to the left, and they can be mixed and matched in an expression: `1+2-3+4 => (((1+2)-3)+4)`.

The `*` and `/` operators also associate left to right, but they need a higher binding power than the `+` and `-`. They bind their operands tighter than `+` or `-`.

The exponential `^` operator binds its operands even tighter and associates to the right, so we can give it a binding power of say 6 to the right and 7 to the left. In the expression `x^2^3` the first `^` operator has a binding power of 6 to its right so it binds less tightly that the second `^` operator which has a binding power of 7 to its left, and we get a right association: `(x^(2^3))`.

Here is a table of possible binding powers that will work:

    + => [2, 3],  left associative
    - => [2, 3], 
    * => [4, 5],
    / => [4, 5], 
    ^ => [7, 6],  right associative

If more operators with lower binding powers are required then the numbers can be scaled up, it is only the relative ordering of the binding power numbers that matters. 


##  Tree Building

An expression with brackets forms a tree, for example:

         ((1+(2*3))+4)

                +
               / \
              +   4
             / \
            1   * 
               / \
              2   3

In functional form this is:

         (+ (+ 1 (* 2 3)) 4)   or  +( +(1, *(2 3)), 4)

The Lisp s-expression is a very convenient parse tree structure.

If the input is: `1+2-3+4` then we can start building the parse tree like this:

    ()                   <=  1 + 2 - 3 + 4  
    (+ 1 2)              <=  - 3 + 4
    (- (+ 1 2) 3)        <=  + 4
    (+ (- (+ 1 2) 3) 4)

The first step takes the first operator and its operands `1+2` and translate them into a functional s-expression tree node `(+ 1 2)`. 

The second step adds `- 3` into the tree. The two operators `+` and `-` have the same binding power, but the `+` operator has a higher binding power to the right than the left side binding power of the `-` operator. They will therefore associate to the left as `(- (+ 1 2) 3)`. 

The last step adds `+ 4` into the tree in the same way.

This builds a left hand tree:

                +
               / \
              -   4
             / \
            +   3
           / \
          1   2

The pattern for building a left hand tree is:

    Tree1 = (op1 Left Right)       <= op2 X
    Tree2 = (op2 Tree1 X) 

Adding a new operator-operand with left association builds on top of the current tree, making the current tree the left sub-tree with the new operand on the right. The right binding power of the operator at the root of the left sub-tree has a higher binding power than the left binding power of the new operator.

Operators with right association will build a right hand tree like this:

    ()                  <= x ^2 ^ 3 ^ 4
    (^ x 2)             <= ^ 3 ^ 4
    (^ x (^ 2 3))       <= ^ 4
    (^ x (^ 2 (^ 3 4)))

Each new operator slides down the right hand tree to build a new sub-tree at the bottom.

This builds a right hand tree:

             ^
            / \
           x   ^
              / \
             2   ^
                / \
               3   4 

The pattern for building a right hand tree is:

    Tree1 = (op1 Left Right) <= op2 X
    Tree2 = (op1 Left (Right <= op2 X))
    Tree3 = (op1 Left (op2 Right X)) 

This is more complicated than building the left tree because adding the next operator-operand pair needs to step down the right side. In this example it will always associate to the right with each sub-tree on the way down, because the right binding power of the sub-tree operator is less than the left binding power of the new operator.

In general the new operator needs to check if it should associate to the left or right of each sub-tree. A terminal operand will always have a lower right binding power than the left binding power of any new operator.

To add a new operator-operand pair into a tree we must compare the right binding power of the operator at the root of the tree with the left binding power of the new operator. That determines if the tree should be built to the left or to the right.


##  The Code

A JavaScript program to add an operator-operand into a tree:

    function build_tree(tree, op2, z) {
        if (bind_left(tree, op2)) return [op2, tree, z]; 
        let [op1, x, y] = tree;
        return [op1, x, build_tree(y, op2, z)];
    }

    const BIND = {
        "+": [2,3], "-": [2,3],
        "*": [4,5], "/": [4,5],
        "^": [7,6],
    }

    function bind_left(tree, op) {
        if (!Array.isArray(tree)) return true;
        let tree_bind = (BIND[tree[0]]||[0,0])[1];
        return tree_bind > (BIND[op]||[0,0])[0];
    }

The `bind_left` function compares the right binding power of the operator at the root of the tree with the `op` that is being added into the tree. The `build-tree` function then builds on the left or on the right.

The amazing thing is that the core of the algorithm boils down to the three line `build_tree` function, everything else is straight forward book keeping.

Building on the left:

    [op1, x, y] +  op2, z   ==>   [op2, [op1, x, y], z]

Building on the right:

    [op1, x, y]  +  op2, z   ==>   [op2, x, build_tree(y, op2, z)]

To see the tree builder in action we need to drive it from a list of tokens. For simplicity we will assume that the end of the list of tokens is the end of the infix expression:
 
    function infix(tokens) {
        if (tokens.length <3) return tokens;
        let [x, op, y] = tokens.slice(0,3);
        let tree = [op, x, y];
        for (let i=3; i<tokens.length; i+=2) {
            let [op, z] = tokens.slice(i,i+2);
            tree = build_tree(tree, op, z);
        } 
        return tree;
    }

    let tree = infix("1+2*3+4".split(''));

    console.log(tree); // [ '+', [ '+', '1', [ '*', '2', '3' ] ], '4' ]

Lo and behold! We have a functional infix operator expression parser.

I find this tree building method easy to understand, but it is not quite as elegant as this next version. 

##  Pratt Algorithm

Instead of building up the result parse tree by adding operator-operand pairs, a more elegant solution uses recursion inside a loop. This builds up the result tree on the call stack.

Here is the code:

    const BIND = {
        "+": [2,3], "-": [2,3],
        "*": [4,5], "/": [4,5],
        "^": [7,6],
    }

    function infix_pratt(tokens) {
        let next = 0;
        return pratt(0);

        function pratt(lbp) {
            let result = tokens[next];
            next += 1;
            while (true) {
                const op = tokens[next];
                if (lbp > left_bind(op)) break;
                next += 1; // consume op
                result = [op, result, pratt(right_bind(op))];
            }
            return result;
        }
    }

    function left_bind(op) {
        return op? (BIND[op]||[0,0])[0] : -1;
    }

    function right_bind(op) {
        return (BIND[op]||[0,0])[1];
    }

    let tree = infix_pratt("1+2*3+4".split(''));

    console.log(tree); // [ '+', [ '+', '1', [ '*', '2', '3' ] ], '4' ]

The `pratt` function has an `lbp` parameter that is given the binding power (to the right) of the left operator (the previous operator).

If the next operator has a higher binding power (to its left) then the tree will be built to the right in a loop with recursion that sets the next `lbp` left operator binding power.

If the next operator has a lower binding power than the `lbp` operator binding power then the loop will break and the right hand tree will be returned as the result. This will build up the left hand tree.

Pratt claimed the technique is simple to understand, trivial to implement, easy to use, extremely efficient, and very flexible. In my opinion he was right, it lives up to all these claims, except perhaps for being easy to understand. For me it took some time, and thinking about it as incrementally building up a left hand or right hand tree helped me see what was going on.


[^1]: Pratt, V.R., Top Down Operator Precedence. Proceedings of the ACM Symposium on Principles of Programming Languages. 1973. pp41-51

[Nystrom]: https://journal.stuffwithstuff.com/2011/03/19/pratt-parsers-expression-parsing-made-easy/
[matklad]: https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
[Crockford]: https://www.crockford.com/javascript/tdop/tdop.html
[survey]: https://www.oilshell.org/blog/2017/03/31.html
