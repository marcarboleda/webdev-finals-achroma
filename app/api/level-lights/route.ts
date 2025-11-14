import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  EffectInstance,
  EffectType,
  defaultEffectOrder,
  effectRegistry,
} from "@/components/editor/effectsRegistry";

type LightBase = {
  id: string;
  type: "point" | "spot" | "rect" | "ambient";
  position: [number, number, number];
  rotation?: [number, number, number];
  color: string; // hex string, e.g. #ffffff
  intensity: number;
};

type PointLight = LightBase & {
  type: "point";
  distance?: number;
  decay?: number;
};

type SpotLight = LightBase & {
  type: "spot";
  angle?: number; // radians
  penumbra?: number; // 0..1
  distance?: number;
  decay?: number;
};

type RectLight = LightBase & {
  type: "rect";
  width: number;
  height: number;
};

type AmbientLight = LightBase & {
  type: "ambient";
};

type LightsFile = {
  version: 1;
  lights: Array<PointLight | SpotLight | RectLight | AmbientLight>;
  effects: EffectInstance[];
};

const ASSETS_DIR = path.join(process.cwd(), "public", "assets");
const FILE_PATH = path.join(ASSETS_DIR, "level-lights.json");

const randId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const makeDefaultEffects = (): EffectInstance[] =>
  defaultEffectOrder.map((type) => ({
    id: randId(),
    type,
    enabled: true,
    params: { ...effectRegistry[type].defaults },
  }));

function normalizeLights(raw: unknown): LightsFile["lights"] {
  if (!Array.isArray(raw)) return [];
  const normalized = raw
    .map((value) => {
      if (typeof value !== "object" || value === null) return null;
      const light = value as Record<string, unknown>;
      const typeValue = light.type;
      const type: LightBase["type"] =
        typeValue === "spot"
          ? "spot"
          : typeValue === "rect"
            ? "rect"
            : typeValue === "ambient"
              ? "ambient"
              : "point";
      const toTuple = (input: unknown, fallback: [number, number, number]): [number, number, number] =>
        Array.isArray(input)
          ? [Number(input[0] ?? fallback[0]), Number(input[1] ?? fallback[1]), Number(input[2] ?? fallback[2])]
          : fallback;
      const base = {
        id: typeof light.id === "string" ? light.id : randId(),
        type,
        position: toTuple(light.position, [0, 0, 0]),
        rotation: type === "point" || type === "ambient" ? undefined : toTuple(light.rotation, [0, 0, 0]),
        color: typeof light.color === "string" ? light.color : "#ffffff",
        intensity: Number(light.intensity ?? 1),
        angle: type === "spot" ? Number(light.angle ?? Math.PI / 6) : undefined,
        penumbra: type === "spot" ? Number(light.penumbra ?? 0.2) : undefined,
        distance: light.distance != null ? Number(light.distance) : undefined,
        decay: light.decay != null ? Number(light.decay) : undefined,
        width: type === "rect" ? Number(light.width ?? 1) : undefined,
        height: type === "rect" ? Number(light.height ?? 1) : undefined,
      };
      return base as PointLight | SpotLight | RectLight | AmbientLight;
    })
    .filter(Boolean) as LightsFile["lights"];
  return normalized.reduce<LightsFile["lights"]>((acc, l) => {
    if (!acc.find((x) => x.id === l.id)) acc.push(l);
    return acc;
  }, []);
}

function normalizeEffects(raw: unknown): EffectInstance[] {
  if (!Array.isArray(raw)) return makeDefaultEffects();
  const cleaned = raw
    .map((value) => {
      if (typeof value !== "object" || !value) return null;
      const candidate = value as Partial<EffectInstance> & {
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
        id: typeof candidate.id === "string" ? candidate.id : randId(),
        type,
        enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : true,
        params,
      } as EffectInstance;
    })
    .filter(Boolean) as EffectInstance[];
  return cleaned.length ? cleaned : makeDefaultEffects();
}

function normalizeFile(payload: Partial<LightsFile> | null | undefined): LightsFile {
  return {
    version: 1,
    lights: normalizeLights(payload?.lights),
    effects: normalizeEffects(payload?.effects),
  };
}

async function ensureFile(): Promise<void> {
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    const empty: LightsFile = { version: 1, lights: [], effects: makeDefaultEffects() };
    await fs.writeFile(FILE_PATH, JSON.stringify(empty, null, 2), "utf-8");
  }
}

export async function GET() {
  try {
    await ensureFile();
    const contents = await fs.readFile(FILE_PATH, "utf-8");
    const parsed = JSON.parse(contents || "{}") as Partial<LightsFile>;
    const normalized = normalizeFile(parsed);
    return new Response(JSON.stringify(normalized, null, 2), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("GET /api/level-lights error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to read level lights" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureFile();
    const body = (await req.json()) as Partial<LightsFile>;
    if (!body || !Array.isArray(body.lights)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: { lights: [...] } required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const normalized = normalizeFile(body as Partial<LightsFile>);

    await fs.writeFile(FILE_PATH, JSON.stringify(normalized, null, 2), "utf-8");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("PUT /api/level-lights error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to write level lights" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
