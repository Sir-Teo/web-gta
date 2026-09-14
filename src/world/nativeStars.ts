const sideways=[0,.05,.13,.4,.7,.6,.27,.55,.75],heights=[0,.45,.9,1,.85,.52,.48,.35,.2],sizes=[1,1.4,.9,1,.6,1.5,1.3,1,.8];
/** Camera-relative world directions, converted from native Z-up to browser Y-up. */
export const NATIVE_STARS=Array.from({length:12},(_,i)=>i===11?{x:100,y:10,z:90,size:5}:
  {x:i<9?100:-100,y:10+heights[i%9]*80,z:sideways[i%9]*90,size:sizes[i%9]*.8});
export function nativeStarLevel(minutes:number):number {
  if(!Number.isFinite(minutes))throw new Error('Star time must be finite.');
  const clock=Math.floor(((minutes%1440)+1440)%1440),hour=Math.floor(clock/60),minute=clock%60;
  if(hour>=6&&hour<22)return 0;
  return Math.trunc(255*(hour===22?minute:hour===5?60-minute:60)/60);
}
export function nativeStarTwinkle(index:number,randomInteger:number):number {
  return 1-(index===11?(randomInteger%128)*.0015625+.5:(randomInteger%32)*.015);
}
