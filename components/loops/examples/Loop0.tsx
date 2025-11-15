"use client";

import { useEffect } from "react";
import type { LoopComponentProps } from "../loopRegistry";
import { registerLoop } from "../loopRegistry";
import { TriggerBox, ProximityTrigger } from "../Trigger";
import { useSound } from "@/components/audio/useSound";

function Loop0Impl({ loop }: LoopComponentProps) {
  return <></>;
}

// Register example loop 0 at import-time
registerLoop(0, Loop0Impl);

export default Loop0Impl;
