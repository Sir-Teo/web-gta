# Playable weapons

The browser arsenal exposes all 44 native handheld IDs: 0–18 and 22–46. IDs 19–21 are internal projectile types, not additional selectable guns. Everything is unlocked for this exploration build; inventory state lasts for the current session.

## Controls and behavior

- Tab opens a searchable arsenal and pauses the world. Select a weapon to equip; refill restores ammunition for every weapon.
- Right mouse aims, left mouse while aiming or Ctrl fires/uses, R reloads or swings a melee weapon, and the wheel cycles weapons. Automatic weapons continue while fire is held. Reload clips come from each weapon's native animation group (see below); the pose follows the reload timer, freezes on pause and cancels when switching weapons.
- Pistols, automatic weapons and rifles cast collision rays; shotguns emit separate pellets. Camera aim chooses the target, then a muzzle ray checks nearby obstructions. Shots do not penetrate walls.
- Melee sweeps a short volume in front of the player. Civilians lose health, fall, recover when alive, and remain down when killed. Nearby civilians flee gunfire and explosions.
- Rockets explode on impact. The heat-seeking launcher acquires a car in the aim cone and turns toward it. Grenades bounce with a fuse; Molotovs create fire; tear gas creates a lingering cloud. Satchels remain until the detonator is used.
- Cars lose health and become disabled, darkened wrecks at zero health, with an explosion that can damage nearby cars. Destroyed cars cannot be entered. Blasts and hazards can also damage the on-foot player; fixed geometry blocks radial damage.
- Flamethrower and spray can apply short-range damage. The extinguisher removes nearby fire. Camera use downloads the rendered frame as PNG. Night vision changes the view filter; thermal mode highlights civilians. An airborne parachute slows descent to 3 m/s and uses the native canopy and hanging pose.

## Native assets and source references

`src/weapons/assets.ts` reads the packaged static world archive. Held weapons use original DFF/TXD resources, HUD icons are decoded from their TXDs, and use poses come from the original IFP packs. Name-only tracks in sniper/flamethrower clips are resolved to native skeleton bone IDs. Missing resources surface as an unavailable weapon instead of silently substituting a model.

Weapon clumps attach to the native right hand (bone 24). Their root frame is replaced by the hand transform, with no second Z-up conversion. Firearm use and reload animations layer only spine, head and arm tracks over locomotion, preserving the walking and crouching legs. A browser upper-body aim correction aligns the native firearm pose with the camera; this is not the original IK implementation. Rocket projectiles use `missile.dff`. The canopy uses `parachute.dff`, `paracx.txd` (as specified in the acquired `levelxre.ide` record 3131), and `PARA_float_O` from `parachute.ifp`.

Pinned gta-reversed reference revision: `0076f9017b4aeef7433957ac2bd8b6988e9df166`:

- [eWeaponType.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Enums/eWeaponType.h): native weapon ID roster.
- [WeaponInfo.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/WeaponInfo.cpp): native fire-type categories and WEAPON.DAT loading.
- [VisibilityPlugins.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/VisibilityPlugins.cpp): `RenderWeaponPedsForPC` copies the hand-bone matrix into the weapon root frame.
- [Ped.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Ped/Ped.cpp): native weapon model creation and gunflash frame lookup.

Projectile trajectories, explosion radii and civilian responses remain authored browser tuning; gun damage, ranges, clips, skills, fire timing and reloads now come from WEAPON.DAT as described below. Transient effects are simple renderer primitives. The runtime bounds projectiles to 24, hazards to 16 and effects to 128; assets load lazily with a small weapon cache. Switching cancels reload without refilling the old gun. Rendering assets stay separate from Rapier simulation state.

## Native WEAPON.DAT tuning

`data/weapon.dat` (11,585 bytes, SHA-256 `033b3db4…a420f8`) is now part of the hash-locked static world resources. `src/weapons/weaponData.ts` ports `CWeaponInfo::LoadWeaponData` field order for `$` gun rows, pound-sign melee rows and `%` aim offsets, including the hexadecimal flag bitfield, the 30 Hz animation-loop frames and `SetAnimLoopInfos`' 50 Hz end quantization. The inventory keeps authored catalog values only until this file loads.

- **Skill levels.** Pistol through Tec-9 (IDs 22–32) select POOR, STD or PRO rows with `CPed::GetWeaponSkill`'s player rule: PRO at the PRO row's required stat, POOR at or below the POOR stat, otherwise STD. The micro SMG and Tec-9 share one stat (`GetSkillStatIndex`). Confirmed hits add 5 skill points; `CStats::UpdateStatsWhenWeaponHit` is not reversed, so that increment remains authored. The arsenal readout shows Poor/Standard/Hitman.
- **Clips, damage and range.** Clip size, per-hit damage and weapon range come from the selected row (for example Desert Eagle 70 damage at POOR and 140 above it; M4 50 rounds; hitman pistols 34). Player shots within one metre of a civilian deal `DoBulletImpact`'s 150-point point-blank damage (not shotguns).
- **Fire timing.** On-foot instant-hit guns fire once per native use-gun loop (`loop end − start`); shotguns, projectiles and the camera also respect `CWeapon::Fire`'s `(end − start) × 900 ms` delay (camera 1,100 ms). Firing is limited to one shot per 30 Hz frame. Cooldowns are per weapon, matching `m_TimeForNextShotMs`.
- **Reloads.** Emptying a clip starts `WEAPONSTATE_RELOADING` automatically. Duration follows `GetWeaponReloadTime` (1 s for RELOAD weapons, 2 s for twin pistols, 1 s for LONG_RELOAD, otherwise the aim-offset reload sample time + 100 ms, at least 400 ms), extended while a RELOAD-flag animation is below 90% progress. Reload sounds A/B play at the `%` row's RLoadA/RLoadB (or crouched) milliseconds. R remains a browser convenience for manual reloads.
- **Animation groups.** Guns use the row's `ms_aAnimAssocDefinitions` group: fire, crouch-fire, reload and crouch-reload clips from the named IFP (for example micro SMG and Tec-9 use `colt45`, MP5 `uzi`, minigun and extinguisher `flame`, combat shotgun `buddy`, poor rifles `riflebad`). This supplies the previously missing Desert Eagle, combat shotgun, MP5 and crouched reload poses.
- **Aiming.** Free-aim spread is a uniform disk inside `CPlayerPed::GetWeaponRadiusOnScreen` (0.5 / accuracy × min(1, 15 / range), halved when crouched, minimum 0.2), mapped through the 64-unit crosshair at a 70° field of view. `FireInstantHit` itself is not reversed, so this mapping is an approximation. Standing AIMWITHARM weapons point the right upper arm; crouched or two-handed weapons turn the spine, following `CTaskSimpleUseGun::AimGun`'s arm/torso split with a browser correction rather than native IK chains.
- **Shotguns.** A first ray chooses the victim; up to 15 pellet lines (`SetUpPelletCol`'s maximum) spread with distance, and pellets on that victim multiply the row damage (`DoBulletImpact`'s incremental hit). `FireInstantHit`'s pellet count and `fWeaponSpreadRate` are not reversed; the browser uses 15 lines and 0.05 / accuracy.

## Dual wielding

At hitman skill the PRO rows for pistol, sawn-off, micro SMG and Tec-9 carry TWIN_PISTOL. A second copy of the native model is attached to BONE_L_HAND (34) with `RenderWeaponPedsForPC`'s 180° X rotation and (0.04, −0.05, 0) translation. Shots alternate hands and muzzles, the left gun flash follows the left shot, both arms point at the target, and twin reloads play the reload clip twice. Crouched hitman pistols use `2guns_crouchfire`.

## Area weapons

The flamethrower, spray can and extinguisher now emit `CShotInfo` particles: speed per native 50 Hz step, lifespan in milliseconds, `ms_afRandTable` spread, SLOWDOWN (0.96 per step) and RANDSPEED, with the original squared-distance-versus-range test preserved. Flames set civilians on fire for 7 s (`CTaskComplexOnFire` 0.5 damage per step) and have a one-in-three chance per shot to start creeping fire ahead (`FireAreaEffect`); cars within 4 m burn at 1.2 health per step. Spray damages once per shot. The extinguisher removes nearby fires and burning civilians. Molotov and creeping fires ignite civilians instead of applying blast damage.

## Stealth kills

The knife's melee row names the `stealth_kn` group. While aiming with the knife at a standing, unhurried civilian within 2.5 m whose facing points away (`CPedIntelligence::TestForStealthKill`), CJ blends `KILL_Partial`; attacking after a 1/16 s blend (`m_BlendAmount > 0.5` at blend delta 8) starts `CTaskSimpleStealthKill`. CJ plays `KILL_Knife_Player` and closes to one metre at up to 0.05 m per native step; the victim turns away, plays `KILL_Knife_Ped_Damage`, then dies with `KILL_Knife_Ped_Die`. Input is locked for the kill clip. The damage-response calculator and stealth-kill sound are not reversed/mapped.

## Drive-by firing

`CTaskSimpleGangDriveBy` is not reversed, so the browser uses an authored approximation over the verified clips (`animations/drivebys.ifp`: 8 gang poses; `animations/player_dvbys.ifp`: `Plyr_DrivebyLHS/RHS/Fwd/Bwd`). While driving, Ctrl fires the selected one-handed weapon (pistol, silenced, Desert Eagle, sawn-off, Micro SMG, MP5, AK-47, Tec-9) from the side window the camera faces, in the camera direction; automatic weapons fire while held. Player boats fire the same set over the gunwale (`CVehicle::DoDriveByShootings` runs for player boats). Shots consume ammunition, reuse the instant-hit path with the driven vehicle excluded from its rays, report `FIRE_WEAPON`, and R reloads in the car. The driver pose stays in its ride clip because the chase camera hides the native character while driving; rival turf cars arrive with posed Micro SMG shooters in the passenger seat (Gang_DrivebyLHS/RHS from the verified clips, held gun prop, muzzle rays with weapon.dat dispersion, NPC fire cadence; `src/simulation/GangDriveBy.ts`, shot counting in its snapshot).

## Remaining scope

Police vehicle pursuits, native projectile physics (`CProjectileInfo` is not reversed) and complete native sound sequencing remain unfinished. Goggles use a visual mode rather than native face attachment. Parachute steering uses normal movement controls with a descent cap rather than native parachute physics.

## Verification

`tests/weapons.test.ts` exercises ammunition, cooldowns, reload cancellation, nearest-hit collision, muzzle obstruction, shotgun pellets, fuses, rockets, remote charges, hazards and utility state. `tests/driveby.test.ts` covers window-side firing, ammunition/cooldown/crime reporting and refusal for unoccupied cars and two-handed weapons. `tests/browser/weapons.spec.ts` loads and equips every weapon, fires/reloads/pauses through real controls, downloads a camera photo, toggles vision and scope, checks native canopy rendering/descent, applies firearm damage to native civilians and cars, binds every configured reload clip, and checks that weapon overlays leave walking leg poses unchanged. Screenshots are written to `artifacts/weapons-*.png` and `artifacts/arsenal.png`.
