import {expect,test} from 'vitest';
import {MAX_VOLUMETRIC_CLOUDS,VOLUMETRIC_CLOUD_MODEL,VOLUMETRIC_QUAD_NORMALS,VolumetricCloudField,volumetricCloudAlpha,volumetricCloudColour,volumetricCloudDensity,volumetricCloudFader,volumetricCloudsMaxDistance,volumetricCloudsUsedNum} from '../src/world/nativeVolumetricClouds';

test('the model is three quads of two triangles that share two corners each, with the axis normals',()=>{
 expect(VOLUMETRIC_CLOUD_MODEL).toHaveLength(18);
 for(let quad=0;quad<3;quad++){
  const v=VOLUMETRIC_CLOUD_MODEL.slice(quad*6,quad*6+6);
  // The second triangle repeats the first's second and third corners.
  expect(v[3]).toEqual(v[1]);expect(v[5]).toEqual(v[2]);
  // Every corner is half a unit from the centre on the quad's own two axes, and flat on its normal.
  const normal=VOLUMETRIC_QUAD_NORMALS[quad];
  for(const p of v)expect(p.x*normal[0]+p.y*normal[1]+p.z*normal[2]).toBe(0);
 }
 expect(VOLUMETRIC_QUAD_NORMALS).toEqual([[0,1,0],[0,0,1],[1,0,0]]);
});
test('the used count follows the FX quality, and the draw distance is the far clip capped at 600',()=>{
 expect(volumetricCloudDensity('high')).toBe(1);expect(volumetricCloudDensity('veryHigh')).toBe(1);expect(volumetricCloudDensity('low')).toBe(.5);expect(volumetricCloudDensity('medium')).toBeCloseTo(1/3,9);
 expect(volumetricCloudsUsedNum(1)).toBe(MAX_VOLUMETRIC_CLOUDS);expect(volumetricCloudsUsedNum(.5)).toBe(90);expect(volumetricCloudsUsedNum(1/3)).toBe(60);expect(volumetricCloudsUsedNum(0)).toBe(0);
 expect(volumetricCloudsMaxDistance(1000)).toBe(600);expect(volumetricCloudsMaxDistance(450)).toBe(450);
});
test('the grey is the six sky channels averaged plus 64, capped at 255',()=>{
 expect(volumetricCloudColour([0,0,0],[0,0,0])).toBe(64);
 expect(volumetricCloudColour([120,120,120],[60,60,60])).toBe(154);
 expect(volumetricCloudColour([255,255,255],[255,255,255])).toBe(255);
});
test('the height fader climbs under 220 units until the pass is skipped and falls again above it',()=>{
 expect(volumetricCloudFader(0,300,1)).toEqual({fader:0,skip:false});
 expect(volumetricCloudFader(100,300,2)).toEqual({fader:92,skip:false});
 expect(volumetricCloudFader(0,100,1)).toEqual({fader:4,skip:false});
 expect(volumetricCloudFader(254,100,1)).toEqual({fader:255,skip:true});
 // Without the switch there is no fade at any height.
 expect(volumetricCloudFader(200,10,1,false)).toEqual({fader:0,skip:false});
});
test("a cloud's alpha loses the fader and fades over the last hundred units of the draw distance",()=>{
 expect(volumetricCloudAlpha(128,0,100,600)).toBe(128);
 expect(volumetricCloudAlpha(128,40,100,600)).toBe(88);
 expect(volumetricCloudAlpha(128,200,100,600)).toBe(0);
 expect(volumetricCloudAlpha(128,0,500,600)).toBe(128);
 expect(volumetricCloudAlpha(128,0,550,600)).toBe(64);
 expect(volumetricCloudAlpha(128,0,599,600)).toBe(1);
 expect(volumetricCloudAlpha(128,0,601,600)).toBe(0);
});
test('a moved camera adds five clouds ahead of the anchor, and clouds past the draw distance are dropped',()=>{
 const field=new VolumetricCloudField(()=>.5);
 const frame={cameraPos:[0,0,300] as const,playerPos:[0,0,300] as const,anchorPos:[0,0,300] as const,anchorForward:[0,1,0] as const,
  skyTop:[120,120,120] as const,skyBottom:[60,60,60] as const,windDir:[0,0] as const,timeStep:1,farClip:1000};
 // The first frame counts as moved (there is no previous position) and creates five ahead of the anchor at the
 // creation distance, the draw distance plus 200, so they start out of range and draw nothing.
 expect(field.update(frame)).toHaveLength(0);
 expect(field.snapshot()).toMatchObject({used:5,usedNum:MAX_VOLUMETRIC_CLOUDS,maxDistance:600,colour:154});
 expect(field.clouds[0].pos[1]).toBe(800);
 // Standing still adds none, and a cloud that reached the creation distance without coming into range goes.
 expect(field.update(frame)).toHaveLength(0);
 expect(field.snapshot().used).toBe(0);
});
test('clouds around the camera draw three quads whose alphas follow the direction to the camera',()=>{
 const field=new VolumetricCloudField(()=>.5);
 const frame={cameraPos:[0,0,300] as const,playerPos:[0,0,300] as const,anchorPos:[0,0,300] as const,anchorForward:[0,1,0] as const,
  skyTop:[120,120,120] as const,skyBottom:[60,60,60] as const,windDir:[0,0] as const,timeStep:1,farClip:1000};
 field.update(frame);
 // VolumetricClouds_Create without a point fills every slot around the camera inside the draw distance.
 field.createAround([0,0,300],field.maxDistance);
 expect(field.snapshot().used).toBe(MAX_VOLUMETRIC_CLOUDS);
 // Put one cloud straight north of the camera: only the quad whose normal points north catches the full alpha.
 field.clouds[0].pos=[0,100,300];
 const draws=field.update(frame);
 expect(draws.length).toBeGreaterThan(0);
 const north=draws[0];
 expect(north.quadAlpha[0]).toBe(field.clouds[0].alpha);
 expect(north.quadAlpha[1]).toBe(0);expect(north.quadAlpha[2]).toBe(0);
 // A cloud on the diagonal splits its alpha between two quads.
 field.clouds[0].pos=[100,100,300];
 const diagonal=field.update(frame)[0];
 expect(diagonal.quadAlpha[0]).toBeGreaterThan(0);expect(diagonal.quadAlpha[2]).toBe(diagonal.quadAlpha[0]);
 expect(diagonal.quadAlpha[0]).toBeLessThan(field.clouds[0].alpha);
});
test('below the switch height the field draws nothing once the fader has run out',()=>{
 const field=new VolumetricCloudField(()=>.5);
 const ground={cameraPos:[0,0,10] as const,playerPos:[0,0,10] as const,anchorPos:[0,0,10] as const,anchorForward:[0,1,0] as const,
  skyTop:[120,120,120] as const,skyBottom:[60,60,60] as const,windDir:[0,0] as const,timeStep:64,farClip:1000};
 for(let i=0;i<4;i++)expect(field.update(ground)).toHaveLength(0);
 expect(field.snapshot().fader).toBe(255);
 // An interior draws nothing at all.
 expect(field.update({...ground,cameraPos:[0,0,400],outside:false})).toHaveLength(0);
});
