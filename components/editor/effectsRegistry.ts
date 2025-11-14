export type EffectType =
  | "HueSaturation"
  | "BrightnessContrast"
  | "Vignette"
  | "Noise"
  | "ChromaticAberration"
  | "Bloom";

export type EffectParamDefinition = {
  label: string;
  min: number;
  max: number;
  step: number;
  description?: string;
};

export type EffectBlueprint = {
  type: EffectType;
  label: string;
  description: string;
  params: Record<string, EffectParamDefinition>;
  defaults: Record<string, number>;
};

export type EffectInstance = {
  id: string;
  type: EffectType;
  enabled: boolean;
  params: Record<string, number>;
};

export const defaultEffectOrder: EffectType[] = [
  "HueSaturation",
  "BrightnessContrast",
  "Vignette",
  "Noise",
  "ChromaticAberration",
];

export const effectRegistry: Record<EffectType, EffectBlueprint> = {
  HueSaturation: {
    type: "HueSaturation",
    label: "Hue / Saturation",
    description: "Adjusts the overall saturation of the scene.",
    params: {
      saturation: {
        label: "Saturation",
        min: -1,
        max: 1,
        step: 0.01,
      },
    },
    defaults: {
      saturation: -0.25,
    },
  },
  BrightnessContrast: {
    type: "BrightnessContrast",
    label: "Brightness / Contrast",
    description: "Controls gamma-based brightness and contrast.",
    params: {
      brightness: {
        label: "Brightness",
        min: -1,
        max: 1,
        step: 0.01,
      },
      contrast: {
        label: "Contrast",
        min: -1,
        max: 1,
        step: 0.01,
      },
    },
    defaults: {
      brightness: 0,
      contrast: 0,
    },
  },
  Vignette: {
    type: "Vignette",
    label: "Vignette",
    description: "Darkens the image edges like a camera lens.",
    params: {
      offset: {
        label: "Offset",
        min: 0,
        max: 1,
        step: 0.01,
      },
      darkness: {
        label: "Darkness",
        min: 0,
        max: 2,
        step: 0.01,
      },
    },
    defaults: {
      offset: 0.23,
      darkness: 0.9,
    },
  },
  Noise: {
    type: "Noise",
    label: "Film Grain",
    description: "Adds subtle film grain to sell the horror vibe.",
    params: {
      opacity: {
        label: "Opacity",
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
    defaults: {
      opacity: 0.3,
    },
  },
  ChromaticAberration: {
    type: "ChromaticAberration",
    label: "Chromatic Aberration",
    description: "Offsets RGB channels for dreamy fringes.",
    params: {
      offsetX: {
        label: "Shift X",
        min: 0,
        max: 0.01,
        step: 0.0005,
      },
      offsetY: {
        label: "Shift Y",
        min: 0,
        max: 0.01,
        step: 0.0005,
      },
    },
    defaults: {
      offsetX: 0.001,
      offsetY: 0.001,
    },
  },
  Bloom: {
    type: "Bloom",
    label: "Bloom",
    description: "Adds a soft glow to bright highlights.",
    params: {
      intensity: {
        label: "Intensity",
        min: 0,
        max: 2,
        step: 0.05,
      },
      luminanceThreshold: {
        label: "Luma Threshold",
        min: 0,
        max: 1,
        step: 0.01,
      },
      luminanceSmoothing: {
        label: "Luma Smooth",
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
    defaults: {
      intensity: 0.6,
      luminanceThreshold: 0.4,
      luminanceSmoothing: 0.3,
    },
  },
};
