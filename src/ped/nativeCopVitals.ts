export interface PedVitals {health:number;armour:number}
/** CCopPed constructor (PC 0x5DDC60): the ambient SWAT/FBI/army cop types have armour separate from CPed's 100 HP.
 * These are the models selected by the browser's matching native cop-type rosters. */
export function copArmour(model:string){const name=model.toLowerCase();return name==='swat'?50:name==='fbi'||name==='army'?100:0;}
export function copHealth(_model:string){return 100;}
