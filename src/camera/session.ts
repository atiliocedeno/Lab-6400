import type {Recipe} from '../guide';
import {Camera,request} from './protocol';

export const controls=[
 {key:'IsoSpeedRate',label:'ISO'}, {key:'ShutterSpeed',label:'Velocidad'},
 {key:'FNumber',label:'Apertura'}, {key:'ShootMode',label:'Modo foto/vídeo'},
] as const;
export type Control={key:string;label:string;current:string;values:string[]};
export type Plan={wb:unknown[]|null;ev:number|null;manual:string[]};
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export class SonySession {
 methods:string[]=[];
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
  if(data.id!==id)throw new Error('Respuesta fuera de secuencia.');
  if(Array.isArray(data.error))throw new Error(`Sony ${data.error[0]}: ${String(data.error[1]??'Operación rechazada')}`);
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
  return result;
 }
 private async exclusive<T>(action:()=>Promise<T>):Promise<T>{
  if(this.writing)throw new Error('Hay una operación en curso.');
  this.writing=true;try{return await action();}finally{this.writing=false;}
 }
 private async verify(method:string,predicate:(value:unknown[])=>boolean){
  for(let i=0;i<5;i++){const value=await this.call(method);if(predicate(value))return;await wait(400);}
  throw new Error('La cámara aceptó la orden, pero no confirmó el valor. Comprueba el ajuste antes de continuar.');
 }
 async setControl(key:string,value:string){return this.exclusive(async()=>{
  if(!controls.some(c=>c.key===key))throw new Error('Control desconocido.');
  await this.refresh();this.require('getAvailable'+key,'get'+key,'set'+key);
  const r=await this.call('getAvailable'+key);
  if(!Array.isArray(r[1])||!r[1].includes(value))throw new Error('Este valor ya no está disponible. Actualiza los controles.');
  await this.write('set'+key,[value]);await this.verify('get'+key,r=>r[0]===value);
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
 async apply(recipe:Recipe):Promise<string[]>{return this.exclusive(async()=>{
  const plan=await this.plan(recipe),confirmed:string[]=[];
  try {
   if(plan.wb){const params=plan.wb;await this.write('setWhiteBalance',params);
    await this.verify('getWhiteBalance',r=>{const wb=r[0] as {whiteBalanceMode?:unknown;colorTemperature?:unknown}|undefined;return wb?.whiteBalanceMode===params[0]&&(!params[1]||wb?.colorTemperature===params[2]);});confirmed.push('Balance de blancos');}
   if(plan.ev!==null){await this.write('setExposureCompensation',[plan.ev]);await this.verify('getExposureCompensation',r=>r[0]===plan.ev);confirmed.push('Compensación de exposición');}
   return confirmed;
  }catch(e){throw new Error(`Aplicación interrumpida. Confirmado: ${confirmed.join(', ')||'ningún ajuste'}. ${e instanceof Error?e.message:String(e)} No se revirtió automáticamente.`);}
 });}
}
