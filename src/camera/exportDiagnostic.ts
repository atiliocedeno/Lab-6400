import * as FileSystem from 'expo-file-system/legacy';

// Serialize before opening the picker: backgrounding may close the camera session.
export async function exportDiagnostic(snapshot:unknown):Promise<boolean>{
 const text=JSON.stringify(snapshot,null,2);
 const permission=await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
 if(!permission.granted)return false;
 const filename=`sony-diagnostico-${Date.now()}.json`;
 const uri=await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri,filename,'application/json');
 await FileSystem.writeAsStringAsync(uri,text,{encoding:FileSystem.EncodingType.UTF8});
 const saved=await FileSystem.readAsStringAsync(uri,{encoding:FileSystem.EncodingType.UTF8});
 if(saved!==text)throw new Error('El archivo guardado no coincide con el informe completo. Vuelve a guardarlo.');
 return true;
}
