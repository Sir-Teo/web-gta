import { BinaryReader, requireAsset } from './binary';
export interface IplInstance {
  modelId: number; modelName: string | null; instanceType: number; interior: number;
  position: [number, number, number]; rotation: [number, number, number, number]; lodIndex: number;
}
export interface IplData { format: 'text' | 'binary'; instances: IplInstance[]; warnings: string[]; }
const limit = 200000;
function validate(instance: IplInstance): IplInstance {
  requireAsset(Number.isInteger(instance.modelId) && instance.modelId >= 0 && instance.modelId <= 65535, 'Invalid IPL model ID.');
  requireAsset(Number.isInteger(instance.instanceType) && instance.instanceType >= 0 && instance.instanceType <= 0xffffffff, 'Invalid IPL instance flags.');
  requireAsset(Number.isInteger(instance.lodIndex) && instance.lodIndex >= -1 && instance.lodIndex <= 0x7fffffff, 'Invalid IPL LOD reference.');
  requireAsset(instance.position.every(n => Number.isFinite(n) && Math.abs(n) <= 1e7), 'IPL position exceeds the coordinate limit.');
  requireAsset(instance.rotation.every(Number.isFinite) && Math.abs(Math.hypot(...instance.rotation) - 1) <= 0.01, 'IPL rotation must be a unit quaternion.');
  instance.interior = instance.instanceType & 255;
  return instance;
}
export function readIpl(bytes: Uint8Array): IplData {
  requireAsset(bytes.length <= 64 * 1024 * 1024, 'IPL exceeds the 64 MiB source limit.');
  if (bytes.length >= 4 && bytes[0] === 98 && bytes[1] === 110 && bytes[2] === 114 && bytes[3] === 121) return readBinary(bytes);
  let end = bytes.length; while (end > 0 && bytes[end - 1] === 0) end--;
  return readText(new TextDecoder('windows-1252').decode(bytes.subarray(0, end)));
}
function readBinary(bytes: Uint8Array): IplData {
  const reader = new BinaryReader(bytes); reader.take(4);
  const counts = Array.from({ length: 6 }, () => reader.u32());
  const ranges = Array.from({ length: 6 }, () => ({ offset: reader.u32(), size: reader.u32() }));
  const count = counts[0], offset = ranges[0].offset;
  requireAsset(count <= limit, 'IPL exceeds the 200,000 instance limit.');
  requireAsset(count === 0 || offset >= 76 && offset + count * 40 <= bytes.length, 'IPL instance range is outside the file.');
  const instances: IplInstance[] = [];
  reader.position = offset;
  for (let i = 0; i < count; i++) {
    const position: IplInstance['position'] = [reader.f32(), reader.f32(), reader.f32()];
    const rotation: IplInstance['rotation'] = [reader.f32(), reader.f32(), reader.f32(), reader.f32()];
    instances.push(validate({ position, rotation, modelId: reader.i32(), instanceType: reader.u32(), lodIndex: reader.i32(), interior: 0, modelName: null }));
  }
  return { format: 'binary', instances, warnings: counts.slice(1).some(Boolean) ? ['Non-instance binary IPL sections are not imported.'] : [] };
}
function readText(text: string): IplData {
  const instances: IplInstance[] = [], skipped = new Set<string>(); let section = '';
  for (const [index, raw] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = raw.split('#')[0].trim(); if (!line) continue;
    if (line.toLowerCase() === 'end') { section = ''; continue; }
    if (!section) { section = line.toLowerCase(); if (section !== 'inst') skipped.add(section); continue; }
    if (section !== 'inst') continue;
    const fields = line.replace(/,/g, ' ').split(/\s+/);
    requireAsset(fields.length === 11, `IPL line ${index + 1}: expected 11 San Andreas instance fields.`);
    requireAsset(/^[0-9]+$/.test(fields[0]) && /^[0-9]+$/.test(fields[2]) && /^-?[0-9]+$/.test(fields[10]), `IPL line ${index + 1}: invalid integer field.`);
    requireAsset(fields[1].length <= 24 && !/[\x00-\x20\\/.:]/.test(fields[1]), `IPL line ${index + 1}: invalid model name.`);
    instances.push(validate({ modelId: Number(fields[0]), modelName: fields[1], instanceType: Number(fields[2]), interior: 0,
      position: fields.slice(3, 6).map(Number) as IplInstance['position'], rotation: fields.slice(6, 10).map(Number) as IplInstance['rotation'], lodIndex: Number(fields[10]) }));
    requireAsset(instances.length <= limit, 'IPL exceeds the 200,000 instance limit.');
  }
  requireAsset(!section, 'Unterminated IPL section.');
  return { format: 'text', instances, warnings: [...skipped].map(name => `IPL section ${name} is not imported.`) };
}

export function matchingPlacements(data: IplData, modelName: string, modelId: number | undefined, interior: number): IplInstance[] {
  requireAsset(Number.isInteger(interior) && interior >= 0 && interior <= 255, 'Interior must be an integer from 0 to 255.');
  requireAsset(data.format !== 'binary' || modelId !== undefined, 'Binary IPL placement requires an IDE model ID.');
  return data.instances.filter(instance => instance.interior === interior && (instance.modelName !== null ? instance.modelName.toLowerCase() === modelName.toLowerCase() : instance.modelId === modelId));
}
