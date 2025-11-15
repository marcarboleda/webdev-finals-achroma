"use client";

import { memo } from "react";
import { getLoopComponent } from "./loopRegistry";
import { useGameState } from "@/store/gameState";

function LoopManagerInner() {
  const loop = useGameState((s) => s.loop);
  const Comp = getLoopComponent(loop);
  if (!Comp) return null;
  // Key by loop so switching loops remounts the tree and cleans up
  return (
    <group key={`loop-${loop}`}>
      <Comp loop={loop} />
    </group>
  );
}

export const LoopManager = memo(LoopManagerInner);

export default LoopManager;
