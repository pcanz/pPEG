
const peg = require("../pPEG.js");

console.log("CSV example....")

const csv = peg.compile(`
    File   = (record / _eol)*
    record = field (','  field)*
    field  = quote+ / text
    quote  = '"' ~'"'* '"'
    text   = ~[,\n\r]+
    _eol   = [\n\r]+
`);

const test = `
a1,b1,c1
a2,"b,2",c2
a3,b3,c3
`;

const p = csv.parse(test);

if (p[0] === '$error') console.log(p[1])
else console.log(JSON.stringify(p));

/*
CSV example....
["File",[
    ["record",[["text","a1"],["text","b1"],["text","c1"]]],
    ["record",[["text","a2"],["quote","\"b,2\""],["text","c2"]]],
    ["record",[["text","a3"],["text","b3"],["text","c3"]]]]]
*/