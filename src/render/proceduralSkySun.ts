/** Shared fallback until a local particle texture supplies the native sun sprites. */
export const proceduralSkySun = `
uniform vec3 coreDirection; uniform vec3 coronaDirection;
uniform vec3 sunCore; uniform vec3 sunCorona;
uniform float coreVisible; uniform float coronaVisible;
vec3 skySun(vec3 direction) {
  float alignment = max(0.0, dot(direction, coreDirection));
  float disc = smoothstep(0.99982, 0.99991, alignment);
  float halo = pow(max(0.0, dot(direction, coronaDirection)), 230.0) * 0.22;
  return sunCore * disc * 1.2 * coreVisible + sunCorona * halo * coronaVisible;
}`;
