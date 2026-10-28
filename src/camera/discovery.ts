import {isAndroid,discoverAndroid} from './androidNetwork';
import {NativeModules} from 'react-native';
import dgram from 'react-native-udp';
import {Camera,locationFromSSDP,parseDescription,request} from './protocol';

export function discoveryAvailable():boolean {return !!NativeModules.UdpSockets;}
export async function discover(signal:AbortSignal):Promise<{cameras:Camera[];diagnostics:string[]}> {
 if(!discoveryAvailable())throw new Error('La detección necesita la app instalada. Expo Go solo permite explorar el catálogo.');
 const locations=new Set<string>();
 const diagnostics:string[]=[];
 if(isAndroid) {
  const result=await discoverAndroid(signal);
  diagnostics.push(...result.diagnostics);
  for(const reply of result.replies){
   const location=locationFromSSDP(reply.message,reply.address);
   if(location&&locations.size<16)locations.add(location);
  }
 } else await new Promise<void>((resolve,reject)=>{
  const socket=dgram.createSocket({type:'udp4'});
  let finished=false, bound=false;
  const finish=(error?:Error)=>{if(finished)return;finished=true;clearTimeout(timer);clearInterval(repeat);signal.removeEventListener('abort',cancel);socket.close();if(error)reject(error);else resolve();};
  const cancel=()=>finish(new Error('Búsqueda cancelada.'));
  const send=()=>{
   if(!bound||finished)return;
   for(const target of ['urn:schemas-sony-com:service:ScalarWebAPI:1','ssdp:all']) {
    const message=`M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ${target}\r\n\r\n`;
    socket.send(message,undefined,undefined,1900,'239.255.255.250',error=>{if(error)diagnostics.push(`SSDP: ${error.message}`);});
   }
  };
  const timer=setTimeout(()=>finish(),6500);
  const repeat=setInterval(()=>{if(!finished)send();},2000);
  socket.on('error',(error:Error)=>finish(error));
  socket.on('message',(message:{toString():string},remote:{address:string})=>{
   const location=locationFromSSDP(message.toString(),remote.address);
   if(location&&locations.size<16)locations.add(location);
  });
  socket.once('listening',()=>{bound=true;send();});
  signal.addEventListener('abort',cancel);
  if(signal.aborted)cancel();else socket.bind(0);
 });
 const cameras:Camera[]=[];
 // Only descriptions actually announced by local devices; no guessed port or path.
 for(const url of locations) {
  if(signal.aborted)throw new Error('Búsqueda cancelada.');
  try{const camera=parseDescription(await request(url,{},signal,3500),url);if(!cameras.some(c=>c.endpoint===camera.endpoint))cameras.push(camera);}
  catch(e){if(signal.aborted)throw new Error("Búsqueda cancelada.");diagnostics.push(`Descripción ${url}: ${e instanceof Error?e.message:String(e)}`);}
 }
 if(!locations.size)diagnostics.push('No se recibieron anuncios SSDP. No se ha determinado el protocolo de esta cámara.');
 return {cameras,diagnostics};
}
