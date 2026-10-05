import { expect, test } from 'vitest';
import { RADIO_STATIONS, nextStation, radioBedParams, speechSample } from '../src/audio/native/radioSpeech';
test('radio stations cycle with per-station beds', () => {
 expect(RADIO_STATIONS).toHaveLength(11);
 expect(nextStation(RADIO_STATIONS[0], 1)).toBe(RADIO_STATIONS[1]);
 expect(nextStation(RADIO_STATIONS[0], -1)).toBe(RADIO_STATIONS[10]);
 const a = radioBedParams('K-DST'), b = radioBedParams('Bounce FM');
 expect(a.swapMin).toBeLessThan(b.swapMin);
 expect(a.speed).not.toBe(b.speed);
});
test('speech events map onto loaded vocal banks', () => {
 for (const event of ['pain', 'flee', 'greet', 'threat', 'busted', 'wasted', 'jacked'] as const) {
  const s = speechSample(event, 3);
  expect(s.bank).toBe(143);
  expect(s.sample).toBeGreaterThanOrEqual(30);
  expect(s.sample).toBeLessThan(36);
 }
});

import {RADIO_ID,RADIO_TYPE,vehicleRadioSettings} from '../src/audio/native/vehicleRadio';
import {NativeRadioTrackManager} from '../src/audio/native/NativeRadioTrackManager';
import {NativeAudioEngine} from '../src/audio/native/NativeAudioEngine';

test('VehicleAudioSettings gives each model its station and radio type',()=>{
 // Landstalker: CSR 103.9; Perennial (404): K-Jah West; Firetruck: the emergency channel; Rhino: no radio.
 expect(vehicleRadioSettings(400)).toEqual({station:8,type:RADIO_TYPE.civilian,bass:0});
 expect(vehicleRadioSettings(404)).toEqual({station:9,type:RADIO_TYPE.civilian,bass:0});
 expect(vehicleRadioSettings(407).type).toBe(RADIO_TYPE.emergency);
 expect(vehicleRadioSettings(432).type).toBe(RADIO_TYPE.disabled);
 expect(vehicleRadioSettings(481).type).toBe(RADIO_TYPE.special);
 expect(vehicleRadioSettings(487).type).toBe(RADIO_TYPE.civilian);
});

test('StartRadio: the vehicle\'s own station, the emergency channel, none, or the last one within a minute and five hours',()=>{
 const engine:any=Object.create(NativeAudioEngine.prototype);engine.radioId=RADIO_ID.off;
 engine.radioTracks=new NativeRadioTrackManager(()=>0);engine.radioClock={days:1,month:1,hours:12};engine.timeMs=0;
 expect(engine.startRadio(400,0,12,1)).toBe(true);expect(engine.radio).toBe('CSR 103.9');
 engine.tuneRadio(1);expect(engine.radio).toBe('K-Jah West');
 engine.stopRadio(1000,12,1);
 // Into a Perennial within the minute: back on the station just left, K-Jah West.
 expect(engine.startRadio(404,30000,12,1)).toBe(true);expect(engine.radio).toBe('K-Jah West');
 engine.tuneRadio(1);engine.stopRadio(40000,12,1);
 // Over a minute later the vehicle's own station.
 expect(engine.startRadio(400,200000,12,1)).toBe(true);expect(engine.radio).toBe('CSR 103.9');
 engine.stopRadio(200000,12,1);
 expect(engine.startRadio(416,210000,12,1)).toBe(true);expect(engine.radio).toBeUndefined();expect(engine.radioLabel).toBeUndefined();expect(engine.tuneRadio(1)).toBeUndefined();
 // The ambulance's emergency channel is the track manager's (NativeRadioTrackManager), asked for station 0.
 expect(engine.radioTracks.requested.stationId).toBe(RADIO_ID.emergency);expect(engine.radioTracks.initialised).toBe(true);
 engine.stopRadio(210000,12,1);
 expect(engine.startRadio(432,215000,12,1)).toBe(false);
 // The retune cycle runs through the eleven stations and off, both ways.
 engine.startRadio(400,900000,12,1);engine.radioId=11;expect(engine.tuneRadio(1)).toBe('Radio Off');expect(engine.tuneRadio(1)).toBe('Playback FM');expect(engine.tuneRadio(-1)).toBe('Radio Off');
});
