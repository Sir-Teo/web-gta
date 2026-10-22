# Scripted resurrection reset

`RESET_STUFF_UPON_RESURRECTION` (0974) now reaches the shared player-restoration path. CASINO6
(mission 90) calls it at SCM 2216991 after setting CJ's position and heading. It restores at the
current position, rather than choosing a hospital or police station, and applies no death/arrest fee.

## Native evidence

The pinned executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Handler `0x1002039d0` calls CGameLogic::ResetStuffUponResurrection at `0x1001ac0c4` (reversed
PC `0x442980`). It clears messages and interesting-vehicle tracking, clears exciting stuff within
4000, passes 720 minutes, and calls RestorePlayerStuffDuringResurrection (`0x1001ac2ec`, reversed
PC `0x442060`) with the current ped origin and rotation. It then sorts streaming, clears camera
shake/motion blur and pad shaking, removes player references, restarts population countdowns at 10,
enables controls and resets GameState and TimeOfLastEvent to zero.

There is a platform difference: the pinned PC transcription explicitly calls ClearWeapons at the
end, while the inspected iOS routine does not. CPed::ClearWeapons is `0x1003238a4`, confirmed by
the REMOVE_ALL_CHAR_WEAPONS handler at `0x1001e2b64`; neither the iOS reset nor its shared
restoration routine calls it. This port follows the inspected iOS behavior and preserves ammunition
and weapon ownership. The ordinary wasted/busted penalty remains separate and still strips weapons.

Shared restoration sets maximum health, clears armour/adrenaline, restores sprint energy, exits the
vehicle, clears wanted state, makes CJ visible/damageable, restores the follow camera and normal area,
resets garage state and script effects, and requests streaming. Native Teleport receives the current
origin plus one unit; the browser's feet therefore rise one unit before collision settles them.

## Coverage and checks

The script adapter clears the real message queues, player-safe/control flags, drunkenness, recorded
camera/pad shake and kills-since-checkpoint stat. The main host advances the shared clock/pickup time
and reuses the death/arrest restoration body, with the current origin and without the death-specific
hunger reset or close-garages-before-save prelude. It clears ambient actors, fires, projectiles and
dropped pickups using the existing world operation. Scripted resets explicitly unseat a driver or
passenger, including the existing bike/boat/aircraft exit paths.

This command remains **authored**: native player-reference invalidation, population startup bursts,
motion/drunk blur and loaded-shop removal retain existing engine limits. Its streaming request is
asynchronous rather than a native blocking SortOutStreamingAndMemory. It does not establish complete
CASINO6 recovery or mission completion.

The unit check executes the original CASINO6 instruction and verifies its shared-host dispatch,
control, camera, shaking and player-state updates. The browser executes it from a live driver's seat:
CJ exits, gains maximum health and full stamina, loses armour/wanted status, retains money and ammo,
advances exactly twelve hours and keeps his horizontal position/heading. The existing touch-wasted
regression also completes the shared hospital restoration and returns the controls.
