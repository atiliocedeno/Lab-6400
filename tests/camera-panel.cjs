// Exercise component state transitions with hooks/native UI mocked; not a visual/device test.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let slots=[],cursor=0,effects=[],tree,shared,background,scenario='ok';
const React={
 createElement:(type,props,...children)=>({type,props:{...props,children}}),
 useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
 useRef:initial=>{const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
 useEffect:fn=>{const i=cursor++;if(!(i in slots)){slots[i]=true;effects.push(fn);}},
};
class CameraRejectedError extends Error{}
class VerificationError extends Error{}
class PartialApplicationError extends Error{}
const report={model:'SonyImagingDevice',complete:true,reads:[{method:'getMethodTypes',result:[]}],availableMethods:[]};
class SonySession {
 methods=[];trace=[];capabilityReport=null;
 async connect(){} close(){}
 async readControls(){if(scenario==='rejected')throw new CameraRejectedError('Not available');return [];}
 async auditCapabilities(){this.capabilityReport={...report,complete:scenario!=='offline'};if(scenario==='offline')throw Error('Network lost');return this.capabilityReport;}
}
const camera={model:'SonyImagingDevice',name:'Sony',endpoint:'http://192.168.122.1/camera'};
const mocks={
 react:React,
 'react-native':{Platform:{OS:'android'},View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{create:x=>x},Share:{share:async data=>{shared=JSON.parse(data.message);}},AppState:{addEventListener:(name,fn)=>{background=fn;return {remove(){}};}}},
 './exportDiagnostic':{exportDiagnostic:async()=>true},
 './ValuePicker':()=>null,'./recipeFields':{recipeFields:()=>[],controlLabel:()=>''},
 './androidNetwork':{releaseCameraNetwork(){}},
 './discovery':{discoveryAvailable:()=>true,discover:async()=>({cameras:[camera],diagnostics:[]})},
 './protocol':{},'./session':{SonySession,CameraRejectedError,VerificationError,PartialApplicationError},'../guide':{recipes:[]},
};
const mod={exports:{}};
const code=ts.transpileModule(fs.readFileSync('src/camera/CameraPanel.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
new Function('require','module','exports',code)(name=>{assert.ok(name in mocks,name);return mocks[name];},mod,mod.exports);
function render(){cursor=0;tree=mod.exports.default({});for(const effect of effects.splice(0))effect();}
function all(node){if(!node||typeof node!=='object')return [];return [node,...(node.props?.children??[]).flat(Infinity).flatMap(all)];}
async function press(label){render();const button=all(tree).find(n=>n.props.label===label);assert.ok(button,'Missing button '+label);assert.equal(button.props.busy,false);button.props.onPress();for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));render();}
async function connect(){await press('Buscar cámaras');await press('Conectar · Sony');}
(async()=>{
 render();await connect();await press('Comprobar capacidades (solo lectura)');await press('Compartir diagnóstico');assert.equal(shared.capabilityReport.complete,true);
 await press('Desconectar');await press('Compartir diagnóstico');assert.equal(shared.camera,null);assert.equal(shared.capabilityReport.complete,true);
 console.log('PASS UI: completed audit remains shareable after disconnect');
 scenario='rejected';await connect();assert.ok(all(tree).find(n=>n.props.label==='Comprobar capacidades (solo lectura)'));await press('Comprobar capacidades (solo lectura)');await press('Compartir diagnóstico');assert.equal(shared.capabilityReport.complete,true);
 console.log('PASS UI: rejected optional controls do not block audit');
 scenario='offline';await press('Comprobar capacidades (solo lectura)');await press('Compartir diagnóstico');assert.equal(shared.camera,null);assert.equal(shared.capabilityReport.complete,false);assert.match(shared.error,/Network lost/);
 console.log('PASS UI: partial report remains shareable after network failure');
 scenario='ok';await connect();await press('Comprobar capacidades (solo lectura)');background('background');render();await press('Compartir diagnóstico');assert.equal(shared.camera,null);assert.equal(shared.capabilityReport.complete,true);
 console.log('PASS UI: background disconnect retains diagnostic');
 await press('Buscar cámaras');await press('Compartir diagnóstico');assert.equal(shared.capabilityReport,null);
 console.log('PASS UI: new search clears stale diagnostic');
})().catch(e=>{console.error(e);process.exitCode=1;});
