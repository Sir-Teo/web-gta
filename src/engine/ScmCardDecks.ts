/* CTheScripts' card stack, which the casino's card games deal from (vidpok.scm, blackj.scm): SHUFFLE_CARD_DECKS
 * fills it and FETCH_NEXT_CARD deals. Both handlers are unreversed in gta-reversed; this follows re3's handlers for
 * III, which SA keeps (AUTHORED): a stack of six decks' room, each card 1 to 52 (blackj and vidpok draw sprite n for
 * card n, CD1C to CD13H: clubs, diamonds, spades, hearts), a dealt-out stack starting over from its top. */
export const CARDS_IN_DECK=52,MAX_DECKS=6,CARD_STACK_SIZE=CARDS_IN_DECK*MAX_DECKS;

export class ScmCardDecks {
 readonly stack=new Int16Array(CARD_STACK_SIZE);
 position=0;
 /** SHUFFLE_CARD_DECKS: the stack emptied, then every card of every deck in turn put in a free slot the random
  * number picks among those left (CGeneral::GetRandomNumber() % cards left), so the first decks × 52 slots hold the
  * shuffled cards and the rest none. */
 shuffle(decks:number,random:()=>number){
  const count=Math.max(0,Math.min(MAX_DECKS,Math.trunc(decks)));
  this.stack.fill(0);this.position=0;
  let left=CARDS_IN_DECK*count;
  for(let card=1;card<=CARDS_IN_DECK;card++)for(let deck=0;deck<count;deck++){
   let k=random()%left,slot=0;
   while(k>0||this.stack[slot]!==0){if(this.stack[slot]===0)k--;slot++;}
   this.stack[slot]=card;left--;
  }
 }
 /** FETCH_NEXT_CARD: the next card, the deal going back to the top past the last card shuffled in (or the stack's end). */
 next(){
  if(this.stack[this.position]===0)this.position=0;
  const card=this.stack[this.position++];
  if(this.position===CARD_STACK_SIZE)this.position=0;
  return card;
 }
}
