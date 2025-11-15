"use client";

import Preloader from "@/components/Preloader";
import useIsTouch from "@/hooks/useIsTouch";
import useViewportVH from "@/hooks/useViewportVH";
import SceneCanvas from "@/components/SceneCanvas";
import { useSearchParams } from "next/navigation";
import TitleScreen from "@/components/TitleScreen";
import { GameUI } from "@/components/game-ui/GameUI";
// Import loop examples to ensure registration happens on app mount
import "@/components/loops/examples/Loop0";
import "@/components/loops/examples/Loop1";
import { MobileUI } from "@/components/mobile/MobileUI";
import { useGameState } from "@/store/gameState";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  )
}

function Home() {
  const isTouch = useIsTouch();
  const { flashOn, started, setStarted, setLocked } = useGameState();
  const params = useSearchParams();
  const editor = (params.get("editor") ?? "") !== ""; // any value enables

  useViewportVH();

  return (
    <div
      className="fixed inset-0 w-full select-none"
      style={{ height: "calc(var(--vh, 1vh) * 100)" }}
    >
      <SceneCanvas
        isTouch={isTouch}
        flashOn={flashOn}
        started={started}
        onPointerLockChange={(v) => {
          console.log("[page.tsx] pointer lock change:", v);
          setLocked(v);
        }}
        editor={editor}
      />
      {!editor && !started && <Preloader />}
      {!editor && (
        <TitleScreen started={started} onStart={() => setStarted(true)} />
      )}

      {!editor && <GameUI isTouch={isTouch} />}
      {!editor && isTouch && <MobileUI />}
    </div>
  );
}
