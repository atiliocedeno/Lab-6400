const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
let count=0;
function loadSession(android=false){
 const cache=new Map();
 const wire=[];let handler;
 const native={
  request:async(id,url,method,body)=>{const req=JSON.parse(body);wire.push(req);return handler(req);},
  cancel:()=>{},release:()=>{},
 };
 function load(file){
  file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
  const mod={exports:{}};cache.set(file,mod);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',code)(name=>{
   if(name==='react-native')return {Platform:{OS:android?'android':'ios'}};
   if(name==='expo')return {requireOptionalNativeModule:()=>native};
   return name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);
  },mod,mod.exports);return mod.exports;
 }
 const {SonySession}=load('src/camera/session.ts');
 const {auditReadMethods}=load('src/camera/capabilities.ts');
 const camera={model:'SonyImagingDevice',name:'Sony',endpoint:'http://192.168.122.1:64321/sony/camera',descriptionURL:'http://192.168.122.1:64321/dd.xml'};
 const s=new SonySession(camera);
 global.fetch=async(url,init)=>{const req=JSON.parse(init.body);wire.push(req);return {ok:true,text:async()=>handler(req)};};
 const response=(req,result)=>JSON.stringify({id:req.id,[req.method==='getMethodTypes'?'results':'result']:result});
 function good(req){
  if(req.method==='getAvailableApiList')return response(req,[auditReadMethods]);
  if(req.method==='getApplicationInfo')return response(req,['Smart Remote Control','2.0.0']);
  if(req.method==='getMethodTypes')return response(req,[['setWhiteBalance',['string','bool','int'],['int'],'1.0'],['getEvent',['bool'],['string'],'1.3']]);
  return response(req,[{sample:true}]);
 }
 handler=good;
 return {s,wire,auditReadMethods,good,response,setHandler:f=>handler=f};
}
async function test(name,fn){await fn();count++;console.log('PASS '+name);}
const originalFetch=global.fetch;
(async()=>{
 for(const android of [false,true])await test('full read-only audit over '+(android?'Android native wrapper':'fetch'),async()=>{
  const h=loadSession(android);const report=await h.s.auditCapabilities();
  assert.equal(report.complete,true);assert.equal(report.reads.length,3+h.auditReadMethods.length);
  assert.deepEqual(h.wire.map(r=>r.method),['getAvailableApiList','getApplicationInfo','getMethodTypes',...h.auditReadMethods]);
  assert.ok(h.wire.every(r=>r.method.startsWith('get')));
  assert.equal(new Set(h.wire.map(r=>r.id)).size,h.wire.length);
  assert.deepEqual(JSON.parse(JSON.stringify(report)),report);
  assert.equal(report.model,'SonyImagingDevice');
 });
 await test('untrusted names, duplicates and absent getters never execute',async()=>{
  const h=loadSession();h.setHandler(req=>req.method==='getAvailableApiList'?h.response(req,[['setWhiteBalance','actTakePicture','getDeleteAll','getWhiteBalance','getWhiteBalance']]):h.good(req));
  const r=await h.s.auditCapabilities();assert.equal(r.availableMethods.length,4);assert.equal(h.wire.length,4);assert.equal(h.wire.at(-1).method,'getWhiteBalance');
 });
 await test('empty capabilities still introspect without setters',async()=>{
  const h=loadSession();h.setHandler(req=>req.method==='getAvailableApiList'?h.response(req,[[]]):h.good(req));await h.s.auditCapabilities();assert.equal(h.wire.length,3);
 });
 for(const method of ['getApplicationInfo','getMethodTypes','getWhiteBalance'])await test('Sony rejection is retained and continues: '+method,async()=>{
  const h=loadSession();h.setHandler(req=>req.method===method?JSON.stringify({id:req.id,error:[12,'Not available now']}):h.good(req));const r=await h.s.auditCapabilities();assert.equal(r.complete,true);assert.match(r.reads.find(x=>x.method===method).error,/Sony 12/);assert.equal(h.wire.length,17);
 });
 for(const method of ['getAvailableApiList','getApplicationInfo','getMethodTypes','getWhiteBalance','getSupportedColorSetting'])await test('transport failure stops with partial report: '+method,async()=>{
  const h=loadSession();h.setHandler(req=>{if(req.method===method)throw Error('Network lost');return h.good(req);});await assert.rejects(h.s.auditCapabilities(),/Network lost/);const r=h.s.capabilityReport;assert.equal(r.complete,false);assert.ok(r.finishedAt);assert.match(r.error,/Network lost/);assert.equal(h.wire.at(-1).method,method);assert.equal(r.reads.at(-1).error,'Network lost');
 });
 for(const payload of [null,[],{},'bad',4])await test('invalid JSON RPC envelope '+JSON.stringify(payload),async()=>{
  const h=loadSession();h.setHandler(()=>JSON.stringify(payload));await assert.rejects(h.s.auditCapabilities());assert.equal(h.s.capabilityReport.complete,false);assert.equal(h.wire.length,1);
 });
 await test('malformed JSON',async()=>{const h=loadSession();h.setHandler(()=>'{');await assert.rejects(h.s.auditCapabilities(),/JSON/);});
 await test('wrong response id',async()=>{const h=loadSession();h.setHandler(()=>JSON.stringify({id:999,result:[[]]}));await assert.rejects(h.s.auditCapabilities(),/secuencia/);});
 for(const value of [null,{},[12],['getWhiteBalance',42]])await test('invalid available list '+JSON.stringify(value),async()=>{
  const h=loadSession();h.setHandler(req=>h.response(req,[value]));await assert.rejects(h.s.auditCapabilities(),/capacidades/);assert.match(h.s.capabilityReport.error,/capacidades/);assert.equal(h.wire.length,1);
 });
 for(const value of [[['setWhiteBalance']],[[1,[],[],'1.0']],[['x',null,[],'1.0']],[['x',[],[5],'1.0']]])await test('invalid method schema retained '+JSON.stringify(value),async()=>{
  const h=loadSession();h.setHandler(req=>req.method==='getMethodTypes'?h.response(req,value):h.good(req));await assert.rejects(h.s.auditCapabilities(),/Tipos/);assert.deepEqual(h.s.capabilityReport.reads[2].result,value);assert.equal(h.wire.length,3);
 });
 await test('empty method schema accepted without capability claim',async()=>{
  const h=loadSession();h.setHandler(req=>req.method==='getMethodTypes'?h.response(req,[]):h.good(req));assert.equal((await h.s.auditCapabilities()).complete,true);
 });
 await test('standard result cannot masquerade as introspection results',async()=>{
  const h=loadSession();h.setHandler(req=>req.method==='getMethodTypes'?JSON.stringify({id:req.id,result:[]}):h.good(req));await assert.rejects(h.s.auditCapabilities(),/inválida/);
 });
 await test('oversized fetch response rejected',async()=>{const h=loadSession();h.setHandler(()=>'x'.repeat(262145));await assert.rejects(h.s.auditCapabilities(),/grande/);});
 await test('mutex blocks writes and repeated audits during audit, then releases',async()=>{
  const h=loadSession();let resume;h.setHandler(req=>new Promise(resolve=>{resume=()=>resolve(h.good(req));}));const pending=h.s.auditCapabilities();
  await assert.rejects(h.s.capture(),/curso/);await assert.rejects(h.s.setControl('IsoSpeedRate','100'),/curso/);await assert.rejects(h.s.auditCapabilities(),/curso/);assert.equal(h.wire.length,1);
  h.setHandler(h.good);resume();await pending;assert.equal((await h.s.auditCapabilities()).complete,true);
 });
 await test('close cancels Android pending operation and prevents later reads',async()=>{
  const h=loadSession(true);h.setHandler(()=>new Promise(()=>{}));const pending=h.s.auditCapabilities();h.s.close();await assert.rejects(pending,/cancelada/);assert.equal(h.wire.length,1);assert.equal(h.s.capabilityReport.complete,false);assert.ok(h.s.capabilityReport.finishedAt);
 });
 await test('retry after failure creates independent report and releases mutex',async()=>{
  const h=loadSession();h.setHandler(()=>{throw Error('Offline');});await assert.rejects(h.s.auditCapabilities());const first=h.s.capabilityReport;h.setHandler(h.good);const second=await h.s.auditCapabilities();assert.notEqual(first,second);assert.equal(first.complete,false);assert.equal(second.complete,true);assert.equal(second.error,undefined);
 });
 console.log(`${count} capability dry-run cases passed. No physical camera or Android runtime exercised.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{global.fetch=originalFetch;});
