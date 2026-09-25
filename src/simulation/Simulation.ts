import { CHEATS, megaPunchBlow } from './nativeCheats';
import { characterMovement } from './characterMovement';
import { currentShapeCast } from './currentShapeCast';
import { landingDamage, DEATH_RECOVERY_SECONDS } from '../health/survival';
import { GAME_MINUTES_PER_SECOND, wrapMinutes } from '../world/weather';
import { PED_ORIGIN_HEIGHT, swimResistance, swimSubmergeVelocity, swimSubmergeZ } from './nativeSwim';
import { NativeJetPack } from './nativeJetPack';
import {beginPlayerBreathFrame,handlePlayerBreath} from './playerBreath';
import { stepMoveBlend, targetMoveBlend, blendToSpeed, playerTurnStep, nativeJumpGroundSpeed, NATIVE_BLEND_RUN, NATIVE_BLEND_SPRINT, NATIVE_BLEND_WALK, NATIVE_JUMP_VERTICAL_VELOCITY, NATIVE_JUMP_GRAVITY, NATIVE_JUMP_MIN_FORWARD_SPEED, NATIVE_PED_AIR_RESISTANCE } from './nativePlayerLocomotion';
import { stepStamina, STAMINA_DRAIN, STAMINA_REGEN_IDLE } from '../locomotion/player';
import RAPIER from '@dimforge/rapier3d-compat';
import { PED_SOLVER_GROUPS } from './solverGroups';
import { physicalCanBeDamaged, type PhysicalProofs } from '../combat/nativePhysicalProofs';
import { angleDelta, clamp, damp, type Vec3 } from '../core/math';
import { CLIMB, NativeClimbTask, initialClimbHeight, testForClimb, type ClimbClip, type ClimbEntity, type ClimbWorld, type ClimbPedState } from '../ped/nativeClimb';

const SPAWN = {x:0,y:0,z:0};
const CAMERA_SHAPE_ROTATION = { x: 0, y: 0, z: 0, w: 1 };
const CAMERA_SHAPE = new RAPIER.Ball(0.2);

/** Native on-foot locomotion speeds (m/s) from ped.ifp root motion in the
 * verified content depot. WALK_player 1.556, RUN_player 5.706,
 * SPRINT_civi 9.562. Crouch uses the measured GunCrouchFwd root 3.74 m/s,
 * validated on the flat-floor fixture (crouched 0.1 autostep keeps seam drift
 * under 0.025 m/s). The jump is CTaskSimpleJump::Launch's: 8.5 over the 70 mass
 * units a frame up (about 6.07 m/s) against 0.008 a frame² (20 m/s²), a hop of
 * about 0.92 m, with the walk/run/sprint forward bands. */
export const NATIVE_WALK_SPEED = 1.556;
export const NATIVE_RUN_SPEED = 5.706;
export const NATIVE_SPRINT_SPEED = 9.562;
export const NATIVE_CROUCH_WALK_SPEED = 3.74;
/** CPhysical::ApplyGravity for a ped: GRAVITY a frame squared, in native units. */
const NATIVE_GRAVITY = 0.008;
/** Native GunCrouchFwd root-motion speed driving the crouch gait. */
export const NATIVE_CROUCH_ROOT_SPEED = 3.74;
/** STAT_PLAYER's table value. Applying this to every damage kind remains an
 * assumption: AccountForPedDamageStats is unreversed in the pinned source. */
export const NATIVE_PLAYER_DEFEND_MULT = 0.4;

export interface Controls { x: number; y: number; sprint: boolean; walk?: boolean; jump: boolean;
  /** CPad::GetJump (held) and CPad::GetExitVehicle (held), read by CTaskSimpleClimb. `jump` is the press. */
  jumpHeld?: boolean; exitVehicle?: boolean;
  /** A jump or land task owns the ped: PlayerControlZelda does not run, so the move blend and heading hold. */
  holdMove?: boolean;
  /** The RUN and SPRINT associations' blends at the jump (CTaskSimpleJump::Launch), from the character's move anims. */
  moveAssociations?: { run?: number; sprint?: number };
  /** An aimed gun's weapon.dat row: CTaskSimpleUseGun moves the ped on the GunMove clips at `moveSpeed`. */
  gunMove?: { aimWithArm: boolean; moveAim: boolean; moveFire: boolean; firing: boolean; moveSpeed: number }; cameraYaw: number; facing?:number; parachute?:boolean;
  /** CTaskSimpleDuck's move clip and crouch-walk speed while crouched (see nativeDuck). */
  duck?: { clip: import('../locomotion/nativeDuck').DuckMoveClip; speed: number }; animationMotion?: { x: number; z: number }; animationMotionY?: number; animationMotionSpace?: 'world' | 'actor'; swimWater?: number;
  /** CTaskSimpleJetPack owns the ped: it flies on the pack's thrust and hangs in the idle pose. */
  jetPack?: boolean;
  /** The camera's pitch (radians, up positive), which steers an underwater swimmer (CTaskSimpleSwim mouse mode). */
  cameraPitch?: number }
/** Renderer height below which the player has left the world (no San Andreas ground lies under -50). */
export const WORLD_FLOOR_Y = -100;
export class Simulation {
  animationMovement: { requested: { x: number; z: number }; applied: { x: number; z: number } } | null = null;
  readonly world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  readonly playerBody: RAPIER.RigidBody;
  readonly playerCollider: RAPIER.Collider;
  /** The last on-foot sweep: colliders it ran into and the requested horizontal velocity (m/s). */
  lastMove: { hits: number[]; velocity: { x: number; z: number } } = { hits: [], velocity: { x: 0, z: 0 } };
  readonly character: RAPIER.KinematicCharacterController;
  cameraExcludedBody?:RAPIER.RigidBody;
  sunCollisionEligible?: (handle:number)=>boolean;
  player = { position: { ...SPAWN }, previous: { ...SPAWN }, heading: Math.PI, speed: 0, verticalSpeed: 0, grounded: false, stamina: 100, sprintExhausted: false, phase: 0, crouched: false, health: 100, armour: 0,
    /** CPlayerPedData::m_bAdrenaline: seconds left of an adrenaline pill (m_nAdrenalineEndTime), 0 when none. */
    adrenaline: 0,
   swimming: false, swimState: 0, swimBlend: 0, breath: 100, requireHandleBreath:false, swimStopTime: 0, swimDiveTime: 0, swimDiveDuration: 1, swimPitch: 0, swimVelY: 0, swimVel: { x: 0, z: 0 },
   /** Native m_fMoveBlendRatio (PlayerControlZelda) plus preserved jump momentum (CTaskSimpleJump::Launch). */
   moveBlend: 0, jumpMomentum: { x: 0, z: 0 } };
  deathRemaining = 0;
  /** ScanToGrab's view of the world and the CLIMB_* clip lengths; climbing needs both. */
  climbWorld?: ClimbWorld<ClimbEntity>;
  climbDurations?: Readonly<Record<ClimbClip, number>>;
  /** The player's CTaskSimpleClimb. */
  climb?: NativeClimbTask<ClimbEntity>;
  /** CTaskComplexInAirAndLand for a jump (m_bUsingJumpGlide), while the jump lasts: its m_bInvalidClimb, CTaskSimpleInAir's
   * m_nProcessCounter (ms of forward push) and the CLIMB_jump seconds left of a climb jump. */
  private jumpGlide?: { invalidClimb: boolean; pushMs: number; pushFrame?: number; climbJump: number };
  /** Seconds into CLIMB_jump while a climb jump's clip plays in the air (CTaskSimpleInAir keeps it until it ends). */
  get climbJumpSeconds() {
    const glide = this.jumpGlide;
    if (!glide || this.player.grounded || glide.climbJump <= 0) return undefined;
    return (this.climbDurations?.CLIMB_jump ?? .567) - glide.climbJump;
  }
  /** Horizontal speed the last on-foot step achieved (m/s), for CTaskSimpleInAir's climb gate. */
  private airSpeed = 0;
  get climbing() { return !!this.climb; }
  timeMinutes = 17 * 60 + 24;
  /** CClock::Update's game minutes per second: frozen by the midnight and orange-sky cheats, one minute a frame (30 fps)
   * under the faster clock cheat. */
  /** CClock::CurrentDay: the game weekday, 1 Monday to 6 Saturday and 7 Sunday, starting on a Thursday (4); the
   * popcycle's weekend runs from Saturday 20:00 to Monday 20:00. */
  weekDay = 4;
  /** Advance the clock by game minutes, rolling the weekday past midnight as CClock::Update does. */
  advanceClock(minutes: number) {
    const total = this.timeMinutes + minutes, days = Math.floor(total / 1440);
    this.timeMinutes = wrapMinutes(total);
    if (days > 0) this.weekDay = ((this.weekDay - 1 + days) % 7) + 1;
  }
  /** CGameLogic::PassTime's clock half: the minutes carry into hours and days, and the weekday gains the days but
   * wraps past Sunday to Monday only, not by seven. */
  passTime(minutes: number) {
    const total = this.timeMinutes + minutes, days = Math.floor(total / 1440);
    this.timeMinutes = wrapMinutes(total);
    if (days > 0) { this.weekDay += days; if (this.weekDay > 7) this.weekDay = 1; }
    return days;
  }
  clockRate() { return CHEATS.isActive('alwaysMidnight') || CHEATS.isActive('orangeSky') ? 0 : CHEATS.isActive('fasterClock') ? 30 : GAME_MINUTES_PER_SECOND; }
  money = 350;
  respawn = { ...SPAWN };
  readonly imported = true;
  constructor() {
    this.world.timestep = 1 / 60;
    this.playerBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(SPAWN.x, SPAWN.y + 0.9, SPAWN.z));
    // Car contacts are answered by the native ped branch (see playerCarHit), not by the solver.
    this.playerCollider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.6, 0.3).setSolverGroups(PED_SOLVER_GROUPS), this.playerBody);
    this.character = this.world.createCharacterController(0.025);
    this.character.enableAutostep(0.32, 0.2, false);
    this.character.enableSnapToGround(0.2);
    this.character.setMaxSlopeClimbAngle(Math.PI / 4);
    // Steep hillsides slide where climbing stops (no sticky 45–60° band).
    this.character.setMinSlopeSlideAngle(Math.PI / 4);
    // Establish broad-phase data before the first character or wheel query.
    this.world.step();
  }
  /** Once per fixed frame, including frames spent in a vehicle. */
  beginPlayerBreathFrame(dt:number){beginPlayerBreathFrame(this.player,dt*50);}
  /** Vehicle tasks share the same breath state as swimming. Drowning bypasses armour. */
  handlePlayerBreath(dt:number,decrease=true,multiplier=1){
    const result=handlePlayerBreath(this.player,decrease,multiplier,dt*50);
    if(result.damage>0)this.damagePlayer(result.damage,true);
    return result;
  }
  step(dt: number, controls: Controls) {
    if (controls.animationMotion && (!Number.isFinite(controls.animationMotion.x) || !Number.isFinite(controls.animationMotion.z))) throw new Error('Animation motion must be finite.');
  if (controls.animationMotionY !== undefined && !Number.isFinite(controls.animationMotionY)) throw new Error('Animation vertical motion must be finite.');
    if (controls.animationMotionSpace !== undefined && controls.animationMotionSpace !== 'world' && controls.animationMotionSpace !== 'actor') throw new Error('Unknown animation motion space.');
    this.animationMovement = null;
    this.advancePlayerDeath(dt);
    // A knocked-down player lies still until the get-up finishes.
    if (this.knockdown > 0) { this.knockdown = Math.max(0, this.knockdown - dt); controls = { ...controls, x: 0, y: 0, jump: false, sprint: false, animationMotion: undefined }; }
    // CTaskSimpleHitHead stands the player still until HIT_WALL ends.
    else if (this.hitHead > 0) { this.hitHead = Math.max(0, this.hitHead - dt); controls = { ...controls, x: 0, y: 0, jump: false, sprint: false, animationMotion: undefined }; }
    this.advanceClock(dt * this.clockRate());
    this.player.previous = { ...this.player.position };
    if (this.climb) this.stepClimb(dt, controls);
    else this.moveCharacter(dt, controls);
    this.world.step();
    const center = this.playerBody.translation();
    this.player.position = { x: center.x, y: center.y - this.playerCenterHeight, z: center.z };
    // Fallen out of the world: only far below the lowest ground (the sea floor is above -50). The earlier rule,
    // 30 m under the last terrain window's spawn height, sent a player who jumped off a downtown rooftop or drove
    // down a hillside back up to where the window had found him standing.
    if (this.player.position.y <= WORLD_FLOOR_Y) this.removeFallenPlayer();
  }
  /** Fixed scenery uses the spatial index; teleported actors require current shape poses. */
  private shapeBlocked(position: Vec3, rotation: RAPIER.Rotation, shape: RAPIER.Shape, excluded: RAPIER.RigidBody) {
    if (this.world.intersectionWithShape(position, rotation, shape, RAPIER.QueryFilterFlags.ONLY_FIXED,
      undefined, this.playerCollider, excluded)) return true;
    let blocked = false;
    this.world.bodies.forEach(body => {
      if (blocked || body.isFixed() || !body.isEnabled() || body.handle === excluded.handle) return;
      for (let i = 0; i < body.numColliders(); i++) {
        const collider = body.collider(i);
        if (collider.isEnabled() && collider.handle !== this.playerCollider.handle &&
          collider.intersectsShape(shape, position, rotation)) { blocked = true; return; }
      }
    });
    return blocked;
  }
  get playerCenterHeight() { return this.player.crouched ? 0.65 : 0.9; }
  setCrouched(crouched: boolean): boolean {
    if (crouched === this.player.crouched) return true;
    const oldCenter = this.playerBody.translation();
    const center = { ...oldCenter, y: oldCenter.y + (crouched ? -0.25 : 0.25) };
    const shape = new RAPIER.Capsule(crouched ? 0.35 : 0.6, 0.3);
    // The probe sits a controller skin up: a crouched walk settles the feet into the skin and must not block on the floor.
    if (!crouched && this.shapeBlocked({ ...center, y: center.y + .025 }, { x: 0, y: 0, z: 0, w: 1 }, shape, this.playerBody)) return false;
    this.playerCollider.setShape(shape);
    // The short crouched capsule climbs numerical floor seams through full
    // autostep at speed; 0.1 keeps small steps while staying seam-glued.
    this.character.enableAutostep(crouched ? 0.1 : 0.32, 0.2, false);
    this.playerBody.setTranslation(center, true); this.playerBody.setNextKinematicTranslation(center);
    this.playerCollider.setTranslation(center);
    this.player.crouched = crouched;
    return true;
  }
  /** Whether the player is in an interior (an area other than 0), where CanSeeOutSideFromCurrArea is false. */
  indoors?: () => boolean;
  /** CPlayerInfo::m_bDoesNotGetTired, which the host reads from the script's player info. */
  neverTired?: () => boolean;
  toggleCrouch(): string {
    if (this.player.health <= 0) return '';
    if (!this.player.grounded) return '';
    return this.setCrouched(!this.player.crouched) ? '' : 'There is not enough room to stand.';
  }
  /** CPedDamageResponseCalculator::AccountForPedArmour: armour absorbs damage first, except falls and drowning. */
  /** CPlayerData::m_bCanBeDamaged, which MAKE_PLAYER_SAFE_FOR_CUTSCENE clears and restores. */
  playerCanBeDamaged=true;
  /** CPlayerInfo::m_bFireProof and CHEAT_NO_ONE_CAN_STOP_US, which the host answers. */
  playerFireProof?:()=>boolean;playerWeaponProof?:()=>boolean;
  /** CPhysical::physicalFlags' proofs on the player, which SET_CHAR_PROOFS sets. */
  playerProofs?:PhysicalProofs;
  damagePlayer(amount: number, bypassArmour = false, event?: { weapon: number; from?: { x: number; z: number }; fall?: boolean; fight?: { move: number }; piece?: number;
    /** CTaskSimplePlayerOnFire's ComputeFireDamage: health only, a CEventDamage only once it kills. */ burning?: boolean }) {
    // CEventDamage::AffectsPed rejects damage to a dead ped. Repeated hazards
    // must not re-arm the death timer while the player is waiting to respawn.
    if(this.player.health<=0)return;
    // CPlayerInfo::MakePlayerSafe clears CPlayerData::m_bCanBeDamaged and sets every physicalFlags proof, so
    // a safe player takes nothing from anything at all.
    if(!this.playerCanBeDamaged)return;
    // CEventDamage::AffectsPed: MAKE_PLAYER_FIRE_PROOF turns molotov and flamethrower damage away; ComputeWillKillPed:
    // with CHEAT_NO_ONE_CAN_STOP_US the player takes nothing from a weapon (types below WEAPON_LAST_WEAPON, 47).
    if(event&&(event.weapon===18||event.weapon===37)&&this.playerFireProof?.())return;
    // SET_CHAR_PROOFS on the player: CPhysical::CanPhysicalBeDamaged turns the weapon's class away (a fall is
    // WEAPON_FALL, collision-proofed).
    if(event&&this.playerProofs&&!physicalCanBeDamaged(this.playerProofs,event.fall?54:event.weapon))return;
    if(event&&event.weapon<47&&this.playerWeaponProof?.())return;
    // Compatibility gap: per-damage-kind stat scaling is not yet established.
    amount *= NATIVE_PLAYER_DEFEND_MULT;
    let armour = 0;
    if (!bypassArmour && this.player.armour > 0) { const absorbed = Math.min(this.player.armour, amount); this.player.armour -= absorbed; amount -= absorbed; armour = absorbed; }
    if (event && megaPunchBlow(event.weapon)) amount = this.player.health;
    // ComputeWillKillPed's ordinary branch kills below 1 HP, not just at zero.
    // CPed::m_nLastWeaponDamage: the weapon of a hit that took health (a fall is WEAPON_FALL), not one armour soaked up.
    if (event && amount > 0) this.lastWeaponDamage = event.fall ? 54 : event.weapon;
    const before=this.player.health,remaining=before-amount;
    this.player.health = remaining<1?0:remaining;
    if (this.player.health === 0) { this.deathRemaining = DEATH_RECOVERY_SECONDS; this.player.speed = 0; }
    if (event && (!event.burning || this.player.health === 0)) this.damageEvents.push({ ...event, armour, health: before - this.player.health, died: this.player.health === 0 });
  }
  /** CPed::m_nLastWeaponDamage for the player: -1 until a weapon has taken his health, and after CLEAR_CHAR_LAST_WEAPON_DAMAGE. */
  lastWeaponDamage = -1;
  /** CTaskComplexDie on the player (TASK_DIE): he dies whatever he is proof against, the task being no damage. */
  killPlayer() {
    if (this.player.health <= 0) return;
    const before = this.player.health;
    this.player.health = 0; this.deathRemaining = DEATH_RECOVERY_SECONDS; this.player.speed = 0;
    this.damageEvents.push({ weapon: 0, armour: 0, health: before, died: true });
  }
  /** CEventDamage for the player, for the reaction the renderer plays (ComputeDamageAnim / ComputeDeathAnim). */
  damageEvents: { weapon: number; from?: { x: number; z: number }; fall?: boolean; fight?: { move: number }; piece?: number; armour: number; health: number; died: boolean }[] = [];
  /** Seconds left of a fall and get-up (CTaskComplexFallAndGetUp), during which input is ignored. */
  knockdown = 0;
  /** The get-up at the end of `knockdown`; while more than this remains the player is still in the fall. */
  knockdownGetUp = 0;
  /** Seconds of CTaskSimpleHitHead left after a blocked jump. */
  hitHead = 0;
  /** CTaskSimpleHitHead::ProcessPed: blends HIT_WALL (delta 8) on the player and returns its length in seconds. */
  onHitHead?: () => number | undefined;
  /** Horizontal move speed a vehicle collision left on the player, in m/s. */
  collisionPush = { x: 0, z: 0 };
  /** The move speed (units a second) of a moving object the grounded player stands on: an escalator step. CPhysical
   * carries a ped by its ground physical's speed; the escalator's ramp is what the player really stands on here. */
  groundCarry?: (feet: { x: number; y: number; z: number }) => { x: number; y: number; z: number } | undefined;
  /** The last collision push was blocked, as CEntity::m_bIsStuck. */
  playerStuck = false;
  /** CEventHandler::ComputeVehicleDiedResponse (0x4BA8B0) assigns zero
   * health directly. This event is not an armour/stat-scaled damage hit.
   * Native scorch visuals, dying tasks and bike knock-off remain separate work. */
  /** CEntity::m_bUsesCollision on the player, which SET_CHAR_COLLISION clears: nothing makes contact with the player's
   * capsule. The capsule stays enabled, since the rest of the game reads an enabled capsule as the player being on foot,
   * and the player's own movement query does not filter by these groups, so the player still walks on the ground. */
  playerUsesCollision=true;
  setPlayerUsesCollision(uses:boolean){
    if(this.playerUsesCollision===uses)return;
    this.playerUsesCollision=uses;
    this.playerCollider.setCollisionGroups(uses?0xffffffff:0);this.playerCollider.setSolverGroups(uses?PED_SOLVER_GROUPS:0);
  }
  vehicleOccupantDied(){
    if(this.player.health<=0)return;
    this.player.health=0;this.player.speed=0;this.deathRemaining=DEATH_RECOVERY_SECONDS;
  }
  /** What the player's legs did on foot this step, for CStats::UpdateStatsWhenSprinting and UpdateStatsWhenRunning. */
  footMove: 'still' | 'run' | 'sprint' = 'still';
  private moveCharacter(dt: number, controls: Controls) {
    const wasGrounded = this.player.grounded;
    const length = this.player.health > 0 ? Math.hypot(controls.x, controls.y) : 0;
    // SA stamina: full sprint lasts ~14 s, full rest restores in ~4-5 s, walking
    // restores slower. Exhausted players are forced to walk until 30% recovers
    // (CTaskSimplePlayerOnFoot sprint gating is still the native authority).
    if (this.player.stamina <= 0) this.player.sprintExhausted = true;
    else if (this.player.stamina >= 30) this.player.sprintExhausted = false;
    const sprinting = !this.player.swimming && !this.player.crouched && controls.sprint && length > 0 && !this.player.sprintExhausted;
    // Native PlayerControlZelda blend targets (SetPlayerMoveBlendRatio: walk
    // 1.0 / run 1.8 / sprint 2.5) slewed at 0.07*TimeStep, then mapped through
    // the ped.ifp root-motion stops (walk 1.556 / run 5.706 / sprint 9.562).
    // Default (no Alt) is run; Alt walks; Shift sprints.
    const walking = !!controls.walk;
    // The launch frame is still CTaskSimpleJump's: StartLaunchAnim fixed m_fAimingRotation.
    const held = !!controls.holdMove || controls.jump && this.player.grounded;
    if (held) { /* CTaskComplexJump / CTaskSimpleLand own the ped */ }
    else if (this.player.crouched) this.player.moveBlend = stepMoveBlend(this.player.moveBlend, length > 0 ? 0.9 : 0, dt);
    // PlayerControlZelda sets the ratio straight to 0 when the stick is released; only a push slews.
    else if (length === 0 && !this.player.swimming) this.player.moveBlend = 0;
    else this.player.moveBlend = stepMoveBlend(this.player.moveBlend, this.player.swimming ? 0 : targetMoveBlend(length, walking, sprinting), dt);
    const blendSpeed = this.player.crouched ? NATIVE_CROUCH_WALK_SPEED : blendToSpeed(this.player.moveBlend);
    const speed = this.player.swimming ? 0 : length > 0 ? blendSpeed : 0;
    // Preserve the damped display speed for HUD/animation while the blend owns acceleration.
    this.player.speed += (speed - this.player.speed) * (1 - Math.exp(-18 * dt));
    // Shared stamina tick (src/locomotion/player.ts): 7/s drain, 10/22 regen. CPlayerPed::HandleSprintEnergy spends none
    // while adrenaline lasts.
    if (this.player.adrenaline > 0) this.player.adrenaline = Math.max(0, this.player.adrenaline - dt);
    // HandleSprintEnergy: sprinting costs nothing with adrenaline or while the player never gets tired
    // (SET_PLAYER_NEVER_GETS_TIRED); running is PEDMOVE_RUN, past the walk blend and not walking.
    const running = length > 0 && !walking && this.player.moveBlend > NATIVE_BLEND_WALK;
    this.footMove = this.player.swimming ? 'still' : sprinting ? 'sprint' : running ? 'run' : 'still';
    if (!this.player.swimming && !(sprinting && (this.player.adrenaline > 0 || this.neverTired?.()))) this.player.stamina = stepStamina(this.player.stamina, sprinting, running, dt);
    if (this.player.stamina === 0) this.player.sprintExhausted = true;
    let dx = 0, dz = 0;
    if (length) {
      const x = controls.x / length, y = controls.y / length;
      dx = x * Math.cos(controls.cameraYaw) - y * Math.sin(controls.cameraYaw);
      dz = -x * Math.sin(controls.cameraYaw) - y * Math.cos(controls.cameraYaw);
      // The heading turns toward m_fAimingRotation at the player's heading change rate. In the air no on-foot task steers.
      if (!held && (this.player.grounded || controls.parachute)) this.player.heading += clamp(angleDelta(this.player.heading, Math.atan2(dx, dz)), -playerTurnStep(dt), playerTurnStep(dt));
    }
    if(controls.facing!==undefined)this.player.heading=controls.facing;
    if (this.jetPack && !this.jetPack.finished) return this.moveJetPack(dt, controls);
    if (this.player.swimming && this.player.health > 0) return this.moveSwimming(dt, controls);
    // CTaskSimpleJump::ProcessPed once the launch clip ends: a climb, else CheckIfJumpBlocked, then Launch.
    let launched = false;
    if (controls.jump && this.player.grounded && !this.player.crouched && this.player.health > 0) {
      if (this.startClimb(true, dt, controls)) return;
      const blocked = this.checkIfJumpBlocked();
      // A blocked jump runs CTaskSimpleHitHead instead of CTaskSimpleInAir.
      if (blocked === 'blocked') this.hitHead = this.onHitHead?.() ?? 0;
      else {
        launched = true;
        // CTaskSimpleJump::Launch: the mega jump cheat multiplies the player's jump force by 10.
        this.player.verticalSpeed = NATIVE_JUMP_VERTICAL_VELOCITY * (CHEATS.isActive('megaJump') ? 10 : 1);
        // The ground speed goes along the heading; a climb jump goes straight up.
        const speed = blocked === 'climbJump' ? 0 : nativeJumpGroundSpeed(controls.moveAssociations ?? this.moveAssociations(sprinting)) * 50;
        this.player.jumpMomentum = { x: Math.sin(this.player.heading) * speed, z: Math.cos(this.player.heading) * speed };
        this.jumpGlide = { invalidClimb: false, pushMs: 0, climbJump: blocked === 'climbJump' ? this.climbDurations?.CLIMB_jump ?? .567 : 0 };
      }
    } else if (!this.player.grounded && this.jumpGlide && !this.jumpGlide.invalidClimb && this.player.health > 0 &&
      this.player.verticalSpeed > -.2 * 50 && this.airSpeed > .05 * 50 && this.startClimb(false, dt, controls)) return;
    // CPhysical::ApplyGravity, less the 0.35 of it CTaskSimpleInAir gives back while a climb jump's CLIMB_jump plays.
    const glide = this.player.grounded ? undefined : this.jumpGlide;
    const climbJump = !!glide && glide.climbJump > 0;
    if (glide && climbJump) glide.climbJump = Math.max(0, glide.climbJump - dt);
    this.player.verticalSpeed -= NATIVE_JUMP_GRAVITY * (climbJump ? .65 : 1) * dt;
    if (!this.player.grounded && !controls.parachute) {
      const momentum = this.player.jumpMomentum, forward = { x: Math.sin(this.player.heading), z: Math.cos(this.player.heading) };
      // CTaskSimpleInAir under CTaskComplexJump: a rising jump keeps 0.05 units per frame forward for 1000 ms of pushing.
      if (glide && !climbJump && this.player.verticalSpeed > 0 && glide.pushMs < 1000) {
        const along = momentum.x * forward.x + momentum.z * forward.z;
        if (along < NATIVE_JUMP_MIN_FORWARD_SPEED) {
          momentum.x += forward.x * (NATIVE_JUMP_MIN_FORWARD_SPEED - along); momentum.z += forward.z * (NATIVE_JUMP_MIN_FORWARD_SPEED - along);
          // m_nProcessCounter += GetTimeStepInMS, truncated once a 30 fps frame: 33 a frame.
          for (glide.pushFrame = (glide.pushFrame ?? 0) + dt * 1000; glide.pushFrame >= 100 / 3; glide.pushFrame -= 100 / 3) glide.pushMs += 33;
        }
      }
      // CPhysical::ApplyAirResistance on the whole move speed.
      const speed = Math.hypot(momentum.x, momentum.z, this.player.verticalSpeed) / 50;
      const resistance = Math.pow(Math.max(0, 1 - speed * NATIVE_PED_AIR_RESISTANCE), dt * 50);
      momentum.x *= resistance; momentum.z *= resistance; this.player.verticalSpeed *= resistance;
    }
    // Parachute flare physics: holding back (S) flares the canopy, cutting
    // descent toward -1.5 m/s while bleeding forward speed; releasing returns
    // to the -3 m/s capped fall with 4.5 m/s glide.
    if(controls.parachute&&!this.player.grounded){
     const flaring=controls.y< -0.2;
     const cap=flaring?-1.5:-3;
     this.player.verticalSpeed=Math.max(cap,this.player.verticalSpeed);
     if(flaring)this.player.verticalSpeed=Math.min(this.player.verticalSpeed+2*dt,cap);
    }
    let animationMotion = controls.animationMotion;
    if (animationMotion && controls.animationMotionSpace === 'actor') {
      // The same updated actor heading drives the rendered pose and its local stride.
      const sin = Math.sin(this.player.heading), cos = Math.cos(this.player.heading);
      animationMotion = {x:animationMotion.x*cos+animationMotion.z*sin,z:-animationMotion.x*sin+animationMotion.z*cos};
    }
    const allowedMotion = this.player.health > 0;
    // Airborne: the move speed carries on with no control (CTaskComplexInAirAndLand).
    // An open canopy glides toward the heading (4.5 m/s, 2 m/s flared).
    const flaring=controls.parachute&&!this.player.grounded&&controls.y<-0.2;
    const NATIVE_CHUTE_GLIDE = flaring?2:4.5;
    const groundRequested = { x: dx * this.player.speed * dt, z: dz * this.player.speed * dt };
    const airborne = !this.player.grounded || launched;
    const baseRequested = !this.player.grounded&&controls.parachute&&length>0
      ? { x: Math.sin(this.player.heading) * NATIVE_CHUTE_GLIDE * dt, z: Math.cos(this.player.heading) * NATIVE_CHUTE_GLIDE * dt }
      : airborne ? { x: this.player.jumpMomentum.x * dt, z: this.player.jumpMomentum.z * dt } : groundRequested;
    // Clip motion, when given, drives the ped; JUMP_glide and the fall clips give none.
    const requested = animationMotion ? { x: allowedMotion ? animationMotion.x : 0, z: allowedMotion ? animationMotion.z : 0 } : baseRequested;
    // CPhysical::ApplyCollision's impulse from a vehicle stays in the ped's move speed on top of its animation.
    const push = this.collisionPush, pushSpeed = Math.hypot(push.x, push.z);
    if (pushSpeed > 1e-3) { requested.x += push.x * dt; requested.z += push.z * dt; }
    let carryY = 0;
    if (wasGrounded && this.groundCarry) { const p = this.player.position, carry = this.groundCarry({ x: p.x, y: p.y, z: p.z }); if (carry) { requested.x += carry.x * dt; requested.z += carry.z * dt; carryY = Math.max(0, carry.y) * dt; } }
    const resolved = characterMovement(this.character, this.playerCollider, { x: requested.x, y: this.player.verticalSpeed * dt + carryY, z: requested.z });
    this.lastMove = { hits: [...resolved.hits], velocity: { x: dt > 0 ? requested.x / dt : 0, z: dt > 0 ? requested.z / dt : 0 } };
    const movement = resolved.movement;
    // CEntity::m_bIsStuck stand-in: a push the character controller could not carry out.
    this.playerStuck = pushSpeed > 1 && (movement.x * push.x + movement.z * push.z) / pushSpeed < .25 * pushSpeed * dt;
    // Authored decay shared with pedestrian impulses (exp(-5 t)).
    const decay = Math.exp(-5 * dt); push.x *= decay; push.z *= decay; if (pushSpeed * decay < 1e-3) { push.x = 0; push.z = 0; }
    if (animationMotion) {
      this.animationMovement = { requested, applied: { x: movement.x, z: movement.z } };
      this.player.speed = Math.hypot(movement.x, movement.z) / dt;
    }
    const position = this.playerBody.translation();
    this.playerBody.setNextKinematicTranslation({ x: position.x + movement.x, y: position.y + movement.y, z: position.z + movement.z });
    this.player.grounded = resolved.grounded;
    // CTaskSimpleInAir: m_fMinZSpeed keeps the fastest fall; past 0.1 units a frame down with nothing within 4 units
    // below, the ped goes into FALL_FALL. CTaskComplexInAirAndLand then lands a FALL_FALL with FALL_COLLAPSE, or, if the
    // fall ever passed 0.4 units a frame, knocks the ped flat (CTaskSimpleFall, KO_SKID_BACK, 700 ms).
    if (!this.player.grounded && !controls.parachute && !controls.jetPack) {
      this.fall.minVz = Math.min(this.fall.minVz, this.player.verticalSpeed);
      if (!this.fall.falling && this.player.verticalSpeed < -.1 * 50) {
        const p = this.playerBody.translation();
        this.fall.falling = !this.world.castRay(new RAPIER.Ray({ x: p.x, y: p.y - this.playerCenterHeight + 1, z: p.z }, { x: 0, y: -1, z: 0 }), 4, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.playerCollider, this.playerBody);
      }
    }
    if (this.player.grounded && !wasGrounded && this.player.health > 0) {
      if (this.fall.falling) { this.fallLanding = this.fall.minVz < -.4 * 50 ? 'knockdown' : 'collapse'; this.fallLandingSound = true; }
      this.damagePlayer(landingDamage(this.player.verticalSpeed), true);
    }
    if (this.player.grounded) this.fall = { minVz: 0, falling: false };
    if (this.player.grounded && this.player.verticalSpeed < 0) this.player.verticalSpeed = -0.4;
    if (this.player.grounded) { this.player.jumpMomentum = { x: 0, z: 0 }; this.jumpGlide = undefined; }
    else if (dt > 0 && !controls.parachute) {
      // Off a ledge the ped keeps the ground speed it had; a wall takes the speed into it (CPhysical::ApplyCollision).
      const applied = { x: movement.x / dt, z: movement.z / dt }, momentum = this.player.jumpMomentum;
      if (wasGrounded && !launched || Math.hypot(applied.x, applied.z) < Math.hypot(momentum.x, momentum.z) - 1e-3) this.player.jumpMomentum = applied;
    }
    this.airSpeed = dt > 0 ? Math.hypot(movement.x, movement.z) / dt : 0;
    this.player.phase += this.player.speed * dt * (this.player.crouched ? 6 : 2.8);
  }
  /** The player as a native ped: the collision centre one unit above the feet, and a heading whose forward is (−sin, cos). */
  private nativePed(): ClimbPedState {
    const p = this.player.position;
    return { position: { x: p.x, y: -p.z, z: p.y + 1 }, heading: this.player.heading - Math.PI, moveSpeed: { x: 0, y: 0, z: 0 }, isPlayer: true };
  }
  /** CTaskSimpleClimb::TestForClimb from CTaskSimpleJump::ProcessPed (the launch) or CTaskSimpleInAir::ProcessPed, then
   * the climb CTaskComplexJump or CTaskComplexInAirAndLand::ControlSubTask starts on the hold. */
  private startClimb(launch: boolean, dt: number, controls: Controls) {
    const world = this.climbWorld, durations = this.climbDurations;
    // Both the launch and the in-air test need CGame::CanSeeOutSideFromCurrArea: no climbing inside interiors.
    if (!world || !durations || this.indoors?.()) return false;
    const ped = this.nativePed(), found = testForClimb(world, ped, launch);
    // Only the in-air test records an edge without room to stand (heading −9999.9) against later tests.
    if (found === 'invalid') { if (!launch && this.jumpGlide) this.jumpGlide.invalidClimb = true; return false; }
    if (!found) return false;
    this.climb = new NativeClimbTask(found.entity, found.hold, initialClimbHeight(found.hold.position, ped.position, !launch), false, durations);
    this.player.jumpMomentum = { x: 0, z: 0 }; this.player.verticalSpeed = 0; this.player.grounded = false;
    this.stepClimb(dt, controls);
    return true;
  }
  /** One frame of the climb: the animation update, ProcessPed, then the move speed it set. */
  private stepClimb(dt: number, controls: Controls) {
    const task = this.climb!, timeStep = dt * 50, ped = this.nativePed();
    task.updateAnim(dt);
    if (this.player.health <= 0) task.abort(ped);
    const done = task.process(ped, { jump: !!controls.jumpHeld, jumpJustDown: controls.jump, exitVehicle: !!controls.exitVehicle }, this.climbWorld!, timeStep) || task.finished;
    // Standing on the top, the ground stops the finish's small downward speed.
    const fall = done && task.standing ? 0 : ped.moveSpeed.z * timeStep;
    const center = { x: ped.position.x + ped.moveSpeed.x * timeStep, y: ped.position.z + fall - 1 + this.playerCenterHeight, z: -(ped.position.y + ped.moveSpeed.y * timeStep) };
    this.playerBody.setNextKinematicTranslation(center);
    this.player.heading = ped.heading + Math.PI;
    // CTaskSimpleClimb::StartAnim's finish leaves the ped still with a zero move blend.
    this.player.speed = 0; this.player.moveBlend = 0; this.player.grounded = false; this.player.verticalSpeed = 0;
    this.lastMove = { hits: [], velocity: { x: 0, z: 0 } };
    if (!done) return;
    this.climb = undefined;
    if (task.standing) { this.player.grounded = true; this.player.verticalSpeed = -0.4; this.jumpGlide = undefined; return; }
    this.player.verticalSpeed = ped.moveSpeed.z * 50;
    this.player.jumpMomentum = { x: ped.moveSpeed.x * 50, z: -ped.moveSpeed.y * 50 };
    this.airSpeed = Math.hypot(ped.moveSpeed.x, ped.moveSpeed.y) * 50;
    // A vault ends the jump; an abort returns to CTaskComplexInAirAndLand carrying the climb's validity.
    this.jumpGlide = task.heightForPos === CLIMB.FINISHED_V ? undefined : { invalidClimb: task.invalid, pushMs: 0, climbJump: 0 };
  }
  /** CTaskSimpleJump::CheckIfJumpBlocked (0x67D590). The ped position is one unit above the feet and ms_colModelPed1's
   * spheres sit at −0.2, 0.2 and 0.6. A 0.25 sphere 0.25 ahead, 0.25 above the head sphere, makes a climb jump; the
   * spheres shrunk to 0.3 and raised 0.75 touching anything block the jump. Peds block the jump (TestCollision) but
   * never make a climb jump (TestSphereAgainstWorld with peds off). */
  private checkIfJumpBlocked(): 'blocked' | 'climbJump' | undefined {
    if (this.playerStuck) return undefined;
    const p = this.player.position, forward = { x: Math.sin(this.player.heading), z: Math.cos(this.player.heading) }, rotation = { x: 0, y: 0, z: 0, w: 1 };
    const touches = (center: Vec3, radius: number, peds = true) => this.world.intersectionWithShape(center, rotation, new RAPIER.Ball(radius),
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.playerCollider, this.playerBody, peds ? undefined : c => c.solverGroups() !== PED_SOLVER_GROUPS) !== null;
    if ([-.2, .2, .6].some(z => touches({ x: p.x, y: p.y + 1 + .75 + z, z: p.z }, .3))) return 'blocked';
    return touches({ x: p.x + forward.x * .25, y: p.y + 1 + .6 + .25, z: p.z + forward.z * .25 }, .25, false) ? 'climbJump' : undefined;
  }
  /** The RUN and SPRINT associations' blends CTaskSimpleJump::Launch reads. CPlayerPed::SetRealMoveAnim is a retail stub;
   * its Vice City ancestor blends walk into run and plays SPRINT while sprinting. The browser's walk, run and sprint
   * move-blend stops stand for those blends. */
  private moveAssociations(sprinting: boolean): { run?: number; sprint?: number } {
    const blend = this.player.moveBlend;
    if (!(blend > 0)) return {};
    if (sprinting && blend > NATIVE_BLEND_RUN) return { sprint: clamp((blend - NATIVE_BLEND_RUN) / (NATIVE_BLEND_SPRINT - NATIVE_BLEND_RUN), 0, 1) };
    return { run: clamp((blend - NATIVE_BLEND_WALK) / (NATIVE_BLEND_RUN - NATIVE_BLEND_WALK), 0, 1) };
  }
  /** CTaskSimpleInAir's fastest fall and whether it went into FALL_FALL. */
  fall = { minVz: 0, falling: false };
  /** How the last FALL_FALL landed, for the host to play: FALL_COLLAPSE, or the KO_SKID_BACK knockdown. Cleared by it. */
  fallLanding?: 'collapse' | 'knockdown';
  /** CTaskComplexInAirAndLand's AE_PED_COLLAPSE_AFTER_FALL for a FALL_FALL landing, taken by the audio. */
  fallLandingSound = false;
  /** Whether the current SWIM_BACK_TO_SURFACE has made its jump-out. */
  private swimJumpOut = false;
  /** CTaskSimpleSwim movement: clip strokes blend through resistance, the
   * submerge servo owns height on the surface, dives use clip vertical. */
  private moveSwimming(dt: number, controls: Controls) {
    const wasGrounded = this.player.grounded, timeStep = Math.max(dt * 50, 1e-6);
    // CTaskSimpleSwim::ProcessControlInput, mouse mode: m_fAimingRotation is the camera's heading, which the ped turns
    // toward at his heading change rate; only the forward stick swims (see the host's move amount).
    if (this.player.health > 0) {
      const target = Math.atan2(-Math.sin(controls.cameraYaw), -Math.cos(controls.cameraYaw));
      this.player.heading += clamp(angleDelta(this.player.heading, target), -playerTurnStep(dt), playerTurnStep(dt));
    }
    // SWIM_BACK_TO_SURFACE (ProcessControlInput): SWIM_JUMPOUT sets 8 / mass units a frame upward and runs
    // TestForClimb from the water, a hold handing CJ to the climb; while the jump-out plays, 0.3 of gravity is taken
    // back (ProcessSwimmingResistance's ApplyMoveForce).
    if (this.player.swimState === 5) {
      if (!this.swimJumpOut) {
        this.swimJumpOut = true; this.player.verticalSpeed = 8 / 70 * 50;
        if (this.startClimb(true, dt, controls)) { this.player.swimming = false; this.player.swimState = 0; this.swimJumpOut = false; return; }
      } else this.player.verticalSpeed -= NATIVE_JUMP_GRAVITY * (1 - .3) * dt;
    } else this.swimJumpOut = false;
    // CTaskSimpleSwim::ProcessControlInput's tail: the breaststroke recovers through HandleSprintEnergy(false, 0.5), the
    // crawl spends (ControlButtonSprint, unreversed: the on-foot sprint drain stands in, and like it HandleSprintEnergy
    // spends nothing with adrenaline or for a player who never gets tired) and every other state recovers at the
    // standing rate.
    const swimState = this.player.swimState, tireless = this.player.adrenaline > 0 || !!this.neverTired?.();
    this.player.stamina = clamp(this.player.stamina + (swimState === 2 ? (tireless ? 0 : -STAMINA_DRAIN) : swimState === 1 ? STAMINA_REGEN_IDLE * .5 : STAMINA_REGEN_IDLE) * dt, 0, 100);
    let animationMotion = controls.animationMotion;
    if (animationMotion && controls.animationMotionSpace === 'actor') {
      const sin = Math.sin(this.player.heading), cos = Math.cos(this.player.heading);
      animationMotion = { x: animationMotion.x * cos + animationMotion.z * sin, z: -animationMotion.x * sin + animationMotion.z * cos };
    }
    // Fallback when no native swim rig is installed (production without local
    // files): synthesize root motion from input using measured swim.ifp speeds
    // Swim_Breast 3.011m/1.3s=2.316, SWIM_crawl 2.505m/0.9s=2.783,
    // Swim_Under 2.495m/1.5s=1.663 m/s. Matches clip-driven motion when a rig exists.
    if (!animationMotion) {
      const mag = Math.hypot(controls.x, controls.y);
      if (mag > 0.01 && this.player.health > 0) {
        const state = this.player.swimState;
        const speed = state === 1 ? 2.316 : state === 2 ? 2.783 : state === 4 ? 1.663 : state === 3 ? 0.5 : 1.0;
        const nx = controls.x / mag, ny = controls.y / mag;
        const dx = nx * Math.cos(controls.cameraYaw) - ny * Math.sin(controls.cameraYaw);
        const dz = -nx * Math.sin(controls.cameraYaw) - ny * Math.cos(controls.cameraYaw);
        this.player.heading = Math.atan2(dx, dz);
        // Per-step displacement matching swimResistance output scale (velocity blended per step).
        const stepDisp = speed * dt;
        animationMotion = { x: dx * stepDisp, z: dz * stepDisp };
      }
    }
    // SWIM_UNDERWATER_SPRINTING (ProcessControlInput, mouse mode): m_fRotationX turns toward the camera's pitch at up to a
    // radian a second, drifts up by a thousandth a frame and stays within 80 degrees; the stroke's forward shift is
    // split along it, with 0.01 units a frame of rise, all through the same 0.9 resistance. Elsewhere the pitch decays.
    const underwater = this.player.swimState === 4;
    if (underwater) {
      const turn = clamp(((controls.cameraPitch ?? 0) - this.player.swimPitch) * 10, -1, 1);
      this.player.swimPitch = clamp(this.player.swimPitch + dt * turn + timeStep / 1000, -80 * Math.PI / 180, 80 * Math.PI / 180);
    } else this.player.swimPitch = Math.abs(this.player.swimPitch) > .01 ? this.player.swimPitch * Math.pow(.95, timeStep) : 0;
    // ProcessSwimmingResistance takes the stroke's shift over a 30 fps frame as a move speed in units per 1/50 s, so at
    // the game's frame rate CJ swims 50/30 of the clip's own speed (the "slower swimming at high frame rates" quirk).
    const shift = animationMotion ?? { x: 0, z: 0 };
    let stroke = { x: shift.x * 50 / 30, z: shift.z * 50 / 30 }, rise = 0;
    if (underwater) {
      const forward = Math.hypot(stroke.x, stroke.z), c = Math.cos(this.player.swimPitch);
      stroke = { x: stroke.x * c, z: stroke.z * c }; rise = Math.sin(this.player.swimPitch) * forward + .01 * timeStep;
    }
    const blended = swimResistance(this.player.swimVel, stroke, timeStep);
    this.player.swimVel = { ...blended };
    const keep = Math.pow(.9, timeStep);
    this.player.swimVelY = underwater ? this.player.swimVelY * keep + rise * (1 - keep) : 0;
    const requested = { x: blended.x, z: blended.z };
    const surface = this.player.swimState <= 2, water = controls.swimWater;
    if (surface && water !== undefined) {
      const breast = this.player.swimState === 1 ? this.player.swimBlend : 0, crawl = this.player.swimState === 2 ? 1 : 0;
      // The servo holds the ped origin (a unit above the feet) at the submerge depth, as ProcessSwimmingResistance does.
      // It limits the change against the move speed it has (damped by 0.9 a frame), so a fall into the water carries CJ
      // under and he bobs back up rather than stopping at the surface.
      const velZ = this.player.verticalSpeed / 50 * Math.pow(.9, timeStep);
      this.player.verticalSpeed = swimSubmergeVelocity(this.player.position.y + PED_ORIGIN_HEIGHT, water, swimSubmergeZ(breast, crawl), velZ, timeStep, dt) * 50;
    } else if (this.player.swimState === 3) {
      // SWIM_DIVE_UNDERWATER: the descent follows clip progress, not root motion.
      this.player.verticalSpeed = -Math.min(this.player.swimDiveTime / Math.max(this.player.swimDiveDuration, .01), 1) * .1 * 50;
    } else if (underwater && dt > 0) {
      this.player.verticalSpeed = this.player.swimVelY / dt;
    } else if (this.player.swimState === 5) {
      // Ballistic: the jump-out's own rise and fall.
    } else if (controls.animationMotionY !== undefined && dt > 0) {
      this.player.verticalSpeed = controls.animationMotionY / dt;
    } else if (surface) {
      this.player.verticalSpeed = 0;
    }
    const resolved = characterMovement(this.character, this.playerCollider, { x: requested.x, y: this.player.verticalSpeed * dt, z: requested.z });
    this.lastMove = { hits: [...resolved.hits], velocity: { x: dt > 0 ? requested.x / dt : 0, z: dt > 0 ? requested.z / dt : 0 } };
    const movement = resolved.movement;
    this.animationMovement = { requested, applied: { x: movement.x, z: movement.z } };
    this.player.speed = dt > 0 ? Math.hypot(movement.x, movement.z) / dt : 0;
    const position = this.playerBody.translation();
    this.playerBody.setNextKinematicTranslation({ x: position.x + movement.x, y: position.y + movement.y, z: position.z + movement.z });
    this.player.grounded = resolved.grounded;
    if (this.player.grounded && !wasGrounded && this.player.health > 0) {
      this.damagePlayer(landingDamage(this.player.verticalSpeed), true);
    }
    this.player.phase += this.player.speed * dt * 2.8;
  }
  /** The ROCKETMAN cheat's CTaskSimpleJetPack, while the player wears the pack. */
  jetPack?:NativeJetPack;
  /** CTimer::m_snTimeInMilliseconds while the pack flies, for the dying flier's wobble. */
  private jetMs=0;private jetFrameClock=0;
  /** The flying ped's move speed, in native units a frame. */
  private jetVelocity={x:0,y:0,z:0};
  /** The ground under the flier, for the climb fade of ProcessThrust (TheCamera::CalculateGroundHeight). */
  jetGroundHeight?:(position:{x:number;y:number;z:number})=>number;
  /** CCheat::JetpackCheat (0x439600): the player is given the task unless he already has it. */
  startJetPack(){
    if(this.jetPack&&!this.jetPack.finished)return this.jetPack;
    this.jetPack=new NativeJetPack(this.player.heading-Math.PI);
    this.jetVelocity={x:0,y:0,z:0};
    return this.jetPack;
  }
  /** CTaskSimpleJetPack::MakeAbortable: the task ends and the pack goes with it. */
  abortJetPack(){const pack=this.jetPack;if(!pack)return;pack.finished=true;this.jetPack=undefined;}
  /** CPickups::GenerateNewOne for a dropped pack, close to where the player left it. */
  onJetPackDropped?:(position:Vec3)=>void;
  /** CTaskSimpleJetPack::DropJetPack: a pickup is left where the ped stands and he walks away from it. */
  dropJetPack(){
    const pack=this.jetPack;if(!pack)return undefined;
    const position={...this.player.position};
    this.abortJetPack();this.onJetPackDropped?.(position);
    return {position};
  }
  /** One frame of CTaskSimpleJetPack::ProcessPed (0x6801F0), in this port's browser axes. */
  private moveJetPack(dt:number,controls:Controls){
    const pack=this.jetPack!,timeStep=Math.max(dt*50,1e-6),wasGrounded=this.player.grounded;
    const wasStanding=wasGrounded;
    this.jetMs=(this.jetMs+dt*1000)%0x100000000;
    this.jetFrameClock+=dt;const jetFrameDue=this.jetFrameClock>=1/30;if(jetFrameDue)this.jetFrameClock-=1/30;
    // CTaskSimpleJetPack::MakeAbortable: an EVENT_DAMAGE ends the task once the flier is dead and back on the ground;
    // a dead one still in the air keeps the pack and spins out on it.
    if(this.player.health<1){
      if(wasGrounded){this.abortJetPack();return;}
      pack.dying(this.jetMs,timeStep,()=>Math.random()<.5,Math.random,jetFrameDue);
    }else{
      // The pad's walk axis is negative forward and positive right; W also accelerates and S brakes (the PC defaults).
      const dropped=pack.processControlInput({walkUpDown:-128*clamp(controls.y,-1,1),walkLeftRight:128*clamp(controls.x,-1,1),
        accelerate:controls.y>.1,brake:controls.y<-.1,cameraHeading:controls.cameraYaw,exitVehicle:controls.exitVehicle},wasGrounded,timeStep);
      // The frame the pack is dropped the ped stands still; the next one walks again.
      if(dropped==='drop'){this.dropJetPack();return;}
    }
    const velocity=this.jetVelocity;
    // Native (x, y, z) is the renderer's (x, z, -y): the move speed lives in native units a frame.
    const position={x:this.player.position.x,y:-this.player.position.z,z:this.player.position.y};
    if(!wasGrounded)velocity.z-=NATIVE_GRAVITY*timeStep;
    else if(velocity.z<0)velocity.z=0;
    const ground=this.jetGroundHeight?.(position)??position.z;
    pack.processThrust(velocity,position,ground,wasGrounded,wasStanding,timeStep);
    pack.updateEffect(dt*30);
    // The thrust lifts the ped off the ground (bIsStanding = false); short of that the ground still holds him, as the
    // collision does for a standing ped whose move speed the nominal thrust cannot carry.
    const lifting=pack.lifts();
    if(wasGrounded&&!lifting&&velocity.z>0)velocity.z=0;
    if(!wasGrounded)this.player.heading=pack.heading+Math.PI;
    this.player.speed=Math.hypot(velocity.x,velocity.y)*50;
    this.player.verticalSpeed=velocity.z*50;
    this.player.moveBlend=0;
    const requested={x:velocity.x*50*dt,z:-velocity.y*50*dt};
    const resolved=characterMovement(this.character,this.playerCollider,{x:requested.x,y:velocity.z*50*dt,z:requested.z});
    this.lastMove={hits:[...resolved.hits],velocity:{x:dt>0?requested.x/dt:0,z:dt>0?requested.z/dt:0}};
    const movement=resolved.movement,translation=this.playerBody.translation();
    this.playerBody.setNextKinematicTranslation({x:translation.x+movement.x,y:translation.y+movement.y,z:translation.z+movement.z});
    // A ped the thrust has lifted is no longer standing, whatever the sweep found.
    this.player.grounded=resolved.grounded&&!lifting;
    if(this.player.grounded){
      if(velocity.z<0)velocity.z=0;
      velocity.x=0;velocity.y=0;
      this.player.jumpMomentum={x:0,z:0};this.jumpGlide=undefined;
    }
    this.animationMovement=null;
    this.airSpeed=dt>0?Math.hypot(movement.x,movement.z)/dt:0;
    this.player.phase+=this.player.speed*dt*2.8;
  }
  /** Set once CGameLogic drives the wasted and busted sequences: the timer
   * then only releases the seat and leaves the respawn to that state machine. */
  externalDeathRecovery=false;
  /** Death advances in vehicles too; release the seat before resetting the ped. */
  advancePlayerDeath(dt:number,beforeRespawn?:()=>void){
    if(this.deathRemaining<=0)return false;
    this.deathRemaining=Math.max(0,this.deathRemaining-dt);
    if(this.deathRemaining>0)return false;
    beforeRespawn?.();
    if(this.externalDeathRecovery)return true;
    this.resetPlayer();return true;
  }
  /** ThePaths.FindNodeClosestToCoors(PATH_TYPE_PED) for CWorld::RemoveFallenPeds, which the host answers. */
  nearestPedNode?: (position: Vec3) => Vec3 | undefined;
  /** CWorld::RemoveFallenPeds for the player: fallen through the map, he is put 2 units over the nearest pedestrian node
   * (or at -95 where there is none) with his speed reset. Health, armour and the rest stay as they were. */
  private removeFallenPlayer() {
    const p = this.player.position, node = this.nearestPedNode?.({ ...p });
    const to = node ? { x: node.x, y: node.y + 2, z: node.z } : { x: p.x, y: -95, z: p.z };
    this.playerBody.setTranslation({ x: to.x, y: to.y + this.playerCenterHeight, z: to.z }, true);
    this.playerBody.setNextKinematicTranslation({ x: to.x, y: to.y + this.playerCenterHeight, z: to.z });
    this.playerCollider.setTranslation(this.playerBody.translation());
    this.player.position = { ...to }; this.player.previous = { ...to };
    this.player.verticalSpeed = 0; this.player.speed = 0; this.player.jumpMomentum = { x: 0, z: 0 };
  }
  resetPlayer() {
    // A wasted or busted player loses the pack.
    this.abortJetPack();
    this.animationMovement = null;
    this.collisionPush = { x: 0, z: 0 }; this.playerStuck = false; this.knockdown = 0; this.knockdownGetUp = 0;
    this.climb = undefined; this.jumpGlide = undefined;

    this.player.health = 100; this.player.armour = 0; this.player.stamina = 100; this.player.sprintExhausted = false; this.player.adrenaline = 0; this.deathRemaining = 0;
    this.player.crouched = false; this.playerCollider.setShape(new RAPIER.Capsule(0.6, 0.3));
    this.character.enableAutostep(0.32, 0.2, false);
    this.playerBody.setEnabled(true);
    this.playerCollider.setEnabled(true);this.cameraExcludedBody=undefined;
    this.playerBody.setTranslation({ x: this.respawn.x, y: this.respawn.y + 0.9, z: this.respawn.z }, true);
    this.playerBody.setNextKinematicTranslation({ x: this.respawn.x, y: this.respawn.y + 0.9, z: this.respawn.z });
    this.playerCollider.setTranslation(this.playerBody.translation());
    this.player.position = { ...this.respawn }; this.player.previous = { ...this.respawn };
    this.player.speed = 0; this.player.verticalSpeed = 0; this.player.grounded = false; this.player.moveBlend = 0; this.player.jumpMomentum = { x: 0, z: 0 };
    this.player.swimming = false; this.player.swimState = 0; this.player.swimBlend = 0; this.player.breath = 100; this.player.requireHandleBreath=false; this.player.swimStopTime = 0; this.player.swimDiveTime = 0; this.player.swimDiveDuration = 1; this.player.swimVel = { x: 0, z: 0 };
  }
  /** CCollision::BuildCacheOfCameraCollision's entity filter for this frame (peds, the car being entered, vehicles
   * moving too fast relative to the player's, objects while driving fast); set by the host. */
  cameraCollisionFilter?: () => {body?: (body: RAPIER.RigidBody) => boolean; fixed?: (collider: RAPIER.Collider) => boolean};
  cameraDistance(origin: Vec3, direction: Vec3, distance: number) {
    const nearest = currentShapeCast(this.world, origin, CAMERA_SHAPE_ROTATION, direction, CAMERA_SHAPE, 0.03, distance,
      this.cameraExcludedBody, this.playerCollider, undefined, this.cameraCollisionFilter?.());
    return nearest === undefined ? distance : Math.max(0.45, nearest - 0.1);
  }
  /** Static scene collision approximates the native building-only corona LOS query.
   * Dynamic/kinematic actors and sensors must not hide the sun corona. */
  sunObstructed(sun:Vec3,camera:Vec3) {
    const direction={x:camera.x-sun.x,y:camera.y-sun.y,z:camera.z-sun.z};
    const distance=Math.hypot(direction.x,direction.y,direction.z);
    if(!Number.isFinite(distance))throw new Error('Sun sightline must be finite.');
    if(distance===0)return false;
    direction.x/=distance;direction.y/=distance;direction.z/=distance;
    return this.world.castRay(new RAPIER.Ray(sun,direction),distance,true,
      RAPIER.QueryFilterFlags.ONLY_FIXED|RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,undefined,
      collider=>this.sunCollisionEligible?.(collider.handle)??true)!==null;
  }
  dispose() { this.world.free(); }
}
