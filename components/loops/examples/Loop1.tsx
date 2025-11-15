"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { LoopComponentProps } from "../loopRegistry";
import { registerLoop } from "../loopRegistry";

function ApplyLoop1Lighting() {
  const { scene } = useThree();
  const originals = useRef(
    new Map<string, { color?: THREE.Color; intensity?: number }>()
  );

  const OFF_ID = "fb10b68d-4991-46d5-b753-0d9b73b612d3";
  const RED_ID = "5182de41-c1c2-41df-a0e0-5b11ed66b4d1";
  const DIM_ID = "7ca22c94-e50a-4ac4-b160-37bba6d45f10";
  const DIM_FACTOR = 0.3; // 30% of original intensity

  // Helper to apply specific rules to lights by id
  function applyRules() {
    const group = scene.getObjectByName("LevelLights");
    if (!group) return;
    group.children.forEach((child) => {
      if (!child.name?.startsWith?.("Light-")) return;
      const lightId = child.name.substring(6);
      // find the light object inside this group
      let lightObj: any | null = null;
      child.traverse((n) => {
        if ((n as any).isLight) lightObj = n;
      });
      if (!lightObj) return;
      if (lightObj.type === "AmbientLight") return;
      const uuid = lightObj.uuid as string;
      // snapshot originals
      if (!originals.current.has(uuid)) {
        originals.current.set(uuid, {
          color: lightObj.color?.clone?.(),
          intensity:
            typeof lightObj.intensity === "number"
              ? lightObj.intensity
              : undefined,
        });
      }
      // apply per-id rule
      if (lightId === OFF_ID) {
        if (typeof lightObj.intensity === "number") lightObj.intensity = 0;
      } else if (lightId === RED_ID) {
        if (lightObj.color) lightObj.color = new THREE.Color(0xff2a2a);
      } else if (lightId === DIM_ID) {
        if (typeof lightObj.intensity === "number") {
          const base =
            originals.current.get(uuid)?.intensity ?? lightObj.intensity;
          lightObj.intensity = Math.max(0, base * DIM_FACTOR);
        }
      }
    });
  }

  // Apply on mount and for the first few frames to catch async lights
  let frames = 0;
  useFrame(() => {
    if (frames < 60) {
      applyRules();
      frames++;
    }
  });

  useEffect(() => {
    applyRules();
    return () => {
      // restore original color/intensity per light
      const group = scene.getObjectByName("LevelLights");
      if (!group) return;
      group.traverse((obj) => {
        const light = obj as any as THREE.Light;
        if (!light || !(light as any).isLight) return;
        const uuid = light.uuid as string;
        const orig = originals.current.get(uuid);
        if (orig?.color) light.color = orig.color;
        if (
          orig?.intensity != null &&
          typeof (light as any).intensity === "number"
        ) {
          (light as any).intensity = orig.intensity;
        }
      });
      originals.current.clear();
    };
  }, [scene]);

  return null;
}

function Loop1Impl({ loop }: LoopComponentProps) {
  // Put any extra loop-specific content here: props, triggers, etc.
  return <ApplyLoop1Lighting />;
}

// Register loop 1
registerLoop(1, Loop1Impl);

export default Loop1Impl;
