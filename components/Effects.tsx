"use client";

import {
  EffectComposer,
  HueSaturation,
  Noise,
  Vignette,
  ChromaticAberration,
  BrightnessContrast,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

export default function Effects({ isTouch }: { isTouch: boolean }) {
  return (
    <EffectComposer enableNormalPass multisampling={isTouch ? 0 : 4}>
      <HueSaturation saturation={-0.15} />
   
      <Vignette eskil={false} offset={0.23} darkness={0.9} />
      <Noise
        opacity={isTouch ? 0.15 : 0.3}
        blendFunction={BlendFunction.SOFT_LIGHT}
      />
      <ChromaticAberration offset={[0.001, 0.001]} />
    </EffectComposer>
  );
}