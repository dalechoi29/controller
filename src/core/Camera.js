import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Camera manager with orbit controls
 * Handles camera setup and user interaction for viewing the scene
 */
export class CameraManager {
  constructor(renderer) {
    this.camera = new THREE.PerspectiveCamera(
      75,                                    // Field of view
      window.innerWidth / (window.innerHeight * 0.4), // Aspect ratio (40vh viewport)
      0.1,                                   // Near clipping plane
      1000                                   // Far clipping plane
    );

    // Position camera for good initial view
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    // Setup orbit controls for user interaction
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;     // Smooth camera movements
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 2;          // Minimum zoom
    this.controls.maxDistance = 50;         // Maximum zoom
    
    // Allow full vertical rotation (0 to 180 degrees)
    this.controls.minPolarAngle = 0;        // Can look from straight above
    this.controls.maxPolarAngle = Math.PI;  // Can look from straight below
    
    // Allow unlimited horizontal rotation
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    
    this.controls.enablePan = false;        // Disable right-click pan
  }

  /**
   * Update camera controls (call in render loop)
   */
  update() {
    this.controls.update();
  }

  /**
   * Handle window resize (for 40vh viewport)
   */
  handleResize() {
    this.camera.aspect = window.innerWidth / (window.innerHeight * 0.4);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Get the Three.js camera instance
   * @returns {THREE.PerspectiveCamera}
   */
  getCamera() {
    return this.camera;
  }

  /**
   * Get the orbit controls instance
   * @returns {OrbitControls}
   */
  getControls() {
    return this.controls;
  }
}

