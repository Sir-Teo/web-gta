/* CTheScripts' card stack, which the casino's card games deal from (vidpok.scm, blackj.scm): SHUFFLE_CARD_DECKS
 * fills it and FETCH_NEXT_CARD deals. Both handlers are unreversed in gta-reversed; the iOS ones are followed (the
 * 1400-range switch at 0x1001e5e90, cases 0x1001e6d88 and 0x1001e644c): a stack of six decks' room (312 shorts at
 * 0x10079d224, the deal's position at 0x10079d494), each card 1 to 52 (blackj and vidpok draw sprite n for card n,
 * CD1C to CD13H: clubs, diamonds, spades, hearts), a dealt-out stack starting over from its top. */
export const CARDS_IN_DECK=52,MAX_DECKS=6,CARD_STACK_SIZE=CARDS_IN_DECK*MAX_DECKS;

export class ScmCardDecks {
 readonly stack=new Int16Array(CARD_STACK_SIZE);
 position=0;
 /** SHUFFLE_CARD_DECKS: the stack emptied and a list of its free slots made (0 to 311 in order); then for each card
  * 1 to 52, for each deck, the slot the list holds at (rand() & 0xffff) / 65536 × the cards left (in float,
  * truncated) takes the card and leaves the list, the rest moving up. The first decks × 52 slots end up holding the
  * shuffled cards and the rest none, and the deal starts at the top. `random16` is the low 16 bits of a rand(). */
 shuffle(decks:number,random16:()=>number){
  const f=Math.fround,count=Math.max(0,Math.min(MAX_DECKS,Math.trunc(decks)));
  this.stack.fill(0);
  const free=Array.from({length:CARD_STACK_SIZE},(_,i)=>i);
  let left=CARDS_IN_DECK*count;
  for(let card=1;card<=CARDS_IN_DECK;card++)for(let deck=0;deck<count;deck++){
   const k=Math.trunc(f(f(left)*f((random16()&0xffff)*(1/65536))));
   this.stack[free[k]]=card;free.splice(k,1);left--;
  }
  this.position=0;
 }
 /** FETCH_NEXT_CARD: the next card, the deal going back to the top past the last card shuffled in (or the stack's end). */
 next(){
  if(this.stack[this.position]===0)this.position=0;
  const card=this.stack[this.position++];
  if(this.position===CARD_STACK_SIZE)this.position=0;
  return card;
 }
}
