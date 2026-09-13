import { random } from '../core/math';
export function ambienceSamples(sampleRate: number, kind: 'wind' | 'crickets' | 'horn') {
  const duration = 2, data = new Float32Array(sampleRate * duration), rand = random(1803);
  let brown = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    if (kind === 'wind') { brown = (brown + (rand() * 2 - 1) * 0.025) / 1.025; data[i] = brown; }
    else if (kind === 'crickets') {
      const pulse = Math.max(0, Math.sin(t * Math.PI * 2 * 9)) ** 5;
      const group = Math.max(0, Math.sin(t * Math.PI * 2 * 0.5));
      data[i] = Math.sin(t * Math.PI * 2 * 4200) * pulse * group * 0.15;
    } else data[i] = (Math.sin(t * Math.PI * 2 * 370) + Math.sin(t * Math.PI * 2 * 440)) * 0.18;
  }
  // Very short edge fades prevent loop discontinuities in the procedural beds.
  const fade = Math.floor(sampleRate * 0.012);
  for (let i = 0; i < fade; i++) { data[i] *= i / fade; data[data.length - 1 - i] *= i / fade; }
  return data;
}
