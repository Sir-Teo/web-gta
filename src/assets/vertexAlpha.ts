/** Native mesh alpha checks cover the contiguous min/max vertex span, including gaps. */
export function materialVertexAlpha(palettes: readonly (Uint8Array | undefined)[], spans: readonly { min: number; max: number }[]): boolean[] {
  const count = palettes.reduce((max, colors) => Math.max(max, (colors?.length ?? 0) / 4), 0);
  // Prefix counts avoid scanning overlapping mesh spans repeatedly on large imports.
  const prefix = new Uint32Array(count + 1);
  for (let vertex = 0; vertex < count; vertex++) {
    prefix[vertex + 1] = prefix[vertex] + Number(palettes.some(colors => (colors?.[vertex * 4 + 3] ?? 255) < 255));
  }
  return spans.map(({ min, max }) => {
    return max >= min && min < count && prefix[Math.min(max + 1, count)] > prefix[min];
  });
}
