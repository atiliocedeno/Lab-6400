import {releaseCameraNetwork} from './androidNetwork';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, TextInput, Pressable, Share, StyleSheet } from 'react-native';
import { discover, discoveryAvailable } from './discovery';
import { Camera } from './protocol';
import { SonySession, Control, Plan } from './session';
import { recipes, Recipe } from '../guide';
export default function CameraPanel() {
    const [busy, setBusy] = useState(false), [status, setStatus] = useState('Sin conexión'), [error, setError] = useState('');
    const [cameras, setCameras] = useState<Camera[]>([]), [camera, setCamera] = useState<Camera | null>(null);
    const [settings, setSettings] = useState<Control[]>([]), [methods, setMethods] = useState<string[]>([]);
    const [diagnostics, setDiagnostics] = useState<string[]>([]), [query, setQuery] = useState('');
    const [recipe, setRecipe] = useState<Recipe | null>(null), [plan, setPlan] = useState<Plan | null>(null);
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
        setDiagnostics([]);
        const controller = new AbortController();
        abort.current = controller;
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
            if (!alive.current || session.current !== next)
                return;
            setCamera(c);
            setSettings(controls);
            setMethods([...next.methods]);
            setCameras([]);
        setDiagnostics([]);
            setStatus('Cámara conectada');
        }
        catch (e) {
            next.close();
            if (session.current === next)
                session.current = null;
            throw e;
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
        setPlan(null);
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
   {<Button label={'Actualizar controles'} onPress={() => { void run(refresh); }} busy={busy}/>}
   {settings.map(control => <View key={control.key} style={s.group}><Text style={s.text}>{control.label}: {control.current}</Text><View style={s.wrap}>{control.values.map(value => <View key={value}>{<Button label={value} onPress={() => { void run(async () => { await session.current?.setControl(control.key, value); await refresh(); }); }} busy={busy} disabled={value === control.current}/>}</View>)}</View></View>)}
   {<Button label={'Tomar fotografía'} onPress={() => { void run(async () => { await session.current?.capture(); if (alive.current && session.current)
            setStatus('La cámara confirmó la captura.'); }); }} busy={busy} disabled={!methods.includes('actTakePicture')}/>}
   <Text style={s.title}>Ajustes de una receta</Text>
   <Text style={s.note}>La API puede permitir balance de blancos y exposición. El estilo, contraste, saturación, nitidez, ajuste fino y DRO permanecen manuales. No se anunciará una receta completa como aplicada.</Text>
   <TextInput accessibilityLabel="Buscar receta para la cámara" style={s.input} value={query} onChangeText={setQuery} placeholder="Buscar receta…" placeholderTextColor="#a9b5b7"/>
   {recipes.filter(r => r.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8).map(r => <View key={r.id}>{<Button label={r.name} onPress={() => { setRecipe(r); setPlan(null); void run(async () => { const current = session.current; if (!current)
            return; const result = await current.plan(r); if (alive.current && current === session.current)
            setPlan(result); }); }} busy={busy}/>}</View>)}
   {recipe && plan && <View style={s.group}><Text style={s.text}>{recipe.name}</Text><Text style={s.note}>Se enviará: {[plan.wb ? 'balance de blancos' : null, plan.ev !== null ? 'exposición' : null].filter(Boolean).join(', ') || 'ningún ajuste disponible'}.</Text><Text style={s.note}>Completar en cámara: {plan.manual.join('; ')}.</Text>{<Button label={'Aplicar solo los ajustes disponibles'} onPress={() => { void run(async () => { const current = session.current; if (!current)
            return; const confirmed = await current.apply(recipe); if (alive.current && current === session.current) {
            setStatus(confirmed.length ? `Confirmado: ${confirmed.join(', ')}. Receta parcial.` : 'No se enviaron ajustes.');
            setPlan(null);
        } }); }} busy={busy} disabled={!plan.wb && plan.ev === null}/>}</View>}
   {<Button label={'Desconectar'} onPress={() => { session.current?.close(); releaseCameraNetwork(); session.current = null; setCamera(null); setMethods([]); setSettings([]); setPlan(null); setStatus('Desconectada'); }} busy={busy}/>}
  </>}
  {!!diagnostics.length && <Text selectable style={s.note}>{diagnostics.join('\n')}</Text>}
  {<Button label={'Compartir diagnóstico'} onPress={() => { void Share.share({ message: JSON.stringify({ time: new Date().toISOString(), native, camera, methods, status, error, diagnostics }, null, 2) }).catch(() => setError('No se pudo compartir.')); }} busy={busy}/>}
 </View>;
}
const s = StyleSheet.create({ box: { gap: 16, padding: 20, borderRadius: 18, backgroundColor: '#1b272a' }, title: { color: '#c6eb9e', fontSize: 20, fontWeight: '600' }, text: { color: '#e4e8e3', fontSize: 15, lineHeight: 23 }, note: { color: '#a9b5b7', fontSize: 13, lineHeight: 20 }, input: { backgroundColor: '#101719', padding: 14, color: '#fff', borderRadius: 12 }, button: { padding: 13, backgroundColor: '#4a6543', borderRadius: 14 }, disabled: { opacity: 0.4 }, error: { color: '#ffbcaa', lineHeight: 22 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, group: { gap: 10, paddingVertical: 10 } });
function Button({ label, onPress, disabled = false, busy = false }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    busy?: boolean;
}) { return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy} style={[s.button, (disabled || busy) && s.disabled]} onPress={onPress}><Text style={s.text}>{label}</Text></Pressable>; }
