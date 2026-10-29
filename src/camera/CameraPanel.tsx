import type {CapabilityReport} from './capabilities';
import ValuePicker from './ValuePicker';
import {recipeFields,controlLabel} from './recipeFields';
import {releaseCameraNetwork} from './androidNetwork';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, Pressable, Share, StyleSheet } from 'react-native';
import { discover, discoveryAvailable } from './discovery';
import { Camera } from './protocol';
import { SonySession, Control, Plan, AdjustmentResult, CameraRejectedError, PartialApplicationError, VerificationError } from './session';
import { recipes, Recipe } from '../guide';
export default function CameraPanel({initialRecipe=null}:{initialRecipe?:Recipe|null}) {
    const [busy, setBusy] = useState(false), [status, setStatus] = useState('Sin conexión'), [error, setError] = useState('');
    const [cameras, setCameras] = useState<Camera[]>([]), [camera, setCamera] = useState<Camera | null>(null);
    const [settings, setSettings] = useState<Control[]>([]), [methods, setMethods] = useState<string[]>([]);
    const [capabilityReport,setCapabilityReport]=useState<CapabilityReport|null>(null);
    const [diagnostics, setDiagnostics] = useState<string[]>([]);
    const [picker,setPicker]=useState<Control|'recipes'|null>(null);
    const [section,setSection]=useState<'controls'|'recipes'>('recipes');
    const [results,setResults]=useState<AdjustmentResult[]>([]);
    const [recipe, setRecipe] = useState<Recipe | null>(initialRecipe), [plan, setPlan] = useState<Plan | null>(null);
    const session = useRef<SonySession | null>(null), abort = useRef<AbortController | null>(null), alive = useRef(true), locked = useRef(false);
    const native = discoveryAvailable();
    useEffect(() => {
        alive.current = true;
        const listener = AppState.addEventListener('change', state => {
            if (state !== 'background')
                return;
            abort.current?.abort();
            session.current?.close(); releaseCameraNetwork();
            session.current = null;
            setCamera(null);
            setSettings([]);
            setMethods([]);
            setPlan(null);
            setStatus('Conexión cerrada al salir de la app.');
        });
        return () => { alive.current = false; listener.remove(); abort.current?.abort(); session.current?.close(); releaseCameraNetwork(); };
    }, []);
    async function run(action: () => Promise<void>) {
        if (locked.current)
            return;
        locked.current = true;
        setBusy(true);
        setError('');
        try {
            await action();
        }
        catch (e) {
            if (alive.current) {
                setError(e instanceof Error ? e.message : String(e));
                setDiagnostics(previous=>[...previous,e instanceof Error?e.message:String(e)]);
                if(e instanceof CameraRejectedError || e instanceof VerificationError || (e instanceof PartialApplicationError && e.connectionUsable)){
                    setStatus('Conectada · ajuste sin confirmar; revisa la cámara');
                    setPlan(null);
                    return;
                }
                setStatus('Operación no completada · vuelve a conectar');
                session.current?.close(); releaseCameraNetwork(); session.current = null;
                setCamera(null); setMethods([]); setSettings([]); setPlan(null);
            }
        }
        finally {
            locked.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    async function search() {
        session.current?.close(); releaseCameraNetwork();
        session.current = null;
        setCamera(null);
        setMethods([]);
        setSettings([]);
        setPlan(null);
        setCameras([]);
        setCapabilityReport(null);
        setDiagnostics([]);
        const controller = new AbortController();
        abort.current = controller;
        setResults([]);
        setStatus('Buscando cámaras en el Wi-Fi…');
        try {
            const found = await discover(controller.signal);
            if (!alive.current || controller.signal.aborted)
                return;
            setCameras(found.cameras);
            setDiagnostics(found.diagnostics);
            setStatus(found.cameras.length ? 'Selecciona tu cámara' : 'No se pudo identificar la cámara. Revisa el diagnóstico.');
        }
        finally {
            if (abort.current === controller)
                abort.current = null;
        }
    }
    async function connect(c: Camera) {
        session.current?.close();
        const next = new SonySession(c);
        session.current = next;
        setStatus('Iniciando control remoto…');
        try {
            await next.connect();
            const controls = await next.readControls();
            const selectedPlan=recipe?await next.plan(recipe):null;
            if (!alive.current || session.current !== next)
                return;
            setCamera(c);
            setPlan(selectedPlan);
            setSettings(controls);
            setMethods([...next.methods]);
            setCameras([]);
            setStatus('Cámara conectada');
        }
        catch (e) {
            next.close();
            if (session.current === next)
                session.current = null;
            throw e;
        }
    }
    async function audit() {
        const current=session.current;if(!current)return;
        setStatus('Leyendo capacidades; no se envían ajustes…');
        try {
            await current.auditCapabilities();
            if(alive.current&&session.current===current)setStatus('Comprobación terminada · comparte el diagnóstico');
        } finally {
            if(alive.current)setCapabilityReport(current.capabilityReport);
        }
    }
    async function refresh() {
        const current = session.current;
        if (!current)
            return;
        const values = await current.readControls();
        if (session.current !== current || !alive.current)
            return;
        setSettings(values);
        setMethods([...current.methods]);
        setPlan(recipe?await current.plan(recipe):null);
        setResults([]);
        setStatus('Controles actualizados');
    }
    return <View style={s.box}>
  <Text style={s.title}>Conectar tu α6400</Text>
  <Text accessibilityLiveRegion="polite" style={s.text}>{status}</Text>
  {!native ? <Text style={s.error}>Estás usando una app sin el módulo de detección. Instala la compilación propia de Sony Recipe AI; Expo Go permite usar el catálogo, pero no esta conexión.</Text> : <Text style={s.note}>En la cámara activa Ctrl con smartphone. Conecta el teléfono a su Wi-Fi y vuelve aquí. La app descubre el modelo y la dirección del servicio automáticamente.</Text>}
  {!camera && <Button label={'Buscar cámaras'} onPress={() => { void run(search); }} busy={busy} disabled={!native}/>}
  {busy && <Pressable accessibilityRole="button" onPress={() => { abort.current?.abort(); session.current?.close(); releaseCameraNetwork(); session.current = null; setCamera(null); setPlan(null); setSettings([]); setMethods([]); }}><Text style={s.text}>Cancelar</Text></Pressable>}
  {cameras.map(c => <View key={c.endpoint}>{<Button label={`Conectar · ${c.name}`} onPress={() => { void run(() => connect(c)); }} busy={busy}/>}</View>)}
  {!!error && <Text selectable style={s.error}>{error}</Text>}
  {camera && <>
   <Text style={s.title}>{camera.model}</Text>
   <Button label="Comprobar capacidades (solo lectura)" onPress={()=>{void run(audit);}} busy={busy}/>
   <Text style={s.note}>Consulta métodos admitidos, parámetros y valores actuales. No cambia ajustes ni prueba disparos.</Text>
   {<Button label={'Actualizar controles'} onPress={() => { void run(refresh); }} busy={busy}/>}
   <View style={s.wrap}>{(['recipes','controls'] as const).map(value=><Pressable key={value} accessibilityRole="tab" accessibilityState={{selected:section===value}} onPress={()=>setSection(value)} style={[s.tab,section===value&&s.tabActive]}><Text style={s.text}>{value==='recipes'?'Recetas':'Controles'}</Text></Pressable>)}</View>
   {section==='controls'?<>
    <Text style={s.note}>Solo se muestran valores disponibles ahora. P/A/S/M se cambia en «Modo de exposición» si la cámara lo permite; «Foto/vídeo» es otro control.</Text>
    {settings.map(control=><Pressable key={control.key} accessibilityRole="button" accessibilityLabel={`Cambiar ${control.label}`} disabled={busy} onPress={()=>setPicker(control)} style={s.setting}><View style={{flex:1}}><Text style={s.note}>{control.label}</Text><Text style={s.text}>{control.labels?.[control.current]??controlLabel(control.key,control.current)}</Text></View><Text style={s.title}>›</Text></Pressable>)}
    {!settings.length&&<Text style={s.note}>No hay controles disponibles en el estado actual. Cambia el modo en la cámara y actualiza.</Text>}
    <Button label="Tomar fotografía" onPress={()=>{void run(async()=>{await session.current?.capture();if(alive.current&&session.current)setStatus('La cámara confirmó la captura.');});}} busy={busy} disabled={!methods.includes('actTakePicture')}/>
   </>:<>
    <Text style={s.title}>Receta completa, ajuste por ajuste</Text>
    <Text style={s.note}>Una receta se envía como conjunto. Si falta soporte para alguno de sus parámetros, no se envía ninguno. Los controles individuales siguen disponibles en la otra pestaña.</Text>
    <Button label={recipe?`Cambiar receta · ${recipe.name}`:'Elegir receta'} onPress={()=>setPicker('recipes')} busy={busy}/>
    {recipe&&<View style={s.group}>
     <Text style={s.title}>{recipe.name}</Text>
     <Text style={s.note}>Los valores proceden de A6000: el resultado y las equivalencias en A6400 requieren validación. Usa Picture Profile desactivado; los efectos de imagen pueden exigir JPEG.</Text>
     {recipeFields(recipe).map(field=>{
      const result=results.find(r=>r.key===field.key);
      const remote=field.key==='WhiteBalance'?!!plan?.wb:field.key==='ExposureCompensation'?plan?.ev!=null:false;
      const label=result?({confirmed:'Lectura confirmada',unconfirmed:'Sin confirmar',rejected:'No aplicado',manual:'Sin soporte en esta integración','not-sent':'No enviado'}[result.state]):remote?'Envío individual implementado':'Envío todavía no implementado';
      return <View key={field.key} style={s.field}><View style={s.settingTop}><Text style={s.text}>{field.label}</Text><Text style={s.text}>{field.value}</Text></View><Text style={result&&['rejected','unconfirmed'].includes(result.state)?s.error:s.note}>{label}</Text>{result&&<Text selectable style={s.note}>{result.detail}</Text>}</View>;
     })}
     <Button label="Enviar receta completa" busy={busy} disabled={!plan||plan.manual.length>0} onPress={()=>{void run(async()=>{
      const current=session.current;if(!current)return;
      setResults([]);
      const report=await current.applyComplete(recipe);
      if(alive.current&&current===session.current){setResults(report);setMethods([...current.methods]);setStatus(`${report.filter(r=>r.state==='confirmed').length}/2 ajustes remotos confirmados. Revisa el conjunto de la receta.`);setDiagnostics(previous=>[...previous,...report.map(r=>`${r.key}: ${r.state} · ${r.detail}`)]);}
     });}}/>
     <Text style={s.error}>Receta completa bloqueada: faltan controles de estilo/efecto, contraste, saturación, nitidez, ajuste fino WB y DRO en esta integración. Elegir una receta no cambia ningún ajuste.</Text>
    </View>}
   </>}
   {<Button label={'Desconectar'} onPress={() => { session.current?.close(); releaseCameraNetwork(); session.current = null; setCamera(null); setMethods([]); setSettings([]); setPlan(null); setStatus('Desconectada'); }} busy={busy}/>}
  </>}
  {picker&&<ValuePicker title={picker==='recipes'?'Elegir receta':picker.label} current={picker==='recipes'?recipe?.id??'':picker.current} options={picker==='recipes'?recipes.map(r=>({value:r.id,label:r.name})):picker.values.map(value=>({value,label:picker.labels?.[value]??controlLabel(picker.key,value)}))} onClose={()=>setPicker(null)} onChoose={value=>{
   const selection=picker;setPicker(null);
   if(selection==='recipes'){
    const selected=recipes.find(r=>r.id===value);if(!selected)return;setRecipe(selected);setPlan(null);setResults([]);
    void run(async()=>{const current=session.current;if(!current)return;const next=await current.plan(selected);if(alive.current&&current===session.current)setPlan(next);});
   }else void run(async()=>{const current=session.current;if(!current)return;await current.setControl(selection.key,value);setResults([]);await refresh();});
  }}/>}
  {capabilityReport&&<Text selectable style={s.note}>Informe de capacidades {capabilityReport.complete?'terminado':'incompleto'} · {capabilityReport.model} · {capabilityReport.reads.length} consultas · {capabilityReport.reads.filter(r=>r.error).length} errores. Incluido en «Compartir diagnóstico». No confirma todavía el envío de recetas.</Text>}
  {!!diagnostics.length && <Text selectable style={s.note}>{diagnostics.join('\n')}</Text>}
  {<Button label={'Compartir diagnóstico'} onPress={() => { void Share.share({ message: JSON.stringify({ time: new Date().toISOString(), native, camera, methods, status, error, diagnostics, recipe:recipe?.id, results, capabilityReport, trace:session.current?.trace??[] }, null, 2) }).catch(() => setError('No se pudo compartir.')); }} busy={busy}/>}
 </View>;
}
const s = StyleSheet.create({tab:{flex:1,padding:14,borderRadius:12,backgroundColor:'#101719',alignItems:'center'},tabActive:{backgroundColor:'#4a6543'},setting:{flexDirection:'row',alignItems:'center',gap:12,padding:16,borderRadius:12,backgroundColor:'#101719'},field:{padding:14,gap:8,borderRadius:12,backgroundColor:'#101719'},settingTop:{gap:6},check:{color:'#c6eb9e',paddingVertical:10,fontSize:14}, box: { gap: 16, padding: 20, borderRadius: 18, backgroundColor: '#1b272a' }, title: { color: '#c6eb9e', fontSize: 20, fontWeight: '600' }, text: { color: '#e4e8e3', fontSize: 15, lineHeight: 23 }, note: { color: '#a9b5b7', fontSize: 13, lineHeight: 20 }, input: { backgroundColor: '#101719', padding: 14, color: '#fff', borderRadius: 12 }, button: { padding: 13, backgroundColor: '#4a6543', borderRadius: 14 }, disabled: { opacity: 0.4 }, error: { color: '#ffbcaa', lineHeight: 22 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, group: { gap: 10, paddingVertical: 10 } });
function Button({ label, onPress, disabled = false, busy = false }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    busy?: boolean;
}) { return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy} style={[s.button, (disabled || busy) && s.disabled]} onPress={onPress}><Text style={s.text}>{label}</Text></Pressable>; }
