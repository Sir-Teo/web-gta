import {expect,test} from 'vitest';
import {headlightBeam,HEADLIGHT_BEAM_LENGTH} from '../src/render/HeadlightBeams';
test('a headlight beam is a 3-unit fan from the lamp, faded at the far edge, brightest seen from the side and gone head-on',()=>{
 const point={x:0,y:1,z:0},forward={x:0,y:0,z:-1},up={x:0,y:1,z:0};
 const side=headlightBeam({point,forward,up,camera:{x:10,y:1,z:0}});
 expect(side.positions.length).toBe(36);expect(side.colors.length).toBe(48);
 const alphas=[...new Set(side.colors.filter((_,i)=>i%4===3))].sort((a,b)=>a-b);expect(alphas).toEqual([0,32]);
 // The far corners lie 3 units along the forward tilted down by 0.15.
 // Vertex 6 of the index list is the far left corner: 0.1 behind the lamp, 3 along the tilted normal, 0.5 to the left
 // of the beam's right axis (cross(normal, lamp→camera)).
 const far=side.positions.slice(6*3,6*3+3),n=Math.hypot(1,.15);expect(far[2]).toBeCloseTo(.1-3/n-.5*(.15/n),3);expect(far[1]).toBeCloseTo(1-3*.15/n+.5/n,3);
 const ahead=headlightBeam({point,forward,up,camera:{x:0,y:1,z:-10}});expect(ahead.positions.length).toBe(0);
 expect(HEADLIGHT_BEAM_LENGTH).toBe(3);
});
