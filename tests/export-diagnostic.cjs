const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let granted=true,stored='',corrupt=false,failWrite=false,writes=0,onPicker=()=>{};
const api={EncodingType:{UTF8:'utf8'},StorageAccessFramework:{requestDirectoryPermissionsAsync:async()=>{onPicker();return {granted,directoryUri:'content://folder'};},createFileAsync:async(dir,name,mime)=>{assert.equal(mime,'application/json');assert.ok(name.endsWith('.json'));return 'content://folder/report';}},writeAsStringAsync:async(uri,text)=>{if(failWrite)throw Error('Disk full');writes++;stored=text;},readAsStringAsync:async()=>corrupt?stored.slice(1):stored};
const mod={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/camera/exportDiagnostic.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(()=>api,mod,mod.exports);
(async()=>{
 const input={capabilityReport:{reads:Array.from({length:1000},(_,i)=>({method:'getMethodTypes',result:['ñ α '+i]}))},trace:['first','last']};
 const original=JSON.stringify(input);onPicker=()=>{input.trace=[];};
 assert.equal(await mod.exports.exportDiagnostic(input),true);assert.equal(JSON.stringify(JSON.parse(stored)),original);
 granted=false;assert.equal(await mod.exports.exportDiagnostic(input),false);assert.equal(writes,1);
 granted=true;corrupt=true;await assert.rejects(mod.exports.exportDiagnostic(input),/no coincide/);
 corrupt=false;failWrite=true;await assert.rejects(mod.exports.exportDiagnostic(input),/Disk full/);
 console.log('PASS: large Unicode report round-trip, pre-picker snapshot, cancelled picker, truncated file detection and disk error.');
})().catch(e=>{console.error(e);process.exitCode=1;});
