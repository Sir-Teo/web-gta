import {WindowsCrtRandom} from '../core/WindowsCrtRandom';
import {requireAsset} from '../assets/binary';

/** Explicit compatibility policy: source-described float-to-uint seed cast,
 * five CRT samples per instance, including near-culled instances. The latter
 * consumption policy still requires verification against the retail executable. */
export function windowsCrtGrassSamples(seed:number,index:number):readonly [number,number,number,number,number]{
 requireAsset(Number.isFinite(seed)&&seed>=0&&seed<=1&&Number.isInteger(index)&&index>=0&&index<65536,'Invalid CRT grass sample request.');
 const random=new WindowsCrtRandom(Math.trunc(Math.fround(seed)));random.advance(index*5);
 return [random.nextUnit(),random.nextUnit(),random.nextUnit(),random.nextUnit(),random.nextUnit()];
}
