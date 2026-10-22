# Scorched pedestrian lighting after vehicle destruction

Vehicle destruction now retains the pedestrian's scorched state through the player, seated scripted
occupants and corpses placed on the street by traffic, police and drive-by callbacks. Ordinary shot
victims keep normal lighting. Revival and player resurrection clear the flag.

## Native evidence

The reference checkout is gta-reversed revision `4281f82d8af83e14935ac84a69dfd1ceebb9f256`.
CEventVehicleDied::AffectsPed (`0x4B0E00`, EventVehicleDied.cpp) accepts living occupants of its
vehicle, including an occupant leaving it. Attachment alone does not make a ped an occupant.
CEventHandler::ComputeVehicleDiedResponse (`0x4BA8B0`, EventHandler.cpp) sets
CPhysical::bRenderScorched and health zero, then gives a bike/quad knock-off response or an explosion
die task. ComputeReviveResponse (`0x4B97B0`) clears the flag while restoring health and idle state.

CPed::SetupLighting (`0x553F00`) calls CRenderer::SetupLightingForEntity (`0x553E40`). Its scorched
branch replaces normal lights with grey ambient 0.18 and returns before ordinary lighting setup.
The existing native-material scorched uniform implements that branch while preserving prelight,
surface coefficients, texture and material color. Each character owns its own uniform values.

## Integration and limits

Player vehicle-death state is set only when a living player receives the existing occupant death
response. Scripted riders receive the response before the next script step reads health; attached,
removed and already dead riders are excluded. Their render poses carry the explicit pedestrian flag,
rather than inferring lighting from the vehicle's wreck status. The shared corpse-spawn path takes
an explicit flag because it also serves ordinary bullet victims. Existing vehicle callbacks supply
the destruction state. Street-ped revive and Simulation.resetPlayer clear it.

General native event scheduling, leaving-vehicle event timing, scripted rider death-task transitions
and bike knock-off behavior remain incomplete. Scripted car occupants retain the existing held seated
death pose. This change does not establish full native vehicle-death or pedestrian-render parity.

Unit coverage checks independent character uniforms through ambient and thermal changes, revive,
explicit corpse flags and the vehicle-response exclusions. Browser checks destroy all four player
vehicle classes, verify a live scripted driver's actual material uniforms, preserve an attached
pedestrian and an earlier shot victim, and execute CASINO6's original resurrection reset to restore
CJ's ordinary uniforms. The object scorched pixel checks document the shared shader's light response.
