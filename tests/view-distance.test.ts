import {expect,test} from 'vitest';
import {setViewDistance,viewDistanceShare} from '../src/render/lodDistance';

test('the Low preset draws the view in with Draw Distance; every other preset keeps it all',()=>{
 setViewDistance(true,20);expect(viewDistanceShare()).toBeCloseTo(.6);
 setViewDistance(true,0);expect(viewDistanceShare()).toBe(.5);
 setViewDistance(true,100);expect(viewDistanceShare()).toBe(1);
 setViewDistance(false,20);expect(viewDistanceShare()).toBe(1);
});
