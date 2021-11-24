const peg = require("../pPEG.js");
const fs = require('fs');
const cp = require('child_process');
const readline = require('readline-sync');

/*
.../tests/            // __dirname
          test.js     // run test cases
          test1.txt   // test cases
          test2.txt   // test cases
          ...
          test-records/
                      test1.txt-record  // previous resuts 
                      ...
*/

let files = fs.readdirSync(__dirname); // .../tests/
let txts = files.filter((path) => path.slice(-4) === ".txt");

for (const file of txts) {
    const file_path = __dirname+'/'+file;
    const result_path = __dirname+'/test-records/'+file+'-result';
    const record_path = __dirname+'/test-records/'+file+'-record';
    let tests = fs.readFileSync(file_path, 'utf8');
    let results = run_tests(file, tests);
    let record = read_file(record_path);
    if (!record) { // no file.txt-record
        console.log(results);
        if (!new_record(file, record_path, results)) break;
    } else if (results === record) {
        console.log('OK '+file);
    } else { // errors...
        console.log("Error: "+file+'-result !== '+file+'-record');
        write_file(result_path, results);
        const obj = cp.spawnSync("diff", ["-y", result_path, record_path]);
        console.log(obj.output.toString());
        if (!new_record(file, record_path, results))
            break; // skip rest of test files...
    } 
}

function new_record(file, record_path, results) {
    if (!readline.keyInYN("OK to record results?"))
        return false;
    console.log("New: "+file+'-record');
    write_file(record_path, results);
    return true;
}

function read_file(file) {
    try {
        const record = fs.readFileSync(file, 'utf8');
        return record;
    } catch (err) {
        // console.log(err);
    }
    return undefined;
}

function write_file(file, data) {
    try {
        const record = fs.writeFileSync(file, data, 'utf8');
    } catch (err) {
        console.log(err);
    }
}

function run_tests(name, tests) {
    let results = [];
    const test_cases = tests.split("\n---\n");
    for (let i=0; i<test_cases.length; i+=1) {
        const test_case = test_cases[i].split("\n--\n");
        results.push("--- "+name+" case:"+(i+1));
        results.push(test_case[0]);
        const p = peg.compile(test_case[0]);
        for (let j=1; j<test_case.length; j+=1) {
            if (!test_case[j]) continue;
            results.push('--  '+name+" case:"+(i+1)+" input:"+j);
            results.push(test_case[j]);
            results.push("-");
            try {
                const tree = p.parse(test_case[j]);
                if (tree[0] === "$error") {
                    results.push("Error: "+tree[1]);
                } else {
                    results.push(JSON.stringify(tree));
                }    
            } catch (error) {
                results.push(error);
            }
        }
    }
    return results.join("\n");
}
