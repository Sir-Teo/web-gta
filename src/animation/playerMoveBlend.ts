/** Player-on-foot input blend: pad range 128, /60 target and 0.07 per native 50 Hz timestep. */
export function playerMoveBlend(previous:number,x:number,y:number,walk:boolean,dt:number){
 if(![previous,x,y,dt].every(Number.isFinite)||previous<0||dt<0)throw new Error('Invalid player movement blend input.');
 const magnitude=Math.hypot(x,y);
 if(magnitude===0)return 0;
 const target=walk?Math.min(1,magnitude*128/60):magnitude*128/60;
 const change=3.5*dt;
 return previous+Math.max(-change,Math.min(change,target-previous));
}
