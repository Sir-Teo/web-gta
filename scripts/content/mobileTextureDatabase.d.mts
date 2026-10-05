export const GL: {readonly rgba4444: number; readonly rgba5551: number; readonly rgb565: number};
export function elementSize(type: number): number;
export function levelBytes(width: number, height: number, type: number, level: number): number;
export function levelCount(width: number, height: number, mipmapped: boolean): number;
export function runLengthDecode(src: Uint8Array, at: number, size: number, element: number, marker: number): {bytes: Uint8Array; end: number};
export function readTextureDatabase(toc: Uint8Array, dat: Uint8Array, txt: string): {name: string; id: number; type: number; width: number; height: number; levels: number; rgba: Uint8Array}[];
export function toRgba(type: number, width: number, height: number, bytes: Uint8Array): Uint8Array;
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer;
