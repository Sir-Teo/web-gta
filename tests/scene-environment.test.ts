import {expect,test,vi} from 'vitest';
import {loadSceneEnvironment} from '../src/ui/loadSceneEnvironment';
const loaders=()=>({lighting:{load:vi.fn(async()=>true)},water:{load:vi.fn(async()=>true)},particle:{load:vi.fn(async()=>true)}});
test('scene environment dispatches local files and regional weather through existing owners',async()=>{
 const owners=loaders(),lighting=new File(['table'],'timecycp.dat'),water=new File(['water'],'water.dat'),particle=new File(['txd'],'particle.txd');
 expect(await loadSceneEnvironment({lighting,water,particle,weather:5},owners)).toEqual([]);
 expect(owners.lighting.load).toHaveBeenCalledWith(lighting,5);expect(owners.water.load).toHaveBeenCalledWith(water,undefined);expect(owners.particle.load).toHaveBeenCalledWith(particle,undefined);
});
test('missing optional files preserve manual scenes, and a failed file does not suppress other loads',async()=>{
 const owners=loaders();expect(await loadSceneEnvironment(undefined,owners)).toEqual([]);expect(owners.lighting.load).not.toHaveBeenCalled();
 owners.lighting.load.mockResolvedValue(false);
 expect(await loadSceneEnvironment({lighting:new File(['bad'],'timecycp.dat'),water:new File(['water'],'water.dat')},owners)).toEqual(['lighting']);expect(owners.water.load).toHaveBeenCalledTimes(1);
});
test('invalid scene environment is rejected before any owner changes',async()=>{
 const owners=loaders();
 for(const value of [null,42,{lighting:'https://example.com/timecyc.dat'},{water:{}},{weather:23},{weather:NaN}])await expect(loadSceneEnvironment(value,owners)).rejects.toThrow('Invalid local');
 expect(owners.lighting.load).not.toHaveBeenCalled();expect(owners.water.load).not.toHaveBeenCalled();expect(owners.particle.load).not.toHaveBeenCalled();
});
