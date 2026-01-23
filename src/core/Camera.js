import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Camera manager with orbit controls
 * Handles camera setup and user interaction for viewing the scene
 */
export class CameraManager {
  constructor(renderer, options = {}) {
    const cameraType = options.type || 'perspective'; // 'perspective' or 'orthographic'
    this.aspect = options.aspect || 1.6; // Default to 1.6:1 for touch screen
    
    if (cameraType === 'orthographic') {
      // Orthographic camera for isometric view (no distortion)
      const frustumSize = options.frustumSize || 10;
      this.camera = new THREE.OrthographicCamera(
        frustumSize * this.aspect / -2,    // Left
        frustumSize * this.aspect / 2,     // Right
        frustumSize / 2,              // Top
        frustumSize / -2,             // Bottom
        0.1,                          // Near
        1000                          // Far
      );
      this.isOrthographic = true;
      this.frustumSize = frustumSize;
    } else {
      // Perspective camera (default)
      this.camera = new THREE.PerspectiveCamera(
        75,                           // Field of view
        aspect,                       // Aspect ratio (30vh viewport)
        0.1,                          // Near clipping plane
        1000                          // Far clipping plane
      );
      this.isOrthographic = false;
    }

    // Position camera for good initial view
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0.8, 0); // Look at gizmo center (slightly elevated)

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
   * Handle window resize (for 30vh viewport with 1.6:1 aspect ratio)
   */
  handleResize() {
    if (this.isOrthographic) {
      // Update orthographic camera frustum
      this.camera.left = this.frustumSize * this.aspect / -2;
      this.camera.right = this.frustumSize * this.aspect / 2;
      this.camera.top = this.frustumSize / 2;
      this.camera.bottom = this.frustumSize / -2;
    } else {
      // Update perspective camera aspect
      this.camera.aspect = this.aspect;
    }
    
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

