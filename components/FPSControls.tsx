"use client";

import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Matrix4, Quaternion, Vector3 } from "three";
import { RigidBody, CapsuleCollider } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { getMoveAxes, consumeLookDelta, isTouchMode, setMoveAxes } from "./inputStore";

export default function FPSControls({
  // Movement
  speed = 2,
  eyeHeight = 1.6,
  capsuleRadius = 0.3,
  capsuleHeight = 1.0,
  // Initial view orientation (radians). If initialLookAt is set, it takes priority.
  initialYaw,
  initialPitch,

  // Bobbing config
  bobEnabled = true,
  minStepFrequency = 0.1, // Hz at slow walk
  maxStepFrequency = 0.8, // Hz at fast walk/jog
  verticalBobAmplitude = 0.015, // meters
  lateralBobAmplitude = 0.01, // meters (side sway)
  bobSmoothing = 8, // how quickly intensity blends (higher = snappier)
  speedAmplitudeInfluence = 1, // 0..1, how much speed scales amplitude
  onFootstep,

  // Movement interpolation
  acceleration = 18, // m/s^2
  deceleration = 22, // m/s^2

  // Cadence interpolation and shaping
  stepSmoothing = 6, // how quickly cadence follows speed
  verticalHarmonic = 0.15, // adds subtle 4th harmonic to vertical for realism
  strafeLateralFactor = 0.9, // lateral sway weight when strafing vs forward
  // How quickly bob offsets follow when moving vs. ease back when idle
  bobFollowSmoothing = 18, // higher = follows target offsets faster while moving
  idleReturnSmoothing = 6, // higher = returns to neutral faster when you let go

  // Debug
  debugBob = false,
  debugBobWidth = 260,
  debugBobHeight = 120,
  debugToggleKey = "KeyB",
  onLockChange,
}: {
  speed?: number;
  eyeHeight?: number;
  capsuleRadius?: number;
  capsuleHeight?: number;
  /** Initial yaw in radians (rotation around Y). Optional. */
  initialYaw?: number;
  /** Initial pitch in radians (rotation around X). Optional and clamped to ~+-90deg. */
  initialPitch?: number;

  // Bobbing config
  bobEnabled?: boolean;
  minStepFrequency?: number;
  maxStepFrequency?: number;
  verticalBobAmplitude?: number;
  lateralBobAmplitude?: number;
  bobSmoothing?: number;
  speedAmplitudeInfluence?: number; // 0..1
  onFootstep?: (foot: "left" | "right") => void; // optional step callback

  // Debug
  debugBob?: boolean;
  debugBobWidth?: number;
  debugBobHeight?: number;
  debugToggleKey?: string; // e.g., "KeyB"

  // Movement interpolation
  acceleration?: number;
  deceleration?: number;

  // Cadence interpolation and shaping
  stepSmoothing?: number;
  verticalHarmonic?: number;
  strafeLateralFactor?: number;
  bobFollowSmoothing?: number;
  idleReturnSmoothing?: number;
  onLockChange?: (locked: boolean) => void;
}) {
  const { camera } = useThree();
  // Movement now unified via inputStore (keyboard + touch). No local WASD tracking.
  const right = useMemo(() => new Vector3(), []);
  const dir = useMemo(() => new Vector3(), []);
  const worldDir = useMemo(() => new Vector3(), []);
  const upVec = useMemo(() => new Vector3(0, 1, 0), []);
  const bobRef = useRef({
    phase: 0,
    intensity: 0,
    smoothedHz: 0,
    smoothedVertical: 0,
    smoothedLateral: 0,
  });
  const bodyRef = useRef<RapierRigidBody>(null);
  // Debug overlay data stream
  // Defer import type to avoid client/server mismatch
  type BobDebugData = {
    phase: number;
    intensity: number;
    stepHz: number;
    verticalBobAmplitude: number;
    lateralBobAmplitude: number;
  };
  const debugDataRef = useRef<BobDebugData>({
    phase: 0,
    intensity: 0,
    stepHz: 0,
    verticalBobAmplitude,
    lateralBobAmplitude,
  });
  const [debugOn, setDebugOn] = useState<boolean>(!!debugBob);
  const [isTouch, setIsTouch] = useState(false);
  const [plcEnabled, setPlcEnabled] = useState(true); // pointer lock enabled flag
  const overrideRef = useRef<{
    timeLeft: number;
    duration: number;
    speed: number; // m/s
    dir: Vector3;
    lockLook: boolean;
    lookAt?: Vector3;
    lookSlerp?: number; // per-second slerp rate
    moveDelayLeft: number; // seconds before movement begins
  } | null>(null);
  const lookMat = useMemo(() => new Matrix4(), []);
  const targetQuat = useMemo(() => new Quaternion(), []);

  // Apply initial view direction on mount
  useEffect(() => {
    // Only set once on mount; leave subsequent control to PLC/touch
    if (typeof initialYaw === "number" || typeof initialPitch === "number") {
      camera.rotation.order = "YXZ";
      if (typeof initialYaw === "number") {
        camera.rotation.y = initialYaw;
      }
      if (typeof initialPitch === "number") {
        const lim = Math.PI / 2 - 0.01;
        camera.rotation.x = Math.max(-lim, Math.min(lim, initialPitch));
      }
    }
    // We only want to run this once on mount, not when camera changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect touch devices to disable pointer lock and use touch look instead
  useEffect(() => {
    const touch =
      "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
    setIsTouch(touch);
  }, []);

  // Keep internal toggle in sync with prop if it changes
  useEffect(() => {
    setDebugOn(!!debugBob);
  }, [debugBob]);

  // Toggle debug overlay with a key press (default: B)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === debugToggleKey) {
        setDebugOn((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [debugToggleKey]);

  // Listen for external scripted movement trigger (door open sequence)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | {
            durationSec?: number;
            distance?: number;
            lockLook?: boolean;
            lookAt?: [number, number, number];
            lookSlerp?: number;
            moveDelaySec?: number;
          }
        | undefined;
      const durationSec = Math.max(0.05, detail?.durationSec ?? 1.2);
      const distance = Math.max(0.05, detail?.distance ?? 1.5);
      const lockLook = detail?.lockLook ?? true;
      const dir = new Vector3();
      camera.getWorldDirection(dir);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
      dir.normalize();
      overrideRef.current = {
        timeLeft: durationSec,
        duration: durationSec,
        speed: distance / durationSec,
        dir,
        lockLook,
        lookAt: detail?.lookAt ? new Vector3(...detail.lookAt) : undefined,
        lookSlerp: detail?.lookSlerp ?? 6,
        moveDelayLeft: Math.max(0, detail?.moveDelaySec ?? 0.35),
      };
      if (lockLook) setPlcEnabled(false);
      setMoveAxes(0, 0);
    };
    window.addEventListener("__scripted_move__", handler as EventListener);
    return () =>
      window.removeEventListener("__scripted_move__", handler as EventListener);
  }, [camera]);

  // Listen for external teleport requests
  useEffect(() => {
    const handler = (e: Event) => {
      const body = bodyRef.current;
      if (!body) return;
      const detail = (e as CustomEvent).detail as
        | { x?: number; y?: number; z?: number; keepY?: boolean; yaw?: number }
        | undefined;
      const t = body.translation();
      const nx = detail?.x ?? t.x;
      const ny = detail?.keepY ? t.y : detail?.y ?? t.y;
      const nz = detail?.z ?? t.z;
      // stop current scripted move and velocity, then teleport
      overrideRef.current = null;
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setTranslation({ x: nx, y: ny, z: nz }, true);
      // optionally set yaw orientation
      if (typeof detail?.yaw === "number") {
        // Update camera yaw while preserving pitch
        camera.rotation.order = "YXZ";
        camera.rotation.y = detail.yaw;
      }
      // ensure controls are enabled and input neutral
      setPlcEnabled(true);
      setMoveAxes(0, 0);
    };
    window.addEventListener("__teleport_to__", handler as EventListener);
    return () =>
      window.removeEventListener("__teleport_to__", handler as EventListener);
  }, [camera]);

  // Derived offsets
  const halfHeight = capsuleHeight / 2;
  const baseOffset = halfHeight + capsuleRadius; // center->feet offset

  // Follow player without touching camera roll/yaw/pitch (managed by PLC)
  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) return;

    // Read mobile movement axes (if any)
  const axes = getMoveAxes();
  const hasAxesMove = Math.abs(axes.x) > 0.001 || Math.abs(axes.y) > 0.001;
  const usingTouch = isTouchMode();
    const override = overrideRef.current;
    // Allow normal movement whenever there is no scripted override; during override, gate by moveDelay
    const canMove = override ? override.moveDelayLeft <= 0 : true;
    const isMoving = override ? canMove : hasAxesMove;

    // Get forward direction from camera (flattened Y)
    camera.getWorldDirection(worldDir);
    worldDir.y = 0;
    worldDir.normalize();

    // Right vector = forward x global up (avoid using camera.up to prevent tilt issues)
    right.crossVectors(worldDir, upVec).normalize();

    // Movement direction from WASD or mobile axes
    dir.set(0, 0, 0);
    if (override) {
      if (canMove) dir.add(override.dir);
    } else if (hasAxesMove) {
      // Unified axes (keyboard or touch): y => forward, x => strafe
      dir.add(worldDir.clone().multiplyScalar(axes.y));
      dir.add(right.clone().multiplyScalar(axes.x));
    }

    // Smoothly rotate camera to face target only before movement starts
    if (override && override.lockLook && override.lookAt && !canMove) {
      // Build target quaternion from a lookAt matrix
      lookMat.lookAt(camera.position, override.lookAt, upVec);
      targetQuat.setFromRotationMatrix(lookMat);
      const k = Math.min(1, Math.max(0, (override.lookSlerp ?? 6) * delta));
      camera.quaternion.slerp(targetQuat, k);
    }

    // Desired horizontal velocity (m/s)
    let desiredX = 0;
    let desiredZ = 0;
    if (isMoving && dir.lengthSq() > 0) {
      dir.normalize();
      const baseSpeed = override ? override.speed : speed;
      desiredX = dir.x * baseSpeed;
      desiredZ = dir.z * baseSpeed;
    }

    // Smooth acceleration/deceleration towards desired velocity
    const lin = body.linvel();
    const moveTowards = (current: number, target: number) => {
      const increasing = Math.abs(target) > Math.abs(current);
      const rate = increasing ? acceleration : deceleration; // m/s^2
      const maxDelta = rate * delta;
      const deltaV = target - current;
      if (Math.abs(deltaV) <= maxDelta) return target;
      return current + Math.sign(deltaV) * maxDelta;
    };
    const newVX = moveTowards(lin.x, desiredX);
    const newVZ = moveTowards(lin.z, desiredZ);
    if (override) {
      if (canMove) {
        body.setLinvel({ x: newVX, y: lin.y, z: newVZ }, true);
      } else {
        // During pre-move look phase of override, freeze horizontal velocity
        body.setLinvel({ x: 0, y: lin.y, z: 0 }, true);
      }
    } else {
      // Normal free movement
      body.setLinvel({ x: newVX, y: lin.y, z: newVZ }, true);
    }

    // Advance scripted sequence timer
    if (override) {
      if (override.moveDelayLeft > 0) {
        override.moveDelayLeft = Math.max(0, override.moveDelayLeft - delta);
      }
      override.timeLeft -= delta;
      if (override.timeLeft <= 0) {
        overrideRef.current = null;
        setPlcEnabled(true);
      }
    }

    // Head/camera bobbing (natural, speed-aligned and configurable)
    let vertical = 0;
    let lateral = 0;
    let stepHz = 0;
    let ampScale = 1;
    if (bobEnabled) {
      // Use actual current velocity (post smoothing) for realism
      const speed2D = Math.hypot(newVX, newVZ); // m/s
      const normalizedSpeed = Math.min(1, speed2D / Math.max(0.001, speed));
      // Intensity follows normalized speed rather than just on/off
      const targetIntensity = normalizedSpeed;
      bobRef.current.intensity +=
        (targetIntensity - bobRef.current.intensity) *
        Math.min(1, bobSmoothing * delta);

      // Cadence scales between min..max based on speed
      const targetHz =
        minStepFrequency +
        (maxStepFrequency - minStepFrequency) * normalizedSpeed;
      // Smooth cadence to avoid sudden jumps
      bobRef.current.smoothedHz +=
        (targetHz - bobRef.current.smoothedHz) *
        Math.min(1, stepSmoothing * delta);
      stepHz = bobRef.current.smoothedHz;
      if (bobRef.current.intensity > 0.001 && stepHz > 0.0001) {
        const prevPhase = bobRef.current.phase;
        bobRef.current.phase =
          (bobRef.current.phase + stepHz * 2 * Math.PI * delta) % (Math.PI * 2);

        // Optional footstep callback at phase crossings (0 => right, pi => left by convention)
        if (onFootstep) {
          const from = prevPhase;
          const to = bobRef.current.phase;
          const crossed = (thr: number) =>
            (from < thr && to >= thr) ||
            (from > to && (from < thr || to >= thr)); // handle wrap-around
          if (crossed(0)) onFootstep("right");
          if (crossed(Math.PI)) onFootstep("left");
        }
      }

      ampScale =
        1 - speedAmplitudeInfluence + speedAmplitudeInfluence * normalizedSpeed;
      // Two vertical peaks per cycle + subtle 4th harmonic for a quick-drop feel
      const phi = bobRef.current.phase;
      const sin2 = Math.sin(phi * 2);
      const shapedVertical = sin2 + verticalHarmonic * Math.sin(phi * 4);
      vertical =
        shapedVertical *
        verticalBobAmplitude *
        bobRef.current.intensity *
        ampScale;

      // Lateral sway stronger when moving forward/back, lighter on pure strafe
      // Compute forward alignment of velocity
      let forwardAlign = 0;
      if (speed2D > 0.0001) {
        const velDirX = newVX / speed2D;
        const velDirZ = newVZ / speed2D;
        // worldDir is normalized forward
        forwardAlign = Math.abs(velDirX * worldDir.x + velDirZ * worldDir.z); // 0..1
      }
      const lateralWeight =
        strafeLateralFactor + (1 - strafeLateralFactor) * forwardAlign;
      lateral =
        Math.sin(phi) *
        lateralBobAmplitude *
        lateralWeight *
        bobRef.current.intensity *
        ampScale;
    }

    // Smoothly follow offsets while moving and ease back to neutral when idle
    const targetVertical = isMoving ? vertical : 0;
    const targetLateral = isMoving ? lateral : 0;
    const follow = isMoving ? bobFollowSmoothing : idleReturnSmoothing;
    const k = Math.min(1, Math.max(0, follow * delta));
    bobRef.current.smoothedVertical +=
      (targetVertical - bobRef.current.smoothedVertical) * k;
    bobRef.current.smoothedLateral +=
      (targetLateral - bobRef.current.smoothedLateral) * k;

    // Apply mobile look deltas to camera
    if (usingTouch && !overrideRef.current) {
      const { dx, dy } = consumeLookDelta();
      if (dx !== 0 || dy !== 0) {
        const sens = 0.0025; // radians per pixel
        // Yaw then pitch; limit pitch
        camera.rotation.order = "YXZ";
        camera.rotation.y -= dx * sens;
        camera.rotation.x -= dy * sens;
        const lim = Math.PI / 2 - 0.01;
        camera.rotation.x = Math.max(-lim, Math.min(lim, camera.rotation.x));
      }
    }

    // Place camera at eye height above feet + bob; feetY = centerY - baseOffset
    const t = body.translation();
    camera.position.set(
      t.x,
      t.y -
        baseOffset +
        eyeHeight +
        (bobEnabled ? bobRef.current.smoothedVertical : 0),
      t.z
    );
    if (bobEnabled) {
      // Add subtle lateral sway along camera's right vector
      camera.position.addScaledVector(right, bobRef.current.smoothedLateral);
    }

    // Update debug overlay data
    if (debugOn) {
      debugDataRef.current.phase = bobRef.current.phase;
      debugDataRef.current.intensity = bobRef.current.intensity;
      debugDataRef.current.stepHz = stepHz;
      debugDataRef.current.verticalBobAmplitude = verticalBobAmplitude;
      debugDataRef.current.lateralBobAmplitude = lateralBobAmplitude;
    }
  });

  return (
    <>
      {/* Pointer lock for mouse look (disabled on touch devices)
          Use built-in PointerLockControls events rather than document listeners. */}
      {!isTouch && (
        <PointerLockControls
          selector="#r3f-canvas"
          enabled={plcEnabled}
          onLock={() => onLockChange?.(true)}
          onUnlock={() => onLockChange?.(false)}
        />
      )}

      {/* Debug overlay (top-left fixed) */}
      {debugOn &&
        // Lazy import to avoid circular dep in SSR paths; kept simple here
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        (() => {
          const { BobDebugOverlay } = require("./BobDebugOverlay");
          return (
            <BobDebugOverlay
              show={debugOn}
              width={debugBobWidth}
              height={debugBobHeight}
              dataRef={debugDataRef}
            />
          );
        })()}

      {/* Capsule-based player body */}
      <RigidBody
        ref={bodyRef}
        colliders={false}
        canSleep={false}
        position={[8,0,1.5]}
        linearDamping={4}
        angularDamping={1}
        enabledRotations={[false, false, false]}
      >
        <CapsuleCollider
          args={[halfHeight, capsuleRadius]}
          position={[0, baseOffset, 0]}
        />
      </RigidBody>
    </>
  );
}
