/* CKeyGen, pinned gta-reversed ead3051 (`Core/KeyGen.h`: `GetKey` 0x53CF00, `GetUppercaseKey` 0x53CF30 and
 * `AppendStringToKey` 0x53CF70, all reversed). The hash the game names its clothes textures, its animations and
 * much else by: CRC-32-IEEE run over the bytes, seeded with every bit set and with no final inversion, which is
 * what leaving the remainder as the key comes to. The table is the standard reflected one, built here from its
 * polynomial rather than copied. */
const POLYNOMIAL=0xedb88320,INITIAL_REMAINDER=0xffffffff;
const KEY_TABLE=(()=>{
 const table=new Uint32Array(256);
 for(let index=0;index<256;index++){
  let value=index;
  for(let bit=0;bit<8;bit++)value=value&1?(value>>>1)^POLYNOMIAL:value>>>1;
  table[index]=value>>>0;
 }
 return table;
})();
/** CKeyGen::AppendStringToKey: more bytes folded into a key already begun. */
export function appendStringToKey(key:number,text:string){
 let value=key>>>0;
 for(let index=0;index<text.length;index++)value=(KEY_TABLE[(text.charCodeAt(index)^value)&0xff]^(value>>>8))>>>0;
 return value;
}
/** CKeyGen::GetKey. */
export function nativeKey(text:string){return appendStringToKey(INITIAL_REMAINDER,text);}
/** CKeyGen::GetUppercaseKey, whose ToUppercase only lifts a to z and leaves everything else alone. */
export function nativeUppercaseKey(text:string){
 let value=INITIAL_REMAINDER;
 for(let index=0;index<text.length;index++){
  const code=text.charCodeAt(index)&0xff;
  const upper=code>=0x61&&code<=0x7a?code-0x20:code;
  value=(KEY_TABLE[(upper^value)&0xff]^(value>>>8))>>>0;
 }
 return value;
}
