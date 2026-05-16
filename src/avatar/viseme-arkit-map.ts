import type { ArkitBlendShapeName } from './arkit-blendshapes';

/** Oculus viseme → ARKit weights for RPM / Ready Player Me head meshes */
export const VISEME_ARKIT_WEIGHTS: Record<string, Partial<Record<ArkitBlendShapeName, number>>> = {
  sil: { mouthClose: 0.22 },
  PP: { mouthClose: 0.6, mouthPressLeft: 0.4, mouthPressRight: 0.4, jawOpen: 0.14 },
  FF: { mouthLowerDownLeft: 0.55, mouthLowerDownRight: 0.55, jawOpen: 0.24 },
  TH: { jawOpen: 0.53, mouthStretchLeft: 0.15, mouthStretchRight: 0.15 },
  DD: { jawOpen: 0.62 },
  kk: { jawOpen: 0.48, mouthStretchLeft: 0.2, mouthStretchRight: 0.2 },
  CH: { mouthFunnel: 0.45, jawOpen: 0.58 },
  SS: { mouthSmileLeft: 0.25, mouthSmileRight: 0.25, jawOpen: 0.31 },
  nn: { jawOpen: 0.43, mouthClose: 0.08 },
  RR: { jawOpen: 0.67 },
  aa: { jawOpen: 0.98, mouthLowerDownLeft: 0.12, mouthLowerDownRight: 0.12 },
  E: { jawOpen: 0.7, mouthSmileLeft: 0.28, mouthSmileRight: 0.28 },
  I: { jawOpen: 0.5, mouthSmileLeft: 0.35, mouthSmileRight: 0.35 },
  O: { jawOpen: 0.62, mouthFunnel: 0.45, mouthPucker: 0.2 },
  U: { jawOpen: 0.38, mouthPucker: 0.5, mouthFunnel: 0.25 },
};

export const SPEECH_MORPH_KEYS = [
  'jawOpen',
  'mouthClose',
  'mouthFunnel',
  'mouthPucker',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthStretchLeft',
  'mouthStretchRight',
] as const satisfies readonly ArkitBlendShapeName[];

export type SpeechMorphKey = (typeof SPEECH_MORPH_KEYS)[number];

/** Extra jaw openness on top of table values (table uses 0–1 morph range). */
const JAW_GAIN = 2.2;

export function visemeToMorphWeights(viseme: string): Partial<Record<SpeechMorphKey, number>> {
  const base = VISEME_ARKIT_WEIGHTS[viseme] ?? { jawOpen: 0.75 };
  const out: Partial<Record<SpeechMorphKey, number>> = {};

  for (const [key, value] of Object.entries(base)) {
    const v = value ?? 0;
    if (key === 'jawOpen') {
      out.jawOpen = Math.min(1, v * JAW_GAIN);
    } else if (key === 'mouthClose') {
      out.mouthClose = v * 0.7;
    } else {
      out[key as SpeechMorphKey] = Math.min(1, v * 1.08);
    }
  }
  return out;
}
