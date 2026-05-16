import { LipsyncEn } from '@met4citizen/talkinghead/modules/lipsync-en.mjs';
import {
  SPEECH_MORPH_KEYS,
  visemeToMorphWeights,
  type SpeechMorphKey,
} from './viseme-arkit-map';

export type LipSyncMorphs = Partial<Record<SpeechMorphKey, number>>;

export interface LipSyncFrame {
  morphs: LipSyncMorphs;
}

interface VisemeCue {
  timeMs: number;
  durationMs: number;
  viseme: string;
}

type VisemeGroup = 'closed' | 'mid' | 'open';

const CLOSED = new Set(['PP', 'FF', 'sil']);
const OPEN = new Set(['aa', 'E', 'O', 'U', 'DD', 'RR', 'CH']);

function visemeGroup(v: string): VisemeGroup {
  if (CLOSED.has(v)) return 'closed';
  if (OPEN.has(v)) return 'open';
  return 'mid';
}

function visemeOpenness(v: string): number {
  const w = visemeToMorphWeights(v);
  return w.jawOpen ?? 0.3;
}

/** Smooth hold through the middle of each phoneme — shorter ramps = tighter sync */
function phonemeEnvelope(localT: number): number {
  if (localT < 0.12) return localT / 0.12;
  if (localT > 0.88) return (1 - localT) / 0.12;
  return 1;
}

/**
 * Text → smoothed ARKit mouth timeline for browser TTS.
 */
export class TextLipSyncPlayer {
  private readonly processor = new LipsyncEn();
  private cues: VisemeCue[] = [];
  private startMs = 0;
  private totalMs = 0;
  private active = false;
  private readonly smoothed: LipSyncMorphs = {};

  schedule(text: string, speechRate = 1, durationMs?: number): void {
    const cleaned = this.processor.preProcessText(text);
    const words = cleaned.split(/\s+/).filter(Boolean);
    const cues: VisemeCue[] = [];
    const rate = Math.max(0.5, Math.min(2, speechRate));
    const timeScale = (1 / rate) * 100;
    let cursorMs = 0;

    for (const word of words) {
      const block = this.processor.wordsToVisemes(word);
      for (let i = 0; i < block.visemes.length; i++) {
        const dur = Math.max(100, (block.durations[i] ?? 0.14) * timeScale);
        cues.push({
          timeMs: cursorMs + (block.times[i] ?? 0) * timeScale,
          durationMs: dur,
          viseme: block.visemes[i],
        });
      }
      const last = block.visemes.length - 1;
      const wordLen =
        last >= 0
          ? ((block.times[last] ?? 0) + (block.durations[last] ?? 0.2)) * timeScale
          : 220 / rate;
      cursorMs += wordLen + 70 / rate;
    }

    const builtMs = cursorMs || 1;
    const estimatedMs =
      durationMs ?? Math.max(500, (cleaned.length / (11 * rate)) * 1000);
    const scale = estimatedMs / builtMs;

    this.cues = this.coalesceCues(
      cues.map((c) => ({
        ...c,
        timeMs: c.timeMs * scale,
        durationMs: c.durationMs * scale,
      })),
    );
    this.totalMs =
      this.cues.length > 0
        ? this.cues[this.cues.length - 1].timeMs +
          this.cues[this.cues.length - 1].durationMs +
          120
        : estimatedMs;

    for (const key of SPEECH_MORPH_KEYS) {
      this.smoothed[key] = 0;
    }
  }

  /** Merge rapid visemes so the mouth moves at a human pace (~5–7 shapes/sec max). */
  private coalesceCues(cues: VisemeCue[]): VisemeCue[] {
    if (!cues.length) return cues;

    const MIN_MS = 13;
    const out: VisemeCue[] = [];
    let cur: VisemeCue = {
      ...cues[0],
      durationMs: Math.max(MIN_MS, cues[0].durationMs),
    };

    for (let i = 1; i < cues.length; i++) {
      const next = cues[i];
      const gap = next.timeMs - (cur.timeMs + cur.durationMs);
      const sameGroup = visemeGroup(cur.viseme) === visemeGroup(next.viseme);

      if (sameGroup && gap < 60) {
        const endMs = next.timeMs + Math.max(MIN_MS, next.durationMs);
        cur.durationMs = endMs - cur.timeMs;
        if (visemeOpenness(next.viseme) > visemeOpenness(cur.viseme)) {
          cur.viseme = next.viseme;
        }
      } else {
        out.push(cur);
        cur = { ...next, durationMs: Math.max(MIN_MS, next.durationMs) };
      }
    }
    out.push(cur);
    return out;
  }

  begin(atMs = performance.now()): void {
    this.active = this.cues.length > 0;
    this.startMs = atMs;
  }

  fitToDuration(actualMs: number): void {
    if (!this.cues.length || actualMs < 200) return;
    const scale = actualMs / (this.totalMs || 1);
    this.cues = this.coalesceCues(
      this.cues.map((c) => ({
        ...c,
        timeMs: c.timeMs * scale,
        durationMs: c.durationMs * scale,
      })),
    );
    this.totalMs = actualMs;
  }

  stop(): void {
    this.active = false;
    for (const key of SPEECH_MORPH_KEYS) {
      this.smoothed[key] = 0;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  sampleAt(now: number): LipSyncFrame {
    if (!this.active) return { morphs: this.copySmoothed() };

    const t = now - this.startMs;
    if (t < 0) return { morphs: this.copySmoothed() };

    if (t > this.totalMs + 180) {
      this.active = false;
      return { morphs: this.copySmoothed() };
    }

    const raw = this.sampleRaw(t);
    for (const key of SPEECH_MORPH_KEYS) {
      const target = raw[key] ?? 0;
      const prev = this.smoothed[key] ?? 0;
      const smooth = key === 'jawOpen' ? 0.22 : 0.15;
      this.smoothed[key] = prev + (target - prev) * smooth;
    }

    return { morphs: this.copySmoothed() };
  }

  private copySmoothed(): LipSyncMorphs {
    return { ...this.smoothed };
  }

  private sampleRaw(t: number): LipSyncMorphs {
    let cue: VisemeCue | null = null;
    let nextCue: VisemeCue | null = null;

    for (let i = 0; i < this.cues.length; i++) {
      const c = this.cues[i];
      if (t >= c.timeMs && t < c.timeMs + c.durationMs) {
        cue = c;
        nextCue = this.cues[i + 1] ?? null;
        break;
      }
      if (t < c.timeMs) {
        nextCue = c;
        break;
      }
    }

    if (!cue) {
      return {};
    }

    const localT = (t - cue.timeMs) / Math.max(1, cue.durationMs);
    let envelope = phonemeEnvelope(localT);

    if (nextCue && localT > 0.65) {
      const blend = (localT - 0.65) / 0.35;
      const nextEnv = phonemeEnvelope(0);
      envelope = envelope * (1 - blend * 0.5) + nextEnv * blend * 0.5;
    }

    const base = visemeToMorphWeights(cue.viseme);
    const out: LipSyncMorphs = {};
    for (const [key, value] of Object.entries(base)) {
      out[key as SpeechMorphKey] = (value ?? 0) * envelope;
    }
    return out;
  }
}
