/** CClouds::Render_MaybeRenderStreaks, converted from native Z-up to browser Y-up. */
export function nativeStreak(minutes:number,timeMs:number,extraSunny:boolean){
  if(!Number.isFinite(minutes)||!Number.isFinite(timeMs)||timeMs<0)throw new Error('Invalid streak clock.');
  const clock=((minutes%1440)+1440)%1440,timer=Math.floor(timeMs)%0x100000000;
  const delta=timer%8192;
  if(!extraSunny||clock>=300||delta>=800)return undefined;
  const repeat=Math.floor(timer/8192)%64;
  const normalize=(x:number,y:number,z:number)=>{const length=Math.hypot(x,y,z);return {x:x/length,y:z/length,z:-y/length};};
  const direction=normalize((repeat%7-3)*.1,(Math.floor((timer%65536)/8192)-4)*.1,1);
  const offset=normalize(repeat%9-5,repeat%10-5,.1),scale=(400-delta)*2;
  const point=(distance:number)=>({x:offset.x*1000+direction.x*distance,y:offset.y*1000+direction.y*distance,z:offset.z*1000+direction.z*distance});
  return {head:point(scale),tail:point(scale+50)};
}

/** Native IsExtraSunny predicate; static local selection represents both weather endpoints. */
export function nativeExtraSunny(weather:number){return [0,2,6,11,13,17].includes(weather);}
