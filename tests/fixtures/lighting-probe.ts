import {nativeAmbientState} from '../../src/assets/nativeMaterial';
import * as THREE from 'three';
import { modelObject } from '../../src/assets/ModelObjects';
import { readDff } from '../../src/assets/dff';
const bytes = new Uint8Array(await (await fetch('/tests/fixtures/dragonff-skin.dff')).arrayBuffer());
Object.assign(window, { lightingProbe: () => {
  const renderer = new THREE.WebGLRenderer({antialias:false}); renderer.setSize(64,64);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  document.body.append(renderer.domElement);
  const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.set(0,1,5);camera.lookAt(0,1,0);
  const ambient=new THREE.AmbientLight(0xffffff,0),sun=new THREE.DirectionalLight(0xffffff,0);sun.position.set(0,1,5);sun.target.position.set(0,1,0);scene.add(ambient,sun,sun.target);
  function sample(prelight:number,ambientIntensity:number,sunIntensity:number,ambientCoefficient=1,diffuseCoefficient=1,worldLighting=true,litFlag=true,color=255,tilt=0,nightAmount?:number,ambientRGB?:number[]) {
    const model=readDff(bytes),g=model.geometries[0];g.flags=litFlag ? g.flags|0x20 : g.flags&~0x20;
    g.colors=new Uint8Array(24);for(let i=0;i<24;i++)g.colors[i]=i%4===3?255:prelight;
    if (nightAmount !== undefined) { g.nightColors = new Uint8Array(24); for(let i=0;i<24;i++)g.nightColors[i]=i%4===3?255:153; }
    g.flags |= 0x40;g.materials[0].color=[color,color,color,255];
    g.materials[0].surface=[ambientCoefficient,0,diffuseCoefficient];
    const override=nativeAmbientState();if(ambientRGB){override.enabled.value=true;override.color.value.fromArray(ambientRGB);}
    const object=modelObject(model,[],undefined,undefined,{worldLighting,ambient:override});object.setNight(nightAmount ?? 0);object.root.getObjectByName('Root')!.matrix.makeRotationX(tilt);object.root.updateMatrixWorld(true);scene.add(object.root);ambient.intensity=ambientIntensity;sun.intensity=sunIntensity;
    renderer.render(scene,camera);const pixel=new Uint8Array(4);renderer.getContext().readPixels(32,32,1,1,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,pixel);
    scene.remove(object.root);object.dispose();return [...pixel];
  }
  const result={objectAmbient:sample(0,1,0,1,1,true,true,255,0,undefined,[.125,.25,.5]),objectAmbientAdditive:sample(0,1,.25,1,1,true,true,255,0,undefined,[.125,.25,.5]),nightBlend:sample(51,0,0,1,1,true,true,255,0,.5),dark:sample(0,0,0),deformedNormal:sample(0,0,.25,1,1,true,true,255,Math.PI/4),ambient:sample(0,.25,0),sun:sample(0,0,.25),prelit:sample(51,0,0),additive:sample(51,.25,0),ambientCoefficient:sample(0,.25,0,2),diffuseCoefficient:sample(0,0,.25,1,2),clamped:sample(200,1,1),modulated:sample(200,1,1,1,1,true,true,128),inspection:sample(51,1,1,1,1,false),unlit:sample(51,1,1,1,1,true,false)};
  renderer.dispose();renderer.domElement.remove();return result;
} });
