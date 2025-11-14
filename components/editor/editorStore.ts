"use client";

import { create } from "zustand";
import type { LightRecord } from "./LightsFromFile";
import {
  EffectInstance,
  EffectType,
  defaultEffectOrder,
  effectRegistry,
} from "./effectsRegistry";

interface EditorState {
  lights: LightRecord[];
  selectedId: string | null;
  mode: "translate" | "rotate" | "scale";
  space: "world" | "local";
  snap: boolean;
  showHelpers: boolean;
  effects: EffectInstance[];
  setSelectedId: (id: string | null) => void;
  setLights: (l: LightRecord[]) => void;
  updateSelected: (patch: Partial<LightRecord>) => void;
  addPoint: () => void;
  addSpot: () => void;
  addRect: () => void;
  addAmbient: () => void;
  removeSelected: () => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
  setMode: (m: "translate" | "rotate" | "scale") => void;
  setSpace: (s: "world" | "local") => void;
  setSnap: (v: boolean) => void;
  setShowHelpers: (v: boolean) => void;
  addEffect: (type: EffectType) => string;
  updateEffectParams: (id: string, patch: Record<string, number>) => void;
  toggleEffect: (id: string, value?: boolean) => void;
  removeEffect: (id: string) => void;
}

function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

const createDefaultEffects = (): EffectInstance[] =>
  defaultEffectOrder.map((type) => ({
    id: uid(),
    type,
    enabled: true,
    params: { ...effectRegistry[type].defaults },
  }));

const sanitizeEffects = (raw: unknown): EffectInstance[] => {
  if (!Array.isArray(raw)) {
    return createDefaultEffects();
  }
  const cleaned = raw
    .map((unknownItem) => {
      if (typeof unknownItem !== "object" || !unknownItem) return null;
      const candidate = unknownItem as Partial<EffectInstance> & {
        type?: EffectType;
        params?: Record<string, unknown>;
      };
      const type = candidate.type;
      if (!type || !(type in effectRegistry)) return null;
      const blueprint = effectRegistry[type];
      const params: Record<string, number> = {};
      Object.keys(blueprint.params).forEach((key) => {
        const rawValue = candidate.params?.[key];
        const numeric = typeof rawValue === "number" ? rawValue : Number(rawValue);
        params[key] = Number.isFinite(numeric) ? numeric : blueprint.defaults[key];
      });
      return {
        id: typeof candidate.id === "string" ? candidate.id : uid(),
        type,
        enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : true,
        params,
      } as EffectInstance;
    })
    .filter(Boolean) as EffectInstance[];
  return cleaned.length ? cleaned : createDefaultEffects();
};

export const useEditorStore = create<EditorState>((set, get) => ({
  lights: [],
  selectedId: null,
  mode: "translate",
  space: "world",
  snap: false,
  showHelpers: true,
  effects: createDefaultEffects(),
  setSelectedId: (id) => set({ selectedId: id }),
  setLights: (l) => set({ lights: l }),
  updateSelected: (patch) => {
    const { lights, selectedId } = get();
    if (!selectedId) return;
    set({
      lights: lights.map((it) => (it.id === selectedId ? { ...it, ...patch } : it)),
    });
  },
  addPoint: () =>
    set((s) => {
      const l: LightRecord = {
        id: uid(),
        type: "point",
        position: [0, 2.2, 0],
        color: "#ffffff",
        intensity: 1.2,
        distance: 0,
        decay: 2,
      };
      return { lights: [...s.lights, l], selectedId: l.id };
    }),
  addSpot: () =>
    set((s) => {
      const l: LightRecord = {
        id: uid(),
        type: "spot",
        position: [0, 2.5, 2],
        rotation: [-Math.PI / 4, 0, 0],
        color: "#ffffff",
        intensity: 1.5,
        angle: Math.PI / 6,
        penumbra: 0.2,
        distance: 10,
        decay: 2,
      };
      return { lights: [...s.lights, l], selectedId: l.id };
    }),
  addRect: () =>
    set((s) => {
      const l: LightRecord = {
        id: uid(),
        type: "rect",
        position: [0, 2.5, 0],
        rotation: [0, 0, 0],
        color: "#ffffff",
        intensity: 3,
        width: 1.5,
        height: 1,
      };
      return { lights: [...s.lights, l], selectedId: l.id };
    }),
  addAmbient: () =>
    set((s) => {
      const l: LightRecord = {
        id: uid(),
        type: "ambient",
        position: [0, 0, 0],
        color: "#ffffff",
        intensity: 0.2,
      };
      return { lights: [...s.lights, l], selectedId: l.id };
    }),
  removeSelected: () =>
    set((s) => ({
      lights: s.lights.filter((l) => l.id !== s.selectedId),
      selectedId: null,
    })),
  load: async () => {
    try {
      const r = await fetch("/api/level-lights", { cache: "no-store" });
      const j = await r.json();
      set({
        lights: j?.lights ?? [],
        effects: sanitizeEffects(j?.effects),
        selectedId: j?.lights?.[0]?.id ?? null,
      });
    } catch {
      set({ lights: [], effects: createDefaultEffects(), selectedId: null });
    }
  },
  save: async () => {
    const { lights, effects } = get();
    await fetch("/api/level-lights", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lights, effects }),
    });
  },
  setMode: (m) => set({ mode: m }),
  setSpace: (s) => set({ space: s }),
  setSnap: (v) => set({ snap: v }),
  setShowHelpers: (v) => set({ showHelpers: v }),
  addEffect: (type) =>
    {
      const id = uid();
      set((s) => ({
        effects: [
          ...s.effects,
          {
            id,
            type,
            enabled: true,
            params: { ...effectRegistry[type].defaults },
          },
        ],
      }));
      return id;
    },
  updateEffectParams: (id, patch) =>
    set((s) => ({
      effects: s.effects.map((eff) =>
        eff.id === id ? { ...eff, params: { ...eff.params, ...patch } } : eff,
      ),
    })),
  toggleEffect: (id, value) =>
    set((s) => ({
      effects: s.effects.map((eff) =>
        eff.id === id
          ? { ...eff, enabled: typeof value === "boolean" ? value : !eff.enabled }
          : eff,
      ),
    })),
  removeEffect: (id) =>
    set((s) => ({
      effects: s.effects.filter((eff) => eff.id !== id),
    })),
}));
