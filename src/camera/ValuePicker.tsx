import React,{useState} from 'react';
import {Modal,View,Text,TextInput,Pressable,FlatList,StyleSheet,SafeAreaView} from 'react-native';
export type PickerOption={value:string;label:string};
export default function ValuePicker({title,current,options,onChoose,onClose}:{title:string;current:string;options:PickerOption[];onChoose:(value:string)=>void;onClose:()=>void}){
 const [query,setQuery]=useState(''),[selected,setSelected]=useState(current);
 const filtered=options.filter(o=>o.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 return <Modal visible animationType="slide" onRequestClose={onClose}><SafeAreaView style={s.root}>
  <View style={s.header}><Text style={s.title}>{title}</Text><Pressable accessibilityRole="button" onPress={onClose} style={s.close}><Text style={s.text}>Cancelar</Text></Pressable></View>
  <Text style={s.hint}>Selecciona un valor y confirma para enviarlo.</Text>
  <TextInput autoCorrect={false} accessibilityLabel={`Buscar ${title}`} placeholder="Buscar valor…" placeholderTextColor="#9faeaa" value={query} onChangeText={setQuery} style={s.input}/>
  <FlatList data={filtered} keyExtractor={o=>o.value} keyboardShouldPersistTaps="handled" extraData={selected} renderItem={({item})=><Pressable accessibilityRole="radio" accessibilityState={{checked:selected===item.value}} onPress={()=>setSelected(item.value)} style={[s.row,selected===item.value&&s.active]}><Text style={s.text}>{item.label}</Text><Text style={s.green}>{selected===item.value?'●':item.value===current?'Actual':'○'}</Text></Pressable>} ListEmptyComponent={<Text style={s.hint}>No hay coincidencias.</Text>}/>
  <Pressable accessibilityRole="button" accessibilityState={{disabled:!options.some(o=>o.value===selected)}} disabled={!options.some(o=>o.value===selected)} style={s.confirm} onPress={()=>onChoose(selected)}><Text style={s.confirmText}>Confirmar selección</Text></Pressable>
 </SafeAreaView></Modal>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#101719',padding:20},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,padding:16},title:{color:'#f4f3ed',fontSize:21,fontWeight:'700',flex:1},text:{color:'#e4e8e3',fontSize:16,flexShrink:1},hint:{color:'#a9b5b7',paddingHorizontal:16,paddingBottom:12,lineHeight:20},close:{padding:12},input:{margin:16,padding:16,borderRadius:12,backgroundColor:'#243234',color:'#fff'},row:{marginHorizontal:16,marginBottom:8,padding:18,borderRadius:12,backgroundColor:'#1b272a',flexDirection:'row',justifyContent:'space-between',gap:16,minHeight:56},active:{backgroundColor:'#354d35',borderColor:'#c6eb9e',borderWidth:1},green:{color:'#c6eb9e'},confirm:{margin:16,padding:18,borderRadius:14,backgroundColor:'#c6eb9e'},confirmText:{color:'#182317',textAlign:'center',fontSize:16,fontWeight:'700'}});
