import { characterMovement } from './characterMovement';
import { currentShapeCast } from './currentShapeCast';
import { landingDamage, DEATH_RECOVERY_SECONDS } from './health';
import { GAME_MINUTES_PER_SECOND, wrapMinutes } from '../world/timecycle';
import { swimResistance, swimSubmergeVelocity, swimSubmergeZ } from './nativeSwim';
import { stepMoveBlend, targetMoveBlend, blendToSpeed, blendTurnRate, NATIVE_JUMP_VERTICAL_VELOCITY, NATIVE_JUMP_GRAVITY } from './nativePlayerLocomotion';
import RAPIER from '@dimforge/rapier3d-compat';
import { angleDelta, clamp, damp, type Vec3 } from '../core/math';

const SPAWN = {x:0,y:0,z:0};

/** Native on-foot locomotion speeds (m/s) from ped.ifp root motion in the
 * verified content depot. WALK_player 1.556, RUN_player 5.706,
 * SPRINT_civi 9.562. Replaces the former authored 3.7/6.7 values so fallback
 * movement matches the clips that drive NativeCharacter when a local rig is
 * installed. Crouch keeps its authored 1.4 m/s: the measured GunCrouchFwd
 * root (3.74 m/s) is now substepped (≤15 cm) in characterMovement, but the
 * faster crouch still drifts 0.15 m on the flat-floor fixture, so the
 * fallback stays gameplay-safe pending controller validation. */
export const NATIVE_WALK_SPEED = 1.556;
export const NATIVE_RUN_SPEED = 5.706;
export const NATIVE_SPRINT_SPEED = 9.562;
export const NATIVE_CROUCH_WALK_SPEED = 1.4;
/** pedstats.dat STAT_PLAYER defend weakness 0.4x: the player takes 40% of nominal damage. */
export const NATIVE_PLAYER_DEFEND_MULT = 0.4;

export interface Controls { x: number; y: number; sprint: boolean; walk?: boolean; jump: boolean; cameraYaw: number; facing?:number; parachute?:boolean; animationMotion?: { x: number; z: number }; animationMotionY?: number; animationMotionSpace?: 'world' | 'actor'; swimWater?: number }
export class Simulation {
  animationMovement: { requested: { x: number; z: number }; applied: { x: number; z: number } } | null = null;
  readonly world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  readonly playerBody: RAPIER.RigidBody;
  readonly playerCollider: RAPIER.Collider;
  readonly character: RAPIER.KinematicCharacterController;
  cameraExcludedBody?:RAPIER.RigidBody;
  sunCollisionEligible?: (handle:number)=>boolean;
  player = { position: { ...SPAWN }, previous: { ...SPAWN }, heading: Math.PI, speed: 0, verticalSpeed: 0, grounded: false, stamina: 100, sprintExhausted: false, phase: 0, crouched: false, health: 100, armour: 0,
   swimming: false, swimState: 0, swimBlend: 0, breath: 100, swimStopTime: 0, swimDiveTime: 0, swimDiveDuration: 1, swimVel: { x: 0, z: 0 },
   /** Native m_fMoveBlendRatio (PlayerControlZelda) plus preserved jump momentum (CTaskSimpleJump::Launch). */
   moveBlend: 0, jumpMomentum: { x: 0, z: 0 } };
  deathRemaining = 0;
  timeMinutes = 17 * 60 + 24;
  money = 350;
  respawn = { ...SPAWN };
  readonly imported = true;
  constructor() {
    this.world.timestep = 1 / 60;
    this.playerBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(SPAWN.x, SPAWN.y + 0.9, SPAWN.z));
    this.playerCollider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.6, 0.3), this.playerBody);
    this.character = this.world.createCharacterController(0.025);
    this.character.enableAutostep(0.32, 0.2, false);
    this.character.enableSnapToGround(0.2);
    this.character.setMaxSlopeClimbAngle(Math.PI / 4);
    // Steep hillsides slide where climbing stops (no sticky 45–60° band).
    this.character.setMinSlopeSlideAngle(Math.PI / 4);
    // Establish broad-phase data before the first character or wheel query.
    this.world.step();
  }
  step(dt: number, controls: Controls) {
    if (controls.animationMotion && (!Number.isFinite(controls.animationMotion.x) || !Number.isFinite(controls.animationMotion.z))) throw new Error('Animation motion must be finite.');
  if (controls.animationMotionY !== undefined && !Number.isFinite(controls.animationMotionY)) throw new Error('Animation vertical motion must be finite.');
    if (controls.animationMotionSpace !== undefined && controls.animationMotionSpace !== 'world' && controls.animationMotionSpace !== 'actor') throw new Error('Unknown animation motion space.');
    this.animationMovement = null;
    if (this.deathRemaining > 0) {
      this.deathRemaining = Math.max(0, this.deathRemaining - dt);
      if (this.deathRemaining === 0) this.resetPlayer();
    }
    this.timeMinutes = wrapMinutes(this.timeMinutes + dt * GAME_MINUTES_PER_SECOND);
    this.player.previous = { ...this.player.position };
    this.moveCharacter(dt, controls);
    this.world.step();
    const center = this.playerBody.translation();
    this.player.position = { x: center.x, y: center.y - this.playerCenterHeight, z: center.z };
    if (this.player.position.y < this.respawn.y - 30) this.resetPlayer();
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
    if (!crouched && this.shapeBlocked(center, { x: 0, y: 0, z: 0, w: 1 }, shape, this.playerBody)) return false;
    this.playerCollider.setShape(shape);
    this.playerBody.setTranslation(center, true); this.playerBody.setNextKinematicTranslation(center);
    this.playerCollider.setTranslation(center);
    this.player.crouched = crouched;
    return true;
  }
  toggleCrouch(): string {
    if (this.player.health <= 0) return '';
    if (!this.player.grounded) return '';
    return this.setCrouched(!this.player.crouched) ? '' : 'There is not enough room to stand.';
  }
  /** CPedDamageResponseCalculator::AccountForPedArmour: armour absorbs damage first, except falls and drowning. */
  damagePlayer(amount: number, bypassArmour = false) {
    // pedstats.dat STAT_PLAYER defend weakness 0.4x scales all damage the player receives.
    amount *= NATIVE_PLAYER_DEFEND_MULT;
    if (!bypassArmour && this.player.armour > 0) { const absorbed = Math.min(this.player.armour, amount); this.player.armour -= absorbed; amount -= absorbed; }
    this.player.health = Math.max(0, this.player.health - amount);
    if (this.player.health === 0) { this.deathRemaining = DEATH_RECOVERY_SECONDS; this.player.speed = 0; }
  }
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
    if (this.player.crouched) this.player.moveBlend = stepMoveBlend(this.player.moveBlend, length > 0 ? 0.9 : 0, dt);
    else this.player.moveBlend = stepMoveBlend(this.player.moveBlend, this.player.swimming ? 0 : targetMoveBlend(length, walking, sprinting), dt);
    const blendSpeed = this.player.crouched ? NATIVE_CROUCH_WALK_SPEED : blendToSpeed(this.player.moveBlend);
    const speed = this.player.swimming ? 0 : length > 0 ? blendSpeed : 0;
    // Preserve the damped display speed for HUD/animation while the blend owns acceleration.
    this.player.speed += (speed - this.player.speed) * (1 - Math.exp(-18 * dt));
    if (!this.player.swimming) {
      if (sprinting) this.player.stamina = clamp(this.player.stamina - 7 * dt, 0, 100);
      else if (length > 0) this.player.stamina = clamp(this.player.stamina + 10 * dt, 0, 100);
      else this.player.stamina = clamp(this.player.stamina + 22 * dt, 0, 100);
    }
    if (this.player.stamina === 0) this.player.sprintExhausted = true;
    let dx = 0, dz = 0;
    if (length) {
      const x = controls.x / length, y = controls.y / length;
      dx = x * Math.cos(controls.cameraYaw) - y * Math.sin(controls.cameraYaw);
      dz = -x * Math.sin(controls.cameraYaw) - y * Math.cos(controls.cameraYaw);
      // Native heading follows m_fAimingRotation with slower turns at speed.
      const turnRate = blendTurnRate(this.player.moveBlend);
      this.player.heading += angleDelta(this.player.heading, Math.atan2(dx, dz)) * (1 - Math.exp(-turnRate * dt));
    }
    if(controls.facing!==undefined)this.player.heading=controls.facing;
    if (this.player.swimming && this.player.health > 0) return this.moveSwimming(dt, controls);
    // CTaskSimpleJump::Launch for the player group (m_bHighJump): preserve the
    // ground momentum and apply the mapped 8.5-force vertical velocity.
    // StartLaunchAnim blocks the launch against a forward head-height obstacle.
    if (controls.jump && this.player.grounded && !this.player.crouched && this.player.health > 0) {
      const blocked = length > 0 && this.jumpForwardBlocked(dx, dz);
      if (!blocked) {
        this.player.verticalSpeed = NATIVE_JUMP_VERTICAL_VELOCITY;
        this.player.jumpMomentum = { x: dx * this.player.speed, z: dz * this.player.speed };
      }
    }
    this.player.verticalSpeed -= NATIVE_JUMP_GRAVITY * dt;
    if(controls.parachute&&!this.player.grounded)this.player.verticalSpeed=Math.max(-3,this.player.verticalSpeed);
    let animationMotion = controls.animationMotion;
    if (animationMotion && controls.animationMotionSpace === 'actor') {
      // The same updated actor heading drives the rendered pose and its local stride.
      const sin = Math.sin(this.player.heading), cos = Math.cos(this.player.heading);
      animationMotion = {x:animationMotion.x*cos+animationMotion.z*sin,z:-animationMotion.x*sin+animationMotion.z*cos};
    }
    const allowedMotion = this.player.health > 0;
    // Airborne: native moveSpeed persists; stick only nudges it (CTaskComplexInAirAndLand).
    // An open canopy instead glides toward the heading (authored 4.5 m/s forward).
    const NATIVE_CHUTE_GLIDE = 4.5;
    const groundRequested = { x: dx * this.player.speed * dt, z: dz * this.player.speed * dt };
    const airRequested = {
      x: (this.player.jumpMomentum.x * 0.92 + dx * this.player.speed * 0.08) * dt,
      z: (this.player.jumpMomentum.z * 0.92 + dz * this.player.speed * 0.08) * dt,
    };
    const baseRequested = !this.player.grounded&&controls.parachute&&length>0
      ? { x: Math.sin(this.player.heading) * NATIVE_CHUTE_GLIDE * dt, z: Math.cos(this.player.heading) * NATIVE_CHUTE_GLIDE * dt }
      : this.player.grounded ? groundRequested : length > 0 ? airRequested : { x: this.player.jumpMomentum.x * dt, z: this.player.jumpMomentum.z * dt };
    const requested = animationMotion ? { x: allowedMotion ? animationMotion.x : 0, z: allowedMotion ? animationMotion.z : 0 } : baseRequested;
    const resolved = characterMovement(this.character, this.playerCollider, { x: requested.x, y: this.player.verticalSpeed * dt, z: requested.z });
    const movement = resolved.movement;
    if (animationMotion) {
      this.animationMovement = { requested, applied: { x: movement.x, z: movement.z } };
      this.player.speed = Math.hypot(movement.x, movement.z) / dt;
    }
    const position = this.playerBody.translation();
    this.playerBody.setNextKinematicTranslation({ x: position.x + movement.x, y: position.y + movement.y, z: position.z + movement.z });
    this.player.grounded = resolved.grounded;
    if (this.player.grounded && !wasGrounded && this.player.health > 0) {
      this.damagePlayer(landingDamage(this.player.verticalSpeed), true);
    }
    if (this.player.grounded && this.player.verticalSpeed < 0) this.player.verticalSpeed = -0.4;
    if (this.player.grounded) this.player.jumpMomentum = { x: 0, z: 0 };
    this.player.phase += this.player.speed * dt * (this.player.crouched ? 6 : 2.8);
  }
  /** CTaskSimpleJump::CheckIfJumpBlocked head-height probe ahead of the launch. */
  private jumpForwardBlocked(dx: number, dz: number): boolean {
    const len = Math.hypot(dx, dz);
    if (len <= 1e-4) return false;
    const center = this.playerBody.translation();
    const origin = { x: center.x + (dx / len) * 0.25, y: center.y + 0.55, z: center.z + (dz / len) * 0.25 };
    return this.world.castRay(new RAPIER.Ray(origin, { x: dx / len, y: 0, z: dz / len }), 0.5, true, RAPIER.QueryFilterFlags.ONLY_FIXED) !== null;
  }
  /** CTaskSimpleSwim movement: clip strokes blend through resistance, the
   * submerge servo owns height on the surface, dives use clip vertical. */
  private moveSwimming(dt: number, controls: Controls) {
    const wasGrounded = this.player.grounded, timeStep = Math.max(dt * 50, 1e-6);
    // Breaststroke pace drains stamina; other paces leave it alone.
    if (this.player.swimState === 1) this.player.stamina = clamp(this.player.stamina - 6 * dt, 0, 100);
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
    const blended = swimResistance(this.player.swimVel, animationMotion ?? { x: 0, z: 0 }, timeStep);
    this.player.swimVel = { ...blended };
    const requested = { x: blended.x, z: blended.z };
    const surface = this.player.swimState <= 2, water = controls.swimWater;
    if (surface && water !== undefined) {
      const breast = this.player.swimState === 1 ? this.player.swimBlend : 0, crawl = this.player.swimState === 2 ? 1 : 0;
      this.player.verticalSpeed = swimSubmergeVelocity(this.player.position.y, water, swimSubmergeZ(breast, crawl), 0, timeStep, dt) * 50;
    } else if (this.player.swimState === 3) {
      // SWIM_DIVE_UNDERWATER: the descent follows clip progress, not root motion.
      this.player.verticalSpeed = -Math.min(this.player.swimDiveTime / Math.max(this.player.swimDiveDuration, .01), 1) * .1 * 50;
    } else if (controls.animationMotionY !== undefined && dt > 0) {
      this.player.verticalSpeed = controls.animationMotionY / dt;
    } else if (surface) {
      this.player.verticalSpeed = 0;
    }
    const resolved = characterMovement(this.character, this.playerCollider, { x: requested.x, y: this.player.verticalSpeed * dt, z: requested.z });
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
  resetPlayer() {
    this.animationMovement = null;

    this.player.health = 100; this.player.armour = 0; this.player.stamina = 100; this.player.sprintExhausted = false; this.deathRemaining = 0;
    this.player.crouched = false; this.playerCollider.setShape(new RAPIER.Capsule(0.6, 0.3));
    this.playerBody.setEnabled(true);
    this.playerBody.setTranslation({ x: this.respawn.x, y: this.respawn.y + 0.9, z: this.respawn.z }, true);
    this.playerBody.setNextKinematicTranslation({ x: this.respawn.x, y: this.respawn.y + 0.9, z: this.respawn.z });
    this.playerCollider.setTranslation(this.playerBody.translation());
    this.player.position = { ...this.respawn }; this.player.previous = { ...this.respawn };
    this.player.speed = 0; this.player.verticalSpeed = 0; this.player.grounded = false; this.player.moveBlend = 0; this.player.jumpMomentum = { x: 0, z: 0 };
    this.player.swimming = false; this.player.swimState = 0; this.player.swimBlend = 0; this.player.breath = 100; this.player.swimStopTime = 0; this.player.swimDiveTime = 0; this.player.swimDiveDuration = 1; this.player.swimVel = { x: 0, z: 0 };
  }
  cameraDistance(origin: Vec3, direction: Vec3, distance: number) {
    const rotation = { x: 0, y: 0, z: 0, w: 1 }, shape = new RAPIER.Ball(0.2);
    const nearest = currentShapeCast(this.world, origin, rotation, direction, shape, 0.03, distance,
      this.cameraExcludedBody, this.playerCollider);
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
