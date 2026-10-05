import {expect,test} from 'vitest';
import {NativeBirds,birdVertices,birdMaxDistance,type BirdWorld} from '../src/world/nativeBirds';

const world=(over:Partial<BirdWorld>={}):BirdWorld=>({camera:[100,200,10],forward:[0,1,0],area:0,hour:12,distanceToWater:100,desert:false,waterLevel:()=>undefined,lineOfSightClear:()=>true,...over});
/** A fixed sequence standing in for rand(). */
const sequence=(values:number[])=>{let i=0;return ()=>values[i++%values.length];};

test('CBirds::Update starts a flock on frame 6 of every 512 by day in the outside world', () => {
 const birds=new NativeBirds(sequence([32767,0,0,1,64,5,100,200,300]));
 birds.update(world(),5,1/30);expect(birds.count).toBe(0);
 birds.update(world({hour:22}),6,1/30);birds.update(world({area:3}),6,1/30);expect(birds.count).toBe(0);
 birds.update(world(),6,1/30);
 expect(birds.count).toBeGreaterThan(0);
 const [first]=birds.birds.filter(b=>b.created);
 // A normal flock: 40 units from the camera, 2–10 units above it, flying at 5–5.6 units a second.
 expect(Math.hypot(first.position[0]-100,first.position[1]-200)).toBeCloseTo(40,0);
 expect(first.position[2]-10).toBeGreaterThanOrEqual(2);expect(first.position[2]-10).toBeLessThanOrEqual(10.1);
 expect(Math.hypot(...first.targetVelocity)).toBeGreaterThanOrEqual(5);expect(Math.hypot(...first.targetVelocity)).toBeLessThanOrEqual(5.61);
 expect(first.size).toBeGreaterThanOrEqual(.5);expect(first.size).toBeLessThanOrEqual(.6);
});

test('a desert flock only replaces birds already flying, and a blocked view creates none', () => {
 const birds=new NativeBirds(sequence([1000,7,3]));
 birds.update(world({desert:true}),6,1/30);expect(birds.count).toBe(0);
 birds.update(world({lineOfSightClear:()=>false}),6+512,1/30);expect(birds.count).toBe(0);
 expect(birdMaxDistance('water')).toBe(45);expect(birdMaxDistance('desert')).toBe(80);
});

test('birds fly on, leave past their distance and fall to a bullet', () => {
 const birds=new NativeBirds(sequence([9000,1,2,3,4,5]));
 birds.createNumberOfBirds([0,0,20],[10,0,20],2,'normal',false,world());
 expect(birds.count).toBe(2);
 const [a,b]=birds.birds;expect(a.angle).toBeCloseTo(Math.PI/2);
 // The formation: the second bird sits (-1, -1, +0.5) off the first.
 expect(b.position).toEqual([-1,-1,20.5]);
 birds.update(world({camera:[0,0,20]}),1,1);expect(a.position[0]).toBeGreaterThan(4.9);
 birds.handleGunShot([a.position[0],a.position[1]-5,a.position[2]],[a.position[0],a.position[1]+5,a.position[2]]);
 expect(a.created).toBe(false);expect(birds.count).toBe(1);expect(birds.shot).toBeDefined();
 // The bird checked this frame (frame % 6) is removed once 40 units away in 2D.
 birds.update(world({camera:[500,0,20]}),1,1/30);expect(b.created).toBe(false);expect(birds.count).toBe(0);
});

test('CBirds::Render builds two mirrored wings, fading over the last 30% of the distance', () => {
 const birds=new NativeBirds(sequence([9000,1,2,3,4,5]));
 birds.createNumberOfBirds([0,0,20],[0,10,20],1,'normal',false,world());
 const bird=birds.birds[0],near=birdVertices(bird,0,0,[0,-5,20]);
 expect(near.positions).toHaveLength(48);expect(near.colors[3]).toBe(255);
 // The mirror half is 0.8 as bright and flipped across the bird's forward axis.
 expect(near.colors[8*4]).toBe(Math.trunc(near.colors[0]*.8));
 expect(near.positions[2*3]).toBeCloseTo(-near.positions[(8+2)*3]);
 const far=birdVertices(bird,0,0,[0,-37,20]);expect(far.colors[3]).toBeLessThan(255);expect(far.colors[3]).toBeGreaterThan(0);
});
