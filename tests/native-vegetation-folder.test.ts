import {readFile} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {expect,test,vi} from 'vitest';
import {readNativeVegetationFolder,NATIVE_VEGETATION_PATHS} from '../src/assets/nativeVegetationFolder';

test('vegetation paths reject ambiguous roots and misplaced basename matches before reading',async()=>{
 const file=new File(['x'],'plants.dat'),read=vi.spyOn(file,'arrayBuffer');
 await expect(readNativeVegetationFolder([{path:'root/other/plants.dat',file}])).rejects.toThrow('missing plants.dat');
 await expect(readNativeVegetationFolder([{path:'root/plants.dat',file},{path:'root/PLANTS.DAT',file}])).rejects.toThrow('Duplicate');
 await expect(readNativeVegetationFolder([{path:'root/plants.dat',file},{path:'other/object.dat',file}])).rejects.toThrow('one content folder');
 await expect(readNativeVegetationFolder([{path:'root/../plants.dat',file}])).rejects.toThrow('path');expect(read).not.toHaveBeenCalled();
});

test.skipIf(!process.env.GTA_CONTENT_DIR)('complete native vegetation package loads by relative path without opening unrelated files',async()=>{
 const folder=await Promise.all(NATIVE_VEGETATION_PATHS.map(async path=>({path:`depot/${path}`,file:new File([await readFile(join(process.env.GTA_CONTENT_DIR!,path))],basename(path))})));
 const unrelated=new File(['not an IMG'],'gta3.img'),read=vi.spyOn(unrelated,'arrayBuffer');
 const loaded=await readNativeVegetationFolder([...folder,{path:'depot/gta3.img',file:unrelated}]);
 expect(loaded.plantRecords).toHaveLength(68);expect(loaded.proceduralObjects).toHaveLength(95);expect(loaded.objectRecords).toHaveLength(994);expect(loaded.surfaces.size).toBe(42);expect(loaded.grass.models).toHaveLength(8);expect(read).not.toHaveBeenCalled();
 const differentCase=folder.map(entry=>({...entry,path:entry.path.toUpperCase().replaceAll('/','\\')}));
 expect((await readNativeVegetationFolder(differentCase)).plantRecords).toEqual(loaded.plantRecords);
 await expect(readNativeVegetationFolder(folder.filter(entry=>!entry.path.endsWith('grass1_4.dff')))).rejects.toThrow('grass1_4.dff');
 const malformed=folder.map(entry=>entry.path.endsWith('plants.dat')?{...entry,file:new File(['bad'],'plants.dat')}:entry);
 await expect(readNativeVegetationFolder(malformed)).rejects.toThrow();expect(loaded.surfaces.size).toBe(42);
});
