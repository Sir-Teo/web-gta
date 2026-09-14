import {test,expect} from 'vitest';
import {worldToMap,mapToWorld} from '../src/ui/NativeMap';
test('radar mapping preserves original north-up bounds and Grove/Meadows coordinates',()=>{
 expect(worldToMap(-3000,-3000)).toEqual({x:0,y:0});expect(worldToMap(3000,3000)).toEqual({x:1,y:1});
 for(const p of [{x:2495,z:1687},{x:400,z:-2500},{x:-1373,z:-120}]){const uv=worldToMap(p.x,p.z),result=mapToWorld(uv.x,uv.y);expect(result.x).toBeCloseTo(p.x,8);expect(result.z).toBeCloseTo(p.z,8);}
 expect(worldToMap(400,-2500).y).toBeLessThan(worldToMap(2495,1687).y);
});
