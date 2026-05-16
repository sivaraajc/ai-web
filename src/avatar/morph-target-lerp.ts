import * as THREE from 'three';
import {
  ARKIT_BLENDSHAPE_NAMES,
  resolveArkitMorphIndices,
  type ArkitBlendShapeName,
} from './arkit-blendshapes';
import { SPEECH_MORPH_KEYS, type SpeechMorphKey } from './viseme-arkit-map';

/**
 * Aarya-style morph lerp, scoped to the face mesh only (AvatarHead).
 * RPM models use dictionary keys "0"…"50" in ARKit order — jawOpen = 22.
 */
export class MorphTargetLerp {
  private faceMesh: THREE.Mesh | null = null;
  private arkitIndices: Partial<Record<ArkitBlendShapeName, number>> | null = null;

  collectFrom(root: THREE.Object3D): void {
    this.faceMesh = null;
    this.arkitIndices = null;

    const candidates: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && (node.morphTargetInfluences?.length ?? 0) >= 20) {
        candidates.push(node);
      }
    });

    const hasJaw = (m: THREE.Mesh) => {
      const d = m.morphTargetDictionary;
      if (!d) return false;
      if (d['jawOpen'] !== undefined || d['22'] !== undefined) return true;
      const arkit = resolveArkitMorphIndices(d, m.morphTargetInfluences?.length ?? 0);
      return arkit?.['jawOpen'] !== undefined;
    };

    this.faceMesh =
      candidates.find((m) => m.name === 'AvatarHead' && hasJaw(m)) ??
      candidates.find((m) => m.name === 'Wolf3D_Head') ??
      candidates.find((m) => m.name === 'Head') ??
      candidates.find(hasJaw) ??
      candidates.find((m) => m.name === 'AvatarHead') ??
      candidates[0] ??
      null;

    if (this.faceMesh) {
      this.arkitIndices = resolveArkitMorphIndices(
        this.faceMesh.morphTargetDictionary,
        this.faceMesh.morphTargetInfluences?.length ?? 0,
      );
    }
  }

  hasJawOpen(): boolean {
    return this.resolveIndex('jawOpen') !== undefined;
  }

  /**
   * Lerp a morph on the face mesh only (matches Aarya `lerpMorphTarget` on head).
   */
  lerp(target: string, value: number, speed = 0.25): number {
    if (!this.faceMesh) return 0;

    const index = this.resolveIndex(target);
    if (index === undefined) return 0;

    const inf = this.faceMesh.morphTargetInfluences;
    if (!inf || index >= inf.length) return 0;

    inf[index] = THREE.MathUtils.lerp(inf[index], value, speed);

    if (target === 'jawOpen' && value > 0.15) {
      const closeIdx = this.resolveIndex('mouthClose');
      if (closeIdx !== undefined && closeIdx < inf.length) {
        inf[closeIdx] = THREE.MathUtils.lerp(inf[closeIdx], 0, speed);
      }
    }

    return target === 'jawOpen' ? inf[index] : 0;
  }

  applySpeechMorphs(
    targets: Partial<Record<SpeechMorphKey, number>>,
    jawSpeed = 0.12,
    otherSpeed = 0.15,
  ): void {
    for (const key of SPEECH_MORPH_KEYS) {
      const value = targets[key] ?? 0;
      const speed = key === 'jawOpen' ? jawSpeed : otherSpeed;
      this.lerp(key, value, speed);
    }
  }

  getInfluence(target: SpeechMorphKey): number {
    if (!this.faceMesh) return 0;
    const index = this.resolveIndex(target);
    if (index === undefined) return 0;
    return this.faceMesh.morphTargetInfluences?.[index] ?? 0;
  }

  resetSpeechTargets(speed = 0.25): void {
    this.applySpeechMorphs({}, speed);
  }

  private resolveIndex(target: string): number | undefined {
    if (!this.faceMesh) return undefined;

    const dict = this.faceMesh.morphTargetDictionary;
    if (!dict) return undefined;

    if (dict[target] !== undefined) return dict[target];

    const arkitIdx = this.arkitIndices?.[target as ArkitBlendShapeName];
    if (arkitIdx !== undefined) return arkitIdx;

    const numeric = ARKIT_BLENDSHAPE_NAMES.indexOf(target as ArkitBlendShapeName);
    if (numeric >= 0 && dict[String(numeric)] !== undefined) {
      return dict[String(numeric)];
    }

    return undefined;
  }
}
