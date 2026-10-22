import type {ScmIntroRectangle,ScmIntroTextLine} from '../engine/ScmMessages';
/** CMenuManager::DrawWindow (PC 573EE0), called with color offset zero by script rectangles.
 * Its font Y scale is 1.4; the shared script-font renderer accepts twice that scale. */
export function scriptWindowHeaderLine(rectangle:ScmIntroRectangle):ScmIntroTextLine{
 return {scale:{x:1,y:Math.fround(2.8)},colour:[225,225,225,255],justify:false,centred:false,background:false,backgroundTextOnly:false,
  wrapX:rectangle.cornerB.x,centreSize:640,backgroundColour:[0,0,0,190],proportional:true,dropShadowColour:[0,0,0,255],dropShadow:0,textEdge:2,
  drawBeforeFade:rectangle.drawBeforeFade,rightJustify:false,fontStyle:0,position:{x:rectangle.cornerA.x+10,y:Math.min(rectangle.cornerA.y,rectangle.cornerB.y)-16},key:rectangle.header,number1:-1,number2:-1};
}
