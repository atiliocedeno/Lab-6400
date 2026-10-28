import type {Recipe} from '../guide';
import {Camera,request} from './protocol';

export const controls=[
 {key:'ExposureMode',label:'Modo de exposición'}, {key:'IsoSpeedRate',label:'ISO'}, {key:'ShutterSpeed',label:'Velocidad'},
 {key:'FNumber',label:'Apertura'}, {key:'ShootMode',label:'Modo foto/vídeo'},
] as const;
export type Control={key:string;label:string;current:string;values:string[];labels?:Record<string,string>};
export type Plan={wb:unknown[]|null;ev:number|null;manual:string[]};
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export type AdjustmentResult={key:string;state:'confirmed'|'unconfirmed'|'rejected'|'manual'|'not-sent';detail:string};
export class CameraRejectedError extends Error {}
export class VerificationError extends Error {}
export class PartialApplicationError extends Error {
 constructor(message:string,readonly connectionUsable:boolean){super(message);}
}
export class SonySession {
 methods:string[]=[];
 trace:{method:string;params:unknown[];result?:unknown[];error?:unknown}[]=[];
 private id=0;
 private lifetime=new AbortController();
 private writing=false;
 constructor(readonly camera:Camera){}
 close(){this.lifetime.abort();this.methods=[];}
 async call(method:string,params:unknown[]=[]):Promise<unknown[]> {
  if(this.lifetime.signal.aborted)throw new Error('Sesión desconectada.');
  const id=++this.id;
  const text=await request(this.camera.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,params,id,version:'1.0'})},this.lifetime.signal);
  let data;
  try{data=JSON.parse(text);}catch{throw new Error('La cámara devolvió una respuesta que no es JSON.');}
  if(/^(get|set)/.test(method)){
   this.trace.push({method,params,result:data.result,error:data.error});
   this.trace=this.trace.slice(-40);
  }
  if(data.id!==id)throw new Error('Respuesta fuera de secuencia.');
  if(Array.isArray(data.error))throw new CameraRejectedError(`Sony ${data.error[0]}: ${String(data.error[1]??'Operación rechazada')}`);
  if(!Array.isArray(data.result))throw new Error('Respuesta Sony inválida.');
  return data.result;
 }
 async refresh(){
  const result=await this.call('getAvailableApiList');
  if(!Array.isArray(result[0])||!result[0].every(v=>typeof v==='string'))throw new Error('Lista de capacidades inválida.');
  this.methods=[...new Set(result[0] as string[])];
 }
 async connect(){
  await this.refresh();
  if(this.methods.includes('startRecMode')) {
   await this.write('startRecMode');
   // The server may need time before exposing capture and settings methods.
   for(let i=0;i<5;i++){await wait(400);await this.refresh();if(this.methods.includes('actTakePicture'))break;}
  }
 }
 private async write(method:string,params:unknown[]=[]){
  const result=await this.call(method,params);
  if(result[0]!==0)throw new Error('La cámara no confirmó la orden '+method+'.');
 }
 private require(...methods:string[]){if(methods.some(m=>!this.methods.includes(m)))throw new Error('Ese control no está disponible en el estado actual de la cámara.');}
 async readControls():Promise<Control[]> {
  await this.refresh();
  const result:Control[]=[];
  for(const item of controls) {
   if(!['getAvailable'+item.key,'get'+item.key,'set'+item.key].every(m=>this.methods.includes(m)))continue;
   const r=await this.call('getAvailable'+item.key);
   if(typeof r[0]==='string'&&Array.isArray(r[1])&&r[1].every(v=>typeof v==='string'))result.push({...item,current:r[0],values:r[1]});
  }
  if(this.has('ExposureCompensation')){
   const r=await this.call('getAvailableExposureCompensation');
   if(r.length>=4&&r.slice(0,4).every(Number.isInteger)&&[1,2].includes(r[3] as number)){
    const [current,max,min,step]=r as number[];
    if(max>=min&&max-min<=100){const values=Array.from({length:max-min+1},(_,i)=>String(min+i));
     result.push({key:'ExposureCompensation',label:'Compensación EV',current:String(current),values,labels:Object.fromEntries(values.map(v=>[v,`${(Number(v)/(step===1?3:2)).toFixed(1)} EV`]))});}
   }
  }
  if(this.has('WhiteBalance')){
   const r=await this.call('getAvailableWhiteBalance');
   const current=r[0] as {whiteBalanceMode?:string;colorTemperature?:number};
   if(current&&Array.isArray(r[1])){
    const values:string[]=[],labels:Record<string,string>={};
    for(const item of r[1] as {whiteBalanceMode:string;colorTemperatureRange:number[]}[]){
     if(!item||typeof item.whiteBalanceMode!=='string')continue;
     const range=item.colorTemperatureRange;
     if(item.whiteBalanceMode==='Color Temperature'){
      if(!Array.isArray(range)||range.length!==3||!range.every(Number.isInteger)||range[2]<=0||range[0]<range[1]||(range[0]-range[1])/range[2]>200)continue;
      for(let k=range[1];k<=range[0];k+=range[2]){const value=JSON.stringify([item.whiteBalanceMode,true,k]);values.push(value);labels[value]=`${k} K`;}
     } else {const value=JSON.stringify([item.whiteBalanceMode,false,0]);values.push(value);labels[value]=item.whiteBalanceMode==='Auto WB'?'Automático':item.whiteBalanceMode;}
    }
    const value=JSON.stringify([current.whiteBalanceMode,current.whiteBalanceMode==='Color Temperature',current.whiteBalanceMode==='Color Temperature'?current.colorTemperature:0]);
    result.push({key:'WhiteBalance',label:'Balance de blancos',current:value,values,labels});
   }
  }
  return result;
 }
 private has(key:string){return ['set','get','getAvailable'].every(prefix=>this.methods.includes(prefix+key));}
 private async writeAdjustment(key:string,value:string){
  if(key==='WhiteBalance'){
   const params=JSON.parse(value) as unknown[];
   await this.write('setWhiteBalance',params);
   await this.verify('getWhiteBalance',r=>{const wb=r[0] as {whiteBalanceMode?:unknown;colorTemperature?:unknown};return wb?.whiteBalanceMode===params[0]&&(!params[1]||wb.colorTemperature===params[2]);},params);
  } else if(key==='ExposureCompensation'){
   const index=Number(value);await this.write('setExposureCompensation',[index]);
   await this.verify('getExposureCompensation',r=>r[0]===index,index);
  } else {await this.write('set'+key,[value]);await this.verify('get'+key,r=>r[0]===value,value);}
 }
 private async exclusive<T>(action:()=>Promise<T>):Promise<T>{
  if(this.writing)throw new Error('Hay una operación en curso.');
  this.writing=true;try{return await action();}finally{this.writing=false;}
 }
 private async verify(method:string,predicate:(value:unknown[])=>boolean,expected:unknown){
  let value:unknown[]=[];
  for(let i=0;i<5;i++){value=await this.call(method);if(predicate(value))return;if(i<4)await wait(400);}
  throw new VerificationError(`La cámara aceptó la orden, pero no confirmó el valor. Lectura: ${method}; esperado: ${JSON.stringify(expected)}; recibido: ${JSON.stringify(value)}. Comprueba el ajuste antes de continuar.`);
 }
 async setControl(key:string,value:string){return this.exclusive(async()=>{
  if(!controls.some(c=>c.key===key)&&!['WhiteBalance','ExposureCompensation'].includes(key))throw new Error('Control desconocido.');
  const available=await this.readControls();
  if(!available.find(c=>c.key===key)?.values.includes(value))throw new Error('Este valor ya no está disponible. Actualiza los controles.');
  await this.writeAdjustment(key,value);
 });}
 async capture(){return this.exclusive(async()=>{
  await this.refresh();this.require('actTakePicture');
  // Never retry a shutter request: a timeout may still have produced a photo.
  const result=await this.call('actTakePicture');
  if(!Array.isArray(result[0])||!result[0].length||!result[0].every(v=>typeof v==='string'))throw new Error('No se pudo confirmar la captura. Comprueba la cámara antes de repetir.');
 });}
 async plan(recipe:Recipe):Promise<Plan>{
  await this.refresh();
  const manual=['Creative Style / Picture Effect','Contraste, saturación y nitidez','Ajuste fino A/B y G/M','DRO'];
  let wb:unknown[]|null=null,ev:number|null=null;
  if(['setWhiteBalance','getWhiteBalance','getAvailableWhiteBalance'].every(m=>this.methods.includes(m))){
   const r=await this.call('getAvailableWhiteBalance');
   const mode=recipe.wbMode===14?'Color Temperature':'Auto WB';
   const values=Array.isArray(r[1])?r[1]:[];
   const option=values.find((v:unknown)=>!!v&&typeof v==='object'&&(v as {whiteBalanceMode?:unknown}).whiteBalanceMode===mode) as {colorTemperatureRange?:unknown}|undefined;
   if(option){
    if(mode==='Auto WB')wb=[mode,false,0];
    else {const range=option.colorTemperatureRange;
     if(Array.isArray(range)&&range.length===3&&range.every(Number.isInteger)&&range[2]>0&&recipe.kelvin>=range[1]&&recipe.kelvin<=range[0]&&(recipe.kelvin-range[1])%range[2]===0)wb=[mode,true,recipe.kelvin];
    }
   }
  }
  if(!wb)manual.push('Balance de blancos');
  if(['setExposureCompensation','getExposureCompensation','getAvailableExposureCompensation'].every(m=>this.methods.includes(m))){
   const r=await this.call('getAvailableExposureCompensation');
   if(r.length>=4&&r.slice(0,4).every(Number.isInteger)){
    const [,,min,step]=r as number[],max=r[1] as number;
    const index=step===1?recipe.ev:step===2?recipe.ev*2/3:NaN;
    if(Number.isInteger(index)&&index>=min&&index<=max)ev=index;
   }
  }
  if(ev===null)manual.push('Compensación de exposición');
  return {wb,ev,manual};
 }
 async applyComplete(recipe:Recipe):Promise<AdjustmentResult[]>{
  // Fail before any write: the present adapter cannot reproduce the complete look.
  const plan=await this.plan(recipe);
  if(plan.manual.length)throw new Error(`No se envió ningún ajuste. La integración actual no puede aplicar la receta completa: ${plan.manual.join('; ')}.`);
  return this.applyDetailed(recipe);
 }
 async applyDetailed(recipe:Recipe):Promise<AdjustmentResult[]>{return this.exclusive(async()=>{
  const plan=await this.plan(recipe);
  const results:AdjustmentResult[]=[];
  const jobs=[{key:'WhiteBalance',value:plan.wb?JSON.stringify(plan.wb):null},{key:'ExposureCompensation',value:plan.ev!==null?String(plan.ev):null}];
  let stopped=false;
  for(const job of jobs){
   if(job.value===null){results.push({key:job.key,state:'manual',detail:'No disponible para esta receta en el estado actual.'});continue;}
   if(stopped){results.push({key:job.key,state:'not-sent',detail:'No enviado: se interrumpió la comunicación.'});continue;}
   try {
    const control=(await this.readControls()).find(c=>c.key===job.key);
    if(!control?.values.includes(job.value)){results.push({key:job.key,state:'manual',detail:'El modo de la cámara ya no permite este valor.'});continue;}
    await this.writeAdjustment(job.key,job.value);
    results.push({key:job.key,state:'confirmed',detail:control.current===job.value?'La lectura coincide; ya tenía este valor.':'Valor enviado y lectura confirmada.'});
   }catch(e){
    const state=e instanceof VerificationError?'unconfirmed':'rejected';
    results.push({key:job.key,state,detail:e instanceof Error?e.message:String(e)});
    if(!(e instanceof VerificationError)&&!(e instanceof CameraRejectedError))stopped=true;
   }
  }
  return results;
 });}
 async apply(recipe:Recipe):Promise<string[]>{
  const results=await this.applyDetailed(recipe);
  const names:Record<string,string>={WhiteBalance:'Balance de blancos',ExposureCompensation:'Compensación de exposición'};
  const confirmed=results.filter(r=>r.state==='confirmed').map(r=>names[r.key]);
  const failed=results.find(r=>['unconfirmed','rejected','not-sent'].includes(r.state));
  if(failed)throw new PartialApplicationError(`Aplicación interrumpida. Confirmado: ${confirmed.join(', ')||'ningún ajuste'}. ${failed.detail} No se revirtió automáticamente.`,failed.state==='unconfirmed');
  return confirmed;
 }
}
