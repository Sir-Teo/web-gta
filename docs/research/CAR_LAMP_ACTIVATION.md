# Rear lamp material activation

The browser's car material adapter previously enabled rear lamps only for
braking, while WorldCar also treated the handbrake as a brake-light request.
Cars consequently retained their dark rear-lamp texture at night without a
brake pedal, and an empty car or handbrake could enable daytime rear lamps.

The selected gta-reversed revision is
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`:

- CVehicle::DoVehicleLights (PC `0x6E1A60`) processes rear static emission when
  normal lights or the force-on branch are active. With lights off it requests
  only the dynamic rear effect.
- DoTailLightEffect (`0x6E1780`) reaches the shared reversed DoLightEffectImpl.
  Dynamic rear emission requires m_pDriver, a positive BrakePedal and no
  bIsHandbrakeOn. Static night emission remains possible without that pedal.
- CVehicleModelInfo::SetupLightFlags (`0x4C8C90`) transfers render flags to the
  model; SetEditableMaterialsCB (`0x4C8220`) whitens lamp RGB and selects
  vehiclelightson128 plus gLightSurfProps (ambient 5, diffuse 1) when active.

Rear material slots now activate for accepted pedal braking or the existing
lights-on state. Front slots retain their lights-on input. WorldCar accepts
dynamic braking only with a player, active AI driver or known script driver,
positive pedal and no handbrake. Driver lookup short-circuits unless the
pedal/handbrake combination can produce dynamic light. Texture restoration,
source RGB/alpha, existing damaged-slot handling and the material's original
surface remain intact. The old no-lit-texture fallback retains its authored
colour values but follows the corrected rear activation state.

This is a material/driver-input repair, not complete DoVehicleLights parity.
Camera-facing and first-person rear acceptance, corona intensity, alarm
flashing, engine gates, pop-up lamps, bumper removal, full override behavior
and the original rear-right damage-status quirk remain separate work.

Eight new checks expose six failures before repair. The 22 focused checks
pass, including material restoration, night damaged slots, player/AI/script
pedal gates, departed drivers, handbrake suppression, light markers, existing
vehicle-light status and road pools. The legacy colour fallback expectation
now includes night rear activation. The build and all 6,247 unit tests pass
(51 skipped).

A live loaded Greenwood verifies two actual rear material slots across seven
states: day, pedal braking, handbrake, night, night with handbrake, both rear
lamps broken and restored day. Night/pedal states select the lit texture,
ambient 5 and diffuse 1. All seven states pass without page errors. The
paintjob regression passes. An initial headlight regression fails during car
entry, before any light assertion; its fixture now places CJ beside the loaded
car instead of relying on INTRO's last pose. Ordinary keyboard entry then
passes the unchanged night beam/road-pool assertions. The saved night image
also shows the rear lamps visibly lit. The normal production smoke passes
saved-game return, movement, car entry, map/waypoint, pause/resume, Rustler
takeoff and gear with zero page errors or failed requests and no inspection
hook. Flight stages take six/two game seconds within their native-clock budgets.
