import {expect,test} from 'vitest';
import {NativeAudioEnvironment,SOUND,type NativeAudioEntity,type NativeCamera,type NativeSound} from '../src/audio/native/NativeSound';
import {NativeSoundManager,type NativeBankSlots,type NativeBankSound} from '../src/audio/native/NativeSoundManager';
import {NativeBankLoader,SLOT,type NativeBankManifest} from '../src/audio/native/NativeBankLoader';
import {NativeAudioEngine,NATIVE_AUDIO_FRAME_MS} from '../src/audio/native/NativeAudioEngine';
import {NativeTwinLoopSound} from '../src/audio/native/NativeTwinLoopSound';
import {AE_STATE,type NativeVehicleAudioInput} from '../src/audio/native/NativeVehicleAudio';
import {NativeHornInput} from '../src/audio/native/nativeHornInput';
const camera=(x=0,y=0,z=0):NativeCamera=>({position:{x,y,z},right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1},firstPerson:false,justSwitched:false});
const flush=()=>new Promise(r=>setTimeout(r,0));
/** Fake CAEBankSlot contents: every slot answers with a 1 s sound at 8 kHz, looping unless the id is 99. */
const slots:NativeBankSlots={isSoundBankLoaded:()=>true,sound:(_slot,id)=>id<0?undefined:{samples:new Float32Array(8000),sampleRate:8000,headroom:0,loopStart:id===99?-1:0}};
test('CAEAudioEnvironment attenuation, directional mike, camera space and doppler',()=>{
 const env=new NativeAudioEnvironment();env.camera=camera();
 expect(NativeAudioEnvironment.distanceAttenuation(4.9)).toBe(0);
 expect(NativeAudioEnvironment.distanceAttenuation(5)).toBeCloseTo(-.38,5);
 expect(NativeAudioEnvironment.distanceAttenuation(128)).toBe(-100);
 expect(NativeAudioEnvironment.directionalMikeAttenuation({x:0,y:1,z:0})).toBe(0);
 expect(NativeAudioEnvironment.directionalMikeAttenuation({x:0,y:-1,z:0})).toBe(-6);
 expect(NativeAudioEnvironment.directionalMikeAttenuation({x:1,y:0,z:0})).toBeCloseTo(-3,5);
 // Without a player the listener is pulled 0 units forward; an eastern sound is on the right.
 expect(env.positionRelativeToCamera({x:10,y:0,z:0})).toEqual({x:10,y:0,z:0});
 expect(env.dopplerRelativeFrequency(20,10,0,1000,1)).toBeCloseTo(340/330,5);
 expect(env.dopplerRelativeFrequency(10,10,0,1000,1)).toBe(1);
});
test('CAESoundManager keeps the loudest sounds physical and finishes one-shots through UpdateParameters',()=>{
 const env=new NativeAudioEnvironment();env.camera=camera();
 const manager=new NativeSoundManager(env,slots,()=>.5);
 for(let i=0;i<60;i++)manager.playSound({slot:19,sound:1,position:{x:0,y:5+i*2,z:0},volume:0,rollOff:1});
 manager.service(0);manager.service(33);
 const active=manager.sounds.filter(s=>s.inUse),physical=active.filter(s=>s.physicallyPlaying),virtual=active.filter(s=>!s.physicallyPlaying);
 expect(physical).toHaveLength(47);expect(virtual).toHaveLength(13);
 expect(Math.min(...physical.map(s=>s.listenerVolume))).toBeGreaterThanOrEqual(Math.max(...virtual.map(s=>s.listenerVolume)));
 manager.reset();manager.service(66);manager.service(99);
 expect(manager.sounds.filter(s=>s.inUse)).toHaveLength(0);
 const finished:number[]=[],entity:NativeAudioEntity={updateParameters:(_s,pos)=>{finished.push(pos);}};
 const shot=manager.playSound({slot:19,sound:99,entity,position:{x:0,y:3,z:0},volume:0,flags:SOUND.requestUpdates})!;
 for(let t=132;t<1400;t+=33)manager.service(t);
 expect(shot.inUse).toBe(false);expect(finished.at(-1)).toBe(-1);
});
test('RescaleChannelVolumes normalises the loudest channel to 0 dB and releases 1.2 dB per frame',()=>{
 const env=new NativeAudioEnvironment();env.camera=camera();
 const outputs:number[]=[];
 const manager=new NativeSoundManager(env,slots,()=>.5,47,{play(){},stop(){},update(_c,db){outputs.push(db);}});
 const loud=manager.playSound({slot:19,sound:1,position:{x:0,y:1,z:0},volume:6})!;
 manager.service(0);outputs.length=0;manager.service(33);
 expect(outputs[0]).toBeCloseTo(0,4);
 loud.volume=-6;outputs.length=0;manager.service(66);
 // Previous max 6 dB releases to 4.8 dB, so -6 dB plays at -10.8 dB.
 expect(outputs[0]).toBeCloseTo(-10.8,3);
});
test('CAETwinLoopSoundEntity moves the audible volume to the other loop when the swap time passes',()=>{
 const env=new NativeAudioEnvironment();env.camera=camera();
 const manager=new NativeSoundManager(env,slots,()=>0);
 const twin=new NativeTwinLoopSound(manager,()=>0);
 twin.initialise(19,24,25,200,1000);twin.playTwinLoopSound({x:0,y:2,z:0},-3,1,2.5);
 const [a,b]=twin.sounds;expect(a!.volume).toBe(-3);expect(b!.volume).toBe(-100);
 for(let t=0;t<=300;t+=33)manager.service(t);
 expect(a!.volume).toBe(-100);expect(b!.volume).toBe(-3);
});
function syntheticBank(count:number,loop=true){
 const samples=800,bytes=new Uint8Array(4804+count*samples*2),view=new DataView(bytes.buffer);view.setUint16(0,count,true);
 for(let i=0;i<count;i++){const e=4+i*12;view.setUint32(e,i*samples*2,true);view.setUint32(e+4,loop?0:0xffffffff,true);view.setUint16(e+8,8000,true);view.setInt16(e+10,0,true);}
 return {bytes,dataBytes:count*samples*2};
}
function engine(){
 const banks=new Map<number,ReturnType<typeof syntheticBank>>();
 const manifest:NativeBankManifest={version:1,packageSha256:'',banks:[]};
 const counts:Record<number,number>={13:2,27:24,39:72,52:5,59:31,74:14,105:16,138:45,143:89};
 for(let id=0;id<=143;id++){const b=syntheticBank(counts[id]??6);banks.set(id,b);manifest.banks.push({id,path:`bank-${id}.bin`,dataBytes:b.dataBytes,bytes:b.bytes.length,sounds:16,sha256:''});}
 const loader=new NativeBankLoader(manifest,async entry=>banks.get(entry.id)!.bytes);
 let n=0;return new NativeAudioEngine(loader,undefined,()=>((n++*.6180339)%1));
}
const car=(over:Partial<NativeVehicleAudioInput>={}):NativeVehicleAudioInput=>({position:{x:0,y:10,z:0},right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1},moveSpeed:{x:0,y:0,z:0},status:'physics',
 playerDriver:false,playerInVehicle:false,playerAlive:true,engineOn:true,gasPedal:0,brakePedal:0,handbrake:false,gear:1,padAccelerate:0,padBrake:0,health:1000,drowning:false,underwater:false,towing:false,
 horn:{counter:0,pattern:0},sirenOrAlarm:false,alarmState:0,
 transmission:{driveType:'R',maxVelocity:.8,maxReverseVelocity:-.2,numberOfGears:5,gears:[{maxVelocity:-.2,changeUpVelocity:-.01,changeDownVelocity:-.2},...[1,2,3,4,5].map(g=>({maxVelocity:.16*g,changeUpVelocity:.14*g,changeDownVelocity:.1*g}))]},
 wheels:{states:['normal','normal','normal','normal'],counts:[4,4,4,4],contactWheels:4,driveOnGround:2,driveOnGroundLastFrame:2,spinForAudio:0,burst:[false,false,false,false]},contactSurface:{grass:false,wet:false},...over});
async function frames(e:NativeAudioEngine,key:object,model:number,input:()=>NativeVehicleAudioInput,count:number){
 for(let i=0;i<count;i++){e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[[key,model,input()]]}));await flush();}
}
test('dummy car engines start, crossfade idle into cruise and keep sounding after stopping again',async()=>{
 const e=engine(),key={},input=car();await flush();
 await frames(e,key,596,()=>input,4);
 const audio=e.vehicle(key,596)!;
 expect(audio.state).toBe(AE_STATE.dummyId);expect(audio.engineSounds[2]?.sound).toBe(1);
 expect(e.manager.sounds.some(s=>s.inUse&&s.slot===SLOT.vehicleGen&&s.sound===0x25)).toBe(true);
 input.moveSpeed={x:0,y:.4,z:0};await frames(e,key,596,()=>input,30);
 expect(audio.state).toBe(AE_STATE.dummyCrz);expect(audio.engineSounds[1]?.sound).toBe(0);expect(audio.engineSounds[2]).toBeUndefined();
 input.moveSpeed={x:0,y:0,z:0};await frames(e,key,596,()=>input,30);
 expect(audio.state).toBe(AE_STATE.dummyId);expect(audio.engineSounds[2]?.inUse).toBe(true);
 input.moveSpeed={x:0,y:.4,z:0};await frames(e,key,596,()=>input,30);
 expect(audio.engineSounds[1]?.inUse).toBe(true);
});
test('sirens, AI horn patterns and the player siren toggle',async()=>{
 const e=engine(),key={},input=car({sirenOrAlarm:true});await flush();
 await frames(e,key,596,()=>input,3);
 const audio=e.vehicle(key,596)!;
 expect(audio.sirenSound?.sound).toBe(10);
 input.horn.counter=45;await frames(e,key,596,()=>input,2);
 expect(audio.fastSirenSound?.sound).toBe(11);expect(audio.sirenSound).toBeUndefined();
 const civilian={},horn=car();await frames(e,civilian,400,()=>horn,2);
 let heard=false;horn.horn.counter=45;
 for(let i=0;i<44&&!heard;i++){await frames(e,civilian,400,()=>horn,1);heard||=!!e.vehicle(civilian,400)!.hornSound;horn.horn.counter--;}
 expect(heard).toBe(true);
 const pad=new NativeHornInput(),vehicle={horn:{counter:0},siren:false};
 for(const held of [true,true,false,false,false])pad.process(vehicle,held,true);
 expect(vehicle.siren).toBe(true);
 for(const held of [true,true,true,true,true])pad.process(vehicle,held,true);
 expect(vehicle.horn.counter).toBe(1);
});
test("Mr Whoopee's siren is its tune from its own bank, once the player drives it and that bank is in",async()=>{
 const e=engine(),key={},dummy=car({sirenOrAlarm:true});await flush();
 await frames(e,key,423,()=>dummy,4);
 const audio=e.vehicle(key,423)!;
 expect(audio.sirenSound).toBeUndefined();
 // Like any siren it starts as it is switched on, so the chimes come with the next press once the bank is in.
 const driven=car({sirenOrAlarm:false,status:'player',playerDriver:true,playerInVehicle:true});
 await frames(e,key,423,()=>driven,20);
 driven.sirenOrAlarm=true;await frames(e,key,423,()=>driven,2);
 expect(audio.sirenSound?.sound).toBe(3);expect(audio.sirenSound?.slot).toBe(SLOT.playerEngine);
});
test('the player car loads its engine bank and accelerates through PLAYER_AC_FULL',async()=>{
 const e=engine(),key={},input=car({status:'player',playerDriver:true,playerInVehicle:true});await flush();
 await frames(e,key,492,()=>input,3);
 const audio=e.vehicle(key,492)!;
 expect(e.bank.isSoundBankLoaded(95,SLOT.playerEngine)).toBe(true);
 expect(audio.state).toBe(AE_STATE.playerId);
 input.padAccelerate=1;input.gasPedal=1;input.moveSpeed={x:0,y:.2,z:0};input.gear=1;
 await frames(e,key,492,()=>{input.moveSpeed={x:0,y:input.moveSpeed.y+.004,z:0};return input;},8);
 expect(audio.state).toBe(AE_STATE.playerAcFull);
 const ac=audio.engineSounds[4]!;expect(ac.slot).toBe(SLOT.playerEngine);expect(ac.sound).toBe(0);
});
test('player helicopter rotors and weather rain loops',async()=>{
 const e=engine(),key={};await flush();
 const heli=car({status:'player',playerDriver:true,playerInVehicle:true,rotorSpeed:.22,padAccelerate:1,transmission:undefined,wheels:undefined});
 await frames(e,key,487,()=>heli,6);
 const audio=e.vehicle(key,487)!;
 expect([1,2,3,4].map(i=>audio.engineSounds[i]?.sound)).toEqual([3,0,3,1]);
 expect(audio.currentRotorFrequency).toBeGreaterThan(1);
 for(let i=0;i<40;i++){e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[],weather:{rain:1,windClipped:.5,lightningDuration:0,noRain:false,outside:true,cameraZ:10}}));await flush();}
 // Rain starts from -50 dB and steps 0.5 dB per frame toward the default event volume.
 expect(e.weather.snapshot().rainLoops).toBe(2);expect(e.weather.rainVolume).toBe(-30);
 expect(e.manager.sounds.some(s=>s.inUse&&s.slot===SLOT.frontendGame&&s.sound===29)).toBe(true);
});
test('gunshots layer dry, low, stereo front-end and tail sounds by camera distance',async()=>{
 const e=engine();await flush();
 const shots=()=>e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.weaponGen);
 e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));
 e.combat('fire',22,{x:0,y:3,z:0},'npc');
 const near=shots();
 expect(near.map(s=>s.sound).sort((a,b)=>a-b)).toEqual([6,6,7,7,8,8,52,53]);
 const front=near.filter(s=>s.has(SOUND.frontEnd)&&s.sound===6)[0];
 // Within 5 units the positional shot drops 3 dB and the front-end copy carries the near-field level.
 expect(front.volume).toBeCloseTo(-3,5);expect(front.currPos).toEqual({x:-1,y:0,z:0});
 const tail=near.filter(s=>s.sound===8);expect(tail.every(s=>s.has(SOUND.rolledOff))).toBe(true);
 e.manager.reset();for(let i=0;i<3;i++){e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));await flush();}
 e.combat('fire',31,{x:0,y:40,z:0},'npc');
 const far=shots();expect(far.find(s=>s.has(SOUND.frontEnd)&&s.sound===3)?.volume).toBe(-100);
 e.combat('explosion',0,{x:0,y:20,z:0},'player');
 const boom=e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.explosions);
 expect(boom.map(s=>s.sound).sort()).toEqual([1,1,2,3,4]);
});
test('player footsteps use the surface bank once its slot has loaded and chainsaw idles in the engine slot',async()=>{
 const e=engine();e.setPlayer(()=>({x:0,y:1,z:0}));await flush();
 const grass={concrete:false,grass:true,sand:false,gravel:false,wood:false,water:false,metal:false,longGrass:false,tile:false};
 e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));
 e.footstep('run',false,grass);
 expect(e.manager.sounds.filter(s=>s.inUse).map(s=>s.slot)).toEqual([41]);
 await flush();e.footstep('run',false,grass);
 const step=e.manager.sounds.filter(s=>s.inUse&&s.slot===30);expect(step).toHaveLength(1);expect(step[0].volume).toBe(-6);expect(step[0].speed).toBe(1.1);
 for(let i=0;i<4;i++){e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[],player:{weapon:9,onFoot:true,attacking:false}}));await flush();}
 expect(e.manager.sounds.some(s=>s.inUse&&s.slot===SLOT.playerEngine&&s.sound===1)).toBe(true);
});
test('pedestrian footsteps play the generic bank at the ped with DoFootLanded levels',async()=>{
 // The player's CAEPedAudioEntity has already loaded FEET_GENERIC into its slot.
 const e=engine();e.setPlayer(()=>({x:0,y:1,z:0}));await flush();e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));
 const walker={},runner={};
 e.pedFootstep(walker,{x:3,y:4,z:0},'walk','right');e.pedFootstep(runner,{x:-5,y:0,z:0},'sprint','left');
 const steps=e.manager.sounds.filter(s=>s.inUse&&s.slot===41);
 expect(steps.map(s=>[s.volume,s.speed,s.sound>=1&&s.sound<=5])).toEqual([[-12,.9,true],[0,1.2,true]]);
 // The entity keeps following the pedestrian that owns it.
 e.pedFootstep(walker,{x:30,y:4,z:0},'run','left');expect(e.manager.sounds.filter(s=>s.inUse&&s.slot===41).at(-1)!.volume).toBe(-6);
});
test('vehicles falling into water report a splash pair once per splash',async()=>{
 const e=engine();await flush();e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));
 const plane={},splashes=()=>e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.collisions&&(s.sound===66||s.sound===67));
 // Settling on the surface is silent; a fall faster than 0.1 units per frame splashes.
 e.vehicleWaterSplash(plane,{x:0,y:10,z:0},{x:0,y:0,z:-.05});expect(splashes()).toHaveLength(0);
 e.vehicleWaterSplash(plane,{x:0,y:10,z:0},{x:0,y:0,z:-.3});
 expect(splashes().map(s=>[s.sound,s.event,+s.volume.toFixed(2),s.speed,s.rollOff])).toEqual([[67,1,-10.46,.94,2.5],[66,3,-10.46,.94,2.5]]);
 // While its own splash plays, the vehicle does not start another.
 e.vehicleWaterSplash(plane,{x:0,y:10,z:0},{x:0,y:0,z:-.5});expect(splashes()).toHaveLength(2);
 e.vehicleWaterSplash({},{x:5,y:10,z:0},{x:0,y:0,z:-2});expect(splashes().at(-1)!.volume).toBeCloseTo(-4.44,2);
});
test('hull wave hits play the splash end at clamp(volume/800), throttled per hull',async()=>{
 const e=engine();await flush();e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));
 const hull={},waves=()=>e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.collisions&&s.sound===66&&s.event===-1);
 e.collisions.reportBoatWaveHit(hull,{x:0,y:5,z:0},400);expect(waves()).toHaveLength(0);
 e.collisions.reportBoatWaveHit(hull,{x:0,y:5,z:0},600);
 expect(waves()).toHaveLength(1);expect(waves()[0].volume).toBeCloseTo(-2.5,1);
 // Immediate repeats are throttled; after 1500 ms it sounds again.
 e.collisions.reportBoatWaveHit(hull,{x:0,y:5,z:0},800);expect(waves()).toHaveLength(1);
 for(let i=0;i<50;i++)e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));await flush();
 e.collisions.reportBoatWaveHit(hull,{x:0,y:5,z:0},800);expect(waves()).toHaveLength(2);
});
test('collision impacts start later in the sample for soft hits, scrape while contact continues and bullet hits follow SURFAUD classes',async()=>{
 const e=engine();await flush();
 const flags=(o:Partial<Record<string,boolean>>)=>({concrete:false,grass:false,sand:false,gravel:false,wood:false,water:false,metal:false,longGrass:false,tile:false,...o});
 e.surfaceAudio=new Map([[1,flags({concrete:true})],[63,flags({metal:true})]]);
 e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));
 const car={key:{},surface:63,vehicle:{up:{x:0,y:0,z:1},moveSpeed:{x:.3,y:0,z:0},turnSpeed:{x:0,y:0,z:0}}},wall={key:7,surface:1,building:true};
 // Impulse 0.1 units/frame: car offset 50 starts COLCAR at 50%; the concrete side (ParamD 100, max start 70) starts at 50%.
 e.collisions.reportCollision(car,wall,{x:0,y:5,z:0},{x:-1,y:0,z:0},.1,1);
 const hits=e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.collisions);
 expect(hits.map(s=>[s.sound>=20&&s.sound<=28?'car':s.sound,s.playTime]).sort()).toEqual([[34,50],['car',50]]);
 // A second report in the same game frame is the same collision; the next frame's turns it into a scrape.
 e.collisions.reportCollision(car,wall,{x:0,y:5,z:0},{x:-1,y:0,z:0},.1,1);
 expect(e.manager.sounds.some(s=>s.inUse&&s.slot===SLOT.collisions&&s.sound===2)).toBe(false);
 e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));await flush();
 e.collisions.reportCollision(car,wall,{x:0,y:5,z:0},{x:-1,y:0,z:0},.1,1);
 const scrape=e.manager.sounds.find(s=>s.inUse&&s.slot===SLOT.collisions&&s.sound===2);
 expect(scrape).toBeDefined();
 for(let i=0;i<6;i++){e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));await flush();}
 expect(scrape!.requestedStop).toBe(true);
 e.collisions.reportBulletHit(1,{x:0,y:4,z:0},30);e.collisions.reportBulletHit(62,{x:0,y:4,z:0},30);
 const bullets=e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.bulletHits).map(s=>s.sound);
 expect(bullets[0]).toBeGreaterThanOrEqual(13);expect(bullets[0]).toBeLessThanOrEqual(15);expect(bullets[1]).toBeGreaterThanOrEqual(7);expect(bullets[1]).toBeLessThanOrEqual(9);
});
test('destroyed objects splinter wood or smash glass from their first collision surface',async()=>{
 const e=engine();await flush();e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));
 const destroyed=()=>e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.collisions).map(s=>s.sound);
 // Concrete and missing surfaces stay silent.
 e.collisions.reportObjectDestruction({x:0,y:5,z:0},1);e.collisions.reportObjectDestruction({x:0,y:5,z:0},undefined);expect(destroyed()).toEqual([]);
 e.collisions.reportObjectDestruction({x:0,y:5,z:0},45);expect(destroyed()).toEqual([11]);
 for(const wood of [42,70,172,173,174])e.collisions.reportObjectDestruction({x:0,y:5,z:0},wood);
 const splinters=destroyed().slice(1);expect(splinters).toHaveLength(5);
 for(const id of splinters){expect(id).toBeGreaterThanOrEqual(41);expect(id).toBeLessThanOrEqual(44);}
 const glass=e.manager.sounds.find(s=>s.inUse&&s.sound===11)!;expect([glass.rollOff,+glass.speedVariance.toFixed(4)]).toEqual([2,.0588]);
});
test('pickup collection plays the frontend stereo pairs with a five-frame guard',async()=>{
 const e=engine();await flush();
 e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));
 const frontend=()=>e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.frontendGame&&s.sound!==29&&s.sound!==30).map(s=>s.sound).sort((a,b)=>a-b);
 e.pickup('weapon');e.pickup('armour');
 expect(frontend()).toEqual([27,28]);
 for(let i=0;i<5;i++){e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));await flush();}
 e.pickup('horseshoe');e.pickup('health');
 expect(frontend().filter(s=>s!==27&&s!==28)).toEqual([16,17,18,19]);
});
test('each NPC keeps its own weapon audio entity, so a second shot inside 25 ms is dropped for that ped only',async()=>{
 const e=engine();await flush();
 const shots=()=>e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.weaponGen&&s.sound===6).length;
 e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));
 const at={position:()=>({x:0,y:3,z:0})};
 e.combat('fire',22,{x:0,y:3,z:0},'npc','ped:1',at);const one=shots();
 e.combat('fire',22,{x:0,y:3,z:0},'npc','ped:1',at);expect(shots()).toBe(one);
 e.combat('fire',22,{x:0,y:3,z:0},'npc','ped:2',at);expect(shots()).toBeGreaterThan(one);
});
