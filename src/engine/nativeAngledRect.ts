/* notsa::shapes::AngledRect, pinned gta-reversed ead3051 (`extensions/Shapes/AngledRect.hpp` and its
 * `IsPointWithin`, both reversed): the tilted rectangle the angled-area commands test a position against.
 *
 * The script gives two corners and a signed width. The rectangle runs along A to B, and the width is laid off
 * perpendicular to that line: to the left of it when the width is positive and to the right when it is negative,
 * with the sign only choosing the side and the magnitude giving the distance. A point is inside when it projects
 * onto both the A-to-B direction within the height and onto the width direction within the width, so the test
 * needs no corner list at all. */
export interface Point2D {x:number;y:number}
export class NativeAngledRect {
 /** The corner the rectangle is measured from, and the two directions with their extents. */
 readonly a:Point2D;
 private readonly dirBtoA:Point2D;private readonly dirDtoA:Point2D;
 readonly width:number;readonly height:number;
 constructor(a:Point2D,b:Point2D,widthAndDirection:number){
  this.a={x:a.x,y:a.y};
  const dx=b.x-a.x,dy=b.y-a.y,height=Math.hypot(dx,dy);
  this.height=height;
  // CVector2D::Normalise leaves a zero-length vector pointing along x rather than at nothing, so a rectangle
  // whose two corners are the same still has a direction, and holds only that corner.
  this.dirBtoA=height>0?{x:dx/height,y:dy/height}:{x:1,y:0};
  // GetPerpLeft is (-y, x) and GetPerpRight its negation.
  this.dirDtoA=widthAndDirection>=0
   ?{x:-this.dirBtoA.y,y:this.dirBtoA.x}
   :{x:this.dirBtoA.y,y:-this.dirBtoA.x};
  this.width=Math.abs(widthAndDirection);
 }
 /** The other two corners, which follow from A and the two directions. */
 get cornerC(){return {x:this.a.x+this.dirBtoA.x*this.height+this.dirDtoA.x*this.width,y:this.a.y+this.dirBtoA.y*this.height+this.dirDtoA.y*this.width};}
 get cornerD(){return {x:this.a.x+this.dirDtoA.x*this.width,y:this.a.y+this.dirDtoA.y*this.width};}
 /** AngledRect::IsPointWithin: the point projects inside both directions. */
 contains(point:Point2D){
  const x=point.x-this.a.x,y=point.y-this.a.y;
  const along=this.dirBtoA.x*x+this.dirBtoA.y*y;
  if(along<0||along>this.height)return false;
  const across=this.dirDtoA.x*x+this.dirDtoA.y*y;
  return across>=0&&across<=this.width;
 }
}
