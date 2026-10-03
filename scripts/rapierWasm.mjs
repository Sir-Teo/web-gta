/* Rapier's compat build inlines its WebAssembly as base64 (see rapierWasmFile in vite.config.ts): the rewrite that hands
 * its loader the module's own file instead. */
import {createHash} from 'node:crypto';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
/** `code` (dist/rapier.mjs) with its one inlined module, `<decoder>.toByteArray("<base64>")` and the `.buffer` taken of
 * it, replaced by `urlName`, provided the inlined bytes are `wasm`'s. Throws otherwise, so a changed package fails the
 * build rather than the game. */
export function useRapierWasmFile(code,wasm,urlName){
 const inlined=[...code.matchAll(/[A-Za-z_$][\w$]*\.toByteArray\("([A-Za-z0-9+/]+=*)"\)(?:\.buffer)?/g)];
 if(inlined.length!==1)throw new Error(`Rapier's compat build no longer inlines one module (${inlined.length} found).`);
 if(digest(wasm)!==digest(Buffer.from(inlined[0][1],'base64')))throw new Error('The shipped rapier_wasm3d_bg.wasm is not the module the compat build inlines.');
 const at=inlined[0].index;
 return code.slice(0,at)+urlName+code.slice(at+inlined[0][0].length);
}
