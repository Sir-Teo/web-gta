import { clamp } from '../core/math';

export function crouchFootTarget(phase: number, speed: number) {
  const stride = clamp(speed / 1.4, 0, 1);
  const cycle = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const swing = cycle >= Math.PI, t = (cycle % Math.PI) / Math.PI;
  const halfStep = Math.PI / 12;
  return { z: stride * halfStep * (swing ? -1 + 2 * t * t * (3 - 2 * t) : 1 - 2 * t),
    y: 0.1025 + (swing ? Math.sin(t * Math.PI) * 0.075 * stride : 0) };
}
export function solveLeg(down: number, forward: number) {
  const thigh = 0.36, shin = 0.39;
  const distance = clamp(Math.hypot(down, forward), Math.abs(thigh - shin) + 0.001, thigh + shin - 0.001);
  const knee = Math.acos(clamp((distance * distance - thigh * thigh - shin * shin) / (2 * thigh * shin), -1, 1));
  const hip = Math.atan2(-forward, down) - Math.atan2(shin * Math.sin(knee), thigh + shin * Math.cos(knee));
  return { hip, knee, ankle: -hip - knee };
}
