import {Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo';

type SearchResult={replies:{message:string;address:string}[];diagnostics:string[]};
type NetworkModule={discover(id:string):Promise<SearchResult>;request(id:string,url:string,method:string,body:string,timeout:number):Promise<string>;cancel(id:string):void;release():void};
const nativeNetwork=Platform.OS==='android'?requireOptionalNativeModule<NetworkModule>('CameraNetwork'):null;
export const isAndroid=Platform.OS==='android';
let sequence=0;
export function releaseCameraNetwork(){nativeNetwork?.release();}
async function operation<T>(action:(id:string)=>Promise<T>,signal?:AbortSignal):Promise<T>{
 if(!nativeNetwork)throw new Error('Instala la APK actualizada: falta el módulo de conexión Wi-Fi.');
 if(signal?.aborted)throw new Error('Operación cancelada.');
 const id=String(++sequence);
 return new Promise<T>((resolve,reject)=>{
  const cancel=()=>{nativeNetwork.cancel(id);reject(new Error('Operación cancelada.'));};
  signal?.addEventListener('abort',cancel,{once:true});
  action(id).then(value=>{if(!signal?.aborted)resolve(value);},reject).finally(()=>signal?.removeEventListener('abort',cancel));
 });
}
export function discoverAndroid(signal:AbortSignal){return operation(id=>nativeNetwork!.discover(id),signal);}
export function requestAndroid(url:string,init:RequestInit,signal:AbortSignal,timeout:number){
 return operation(id=>nativeNetwork!.request(id,url,init.method??'GET',typeof init.body==='string'?init.body:'',timeout),signal);
}
