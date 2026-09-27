import {expect,test} from 'vitest';
import {FrontendMapView,FRONTEND_MAP_FIT,FRONTEND_MAP_ZOOM_MAX,FRONTEND_MAP_WHEEL_STEP} from '../src/ui/frontendMapView';
test('the map opens whole, zooms about the frame centre to the original 1100 and never shows past its edge',()=>{
 const v=new FrontendMapView();expect(v.window).toEqual({x:0,y:0,span:1});
 v.zoom(-50);expect(v.half).toBe(FRONTEND_MAP_FIT);
 v.zoom(FRONTEND_MAP_WHEEL_STEP);expect(v.half).toBe(FRONTEND_MAP_FIT+28);expect(v.cx).toBe(.5);
 v.zoom(10000);expect(v.half).toBe(FRONTEND_MAP_ZOOM_MAX);
 // Panning right by the frame moves the view by the map fraction those lines cover, and stops at the edge.
 v.pan(7,0);expect(v.cx).toBeCloseTo(.5+7/2200,10);v.pan(1e6,-1e6);const r=.5/v.magnification;expect(v.cx).toBeCloseTo(1-r,10);expect(v.cy).toBeCloseTo(r,10);
 // Frame and map fractions convert both ways.
 const m=v.toMap(.25,.75),f=v.toFrame(m.x,m.y);expect(f.x).toBeCloseTo(.25,10);expect(f.y).toBeCloseTo(.75,10);
 // Zooming back out to the fit re-centres the whole map.
 v.zoom(-10000);expect(v.window).toEqual({x:0,y:0,span:1});
});
