import { clamp } from '../core/math';
export interface AudioSettings { master: number; effects: number; ambience: number; muted: boolean }
export const DEFAULT_AUDIO: AudioSettings = { master: 0.7, effects: 0.8, ambience: 0.4, muted: false };
export function parseAudioSettings(value: unknown): AudioSettings {
  const data = value && typeof value === 'object' ? value as Partial<AudioSettings> : {};
  const level = (name: 'master' | 'effects' | 'ambience') => typeof data[name] === 'number' && Number.isFinite(data[name]) ? clamp(data[name], 0, 1) : DEFAULT_AUDIO[name];
  return { master: level('master'), effects: level('effects'), ambience: level('ambience'), muted: typeof data.muted === 'boolean' ? data.muted : false };
}
export function readAudioSettings(): AudioSettings {
  try { return parseAudioSettings(JSON.parse(localStorage.getItem('grove-audio-v1') ?? 'null')); } catch { return { ...DEFAULT_AUDIO }; }
}
export function saveAudioSettings(settings: AudioSettings) {
  try { localStorage.setItem('grove-audio-v1', JSON.stringify(settings)); } catch { /* Playback remains available with session settings. */ }
}
