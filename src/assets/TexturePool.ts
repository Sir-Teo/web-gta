import type { ModelTexture } from './modelTextures';
import { nativeTexture } from './nativeTexture';
/** Identity is the resolved source raster, never a texture name shared by unrelated TXDs. */
export class TexturePool {
  private entries = new Map<ModelTexture, { map: ReturnType<typeof nativeTexture>; references: number }>();
  acquire(source: ModelTexture) {
    let entry = this.entries.get(source);
    if (!entry) { entry = { map: nativeTexture(source), references: 0 }; this.entries.set(source, entry); }
    entry.references++; return entry.map;
  }
  release(source: ModelTexture) {
    const entry = this.entries.get(source); if (!entry) return;
    if (--entry.references === 0) { entry.map.dispose(); this.entries.delete(source); }
  }
}
