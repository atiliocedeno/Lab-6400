import {recipeFields} from './src/camera/recipeFields';
import CameraPanel from './src/camera/CameraPanel';
import React,{useEffect,useRef,useState} from 'react';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaView,ScrollView,View,Text,TextInput,Pressable,StyleSheet,Alert} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {recipes,Recipe} from './src/guide';
const file=FileSystem.documentDirectory+'favorites.json';
export default function App(){
 const saving=useRef(false);
 const [query,setQuery]=useState(''),[brand,setBrand]=useState('Todas'),[tab,setTab]=useState('Explorar');
 const [selected,setSelected]=useState<Recipe|null>(null),[favorites,setFavorites]=useState<string[]>([]),[ready,setReady]=useState(false),[cameraRecipe,setCameraRecipe]=useState<Recipe|null>(null);
 useEffect(()=>{FileSystem.readAsStringAsync(file).then(s=>{const v=JSON.parse(s);if(Array.isArray(v))setFavorites(v.filter((id:unknown)=>typeof id==='string'&&recipes.some(r=>r.id===id)));}).catch(()=>{}).finally(()=>setReady(true));},[]);
 async function toggle(r:Recipe){if(saving.current)return;saving.current=true;const next=favorites.includes(r.id)?favorites.filter(id=>id!==r.id):[...favorites,r.id];try{await FileSystem.writeAsStringAsync(file,JSON.stringify(next));setFavorites(next);}catch{Alert.alert('No se pudo guardar','Intenta de nuevo.');}finally{saving.current=false;}}
 const filtered=recipes.filter(r=>(brand==='Todas'||r.brand===brand)&&r.name.toLowerCase().includes(query.toLowerCase())&&(tab!=='Favoritos'||favorites.includes(r.id)));
 const button=(label:string,action:()=>void,active=false)=><Pressable accessibilityRole="button" onPress={action} style={[s.button,active&&s.active]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 return <SafeAreaView style={s.root}><StatusBar style="light"/><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
 <Text style={s.eyebrow}>SONY RECIPE AI · PROTOTIPO</Text><Text style={s.title}>{selected?selected.name:'Tu próxima\nimagen empieza aquí.'}</Text>
 <View style={s.banner}><Text style={s.green}>α6400 · Recetas y control remoto</Text><Text style={s.muted}>Conecta desde Cámara · aplicación de recetas parcial</Text></View>
 {selected?<>{button('← Volver al catálogo',()=>setSelected(null))}<Text style={s.section}>{selected.brand} / {selected.pe?'Efecto JPEG':'Creative Style'}</Text><Text style={s.muted}>Valores del conjunto completo. Seleccionar esta receta no cambia todavía la cámara.</Text>
 {recipeFields(selected).map(field=><View key={field.key} style={s.card}><Text style={s.green}>{field.label}</Text><Text style={s.body}>{field.value}</Text></View>)}
 {button('Usar esta receta en Cámara',()=>{setCameraRecipe(selected);setSelected(null);setTab('Cámara');})}
 <Text style={s.muted}>El envío completo requiere soporte para todos los parámetros. No se sustituye por aplicar únicamente el balance de blancos.</Text>{ready&&<Pressable accessibilityRole="button" style={s.button} onPress={()=>{void toggle(selected);}}><Text style={s.buttonText}>{favorites.includes(selected.id)?'★ Quitar favorito':'☆ Guardar favorito'}</Text></Pressable>}
 </>:<><View style={s.row}>{['Explorar','Favoritos','Cámara'].map(t=><React.Fragment key={t}>{button(t,()=>setTab(t),tab===t)}</React.Fragment>)}</View>
 {tab==='Cámara'?<CameraPanel initialRecipe={cameraRecipe}/>:<>
 <TextInput accessibilityLabel="Buscar receta" placeholder="Buscar Portra, Eterna, Cinestill…" placeholderTextColor="#8e989a" value={query} onChangeText={setQuery} style={s.input}/>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>{['Todas',...new Set(recipes.map(r=>r.brand))].map(b=><React.Fragment key={b}>{button(b,()=>setBrand(b),brand===b)}</React.Fragment>)}</ScrollView>
 <Text style={s.section}>{filtered.length} recetas · {tab==='Favoritos'?'Tu selección':'Catálogo original'}</Text>{filtered.length===0&&<Text style={s.body}>No hay recetas aquí. Cambia la búsqueda o guarda favoritas.</Text>}
 {filtered.map((r,i)=><Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Ver ${r.name}`} onPress={()=>{setSelected(r);}} style={s.card}><View style={s.cardTop}><Text style={s.eyebrow}>{r.brand.toUpperCase()}</Text><Text style={s.green}>{favorites.includes(r.id)?'★':String(i+1).padStart(2,'0')}</Text></View><Text style={s.recipe}>{r.name}</Text><Text style={s.muted}>{r.styleName} · {r.wbMode===14?r.kelvin+' K':'WB Auto'} · {r.pe?'Efecto JPEG':'Ver receta'} ↗</Text></Pressable>)}</>}</>}
 <Text style={s.footer}>Recetas de voxivoid / Recipe Lab · GPL-3.0{'\n'}Proyecto independiente, sin afiliación con Sony. Looks aproximados, no perfiles oficiales de otras marcas.</Text>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#101719'},page:{padding:24,paddingTop:28,paddingBottom:48,gap:16},eyebrow:{fontSize:11,letterSpacing:2,color:'#a5b3b5'},title:{fontSize:36,lineHeight:41,fontWeight:'700',color:'#f4f3ed'},banner:{padding:17,borderRadius:16,backgroundColor:'#203333',gap:6},green:{color:'#c6eb9e',fontWeight:'600'},muted:{color:'#a9b5b7',fontSize:13,lineHeight:20},row:{flexDirection:'row',gap:8},button:{paddingHorizontal:15,paddingVertical:13,borderRadius:24,backgroundColor:'#283538'},active:{backgroundColor:'#4a6543'},buttonText:{color:'#f3f4ee',fontSize:13,fontWeight:'600'},input:{backgroundColor:'#1d272a',padding:16,borderRadius:14,color:'#fff',fontSize:15},section:{color:'#e4e8e3',fontSize:16,fontWeight:'600'},card:{backgroundColor:'#1b272a',borderRadius:18,padding:20,gap:12,borderWidth:1,borderColor:'#2b3b3e'},cardTop:{flexDirection:'row',justifyContent:'space-between'},recipe:{fontSize:23,fontWeight:'600',color:'#f2f0e8'},body:{color:'#d3ddda',fontSize:15,lineHeight:23},footer:{fontSize:11,lineHeight:18,color:'#829294',marginTop:16}});
