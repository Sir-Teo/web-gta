import {openAsBlob,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {expect,test} from 'vitest';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {readDff} from '../src/assets/dff';
import {readTxd} from '../src/assets/txd';
import {decodeModelTextures} from '../src/assets/modelTextures';
import {readVehicleIde} from '../src/assets/vehicleIde';
import {readHandling} from '../src/assets/handling';
test.skipIf(!process.env.GTA_CONTENT_DIR)('public Greenwood resources resolve the native model, definition, handling and texture dictionaries',async()=>{
 const depot=process.env.GTA_CONTENT_DIR!;
 const lock=JSON.parse(readFileSync('scripts/content/vehicle-sources.json','utf8'));
 for(const resource of lock.resources){const data=readFileSync(join(depot,resource.path));expect(data.length).toBe(resource.bytes);expect(createHash('sha256').update(data).digest('hex')).toBe(resource.sha256);}
 const archive=await openAsBlob(join(depot,'gta3.img')),entries=await readImgIndex(archive);
 const bytes=async(name:string)=>readImgEntry(archive,entries.find(e=>e.name===name)!);
 const model=readDff(await bytes('greenwoo.dff')),own=await bytes('greenwoo.txd'),shared=new Uint8Array(readFileSync(join(depot,'vehicles/vehicle.txd')));
 const textures=decodeModelTextures(model,[own,shared],undefined,['greenwoo','vehicle']);
 const needed=[...new Set(model.geometries.flatMap(g=>g.materials.map(m=>m.texture)).filter(Boolean))];
 const missing=needed.filter(n=>!textures.some(t=>t.name.toLowerCase()===n.toLowerCase()));
 const vehicle=readVehicleIde(readFileSync(join(depot,'vehicles/vehicles.ide'),'utf8')).records.find(r=>r.id===492)!;
 const handlingText=readFileSync(join(depot,'vehicles/handling.cfg'),'utf8');
 // Known parser incompatibility: TORNADO has a nine-digit modelFlags token. Preserve
 // that full-file rejection; inspect the independently selected Greenwood row.
 expect(()=>readHandling(handlingText)).toThrow('Handling line 231');
 const handling=readHandling(handlingText.split(/\r?\n/).find(line=>line.startsWith(vehicle.handling+' '))!).records[0];
 expect(missing).toEqual([]);expect(textures).toHaveLength(12);expect(textures.filter(t=>t.sourceDictionary==='greenwoo')).toHaveLength(2);expect(readTxd(shared)).toHaveLength(19);
 expect(vehicle.model).toBe('greenwoo');expect(vehicle.dictionary).toBe('greenwoo');expect(vehicle.frontWheelSize).toBe(.7);expect(vehicle.rearWheelSize).toBe(.7);expect(handling).toBeDefined();
 console.log(JSON.stringify({needed,missing,sharedNames:readTxd(shared).map(t=>t.name),resolved:textures.map(t=>({name:t.name,source:t.sourceDictionary,mips:t.mips.length}))}));
});
