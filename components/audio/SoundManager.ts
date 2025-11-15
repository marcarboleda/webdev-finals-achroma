"use client";

import * as THREE from "three";

export type SoundGroup = "master" | "sfx" | "music" | "ambient" | "ui";

export type OneShotOptions = {
  group?: SoundGroup;
  volume?: number; // 0..1
  playbackRate?: number; // e.g., 0.95..1.05 for variation
  detune?: number; // cents (not all browsers)
};

// Options for playing only a segment of a loaded buffer
export type SegmentOptions = OneShotOptions & {
  /** Start time in seconds within the buffer */
  start: number;
  /** Optional duration (seconds). If omitted, plays until end of buffer. */
  duration?: number;
};

export type PositionalOptions = OneShotOptions & {
  refDistance?: number;
  rolloffFactor?: number;
  maxDistance?: number;
};

export type MusicOptions = {
  volume?: number;
  loop?: boolean;
  fade?: number; // seconds for fade-in/out
};

type BufferCache = Map<string, AudioBuffer>;

// Small helper for time-based fades using rAF
function tween(durationSec: number, fn: (t01: number) => void, done?: () => void) {
  const start = performance.now();
  function step(now: number) {
    const t = Math.min(1, (now - start) / (durationSec * 1000));
    fn(t);
    if (t < 1) requestAnimationFrame(step);
    else done?.();
  }
  requestAnimationFrame(step);
}

export class SoundManager {
  readonly listener: THREE.AudioListener;
  readonly context: AudioContext;
  private buffers: BufferCache = new Map();

  // group routing
  private master: GainNode;
  private groups: Record<Exclude<SoundGroup, "master">, GainNode>;

  // music state
  private currentMusic?: THREE.Audio;
  private currentMusicName?: string;

  // simple rate-limits
  private lastFootstepAt = 0;

  constructor(listener: THREE.AudioListener) {
    this.listener = listener;
    this.context = (listener.context as unknown as AudioContext) ?? new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: "playback",
    } as any);

    // Create routing graph: source -> group -> master -> destination
    const ctx = this.context;
    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(ctx.destination);

    const makeGroup = () => {
      const g = ctx.createGain();
      g.gain.value = 1;
      g.connect(this.master);
      return g;
    };
    this.groups = {
      sfx: makeGroup(),
      music: makeGroup(),
      ambient: makeGroup(),
      ui: makeGroup(),
    };

    // Attach the listener to use same context routing
    // Drei/THREE uses listener.gain -> context.destination internally; we’ll keep our own routing for groups
    // We still add the listener to the scene camera so PositionalAudio works.
  }

  async resume() {
    if (this.context.state !== "running") {
      try {
        await this.context.resume();
      } catch {}
    }
  }

  setGroupVolume(group: SoundGroup, volume: number) {
    const v = Math.max(0, Math.min(1, volume));
    if (group === "master") this.master.gain.value = v;
    else this.groups[group].gain.value = v;
  }

  getGroupNode(group: SoundGroup): GainNode {
    if (group === "master") return this.master;
    return this.groups[group];
  }

  async load(name: string, url: string): Promise<void> {
    if (this.buffers.has(name)) return;
    // Use THREE.AudioLoader so loads participate in the global LoadingManager (preloader progress)
    const loader = new THREE.AudioLoader();
    const buf = await new Promise<AudioBuffer>((resolve, reject) => {
      loader.load(
        url,
        (buffer) => resolve(buffer),
        undefined,
        (err) => reject(err)
      );
    });
    this.buffers.set(name, buf);
  }

  async preload(entries: Record<string, string>) {
    await Promise.all(
      Object.entries(entries).map(([n, u]) => this.load(n, u).catch(() => void 0))
    );
  }

  has(name: string) {
    return this.buffers.has(name);
  }

  private getBuffer(name: string): AudioBuffer | undefined {
    return this.buffers.get(name);
  }

  // Non-positional one-shot
  playOneShot(name: string, opts: OneShotOptions = {}) {
    const buf = this.getBuffer(name);
    if (!buf) return;
    const src = new THREE.Audio(this.listener);
    // route THREE.Audio through our group gains via context graph
    // THREE.Audio internally creates a GainNode -> panner/ destination; we can just set volume and play
    src.setBuffer(buf);
    src.setLoop(false);
    if (opts.playbackRate) src.setPlaybackRate(opts.playbackRate);
    if (typeof (src as any).detune === "number" && typeof opts.detune === "number") {
      (src as any).detune = opts.detune;
    }
    const vol = Math.max(0, Math.min(1, opts.volume ?? 1));
    src.setVolume(vol);

    // Connect to group node by replacing the listener gain destination
    const group = this.getGroupNode(opts.group ?? "sfx");
    const gain: GainNode = (src as any).gain?.gain?.context ? (src as any).gain.gain as any : undefined;
    // Fallback: just rely on src volume + master (works in most cases)
    // Play
    src.play();
    // Stop and dispose when ended
    const onEnd = () => {
      src.stop();
      (src as any).disconnect?.();
    };
    // THREE.Audio doesn’t expose ended event, let it run; GC will collect after buffer end.
    // Optionally schedule a stop
    setTimeout(onEnd, (buf.duration + 0.1) * 1000);
  }

  /**
   * Play a segment (slice) of an AudioBuffer without creating THREE.Audio wrapper.
   * Useful for sprite-like usage (e.g., door open/close in same file).
   */
  playSegment(name: string, segment: SegmentOptions) {
    // Ensure context is running to avoid start-up delay on some browsers
    if (this.context.state !== "running") {
      // fire-and-forget; we don't await to keep call sync
      this.context.resume().catch(() => {});
    }
    console.log("Playing segment", name, segment);
    const buf = this.getBuffer(name);
    if (!buf) return;
    const { start, duration, group = "sfx", volume = 1, playbackRate = 1, detune } = segment;
    if (start >= buf.duration) return; // out of range
    const playDur = Math.max(0, duration !== undefined ? duration : buf.duration - start);
    if (playDur <= 0) return;

    const ctx = this.context;
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.playbackRate.value = playbackRate;
    if (typeof detune === "number" && (source as any).detune) {
      (source as any).detune.value = detune;
    }

  // Gain for volume with tiny de-click envelope
  const gain = ctx.createGain();
  const vol = Math.max(0, Math.min(1, volume));
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.005);

    // Route: source -> gain -> groupNode -> master
    const groupNode = this.getGroupNode(group);
    source.connect(gain);
    gain.connect(groupNode);

    // Start playback at offset with duration
    try {
      source.start(0, start, playDur);
    } catch {
      return;
    }

    // Cleanup after it finishes (consider playbackRate scaling)
  // Schedule a tiny fade-out at the end to avoid clicks
  const totalSec = playDur / playbackRate;
  gain.gain.setValueAtTime(vol, now + Math.max(0, totalSec - 0.01));
  gain.gain.linearRampToValueAtTime(0, now + Math.max(0, totalSec - 0.002));

  const totalMs = totalSec * 1000 + 50;
    setTimeout(() => {
      try {
        source.stop();
      } catch {}
      try {
        source.disconnect();
        gain.disconnect();
      } catch {}
    }, totalMs);
  }

  // Convenience helpers for door open/close using a single sprite file
  playDoorOpen() {
    // Account for encoder delay padding at the beginning of compressed files (mp3/aac)
    // Fudge a tiny offset so the transient hits instantly
    const OPEN_START = 0.0; // ~20ms
    const OPEN_DUR = Math.max(0.05, 1.5 - OPEN_START);
    this.playSegment("door_open_close", { start: OPEN_START, duration: OPEN_DUR, group: "sfx", volume: 1 });
  }

  playDoorClose() {
    // Start slightly after the boundary to avoid overlap with the open slice boundary
    const CLOSE_START = 1.52; // 0.1s + 20ms
    this.playSegment("door_open_close", { start: CLOSE_START, group: "sfx", volume: 1 });
  }

  // Positional one-shot using THREE.PositionalAudio; user should attach node to an Object3D.
  createPositional(name: string, opts: PositionalOptions = {}): THREE.PositionalAudio | null {
    const buf = this.getBuffer(name);
    if (!buf) return null;
    const src = new THREE.PositionalAudio(this.listener);
    src.setBuffer(buf);
    src.setLoop(false);
    if (opts.playbackRate) src.setPlaybackRate(opts.playbackRate);
    const vol = Math.max(0, Math.min(1, opts.volume ?? 1));
    src.setVolume(vol);
    if (opts.refDistance !== undefined) src.setRefDistance(opts.refDistance);
    if (opts.rolloffFactor !== undefined) src.setRolloffFactor(opts.rolloffFactor);
    if (opts.maxDistance !== undefined) src.setMaxDistance(opts.maxDistance);
    return src;
  }

  async playMusic(name: string, opts: MusicOptions = {}) {
    const buf = this.getBuffer(name);
    if (!buf) return;
    const loop = opts.loop ?? true;
    const vol = Math.max(0, Math.min(1, opts.volume ?? 0.8));
    const fade = Math.max(0, opts.fade ?? 1.0);

    const next = new THREE.Audio(this.listener);
    next.setBuffer(buf);
    next.setLoop(loop);
    next.setVolume(0);
    next.play();

    const startFadeIn = () => tween(fade, (t) => next.setVolume(vol * t));

    if (this.currentMusic) {
      const prev = this.currentMusic;
      tween(fade, (t) => prev.setVolume((1 - t) * prev.getVolume()), () => {
        prev.stop();
        (prev as any).disconnect?.();
      });
      startFadeIn();
    } else {
      startFadeIn();
    }

    this.currentMusic = next;
    this.currentMusicName = name;
  }

  stopMusic(fadeSec = 0.8) {
    if (!this.currentMusic) return;
    const prev = this.currentMusic;
    tween(fadeSec, (t) => prev.setVolume((1 - t) * prev.getVolume()), () => {
      prev.stop();
      (prev as any).disconnect?.();
    });
    this.currentMusic = undefined;
    this.currentMusicName = undefined;
  }

  // Convenience variations
  async playFootstep(which: "left" | "right" | "any" = "any") {
    const now = performance.now();
    if (now - this.lastFootstepAt < 110) return; // rate limit
    this.lastFootstepAt = now;
    const idx = 1 + Math.floor(Math.random() * 3); // 1..3
    const name = `footstep_${idx}`;
    if (this.has(name)) {
      this.playOneShot(name, {
        group: "sfx",
        volume: 0.6 + Math.random() * 0.15,
        playbackRate: 0.95 + Math.random() * 0.1,
      });
    }
  }
}
