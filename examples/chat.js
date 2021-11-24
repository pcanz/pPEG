const peg = require("../pPEG.js");

console.log("chat markup example...");

/*
    Example from the ANTLR-4 book...

    To compare pPEG grammar with ANTLR
    pPEG could be simplified
*/

const test = peg.compile(`
    chat    = line+ eof
    line    = name command message nl
    message = (emoji / link / color / Mention / word / space)+
    name    = word space
    command = ("says" / "shouts") ": "
    emoji   = ':' '-'? (')'/'(')
    link    = '[' text ']' '(' text ')'
    color   = '/' word '/' message '/'
    Mention = '@' word

    space   = [ \t]
    word    = [A-Za-z_]+
    text    = ~(')' / '/')+
    nl      = '\n' '\r'? / '\r'
    eof     = !(~[])
`);

const p = test.parse("John says: Hello @michael this will work\n");

console.log(JSON.stringify(p));

/*
chat markup example...
["chat",[["line",[["name",[["word","John"],["space"," "]]],["command","says: "],["message",[["word","Hello"],["space"," "],["Mention",[["word","michael"]]],["space"," "],["word","this"],["space"," "],["word","will"],["space"," "],["word","work"]]],["nl","\n"]]],["eof",""]]]
*/
