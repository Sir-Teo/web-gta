import {expect,test} from 'vitest';
import {Group,Mesh,MeshBasicMaterial,BoxGeometry} from 'three';
import reference from './fixtures/boat-components-reference.json';
import {BOAT_PROP_TURN,BOAT_COMPONENT_NAMES,boatPropellerStep,bindNativeBoatComponents} from '../src/render/nativeBoatComponents';
import {bindClumpAlpha} from '../src/render/nativeClumpAlpha';

for(const [i,r] of reference.cases.entries())test(`pinned executable propeller capture ${i}`,()=>{
 expect(boatPropellerStep(r.angle,r.engineSpeed,r.timeStep)).toEqual({angle:r.nextAngle,staticAlpha:r.staticAlpha,movingAlpha:r.movingAlpha});
});
test('boat frame roles match the executable descriptor names and node identities',()=>{
 const descriptors=new Map(reference.descriptors.map(d=>[d.name,d.node]));
 expect(Object.values(BOAT_COMPONENT_NAMES).map(name=>descriptors.get(name))).toEqual([1,3,6,7,8,9,10,11,4]);
});
function fixture(model=430){
 const root=new Group(),materials:MeshBasicMaterial[]=[],nodes:Record<string,Group>={};
 for(const [role,name] of Object.entries(BOAT_COMPONENT_NAMES)){
  const frame=new Group();frame.name=name;frame.matrixAutoUpdate=false;frame.matrix.makeRotationX(.7).scale({x:2,y:3,z:4} as any).setPosition(1,2,3);root.add(frame);nodes[role]=frame;
  const material=new MeshBasicMaterial({opacity:.4,transparent:true}),mesh=new Mesh(new BoxGeometry(1,1,1),material);mesh.userData.nativeAtomic=materials.length;frame.add(mesh);materials.push(material);
 }
 const component=bindNativeBoatComponents(root,model),apply=bindClumpAlpha(()=>materials.map(material=>({material})),component.opacity);
 return {root,nodes,materials,component,apply};
}
test('rudder and rear flaps replace their native Z basis, retain translation and do not accumulate rotation',()=>{
 const f=fixture();f.component.update(0,Math.PI/2,0);
 for(const role of ['rudder','rearLeft','rearRight']){const e=f.nodes[role].matrix.elements;expect(e.slice(12,15)).toEqual([1,2,3]);expect(e[1]).toBe(-1);expect(e[4]).toBe(1);expect(e[10]).toBe(1);}
 f.nodes.rudder.matrix.setPosition(4,5,6);f.component.update(0,0,0);expect(f.nodes.rudder.matrix.elements).toEqual([1,-0,0,0,0,1,0,0,0,0,1,0,4,5,6,1]);
});
test('static and blurred propellers counter-rotate with native Y signs and independent alpha',()=>{
 const f=fixture();f.component.update(.1,0,.02);f.apply(1);const angle=f.component.snapshot().angle;
 for(const [role,multiplier] of [['staticProp',2],['movingProp',-1],['staticProp2',-2],['movingProp2',1]] as const){const e=f.nodes[role].matrix.elements;expect(e[8]).toBe(Math.fround(Math.sin(Math.fround(angle*multiplier))));expect(e[5]).toBe(1);expect(e.slice(12,15)).toEqual([1,2,3]);}
 const expected=boatPropellerStep(0,.1,1);expect(f.materials[4].opacity).toBe(expected.staticAlpha/255);expect(f.materials[5].opacity).toBe(expected.movingAlpha/255);
});
test('component alpha replaces source alpha and composes with clump fade without compounding',()=>{
 const f=fixture();f.component.update(0,0,0);f.apply(.5);expect(f.materials[4].opacity).toBe(.5);expect(f.materials[5].opacity).toBe(0);expect(f.materials[1].opacity).toBe(.2);
 f.component.update(.34,0,.02);f.apply(.5);expect(f.materials[4].opacity).toBe(0);expect(f.materials[5].opacity).toBe(150/255*.5);
 f.apply(1);f.component.update(0,0,0);f.apply(1);expect(f.materials[4].opacity).toBe(1);expect(f.materials[5].opacity).toBe(0);expect(f.materials[1].opacity).toBe(.4);
});
test('node rendering changes only the last drawn atomic directly on the frame',()=>{
 const f=fixture(),extra=new MeshBasicMaterial(),mesh=new Mesh(new BoxGeometry(),extra),child=new Group(),childMaterial=new MeshBasicMaterial(),childMesh=new Mesh(new BoxGeometry(),childMaterial);mesh.userData.nativeAtomic=99;childMesh.userData.nativeAtomic=100;child.add(childMesh);f.nodes.staticProp.add(mesh,child);
 const component=bindNativeBoatComponents(f.root,430);component.update(.34,0,.02);expect(component.opacity(extra)).toBe(0);expect(component.opacity(f.materials[4])).toBeUndefined();expect(component.opacity(childMaterial)).toBeUndefined();
});
for(const model of [430,453,454])test(`model ${model} scans its native moving node one radian a game second`,()=>{
 const f=fixture(model);f.component.update(0,0,.5);expect(f.nodes.moving.matrix.elements[0]).toBe(1);expect(f.component.snapshot().scan).toBe(.5);f.component.update(0,0,.5);expect(f.nodes.moving.matrix.elements[1]).toBe(Math.fround(Math.sin(.5)));
});
test('other boat models retain their moving node and absent components are allowed',()=>{
 const f=fixture(452),before=f.nodes.moving.matrix.clone();f.component.update(0,0,.5);expect(f.nodes.moving.matrix.equals(before)).toBe(true);expect(f.component.snapshot().scan).toBe(0);expect(()=>bindNativeBoatComponents(new Group(),473).update(0,0,.02)).not.toThrow();
});
test('the native wrap retains exactly one turn until another positive step',()=>{
 expect(boatPropellerStep(BOAT_PROP_TURN,0,1).angle).toBe(BOAT_PROP_TURN);expect(boatPropellerStep(BOAT_PROP_TURN,.1,1).angle).toBeLessThan(1);
});

test('component rendering enables native material RGB modulation without changing source RGB or other parts',()=>{
 const f=fixture(),rgb=[.2,.4,.6];f.materials[4].userData.nativeFadeColor=rgb;bindNativeBoatComponents(f.root,430).update(.1,0,.02);expect(f.materials[4].color.toArray()).toEqual(rgb);expect(f.materials[1].color.toArray()).toEqual([1,1,1]);expect(rgb).toEqual([.2,.4,.6]);
});

test('propeller origins retain primary/secondary slots and follow the current model hierarchy',()=>{
 const f=fixture();f.root.position.set(10,20,30);f.root.rotation.z=Math.PI/2;f.nodes.staticProp2.matrix.setPosition(-1,2,3);const points=f.component.propellerPositions();expect(points[0]!.x).toBeCloseTo(8,12);expect(points[0]!.y).toBeCloseTo(21,12);expect(points[0]!.z).toBe(33);expect(points[1]!.x).toBeCloseTo(8,12);expect(points[1]!.y).toBeCloseTo(19,12);
 const root=new Group(),secondary=new Group();secondary.name=BOAT_COMPONENT_NAMES.staticProp2;root.add(secondary);expect(bindNativeBoatComponents(root,452).propellerPositions()).toEqual([undefined,{x:0,y:0,z:0}]);
});
