import type { Simulation } from '../simulation/Simulation';
import type { Vec3 } from '../core/math';
import { VEHICLE_SPAWNS } from '../world/layout';

export interface SaveData {
  version: 1; pack: 'grove-authored-1'; savedAt: string;
  position: Vec3; crouched?: boolean; heading: number; money: number; timeMinutes: number;
  vehicles: { id: string; position: Vec3; rotation: { x: number; y: number; z: number; w: number } }[];
}
function vector(value: unknown): value is Vec3 {
  if (!value || typeof value !== 'object') return false;
  const v = value as Vec3;
  return [v.x, v.y, v.z].every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 10000);
}
export function isSave(value: unknown): value is SaveData {
  if (!value || typeof value !== 'object') return false;
  const s = value as SaveData;
  const knownVehicles = new Set<string>(VEHICLE_SPAWNS.map(v => v.id));
  const insideDistrict = (p: Vec3) => Math.abs(p.x) < 240 && Math.abs(p.z - 40) < 240 && p.y > -2 && p.y < 100;
  return s.version === 1 && s.pack === 'grove-authored-1' && vector(s.position) && insideDistrict(s.position) &&
    (s.crouched === undefined || typeof s.crouched === 'boolean') &&
    typeof s.savedAt === 'string' && Number.isFinite(Date.parse(s.savedAt)) &&
    Number.isFinite(s.heading) && Number.isFinite(s.money) && s.money >= 0 &&
    Number.isFinite(s.timeMinutes) && s.timeMinutes >= 0 && s.timeMinutes < 1440 &&
    Array.isArray(s.vehicles) && s.vehicles.length === knownVehicles.size && s.vehicles.every(v => {
      if (!v || !knownVehicles.delete(v.id) || !vector(v.position) || !insideDistrict(v.position) || !vector(v.rotation) || !Number.isFinite(v.rotation.w)) return false;
      const q = v.rotation; return Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 0.01;
    });
}
export async function parseSaveFile(file: File): Promise<SaveData> {
  if (file.size > 1024 * 1024) throw new Error('This save file is too large.');
  let data: unknown;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('This file is not a readable game save.'); }
  if (!isSave(data)) throw new Error('This save is damaged or belongs to a different content version.');
  return data;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('san-andreas-local', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close another game tab to update save storage.'));
  });
}
export async function readSave(): Promise<SaveData | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('saves', 'readonly'), store = tx.objectStore('saves');
      const current = store.get('current'), previous = store.get('previous');
      tx.oncomplete = () => resolve(isSave(current.result) ? current.result : isSave(previous.result) ? previous.result : null);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export function captureSave(sim: Simulation): SaveData {
  if (sim.transition) throw new Error('Finish getting in or out before saving.');
  if (sim.activeVehicle) throw new Error('Step out of the car before saving.');
  return {
    version: 1, pack: 'grove-authored-1', savedAt: new Date().toISOString(),
    position: { ...sim.player.position }, crouched: sim.player.crouched, heading: sim.player.heading, money: sim.money, timeMinutes: sim.timeMinutes,
    vehicles: sim.vehicles.map(v => ({ id: v.id, position: { ...v.body.translation() }, rotation: { ...v.body.rotation() } })),
  };
}
export async function writeSave(data: SaveData) {
  if (!isSave(data)) throw new Error('Invalid save data.');
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite'), store = tx.objectStore('saves');
      const current = store.get('current');
      current.onsuccess = () => { if (isSave(current.result)) store.put(current.result, 'previous'); store.put(data, 'current'); };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export function restoreSave(sim: Simulation, data: SaveData) {
  if (!isSave(data)) throw new Error('This save is incompatible or damaged.');
  sim.resetPlayer();
  if (data.crouched) sim.setCrouched(true);
  const center = { ...data.position, y: data.position.y + sim.playerCenterHeight };
  sim.playerBody.setTranslation(center, true); sim.playerBody.setNextKinematicTranslation(center);
  sim.player.position = { ...data.position }; sim.player.previous = { ...data.position };
  sim.player.heading = data.heading; sim.money = data.money; sim.timeMinutes = data.timeMinutes;
  for (const record of data.vehicles) {
    const vehicle = sim.vehicles.find(v => v.id === record.id); if (!vehicle) continue;
    vehicle.body.setTranslation(record.position, true); vehicle.body.setRotation(record.rotation, true);
    vehicle.body.setLinvel({ x: 0, y: 0, z: 0 }, true); vehicle.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    vehicle.previous = { ...record.position };
  }
  sim.population.reset([sim.player.position, ...sim.vehicles.map(v => v.body.translation())]);
}
