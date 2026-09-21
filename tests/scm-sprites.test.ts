import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {MAX_NUM_SCRIPT_RECTANGLES,RECT_INACTIVE,RECT_MONOCOLOR,RECT_MONOCOLOR_ANGLED,RECT_TEXT,RECT_TEXTURED,ScmIntroRectangles,USE_TEXT_DISABLED,USE_TEXT_ENABLED_BY_SCRIPT} from '../src/engine/ScmMessages';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
function threadAt(bytes:Uint8Array,offset:number,game:ScmGameState,world?:Partial<ScmWorldCommands>){
 const adapter={fade(){},...world} as ScmWorldCommands;
 const host:ScmThreadHost={startScript(){throw new Error('unexpected');},game,world:adapter};
 return new ScmThread(bytes,offset,0,undefined,host);
}
const runOne=(thread:ScmThread)=>{try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};
function find(name:string){
 const bytes=file(),header=readScmHeader(bytes);
 const blocks=[decodeScmInstructions(bytes,header.entry,header.mainSize)];
 for(const m of header.missions){try{blocks.push(decodeScmInstructions(bytes,m.start,m.end));}catch{/* undecodable tail */}}
 const found=blocks.flat().find(i=>i.name===name&&i.parameters.every(p=>[1,4,5,6,9,14,15].includes(p.type)));
 expect(found,`${name} with literal operands`).toBeDefined();
 return {bytes,instruction:found!};
}

describe('script sprites and boxes',()=>{
 test('LOAD_SPRITE lowers the name into its slot',()=>{
  const {bytes,instruction}=find('LOAD_SPRITE');
  const game=new ScmGameState();
  runOne(threadAt(bytes,instruction.offset,game));
  const slot=instruction.parameters[0].value as number;
  expect(game.introRectangles.sprites[slot-1]).toBe(String(instruction.parameters[1].value).toLowerCase());
 });

 test('DRAW_SPRITE claims the next box, centred on its point and stretched to the screen',()=>{
  const {bytes,instruction}=find('DRAW_SPRITE');
  const game=new ScmGameState();
  runOne(threadAt(bytes,instruction.offset,game));
  const [slot,x,y,width,height]=instruction.parameters.map(p=>p.value as number);
  const rectangle=game.introRectangles.rectangles[0];
  expect(game.introRectangles.count).toBe(1);
  expect(rectangle.type).toBe(RECT_TEXTURED);
  expect(rectangle.textureId).toBe(slot-1);
  expect(rectangle.cornerA.x).toBeCloseTo(x-width/2,3);
  expect(rectangle.cornerB.y).toBeCloseTo(y+height/2,3);
  expect(rectangle.angle).toBe(0);
 });

 test('a wider screen stretches the corners out of the design space',()=>{
  const rectangles=new ScmIntroRectangles(1280,896);
  rectangles.drawRect(320,224,64,32,[1,2,3,4]);
  const rectangle=rectangles.rectangles[0];
  expect(rectangle.type).toBe(RECT_MONOCOLOR);
  expect(rectangle.textureId).toBe(-1);
  expect(rectangle.cornerA).toEqual({x:576,y:416});
  expect(rectangle.cornerB).toEqual({x:704,y:480});
  expect(rectangle.colour).toEqual([1,2,3,4]);
 });

 test('a rotation is stored in radians on the angled type',()=>{
  const rectangles=new ScmIntroRectangles();
  rectangles.drawSpriteWithRotation(3,100,100,20,20,90,[255,255,255,255]);
  expect(rectangles.rectangles[0].type).toBe(RECT_MONOCOLOR_ANGLED);
  expect(rectangles.rectangles[0].angle).toBeCloseTo(Math.PI/2,6);
  expect(rectangles.rectangles[0].textureId).toBe(2);
 });

 test('a window keeps eight header characters and drops the DUMMY placeholder',()=>{
  const rectangles=new ScmIntroRectangles();
  rectangles.drawWindow(10,20,30,40,'HEADER_TOO_LONG',2);
  expect(rectangles.rectangles[0].type).toBe(RECT_TEXT);
  expect(rectangles.rectangles[0].header).toBe('HEADER_T');
  expect(rectangles.rectangles[0].colour).toEqual([0,0,0,190]);
  expect(rectangles.rectangles[0].textboxStyle).toBe(2);
  rectangles.drawWindow(0,0,1,1,'DUMMY',0);
  expect(rectangles.rectangles[1].header).toBe('');
 });

 test('the before-fade flag marks the box the next draw claims',()=>{
  const rectangles=new ScmIntroRectangles();
  rectangles.setDrawBeforeFade(true);
  rectangles.drawRect(1,1,1,1,[0,0,0,255]);
  expect(rectangles.rectangles[0].drawBeforeFade).toBe(true);
  expect(rectangles.rectangles[1].drawBeforeFade).toBe(false);
 });

 test('the frame reset clears the boxes only while text commands are in use',()=>{
  const rectangles=new ScmIntroRectangles();
  rectangles.drawRect(1,1,1,1,[0,0,0,255]);
  rectangles.beginFrame(USE_TEXT_DISABLED);
  expect(rectangles.count).toBe(1);
  rectangles.beginFrame(USE_TEXT_ENABLED_BY_SCRIPT);
  expect(rectangles.count).toBe(0);
  expect(rectangles.rectangles[0].type).toBe(RECT_INACTIVE);
 });

 test('a frame cannot draw more boxes than the array holds',()=>{
  const rectangles=new ScmIntroRectangles();
  for(let i=0;i<MAX_NUM_SCRIPT_RECTANGLES;i++)rectangles.drawRect(0,0,1,1,[0,0,0,255]);
  expect(()=>rectangles.drawRect(0,0,1,1,[0,0,0,255])).toThrow('exhausted');
 });
});
