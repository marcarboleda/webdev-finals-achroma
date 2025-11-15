"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * CoordsDebugOverlay
 * - Shows X/Y/Z of either a provided object or the active camera
 * - Enabled when localStorage.coordsDebug === "1" (toggle in DevTools)
 *   localStorage.setItem("coordsDebug", "1") // on
 *   localStorage.setItem("coordsDebug", "0") // off
 */
export default function CoordsDebugOverlay({
  target,
  label,
  show,
}: {
  /** Optional object to read coordinates from; defaults to the active camera */
  target?: THREE.Object3D | null;
  /** Optional label prefix, e.g., "Camera" or "Player" */
  label?: string;
  /** Force-show regardless of localStorage flag (default: undefined) */
  show?: boolean;
}) {
  const { camera } = useThree();
  const [enabled, setEnabled] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof show === "boolean") {
      setEnabled(show);
      return;
    }
    try {
      setEnabled(localStorage.getItem("coordsDebug") === "1");
    } catch {}
  }, [show]);

  useFrame(() => {
    if (!enabled) return;
    const obj = target || camera;
    const p = obj.position;
    const r = obj.rotation;
    const el = textRef.current;
    if (!el) return;
    el.innerText =
      `${label ?? (target ? "Target" : "Camera")}\n` +
      `x: ${p.x.toFixed(2)}  y: ${p.y.toFixed(2)}  z: ${p.z.toFixed(2)}\n` +
      `rx: ${r.x.toFixed(2)}  ry: ${r.y.toFixed(2)}  rz: ${r.z.toFixed(2)}`;
  });

  if (!enabled) return null;

  return (
    <Html transform={false} prepend>
      <div
        style={{
          position: "fixed",
          bottom: 8,
          left: 8,
          padding: "6px 8px",
          background: "#00000066",
          border: "1px solid #ffffff22",
          borderRadius: 6,
          color: "#fff",
          fontSize: 12,
          lineHeight: 1.25,
          whiteSpace: "pre",
          pointerEvents: "none",
          backdropFilter: "blur(2px)",
        }}
        ref={textRef}
      />
    </Html>
  );
}
