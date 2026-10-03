import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';

test('the HUD measures the visible screen, not the one a phone browser\'s hidden toolbars would leave',()=>{
 // Safari on an iPhone, and Chrome until it goes fullscreen, keep their toolbars over a page that never scrolls: 100vh
 // is the taller screen they would leave hidden, 100dvh the one shown. Every height-relative length goes through
 // --screen-h, which is 100dvh where the browser has it.
 const definition=':root{--screen-h:100vh}@supports(height:100dvh){:root{--screen-h:100dvh}}';
 const css=readFileSync('src/style.css','utf8');expect(css).toContain(definition);
 const rules=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(definition,'');
 expect([...rules.matchAll(/(?<![\w.-])\d+(?:\.\d+)?vh\b/g)].map(m=>rules.slice(Math.max(0,m.index!-30),m.index!+8))).toEqual([]);
});
