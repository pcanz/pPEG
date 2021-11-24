
const peg = require("../pPEG.js");

console.log("json grammar...");

const json = peg.compile(`
    json   = " " value " "
    value  =  Str / Arr / Obj / num / lit
    Obj    = "{ " (memb (" , " memb)*)? " }"
    memb   = Str " : " value
    Arr    = "[ " (value (" , " value)*)? " ]"
    Str    = '"' chars* '"'
    chars  = ~[\u0000-\u001F"\\]+ / '\\' esc
    esc    = ["\\/bfnrt] / 'u' [0-9a-fA-F]*4
    num    = _int _frac? _exp?
    _int   = '-'? ([1-9] [0-9]* / '0')
    _frac  = '.' [0-9]+
    _exp   = [eE] [+-]? [0-9]+
    lit    = "true" / "false" / "null"
`);

// Obj Arr Str need to be caps (they can be empty)

const p = json.parse(`
  { "answer": 42,
    "mixed": [1, 2.3, "a\\tstring", true, [4, 5]],
    "empty": {},
  }
`, 'Arr');

if (p[0] === '$error') console.log(p[1]);
else console.log(JSON.stringify(p));

/*
json grammar...
["Obj",[["memb",[["Str",[["chars","answer"]]],["num","42"]]],["memb",[["Str",[["chars","mixed"]]],["Arr",[["num","1"],["num","2.3"],["Str",[["chars","a"],["esc","t"],["chars","string"]]],["lit","true"],["Arr",[["num","4"],["num","5"]]]]]]],["memb",[["Str",[["chars","empty"]]],["Obj","{}"]]]]]
*/
