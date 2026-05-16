/**
 * Standard ARKit 51 blend-shape order used by Ready Player Me–style avatars
 * when morph targets are exported as "0" … "50".
 */
export const ARKIT_BLENDSHAPE_NAMES = [
  'browDownLeft',
  'browDownRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'cheekPuff',
  'cheekSquintLeft',
  'cheekSquintRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookInLeft',
  'eyeLookInRight',
  'eyeLookOutLeft',
  'eyeLookOutRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeSquintLeft',
  'eyeSquintRight',
  'jawForward',
  'jawLeft',
  'jawOpen',
  'jawRight',
  'mouthClose',
  'mouthDimpleLeft',
  'mouthDimpleRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthFunnel',
  'mouthLeft',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthPucker',
  'mouthRight',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthShrugLower',
  'mouthShrugUpper',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'noseSneerLeft',
  'noseSneerRight',
  'tongueOut',
] as const;

export type ArkitBlendShapeName = (typeof ARKIT_BLENDSHAPE_NAMES)[number];

/** @deprecated Use MorphTargetLerp from morph-target-lerp */
export type ArkitMouthKey =
  | 'jawOpen'
  | 'mouthClose'
  | 'mouthFunnel'
  | 'mouthPucker'
  | 'mouthSmileLeft'
  | 'mouthSmileRight';

/**
 * Build name → morph index map. Handles RPM GLBs whose dictionary keys are "0"…"50".
 */
export function resolveArkitMorphIndices(
  dictionary: Record<string, number> | undefined,
  morphCount: number,
): Partial<Record<ArkitBlendShapeName, number>> | null {
  if (!dictionary || morphCount < 1) return null;

  const keys = Object.keys(dictionary);
  const numericOnly = keys.length > 0 && keys.every((k) => /^\d+$/.test(k));

  if (!numericOnly) {
    const out: Partial<Record<ArkitBlendShapeName, number>> = {};
    for (const name of ARKIT_BLENDSHAPE_NAMES) {
      if (dictionary[name] !== undefined) out[name] = dictionary[name];
    }
    return Object.keys(out).length ? out : null;
  }

  const out: Partial<Record<ArkitBlendShapeName, number>> = {};
  const limit = Math.min(morphCount, ARKIT_BLENDSHAPE_NAMES.length);
  for (let i = 0; i < limit; i++) {
    const name = ARKIT_BLENDSHAPE_NAMES[i];
    const idx = dictionary[String(i)];
    if (idx !== undefined) out[name] = idx;
  }
  return out;
}
