import {isAndroid,requestAndroid} from './androidNetwork';
import {XMLParser, XMLValidator} from 'fast-xml-parser';

export type Camera = {model:string; name:string; endpoint:string; descriptionURL:string};
export function localURL(value:string, host?:string):URL {
 const u=new URL(value);
 const n=u.hostname.split('.').map(Number);
 const privateIP=n.length===4&&n.every(v=>Number.isInteger(v)&&v>=0&&v<=255)&&
  (n[0]===10||(n[0]===192&&n[1]===168)||(n[0]===172&&n[1]>=16&&n[1]<=31));
 if(u.protocol!=='http:'||!privateIP||u.username||u.password||u.hash||u.search||(host&&u.hostname!==host))
  throw new Error('El servicio anunciado no es una dirección HTTP local válida.');
 return u;
}
export function locationFromSSDP(message:string, sender:string):string|null {
 if(message.length>16384||!/^HTTP\/1\.[01] 200\b/i.test(message))return null;
 const location=message.match(/^location:\s*(\S+)\s*$/im)?.[1];
 if(!location)return null;
 try{return localURL(location,sender).href;}catch{return null;}
}
export function parseDescription(xml:string, descriptionURL:string):Camera {
 const source=localURL(descriptionURL);
 if(xml.length>262144||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)
  throw new Error('Descripción de cámara inválida.');
 const parsed=new XMLParser({removeNSPrefix:true,parseTagValue:false,processEntities:false}).parse(xml);
 const device=parsed?.root?.device;
 if(!device||typeof device.modelName!=='string'||!/^Sony(?: Corporation)?$/i.test(device.manufacturer?.trim()??''))
  throw new Error('El dispositivo no se identifica como cámara Sony.');
 // Some Sony firmware advertises a generic model; capabilities still require validation.
 if(!/^(ILCE-6400A?|SonyImagingDevice)$/i.test(device.modelName.trim()))
  throw new Error(`Modelo ${device.modelName}: esta versión está destinada a la A6400.`);
 const services=device.X_ScalarWebAPI_DeviceInfo?.X_ScalarWebAPI_ServiceList?.X_ScalarWebAPI_Service;
 const list=Array.isArray(services)?services:services?[services]:[];
 const camera=list.find(s=>s.X_ScalarWebAPI_ServiceType==='camera');
 if(!camera||typeof camera.X_ScalarWebAPI_ActionList_URL!=='string')
  throw new Error('Dispositivo Sony detectado, pero no anuncia un servicio ScalarWebAPI de control.');
 const base=localURL(camera.X_ScalarWebAPI_ActionList_URL,source.hostname);
 base.pathname=base.pathname.replace(/\/$/,'')+'/camera';
 return {model:device.modelName.trim(),name:typeof device.friendlyName==='string'?device.friendlyName:device.modelName,endpoint:base.href,descriptionURL:source.href};
}
export async function request(url:string, init:RequestInit={}, parent?:AbortSignal, timeout=8000) {
 localURL(url);
 const c=new AbortController();
 const cancel=()=>c.abort();
 parent?.addEventListener('abort',cancel);
 if(parent?.aborted)c.abort();
 const timer=setTimeout(cancel,timeout);
 try {
  if(isAndroid)return await requestAndroid(url,init,c.signal,timeout);
  const response=await fetch(url,{...init,signal:c.signal,redirect:'error'});
  if(!response.ok)throw new Error(`El servicio respondió HTTP ${response.status}.`);
  const text=await response.text();
  if(text.length>262144)throw new Error('Respuesta demasiado grande.');
  return text;
 } catch(e) {
  if(c.signal.aborted)throw new Error(parent?.aborted?'Operación cancelada.':'La cámara no respondió dentro del plazo.');
  throw e;
 } finally {clearTimeout(timer);parent?.removeEventListener('abort',cancel);}
}
