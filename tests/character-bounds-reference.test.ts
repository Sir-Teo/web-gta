import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect,test} from 'vitest';
import {readDff} from '../src/assets/dff';
test.skipIf(!process.env.GTA_REFERENCE_DIR)('retains native morph spheres from the inspected pedestrian and player skeleton files',()=>{
 const report=['fam1','player','csplay'].map(name=>{
  const model=readDff(new Uint8Array(readFileSync(join(process.env.GTA_REFERENCE_DIR!,name+'.dff'))));
  const geometries=model.geometries.map(g=>({vertices:g.positions.length/3,bounds:g.morphBounds}));
  for(const geometry of geometries){expect(geometry.bounds?.length).toBeGreaterThan(0);expect(geometry.bounds![0].radius).toBeGreaterThanOrEqual(0);}
  return {name,geometries};
 });
 expect(report[0].geometries[0].bounds![0]).toEqual({center:[-0.05115887522697449,0.004529297351837158,0.004937350749969482],radius:0.9706013202667236});
 expect(report[1].geometries[0].bounds![0].radius).toBe(0.06143737956881523);
 expect(report[2].geometries[0].bounds![0].radius).toBe(0.06143737956881523);
 writeFileSync('/tmp/web-gta-character-morph-bounds.json',JSON.stringify(report,null,2));
});
