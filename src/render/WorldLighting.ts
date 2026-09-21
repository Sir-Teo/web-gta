import {nativeLowLodScale} from '../world/nativeLowLod';
import {LocalWater} from './LocalWater';
import {nativeAltitudeFarClip} from '../world/nativeFarClip';
import {GAME_CAMERA_FOV} from './cameraProjection';
import * as THREE from 'three';
import { installNativeFogCurve } from './nativeFog';
import { type Vec3 } from '../core/math';
import { sampleTimecycle } from '../world/timecycle';
import { NATIVE_LIGHT_DIRECTION } from '../world/sun';
import { SunCoronas } from './SunCoronas';
import {LocalSunTexture} from './LocalSunTexture';
import {TexturedSun} from './TexturedSun';
import { NativeSky } from './NativeSky';
import { NativeStreak } from './NativeStreak';
import { NativeStars } from './NativeStars';
import { NativeLowClouds } from './NativeLowClouds';
import type { ImportedLighting } from '../world/LocalTimecycle';

export class WorldLighting {
  private sunUniforms = {coreDirection:{value:new THREE.Vector3()},coronaDirection:{value:new THREE.Vector3()},sunCore:{value:new THREE.Color()},sunCorona:{value:new THREE.Color()},coreVisible:{value:0},coronaVisible:{value:0}};
  private cameraWorldPosition = new THREE.Vector3();
  private nativeSky: NativeSky;
  private nativeStars: NativeStars;
  private lowClouds: NativeLowClouds;
  private streak: NativeStreak;
  readonly water:LocalWater;
  private skyTimeMs=0;
  // Runtime factors can be supplied independently; local weather rows use the documented viewer fog approximation.
  readonly skyWeather = { foggyness: 0, underwaterness: 0 };
  private ambient = new THREE.HemisphereLight();
  private sun = new THREE.DirectionalLight();
  private authoredFog = new THREE.FogExp2(0,.0042);
  private importedFog = new THREE.Fog(0,0,650);
  private originalFar = new WeakMap<THREE.PerspectiveCamera,number>();
  area=0;
  /** CCoronas' sun slots (ids 1 and 2), read for the sun's flare. */
  readonly sunCoronas = new SunCoronas();
  get sunLightMultiplier(){return this.sunCoronas.lightMultiplier;}
  readonly sunTexture=new LocalSunTexture();
  private texturedSun:TexturedSun;
  night = 0;
  lowLodScale=1;
  regionalLodMultiplier=1;
  nativeWorldAmbient?: ImportedLighting['ambient'];
  nativeObjectAmbient?: readonly number[];
  /** The frame's timecycle post-effect colours for CPostEffects::ColourFilter. */
  nativePostFx?: ImportedLighting['postFx'];
  /** CTimeCycle::m_CurrentColours.m_fSpriteBrightness (stored ×10), for 2d effect lights. */
  nativeSpriteBrightness?: number;
  /** The timecycle's sun core and corona bytes. */
  nativeSunBytes?: {core:readonly [number,number,number];corona:readonly [number,number,number]};
  nativeSpriteSize?: number;
  nativeLightsOnGroundBrightness?: number;
  nativeShadowStrength?:number;
  /** CTimeCycle::m_CurrentColours sky bottom bytes (CClouds::MovingFogRender tints the fog from them). */
  nativeSkyBottom?:readonly [number,number,number];
  /** CTimeCycle's sky top bytes, for CClouds' volumetric cloud grey. */
  nativeSkyTop?:readonly [number,number,number];
  nativeTimecycle?: (minutes:number,position:Vec3)=>ImportedLighting|undefined;
  sunObstructed?: (sun:THREE.Vector3,camera:THREE.Vector3)=>boolean;
  private occlusionCache={blocked:false,age:1,sun:new THREE.Vector3(),camera:new THREE.Vector3()};
  private throttledSunObstructed=(sun:THREE.Vector3,camera:THREE.Vector3):boolean=>{
    const query=this.sunObstructed;
    if(!query)return false;
    const cache=this.occlusionCache;
    // Production sun probe is a full-scene fixed-geometry ray; reuse for 100ms
    // while the endpoints stay within 2m. Unit tests call SunCoronas directly,
    // so its per-update contract is unchanged.
    if(cache.age<0.1&&cache.sun.distanceToSquared(sun)<=4&&cache.camera.distanceToSquared(camera)<=4)return cache.blocked;
    cache.blocked=query(sun,camera)??false;
    cache.age=0;cache.sun.copy(sun);cache.camera.copy(camera);
    return cache.blocked;
  };
  constructor(private scene: THREE.Scene) {
    this.water=new LocalWater(scene);
    this.texturedSun=new TexturedSun(scene);
    installNativeFogCurve();
    scene.background = new THREE.Color(); scene.fog = this.authoredFog;
    this.nativeSky = new NativeSky(scene,this.sunUniforms);
    this.nativeStars = new NativeStars(scene);
    this.lowClouds = new NativeLowClouds(scene);
    this.streak = new NativeStreak(scene);
    scene.add(this.ambient, this.sun, this.sun.target);
    // Blob shadows only (see Renderer): the directional shadow camera stays
    // off. Native street lighting uses prelight + blob, not a 2048 shadow map.
    this.sun.castShadow = false; this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 0.5, far: 210 });
    this.sun.shadow.normalBias = 0.025; this.sun.shadow.bias = -0.00008;
  }
  update(minutes: number, player: Vec3, camera: THREE.PerspectiveCamera, seconds=0,lookMask=0,sourceFov=GAME_CAMERA_FOV,advanceSun=true) {
    camera.getWorldPosition(this.cameraWorldPosition);
    const sample = sampleTimecycle(minutes),native = this.nativeTimecycle?.(minutes,this.cameraWorldPosition);
    this.regionalLodMultiplier=native?.regionalLodMultiplier??1;
    this.lowLodScale=nativeLowLodScale(this.cameraWorldPosition.y,this.area===0,this.regionalLodMultiplier);
    this.nativeObjectAmbient=native?.objectAmbient;this.nativeWorldAmbient=native?.ambient;this.nativeSpriteBrightness=native?.spriteBrightness;this.nativeSunBytes=native?.sunBytes;this.nativeSpriteSize=native?.spriteSize;this.nativeLightsOnGroundBrightness=native?.lightsOnGroundBrightness;
    this.nativeShadowStrength=native?.shadowStrength;this.nativeSkyBottom=native?.skyColors?.bottom;this.nativeSkyTop=native?.skyColors?.top;this.nativePostFx=native?.postFx;
    if(native){sample.top=native.top;sample.horizon=native.horizon;}
    this.night = sample.night;
    const uniforms = this.sunUniforms;
    (this.scene.background as THREE.Color).setRGB(...sample.horizon);
    if(!this.originalFar.has(camera))this.originalFar.set(camera,camera.far);
    const sourceFog=native?.fog;
    const fog=sourceFog ? {start:sourceFog.start,end:nativeAltitudeFarClip(sourceFog.end,this.cameraWorldPosition.y)} : undefined;
    if(fog){this.importedFog.near=fog.start;this.importedFog.far=fog.end;this.scene.fog=this.importedFog;}
    else{this.authoredFog.density=sample.fog;this.scene.fog=this.authoredFog;}
    this.scene.fog.color.setRGB(...sample.horizon);
    const far=fog?.end??this.originalFar.get(camera)!;
    if(camera.far!==far){camera.far=far;camera.updateProjectionMatrix();}
    camera.updateWorldMatrix(true, false);
    this.nativeSky.update(camera,native?.skyColors,minutes,{
      foggyness:native?.skyFoggyness??this.skyWeather.foggyness,underwaterness:this.skyWeather.underwaterness,
    });
    this.nativeStars.update(camera,minutes,!!native&&this.area===0,this.sunTexture.texture,sourceFov,advanceSun);
    if(advanceSun)this.skyTimeMs=(this.skyTimeMs+Math.max(0,seconds)*1000)%0x100000000;
    this.streak.update(camera,minutes,this.skyTimeMs,!!native?.extraSunny&&this.area===0);
    this.water.update(this.area,native?.water,this.sunTexture.waterTexture,this.skyTimeMs/1000);
    this.lowClouds.update(camera,this.area===0?native?.lowClouds:undefined,this.sunTexture.cloudTexture,sourceFov);
    this.occlusionCache.age+=seconds;
    if(advanceSun)this.sunCoronas.update(minutes,camera,native?.sunCore??sample.sun,native?.sunCorona??sample.sun,seconds,lookMask,this.sunObstructed?this.throttledSunObstructed:undefined,native?.sunSize??0,this.area===0);
    const {core,corona}=this.sunCoronas;
    if(core){uniforms.sunCore.value.setRGB(...core.color);uniforms.coreDirection.value.copy(core.direction);}
    if(corona){uniforms.sunCorona.value.setRGB(...corona.color);uniforms.coronaDirection.value.copy(corona.direction);}
    uniforms.coreVisible.value=(core?.intensity??0)/255;
    uniforms.coronaVisible.value=(corona?.intensity??0)/255;
    const textured=!!this.sunTexture.texture&&!!native&&native.sunSize>=0;
    this.texturedSun.update(camera,textured?this.sunTexture.texture:undefined,core,corona,sourceFov);
    if(textured){uniforms.coreVisible.value=0;uniforms.coronaVisible.value=0;}
    this.ambient.color.setRGB(...sample.ambient); this.ambient.groundColor.setRGB(...sample.ground); this.ambient.intensity = sample.ambientIntensity;
    if(native?.directionalMultiplier!==undefined){
      this.sun.color.setRGB(1,1,1);
      this.sun.intensity=Math.fround(Math.fround(native.directionalMultiplier*.99609375)*this.sunLightMultiplier);
    }else{
      this.sun.color.setRGB(...sample.sun);this.sun.intensity=sample.sunIntensity;
    }
    const x = Math.round(player.x / 4) * 4, z = Math.round(player.z / 4) * 4;
    if(native){
      // Native illumination is fixed independently of the visible sun. Follow terrain
      // height without changing that direction or leaving the shadow volume below it.
      this.sun.target.position.set(x,player.y,z);
      this.sun.position.copy(this.sun.target.position).addScaledVector(NATIVE_LIGHT_DIRECTION,90);
    }else{
      // Authored lighting keeps its above-ground shadow camera after sunset.
      this.sun.target.position.set(x,0,z);
      this.sun.position.set(x+sample.direction.x*90,Math.max(6,sample.direction.y*90),z+sample.direction.z*90);
    }
  }
  dispose() {
    this.nativeSky.dispose();
    this.nativeStars.dispose();
    this.lowClouds.dispose();
    this.streak.dispose();
    this.water.dispose();
    this.texturedSun.dispose();this.sunTexture.dispose();
    this.sun.shadow.map?.dispose();
  }
}
