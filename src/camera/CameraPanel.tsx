import React, {useEffect, useRef, useState} from 'react';
import {View,Text,TextInput,Pressable,Share,StyleSheet} from 'react-native';
import {probeCamera} from './probe';
type Report = Awaited<ReturnType<typeof probeCamera>>;
export default function CameraPanel(){
 const [url,setUrl]=useState('http://192.168.122.1:8080/sony/camera');
 const [report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function probe(){
  if(controller.current)return;
  const c=new AbortController();controller.current=c;setBusy(true);setError('');setReport(null);
  const timer=setTimeout(()=>c.abort(),10000);
  try{setReport(await probeCamera(url,c.signal));}
  catch(e){setError(c.signal.aborted?'La consulta se canceló o agotó los 10 segundos.':e instanceof Error?e.message:'No se pudo completar la consulta.');}
  finally{clearTimeout(timer);controller.current=null;setBusy(false);}
 }
 return <View style={s.box}>
 <Text style={s.title}>Probar conexión Wi-Fi</Text>
 <Text style={s.text}>Prueba experimental de lectura. Busca la lista de funciones que responde la cámara; no cambia ajustes ni confirma todavía la aplicación de recetas.</Text>
 <Text style={s.text}>1. Abre esta pantalla antes de cambiar de Wi-Fi.{ '\n'}2. En la A6400: MENU → Red → Ctrl con smartphone → Activar → Conexión.{ '\n'}3. En Ajustes del iPhone, únete al Wi-Fi mostrado por la cámara. Regresa aquí y permite acceso a la red local si iOS lo solicita.</Text>
 <Text style={s.note}>La dirección siguiente es una candidata usada por la API antigua de Sony, no una dirección confirmada para tu cámara. Si difiere, introduce el endpoint correcto. El Wi-Fi de la cámara puede no tener internet: carga la app antes de conectarte y evita recargar Expo Go durante la prueba.</Text>
 <Text style={s.text}>Dirección de la cámara</Text>
 <TextInput accessibilityLabel="Dirección de la cámara" style={s.input} value={url} editable={!busy} onChangeText={v=>{setUrl(v);setReport(null);setError('');}} autoCapitalize="none" autoCorrect={false} keyboardType="url"/>
 <Pressable accessibilityRole="button" disabled={busy} onPress={()=>{void probe();}} style={[s.button,busy&&{opacity:0.5}]}><Text style={s.text}>{busy?'Consultando…':'Consultar funciones disponibles'}</Text></Pressable>
 {busy&&<Pressable accessibilityRole="button" onPress={()=>controller.current?.abort()}><Text style={s.text}>Cancelar consulta</Text></Pressable>}
 {!!error&&<><Text selectable style={s.error}>{error}</Text><Text style={s.note}>Comprueba el Wi-Fi, el permiso Red local de Expo Go y la dirección. Un fallo no demuestra que la cámara carezca de control remoto: podría usar otra interfaz o necesitar una sesión distinta.</Text></>}
 {report&&<><Text style={s.title}>Respuesta recibida · {report.methods.length} funciones</Text><Text style={s.note}>Consulta puntual. El modelo no ha sido identificado y esto no representa una sesión de control activa.</Text><Text selectable style={s.text}>{report.methods.join('\n')||'Lista vacía en el estado actual.'}</Text><Pressable accessibilityRole="button" style={s.button} onPress={()=>{void Share.share({message:JSON.stringify(report,null,2)}).catch(()=>setError('No se pudo abrir el menú de compartir.'));}}><Text style={s.text}>Compartir diagnóstico</Text></Pressable></>}
 <Text style={s.note}>Bluetooth, USB y “Aplicar receta” siguen pendientes. La respuesta permitirá elegir el siguiente transporte y los controles a implementar. No se envían informes automáticamente.</Text>
 </View>;
}
const s=StyleSheet.create({box:{gap:16,padding:20,borderRadius:18,backgroundColor:'#1b272a'},title:{color:'#c6eb9e',fontSize:20,fontWeight:'600'},text:{color:'#e4e8e3',fontSize:15,lineHeight:23},note:{color:'#a9b5b7',fontSize:13,lineHeight:20},input:{backgroundColor:'#101719',padding:14,color:'#fff',borderRadius:12,fontSize:13},button:{padding:16,backgroundColor:'#4a6543',borderRadius:16},error:{color:'#ffbcaa',lineHeight:22}});
