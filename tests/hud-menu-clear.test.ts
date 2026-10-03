import {expect,test} from 'vitest';
import {clearOf} from '../src/ui/Hud';

const screen={width:844,height:390},pause={left:20,top:112,right:60,bottom:152};
test('a menu over the touch screen\'s pause button moves right past it, by a margin',()=>{
 // A shop's menu at (29, 145) of 640 x 448: from 38 px across.
 expect(clearOf({left:38,top:110,right:400,bottom:300},pause,screen)).toEqual({x:30,y:0});
 // One clear of it stays.
 expect(clearOf({left:300,top:110,right:600,bottom:300},pause,screen)).toEqual({x:0,y:0});
 expect(clearOf({left:38,top:170,right:400,bottom:300},pause,screen)).toEqual({x:0,y:0});
});
test('a menu too wide to move across moves down instead, and one that fits neither way stays',()=>{
 expect(clearOf({left:38,top:110,right:820,bottom:300},pause,screen)).toEqual({x:0,y:50});
 expect(clearOf({left:38,top:110,right:820,bottom:370},pause,screen)).toEqual({x:0,y:0});
});
