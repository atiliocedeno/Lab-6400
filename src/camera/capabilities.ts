// Sony Camera Remote API 2.40, server information (pp. 251–254).
// This audit never executes names supplied by the camera: only this read-only allowlist.
export type CapabilityReport={
 schemaVersion:1;startedAt:string;finishedAt?:string;endpoint:string;model:string;
 complete:boolean;error?:string;availableMethods:string[];
 reads:{method:string;params:unknown[];result?:unknown[];error?:string}[];
 scope:string;
};
export const auditReadMethods=[
 'getExposureMode','getShootMode','getWhiteBalance','getExposureCompensation',
 'getIsoSpeedRate','getShutterSpeed','getFNumber',
 'getAvailableWhiteBalance','getSupportedWhiteBalance',
 'getAvailableExposureCompensation','getSupportedExposureCompensation',
 'getColorSetting','getAvailableColorSetting','getSupportedColorSetting',
] as const;
export async function collectCapabilities(
 report:CapabilityReport,call:(method:string,params:unknown[])=>Promise<unknown[]>,
 isRejected:(error:unknown)=>boolean,
){
 const read=async(method:string,params:unknown[]=[])=>{
  const entry:CapabilityReport['reads'][number]={method,params};report.reads.push(entry);
  try {entry.result=await call(method,params);return entry.result;}
  catch(error){entry.error=error instanceof Error?error.message:String(error);if(!isRejected(error))throw error;}
 };
 try {
  const available=await read('getAvailableApiList');
  if(!available||!Array.isArray(available[0])||!available[0].every(v=>typeof v==='string'))throw new Error('Lista de capacidades inválida.');
  report.availableMethods=[...new Set(available[0] as string[])];
  // Documented introspection methods may be omitted from the currently available list.
  await read('getApplicationInfo');
  const types=await read('getMethodTypes',['']);
  if(types&&!types.every(row=>Array.isArray(row)&&row.length===4&&typeof row[0]==='string'&&
   Array.isArray(row[1])&&row[1].every(v=>typeof v==='string')&&
   Array.isArray(row[2])&&row[2].every(v=>typeof v==='string')&&typeof row[3]==='string'))
   throw new Error('Tipos de métodos inválidos; se conserva la respuesta original.');
  for(const method of auditReadMethods)if(report.availableMethods.includes(method))await read(method);
  report.complete=true;
 } catch(error){report.error=error instanceof Error?error.message:String(error);throw error;}
 finally {report.finishedAt=new Date().toISOString();}
 return report;
}
