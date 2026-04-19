import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './avatar.html',
  styleUrls: ['./avatar.css'],
})
export class Avatar implements AfterViewInit, OnDestroy {
  @ViewChild('canvas3d', { static: true }) canvasRef!: ElementRef;
  isloader:boolean = true
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private model!: THREE.Object3D;
  private animationId!: number;

  private mouthMesh!: THREE.Mesh;
  private leftEye!: THREE.Object3D;
  private rightEye!: THREE.Object3D;

  // Arm bones
  private leftArm!: THREE.Object3D;
  private rightArm!: THREE.Object3D;
  private leftForeArm!: THREE.Object3D;
  private rightForeArm!: THREE.Object3D;
constructor(private cdr: ChangeDetectorRef) {}
  // Orbit controls
  private controls!: OrbitControls;

 ngAfterViewInit(): void {
  this.initThree();
  this.loadModel();
  this.animate();
  // this.speak('Faaahhhh Faah faahhh');

  // this.startMic(); 

  window.addEventListener('resize', () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
  

  initThree() {
    const canvas = this.canvasRef.nativeElement;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      25,
      window.innerWidth / window.innerHeight,
      0.6,
      2000,
    );
    this.camera.lookAt(0, 1.5, 0);
    this.camera.position.set(0, 1.5, 3); // was (2.5, 1, 2.3)

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5);
    hemiLight.position.set(0, 60, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(3, 50, 10);
    this.scene.add(dirLight);

    // ✅ OrbitControls setup
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
        this.model.position.set(0, -1, 0);
        this.scene.add(this.model);

        // Debug (optional)
        this.model.traverse((obj) => {
          console.log('Bone:', obj.name);
        });
       this.isloader = false;
        this.cdr.detectChanges(); 
        // Face references
        this.mouthMesh = this.model.getObjectByName('Head') as THREE.Mesh;
        this.leftEye = this.model.getObjectByName('LeftEye')!;
        this.rightEye = this.model.getObjectByName('RightEye')!;

        // Arm bones (try multiple common names)
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
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  // stop previous speech (important fix)
  speechSynthesis.cancel();

  speechSynthesis.speak(utterance);

  const animateSpeech = () => {
    if (speechSynthesis.speaking) {
      if (this.mouthMesh?.morphTargetInfluences) {
        this.mouthMesh.morphTargetInfluences[0] = Math.random();
      }
      requestAnimationFrame(animateSpeech);
    } else {
      if (this.mouthMesh?.morphTargetInfluences) {
        this.mouthMesh.morphTargetInfluences[0] = 0;
      }
    }
  };

  animateSpeech();
}

// speak(message: string) {

//   const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
//     "YOUR_AZURE_KEY",
//     "YOUR_REGION"
//   );

//   speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";

//   const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();

//   const synthesizer = new SpeechSDK.SpeechSynthesizer(
//     speechConfig,
//     audioConfig
//   );

//   // 🔥 VISEME EVENT
//   synthesizer.visemeReceived = (s, e) => {
//     const visemeId = e.visemeId;

//     this.applyAzureViseme(visemeId);
//   };

//   synthesizer.speakTextAsync(
//     message,
//     result => {
//       console.log("Speech finished");
//       synthesizer.close();
//     },
//     error => {
//       console.error(error);
//       synthesizer.close();
//     }
//   );
// }
private applyAzureViseme(id: number) {
  if (!this.mouthMesh?.morphTargetInfluences) return;

  const m = this.mouthMesh.morphTargetInfluences;

  m.fill(0);

  switch (id) {
    case 1: // neutral
      m[0] = 0.1;
      break;

    case 2: // open mouth
      m[2] = 0.6;
      break;

    case 4: // wide open
      m[3] = 1.0;
      break;

    case 8: // lips closed
      m[1] = 0.8;
      break;

    case 14: // teeth visible
      m[4] = 0.7;
      break;

    default:
      m[0] = 0.2;
  }
}

  setHandsDown() {
    if (this.leftArm && this.rightArm) {
      // Push arms almost straight down
      this.leftArm.rotation.set(1.1, 0.0, 0.1);
      this.rightArm.rotation.set(1.1, 0.0, -0.1);
    }

    if (this.leftForeArm && this.rightForeArm) {
      // Keep forearms aligned downward
      this.leftForeArm.rotation.set(0.0, 0.0, 0.0);
      this.rightForeArm.rotation.set(0.0, 0.0, 0.0);
    }
  }

  animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.model) {
      // Keep forcing arms down every frame
      this.setHandsDown();

      // Mouth animation
      if (this.mouthMesh?.morphTargetInfluences) {
        this.mouthMesh.morphTargetInfluences[0] = Math.abs(Math.sin(Date.now() * 0.005));
      }

      // Eye movement
      if (this.leftEye && this.rightEye) {
        const eyeX = Math.sin(Date.now() * 0.002) * 0.05;
        const eyeY = Math.cos(Date.now() * 0.002) * 0.025;
        this.leftEye.rotation.set(eyeY, eyeX, 0);
        this.rightEye.rotation.set(eyeY, eyeX, 0);
      }
    }

    // ✅ OrbitControls update
    this.controls.update();

    this.renderer.render(this.scene, this.camera);
  };

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    this.renderer.dispose();
  }
  // 🔥 ADD: MIC RECOGNITION (DO NOT CHANGE ANY EXISTING CODE)
private recognition!: any;

private startMic() {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('Mic not supported in this browser');
    return;
  }

  this.recognition = new SpeechRecognition();
  this.recognition.continuous = true;
  this.recognition.interimResults = false;
  this.recognition.lang = 'en-US';

  this.recognition.onresult = (event: any) => {
    const text = event.results[event.results.length - 1][0].transcript
      .toLowerCase();

    console.log('Mic input:', text);

    this.handleMicCommand(text);
  };

  this.recognition.onerror = (e: any) => {
    console.log('Mic error:', e);
  };

  this.recognition.start();
}
private handleMicCommand(text: string) {
  let reply = "I didn't understand that";

  if (text.includes('hello')) {
    reply = 'Hello! I am your AI avatar';
  }

  if (text.includes('how are you')) {
    reply = "I'm fine and ready to help you";
  }

  if (text.includes('stop')) {
    this.recognition.stop();
    reply = 'Mic stopped';
  }

  this.speak(reply);
}
}
