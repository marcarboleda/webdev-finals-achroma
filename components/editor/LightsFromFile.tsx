"use client";

import { useEffect, useState, useMemo } from "react";
import * as THREE from "three";

export type LightRecord = {
  id: string;
  type: "point" | "spot" | "rect" | "ambient";
  position: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  intensity: number;
  distance?: number;
  decay?: number;
  angle?: number;
  penumbra?: number;
  width?: number;
  height?: number;
};

type LightsFile = { version: 1; lights: LightRecord[] };

export default function LightsFromFile({
  editable = false,
  lights: overrideLights,
  showHelpers = false,
  onTargetChanged,
  onGroupRef,
}: {
  /** If provided, render these instead of fetching. */
  lights?: LightRecord[];
  /** When true, adds simple helpers to visualize light positions. */
  editable?: boolean;
  /** Show debug helpers for lights (even when not editable). */
  showHelpers?: boolean;
  /** Callback when a light is selected for editing */
  onTargetChanged?: (target: THREE.Object3D | undefined, id: string) => void;
  /** Provide refs to the parent for each light's group for custom raycasting. */
  onGroupRef?: (id: string, node: THREE.Group | null) => void;
}) {
  const [data, setData] = useState<LightRecord[] | null>(null);

  useEffect(() => {
    if (overrideLights) return; // controlled
    let cancelled = false;
    fetch("/api/level-lights")
      .then((r) => r.json())
      .then((j: LightsFile) => {
        if (cancelled) return;
        setData(j?.lights ?? []);
      })
      .catch(() => setData([]));
    return () => {
      cancelled = true;
    };
  }, [overrideLights]);

  const lights = overrideLights ?? data ?? [];

  const helpersMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffff88, wireframe: true }), []);

  // Ensure RectAreaLight shader lib is initialized
  useEffect(() => {
    // dynamic import to avoid SSR issues
    import("three/examples/jsm/lights/RectAreaLightUniformsLib.js").then((mod) => {
      // Some builds export default, others named
      const lib: any = (mod as any).RectAreaLightUniformsLib ?? (mod as any).default;
      lib?.init?.();
    });
  }, []);

  return (
    <group name="LevelLights">
      {/* Ambient lights are scene-wide, so we don't wrap them in groups */}
      {lights
        .filter((l) => l.type === "ambient")
        .map((l) => (
          <ambientLight key={l.id} color={l.color as any} intensity={l.intensity} />
        ))}

      {/* Non-ambient lights with helpers for editing */}
      {lights
        .filter((l) => l.type !== "ambient")
        .map((l) => {
          if (l.type === "spot") {
            return (
              <group
                key={l.id}
                name={`Light-${l.id}`}
                position={l.position}
                rotation={l.rotation as any}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTargetChanged) onTargetChanged((e as any).eventObject, l.id);
                }}
                ref={(node) => onGroupRef?.(l.id, node as any)}
              >
                <spotLight
                  color={l.color as any}
                  intensity={l.intensity}
                  distance={l.distance}
                  decay={l.decay}
                  angle={l.angle ?? Math.PI / 6}
                  penumbra={l.penumbra ?? 0.2}
                  castShadow
                />
                {(editable || showHelpers) && (
                  <mesh position={[0, 0, 0]}>
                    <sphereGeometry args={[0.06, 8, 8]} />
                    <primitive object={helpersMat} attach="material" />
                  </mesh>
                )}
              </group>
            );
          }
          if (l.type === "rect") {
            return (
              <group
                key={l.id}
                name={`Light-${l.id}`}
                position={l.position}
                rotation={l.rotation as any}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTargetChanged) onTargetChanged((e as any).eventObject, l.id);
                }}
                ref={(node) => onGroupRef?.(l.id, node as any)}
              >
                <rectAreaLight
                  color={l.color as any}
                  intensity={l.intensity}
                  width={l.width ?? 1}
                  height={l.height ?? 1}
                />
                {(editable || showHelpers) && (
                  <mesh position={[0, 0, 0]}>
                    <planeGeometry args={[l.width ?? 1, l.height ?? 1]} />
                    <primitive object={helpersMat} attach="material" />
                  </mesh>
                )}
              </group>
            );
          }
          return (
            <group
              key={l.id}
              name={`Light-${l.id}`}
              position={l.position}
              onClick={(e) => {
                e.stopPropagation();
                if (onTargetChanged) onTargetChanged((e as any).eventObject, l.id);
              }}
              ref={(node) => onGroupRef?.(l.id, node as any)}
            >
              <pointLight
                color={l.color as any}
                intensity={l.intensity}
                distance={l.distance}
                decay={l.decay}
                castShadow
              />
              {(editable || showHelpers) && (
                <mesh position={[0, 0, 0]}>
                  <sphereGeometry args={[0.06, 8, 8]} />
                  <primitive object={helpersMat} attach="material" />
                </mesh>
              )}
            </group>
          );
        })}
    </group>
  );
}
