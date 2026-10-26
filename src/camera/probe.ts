/** Experimental legacy Sony HTTP API probe. Not Camera Remote Command/PTP. */
export function cameraEndpoint(input: string): string {
 const u = new URL(input.trim());
 const parts = u.hostname.split('.').map(Number);
 const privateIP = parts.length === 4 && parts.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
  (parts[0] === 10 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31));
 if (!privateIP || u.protocol !== 'http:' || u.username || u.password || u.search || u.hash || u.pathname !== '/sony/camera')
  throw new Error('Usa una IP local con formato http://IP:PUERTO/sony/camera.');
 return u.toString();
}
export function parseMethods(value: unknown): string[] {
 if (!value || typeof value !== 'object') throw new Error('Respuesta no reconocida.');
 const data = value as {error?:unknown;result?:unknown};
 if (data.error) throw new Error('La cámara rechazó getAvailableApiList. Esta interfaz puede no estar disponible.');
 if (!Array.isArray(data.result) || !Array.isArray(data.result[0]) || !data.result[0].every((v:unknown)=>typeof v==='string'))
  throw new Error('El dispositivo respondió, pero no devolvió una lista de funciones Sony reconocible.');
 return [...new Set(data.result[0] as string[])].sort();
}
export async function probeCamera(endpoint: string, signal?: AbortSignal) {
 const address = cameraEndpoint(endpoint);
 const response = await fetch(address, {method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({method:'getAvailableApiList',params:[],id:1,version:'1.0'}), signal});
 if (!response.ok) throw new Error(`Respuesta HTTP ${response.status}. Comprueba dirección, puerto y modo de conexión.`);
 return {timestamp:new Date().toISOString(),protocol:'Sony legacy HTTP API (experimental)',endpoint:address,
  methods:parseMethods(await response.json()),modelVerified:false,settingsWritten:false};
}
