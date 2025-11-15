import type { FC } from "react";

export type LoopComponentProps = { loop: number };
export type LoopComponent = FC<LoopComponentProps>;

const registry = new Map<number, LoopComponent>();

export function registerLoop(loop: number, component: LoopComponent) {
  registry.set(loop, component);
}

export function getLoopComponent(loop: number): LoopComponent | null {
  return registry.get(loop) ?? null;
}

export function clearLoops() {
  registry.clear();
}
