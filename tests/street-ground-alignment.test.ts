import{test,expect,beforeAll}from'vitest';
import RAPIER from'@dimforge/rapier3d-compat';
import{Simulation}from'../src/simulation/Simulation';
import{STREET_SURFACES,streetSurfaceTriangles}from'../src/world/streetSurfaces';
beforeAll(async()=>{await RAPIER.init();});
test('authored road collision triangles share the rendered elevations and circle outlines',()=>{
 const sim=new Simulation();
 try{
  for(const surface of STREET_SURFACES){
   const collider=sim.staticColliders.get(surface.id)!;
   expect(collider.translation().y).toBeCloseTo(surface.y,6);
   const {vertices,indices}=streetSurfaceTriangles(surface);
   for(let i=0;i<indices.length;i+=3){
    const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
    expect((vertices[b+2]-vertices[a+2])*(vertices[c]-vertices[a])-(vertices[b]-vertices[a])*(vertices[c+2]-vertices[a+2])).toBeGreaterThan(0);
   }
   expect(vertices.filter((_,i)=>i%3===1).every(y=>y===0)).toBe(true);
  }
 }finally{sim.dispose();}
});
test('standing feet settle above the rendered turning-head road, not the old underlying floor',()=>{
 const sim=new Simulation();
 const controls={x:0,y:0,cameraYaw:0,sprint:false,jump:false,handbrake:false};
 try{
  for(let i=0;i<120;i++)sim.step(1/60,controls);
  expect(sim.player.grounded).toBe(true);
  expect(sim.player.position.y).toBeGreaterThan(.02);
  expect(sim.player.position.y).toBeLessThan(.06);
  const shape=sim.playerCollider.shape as RAPIER.Capsule;
  expect(shape.halfHeight+shape.radius).toBeCloseTo(sim.playerCenterHeight,6);
 }finally{sim.dispose();}
});
