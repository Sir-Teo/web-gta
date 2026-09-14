import {test,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {readCarGroups,resolveCarGroups} from '../src/assets/carGroups';
import {readVehicleIde} from '../src/assets/vehicleIde';
test('original 34 car groups retain duplicate names and resolve only 23 native slots',async()=>{
 const groups=readCarGroups(await readFile('public/play/world/files/vehicles/cargrp.dat','utf8'));
 const vehicles=readVehicleIde(await readFile('public/play/world/files/vehicles/vehicles.ide','utf8')).records;
 const prepared=resolveCarGroups(groups,vehicles);
 expect(prepared).toHaveLength(34);expect(prepared.flatMap(g=>g.unresolved)).toEqual([]);
 expect(groups[1].names.filter(n=>n==='elegant')).toHaveLength(2);expect(prepared[1].models.filter(id=>id===507)).toHaveLength(2);
 expect(prepared[6].models).toHaveLength(23);expect(prepared[6].ignored).toEqual(['euros','phoenix','emperor']);
 expect(prepared[7].models).toHaveLength(23);expect(prepared[7].ignored).toEqual(['tahoma','picador','bmx','tornado','euros','sentinel']);
 expect(prepared[19].models).toEqual([492,567,412]);
});
test('group parsing rejects missing rows and bad names; unresolved models do not shift group IDs',()=>{
 const text=Array.from({length:34},()=> 'missing, known').join('\n'),groups=readCarGroups(text),vehicles=[{id:492,model:'known'}] as any;
 const prepared=resolveCarGroups(groups,vehicles);expect(prepared[33]).toMatchObject({index:33,models:[492],unresolved:['missing']});
 expect(()=>readCarGroups('known')).toThrow('34');expect(()=>readCarGroups(text.replace('missing','../missing'))).toThrow('names');
 expect(()=>resolveCarGroups(groups,[])).toThrow('shift');expect(()=>resolveCarGroups(groups,[...vehicles,...vehicles])).toThrow('Ambiguous');
});
