
const peg = require("../pPEG.js");

console.log("date example ....")

const dg = peg.compile(`
    Date  = year '-' month '-' day
    year  = d d d d
    month = d d 
    day   = d d
    d     = [0-9]
`); // '0'/'1'/'2'/'3'/'4'/'5'/'6'/'7'/'8'/'9'

const dt = dg.parse("2021-4-05  xxx");

if (dt[0] === '$error') console.log(dt[1]);
else console.log(JSON.stringify(dt));

