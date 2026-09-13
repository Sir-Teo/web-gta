import * as THREE from 'three';
import { random } from '../core/math';

type Surface = 'asphalt' | 'concrete' | 'grass' | 'stucco' | 'siding' | 'roof' | 'wood' | 'fence';
export function surfaceTexture(kind: Surface, seed = 1): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const rand = random(seed);
  const bases: Record<Surface, number[]> = {
    asphalt: [118, 119, 117], concrete: [180, 174, 157], grass: [105, 121, 75],
    stucco: [212, 207, 185], siding: [211, 206, 185], roof: [153, 149, 135], wood: [174, 165, 139], fence: [0, 0, 0],
  };
  if (kind !== 'fence') {
    const pixels = ctx.createImageData(256, 256);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const grain = (rand() - 0.5) * (kind === 'grass' ? 60 : 28);
      for (let j = 0; j < 3; j++) pixels.data[i + j] = bases[kind][j] + grain;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  }
  if (kind === 'asphalt' || kind === 'concrete') {
    ctx.strokeStyle = kind === 'asphalt' ? '#3d3b3455' : '#56544933';
    ctx.lineWidth = 0.7;
    for (let k = 0; k < 5; k++) {
      let x = rand() * 256, y = rand() * 256;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 8; j++) { x += (rand() - 0.4) * 18; y += rand() * 12; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  if (kind === 'siding') for (let y = 0; y < 256; y += 20) {
    ctx.fillStyle = '#00000030'; ctx.fillRect(0, y, 256, 2);
    ctx.fillStyle = '#ffffff44'; ctx.fillRect(0, y + 2, 256, 1);
  }
  if (kind === 'roof') for (let y = 0; y < 256; y += 20) {
    ctx.fillStyle = '#00000030'; ctx.fillRect(0, y, 256, 2);
    for (let x = (y % 40 ? -24 : 0); x < 256; x += 48) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.12})`; ctx.fillRect(x, y + 2, 47, 18);
      ctx.fillStyle = '#00000025'; ctx.fillRect(x, y, 1, 20);
    }
  }
  if (kind === 'wood') for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = '#493b3b70'; ctx.fillRect(x, 0, 2, 256);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = '#3b251512'; ctx.fillRect(x + rand() * 28, rand() * 256, 1, 35 + rand() * 60); }
  }
  if (kind === 'grass') for (let i = 0; i < 5000; i++) {
    ctx.strokeStyle = rand() > 0.5 ? '#c0b17955' : '#4a552c50';
    const x = rand() * 256, y = rand() * 256;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rand() * 3 - 1.5, y - 2 - rand() * 6); ctx.stroke();
  }
  if (kind === 'fence') {
    ctx.strokeStyle = '#adb1a2bb'; ctx.lineWidth = 3;
    for (let x = -256; x < 512; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 256, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 256, 256); ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function labelTexture(text: string, background: string, color = '#dedfce', width = 256, height = 64) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(5, 5, width - 10, height - 10);
  ctx.font = `bold ${height * 0.48}px Arial`; ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, width / 2, height / 2, width - 20);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
