import recipes from './recipes.json';
export type Recipe = typeof recipes[number];
export {recipes};
export function guide(r:Recipe):string[]{
 const steps=['Anota tus ajustes actuales. Usa P, A, S o M; Picture Profile desactivado.'];
 if(r.pe){const effects:Record<number,string>={4:'Retro Photo',5:'Soft High-key',7:'High Contrast Monochrome'};steps.push(`Usa JPEG. Picture Effect → ${effects[r.pe]}. El efecto sustituye Creative Style. Comprueba restricciones de foto/vídeo en cámara.`);if(r.pe===5)steps.push('El original pide tinte azul. Disponibilidad de este subparámetro en A6400 pendiente de validar.');}
 else{steps.push(`Picture Effect → Off. Creative Style → ${r.styleName}.`);steps.push(`Contraste ${r.con}; nitidez ${r.sharp}; ${[6,14].includes(r.style)?'saturación no ajustable en este estilo':`saturación ${r.sat}`}.`);}
 steps.push(`Balance de blancos → ${r.wbMode===14?r.kelvin+' K':'Auto'}.`);
 steps.push(`Ajuste fino original: ${r.ab>=0?'A':'B'}${Math.abs(r.ab)} / ${r.gm>=0?'G':'M'}${Math.abs(r.gm)}. La equivalencia de pasos A6000/A6400 está pendiente de validar.`);
 steps.push(`Exposición ${(r.ev/3).toFixed(1)} EV, si el modo lo permite. DRO ${r.dro===6?'Auto':r.dro===0?'Off':'nivel '+r.dro}.`);
 steps.push('Haz una foto de prueba. Valores procedentes de A6000: el resultado en A6400 requiere comparación. El look no se aplica de forma irreversible al RAW.');return steps;
}
