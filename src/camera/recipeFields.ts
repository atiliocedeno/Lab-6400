import type {Recipe} from '../guide';
export function recipeFields(r:Recipe){
 const effects:Record<number,string>={4:'Retro Photo',5:'Soft High-key',7:'High Contrast Monochrome'};
 return [
  {key:'Style',label:r.pe?'Efecto de imagen':'Estilo creativo',value:r.pe?(effects[r.pe]??String(r.pe)):r.styleName},
  {key:'Contrast',label:'Contraste',value:r.pe?'Controlado por el efecto':String(r.con)},
  {key:'Saturation',label:'Saturación',value:r.pe||[6,14].includes(r.style)?'No ajustable en este efecto/estilo':String(r.sat)},
  {key:'Sharpness',label:'Nitidez',value:r.pe?'Controlada por el efecto':String(r.sharp)},
  {key:'WhiteBalance',label:'Balance de blancos',value:r.wbMode===14?`${r.kelvin} K`:'Automático'},
  {key:'Tint',label:'Ajuste fino WB',value:`${r.ab>=0?'A':'B'}${Math.abs(r.ab)} / ${r.gm>=0?'G':'M'}${Math.abs(r.gm)} · equivalencia pendiente`},
  {key:'ExposureCompensation',label:'Compensación EV',value:`${(r.ev/3).toFixed(1)} EV`},
  {key:'DRO',label:'DRO',value:r.dro===6?'Auto':r.dro===0?'Off':`Nivel ${r.dro}`},
  ...(r.sub?[{key:'Subeffect',label:'Subajuste del efecto',value:`Original ${r.sub} · validar equivalencia en cámara`}]:[]),
 ];
}
export function controlLabel(key:string,value:string){
 const names:Record<string,string>={still:'Fotografía',movie:'Vídeo','Program Auto':'P · Programa','Aperture Priority':'A · Prioridad de apertura','Shutter Priority':'S · Prioridad de obturación',Manual:'M · Manual','Intelligent Auto':'Automático inteligente','Superior Auto':'Automático superior',AUTO:'Automático'};
 return names[value]??(key==='FNumber'?`f/${value}`:value);
}
