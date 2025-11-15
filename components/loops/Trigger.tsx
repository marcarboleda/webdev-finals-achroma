"use client";

import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useRef } from "react";

type TriggerBoxProps = {
  position: [number, number, number];
  size: [number, number, number]; // full extents (we convert to half extents for collider args)
  onEnter?: () => void;
  onExit?: () => void;
  once?: boolean;
};

/**
 * Rapier sensor trigger: fires on player body entering/exiting the volume.
 * Use inside Physics. Set `once` to auto-disable after first enter.
 */
export function TriggerBox({
  position,
  size,
  onEnter,
  onExit,
  once,
}: TriggerBoxProps) {
  const doneRef = useRef(false);
  const half: [number, number, number] = [
    size[0] / 2,
    size[1] / 2,
    size[2] / 2,
  ];
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider
        args={half}
        sensor
        onIntersectionEnter={() => {
          if (once && doneRef.current) return;
          onEnter?.();
          if (once) doneRef.current = true;
        }}
        onIntersectionExit={() => {
          if (once && doneRef.current) return;
          onExit?.();
        }}
      />
    </RigidBody>
  );
}

type ProximityTriggerProps = {
  center: [number, number, number];
  radius: number;
  onEnter?: () => void;
  onExit?: () => void;
  once?: boolean;
};

/**
 * Simple proximity trigger using camera distance. Works without physics.
 */
export function ProximityTrigger({
  center,
  radius,
  onEnter,
  onExit,
  once,
}: ProximityTriggerProps) {
  const { camera } = useThree();
  const inRef = useRef(false);
  const doneRef = useRef(false);
  useFrame(() => {
    if (once && doneRef.current) return;
    const c = new THREE.Vector3(...center);
    const d = c.distanceTo((camera as any).position);
    const inside = d <= radius;
    if (inside && !inRef.current) {
      onEnter?.();
      inRef.current = true;
      if (once) doneRef.current = true;
    } else if (!inside && inRef.current) {
      onExit?.();
      inRef.current = false;
    }
  });
  return null;
}

export default TriggerBox;
