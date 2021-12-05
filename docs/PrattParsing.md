#   Pratt Parsing Deconstructed

A very neat and powerful parser algorith was published back in 1973 by Vaughn Pratt[^1], but for many years this method has been largley ingnored. 

Fortunatley there has been a revival of interest more recently, and there are nice blog posts by [matklad] and [Nystrom] that explain how it works. Another variant that is closer to the original Pratt paper has been popularised by Douglas [Crockford], and there is also a [survey] of other posts.

I must admit that I found Pratt's paper hard to follow, but the key idea of using numeric binding powers for each operator was cystal clear. For my purposes I ended up implementing the Pratt algorithm in a slightly different way, and that may be easier to understand and explain. So here it is.

##  The Problem

The problem is how to parse an operator expression. I'll stick to simple arithemtic expressions like `1+2*3`. The problem boils down to how to put the brackets in correctly. Should it be `((1+(*3))` or should it be `(1+(2*3))`? For arithmetic the correct answer is `(1+(2*3))`.

An even simpler problem is how to add up a list of numbers, say `1+2+3+4`, in this case you can add from the left: `(((1+2)+3)+4)` or you can add from the right: `(1+(2+(3+4)))` it makes no difference, they bopth produce the same answer. But not so with with subtraction, `(((1-2)-3)-4)` is not the same as `(1-(2-(3-4)))`.

For most aithmetic operators starting from the left and going step by step to the right gives the correct answer. These expressions are left associative. But exponential power is an exception: `((x^2)^3)` = `x^6`, but  `(x^(2^3))` = `x^8`. For this operator right association is the correct convention.

##  Start At The Beginning

The key idea behind the Pratt algorithm is to assign a numeric weight to the binding power of each operator. In arithmetic the `*` operator is given a higher binding power than the `+` so that `1+2*3` will bind the `(2*3)` before the addition as `(1+(2*3))`.

The expression `1-2-3-4` associates from left to right as `(((1-2)-3)-4)`. All the operator are the same, so how do we know that they should be added from left to right and not from right to left? The tick is to give the operator two binding powers, one to the left and the other to the right.

Let's assume that the `-` operator has a binding power of say 2 to the left and 3 to the right, so in `1-2-3` the first `-` will have a binding power of 3 to its right and the second `-` will have a binding power of 2 to its left.  The first `-` operator has a higher binding power than the next one, so it binds its operands first: `(1-2)`, the expression will associated from the left.

The `+` operator can be given the same binding power as the `-` because both these operators associate to the left, and they can be mixed and matched in an expression: `1+2-3+4 => (((1+2)-3)+4)`.

The `*` and `/` operators also associate left to right, but they need a higher binding power than the `+` and `-`. They bibd their operands tighter than `+` or `-`.

The exponential `^` operator binds its operands even tighter and associates to the right, so we can give it a binding power of say 6 to the right and 7 to the left. In the expression `x^2^3` the first `^` operator has a binding power of 6 to its right so it binds less tightly that the second `^` operator which has a binding power of 7 to its left, and we get a right association: `(x^(2^3))`.

Here is a table of possible binding powers that will work:

    + => [2, 3],  left associative
    - => [2, 3], 
    * => [4, 5],
    / => [4, 5], 
    ^ => [7, 6],  right associative

If more operators with lower binding powers are required then the numbers can be scaled up, it is only the relative ordering of the binding power numbers that matters. 


##  Tree Building

If the input is: `1+2-3+4` then we can start building the parse tree like this:

    ()                   <=  1 + 2 - 3 + 4  
    (+ 1 2)              <=  - 3 + 4
    (- (+ 1 2) 3)        <=  + 4
    (+ (- (+ 1 2) 3) 4)

The first step takes the first operator and its operands `1+2` and translate them into a functional s-expression tree node `(+ 1 2)`. The second step adds `-3` into the tree. The two operators `+` and `-` have the same precedence and associate to the left as `(- (+ 1 2) 3)`. The last step adds `+4` into the tree in the same way.

If the input is: `1+2*3+4` then the parse tree will be built like this:

    ()                   <=  1 + 2 * 3 + 4
    (+ 1 2)              <=  * 3 + 4
    (+ 1 (* 2 3))        <=  + 4
    (+ (+ 1 (* 2 3)) 4)

The second step adds `*3` into the tree, and the `*` has higher precedence than the `+`, so it binds to the right.

Operators with the same precedence and right association will build a tree like this:

    ()                  <= x ^2 ^ 3 ^ 4
    (^ x 2)             <= ^ 3 ^ 4
    (^ x (^ 2 3))       <= ^ 4
    (^ x (^ 2 (^ 3 4)))

The pattern for building a left association is:

    Tree1 = (op1 Left Right)       <= op2 X
    Tree2 = (op2 Tree1 X) 

The pattern for right association is:

    Tree1 = (op1 Left Right) <= op2 X
    Tree2 = (op1 Left (Right <= op2 X))
    Tree3 = (op1 Left (op2 Right X)) 

If `op2` has higher binding power than `op1` and it may or may not have higher binding power than the operator at the root of the `Right` tree. If the `Right` tree is simply a terminal operand then that will have zero binding power and will associate left of `op2` (since `op2` can not have a lower binding power).

So building a tree on the right needs to iterate or recurse down through the right hand tree to find the first sub-tree or operand with left association. Building a tree with left association is a simple step. 


##  The Code

A JavaScript program to add another operator-operand into a tree:

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

The `bind_left` function compares the right binding power of the operator at the root of the tree with the `op` that is being added into the tree. It has to cope with a tree that is a terminal token operand, and it has to select the appropriate left or right right binding powers of the two operators.

The amazing thing is that the core of the algorithm boils down to the three line `build_tree` function, everything else is straighforward book keeping.

We need to drive the tree builder from a list of tokens. For simplicity we will assume that the end of the list of tokens is the end of the inix expression:
 
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

Lo and behold! we have a functional infix operator expression parser.

I find this tree building method easy to understand, but it is not quite as elegant as this next version. 

##  Pratt Algorithm

Instead of building up the result parse tree by adding operator-operand pairs, a more elegant formaulation uses recursion inside a loop. This builds up the result tree on the call stack.

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
                if (right_bind(op) < lbp) break;
                next += 1; // consume op
                result = [op, result, pratt(left_bind(op))];
            }
            return result;
        }
    }

    function right_bind(op) {
        return op? (BIND[op]||[0,0])[1] : -1;
    }

    function left_bind(op) {
        return (BIND[op]||[0,0])[0];
    }

    let tree = infix_pratt("1+2*3+4".split(''));

    console.log(tree); // [ '+', [ '+', '1', [ '*', '2', '3' ] ], '4' ]

Pratt claimed the technique is simple to understand, trivial to implement, easy to use, extremely efficient, and very flexible. It is dynamic, providing support for truly extensible languages. In my opinion he was right, it lives up to all these claims, except perhaps for being easy to understand, until you do!

[^1]: Pratt, V.R., Top Down Operator Precedence. Proceedings of the ACM Symposium on Principles of Programming Languages. 1973. pp41-51

[Nystrom]: https://journal.stuffwithstuff.com/2011/03/19/pratt-parsers-expression-parsing-made-easy/
[matklad]: https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
[Crockford]: https://www.crockford.com/javascript/tdop/tdop.html
[survey]: https://www.oilshell.org/blog/2017/03/31.html
