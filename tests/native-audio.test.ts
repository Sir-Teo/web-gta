import {expect,test} from 'vitest';
import {NativeAudioEnvironment,SOUND,type NativeAudioEntity,type NativeCamera,type NativeSound} from '../src/audio/native/NativeSound';
import {NativeSoundManager,type NativeBankSlots,type NativeBankSound} from '../src/audio/native/NativeSoundManager';
import {NativeBankLoader,SLOT,type NativeBankManifest} from '../src/audio/native/NativeBankLoader';
import {NativeAudioEngine,NATIVE_AUDIO_FRAME_MS} from '../src/audio/native/NativeAudioEngine';
import {NativeTwinLoopSound} from '../src/audio/native/NativeTwinLoopSound';
import {AE_STATE,NativeVehicleAudio,type NativeVehicleAudioInput} from '../src/audio/native/NativeVehicleAudio';
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
/** A motorbike: two wheel states (front, rear), as CBike has. */
const bike=(over:Partial<NativeVehicleAudioInput>={}):NativeVehicleAudioInput=>car({wheels:{states:['normal','normal'],counts:[1,1],contactWheels:2,driveOnGround:1,driveOnGroundLastFrame:1,spinForAudio:0,burst:[false,false]},bike:{leanAngle:0,playerBoost:false},...over});
test('a motorbike has the car engine over its own banks, the lean raising its pitch and two wheels to skid on',async()=>{
 // The PCJ-600: SPORTSBIKE_P (125) and _D (124).
 const e=engine(),dummyKey={},dummy=bike();await flush();
 await frames(e,dummyKey,461,()=>dummy,4);
 expect(e.vehicle(dummyKey,461)!.state).toBe(AE_STATE.dummyId);
 const key={},input=bike({status:'player',playerDriver:true,playerInVehicle:true});
 await frames(e,key,461,()=>input,3);
 const audio=e.vehicle(key,461)!;
 expect(e.bank.isSoundBankLoaded(125,SLOT.playerEngine)).toBe(true);
 expect(audio.state).toBe(AE_STATE.playerId);
 input.padAccelerate=1;input.gasPedal=1;input.moveSpeed={x:0,y:.2,z:0};input.gear=1;
 await frames(e,key,461,()=>{input.moveSpeed={x:0,y:input.moveSpeed.y+.004,z:0};return input;},8);
 expect(audio.state).toBe(AE_STATE.playerAcFull);
 // GetFreqForPlayerEngineSound's bike factor: (sin(lean) x 0.12 + boost 0.1) x the gear factor, one plus it multiplying.
 const ac=audio.engineSounds[4]!,upright=ac.speed;
 input.bike={leanAngle:.5,playerBoost:false};await frames(e,key,461,()=>input,1);
 const gf=Math.min(1,input.moveSpeed.y/(input.transmission!.gears[1].changeUpVelocity));
 expect(ac.speed/upright).toBeCloseTo(1+Math.sin(.5)*.12*gf,2);
 // The rear wheel locked at speed skids; a front wheel alone does not while the rear is not skidding.
 input.bike={leanAngle:0,playerBoost:false};input.wheels={...input.wheels!,states:['skidding','normal']};await frames(e,key,461,()=>input,2);
 expect(audio.skid.active).toBe(false);
 input.wheels={...input.wheels!,states:['normal','fixed']};await frames(e,key,461,()=>input,2);
 expect(audio.skid.active).toBe(true);
});
test("a boat's engine follows its propeller, and its hull skims the water",async()=>{
 // The Speeder: BOAT_INBOARD_D (21) in a dummy slot; a boat loads no player bank.
 const e=engine(),key={};await flush();
 const input=car({status:'player',playerDriver:true,playerInVehicle:true,transmission:undefined,wheels:undefined,boat:{engineSpeed:.1,inWater:true}});
 await frames(e,key,452,()=>input,4);
 const audio=e.vehicle(key,452)!,engine2=audio.engineSounds[2]!;
 expect(engine2.slot).toBe(audio.dummySlot);expect(engine2.sound).toBe(0);
 // ProcessBoatEngine: es = clamp(m_EngineSpeed x 3) = 0.3; on the water 0.6 + 0.3 x 0.4, level so no roll.
 expect(engine2.speed).toBeCloseTo(.72,5);
 expect(engine2.volume-audio.eventVolume).toBeCloseTo(-3+.3*3,5);
 expect(audio.engineSounds[3]?.slot).toBe(SLOT.vehicleGen);
 // The frequency steps 0.02 a frame towards a new target.
 input.boat={engineSpeed:.3,inWater:true};await frames(e,key,452,()=>input,1);
 expect(engine2.speed).toBeCloseTo(.74,5);
 // ProcessBoatMovingOverWater: half of 0.75 a frame skims at 3 + 20 log10(0.5) dB, 0.8 + 0.2 x 0.5 speed.
 input.moveSpeed={x:0,y:.375,z:0};await frames(e,key,452,()=>input,1);
 const skim=audio.engineSounds[6]!;
 expect(skim.slot).toBe(SLOT.collisions);expect(skim.sound).toBe(3);expect(skim.speed).toBeCloseTo(.9,5);
 expect(skim.volume-audio.eventVolume).toBeCloseTo(3+20*Math.log10(.5),4);
 // Out of the water the skim is silent; the engine stops with the engine off.
 input.boat={engineSpeed:.3,inWater:false};await frames(e,key,452,()=>input,1);
 expect(skim.volume).toBeLessThanOrEqual(-100+audio.eventVolume+1e-6);
 input.engineOn=false;await frames(e,key,452,()=>input,1);
 expect(audio.engineSounds[2]).toBeUndefined();
});
test("a train's engine sounds at the front, and every carriage's wheels on the rails",async()=>{
 const e=engine();await flush();
 const train=(model:number,front:boolean,carriage:number,speed:number)=>car({transmission:undefined,wheels:undefined,train:{speed,clockwise:false,front,notOnARailRoad:false,carriage}});
 // The freight engine (TRAIN_D, 131) and its second carriage, at half of a unit a frame.
 const engineKey={},wagonKey={},loco=train(537,true,1,.5),wagon=train(569,false,2,.5);
 for(let i=0;i<4;i++){e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[[engineKey,537,loco],[wagonKey,569,wagon]]}));await flush();}
 const front=e.vehicle(engineKey,537)!,second=e.vehicle(wagonKey,569)!;
 // ProcessDummyTrainEngine: lerp(0.8, 1.2, 0.5) on the level, at 0 dB (the event volume twice once updated, as
 // UpdateTrainSound has it).
 const motor=front.engineSounds[1]!;
 expect(motor.sound).toBe(0);expect(motor.slot).toBe(front.dummySlot);expect(motor.speed).toBeCloseTo(1,5);
 expect(motor.volume-2*front.eventVolume).toBeCloseTo(0,5);
 expect(second.engineSounds[1]).toBeUndefined();
 // ProcessTrainTrackSound: sound 2 at 6 + 20 log10(0.5) dB, pitched by TrainCarriagesNoise for its place.
 expect(front.engineSounds[2]!.sound).toBe(2);expect(front.engineSounds[2]!.speed).toBeCloseTo(.96,5);
 expect(second.engineSounds[2]!.speed).toBeCloseTo(1.04,5);
 expect(front.engineSounds[2]!.volume-2*front.eventVolume).toBeCloseTo(6+20*Math.log10(.5),4);
 // A tram (TRAM_D, 133) swells with its speed: 20 log10(sf) on its engine.
 const tramKey={},tram=train(449,true,1,.25);
 await frames(e,tramKey,449,()=>tram,4);
 const t=e.vehicle(tramKey,449)!;
 expect(t.engineSounds[1]!.volume-2*t.eventVolume).toBeCloseTo(20*Math.log10(.25),4);
 expect(t.engineSounds[1]!.speed).toBeCloseTo(.9+.2*.25,5);
});
test('a BMX rolls on its tyres, ticks while freewheeling, clangs its chain, rings its bell and skids',async()=>{
 (NativeVehicleAudio as any).wasFreewheeling={player:false,dummy:false};
 const e=engine(),key={};await flush();
 // A ridden BMX (BICYCLE_D 18 in a dummy slot, BICYCLE_P 19 in the player slot) at half its top speed, both wheels down.
 const input=bike({status:'player',playerDriver:true,playerInVehicle:true,moveSpeed:{x:0,y:.4,z:0},bike:{leanAngle:.3,playerBoost:false},bmx:{freewheeling:false}});
 await frames(e,key,481,()=>input,4);
 const audio=e.vehicle(key,481)!;
 expect(e.bank.isSoundBankLoaded(19,SLOT.playerEngine)).toBe(true);
 // The tyres: log10(wheels x 0.25 x sf) x 20 + event - 8 dB, at (wheels/80 + sf/10 + 1.05)(1 + |sin lean| x 0.2).
 const tyre=audio.engineSounds[1]!,sf=.5;
 expect(tyre.slot).toBe(audio.dummySlot);expect(tyre.sound).toBe(0);
 expect(tyre.volume-audio.eventVolume).toBeCloseTo(20*Math.log10(2*.25*sf)-8,4);
 expect(tyre.speed).toBeCloseTo((2*.0125+sf*.1+1.05)*(1+Math.sin(.3)*.2),5);
 // Pedalling, the freewheel is silent; coasting, it ticks at log10(GetBaseVolumeForBicycleTyre(sf)) x 20 - 15.
 expect(audio.engineSounds[2]!.volume-audio.eventVolume).toBeLessThan(-90);
 input.bmx={freewheeling:true};await frames(e,key,481,()=>input,1);
 expect(audio.engineSounds[2]!.sound).toBe(1);expect(audio.engineSounds[2]!.speed).toBeCloseTo(sf*.7+.4,5);
 expect(audio.engineSounds[2]!.volume-audio.eventVolume).toBeCloseTo(20*Math.log10(.45+(.85-.45)*(sf-.2)/.3)-15,4);
 // Pedalling again clangs the chain: a COLLISIONS sound started part way in.
 input.bmx={freewheeling:false};await frames(e,key,481,()=>input,1);
 const clang=audio.engineSounds[3]!;
 expect(clang.slot).toBe(SLOT.collisions);expect([5,7,8,9]).toContain(clang.sound);
 // The bell rings at the press and dies away 1.5 dB a frame.
 input.horn.counter=1;await frames(e,key,481,()=>input,1);
 const bell=audio.hornSound!;expect(bell.sound).toBe(0);expect(bell.slot).toBe(SLOT.hornAndSiren);
 const rung=bell.volume;await frames(e,key,481,()=>input,2);
 expect(rung-bell.volume).toBeCloseTo(3,5);
 // The BMX's skid is VEHICLE_GEN's BIKE_SKID_A at 0.9 + 0.25 x the sum, from -12 dB.
 input.wheels={...input.wheels!,states:['normal','fixed']};await frames(e,key,481,()=>input,2);
 expect(audio.skid.active).toBe(true);
 const skidSum=Math.min(.4*5,1)*1.2,loop=audio.skid.sounds[0]!;
 expect(loop.sound).toBe(0);expect(loop.speed).toBeCloseTo(.9+.25*skidSum,5);
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
test('every audio frame takes its collision reports, and glass takes its own event volumes',async()=>{
 const e=engine();await flush();
 const flags=(o:Partial<Record<string,boolean>>)=>({concrete:false,grass:false,sand:false,gravel:false,wood:false,water:false,metal:false,longGrass:false,tile:false,...o});
 e.surfaceAudio=new Map([[1,flags({concrete:true})],[63,flags({metal:true})]]);
 const tick=async()=>{e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));await flush();};
 await tick();
 const car={key:{},surface:63,vehicle:{up:{x:0,y:0,z:1},moveSpeed:{x:.3,y:0,z:0},turnSpeed:{x:0,y:0,z:0}}},wall={key:7,surface:1,building:true};
 e.collisions.reportCollision(car,wall,{x:0,y:5,z:0},{x:-1,y:0,z:0},.1,1);await tick();
 e.collisions.reportCollision(car,wall,{x:0,y:5,z:0},{x:-1,y:0,z:0},.1,1);
 const scrape=e.manager.sounds.find(s=>s.inUse&&s.slot===SLOT.collisions&&s.sound===2)!;expect(scrape).toBeDefined();
 // Every frame's report counts (the rounded ms clock's frame number skipped every third frame), so each one pushes
 // the loop's stop 100 ms past that frame's clock. (UpdateLoopingCollisionSound's step_to runs from the target toward
 // the current speed, so the speed settles at 0.65 — the reference's own argument order.)
 const entry=()=>(e.collisions as any).list.find((x:any)=>x.sound===scrape);
 for(let i=0;i<6;i++){await tick();const now=e.manager.clock.timeMs;e.collisions.reportCollision(car,wall,{x:0,y:5,z:0},{x:-1,y:0,z:0},.1,1);expect(entry().loopStop).toBe(now+100);}
 expect(+scrape.speed.toFixed(3)).toBe(.65);
 // A glass event plays at its own default volume (eventvol.dat: −22 dB for AE_GLASS_HIT_GROUND), not the general one.
 (e.collisions as any).defaultVolume=(event:number)=>event===127?-22:-3;
 e.collisions.reportGlassCollisionEvent('hitGround',{x:0,y:3,z:0});
 const pane=e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.collisions&&s.sound>=15&&s.sound<=18).at(-1)!;
 expect(pane.volume).toBeLessThan(-10);
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
test('a keycard from a ONCE pickup plays the weapon chime; an on-street one plays nothing',async()=>{
 const e=engine();await flush();
 e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));
 const frontend=()=>e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.frontendGame&&(s.sound===27||s.sound===28)).length;
 e.pickup('keycard',2);expect(frontend()).toBe(0);
 e.pickup('keycard',3);expect(frontend()).toBe(2);
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
test("the Caddy is a special vehicle: ProcessDummyGolfCart's one loop, silent below a twentieth of its top speed",async()=>{
 const e=engine(),key={},input=car({transmission:{...car().transmission!,maxVelocity:.4}});await flush();
 await frames(e,key,457,()=>input,4);
 const audio=e.vehicle(key,457)!;
 expect(audio.engineSounds[1]).toBeUndefined();
 input.moveSpeed={x:0,y:.2,z:0};await frames(e,key,457,()=>input,3);
 // Half the top speed: frequency lerp(0.85, 1.2, 0.5), volume log10(piecewise 0.5 → 0.722…)·20 − 3.
 const loop=audio.engineSounds[1]!;expect(loop.sound).toBe(0);expect(loop.speed).toBeCloseTo(1.025,5);
 expect(loop.volume-audio.eventVolume).toBeCloseTo(Math.log10(.5+.5*(.4/.9))*20-3,4);
 input.engineOn=false;await frames(e,key,457,()=>input,1);
 expect(audio.engineSounds.every(s=>!s)).toBe(true);
});
test('a burning nitro fires the ignition shot once and plays its two loops, pitched by the pad, until it burns out',async()=>{
 const e=engine(),key={},input=car({status:'player',playerDriver:true,playerInVehicle:true,nitro:true,padAccelerate:1,gasPedal:1});await flush();
 await frames(e,key,562,()=>input,4);
 const audio=e.vehicle(key,562)!;
 const shots=()=>e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.weaponGen&&s.sound===83).length;
 expect(shots()).toBe(1);
 const [one,two]=[audio.engineSounds[7]!,audio.engineSounds[8]!];
 expect(one.sound).toBe(10);expect(one.speed).toBeCloseTo(.84,5);expect(one.volume-audio.eventVolume).toBeCloseTo(2,5);
 expect(two.sound).toBe(26);expect(two.speed).toBeCloseTo(1,5);expect(two.volume-audio.eventVolume).toBeCloseTo(-9,5);
 await frames(e,key,562,()=>input,2);expect(shots()).toBe(1);
 // An AI car has no ThisAccel: the loops sit at their minimum.
 const ai={},dummy=car({nitro:true,gasPedal:1});await frames(e,ai,562,()=>dummy,4);
 expect(e.vehicle(ai,562)!.engineSounds[7]!.speed).toBeCloseTo(.75,5);
 input.nitro=false;await frames(e,key,562,()=>input,1);
 expect(audio.engineSounds[7]).toBeUndefined();expect(audio.engineSounds[8]).toBeUndefined();
});
test('ped speech: pain spaced per ped, other contexts for everyone by their repeat time, at AE_SPEECH_PED rolled off 2',async()=>{
 const e=engine();await flush();
 const spoken=()=>e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.weaponGen&&s.sound>=30&&s.sound<36);
 const a={},b={},at={x:0,y:5,z:0};
 e.pedSpeech(a,at,'pain',1);e.pedSpeech(b,at,'pain',2);e.pedSpeech(a,at,'pain',3);
 // Two peds each say one pain line; the first ped's second waits its own 2 s.
 expect(spoken()).toHaveLength(2);
 expect(spoken()[0].rollOff).toBe(2);expect(spoken()[0].volume).toBe(e.defaultVolume(52));
 e.pedSpeech(a,at,'flee',1);e.pedSpeech(b,at,'flee',2);
 expect(spoken()).toHaveLength(3);
});
test('the swim wake rises while it is triggered, then sinks and stops at default − 20',async()=>{
 const e=engine();await flush();
 e.eventVolumes=new Int8Array(45402);
 e.setPlayer(()=>({x:0,y:3,z:0}));
 const wake=()=>e.manager.sounds.find(s=>s.inUse&&s.slot===SLOT.collisions&&s.sound===3);
 for(let i=0;i<4;i++){e.swimWake();e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));await flush();}
 const start=wake()!;expect(start).toBeDefined();
 for(let i=0;i<10;i++){e.swimWake();e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));await flush();}
 const risen=wake()!.volume;expect(risen).toBeGreaterThan(-20);
 for(let i=0;i<80;i++){e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));await flush();}
 expect(wake()).toBeUndefined();
});
test('AE_FRONTEND_FIRE_FAIL_SNIPERRIFFLE and _ROCKET click frontend sounds 10 and 11 ahead of the listener',async()=>{
 const e=engine();await flush();
 e.frontend.addAudioEvent(41);e.frontend.addAudioEvent(42);
 const clicks=e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.frontendGame).map(s=>s.sound).sort();
 expect(clicks).toEqual([10,11]);
});
test('a ped killed by a fall crunches: sound 29 and one gore splat, not again while they play',async()=>{
 const e=engine();await flush();e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));await flush();
 const ped={},crunch=()=>e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.collisions&&(s.sound===29||s.sound>=47&&s.sound<=49)).map(s=>s.sound===29?'crunch':'splat');
 e.pedCrunch(ped,{x:0,y:4,z:0});expect(crunch().sort()).toEqual(['crunch','splat']);
 e.pedCrunch(ped,{x:0,y:4,z:0});expect(crunch()).toHaveLength(2);
});
