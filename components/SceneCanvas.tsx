"use client";

import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  ContactShadows,
  Preload,
  Stats,
  AdaptiveDpr,
  OrbitControls,
  TransformControls,
} from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import HorrorCorridor from "@/components/HorrorCorridor";
import FPSControls from "@/components/FPSControls";
import Flashlight from "@/components/Flashlight";
import Effects from "@/components/Effects";
import SoundProvider from "@/components/audio/SoundProvider";
import { useSound } from "@/components/audio/useSound";
import RadioNarration from "@/components/RadioNarration";
import Basement from "./scenes/Basement";
import LightsFromFile from "./editor/LightsFromFile";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { useEditorStore } from "./editor/editorStore";
import BasementWalls from "./scenes/BasementWalls";
import { LoopManager } from "./loops/LoopManager";

// Lazy-load editor sidebar to keep normal play mode lean
const LevelEditorSidebar = dynamic(() => import("./editor/LevelEditor"), {
  ssr: false,
  loading: () => null,
});

export default function SceneCanvas({
  isTouch,
  flashOn,
  started = false,
  onPointerLockChange,
  editor = false,
}: {
  isTouch: boolean;
  flashOn: boolean;
  started?: boolean;
  onPointerLockChange?: (locked: boolean) => void;
  /** When true, enables level editor mode (OrbitControls + transform gizmos). */
  editor?: boolean;
}) {
  // Access sound inside Canvas to resume on pointer lock and trigger SFX
  // Note: useSound must be used within SoundProvider, so we read it in a nested helper component below.
  // Change this to adjust the player's starting facing direction (in radians).
  // 0 looks toward -Z (default three.js), +Math.PI/2 looks toward +X, -Math.PI/2 toward -X, Math.PI toward +Z.
  const INITIAL_YAW = Math.PI / 2; // face toward -X by default
  // Editor layout: docked right sidebar next to canvas
  if (editor) {
    return (
      <div className="absolute inset-0 flex flex-row">
        <div className="relative flex-1 min-w-0">
          <Canvas
            id="r3f-canvas"
            shadows
            dpr={[1, isTouch ? 1.5 : 2]}
            gl={{
              outputColorSpace: SRGBColorSpace,
              antialias: !isTouch,
              powerPreference: "high-performance",
              toneMapping: ACESFilmicToneMapping,
              toneMappingExposure: 1.0,
              stencil: false,
              alpha: false,
              precision: isTouch ? "mediump" : "highp",
            }}
            camera={{ position: [0, 1.8, 5], fov: 120 }}
          >
            <color attach="background" args={["#000"]} />
            <fog attach="fog" args={["#0a0a0a", 15, 35]} />

            <Suspense fallback={null}>
              <SoundProvider>
                <SoundBridge onPointerLockChange={onPointerLockChange} />
                {/* No radio narration while editing */}
                <Physics gravity={[0, -9.81, 0]} debug={!isTouch && !editor}>
                  {/* Always load the Basement scene in editor */}
                  <Basement position={[0, 1, 0]} />

                  {/* Editable lights in editor mode, sourced from store */}
                  <EditorLights />

                  {/* Ground */}
                  <RigidBody type="fixed" colliders={false}>
                    <CuboidCollider
                      args={[25, 0.1, 25]}
                      position={[0, -0.5, 0]}
                    />
                  </RigidBody>

                  <ContactShadows
                    position={[0, -0.49, 0]}
                    opacity={0.4}
                    scale={30}
                    blur={3}
                    far={15}
                  />
                  {/* No FPS controls in editor (use OrbitControls) */}

                  {/* Optional: leave flashlight off while editing */}
                </Physics>
              </SoundProvider>

              <Effects isTouch={isTouch} />
              {isTouch && <AdaptiveDpr pixelated />}

              <Stats className="stats-top-right" />

              {/* Editor camera/transform tools inside Canvas */}
              <EditorCanvasTools />

              <Preload all />
            </Suspense>
          </Canvas>
        </div>
        {/* Docked right sidebar */}
        <LevelEditorSidebar />
      </div>
    );
  }

  // Default game view (no editor)
  return (
    <>
      <Canvas
        id="r3f-canvas"
        shadows
        dpr={[1, isTouch ? 1.5 : 2]}
        gl={{
          outputColorSpace: SRGBColorSpace,
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          stencil: false,
          alpha: false,
          precision: isTouch ? "mediump" : "highp",
        }}
        camera={{ position: [0, 1.8, 5], fov: 55 }}
      >
        <color attach="background" args={["#000"]} />
        <fog attach="fog" args={["#0a0a0a", 15, 35]} />

        <Suspense fallback={null}>
          <SoundProvider>
            <SoundBridge onPointerLockChange={onPointerLockChange} />{" "}
            {started && <RadioNarration />}
            <Physics gravity={[0, -9.81, 0]} debug={false}>
              <Basement position={[0, 1, 0]} />

              {/* Level lights rendered from JSON file (editor renders its own) */}
              {!editor && <LightsFromFile />}

              {/* Ground */}
              <RigidBody type="fixed" colliders={false}>
                <CuboidCollider args={[25, 0.1, 25]} position={[0, -0.5, 0]} />
              </RigidBody>

              <ContactShadows
                position={[0, -0.49, 0]}
                opacity={0.4}
                scale={30}
                blur={3}
                far={15}
              />

              {!editor && (
                <FPSControls
                  speed={1.0}
                  eyeHeight={3.75}
                  capsuleHeight={1.85}
                  capsuleRadius={0.25}
                  initialYaw={INITIAL_YAW}
                  onLockChange={(locked) => {
                    // Also resume audio on lock
                    window.dispatchEvent(
                      new CustomEvent("__pointerlock_change__", {
                        detail: { locked },
                      })
                    );
                  }}
                  onFootstep={(foot) => {
                    // Dispatch footstep event; SoundBridge will handle to keep hook usage inside provider
                    window.dispatchEvent(
                      new CustomEvent("__footstep__", { detail: { foot } })
                    );
                  }}
                />
              )}

              {flashOn && <Flashlight />}

              {/* Loop-specific content: spawns, triggers, SFX per loop */}
              <LoopManager />
            </Physics>
          </SoundProvider>

          <Effects isTouch={isTouch} />
          {isTouch && <AdaptiveDpr pixelated />}

          <Stats className="stats-top-right" />

          <Preload all />
        </Suspense>
      </Canvas>
    </>
  );
}

// Small internal bridge component to access useSound inside the provider scope
function SoundBridge({
  onPointerLockChange,
}: {
  onPointerLockChange?: (locked: boolean) => void;
}) {
  const { sound, resume } = useSound();

  // Relay pointer lock changes from FPSControls to page and resume audio
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { locked: boolean };
      if (detail?.locked) {
        resume();
      }
      onPointerLockChange?.(!!detail?.locked);
    };
    window.addEventListener("__pointerlock_change__", handler as EventListener);
    return () =>
      window.removeEventListener(
        "__pointerlock_change__",
        handler as EventListener
      );
  }, [resume, onPointerLockChange]);

  // Handle footstep events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { foot: "left" | "right" };
      sound.playFootstep(detail?.foot ?? "any");
    };
    window.addEventListener("__footstep__", handler as EventListener);
    return () =>
      window.removeEventListener("__footstep__", handler as EventListener);
  }, [sound]);

  return null;
}

// ==========================
// Editor-specific components
// ==========================

function EditorLights() {
  const lights = useEditorStore((s) => s.lights);
  const setSelectedId = useEditorStore((s) => s.setSelectedId);
  const [target, setTarget] = useState<THREE.Object3D | undefined>(undefined);
  const selectedId = useEditorStore((s) => s.selectedId);
  const showHelpers = useEditorStore((s) => s.showHelpers);
  const { gl, camera, size } = useThree();
  const rayRef = useRef(new THREE.Raycaster());
  const groupRefs = useRef<Record<string, THREE.Group | undefined>>({});

  // When selection comes from sidebar, attach gizmo to that group's Object3D
  useEffect(() => {
    if (!selectedId) {
      setTarget(undefined);
      return;
    }
    const node = groupRefs.current[selectedId];
    if (node) setTarget(node);
  }, [selectedId, lights]);

  // Manual raycast that only tests light groups, ignoring the rest of the scene
  useEffect(() => {
    const dom = gl.domElement;
    const onPointerDown = (ev: PointerEvent) => {
      // Only left-clicks
      if (ev.button !== 0) return;
      const rect = dom.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      const ray = rayRef.current;
      const ndc = new THREE.Vector2(x, y);
      ray.setFromCamera(ndc, camera);
      const objs = Object.values(groupRefs.current).filter(
        Boolean
      ) as THREE.Object3D[];
      if (objs.length === 0) return;
      const hits = ray.intersectObjects(objs, true);
      if (hits.length > 0) {
        const first = hits[0].object as THREE.Object3D;
        // Climb to the light group ancestor
        let n: THREE.Object3D | null = first;
        let found: THREE.Object3D | null = null;
        while (n) {
          if (n.name?.startsWith?.("Light-")) {
            found = n;
            break;
          }
          n = n.parent;
        }
        if (found) {
          // Extract id after 'Light-'
          const id = found.name.substring(6);
          setSelectedId(id);
          setTarget(found as THREE.Object3D);
          return;
        }
      }
      // If no light hit, clear selection
      setSelectedId(null);
      setTarget(undefined);
    };
    dom.addEventListener("pointerdown", onPointerDown);
    return () => dom.removeEventListener("pointerdown", onPointerDown);
  }, [gl, camera, setSelectedId]);

  return (
    <group
      onPointerMissed={(e: ThreeEvent<PointerEvent>) => {
        // deselect only when clicking empty space
        if (e.button === 0) {
          setSelectedId(null);
          setTarget(undefined);
        }
      }}
    >
      <LightsFromFile
        editable
        lights={lights}
        showHelpers={showHelpers}
        onTargetChanged={(obj, id) => {
          setSelectedId(id);
          setTarget(obj);
        }}
        onGroupRef={(id, node) => {
          groupRefs.current[id] = node ?? undefined;
        }}
      />
      <EditorTransformControls target={target} selectedId={selectedId} />
    </group>
  );
}

function EditorCanvasTools() {
  const { camera } = useThree();
  const mode = useEditorStore((s) => s.mode);
  const space = useEditorStore((s) => s.space);
  const snap = useEditorStore((s) => s.snap);

  // Basic orbit navigation in editor
  return (
    <>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </>
  );
}

function EditorTransformControls({
  target,
  selectedId,
}: {
  target?: THREE.Object3D;
  selectedId: string | null;
}) {
  const mode = useEditorStore((s) => s.mode);
  const space = useEditorStore((s) => s.space);
  const snap = useEditorStore((s) => s.snap);
  const updateSelected = useEditorStore((s) => s.updateSelected);

  const ref = useRef<any>(null);

  // Keyboard shortcuts: W/E/R, X toggle snap, L toggle space
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "w" || e.key === "W")
        useEditorStore.getState().setMode("translate");
      if (e.key === "e" || e.key === "E")
        useEditorStore.getState().setMode("rotate");
      if (e.key === "r" || e.key === "R")
        useEditorStore.getState().setMode("scale");
      if (e.key === "x" || e.key === "X")
        useEditorStore.getState().setSnap(!useEditorStore.getState().snap);
      if (e.key === "l" || e.key === "L")
        useEditorStore
          .getState()
          .setSpace(
            useEditorStore.getState().space === "world" ? "local" : "world"
          );
      if (e.key === "Delete") useEditorStore.getState().removeSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Push changes back into store on drag
  const onObjectChange = () => {
    if (!target || !selectedId) return;
    const pos = target.position;
    const rot = target.rotation;
    const patch: any = {
      position: [pos.x, pos.y, pos.z] as [number, number, number],
    };
    // rotation applies to spot/rect
    patch.rotation = [rot.x, rot.y, rot.z] as [number, number, number];
    updateSelected(patch);
  };

  if (!target || !selectedId) return null;
  return (
    <TransformControls
      ref={ref}
      object={target}
      mode={mode}
      space={space}
      translationSnap={snap ? 0.5 : undefined}
      rotationSnap={snap ? Math.PI / 12 : undefined}
      scaleSnap={snap ? 0.1 : undefined}
      onObjectChange={onObjectChange}
    />
  );
}
