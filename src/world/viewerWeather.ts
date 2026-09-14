/** Euryopa's SA fog-flag interpolation, not a reconstruction of CWeather::Update.
 * Pinned source and remaining regional/weather limitations: docs/research/WEATHER.md. */
export function viewerFoggyness(oldWeather: number, newWeather = oldWeather, blend = 0): number {
  if ([oldWeather,newWeather].some(w=>!Number.isInteger(w)||w<0||w>22) || !Number.isFinite(blend)||blend<0||blend>1)
    throw new Error('Invalid viewer weather interpolation.');
  const foggy=(weather:number)=>weather===9||weather===19;
  return (foggy(oldWeather)?1-blend:0)+(foggy(newWeather)?blend:0);
}
