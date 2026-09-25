/** CDarkel::RegisterCarBlownUpByPlayer, which every BlowUpCar calls whoever blew the vehicle up: the host counts
 * STAT_ROAD_VEHICLES_DESTROYED (cars and bikes) or STAT_BOATS_DESTROYED. The plane's BlowUpCar is unreversed. */
/** The model reaches CDarkel's RegisteredKills, which GET_NUM_OF_MODELS_KILLED_BY_PLAYER reads. */
export const vehicleDestroyed:{report?:(kind:'road'|'boat',modelId:number)=>void}={};
