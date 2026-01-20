import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Utility class for loading 3D models (GLTF/GLB format)
 */
export class ModelLoader {
  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Load a GLTF/GLB model from a file path
   * @param {string} path - Path to the model file (relative to public folder)
   * @returns {Promise<THREE.Object3D>} - The loaded model
   */
  async loadModel(path) {
    return new Promise((resolve, reject) => {
      console.log(`📦 Loading model from: ${path}`);
      
      this.loader.load(
        path,
        (gltf) => {
          const model = gltf.scene;
          
          // Center the model at origin
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);
          
          // Calculate size and scale to fit within 2x2x2 unit cube
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetSize = 2.0; // Fit within 2 unit cube
          const scale = targetSize / maxDim;
          model.scale.setScalar(scale);
          
          // Enable shadows on all meshes
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              
              // Ensure materials are visible
              if (child.material) {
                child.material.side = THREE.DoubleSide;
              }
            }
          });
          
          console.log('✅ Model loaded successfully');
          console.log(`   - Original size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
          console.log(`   - Scale factor: ${scale.toFixed(2)}`);
          console.log(`   - Meshes: ${this.countMeshes(model)}`);
          
          resolve(model);
        },
        (progress) => {
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total * 100).toFixed(0);
            console.log(`⏳ Loading model: ${percent}%`);
          }
        },
        (error) => {
          console.error('❌ Error loading model:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Count meshes in a model
   * @param {THREE.Object3D} model 
   * @returns {number}
   */
  countMeshes(model) {
    let count = 0;
    model.traverse((child) => {
      if (child.isMesh) count++;
    });
    return count;
  }

  /**
   * Create a decolorized (grayscale) clone of a model
   * @param {THREE.Object3D} model - Original model
   * @returns {THREE.Object3D} - Grayscale clone
   */
  decolorizeModel(model) {
    const clone = model.clone();
    
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        // Clone material to avoid affecting original
        const material = child.material.clone();
        
        // Convert color to grayscale
        if (material.color) {
          const gray = material.color.r * 0.299 + material.color.g * 0.587 + material.color.b * 0.114;
          material.color.setRGB(gray, gray, gray);
        }
        
        // Reduce opacity slightly for touch screen
        if (material.transparent) {
          material.opacity *= 0.8;
        }
        
        child.material = material;
      }
    });
    
    return clone;
  }
}

