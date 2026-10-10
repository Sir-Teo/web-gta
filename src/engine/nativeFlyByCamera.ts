import type { CutsceneCameraPaths } from '../assets/cutscene';
/* The cutscene camera, MODE_FLYBY: CCam::Process_FlyBy (iOS 0x1002e68b0; gta-reversed leaves it to the executable)
 * and its two path readers. The camera keeps its own clock in ms, steps each path's marker to the first key past the
 * clock, and reads the source and the target as cubic Béziers (each plus the cutscene offset), the roll and the field
 * of view as scalar ones. A segment of 32 ms or less is a cut: the reader steps over it. */
export interface FlyByVector { x: number; y: number; z: number }
/** The path readers' cut: a segment this short (ms) is stepped over (iOS 0x10064e430). */
const CUT_MS = 32;
/** The keys sit at 1 + stride × key; the camera's markers start at the second key's time. */
const lastKey = (path: Float32Array, stride: number) => stride * Math.trunc(path[0]) - (stride - 1);
const keyOf = (marker: number, stride: number) => Math.floor(((marker - 1) >>> 0) / stride);

/** The point reader (iOS 0x1002e64d4): stride 10, [time, point, in handle, out handle]. */
function readPoint(path: Float32Array, marker: { at: number }, t: number, offset: FlyByVector, out: FlyByVector) {
 const count = Math.trunc(path[0]), last = lastKey(path, 10), lastTime = path[last] * 1000;
 let m = marker.at;
 // The segment's length is taken before the marker moves, and kept.
 const span = (path[m] - path[m - 10]) * 1000;
 if (lastTime > t) {
  if (keyOf(m, 10) > count) m = marker.at = last;
  else if (!(span > CUT_MS)) m = marker.at = Math.floor(((m + 9) >>> 0) / 10) > count ? last : m + 10;
 }
 let u = (t - path[m - 10] * 1000) / span;
 u = u > 1 ? 1 : u >= 0 || Number.isNaN(u) ? u : 0;
 if (lastTime < t) u = 1;
 const p0x = path[m - 9], p0y = path[m - 8], p0z = path[m - 7], p1x = path[m - 3], p1y = path[m - 2], p1z = path[m - 1];
 const p2x = path[m + 4], p2y = path[m + 5], p2z = path[m + 6], p3x = path[m + 1], p3y = path[m + 2], p3z = path[m + 3];
 if (p1x === p0x && p1y === p0y && p1z === p0z) {
  out.x = p0x + u * (p3x - p0x); out.y = p0y + u * (p3y - p0y); out.z = p0z + u * (p3z - p0z);
 } else {
  const v = 1 - u, a = v * v * v, b = 3 * u * v * v, c = 3 * u * u * v, d = u * u * u;
  out.x = a * p0x + b * p1x + c * p2x + d * p3x; out.y = a * p0y + b * p1y + c * p2y + d * p3y; out.z = a * p0z + b * p1z + c * p2z + d * p3z;
 }
 out.x += offset.x; out.y += offset.y; out.z += offset.z;
}

/** The value reader (iOS 0x1002e6764): stride 4, [time, value, in handle, out handle]. Here the segment is measured
 * after the marker moves. */
function readValue(path: Float32Array, marker: { at: number }, t: number) {
 const count = Math.trunc(path[0]), last = lastKey(path, 4), lastTime = path[last] * 1000;
 let m = marker.at;
 if (lastTime > t) {
  if (keyOf(m, 4) > count) m = marker.at = last;
  else if (!((path[m] - path[m - 4]) * 1000 > CUT_MS)) m = marker.at = (((m + 3) >>> 0) >>> 2) > count ? last : m + 4;
 }
 let u = (t - path[m - 4] * 1000) / ((path[m] - path[m - 4]) * 1000);
 u = Number.isNaN(u) ? u : Math.max(Math.min(u, 1), 0);
 if (lastTime < t) u = 1;
 const from = path[m - 3], out = path[m - 1], into = path[m + 2], to = path[m + 1];
 if (out === from) return from + u * (to - from);
 const v = 1 - u;
 return from * v * v * v + out * 3 * u * v * v + into * 3 * u * u * v + to * u * u * u;
}

/** Each path's marker steps to the first key whose time (from the first key's) is past the clock. */
function stepMarker(path: Float32Array, marker: { at: number }, stride: number, t: number) {
 const first = path[1];
 while (marker.at < path.length && !((path[marker.at] - first) * 1000 > t)) marker.at += stride;
}

export class FlyByCamera {
 readonly source: FlyByVector = { x: 0, y: 0, z: 0 };
 readonly front: FlyByVector = { x: 0, y: 1, z: 0 };
 readonly up: FlyByVector = { x: 0, y: 0, z: 1 };
 /** The target the camera looks at (CCam +0x120), and its field of view (m_fFOV). */
 readonly target: FlyByVector = { x: 0, y: 0, z: 0 };
 fov: number;
 /** CCamera::m_fPositionAlongSpline: the clock over the source path's last key time, 1 once past it. */
 positionAlongSpline = 0;
 /** m_nFinishTime: the source path's last key time in ms (GetCutSceneFinishTime). */
 finishTime = 0;
 /** CCamera::m_bCutsceneFinished (FinishCutscene): the camera does nothing more. */
 finished = false;
 /** m_bStartingSpline and the clock (CCam +0x68, ms). */
 private started = false; private clock = 0;
 private readonly markers = { position: { at: 0 }, target: { at: 0 }, roll: { at: 0 }, fov: { at: 0 } };
 constructor(readonly paths: CutsceneCameraPaths, readonly offset: FlyByVector) { this.fov = paths.fov[2]; }
 /** CCamera::FinishCutscene (iOS 0x514950 on PC): the camera's clock jumps to its end. */
 finish() { this.positionAlongSpline = 1; this.finished = true; }
 /** One frame of CCam::Process_FlyBy; `timeStep` is CTimer::ms_fTimeStep (50ths of a second). */
 process(timeStep: number) {
  if (this.finished) return;
  const { paths, markers } = this;
  let t: number;
  if (this.started) { this.clock += timeStep / 50 * 1000; t = Math.trunc(this.clock); }
  else {
   this.clock = 0; this.finishTime = Math.trunc(paths.position[lastKey(paths.position, 10)] * 1000) >>> 0; this.started = true;
   markers.position.at = markers.target.at = 11; markers.roll.at = markers.fov.at = 5;
   this.fov = paths.fov[2]; t = 0;
  }
  let roll: number;
  if (t < this.finishTime) {
   this.positionAlongSpline = t / this.finishTime;
   stepMarker(paths.position, markers.position, 10, t); readPoint(paths.position, markers.position, t, this.offset, this.source);
   stepMarker(paths.target, markers.target, 10, t); readPoint(paths.target, markers.target, t, this.offset, this.target);
   stepMarker(paths.roll, markers.roll, 4, t); roll = readValue(paths.roll, markers.roll, t);
   stepMarker(paths.fov, markers.fov, 4, t); this.fov = readValue(paths.fov, markers.fov, t);
  } else {
   // Past the end: every path is read at its last key, and the markers go back to nothing.
   markers.position.at = lastKey(paths.position, 10); markers.target.at = lastKey(paths.target, 10);
   markers.roll.at = lastKey(paths.roll, 4); markers.fov.at = lastKey(paths.fov, 4);
   readPoint(paths.position, markers.position, t, this.offset, this.source); readPoint(paths.target, markers.target, t, this.offset, this.target);
   roll = readValue(paths.roll, markers.roll, t); this.fov = readValue(paths.fov, markers.fov, t);
   this.positionAlongSpline = 1;
   markers.position.at = markers.target.at = markers.roll.at = markers.fov.at = 0;
  }
  // The roll, in degrees, tilts the up vector in the world's x-z plane; Front is the source to the target.
  const angle = roll * Math.PI / 180 + Math.PI / 2, up = this.up, front = this.front;
  up.x = Math.cos(angle); up.y = 0; up.z = Math.sin(angle);
  front.x = this.target.x - this.source.x; front.y = this.target.y - this.source.y; front.z = this.target.z - this.source.z;
  normalise(front);
  const rx = up.y * front.z - up.z * front.y, ry = up.z * front.x - up.x * front.z, rz = up.x * front.y - up.y * front.x;
  up.x = front.y * rz - front.z * ry; up.y = front.z * rx - front.x * rz; up.z = front.x * ry - front.y * rx;
  normalise(up);
 }
}
/** CVector::Normalise: a vector too short to turn is left pointing along x. */
function normalise(v: FlyByVector) {
 const length = Math.hypot(v.x, v.y, v.z);
 if (length > 0) { v.x /= length; v.y /= length; v.z /= length; } else { v.x = 1; v.y = 0; v.z = 0; }
}
