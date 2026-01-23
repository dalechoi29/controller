import * as THREE from 'three';

/**
 * Scene manager for the 3D environment
 * Handles scene initialization and basic lighting setup
 */
export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);
    
    this.setupLighting();
  }

  /**
   * Sets up ambient and directional lighting
   */
  setupLighting() {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Directional light for shadows and depth
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    this.scene.add(directionalLight);

    // Additional fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -7);
    this.scene.add(fillLight);
  }

  /**
   * Add an object to the scene
   * @param {THREE.Object3D} object - Object to add
   */
  add(object) {
    this.scene.add(object);
  }

  /**
   * Remove an object from the scene
   * @param {THREE.Object3D} object - Object to remove
   */
  remove(object) {
    this.scene.remove(object);
  }

  /**
   * Get the Three.js scene instance
   * @returns {THREE.Scene}
   */
  getScene() {
    return this.scene;
  }
}



