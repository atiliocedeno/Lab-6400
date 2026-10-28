const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(native,platform='android'){
 const exports={};
 const code=ts.transpileModule(fs.readFileSync('src/camera/androidNetwork.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','exports',code)(name=>name==='react-native'?{Platform:{OS:platform}}:{requireOptionalNativeModule:()=>native},exports);
 return exports;
}
(async()=>{
 const calls=[];
 const native={discover:async id=>{calls.push(['discover',id]);return {replies:[],diagnostics:['wifi']};},request:async(...args)=>{calls.push(args);return 'OK';},cancel:id=>calls.push(['cancel',id]),release:()=>calls.push(['release'])};
 const api=load(native);
 assert.deepEqual(await api.discoverAndroid(new AbortController().signal),{replies:[],diagnostics:['wifi']});
 assert.equal(await api.requestAndroid('http://192.168.122.1/x',{method:'POST',body:'{}'},new AbortController().signal,3500),'OK');
 assert.deepEqual(calls[1].slice(1),['http://192.168.122.1/x','POST','{}',3500]);
 api.releaseCameraNetwork();assert.deepEqual(calls.at(-1),['release']);
 const aborted=new AbortController();aborted.abort();
 const count=calls.length;
 await assert.rejects(api.discoverAndroid(aborted.signal),/cancelada/);assert.equal(calls.length,count);
 native.discover=()=>new Promise(()=>{});
 const active=new AbortController();const pending=api.discoverAndroid(active.signal);active.abort();
 await assert.rejects(pending,/cancelada/);assert.equal(calls.at(-1)[0],'cancel');
 await assert.rejects(load(null).discoverAndroid(new AbortController().signal),/APK actualizada/);
 assert.equal(load(null,'ios').isAndroid,false);
 console.log('PASS: Android Wi-Fi transport delegation, cancellation, release and missing native module.');
})().catch(error=>{console.error(error);process.exitCode=1;});
