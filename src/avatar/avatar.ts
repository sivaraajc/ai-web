import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
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

  // Orbit controls
  private controls!: OrbitControls;

  ngAfterViewInit(): void {
    this.initThree();
    this.loadModel();
    this.animate();
    this.speak('Faaahhhh Faah faahhh');
    // Resize
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
    this.camera.position.set(2.5, 1, 2.3);
    this.camera.lookAt(0, 1.5, 0);

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

    speechSynthesis.speak(utterance);

    const animateSpeech = () => {
      if (speechSynthesis.speaking) {
        if (this.mouthMesh?.morphTargetInfluences) {
          // Simulate syllable movement with varied values
          this.mouthMesh.morphTargetInfluences[0] = Math.random() * 0.8;
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
}
