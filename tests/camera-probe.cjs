const {Buffer}=require('node:buffer');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
(async()=>{
 const code=ts.transpileModule(fs.readFileSync('src/camera/probe.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const {cameraEndpoint,parseMethods,probeCamera}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 assert.equal(cameraEndpoint('http://192.168.122.1:8080/sony/camera'),'http://192.168.122.1:8080/sony/camera');
 for(const u of ['https://example.com/sony/camera','http://8.8.8.8/sony/camera','http://user:password@192.168.1.1/sony/camera','http://192.168.1.1/other'])assert.throws(()=>cameraEndpoint(u));
 assert.deepEqual(parseMethods({result:[['getEvent','getAvailableApiList','getEvent']]}),['getAvailableApiList','getEvent']);
 assert.deepEqual(parseMethods({result:[[]]}),[]);
 for(const r of [null,{}, {result:[['ok',123]]},{error:[12,'unsupported']}])assert.throws(()=>parseMethods(r));
 const original=global.fetch;
 try{
 global.fetch=async (u,init)=>{assert.equal(JSON.parse(init.body).method,'getAvailableApiList');assert.deepEqual(JSON.parse(init.body).params,[]);return {ok:true,json:async()=>({result:[['getEvent']]})};};
 const r=await probeCamera('http://192.168.122.1:8080/sony/camera');assert.equal(r.settingsWritten,false);assert.equal(r.modelVerified,false);
 global.fetch=async()=>({ok:false,status:404});await assert.rejects(probeCamera('http://192.168.122.1:8080/sony/camera'),/404/);
 global.fetch=async()=>({ok:true,json:async()=>{throw new SyntaxError('Invalid JSON');}});await assert.rejects(probeCamera('http://192.168.122.1:8080/sony/camera'),/Invalid JSON/);
 }finally{global.fetch=original;}
 console.log('Camera probe: URL validation, response parsing, read-only request, HTTP and JSON failures passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
