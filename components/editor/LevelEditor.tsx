"use client";

import { useEffect, useMemo } from "react";
import { useEditorStore } from "./editorStore";
import type { LightRecord } from "./LightsFromFile";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="mb-4">
			<div className="text-xs uppercase tracking-wide text-neutral-400 mb-2">{title}</div>
			{children}
		</div>
	);
}

function Row({ children, className = "" }: { children: React.ReactNode; className?: string }) {
	return <div className={`flex items-center gap-2 ${className}`}>{children}</div>;
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-2 py-1">
			<div className="text-sm text-neutral-300 min-w-20">{label}</div>
			<div className="flex-1">{children}</div>
		</div>
	);
}

function Num({
	value,
	onChange,
	step = 0.1,
	min,
	max,
}: {
	value: number;
	onChange: (v: number) => void;
	step?: number;
	min?: number;
	max?: number;
}) {
	return (
		<input
			className="w-full bg-neutral-900 text-neutral-200 border border-neutral-700 rounded px-2 py-1 text-sm"
			type="number"
			step={step}
			min={min}
			max={max}
			value={Number.isFinite(value) ? value : 0}
			onChange={(e) => onChange(parseFloat(e.target.value))}
		/>
	);
}

function Slider({
	value,
	onChange,
	min = 0,
	max = 1,
	step = 0.01,
}: {
	value: number;
	onChange: (v: number) => void;
	min?: number;
	max?: number;
	step?: number;
}) {
	return (
		<input
			className="w-full"
			type="range"
			min={min}
			max={max}
			step={step}
			value={value}
			onChange={(e) => onChange(parseFloat(e.target.value))}
		/>
	);
}

function Color({ value, onChange }: { value: string; onChange: (v: string) => void }) {
	return (
		<input
			type="color"
			className="w-10 h-8 p-0 bg-transparent border border-neutral-700 rounded"
			value={value}
			onChange={(e) => onChange(e.target.value)}
		/>
	);
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
	return (
		<button
			onClick={onClick}
			className={`px-3 py-1 rounded text-sm border ${
				active ? "bg-blue-600 border-blue-500" : "bg-neutral-900 border-neutral-700 hover:border-neutral-500"
			}`}
		>
			{children}
		</button>
	);
}

export default function LevelEditor() {
	const {
		lights,
		selectedId,
		mode,
		space,
		snap,
		showHelpers,
		setSelectedId,
		setLights,
		updateSelected,
		addPoint,
		addSpot,
		addRect,
		addAmbient,
		removeSelected,
		load,
		save,
		setMode,
		setSpace,
		setSnap,
		setShowHelpers,
	} = useEditorStore();

	useEffect(() => {
		// Load lights/effects when editor mounts
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const selected = useMemo(() => lights.find((l) => l.id === selectedId) || null, [lights, selectedId]);

	const setPos = (axis: 0 | 1 | 2, v: number) => {
		if (!selected) return;
		const next = [...selected.position] as [number, number, number];
		next[axis] = v;
		updateSelected({ position: next });
	};

	const setRot = (axis: 0 | 1 | 2, v: number) => {
		if (!selected) return;
		const rot = (selected.rotation ?? [0, 0, 0]).slice() as [number, number, number];
		rot[axis] = v;
		updateSelected({ rotation: rot });
	};

	return (
		<aside className="w-[320px] max-w-[50vw] h-full overflow-y-auto border-l border-neutral-800 bg-neutral-950/90 backdrop-blur p-4">
			<div className="flex items-center justify-between mb-4">
				<div className="font-semibold">Level Editor</div>
				<div className="flex gap-2">
					<button onClick={load} className="px-2 py-1 text-sm rounded border border-neutral-700 hover:border-neutral-500">Load</button>
					<button onClick={save} className="px-2 py-1 text-sm rounded border border-blue-500 bg-blue-600">Save</button>
				</div>
			</div>

			<Section title="Create Light">
				<Row>
					<button onClick={addPoint} className="px-2 py-1 text-sm rounded border border-neutral-700 hover:border-neutral-500">Point</button>
					<button onClick={addSpot} className="px-2 py-1 text-sm rounded border border-neutral-700 hover:border-neutral-500">Spot</button>
					<button onClick={addRect} className="px-2 py-1 text-sm rounded border border-neutral-700 hover:border-neutral-500">Rect</button>
					<button onClick={addAmbient} className="px-2 py-1 text-sm rounded border border-neutral-700 hover:border-neutral-500">Ambient</button>
				</Row>
			</Section>

			<Section title="Transform">
				<Row className="mb-2">
					<ModeButton active={mode === "translate"} onClick={() => setMode("translate")}>W Move</ModeButton>
					<ModeButton active={mode === "rotate"} onClick={() => setMode("rotate")}>E Rotate</ModeButton>
					<ModeButton active={mode === "scale"} onClick={() => setMode("scale")}>R Scale</ModeButton>
				</Row>
				<Row>
					<button
						onClick={() => setSpace(space === "world" ? "local" : "world")}
						className="px-2 py-1 text-sm rounded border border-neutral-700 hover:border-neutral-500"
					>
						Space: {space}
					</button>
					<button
						onClick={() => setSnap(!snap)}
						className={`px-2 py-1 text-sm rounded border ${snap ? "bg-neutral-800 border-neutral-600" : "border-neutral-700 hover:border-neutral-500"}`}
					>
						Snap {snap ? "On" : "Off"}
					</button>
					<button
						onClick={() => setShowHelpers(!showHelpers)}
						className={`px-2 py-1 text-sm rounded border ${showHelpers ? "bg-neutral-800 border-neutral-600" : "border-neutral-700 hover:border-neutral-500"}`}
					>
						Helpers {showHelpers ? "On" : "Off"}
					</button>
				</Row>
			</Section>

			<Section title="Lights">
				<div className="space-y-1">
					{lights.length === 0 && (
						<div className="text-sm text-neutral-500">No lights yet. Add one above.</div>
					)}
					{lights.map((l) => (
						<div
							key={l.id}
							className={`flex items-center justify-between px-2 py-1 rounded border cursor-pointer ${
								selectedId === l.id ? "border-blue-500 bg-blue-950/30" : "border-neutral-800 hover:border-neutral-600"
							}`}
							onClick={() => setSelectedId(l.id)}
						>
							<div className="text-sm capitalize">{l.type} light</div>
							<div className="flex items-center gap-2">
								<div className="text-xs text-neutral-500">{l.id.slice(0, 6)}</div>
								<button
									onClick={(e) => { e.stopPropagation(); setSelectedId(l.id); removeSelected(); }}
									className="px-2 py-0.5 text-xs rounded border border-red-600 text-red-300 hover:bg-red-900/30"
								>
									Delete
								</button>
							</div>
						</div>
					))}
				</div>
			</Section>

			{selected && (
				<Section title="Selected Properties">
					<Labeled label="Color">
						<Row>
							<Color value={selected.color} onChange={(v) => updateSelected({ color: v })} />
							<div className="flex-1" />
						</Row>
					</Labeled>
					<Labeled label="Intensity">
						<Slider value={selected.intensity} min={0} max={10} step={0.05} onChange={(v) => updateSelected({ intensity: v })} />
					</Labeled>
					<div className="grid grid-cols-3 gap-2">
						<Labeled label="Pos X"><Num value={selected.position[0]} onChange={(v) => setPos(0, v)} step={0.1} /></Labeled>
						<Labeled label="Pos Y"><Num value={selected.position[1]} onChange={(v) => setPos(1, v)} step={0.1} /></Labeled>
						<Labeled label="Pos Z"><Num value={selected.position[2]} onChange={(v) => setPos(2, v)} step={0.1} /></Labeled>
					</div>

					{selected.type !== "point" && selected.type !== "ambient" && (
						<div className="grid grid-cols-3 gap-2 mt-2">
							<Labeled label="Rot X"><Num value={(selected.rotation ?? [0, 0, 0])[0]} onChange={(v) => setRot(0, v)} step={0.02} /></Labeled>
							<Labeled label="Rot Y"><Num value={(selected.rotation ?? [0, 0, 0])[1]} onChange={(v) => setRot(1, v)} step={0.02} /></Labeled>
							<Labeled label="Rot Z"><Num value={(selected.rotation ?? [0, 0, 0])[2]} onChange={(v) => setRot(2, v)} step={0.02} /></Labeled>
						</div>
					)}

					{selected.type === "point" && (
						<>
							<Labeled label="Distance"><Num value={selected.distance ?? 0} onChange={(v) => updateSelected({ distance: v })} step={0.1} /></Labeled>
							<Labeled label="Decay"><Num value={selected.decay ?? 2} onChange={(v) => updateSelected({ decay: v })} step={0.1} /></Labeled>
						</>
					)}

					{selected.type === "spot" && (
						<>
							<Labeled label="Angle (rad)"><Num value={selected.angle ?? Math.PI / 6} onChange={(v) => updateSelected({ angle: v })} step={0.01} /></Labeled>
							<Labeled label="Penumbra"><Num value={selected.penumbra ?? 0.2} onChange={(v) => updateSelected({ penumbra: v })} step={0.01} /></Labeled>
							<Labeled label="Distance"><Num value={selected.distance ?? 0} onChange={(v) => updateSelected({ distance: v })} step={0.1} /></Labeled>
							<Labeled label="Decay"><Num value={selected.decay ?? 2} onChange={(v) => updateSelected({ decay: v })} step={0.1} /></Labeled>
						</>
					)}

					{selected.type === "rect" && (
						<>
							<Labeled label="Width"><Num value={selected.width ?? 1} onChange={(v) => updateSelected({ width: v })} step={0.05} /></Labeled>
							<Labeled label="Height"><Num value={selected.height ?? 1} onChange={(v) => updateSelected({ height: v })} step={0.05} /></Labeled>
						</>
					)}

					<div className="mt-3 flex gap-2">
						<button onClick={removeSelected} className="px-2 py-1 text-sm rounded border border-red-600 text-red-300 hover:bg-red-900/30">Delete</button>
					</div>
				</Section>
			)}
		</aside>
	);
}

