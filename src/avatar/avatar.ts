import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';

import { CommonModule } from '@angular/common';

import * as THREE from 'three';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { MorphTargetLerp } from './morph-target-lerp';

import { TextLipSyncPlayer } from './text-lipsync-player';



@Component({

  selector: 'app-avatar',

  standalone: true,

  imports: [CommonModule],

  templateUrl: './avatar.html',

  styleUrls: ['./avatar.css'],

})

export class Avatar implements AfterViewInit, OnDestroy {

  @ViewChild('canvas3d', { static: true }) canvasRef!: ElementRef;

  isloader: boolean = true;

  private renderer!: THREE.WebGLRenderer;

  private scene!: THREE.Scene;

  private camera!: THREE.PerspectiveCamera;

  private model!: THREE.Object3D;

  private animationId!: number;



  /** Aarya-style morph lerp across all face meshes */

  private readonly morphLerp = new MorphTargetLerp();

  private readonly textLipSync = new TextLipSyncPlayer();

  private speechStartedAt = 0;

  private lastLipSyncResyncAt = 0;

  private outfitEntries: Array<{

    mat: THREE.MeshStandardMaterial;

    base: THREE.Color;

    part: 'top' | 'bottom' | 'shoes';

  }> = [];

  private readonly dailyOutfitThemes: Array<{

    top: number;

    bottom: number;

    shoes: number;

  }> = [

    { top: 0x7c3aed, bottom: 0x1e3a5f, shoes: 0x0f172a },

    { top: 0x0ea5e9, bottom: 0x134e4a, shoes: 0x042f2e },

    { top: 0x6ee7c5, bottom: 0x1e293b, shoes: 0x0f172a },

    { top: 0xf43f5e, bottom: 0x312e81, shoes: 0x1e1b4b },

    { top: 0xf59e0b, bottom: 0x422006, shoes: 0x292524 },

    { top: 0x8da2ff, bottom: 0x1e3a8a, shoes: 0x172554 },

    { top: 0x10b981, bottom: 0x064e3b, shoes: 0x022c22 },

  ];



  private jawBone: THREE.Object3D | null = null;

  private jawBaseX = 0;

  private headBone: THREE.Object3D | null = null;

  private headBaseX = 0;

  private headBaseY = 0;

  private chestBone: THREE.Object3D | null = null;

  private chestBaseX = 0;

  private leftEye!: THREE.Object3D;

  private rightEye!: THREE.Object3D;

  private speechUtterance: SpeechSynthesisUtterance | null = null;

  private isSpeaking = false;

  private mouthOpenAmount = 0;

  private blinkAmount = 0;

  private nextBlinkAt = 0;

  private blinkPhaseEnd = 0;



  private leftArm!: THREE.Object3D;

  private rightArm!: THREE.Object3D;

  private leftForeArm!: THREE.Object3D;

  private rightForeArm!: THREE.Object3D;



  constructor(private cdr: ChangeDetectorRef) {}



  private controls!: OrbitControls;



  ngAfterViewInit(): void {

    this.initThree();

    this.loadModel();

    this.animate();

    window.addEventListener('resize', () => this.resizeToContainer());

  }



  resizeToContainer(): void {

    if (!this.renderer || !this.camera) return;

    const canvas = this.canvasRef?.nativeElement;

    const parent = canvas?.parentElement;

    const w = parent?.clientWidth || window.innerWidth;

    const h = parent?.clientHeight || window.innerHeight;

    if (w < 1 || h < 1) return;

    this.camera.aspect = w / h;

    this.camera.updateProjectionMatrix();

    this.renderer.setSize(w, h);

  }



  initThree() {

    const canvas = this.canvasRef.nativeElement;

    this.scene = new THREE.Scene();



    const parent = canvas.parentElement;

    const initW = parent?.clientWidth || window.innerWidth;

    const initH = parent?.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(25, initW / initH, 0.6, 2000);

    this.camera.lookAt(0, 1.5, 0);

    this.camera.position.set(0, 1.5, 3);



    this.renderer = new THREE.WebGLRenderer({

      canvas,

      alpha: true,

      antialias: true,

    });

    this.renderer.setSize(initW, initH);

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));



    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5);

    hemiLight.position.set(0, 60, 0);

    this.scene.add(hemiLight);



    const dirLight = new THREE.DirectionalLight(0xffffff, 1);

    dirLight.position.set(3, 50, 10);

    this.scene.add(dirLight);



    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.controls.enableDamping = true;

    this.controls.dampingFactor = 0.05;

    this.controls.enablePan = false;

    this.controls.minDistance = 1.5;

    this.controls.maxDistance = 5;

    this.controls.target.set(0, 1.5, 0);

  }



  loadModel() {

    const loader = new GLTFLoader();



    loader.load(

      '/model.glb',

      (gltf) => {

        this.model = gltf.scene;

        this.model.scale.set(1.5, 1.5, 1.5);

        this.model.position.set(0, -0.8, 0);

        this.scene.add(this.model);



        this.morphLerp.collectFrom(this.model);

        if (!this.morphLerp.hasJawOpen()) {

          console.warn('[Avatar] jawOpen morph not found — mouth will not open');

        }



        this.isloader = false;

        this.cdr.detectChanges();



        this.setupOutfitMeshes();

        this.applyDailyOutfitColor();



        this.jawBone =

          this.model.getObjectByName('Jaw') ||

          this.model.getObjectByName('jaw') ||

          this.model.getObjectByName('mixamorigJaw') ||

          this.model.getObjectByName('CC_Base_JawRoot') ||

          null;

        if (this.jawBone) {

          this.jawBaseX = this.jawBone.rotation.x;

        }

        this.headBone =

          this.model.getObjectByName('Head') ||

          this.model.getObjectByName('mixamorigHead') ||

          this.model.getObjectByName('CC_Base_Head') ||

          null;

        if (this.headBone) {

          this.headBaseX = this.headBone.rotation.x;

          this.headBaseY = this.headBone.rotation.y;

        }

        this.chestBone =

          this.model.getObjectByName('Spine2') ||

          this.model.getObjectByName('mixamorigSpine2') ||

          this.model.getObjectByName('Chest') ||

          null;

        if (this.chestBone) {

          this.chestBaseX = this.chestBone.rotation.x;

        }

        this.leftEye = this.model.getObjectByName('LeftEye')!;

        this.rightEye = this.model.getObjectByName('RightEye')!;

        this.nextBlinkAt = performance.now() + this.getNextBlinkDelay();



        this.leftArm =

          this.model.getObjectByName('LeftArm') || this.model.getObjectByName('mixamorigLeftArm')!;

        this.rightArm =

          this.model.getObjectByName('RightArm') ||

          this.model.getObjectByName('mixamorigRightArm')!;

        this.leftForeArm =

          this.model.getObjectByName('LeftForeArm') ||

          this.model.getObjectByName('mixamorigLeftForeArm')!;

        this.rightForeArm =

          this.model.getObjectByName('RightForeArm') ||

          this.model.getObjectByName('mixamorigRightForeArm')!;



        this.setHandsDown();

      },

      undefined,

      (error) => console.error('Error loading GLB:', error),

    );

  }



  speak(message: string) {

    const text = message.trim();

    if (!text) return;



    speechSynthesis.cancel();

    this.resetSpeechFace();



    const utterance = new SpeechSynthesisUtterance(text);



    const setMaleVoiceAndSpeak = () => {

      const voices = speechSynthesis.getVoices();



      const preferredMaleVoices = [

        'Microsoft David',

        'Microsoft Mark',

        'Google UK English Male',

        'Google English Male',

        'Alex',

        'Daniel',

        'Fred',

        'Aaron',

        'Nathan',

        'Tom',

        'Lee',

      ];



      let selectedVoice = voices.find((v) =>

        preferredMaleVoices.some((name) => v.name.toLowerCase().includes(name.toLowerCase())),

      );



      if (!selectedVoice) {

        selectedVoice = voices.find((v) => v.name.toLowerCase().includes('male'));

      }



      if (!selectedVoice) {

        selectedVoice = voices.find((v) => {

          const n = v.name.toLowerCase();

          return !['zira', 'hazel', 'susan', 'female', 'samantha', 'victoria', 'karen', 'moira'].some(

            (f) => n.includes(f),

          );

        });

      }



      if (selectedVoice) {

        utterance.voice = selectedVoice;

      }



      utterance.rate = 0.95;

      utterance.pitch = 0.7;

      utterance.volume = 1;

      utterance.lang = 'en-US';



      const estDurationMs = Math.max(600, (text.length / (12.5 * utterance.rate)) * 1000);



      this.isSpeaking = true;

      this.lastLipSyncResyncAt = 0;

      this.speechStartedAt = performance.now();

      this.textLipSync.schedule(text, utterance.rate, estDurationMs);

      this.textLipSync.begin(this.speechStartedAt);



      utterance.onstart = () => {

        const now = performance.now();

        this.speechStartedAt = now;

        this.textLipSync.begin(now);

      };



      utterance.onboundary = (ev) => {

        if (!this.isSpeaking || ev.name !== 'word') return;

        const elapsed = performance.now() - this.speechStartedAt;

        const progress = ev.charIndex / Math.max(1, text.length);

        if (progress < 0.08 || progress > 0.92) return;

        const now = performance.now();

        if (now - this.lastLipSyncResyncAt < 280) return;

        this.lastLipSyncResyncAt = now;

        this.textLipSync.fitToDuration(elapsed / progress);

      };



      utterance.onend = () => {

        const actualMs = performance.now() - this.speechStartedAt;

        this.textLipSync.fitToDuration(actualMs);

      };



      utterance.onerror = () => {

        this.resetSpeechFace();

      };



      this.speechUtterance = utterance;

      speechSynthesis.speak(utterance);

    };



    if (speechSynthesis.getVoices().length === 0) {

      speechSynthesis.onvoiceschanged = () => setMaleVoiceAndSpeak();

    } else {

      setMaleVoiceAndSpeak();

    }

  }



  setHandsDown() {

    if (this.leftArm && this.rightArm) {

      this.leftArm.rotation.set(1.1, 0.0, 0.1);

      this.rightArm.rotation.set(1.1, 0.0, -0.1);

    }

    if (this.leftForeArm && this.rightForeArm) {

      this.leftForeArm.rotation.set(0.0, 0.0, 0.0);

      this.rightForeArm.rotation.set(0.0, 0.0, 0.0);

    }

  }



  animate = () => {

    this.animationId = requestAnimationFrame(this.animate);



    if (this.model) {

      this.setHandsDown();



      const now = performance.now();



      if (this.isSpeaking) {

        const frame = this.textLipSync.sampleAt(now);

        if (!this.textLipSync.isActive()) {

          this.resetSpeechFace();

        } else {

          this.morphLerp.applySpeechMorphs(frame.morphs);

          const jawNow = this.morphLerp.getInfluence('jawOpen');

          this.mouthOpenAmount = THREE.MathUtils.lerp(this.mouthOpenAmount, jawNow, 0.2);

        }

      } else {

        this.morphLerp.applySpeechMorphs({}, 0.1, 0.08);

        this.mouthOpenAmount = THREE.MathUtils.lerp(this.mouthOpenAmount, 0, 0.1);

      }



      this.applyJawAndHeadMotion();

      this.updateBlink();



      if (this.leftEye && this.rightEye) {

        const eyeX = Math.sin(Date.now() * 0.002) * 0.05;

        const eyeY = Math.cos(Date.now() * 0.002) * 0.025;

        this.leftEye.rotation.set(eyeY, eyeX, 0);

        this.rightEye.rotation.set(eyeY, eyeX, 0);

      }

    }



    this.controls.update();

    this.renderer.render(this.scene, this.camera);

  };



  ngOnDestroy(): void {

    cancelAnimationFrame(this.animationId);

    this.textLipSync.stop();

    speechSynthesis.cancel();

    this.renderer.dispose();

  }



  private updateBlink(): void {

    const now = performance.now();



    if (now < this.blinkPhaseEnd) {

      const phase = 1 - (this.blinkPhaseEnd - now) / 200;

      this.blinkAmount = phase < 0.5 ? phase * 2 : (1 - phase) * 2;

      this.morphLerp.lerp('eyeBlinkLeft', this.blinkAmount, 1);

      this.morphLerp.lerp('eyeBlinkRight', this.blinkAmount, 1);

    } else if (now >= this.nextBlinkAt) {

      this.blinkPhaseEnd = now + 200;

      this.nextBlinkAt = now + this.getNextBlinkDelay();

    } else {

      this.blinkAmount = THREE.MathUtils.lerp(this.blinkAmount, 0, 0.35);

      this.morphLerp.lerp('eyeBlinkLeft', 0, 0.25);

      this.morphLerp.lerp('eyeBlinkRight', 0, 0.25);

    }



    if (this.leftEye && this.rightEye) {

      const eyeScaleY = THREE.MathUtils.clamp(1 - this.blinkAmount * 0.5, 0.85, 1);

      this.leftEye.scale.y = eyeScaleY;

      this.rightEye.scale.y = eyeScaleY;

    }

  }



  private getNextBlinkDelay(): number {

    return 1800 + Math.random() * 2600;

  }



  private resetSpeechFace(): void {

    this.isSpeaking = false;

    this.lastLipSyncResyncAt = 0;

    this.mouthOpenAmount = 0;

    this.speechUtterance = null;

    this.textLipSync.stop();

    this.morphLerp.resetSpeechTargets(0.25);



    if (this.jawBone) {

      this.jawBone.rotation.x = this.jawBaseX;

    }

    if (this.headBone) {

      this.headBone.rotation.x = this.headBaseX;

      this.headBone.rotation.y = this.headBaseY;

    }

    if (this.chestBone) {

      this.chestBone.rotation.x = this.chestBaseX;

    }

  }



  private setupOutfitMeshes(): void {

    this.outfitEntries = [];

    const partFromName = (name: string): 'top' | 'bottom' | 'shoes' | null => {

      const n = name.toLowerCase();

      if (n.includes('outfit_top') || n === 'outfit_top') return 'top';

      if (n.includes('outfit_bottom') || n === 'outfit_bottom') return 'bottom';

      if (n.includes('outfit_shoes') || n === 'outfit_shoes') return 'shoes';

      return null;

    };



    this.model.traverse((obj) => {

      if (!(obj instanceof THREE.Mesh)) return;

      const part = partFromName(obj.name);

      if (!part) return;



      const sourceMats = Array.isArray(obj.material) ? obj.material : [obj.material];

      const clonedMats = sourceMats.map((m) => {

        if (m instanceof THREE.MeshStandardMaterial) {

          const clone = m.clone();

          this.outfitEntries.push({ mat: clone, base: clone.color.clone(), part });

          return clone;

        }

        return m;

      });

      obj.material = clonedMats.length === 1 ? clonedMats[0] : clonedMats;

    });

  }



  private applyDailyOutfitColor(): void {

    const theme = this.dailyOutfitThemes[new Date().getDay()];

    for (const entry of this.outfitEntries) {

      const accent = new THREE.Color(theme[entry.part]);

      entry.mat.color.copy(entry.base).lerp(accent, 0.7);

      entry.mat.needsUpdate = true;

    }

  }



  private applyJawAndHeadMotion(): void {

    const open = THREE.MathUtils.clamp(this.mouthOpenAmount, 0, 1);

    if (this.jawBone) {

      const targetX = this.jawBaseX + open * 0.14;

      this.jawBone.rotation.x = THREE.MathUtils.lerp(this.jawBone.rotation.x, targetX, 0.12);

    }

    if (this.headBone) {

      this.headBone.rotation.x = THREE.MathUtils.lerp(

        this.headBone.rotation.x,

        this.headBaseX,

        0.08,

      );

      this.headBone.rotation.y = THREE.MathUtils.lerp(

        this.headBone.rotation.y,

        this.headBaseY,

        0.08,

      );

    }

  }



  private recognition!: any;



  private startMic() {

    const SpeechRecognition =

      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;



    if (!SpeechRecognition) {

      console.warn('Mic not supported in this browser');

      return;

    }



    this.recognition = new SpeechRecognition();

    this.recognition.continuous = true;

    this.recognition.interimResults = false;

    this.recognition.lang = 'en-US';



    this.recognition.onresult = (event: any) => {

      const text = event.results[event.results.length - 1][0].transcript.toLowerCase();

      this.handleMicCommand(text);

    };



    this.recognition.onerror = (e: any) => {

      console.log('Mic error:', e);

    };



    this.recognition.start();

  }



  private handleMicCommand(text: string) {

    let reply = "I didn't understand that";



    if (text.includes('hello') || text.includes('hi')) {

      reply = 'Hello! I am your AI avatar';

    } else if (text.includes('how are you')) {

      reply = "I'm fine and ready to help you";

    } else if (

      text.includes('who developed you') ||

      text.includes('who made you') ||

      text.includes('who created you') ||

      text.includes('which company developed you') ||

      text.includes('which company made you') ||

      text.includes('developer') ||

      text.includes('company')

    ) {

      reply = 'This is an own project developed by DEV SR';

    } else if (text.includes('stop')) {

      this.recognition.stop();

      reply = 'Mic stopped';

    }



    this.speak(reply);

  }

}


