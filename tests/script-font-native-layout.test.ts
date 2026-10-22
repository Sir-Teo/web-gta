import {expect,test} from 'vitest';
import {ScmIntroText} from '../src/engine/ScmMessages';
import {scriptRasterLayout} from '../src/ui/nativeScriptFontLayout';
import fixtures from './fixtures/native-font-layout.json';
for(const [index,c] of fixtures.cases.entries())test(`native layout capture ${index}: ${JSON.stringify(c.input)}, justify=${c.justify}, center=${c.centre}, right=${c.right}`,()=>{
 const line=new ScmIntroText().pending;Object.assign(line,{scale:{x:1,y:2},position:{x:100,y:40},textEdge:0,justify:c.justify,centred:c.centre,rightJustify:c.right,wrapX:c.wrap,centreSize:c.wrap});
 const rows=scriptRasterLayout(c.input,line).map(r=>({text:r.glyphs.map(g=>g.character).join(''),x:r.x,y:r.y,extra:r.extra}));expect(rows).toEqual(c.rows);expect(rows.length).toBe(c.count);
});
