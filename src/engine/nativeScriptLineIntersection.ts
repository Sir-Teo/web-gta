/** GET_2D_LINES_INTERSECT_POINT (05B0), inspected arm64 handler 1001e61d0.
 * This preserves its slope approximation for vertical lines and its finite-segment tolerance. */
export function nativeScriptLineIntersection(values:readonly number[]):{intersects:boolean;x:number;y:number}{
 const f=Math.fround,[ax,ay,bx,by,cx,cy,dx,dy]=values.map(f),firstX=f(ax-bx),firstY=f(ay-by),secondX=f(cx-dx),epsilon=f(.000001);
 const firstSlope=f(firstY/(firstX===0?epsilon:firstX)),secondSlope=f(f(cy-dy)/(secondX===0?epsilon:secondX)),difference=f(secondSlope-firstSlope);
 const miss={intersects:false,x:-1000000,y:-1000000};if(difference===0)return miss;
 const firstIntercept=f(ay-f(ax*firstSlope)),secondIntercept=f(cy-f(cx*secondSlope));
 const x=firstX===0?ax:f(f(firstIntercept-secondIntercept)/difference),y=firstY===0?ay:f(f(f(firstIntercept*secondSlope)-f(firstSlope*secondIntercept))/difference);
 // The native bounds promote each float endpoint to double before adding ±0.01, then round back to float.
 const within=(v:number,a:number,b:number)=>v>=f(Math.min(a,b)-.01)&&v<=f(Math.max(a,b)+.01);
 if(!within(x,ax,bx)||!within(y,ay,by)||!within(x,cx,dx)||!within(y,cy,dy))return miss;
 return{intersects:true,x,y};
}
