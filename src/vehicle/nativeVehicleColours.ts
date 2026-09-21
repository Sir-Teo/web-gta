/* CVehicleModelInfo::ChooseVehicleColour (gta-reversed ead3051): which carcols variation a new vehicle takes. The
 * model keeps `m_nLastColorVariation`, and every vehicle built from it advances that counter by the caller's shift
 * (1 for cars, bikes, boats and trains) around the model's variation count, so a model's traffic cycles through its
 * carcols line rather than repeating one paint. A model with no variations, and every model under the black traffic
 * cheat, paints all four slots with palette index 0; the pink traffic cheat paints them 126. When the model has
 * more than one variation and the chosen paint matches the player's own vehicle of that model, the counter advances
 * once more so the two do not look alike. */
export const MAX_COLOUR_VARIATIONS=8,COLOUR_VARIATION_SHIFT=1;
export interface ColourChoiceOptions {
 /** The caller's shift: 1 from CAutomobile, CBike, CBoat and CTrain. */
 shift?:number;
 /** Whether a variation's paint is the one the player's vehicle of this model already wears. */
 matchesPlayer?:(variation:number)=>boolean;
}
/** The rotating counter each model keeps (`m_nLastColorVariation`). */
export class VehicleColourRotation {
 private last=new Map<string,number>();
 /** The variation this vehicle takes, advancing the model's counter. */
 choose(model:string,numVariations:number,options:ColourChoiceOptions={}){
  const key=model.toLowerCase(),count=Math.min(Math.max(0,Math.trunc(numVariations)),MAX_COLOUR_VARIATIONS);
  if(count<=0)return 0;
  const shift=options.shift??COLOUR_VARIATION_SHIFT;
  const step=(from:number)=>((shift+from)%count+count)%count;
  let variation=step(this.last.get(key)??0);
  this.last.set(key,variation);
  if(count<=1)return variation;
  if(options.matchesPlayer?.(variation)){variation=step(variation);this.last.set(key,variation);}
  return variation;
 }
 /** The model's counter, for a snapshot. */
 lastVariation(model:string){return this.last.get(model.toLowerCase())??0;}
 reset(){this.last.clear();}
}
