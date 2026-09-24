/** CDarkel::RegisterCarBlownUpByPlayer, which every BlowUpCar calls whoever blew the vehicle up: the host counts
 * STAT_ROAD_VEHICLES_DESTROYED (cars and bikes) or STAT_BOATS_DESTROYED. The plane's BlowUpCar is unreversed. */
export const vehicleDestroyed:{report?:(kind:'road'|'boat')=>void}={};
