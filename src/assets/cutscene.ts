import { requireAsset } from './binary';
/* A cutscene's files in ANIM\CUTS.IMG: NAME.CUT (what it loads and shows), NAME.DAT (the camera's four paths) and
 * NAME.IFP (the cast's clips). The readers follow the executable, line by line. */

/** One cast member: the model it loads and the clip it plays. A model line naming more clips than one makes an object
 * per clip after the first that reuses the first's model (MODEL_USE_PREV) without being a new object (ms_bRepeatObject):
 * the clip goes onto the object made last. */
export interface CutsceneCastMember { model: string; anim: string; repeat: boolean }
export interface CutsceneText { start: number; duration: number; key: string }
export interface CutsceneAttachment { ped: number; object: number; bone: number }
export interface CutsceneRemoval { x: number; y: number; z: number; model: string }
export interface CutsceneEffect {
 name: string; start: number; end: number; object: number; part: string;
 position: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number };
}
export interface CutsceneDefinition {
 /** ms_cutsceneOffset: where the cutscene plays (the camera's paths and the cast's clips are relative to it). */
 offset: { x: number; y: number; z: number };
 cast: CutsceneCastMember[];
 texts: CutsceneText[];
 /** The clips the anim loader keeps uncompressed (LoadAnimationUncompressed): every other one is compressed as it
  * loads, as the script's own anim files are. */
 uncompressed: string[];
 attachments: CutsceneAttachment[];
 removals: CutsceneRemoval[];
 effects: CutsceneEffect[];
 /** The extracol section's first non-zero value, less one: the timecycle's extra colour (CTimeCycle::StartExtraColour);
  * none stops any extra colour. */
 extraColour?: number;
}

/** CFileLoader::LoadLine (iOS 0x1002392fc): a line with every control character and comma turned into a space, from
 * its first character above a space. */
function loadLines(text: string) {
 return text.replace(/\0[\s\S]*$/, '').split('\n').map(line => line.replace(/[\x00-\x1f,]/g, ' ').replace(/^[\x01-\x20]+/, ''));
}
const numbers = (line: string) => line.split(/[ \t]+/).filter(Boolean);
/** sscanf's %f: a float. */
const float = (token: string | undefined) => { const value = Math.fround(parseFloat(token ?? '')); requireAsset(Number.isFinite(value), 'Invalid cutscene number.'); return value; };
const int = (token: string | undefined) => { const value = parseInt(token ?? '', 10); requireAsset(Number.isInteger(value), 'Invalid cutscene integer.'); return value; };

type Section = 'none' | 'info' | 'model' | 'text' | 'uncompress' | 'attach' | 'remove' | 'peffect' | 'extracol' | 'motion';
const SECTIONS: readonly Exclude<Section, 'none'>[] = ['info', 'model', 'text', 'uncompress', 'attach', 'remove', 'peffect', 'extracol', 'motion'];

/** CCutsceneMgr::LoadCutSceneFile (gta-reversed CutsceneMgr.cpp, from 0x5B0794): the sections between their name and
 * "end"; motion is skipped. */
export function readCutsceneFile(text: string): CutsceneDefinition {
 const definition: CutsceneDefinition = { offset: { x: 0, y: 0, z: 0 }, cast: [], texts: [], uncompressed: [], attachments: [], removals: [], effects: [] };
 let section: Section = 'none', extraColourSet = false;
 for (const line of loadLines(text)) {
  if (!line) continue;
  if (line.startsWith('end')) { section = 'none'; continue; }
  const tokens = numbers(line);
  switch (section) {
   case 'none': {
    const next = SECTIONS.find(name => line.startsWith(name));
    requireAsset(!!next, `Unknown cutscene section: ${line}.`);
    section = next!; break;
   }
   case 'motion': break;
   case 'info':
    requireAsset(line.startsWith('offset'), 'Unknown cutscene info line.');
    definition.offset = { x: float(tokens[1]), y: float(tokens[2]), z: float(tokens[3]) };
    break;
   case 'model': {
    // The first value is ignored; the model's name, lower-cased; then the clips, each its own load slot.
    requireAsset(tokens.length >= 3, 'A cutscene model line names no clip.');
    const model = tokens[1].toLowerCase();
    tokens.slice(2).forEach((anim, i) => definition.cast.push({ model, anim: anim.toLowerCase(), repeat: i > 0 }));
    break;
   }
   case 'text':
    definition.texts.push({ start: int(tokens[0]), duration: int(tokens[1]), key: (tokens[2] ?? '').toUpperCase() });
    break;
   case 'uncompress': definition.uncompressed.push(tokens[0]); break;
   case 'attach': definition.attachments.push({ ped: int(tokens[0]), object: int(tokens[1]), bone: int(tokens[2]) }); break;
   case 'remove': definition.removals.push({ x: float(tokens[0]), y: float(tokens[1]), z: float(tokens[2]), model: tokens[3] ?? '' }); break;
   case 'peffect':
    definition.effects.push({
     name: tokens[0], start: int(tokens[1]), end: int(tokens[2]), object: int(tokens[3]), part: tokens[4],
     position: { x: float(tokens[5]), y: float(tokens[6]), z: float(tokens[7]) }, direction: { x: float(tokens[8]), y: float(tokens[9]), z: float(tokens[10]) },
    });
    break;
   case 'extracol': {
    if (extraColourSet) break;
    const index = int(tokens[0]);
    if (index) { definition.extraColour = index - 1; extraColourSet = true; }
    break;
   }
  }
 }
 return definition;
}

/** The camera's four paths (CCamera::m_aPathArray): the field of view and the roll keep four floats a key (time,
 * value, in and out handles), the source and the target ten (time, point, in handle, out handle). Each array starts
 * with its key count, as the executable's does, so the key times sit at 1 + stride × key. */
export interface CutsceneCameraPaths { fov: Float32Array; roll: Float32Array; position: Float32Array; target: Float32Array }
export const PATH_STRIDES = { fov: 4, roll: 4, position: 10, target: 10 } as const;

/** CCamera::LoadPathSplines (iOS 0x1002e62d8; gta-reversed leaves it to the executable). A line starting "#" is skipped.
 * A section starts with its key count (sscanf "%d"); the next count lines are read value by value (strtok ", \t",
 * atof, so "0.000000f" is 0) into the array, then a ";" line is waited for before the next count. Four sections at
 * most. */
export function readCutsceneCameraPaths(text: string): CutsceneCameraPaths {
 const arrays: Float32Array[] = [];
 let remaining = 0, awaitingCount = true, at = 0, current: Float32Array | undefined;
 for (const line of loadLines(text)) {
  if (!line || line.startsWith('#')) continue;
  if (remaining > 0) {
   remaining--;
   for (const token of numbers(line)) { requireAsset(!!current && at < current.length, 'Cutscene camera path overruns its keys.'); current![at++] = parseFloat(token) || 0; }
   continue;
  }
  if (!awaitingCount) { awaitingCount = line.startsWith(';'); continue; }
  if (arrays.length > 3) break;
  const count = int(numbers(line)[0]);
  requireAsset(count >= 0 && count <= 100000, 'Invalid cutscene camera key count.');
  current = new Float32Array((arrays.length < 2 ? 4 : 10) * count + 1);current[0] = count;at = 1;
  arrays.push(current);remaining = count;awaitingCount = false;
 }
 requireAsset(arrays.length === 4, 'A cutscene camera file has four paths.');
 const [fov, roll, position, target] = arrays;
 return { fov, roll, position, target };
}
