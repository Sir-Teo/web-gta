import {expect,test} from 'vitest';
import {GlassPanes,PANE_POLY_CENTERS,PANE_TYPE,isGlassDefinition,newGlassState,wasGlassHitByBullet,windowFrame,windowRespondsToCollision,windowRespondsToExplosion,windowRespondsToSoftCollision,glassAlphaWithNormal,paneHighlightAlpha,paneShatterAlpha,MAX_PANES} from '../src/simulation/nativeGlass';

test('glass windows are IDE flags 0x200 and 0x400, and their piece centres average the corners',()=>{
 expect(isGlassDefinition(0x200)).toBe(true);expect(isGlassDefinition(0x400|0x1)).toBe(true);expect(isGlassDefinition(0x100)).toBe(false);expect(isGlassDefinition(undefined)).toBe(false);
 expect(PANE_POLY_CENTERS[0][0]).toBeCloseTo(0.5);expect(PANE_POLY_CENTERS[0][1]).toBeCloseTo(1/6);
});
test('a 2 by 1.5 window throws 2 by 2 sections of four pieces, spread from the blow and delayed by distance under 300 damage',()=>{
 const panes=new GlassPanes(()=>0.5);
 const made=panes.generatePanesForWindow(PANE_TYPE.delayed,[10,20,5],[0,0,1.5],[2,0,0],[0,0.2,0],[11,20,5.75],0.1,true,false,1,false,1000,3);
 // Sections: min(floor(size + 0.75), 3) an axis, so 2 across and 2 up.
 expect(made).toBe(16);expect(panes.panes.length).toBe(16);
 const p=panes.panes[0];
 expect(p.size).toBeCloseTo(0.75);expect(p.right).toEqual([1,0,0]);expect(p.up).toEqual([0,0,0.75]);
 // The first piece of the first section sits at its centre inside the window and flies with the blow.
 expect(p.position[0]).toBeCloseTo(10+0.5);expect(p.position[2]).toBeCloseTo(5+0.75/6);
 expect(p.velocity[1]).toBeCloseTo(0.2+(64-64)*0.0015-0.1*0+0,1);
 expect(p.createdTime).toBeGreaterThanOrEqual(1000);expect(p.renderShatter).toBe(true);expect(p.groundZ).toBe(3);
 // One section only for the max1 flag; the pool holds 44.
 const one=new GlassPanes();expect(one.generatePanesForWindow(PANE_TYPE.default,[0,0,0],[0,0,3],[3,0,0],[0,0,0],[0,0,0],0,false,true,1,false,0,-1)).toBe(4);
 const full=new GlassPanes();for(let i=0;i<20;i++)full.generatePanesForWindow(PANE_TYPE.default,[0,0,0],[0,0,3],[3,0,0],[0,0,0],[0,0,0],0,false,false,1,false,0,-1);
 expect(full.panes.length).toBe(MAX_PANES);
});
test('panes fall under gravity, tumble, and vanish at the ground',()=>{
 const panes=new GlassPanes(()=>0.5);
 panes.generatePanesForWindow(PANE_TYPE.default,[0,0,2],[0,0,1],[1,0,0],[0,0.1,0],[0.5,0,2.5],0,false,true,1,false,0,0);
 const p=panes.panes[0],z0=p.position[2];
 panes.update(1,0);expect(p.velocity[2]).toBeCloseTo(-1/50);expect(p.position[2]).toBeCloseTo(z0);
 let landed=0;for(let i=0;i<400;i++)panes.update(1,i,()=>{landed++;});
 expect(panes.panes.length).toBe(0);expect(landed).toBe(4);
 // Delayed panes wait for their start time.
 const late=new GlassPanes(()=>0.5);late.generatePanesForWindow(PANE_TYPE.delayed,[0,0,2],[0,0,1],[1,0,0],[0,0,0],[5,0,2],0,false,true,1,false,0,0);
 const q=late.panes[0];late.update(1,0);expect(q.velocity[2]).toBe(0);late.update(1,q.createdTime);expect(q.velocity[2]).toBeCloseTo(-1/50);
});
test('the window frame comes from the collision quad and the responses follow CGlass',()=>{
 const frame=windowFrame([[0,0,0],[2,0,0],[2,0,3],[0,0,3]],v=>[v[0]+10,v[1]+20,v[2]+5])!;
 expect(frame.vert0).toEqual([10,20,5]);expect(frame.fwd).toEqual([0,0,3]);expect(frame.right).toEqual([2,0,0]);
 const state=newGlassState(),panes=new GlassPanes(()=>0.5);
 expect(wasGlassHitByBullet(state,()=>0)).toBe('crack');expect(state.hasBrokenGlass).toBe(true);
 expect(wasGlassHitByBullet(state,()=>0)).toBeUndefined();expect(wasGlassHitByBullet(state,()=>0.6)).toBe('break');
 expect(windowRespondsToCollision(state,panes,frame,100,[0,0.1,0],[11,20,6],false,0,4)).toBe(true);
 expect(state.brokenAltogether).toBe(true);expect(panes.panes.length).toBe(24);
 expect(windowRespondsToCollision(state,panes,frame,100,[0,0.1,0],[11,20,6],false,0,4)).toBe(false);
 const soft=newGlassState();expect(windowRespondsToSoftCollision(soft,40)).toBe(false);expect(windowRespondsToSoftCollision(soft,60)).toBe(true);expect(windowRespondsToSoftCollision(soft,60)).toBe(false);
 expect(windowRespondsToExplosion([0,0,0],[20,0,0])).toBe('crack');expect(windowRespondsToExplosion([0,0,0],[40,0,0])).toBeUndefined();
 const blast=windowRespondsToExplosion([5,0,0],[0,0,0]) as any;expect(blast.damageIntensity).toBe(10000);expect(blast.moveSpeed[0]).toBeCloseTo(0.3);expect(blast.max1Section).toBe(true);
});
test('pane alphas follow the reflection highlight, the 500 ms ramp and the 30 unit shatter fade',()=>{
 expect(glassAlphaWithNormal([0,0,1],[0,1,0])).toBeGreaterThanOrEqual(20);expect(glassAlphaWithNormal([0,0,1],[0,1,0])).toBeLessThanOrEqual(255);
 const p={piece:0,right:[1,0,0],up:[0,0,1],forward:[0,1,0],position:[0,0,0],velocity:[0,0,0],random:[0,0,0],createdTime:1000,groundZ:0,renderShatter:true,size:1,slow:false} as any;
 expect(paneHighlightAlpha(p,1000,[0,1,0])).toBe(0);expect(paneHighlightAlpha(p,1500,[0,1,0])).toBe(glassAlphaWithNormal([0,1,0],[0,1,0]));
 expect(paneHighlightAlpha({...p,slow:true},1000,[0,1,0])).toBe(64);
 expect(paneShatterAlpha(p,[0,0,0])).toBe(140);expect(paneShatterAlpha(p,[35,0,0])).toBe(70);expect(paneShatterAlpha(p,[45,0,0])).toBe(0);
});
