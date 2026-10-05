/* The radio columns of CAEVehicleAudioEntity's VehicleAudioSettings (0x860AF0), pinned gta-reversed
 * 0076f9017b4aeef7433957ac2bd8b6988e9df166 (AEVehicleAudioEntity.VehicleAudioSettings.h), one entry per model from 400
 * (LANDSTAL): the station a vehicle's radio starts on (eRadioID) and its eAERadioType. */
export const RADIO_TYPE={disabled:-1,civilian:0,special:1,unknown:2,emergency:3} as const;
/** eRadioID: 0 is the emergency channel, 1-11 the stations, 12 user tracks, 13 off. */
export const RADIO_ID={emergency:0,userTracks:12,off:13} as const;
const STATIONS=[8,5,7,2,9,4,2,13,3,10,4,6,6,1,2,5,13,3,11,10,8,11,7,13,6,3,8,13,4,7,7,10,13,13,1,13,8,11,4,3,1,13,13,3,7,8,3,3,9,13,13,5,3,3,9,3,2,2,11,1,8,7,10,3,13,13,6,4,2,3,3,2,13,8,6,10,3,5,2,9,8,13,6,9,3,9,13,3,3,3,13,4,6,3,7,3,5,13,6,2,11,13,3,7,2,3,8,11,9,13,13,3,3,3,3,2,10,4,1,3,3,7,5,13,3,3,8,4,13,1,13,13,2,6,6,1,6,13,13,7,1,5,9,7,13,3,8,4,3,9,8,11,2,3,3,10,3,7,3,8,6,4,8,3,13,5,1,6,13,13,13,7,2,9,1,10,6,3,1,11,11,1,11,3,13,8,2,9,3,5,13,13,3,3,13,13,13,13,13,13,6,13,6,1,1,3,13,13,13,6,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,0];
const TYPES=[0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,-1,-1,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,1,0,0,0,0,-1,0,0,0,3,0,0,0,0,0,0,3,0,0,0,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,3,0,1,-1,0,0,0,0,0,-1,-1,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,-1,1,0,0,-1,3,3,3,3,3,0,3,0,0,0,0,-1,-1,-1,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1];
/** The BassSetting column (eBassSetting: 0 normal, 1 cut, 2 boost), gta-reversed 01709e8e, which StartRadio hands the
 * radio: UpdateRadioVolumes takes 2 dB off a cut and adds 1.5 dB to a boost. (The BassFactor beside it is the
 * hardware's bass EQ's, which is not ported.) */
const BASS='0020000000020002000000000000020000000000000000001002011001000111000010010100020021000100000002000000000000200110000000000111000000110000000002000000000000002202000000000001101000002101001000000000000000000000000000000000000000000000';
/** A model's starting station, radio type and bass setting; models outside the table have none. */
export function vehicleRadioSettings(modelId:number){const i=modelId-400;return i>=0&&i<STATIONS.length?{station:STATIONS[i],type:TYPES[i],bass:Number(BASS[i])}:{station:RADIO_ID.off,type:RADIO_TYPE.disabled,bass:0};}
