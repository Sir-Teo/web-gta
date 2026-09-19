/* CCurves (Curves.cpp, reversed in the pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166): the bend a car on
 * rails (STATUS_SIMPLE) follows from one path link's lane point to the next, and how long it takes. Native ground
 * plane: x and y. */

type V2={x:number;y:number};

/** CCurves::DistForLineToCrossOtherLine (0x43C610): how far along the first line it crosses the second, −1 when
 * they are parallel. */
export function distForLineToCrossOtherLine(baseX:number,baseY:number,dirX:number,dirY:number,otherBaseX:number,otherBaseY:number,otherDirX:number,otherDirY:number){
 const cross=dirX*otherDirY-dirY*otherDirX;
 if(cross===0)return -1;
 return -((baseX-otherBaseX)*otherDirY-(baseY-otherBaseY)*otherDirX)/cross;
}
/** CCollision::DistToMathematicalLine2D. */
function distToMathematicalLine2D(lineX:number,lineY:number,dirX:number,dirY:number,pointX:number,pointY:number){
 const px=pointX-lineX,py=pointY-lineY,dot=px*dirX+py*dirY,d2=px*px+py*py-dot*dot;
 return d2>0?Math.sqrt(d2):0;
}
/** CCurves::CalcSpeedVariationInBend (0x43C660). */
export function calcSpeedVariationInBend(start:V2,end:V2,startDirX:number,startDirY:number,endDirX:number,endDirY:number){
 const dot=startDirX*endDirX+startDirY*endDirY;
 if(dot<=0)return 1/3;
 if(dot>.7)return distToMathematicalLine2D(end.x,end.y,endDirX,endDirY,start.x,start.y)/Math.hypot(start.x-end.x,start.y-end.y)*(1/3);
 return (1-dot/.7)*(1/3);
}
/** CCurves::CalcSpeedScaleFactor (0x43C710): the curve's length for timing. */
export function calcSpeedScaleFactor(start:V2,end:V2,startDirX:number,startDirY:number,endDirX:number,endDirY:number){
 const variation=calcSpeedVariationInBend(start,end,startDirX,startDirY,endDirX,endDirY);
 const d1=distForLineToCrossOtherLine(start.x,start.y,startDirX,startDirY,end.x,end.y,endDirX,endDirY);
 const d2=distForLineToCrossOtherLine(end.x,end.y,-endDirX,-endDirY,start.x,start.y,startDirX,startDirY);
 if(d1>0&&d2>0){const bend=Math.min(5,d1,d2);return 2*bend+(d1-bend)+(d2-bend);}
 return Math.hypot(start.x-end.x,start.y-end.y)/(1-variation);
}
/** CCurves::CalcCorrectedDist (0x43C880): the distance covered by `current` of `total`, eased by the variation, and
 * the cosine blend between the two lines. */
export function calcCorrectedDist(current:number,total:number,variation:number){
 if(total<1e-5)return {distance:0,t:.5};
 const t=.5-Math.cos(Math.PI*(current/total))*.5;
 return {distance:Math.sin(current/total*2*Math.PI)*(total/(2*Math.PI))*variation+(1-2*variation+1)*.5*current,t};
}
/** CCurves::CalcCurvePoint (0x43C900): the point `time` (0–1) along the curve, and its speed for a traversal of
 * `traversalMs`. */
export function calcCurvePoint(start:V2,end:V2,startDir:V2,endDir:V2,time:number,traversalMs:number){
 time=Math.max(0,Math.min(1,time));
 const variation=calcSpeedVariationInBend(start,end,startDir.x,startDir.y,endDir.x,endDir.y);
 const d1=distForLineToCrossOtherLine(start.x,start.y,startDir.x,startDir.y,end.x,end.y,endDir.x,endDir.y);
 const d2=distForLineToCrossOtherLine(end.x,end.y,-endDir.x,-endDir.y,start.x,start.y,startDir.x,startDir.y);
 let point:V2,total:number;
 if(d1<=0||d2<=0){
  const straight=Math.hypot(start.x-end.x,start.y-end.y),interpol=straight/(1-variation),c=calcCorrectedDist(time*interpol,interpol,variation);
  const a={x:start.x+startDir.x*c.distance,y:start.y+startDir.y*c.distance},b={x:end.x+endDir.x*(c.distance-straight),y:end.y+endDir.y*(c.distance-straight)};
  point={x:a.x+(b.x-a.x)*c.t,y:a.y+(b.y-a.y)*c.t};total=straight;
 }else{
  const bend=Math.min(5,d1,d2),straight1=d1-bend,straight2=d2-bend;
  total=straight1+2*bend+straight2;const along=time*total;
  if(straight1>along)point={x:start.x+startDir.x*along,y:start.y+startDir.y*along};
  else if(straight1+2*bend<=along){const back=along-total;point={x:end.x+endDir.x*back,y:end.y+endDir.y*back};}
  else{
   const i=(along-straight1)/(2*bend);
   const a={x:start.x+startDir.x*(straight1+bend*i),y:start.y+startDir.y*(straight1+bend*i)},b={x:end.x-endDir.x*(straight2+bend*(1-i)),y:end.y-endDir.y*(straight2+bend*(1-i))};
   point={x:a.x+(b.x-a.x)*i,y:a.y+(b.y-a.y)*i};
  }
 }
 const scale=(1-time)*total/(traversalMs/1000);
 return {point,speed:{x:(startDir.x+(endDir.x-startDir.x)*time)*scale,y:(startDir.y+(endDir.y-startDir.y)*time)*scale}};
}
