import {Vector3,type PerspectiveCamera} from 'three';
import {sampleSun} from '../world/sun';
import {stepCoronaFade} from './corona';
import {projectCorona} from './coronaProjection';

type RGB=readonly [number,number,number];
export interface SunCoronaState {
  position:Vector3;
  direction:Vector3;
  color:RGB;
  intensity:number;
  offScreen:boolean;
  justCreated:boolean;
}

/** Session-owned core/corona registration and fade history. Projection flags are
 * written after the update, matching the prior-render input to native fading. */
export class SunCoronas {
  core?:SunCoronaState;
  corona?:SunCoronaState;
  private lastLookMask=0;
  private immediateFrames=0;
  update(minutes:number,camera:PerspectiveCamera,core:RGB,corona:RGB,seconds:number,lookMask=0) {
    if(!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid sun update duration.');
    if(!Number.isInteger(lookMask)||lookMask<0||lookMask>15)throw new Error('Invalid corona camera-look mask.');
    this.immediateFrames=lookMask===this.lastLookMask?Math.max(0,this.immediateFrames-1):3;
    this.lastLookMask=lookMask;
    const sun=sampleSun(minutes),timeStep=Math.min(seconds*50,3);
    const position=new Vector3().copy(sun.direction).multiplyScalar(camera.far*.95).add(camera.position);
    const step=(state:SunCoronaState|undefined,registered:boolean,color:RGB)=>{
      if(!state&&registered)state={position:position.clone(),direction:new Vector3(),color:[...color],intensity:0,offScreen:true,justCreated:true};
      if(!state)return;
      if(registered){state.position.copy(position);state.color=[...color];}
      // Obstruction and cloud flags await native scene integration.
      const fade=stepCoronaFade({intensity:state.intensity,targetAlpha:255,registered,justCreated:state.justCreated,
        offScreen:state.offScreen,blocked:false,changeImmediately:this.immediateFrames>0,timeStep,fadeSpeed:15});
      if(fade.expired)return;
      state.intensity=fade.intensity;state.justCreated=false;
      state.direction.copy(state.position).sub(camera.position).normalize();
      const projected=projectCorona(camera,state.position,1,1,70);
      state.offScreen=!projected||projected.x<0||projected.x>1||projected.y<0||projected.y>1;
      return state;
    };
    this.core=step(this.core,sun.coreVisible,core);
    this.corona=step(this.corona,sun.coronaVisible,corona);
  }
}
