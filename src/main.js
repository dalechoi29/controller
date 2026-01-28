import * as THREE from 'three';
import { SceneManager } from './core/Scene.js';
import { CameraManager } from './core/Camera.js';
import { RendererManager } from './core/Renderer.js';
import { RotationGizmo } from './gizmo/RotationGizmo.js';
import { InputHandler } from './core/InputHandler.js';
import { ModelLoader } from './utils/ModelLoader.js';
import { Brush, Evaluator, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';

/**
 * Main application class for 3D Rotation Gizmo
 * Supports dual viewport (preview + work view)
 */
class RotationGizmoApp {
  constructor() {
    // Initialize dual viewport renderer
    this.renderer = new RendererManager();

    // Create PREVIEW scene (top viewport - clean view)
    this.previewSceneManager = new SceneManager();
    
    // Create WORK scene (bottom viewport - with gizmo and helpers)
    this.workSceneManager = new SceneManager();

    // Initialize model loader
    this.modelLoader = new ModelLoader();
    
    // Objects will be created in async init()
    this.testObject = null;
    this.previewObject = null;
    this.workSphere = null;
    
    // Y offset to position gizmo above buttons
    this.gizmoYOffset = 2.2;

    // Store initial states for reset functionality
    this.initialRotation = null;

    // Create camera for PREVIEW viewport (left side - 3D perspective)
    this.previewCameraManager = this.createPreviewCamera();

    // Create cameras for MPR views (right side - 3 orthographic planes)
    this.transverseCameraManager = this.createTransverseCamera();   // Top-down (axial)
    this.coronalCameraManager = this.createCoronalCamera();         // Front view
    this.sagittalCameraManager = this.createSagittalCamera();       // Side view
    
    // Create summary gizmos for MPR views (will load heart models asynchronously)
    this.createTransverseSummaryGizmo();
    this.createCoronalSummaryGizmo();
    this.createSagittalSummaryGizmo();

    // Create visual slice indicators for MPR views
    this.createSliceIndicators();

    // Create camera for WORK viewport (orthographic for isometric view, no distortion)
    // Use responsive frustum size - smaller on mobile for better fit
    const isMobile = window.innerWidth <= 768;
    const frustumSize = isMobile ? 8 : 12; // Smaller on mobile to fit better
    
    this.workCameraManager = new CameraManager(this.renderer.workRenderer, {
      type: 'orthographic',
      frustumSize: frustumSize,  // Responsive: 8 on mobile, 12 on desktop
      aspect: 1.6       // 1.6:1 aspect ratio for touch screen
    });
    this.initialCameraPosition = this.workCameraManager.getCamera().position.clone();
    this.initialCameraTarget = this.workCameraManager.getControls().target.clone();
    this.initialCameraZoom = this.workCameraManager.getCamera().zoom || 1;
    
    // Gizmo and input handler will be initialized after model loads
    this.gizmo = null;
    this.inputHandler = null;
  }

  /**
   * Async initialization - loads model and sets up scene
   */
  async init() {
    console.log('🚀 Initializing 3D Rotation Gizmo...');
    
    // ===== LOAD YOUR BLENDER MODEL =====
    // IMPORTANT: Change this path to your actual .glb file!
    // Example: '/models/your_model.glb'
    const modelPath = '/models/heart.glb';
    
    try {
      console.log(`📦 Attempting to load Blender model from: ${modelPath}`);
      
      // ===== TOUCH SCREEN (Bottom) - Small decolorized model =====
      this.testObject = await this.modelLoader.loadModel(modelPath, {
        decolorize: true  // Apply white/gray material
      });
      
      // Keep model SMALL for touch screen (0.8x scale for better visibility)
      this.testObject.scale.set(0.8, 0.8, 0.8);
      this.testObject.position.y = this.gizmoYOffset;
      this.workSceneManager.add(this.testObject);
      
      console.log('✅ Touch screen model loaded (small, decolorized)');
      
      // ===== MAIN SCREEN (Top) - Large colored model =====
      this.previewObject = await this.modelLoader.loadModel(modelPath);
      
      // Make model MASSIVE - almost fills main screen (15x scale)
      this.previewObject.scale.set(15.0, 15.0, 15.0);
      this.previewSceneManager.add(this.previewObject);
      
      // Enable material clipping for thin slab visualization
      this.enableMaterialClipping();
      
      console.log('✅ Main screen model loaded (large, colored)');
      console.log('   Generating MPR cross-sections...');
      
    } catch (error) {
      console.warn('⚠️ Could not load Blender model, using fallback cubes');
      console.warn('   Make sure your .glb file is in: public/models/');
      console.warn('   Error:', error.message);
      
      // FALLBACK: Use cubes if model fails to load
      this.testObject = this.createDecolorizedCube();
      this.testObject.position.y = this.gizmoYOffset;
      this.workSceneManager.add(this.testObject);
      
      this.previewObject = this.createTestObject();
      this.previewObject.scale.set(15.0, 15.0, 15.0);
      this.previewSceneManager.add(this.previewObject);
      
      // Enable material clipping for fallback cube
      this.enableMaterialClipping();
    }
    
    // Create transparent sphere tangent to axis rings (touch screen only)
    this.workSphere = this.createTransparentSphere();
    this.workSphere.visible = false; // Hidden by default (cube is default now)
    this.workSphere.position.y = this.gizmoYOffset;
    this.workSceneManager.add(this.workSphere);

    // Create transparent cube wireframe (for cube style)
    this.workCube = this.createTransparentCube();
    this.workCube.visible = true; // Visible by default (cube is default)
    this.workCube.position.y = this.gizmoYOffset;
    this.workSceneManager.add(this.workCube);

    // Store initial rotation for reset functionality
    this.initialRotation = this.testObject.quaternion.clone();

    // Initialize gizmo (only in work scene) - sized to avoid overlap with UI
    this.gizmo = new RotationGizmo(this.testObject, {
      radius: 2.5  // Balanced size for usability without overlap
    });
    this.gizmo.applyStyle('cube'); // Set cube as default style
    const gizmoMesh = this.gizmo.getMesh();
    this.workSceneManager.add(gizmoMesh);

    // Add grid and helpers (only in work scene)
    this.addGridHelper();

    // Initialize input handler for gizmo interaction (only in work viewport)
    this.inputHandler = new InputHandler(
      this.workCameraManager.getCamera(),
      this.renderer.domElement,
      this.gizmo,
      this // Pass app reference for slice control
    );

    // Disable orbit controls when interacting with gizmo
    this.setupOrbitControlsIntegration();

    // Setup reset button
    this.setupResetButton();

    // Setup style switcher
    this.setupStyleSwitcher();

    // Setup info panel toggle
    this.setupInfoToggle();

    // Setup draggable slice plane
    this.setupDraggablePlane();

    // Setup comprehensive resize handler for all cameras
    this.setupResizeHandler();

    // Start animation loop
    this.animate();

    console.log('✓ 3D Rotation Gizmo initialized');
    console.log('✓ Dual viewport mode active');
    console.log('→ Top: Main screen (your 3D model)');
    console.log('→ Bottom: Touch screen (controls)');
  }

  /**
   * Setup resize handler to update all cameras and renderers
   */
  setupResizeHandler() {
    const handleResize = () => {
      // Adjust work camera frustum size for mobile
      const isMobile = window.innerWidth <= 768;
      const newFrustumSize = isMobile ? 8 : 12;
      const camera = this.workCameraManager.getCamera();
      
      if (camera.isOrthographicCamera) {
        const aspect = camera.right / camera.top; // Get current aspect
        camera.left = newFrustumSize * aspect / -2;
        camera.right = newFrustumSize * aspect / 2;
        camera.top = newFrustumSize / 2;
        camera.bottom = newFrustumSize / -2;
        camera.updateProjectionMatrix();
      }
      
      // Update work camera aspect ratio
      this.workCameraManager.handleResize();
      
      // Update preview camera aspect ratio (left half)
      if (this.previewCameraManager && this.previewCameraManager.handleResize) {
        this.previewCameraManager.handleResize();
      }
      
      // Update MPR plane cameras (right side - 3 views)
      if (this.transverseCameraManager && this.transverseCameraManager.handleResize) {
        this.transverseCameraManager.handleResize();
      }
      if (this.coronalCameraManager && this.coronalCameraManager.handleResize) {
        this.coronalCameraManager.handleResize();
      }
      if (this.sagittalCameraManager && this.sagittalCameraManager.handleResize) {
        this.sagittalCameraManager.handleResize();
      }
      
      console.log('✓ Cameras resized (mobile frustum: ' + newFrustumSize + ')');
    };
    
    // Note: RendererManager already handles renderer resize
    // This just ensures cameras also update
    window.addEventListener('resize', handleResize);
    
    console.log('✓ Resize handler initialized');
  }

  /**
   * Create preview camera (syncs with work camera)
   * @returns {Object} Camera manager
   */
  createPreviewCamera() {
    // Canvas is 70vh * 1.6, left half is (70vh * 1.6) / 2 / 70vh = 0.8
    const camera = new THREE.PerspectiveCamera(
      75,
      0.8, // Left half of centered canvas with 1.6:1 aspect ratio
      0.1,
      1000
    );
    
    // Initial camera position (will sync with work camera)
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);
    
    // 3D view camera sees all layers (simplified approach)
    camera.layers.enableAll();

    return {
      getCamera: () => camera,
      update: () => {}, // Camera position syncs in main animate loop
      handleResize: () => {
        // Canvas is 70vh * 1.6, left half is (70vh * 1.6) / 2 / 70vh = 0.8
        camera.aspect = 0.8;
        camera.updateProjectionMatrix();
      }
    };
  }

  /**
   * Generate all cross-sections for MPR views
   */
  async generateAllCrossSections() {
    if (!this.previewObject) {
      console.warn('Preview object not ready for cross-section generation');
      return;
    }

    console.log('🔪 Generating CSG cross-sections...');

    // Remove old slice indicators if they exist
    if (this.transverseIndicatorGroup) {
      this.previewSceneManager.getScene().remove(this.transverseIndicatorGroup);
    }
    if (this.coronalIndicatorGroup) {
      this.previewSceneManager.getScene().remove(this.coronalIndicatorGroup);
    }
    if (this.sagittalIndicatorGroup) {
      this.previewSceneManager.getScene().remove(this.sagittalIndicatorGroup);
    }

    // Need to traverse the model to find actual meshes
    const meshes = [];
    this.previewObject.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
      }
    });

    if (meshes.length === 0) {
      console.warn('No meshes found in preview object');
      return;
    }

    console.log(`Found ${meshes.length} meshes to slice`);

    // Generate cross-sections for each axis using the first mesh (or merge all meshes)
    const mainMesh = meshes[0];
    
    // Transverse (Y-axis) cross-section
    const transverseSection = this.generateCrossSection(mainMesh, 'y', 0);
    if (transverseSection) {
      transverseSection.layers.set(1);
      this.transverseIndicatorGroup = new THREE.Group();
      this.transverseIndicatorGroup.add(transverseSection);
      this.transverseIndicatorGroup.layers.set(1);
      this.previewSceneManager.add(this.transverseIndicatorGroup);
      console.log('✓ Transverse cross-section added');
    }

    // Coronal (Z-axis) cross-section
    const coronalSection = this.generateCrossSection(mainMesh, 'z', 0);
    if (coronalSection) {
      coronalSection.layers.set(2);
      this.coronalIndicatorGroup = new THREE.Group();
      this.coronalIndicatorGroup.add(coronalSection);
      this.coronalIndicatorGroup.layers.set(2);
      this.previewSceneManager.add(this.coronalIndicatorGroup);
      console.log('✓ Coronal cross-section added');
    }

    // Sagittal (X-axis) cross-section
    const sagittalSection = this.generateCrossSection(mainMesh, 'x', 0);
    if (sagittalSection) {
      sagittalSection.layers.set(3);
      this.sagittalIndicatorGroup = new THREE.Group();
      this.sagittalIndicatorGroup.add(sagittalSection);
      this.sagittalIndicatorGroup.layers.set(3);
      this.previewSceneManager.add(this.sagittalIndicatorGroup);
      console.log('✓ Sagittal cross-section added');
    }

    console.log('✅ All cross-sections generated');
  }

  /**
   * Generate cross-section geometry using CSG
   * @param {THREE.Mesh} mesh - The mesh to slice
   * @param {string} axis - 'x', 'y', or 'z'
   * @param {number} position - Position along the axis
   * @returns {THREE.Mesh} Cross-section mesh
   */
  generateCrossSection(mesh, axis, position = 0) {
    if (!mesh || !mesh.geometry) {
      console.warn('No valid mesh provided for cross-section');
      return null;
    }

    try {
      const evaluator = new Evaluator();
      const sliceThickness = 1.0; // Thin slice for cross-section
      
      // Create a thin box at the slice position
      let slicerGeometry;
      const largeSize = 50; // Large enough to cover the scaled model
      
      if (axis === 'y') {
        // Horizontal slice (transverse)
        slicerGeometry = new THREE.BoxGeometry(largeSize, sliceThickness, largeSize);
      } else if (axis === 'z') {
        // Front-to-back slice (coronal)  
        slicerGeometry = new THREE.BoxGeometry(largeSize, largeSize, sliceThickness);
      } else if (axis === 'x') {
        // Left-to-right slice (sagittal)
        slicerGeometry = new THREE.BoxGeometry(sliceThickness, largeSize, largeSize);
      }
      
      // Create material for the cross-section
      const color = axis === 'y' ? 0x00ff00 : (axis === 'z' ? 0x0000ff : 0xff0000);
      const crossSectionMaterial = new THREE.MeshStandardMaterial({ 
        color: color,
        side: THREE.DoubleSide,
        metalness: 0.1,
        roughness: 0.8
      });
      
      // Convert mesh to Brush (CSG requires Brush objects)
      const meshBrush = new Brush(mesh.geometry);
      meshBrush.position.copy(mesh.position);
      meshBrush.rotation.copy(mesh.rotation);
      meshBrush.scale.copy(mesh.scale);
      meshBrush.updateMatrixWorld();
      
      // Create slicer brush
      const slicerBrush = new Brush(slicerGeometry);
      if (axis === 'y') slicerBrush.position.y = position;
      else if (axis === 'z') slicerBrush.position.z = position;
      else if (axis === 'x') slicerBrush.position.x = position;
      slicerBrush.updateMatrixWorld();
      
      // Perform intersection to get the cross-section
      const result = evaluator.evaluate(meshBrush, slicerBrush, INTERSECTION);
      result.material = crossSectionMaterial;
      
      console.log(`✓ Generated ${axis}-axis cross-section at position ${position}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Error generating cross-section for ${axis}-axis:`, error);
      return null;
    }
  }

  /**
   * Enable clipping on all materials in the preview object
   */
  enableMaterialClipping() {
    if (!this.previewObject) return;
    
    this.previewObject.traverse((child) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(mat => {
          mat.side = THREE.DoubleSide;
          mat.needsUpdate = true;
        });
      }
    });
    
    console.log('✓ Materials prepared for clipping');
  }

  /**
   * Create dual clipping planes for thin slab visualization
   * Shows only a thin slice of the model at each plane position
   */
  createSliceIndicators() {
    this.sliceThickness = 4.0; // Thicker slab for better visibility
    this.transverseYPosition = this.gizmoYOffset; // Initial Y position at model center (0.8)
    
    // === TRANSVERSE (Y-axis) - Two planes to create thin horizontal slab ===
    this.transverseClipPlanes = [
      new THREE.Plane(new THREE.Vector3(0, -1, 0), this.transverseYPosition + this.sliceThickness / 2),  // Clip below
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.transverseYPosition + this.sliceThickness / 2)    // Clip above
    ];
    
    // === CORONAL (Z-axis) - Two planes to create thin front-to-back slab ===
    this.coronalClipPlanes = [
      new THREE.Plane(new THREE.Vector3(0, 0, -1), this.sliceThickness / 2),  // Clip behind
      new THREE.Plane(new THREE.Vector3(0, 0, 1), this.sliceThickness / 2)    // Clip front
    ];
    
    // === SAGITTAL (X-axis) - Two planes to create thin left-to-right slab ===
    this.sagittalClipPlanes = [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), this.sliceThickness / 2),  // Clip left
      new THREE.Plane(new THREE.Vector3(1, 0, 0), this.sliceThickness / 2)    // Clip right
    ];
    
    // Create visual indicator for the transverse plane
    this.createTransversePlaneIndicator();
    
    console.log('✓ Dual clipping planes created for thin slab visualization');
    console.log(`  Slice thickness: ${this.sliceThickness} units`);
    console.log('  Draggable transverse plane indicator created');
  }

  /**
   * Create a draggable visual indicator for the transverse plane
   */
  createTransversePlaneIndicator() {
    // Create invisible plane for main screen (kept for backward compatibility)
    const planeSize = 60;
    const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false
    });
    
    this.transversePlaneIndicator = new THREE.Mesh(geometry, material);
    this.transversePlaneIndicator.rotation.x = Math.PI / 2;
    this.transversePlaneIndicator.position.y = this.transverseYPosition;
    this.transversePlaneIndicator.userData = { type: 'draggable-plane', axis: 'y' };
    this.previewSceneManager.add(this.transversePlaneIndicator);
    
    console.log('✓ Transverse plane indicator created (main screen: invisible)');
  }

  /**
   * Update the transverse clipping planes based on the current Y position
   */
  updateTransverseClipping(yPosition) {
    this.transverseYPosition = yPosition;
    
    // Update clipping plane constants
    // The planes are in world space, and the model is centered at Y=0
    this.transverseClipPlanes[0].constant = yPosition + this.sliceThickness / 2;
    this.transverseClipPlanes[1].constant = -yPosition + this.sliceThickness / 2;
    
    // Update visual indicator position (main screen)
    if (this.transversePlaneIndicator) {
      this.transversePlaneIndicator.position.y = yPosition;
    }
    
    // Update the Y-axis position in the gizmo (touch screen)
    // Works for both cube and circular modes
    const localY = yPosition - this.gizmoYOffset;
    
    // Update square frame position (used in cube mode and for interaction in circular mode)
    if (this.gizmo && this.gizmo.squareFrames && this.gizmo.squareFrames.y) {
      this.gizmo.squareFrames.y.position.y = localY;
    }
    
    // Update Y circular ring position (movable XZ plane in circular mode)
    if (this.gizmo && this.gizmo.axes && this.gizmo.axes.y) {
      this.gizmo.axes.y.mesh.position.y = localY;
    }
    
    // Also move the highlight planes with the frame
    if (this.gizmo && this.gizmo.squareHighlightPlanes && this.gizmo.squareHighlightPlanes.y) {
      this.gizmo.squareHighlightPlanes.y.position.y = localY;
    }
    if (this.gizmo && this.gizmo.highlightPlanes && this.gizmo.highlightPlanes.y) {
      this.gizmo.highlightPlanes.y.position.y = localY;
    }
    
    console.log(`📍 Transverse plane at Y = ${yPosition.toFixed(2)} | Frame local Y = ${(yPosition - this.gizmoYOffset).toFixed(2)}`);
  }

  /**
   * Setup custom shader-based clipping on all materials
   * This modifies materials to support clipping via custom shaders
   */
  setupShaderClipping() {
    if (!this.previewObject) {
      console.warn('⚠️ Preview object not found for shader setup!');
      return;
    }
    
    let materialCount = 0;
    
    this.previewObject.traverse((child) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach(mat => {
          // Skip if already set up
          if (mat.userData.shaderClippingSetup) return;
          
          // Set material to show both sides (important for cut surfaces)
          mat.side = THREE.DoubleSide;
          
          // Add clipping uniforms
          if (!mat.userData.clippingUniforms) {
            mat.userData.clippingUniforms = {
              clippingEnabled: { value: 0 },
              clippingPlaneNormal: { value: new THREE.Vector3(0, 1, 0) },
              clippingPlaneConstant: { value: 0.0 }
            };
          }
          
          // Inject custom shader code using onBeforeCompile
          mat.onBeforeCompile = (shader) => {
            // Add our uniforms to the shader
            shader.uniforms.clippingEnabled = mat.userData.clippingUniforms.clippingEnabled;
            shader.uniforms.clippingPlaneNormal = mat.userData.clippingUniforms.clippingPlaneNormal;
            shader.uniforms.clippingPlaneConstant = mat.userData.clippingUniforms.clippingPlaneConstant;
            
            // Add varying to pass world position from vertex to fragment shader
            shader.vertexShader = `
              varying vec3 vWorldPosition;
              ${shader.vertexShader}
            `;
            
            // Calculate world position in vertex shader (after #include <project_vertex>)
            shader.vertexShader = shader.vertexShader.replace(
              '#include <project_vertex>',
              `#include <project_vertex>
              vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;`
            );
            
            // Add uniforms and varying to fragment shader
            shader.fragmentShader = `
              uniform int clippingEnabled;
              uniform vec3 clippingPlaneNormal;
              uniform float clippingPlaneConstant;
              varying vec3 vWorldPosition;
              ${shader.fragmentShader}
            `;
            
            // Inject clipping logic at the start of main() function
            shader.fragmentShader = shader.fragmentShader.replace(
              'void main() {',
              `void main() {
                // Custom shader-based clipping
                if (clippingEnabled == 1) {
                  float distance = dot(vWorldPosition, clippingPlaneNormal) + clippingPlaneConstant;
                  if (distance < 0.0) {
                    discard;
                  }
                }
              `
            );
            
            // Store reference to shader for debugging
            mat.userData.shader = shader;
          };
          
          mat.userData.shaderClippingSetup = true;
          mat.needsUpdate = true;
          materialCount++;
        });
      }
    });
    
    console.log(`🎨 Shader-based clipping setup on ${materialCount} materials`);
  }

  /**
   * Update shader clipping uniforms for all materials
   * @param {Array<THREE.Plane>} planes - Array of clipping planes (or empty for no clipping)
   */
  applyClippingToMaterials(planes) {
    if (!this.previewObject) return;
    
    const enabled = planes.length > 0;
    const plane = enabled ? planes[0] : null;
    
    this.previewObject.traverse((child) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach(mat => {
          if (mat.userData.clippingUniforms) {
            mat.userData.clippingUniforms.clippingEnabled.value = enabled ? 1 : 0;
            
            if (enabled && plane) {
              mat.userData.clippingUniforms.clippingPlaneNormal.value.copy(plane.normal);
              mat.userData.clippingUniforms.clippingPlaneConstant.value = plane.constant;
            }
          }
        });
      }
    });
  }

  /**
   * Create transverse camera (orthographic top-down view - axial plane)
   * @returns {Object} Camera manager
   */
  createTransverseCamera() {
    // Canvas is 70vh * 1.6, right half divided by 3: (70vh * 0.8) / (70vh / 3) = 2.4
    const aspect = 2.4;
    
    const frustumSize = 60; // Increased for smaller model appearance
    
    const camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,  // left (wider to match aspect)
      frustumSize * aspect / 2,   // right
      frustumSize / 2,            // top
      frustumSize / -2,           // bottom
      0.1,                        // near
      1000                        // far
    );
    
    // Position camera looking straight down (transverse/axial plane)
    camera.position.set(0, 50, 0);
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 0, -1); // Orient camera so Z-axis points up in view
    
    // Transverse camera sees all layers (simplified approach)
    camera.layers.enableAll();

    return {
      getCamera: () => camera,
      update: () => {},
      handleResize: () => {
        // Canvas is 70vh * 1.6, right half divided by 3: (70vh * 0.8) / (70vh / 3) = 2.4
        const aspect = 2.4;
        camera.left = frustumSize * aspect / -2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = frustumSize / -2;
        camera.updateProjectionMatrix();
      }
    };
  }

  /**
   * Create coronal camera (orthographic front view - coronal plane)
   * @returns {Object} Camera manager
   */
  createCoronalCamera() {
    // Canvas is 70vh * 1.6, right half divided by 3: (70vh * 0.8) / (70vh / 3) = 2.4
    const aspect = 2.4;
    const frustumSize = 60; // Increased for smaller model appearance
    
    const camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    
    // Position camera looking from front (along Z-axis)
    camera.position.set(0, 0, 50);
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 1, 0); // Y-axis points up
    
    // Coronal camera sees all layers (simplified approach)
    camera.layers.enableAll();

    return {
      getCamera: () => camera,
      update: () => {},
      handleResize: () => {
        // Canvas is 70vh * 1.6, right half divided by 3: (70vh * 0.8) / (70vh / 3) = 2.4
        const aspect = 2.4;
        camera.left = frustumSize * aspect / -2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = frustumSize / -2;
        camera.updateProjectionMatrix();
      }
    };
  }

  /**
   * Create sagittal camera (orthographic side view - sagittal plane)
   * @returns {Object} Camera manager
   */
  createSagittalCamera() {
    // Canvas is 70vh * 1.6, right half divided by 3: (70vh * 0.8) / (70vh / 3) = 2.4
    const aspect = 2.4;
    const frustumSize = 60; // Increased for smaller model appearance
    
    const camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    
    // Position camera looking from right side (along X-axis)
    camera.position.set(50, 0, 0);
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 1, 0); // Y-axis points up
    
    // Sagittal camera sees all layers (simplified approach)
    camera.layers.enableAll();

    return {
      getCamera: () => camera,
      update: () => {},
      handleResize: () => {
        // Canvas is 70vh * 1.6, right half divided by 3: (70vh * 0.8) / (70vh / 3) = 2.4
        const aspect = 2.4;
        camera.left = frustumSize * aspect / -2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = frustumSize / -2;
        camera.updateProjectionMatrix();
      }
    };
  }


  /**
   * Create a test object (cube) for rotation testing
   * @returns {THREE.Mesh}
   */
  createTestObject() {
    // Create a colorful cube with faces matching axis colors
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    
    // Create materials with colors matching the rotation axis
    // This ensures clicking X shows red, Y shows green, Z shows blue
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0xff0000 }), // Right (+X) - RED (matches X-axis)
      new THREE.MeshStandardMaterial({ color: 0xff6666 }), // Left (-X) - Light Red
      new THREE.MeshStandardMaterial({ color: 0x00ff00 }), // Top (+Y) - GREEN (matches Y-axis)
      new THREE.MeshStandardMaterial({ color: 0x66ff66 }), // Bottom (-Y) - Light Green
      new THREE.MeshStandardMaterial({ color: 0x0000ff }), // Front (+Z) - BLUE (matches Z-axis)
      new THREE.MeshStandardMaterial({ color: 0x6666ff })  // Back (-Z) - Light Blue
    ];

    const cube = new THREE.Mesh(geometry, materials);
    cube.position.set(0, 0, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;

    return cube;
  }

  /**
   * Create a decolorized cube for touch screen (white/gray)
   * Smaller size to not obstruct the axis rings
   * @returns {THREE.Mesh}
   */
  createDecolorizedCube() {
    // Smaller cube: 1.2x1.2x1.2 instead of 2x2x2
    const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    
    // White/gray materials for touch screen
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0xeeeeee }), // Light gray
      new THREE.MeshStandardMaterial({ color: 0xdddddd }), // Medium gray
      new THREE.MeshStandardMaterial({ color: 0xffffff }), // White
      new THREE.MeshStandardMaterial({ color: 0xcccccc }), // Gray
      new THREE.MeshStandardMaterial({ color: 0xeeeeee }), // Light gray
      new THREE.MeshStandardMaterial({ color: 0xdddddd })  // Medium gray
    ];

    const cube = new THREE.Mesh(geometry, materials);
    cube.position.set(0, 0, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;

    return cube;
  }

  /**
   * Create a transparent sphere tangent to the axis rings
   * @returns {THREE.Mesh}
   */
  createTransparentSphere() {
    // Sphere radius matches circular ring radius (2.5) to be perfectly tangent
    const geometry = new THREE.SphereGeometry(2.5, 64, 64);
    
    // Transparent material that won't hide the rings
    const material = new THREE.MeshBasicMaterial({
      color: 0x888888,      // Gray color
      transparent: true,
      opacity: 0.15,        // Very transparent
      side: THREE.DoubleSide,
      depthWrite: false     // Don't write to depth buffer (won't hide rings)
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(0, 0, 0);

    return sphere;
  }

  /**
   * Create summary gizmo for transverse view (left side of split)
   * Shows all gizmo components except axis buttons and lines
   * Highlights the XZ plane (transverse cutting plane)
   */
  async createTransverseSummaryGizmo() {
    // Create a separate scene and camera for the summary gizmo
    this.summarySceneManager = new SceneManager();
    
    // Create isometric camera for summary (match touch screen exactly)
    const frustumSize = 8; // Smaller frustum = more zoomed in for better legibility (was 12)
    const aspect = 1; // Square viewport (1:1 ratio)
    
    // Create orthographic camera manually for precise control
    this.summaryCamera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,    // Left
      frustumSize * aspect / 2,     // Right
      frustumSize / 2,              // Top
      frustumSize / -2,             // Bottom
      0.1,                          // Near
      1000                          // Far
    );
    
    // Position camera to look at gizmo center
    this.summaryCamera.position.set(5, 5 + this.gizmoYOffset, 5);
    this.summaryCamera.lookAt(0, this.gizmoYOffset, 0);
    
    // Store frustum size for potential resize handling
    this.summaryFrustumSize = frustumSize;
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.summarySceneManager.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 10, 5);
    this.summarySceneManager.add(directionalLight);
    
    // Load heart model for summary (scaled down)
    try {
      const model = await this.modelLoader.loadModel('/models/heart.glb');
      this.summaryCube = model.clone(); // Clone to avoid sharing between scenes
      this.summaryCube.scale.set(0.9, 0.9, 0.9); // Bigger scale (90% for better visibility)
      this.summaryCube.position.y = this.gizmoYOffset;
      
      // Ensure all materials render properly
      this.summaryCube.traverse((child) => {
        if (child.isMesh) {
          child.material.depthWrite = true;
          child.material.depthTest = true;
        }
      });
      
      this.summarySceneManager.add(this.summaryCube);
      console.log('✅ Heart model loaded for transverse summary');
    } catch (error) {
      console.warn('⚠ Failed to load heart for summary, using cube fallback:', error);
      // Fallback to gray cube
      const cubeGeometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      const cubeMaterials = [
        new THREE.MeshStandardMaterial({ color: 0xeeeeee }),
        new THREE.MeshStandardMaterial({ color: 0xdddddd }),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
        new THREE.MeshStandardMaterial({ color: 0xcccccc }),
        new THREE.MeshStandardMaterial({ color: 0xeeeeee }),
        new THREE.MeshStandardMaterial({ color: 0xdddddd })
      ];
      this.summaryCube = new THREE.Mesh(cubeGeometry, cubeMaterials);
      this.summaryCube.position.y = this.gizmoYOffset;
      this.summarySceneManager.add(this.summaryCube);
    }
    
    // Create transparent sphere/cube (synced with main gizmo style)
    this.summarySphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.summarySphere.position.y = this.gizmoYOffset;
    this.summarySphere.visible = false;
    this.summarySceneManager.add(this.summarySphere);
    
    this.summaryTransparentCube = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 3.6, 3.6),
      new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.summaryTransparentCube.position.y = this.gizmoYOffset;
    this.summaryTransparentCube.visible = true;
    this.summarySceneManager.add(this.summaryTransparentCube);
    
    // Create plane outlines (circular and square) - but WITHOUT axis lines and buttons
    this.createSummaryPlaneOutlines();
    
    // Create semi-transparent plane highlights (both square and circular)
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,  // Green for transverse
      transparent: true,
      opacity: 0.15,    // More subtle (was 0.3)
      side: THREE.DoubleSide,
      depthTest: false
    });
    
    // Square highlight
    const squarePlaneGeometry = new THREE.PlaneGeometry(3.0, 3.0);
    this.summaryPlaneHighlight = new THREE.Mesh(squarePlaneGeometry, planeMaterial);
    this.summaryPlaneHighlight.rotation.x = Math.PI / 2; // Rotate to be XZ plane
    this.summaryPlaneHighlight.position.y = this.gizmoYOffset;
    this.summaryPlaneHighlight.visible = false; // Start hidden (cube style default)
    this.summarySceneManager.add(this.summaryPlaneHighlight);
    
    // Circular highlight
    const circularPlaneGeometry = new THREE.CircleGeometry(1.5, 64);
    this.summaryPlaneHighlightCircular = new THREE.Mesh(circularPlaneGeometry, planeMaterial.clone());
    this.summaryPlaneHighlightCircular.rotation.x = Math.PI / 2; // Rotate to be XZ plane
    this.summaryPlaneHighlightCircular.position.y = this.gizmoYOffset;
    this.summaryPlaneHighlightCircular.visible = false; // Start hidden
    this.summarySceneManager.add(this.summaryPlaneHighlightCircular);
    
    console.log('✓ Transverse summary gizmo created');
  }
  
  /**
   * Create summary gizmo for coronal view (highlights YZ plane)
   */
  async createCoronalSummaryGizmo() {
    this.coronalSummarySceneManager = new SceneManager();
    
    // Create orthographic camera (zoomed in for better legibility)
    const frustumSize = 8; // Smaller frustum = more zoomed in (was 12)
    const aspect = 1;
    
    this.coronalSummaryCamera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    
    this.coronalSummaryCamera.position.set(5, 5 + this.gizmoYOffset, 5);
    this.coronalSummaryCamera.lookAt(0, this.gizmoYOffset, 0);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.coronalSummarySceneManager.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 10, 5);
    this.coronalSummarySceneManager.add(directionalLight);
    
    // Load heart model for coronal summary (scaled down)
    try {
      const model = await this.modelLoader.loadModel('/models/heart.glb');
      this.coronalSummaryCube = model.clone(); // Clone to avoid sharing between scenes
      this.coronalSummaryCube.scale.set(0.9, 0.9, 0.9); // Bigger scale (90% for better visibility)
      this.coronalSummaryCube.position.y = this.gizmoYOffset;
      
      // Ensure all materials render properly
      this.coronalSummaryCube.traverse((child) => {
        if (child.isMesh) {
          child.material.depthWrite = true;
          child.material.depthTest = true;
        }
      });
      
      this.coronalSummarySceneManager.add(this.coronalSummaryCube);
      console.log('✅ Heart model loaded for coronal summary');
    } catch (error) {
      console.warn('⚠ Failed to load heart for coronal summary, using cube fallback:', error);
      // Fallback to gray cube
      const cubeGeometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      const cubeMaterials = [
        new THREE.MeshStandardMaterial({ color: 0xeeeeee }),
        new THREE.MeshStandardMaterial({ color: 0xdddddd }),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
        new THREE.MeshStandardMaterial({ color: 0xcccccc }),
        new THREE.MeshStandardMaterial({ color: 0xeeeeee }),
        new THREE.MeshStandardMaterial({ color: 0xdddddd })
      ];
      this.coronalSummaryCube = new THREE.Mesh(cubeGeometry, cubeMaterials);
      this.coronalSummaryCube.position.y = this.gizmoYOffset;
      this.coronalSummarySceneManager.add(this.coronalSummaryCube);
    }
    
    // Create transparent sphere/cube
    this.coronalSummarySphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.coronalSummarySphere.position.y = this.gizmoYOffset;
    this.coronalSummarySphere.visible = false;
    this.coronalSummarySceneManager.add(this.coronalSummarySphere);
    
    this.coronalSummaryTransparentCube = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 3.6, 3.6),
      new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.coronalSummaryTransparentCube.position.y = this.gizmoYOffset;
    this.coronalSummaryTransparentCube.visible = true;
    this.coronalSummarySceneManager.add(this.coronalSummaryTransparentCube);
    
    // Create plane outlines highlighting YZ (coronal)
    this.createCoronalSummaryPlaneOutlines();
    
    // Create semi-transparent plane highlights (both square and circular)
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,  // Red for coronal
      transparent: true,
      opacity: 0.15,    // More subtle (was 0.3)
      side: THREE.DoubleSide,
      depthTest: false
    });
    
    // Square highlight
    const squarePlaneGeometry = new THREE.PlaneGeometry(3.0, 3.0);
    this.coronalPlaneHighlight = new THREE.Mesh(squarePlaneGeometry, planeMaterial);
    this.coronalPlaneHighlight.rotation.y = Math.PI / 2; // Rotate to be YZ plane
    this.coronalPlaneHighlight.position.y = this.gizmoYOffset;
    this.coronalPlaneHighlight.visible = false; // Start hidden (cube style default)
    this.coronalSummarySceneManager.add(this.coronalPlaneHighlight);
    
    // Circular highlight
    const circularPlaneGeometry = new THREE.CircleGeometry(1.5, 64);
    this.coronalPlaneHighlightCircular = new THREE.Mesh(circularPlaneGeometry, planeMaterial.clone());
    this.coronalPlaneHighlightCircular.rotation.y = Math.PI / 2; // Rotate to be YZ plane
    this.coronalPlaneHighlightCircular.position.y = this.gizmoYOffset;
    this.coronalPlaneHighlightCircular.visible = false; // Start hidden
    this.coronalSummarySceneManager.add(this.coronalPlaneHighlightCircular);
    
    console.log('✓ Coronal summary gizmo created');
  }
  
  /**
   * Create summary gizmo for sagittal view (highlights XY plane)
   */
  async createSagittalSummaryGizmo() {
    this.sagittalSummarySceneManager = new SceneManager();
    
    // Create orthographic camera (zoomed in for better legibility)
    const frustumSize = 8; // Smaller frustum = more zoomed in (was 12)
    const aspect = 1;
    
    this.sagittalSummaryCamera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    
    this.sagittalSummaryCamera.position.set(5, 5 + this.gizmoYOffset, 5);
    this.sagittalSummaryCamera.lookAt(0, this.gizmoYOffset, 0);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.sagittalSummarySceneManager.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 10, 5);
    this.sagittalSummarySceneManager.add(directionalLight);
    
    // Load heart model for sagittal summary (scaled down)
    try {
      const model = await this.modelLoader.loadModel('/models/heart.glb');
      this.sagittalSummaryCube = model.clone(); // Clone to avoid sharing between scenes
      this.sagittalSummaryCube.scale.set(0.9, 0.9, 0.9); // Bigger scale (90% for better visibility)
      this.sagittalSummaryCube.position.y = this.gizmoYOffset;
      
      // Ensure all materials render properly
      this.sagittalSummaryCube.traverse((child) => {
        if (child.isMesh) {
          child.material.depthWrite = true;
          child.material.depthTest = true;
        }
      });
      
      this.sagittalSummarySceneManager.add(this.sagittalSummaryCube);
      console.log('✅ Heart model loaded for sagittal summary');
    } catch (error) {
      console.warn('⚠ Failed to load heart for sagittal summary, using cube fallback:', error);
      // Fallback to gray cube
      const cubeGeometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      const cubeMaterials = [
        new THREE.MeshStandardMaterial({ color: 0xeeeeee }),
        new THREE.MeshStandardMaterial({ color: 0xdddddd }),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
        new THREE.MeshStandardMaterial({ color: 0xcccccc }),
        new THREE.MeshStandardMaterial({ color: 0xeeeeee }),
        new THREE.MeshStandardMaterial({ color: 0xdddddd })
      ];
      this.sagittalSummaryCube = new THREE.Mesh(cubeGeometry, cubeMaterials);
      this.sagittalSummaryCube.position.y = this.gizmoYOffset;
      this.sagittalSummarySceneManager.add(this.sagittalSummaryCube);
    }
    
    // Create transparent sphere/cube
    this.sagittalSummarySphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.sagittalSummarySphere.position.y = this.gizmoYOffset;
    this.sagittalSummarySphere.visible = false;
    this.sagittalSummarySceneManager.add(this.sagittalSummarySphere);
    
    this.sagittalSummaryTransparentCube = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 3.6, 3.6),
      new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.sagittalSummaryTransparentCube.position.y = this.gizmoYOffset;
    this.sagittalSummaryTransparentCube.visible = true;
    this.sagittalSummarySceneManager.add(this.sagittalSummaryTransparentCube);
    
    // Create plane outlines highlighting XY (sagittal)
    this.createSagittalSummaryPlaneOutlines();
    
    // Create semi-transparent plane highlights (both square and circular)
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x0000ff,  // Blue for sagittal
      transparent: true,
      opacity: 0.15,    // More subtle (was 0.3)
      side: THREE.DoubleSide,
      depthTest: false
    });
    
    // Square highlight
    const squarePlaneGeometry = new THREE.PlaneGeometry(3.0, 3.0);
    this.sagittalPlaneHighlight = new THREE.Mesh(squarePlaneGeometry, planeMaterial);
    this.sagittalPlaneHighlight.position.y = this.gizmoYOffset; // XY plane (no rotation needed)
    this.sagittalPlaneHighlight.visible = false; // Start hidden (cube style default)
    this.sagittalSummarySceneManager.add(this.sagittalPlaneHighlight);
    
    // Circular highlight
    const circularPlaneGeometry = new THREE.CircleGeometry(1.5, 64);
    this.sagittalPlaneHighlightCircular = new THREE.Mesh(circularPlaneGeometry, planeMaterial.clone());
    this.sagittalPlaneHighlightCircular.position.y = this.gizmoYOffset; // XY plane (no rotation needed)
    this.sagittalPlaneHighlightCircular.visible = false; // Start hidden
    this.sagittalSummarySceneManager.add(this.sagittalPlaneHighlightCircular);
    
    console.log('✓ Sagittal summary gizmo created');
  }
  
  /**
   * Create plane outlines for summary gizmo (XY, YZ, ZX)
   * Always highlights the XZ plane (transverse cutting plane)
   */
  createSummaryPlaneOutlines() {
    const radius = 2.5; // Match circular gizmo
    const squareSize = 3.6; // Match cube gizmo
    
    // Circular plane outlines (for circular style)
    this.summaryCircularPlanes = {
      xy: this.createCircularPlaneOutline(radius, 0x0000ff, false), // Blue, not highlighted
      yz: this.createCircularPlaneOutline(radius, 0xff0000, false), // Red, not highlighted
      zx: this.createCircularPlaneOutline(radius, 0x00ff00, true)   // Green, HIGHLIGHTED (transverse)
    };
    
    // Position circular planes
    this.summaryCircularPlanes.xy.position.y = this.gizmoYOffset;
    this.summaryCircularPlanes.yz.rotation.y = Math.PI / 2;
    this.summaryCircularPlanes.yz.position.y = this.gizmoYOffset;
    this.summaryCircularPlanes.zx.rotation.x = Math.PI / 2;
    this.summaryCircularPlanes.zx.position.y = this.gizmoYOffset;
    
    this.summaryCircularPlanes.xy.visible = false; // Hidden by default (cube is default)
    this.summaryCircularPlanes.yz.visible = false;
    this.summaryCircularPlanes.zx.visible = false;
    
    this.summarySceneManager.add(this.summaryCircularPlanes.xy);
    this.summarySceneManager.add(this.summaryCircularPlanes.yz);
    this.summarySceneManager.add(this.summaryCircularPlanes.zx);
    
    // Square plane outlines (for cube style)
    this.summarySquarePlanes = {
      xy: this.createSquarePlaneOutline(squareSize, 0x0000ff, false), // Blue, not highlighted
      yz: this.createSquarePlaneOutline(squareSize, 0xff0000, false), // Red, not highlighted
      zx: this.createSquarePlaneOutline(squareSize, 0x00ff00, true)   // Green, HIGHLIGHTED (transverse)
    };
    
    // Position square planes
    this.summarySquarePlanes.xy.position.y = this.gizmoYOffset;
    this.summarySquarePlanes.yz.rotation.y = Math.PI / 2;
    this.summarySquarePlanes.yz.position.y = this.gizmoYOffset;
    this.summarySquarePlanes.zx.rotation.x = Math.PI / 2;
    this.summarySquarePlanes.zx.position.y = this.gizmoYOffset;
    
    this.summarySquarePlanes.xy.visible = true; // Visible by default (cube is default)
    this.summarySquarePlanes.yz.visible = true;
    this.summarySquarePlanes.zx.visible = true;
    
    this.summarySceneManager.add(this.summarySquarePlanes.xy);
    this.summarySceneManager.add(this.summarySquarePlanes.yz);
    this.summarySceneManager.add(this.summarySquarePlanes.zx);
  }
  
  /**
   * Create plane outlines for coronal summary gizmo
   * Highlights YZ plane (coronal cutting plane - RED)
   */
  createCoronalSummaryPlaneOutlines() {
    const radius = 2.5;
    const squareSize = 3.6;
    
    // Circular planes
    this.coronalSummaryCircularPlanes = {
      xy: this.createCircularPlaneOutline(radius, 0x0000ff, false), // Blue, not highlighted
      yz: this.createCircularPlaneOutline(radius, 0xff0000, true),  // Red, HIGHLIGHTED (coronal)
      zx: this.createCircularPlaneOutline(radius, 0x00ff00, false)  // Green, not highlighted
    };
    
    this.coronalSummaryCircularPlanes.xy.position.y = this.gizmoYOffset;
    this.coronalSummaryCircularPlanes.yz.rotation.y = Math.PI / 2;
    this.coronalSummaryCircularPlanes.yz.position.y = this.gizmoYOffset;
    this.coronalSummaryCircularPlanes.zx.rotation.x = Math.PI / 2;
    this.coronalSummaryCircularPlanes.zx.position.y = this.gizmoYOffset;
    
    this.coronalSummaryCircularPlanes.xy.visible = false;
    this.coronalSummaryCircularPlanes.yz.visible = false;
    this.coronalSummaryCircularPlanes.zx.visible = false;
    
    this.coronalSummarySceneManager.add(this.coronalSummaryCircularPlanes.xy);
    this.coronalSummarySceneManager.add(this.coronalSummaryCircularPlanes.yz);
    this.coronalSummarySceneManager.add(this.coronalSummaryCircularPlanes.zx);
    
    // Square planes
    this.coronalSummarySquarePlanes = {
      xy: this.createSquarePlaneOutline(squareSize, 0x0000ff, false), // Blue, not highlighted
      yz: this.createSquarePlaneOutline(squareSize, 0xff0000, true),  // Red, HIGHLIGHTED (coronal)
      zx: this.createSquarePlaneOutline(squareSize, 0x00ff00, false)  // Green, not highlighted
    };
    
    this.coronalSummarySquarePlanes.xy.position.y = this.gizmoYOffset;
    this.coronalSummarySquarePlanes.yz.rotation.y = Math.PI / 2;
    this.coronalSummarySquarePlanes.yz.position.y = this.gizmoYOffset;
    this.coronalSummarySquarePlanes.zx.rotation.x = Math.PI / 2;
    this.coronalSummarySquarePlanes.zx.position.y = this.gizmoYOffset;
    
    this.coronalSummarySquarePlanes.xy.visible = true;
    this.coronalSummarySquarePlanes.yz.visible = true;
    this.coronalSummarySquarePlanes.zx.visible = true;
    
    this.coronalSummarySceneManager.add(this.coronalSummarySquarePlanes.xy);
    this.coronalSummarySceneManager.add(this.coronalSummarySquarePlanes.yz);
    this.coronalSummarySceneManager.add(this.coronalSummarySquarePlanes.zx);
  }
  
  /**
   * Create plane outlines for sagittal summary gizmo
   * Highlights XY plane (sagittal cutting plane - BLUE)
   */
  createSagittalSummaryPlaneOutlines() {
    const radius = 2.5;
    const squareSize = 3.6;
    
    // Circular planes
    this.sagittalSummaryCircularPlanes = {
      xy: this.createCircularPlaneOutline(radius, 0x0000ff, true),  // Blue, HIGHLIGHTED (sagittal)
      yz: this.createCircularPlaneOutline(radius, 0xff0000, false), // Red, not highlighted
      zx: this.createCircularPlaneOutline(radius, 0x00ff00, false)  // Green, not highlighted
    };
    
    this.sagittalSummaryCircularPlanes.xy.position.y = this.gizmoYOffset;
    this.sagittalSummaryCircularPlanes.yz.rotation.y = Math.PI / 2;
    this.sagittalSummaryCircularPlanes.yz.position.y = this.gizmoYOffset;
    this.sagittalSummaryCircularPlanes.zx.rotation.x = Math.PI / 2;
    this.sagittalSummaryCircularPlanes.zx.position.y = this.gizmoYOffset;
    
    this.sagittalSummaryCircularPlanes.xy.visible = false;
    this.sagittalSummaryCircularPlanes.yz.visible = false;
    this.sagittalSummaryCircularPlanes.zx.visible = false;
    
    this.sagittalSummarySceneManager.add(this.sagittalSummaryCircularPlanes.xy);
    this.sagittalSummarySceneManager.add(this.sagittalSummaryCircularPlanes.yz);
    this.sagittalSummarySceneManager.add(this.sagittalSummaryCircularPlanes.zx);
    
    // Square planes
    this.sagittalSummarySquarePlanes = {
      xy: this.createSquarePlaneOutline(squareSize, 0x0000ff, true),  // Blue, HIGHLIGHTED (sagittal)
      yz: this.createSquarePlaneOutline(squareSize, 0xff0000, false), // Red, not highlighted
      zx: this.createSquarePlaneOutline(squareSize, 0x00ff00, false)  // Green, not highlighted
    };
    
    this.sagittalSummarySquarePlanes.xy.position.y = this.gizmoYOffset;
    this.sagittalSummarySquarePlanes.yz.rotation.y = Math.PI / 2;
    this.sagittalSummarySquarePlanes.yz.position.y = this.gizmoYOffset;
    this.sagittalSummarySquarePlanes.zx.rotation.x = Math.PI / 2;
    this.sagittalSummarySquarePlanes.zx.position.y = this.gizmoYOffset;
    
    this.sagittalSummarySquarePlanes.xy.visible = true;
    this.sagittalSummarySquarePlanes.yz.visible = true;
    this.sagittalSummarySquarePlanes.zx.visible = true;
    
    this.sagittalSummarySceneManager.add(this.sagittalSummarySquarePlanes.xy);
    this.sagittalSummarySceneManager.add(this.sagittalSummarySquarePlanes.yz);
    this.sagittalSummarySceneManager.add(this.sagittalSummarySquarePlanes.zx);
  }
  
  /**
   * Create circular plane outline
   */
  createCircularPlaneOutline(radius, color, highlighted) {
    const segments = 64;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      positions.push(
        Math.cos(theta) * radius,
        Math.sin(theta) * radius,
        0
      );
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const material = new THREE.LineDashedMaterial({
      color: highlighted ? color : 0x333333,
      linewidth: highlighted ? 3 : 1,
      opacity: highlighted ? 1.0 : 0.2,
      transparent: true,
      dashSize: 0.2,
      gapSize: 0.1
    });
    
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    
    return line;
  }
  
  /**
   * Create square plane outline
   */
  createSquarePlaneOutline(size, color, highlighted) {
    const halfSize = size / 2;
    const geometry = new THREE.BufferGeometry();
    const positions = [
      -halfSize, -halfSize, 0,
      halfSize, -halfSize, 0,
      halfSize, halfSize, 0,
      -halfSize, halfSize, 0,
      -halfSize, -halfSize, 0
    ];
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const material = new THREE.LineDashedMaterial({
      color: highlighted ? color : 0x333333,
      linewidth: highlighted ? 3 : 1,
      opacity: highlighted ? 1.0 : 0.2,
      transparent: true,
      dashSize: 0.2,
      gapSize: 0.1
    });
    
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    
    return line;
  }

  /**
   * Create a transparent filled cube
   * @returns {THREE.Mesh}
   */
  createTransparentCube() {
    // Size matches square frames (3.6) to be tangent to the XY/YZ/ZX planes
    const size = 3.6;  // Tangent to square frames
    const geometry = new THREE.BoxGeometry(size, size, size);
    
    // Transparent filled material
    const material = new THREE.MeshBasicMaterial({
      color: 0x888888,      // Gray color
      transparent: true,
      opacity: 0.15,        // Half-transparent like the sphere
      side: THREE.DoubleSide,
      depthWrite: false     // Don't write to depth buffer
    });
    
    const cube = new THREE.Mesh(geometry, material);
    
    return cube;
  }

  /**
   * Setup integration between orbit controls and gizmo input
   */
  setupOrbitControlsIntegration() {
    const controls = this.workCameraManager.getControls();
    
    // Store reference to check if we should disable controls
    this.inputHandler.onGizmoInteractionStart = () => {
      controls.enabled = false;
    };

    this.inputHandler.onGizmoInteractionEnd = () => {
      controls.enabled = true;
    };
  }

  /**
   * Setup reset button to return object to initial rotation
   */
  /**
   * Setup style switcher buttons for gizmo visual testing
   */
  setupStyleSwitcher() {
    const styleButtons = document.querySelectorAll('.style-button');
    
    styleButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Remove active class from all buttons
        styleButtons.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Get style name and apply it
        const styleName = button.getAttribute('data-style');
        this.gizmo.applyStyle(styleName);
        
        // Show/hide sphere and cube based on style (main gizmo)
        if (this.workSphere) {
          if (styleName === 'circular') {
            this.workSphere.visible = true;
            this.workCube.visible = false;
            console.log('✓ Sphere visible, cube hidden');
          } else if (styleName === 'linear') {
            this.workSphere.visible = false;
            this.workCube.visible = false;
            console.log('✓ Sphere hidden, cube hidden');
          } else if (styleName === 'cube') {
            this.workSphere.visible = false;
            this.workCube.visible = true;
            console.log('✓ Sphere hidden, cube visible');
          }
        }
        
        // Update summary gizmo shapes visibility
        if (this.summaryTransparentCube && this.summarySphere) {
          if (styleName === 'cube') {
            this.summaryTransparentCube.visible = true;
            this.summarySphere.visible = false;
            // Show square planes, hide circular
            if (this.summarySquarePlanes) {
              this.summarySquarePlanes.xy.visible = true;
              this.summarySquarePlanes.yz.visible = true;
              this.summarySquarePlanes.zx.visible = true;
            }
            if (this.summaryCircularPlanes) {
              this.summaryCircularPlanes.xy.visible = false;
              this.summaryCircularPlanes.yz.visible = false;
              this.summaryCircularPlanes.zx.visible = false;
            }
            // Show square highlights, hide circular
            if (this.summaryPlaneHighlight) this.summaryPlaneHighlight.visible = true;
            if (this.summaryPlaneHighlightCircular) this.summaryPlaneHighlightCircular.visible = false;
          } else if (styleName === 'circular') {
            this.summaryTransparentCube.visible = false;
            this.summarySphere.visible = true;
            // Show circular planes, hide square
            if (this.summarySquarePlanes) {
              this.summarySquarePlanes.xy.visible = false;
              this.summarySquarePlanes.yz.visible = false;
              this.summarySquarePlanes.zx.visible = false;
            }
            if (this.summaryCircularPlanes) {
              this.summaryCircularPlanes.xy.visible = true;
              this.summaryCircularPlanes.yz.visible = true;
              this.summaryCircularPlanes.zx.visible = true;
            }
            // Show circular highlights, hide square
            if (this.summaryPlaneHighlight) this.summaryPlaneHighlight.visible = false;
            if (this.summaryPlaneHighlightCircular) this.summaryPlaneHighlightCircular.visible = true;
          }
        }
        
        // Update coronal summary gizmo shapes
        if (this.coronalSummaryTransparentCube && this.coronalSummarySphere) {
          if (styleName === 'cube') {
            this.coronalSummaryTransparentCube.visible = true;
            this.coronalSummarySphere.visible = false;
            if (this.coronalSummarySquarePlanes) {
              this.coronalSummarySquarePlanes.xy.visible = true;
              this.coronalSummarySquarePlanes.yz.visible = true;
              this.coronalSummarySquarePlanes.zx.visible = true;
            }
            if (this.coronalSummaryCircularPlanes) {
              this.coronalSummaryCircularPlanes.xy.visible = false;
              this.coronalSummaryCircularPlanes.yz.visible = false;
              this.coronalSummaryCircularPlanes.zx.visible = false;
            }
            // Show square highlights, hide circular
            if (this.coronalPlaneHighlight) this.coronalPlaneHighlight.visible = true;
            if (this.coronalPlaneHighlightCircular) this.coronalPlaneHighlightCircular.visible = false;
          } else if (styleName === 'circular') {
            this.coronalSummaryTransparentCube.visible = false;
            this.coronalSummarySphere.visible = true;
            if (this.coronalSummarySquarePlanes) {
              this.coronalSummarySquarePlanes.xy.visible = false;
              this.coronalSummarySquarePlanes.yz.visible = false;
              this.coronalSummarySquarePlanes.zx.visible = false;
            }
            if (this.coronalSummaryCircularPlanes) {
              this.coronalSummaryCircularPlanes.xy.visible = true;
              this.coronalSummaryCircularPlanes.yz.visible = true;
              this.coronalSummaryCircularPlanes.zx.visible = true;
            }
            // Show circular highlights, hide square
            if (this.coronalPlaneHighlight) this.coronalPlaneHighlight.visible = false;
            if (this.coronalPlaneHighlightCircular) this.coronalPlaneHighlightCircular.visible = true;
          }
        }
        
        // Update sagittal summary gizmo shapes
        if (this.sagittalSummaryTransparentCube && this.sagittalSummarySphere) {
          if (styleName === 'cube') {
            this.sagittalSummaryTransparentCube.visible = true;
            this.sagittalSummarySphere.visible = false;
            if (this.sagittalSummarySquarePlanes) {
              this.sagittalSummarySquarePlanes.xy.visible = true;
              this.sagittalSummarySquarePlanes.yz.visible = true;
              this.sagittalSummarySquarePlanes.zx.visible = true;
            }
            if (this.sagittalSummaryCircularPlanes) {
              this.sagittalSummaryCircularPlanes.xy.visible = false;
              this.sagittalSummaryCircularPlanes.yz.visible = false;
              this.sagittalSummaryCircularPlanes.zx.visible = false;
            }
            // Show square highlights, hide circular
            if (this.sagittalPlaneHighlight) this.sagittalPlaneHighlight.visible = true;
            if (this.sagittalPlaneHighlightCircular) this.sagittalPlaneHighlightCircular.visible = false;
          } else if (styleName === 'circular') {
            this.sagittalSummaryTransparentCube.visible = false;
            this.sagittalSummarySphere.visible = true;
            if (this.sagittalSummarySquarePlanes) {
              this.sagittalSummarySquarePlanes.xy.visible = false;
              this.sagittalSummarySquarePlanes.yz.visible = false;
              this.sagittalSummarySquarePlanes.zx.visible = false;
            }
            if (this.sagittalSummaryCircularPlanes) {
              this.sagittalSummaryCircularPlanes.xy.visible = true;
              this.sagittalSummaryCircularPlanes.yz.visible = true;
              this.sagittalSummaryCircularPlanes.zx.visible = true;
            }
            // Show circular highlights, hide square
            if (this.sagittalPlaneHighlight) this.sagittalPlaneHighlight.visible = false;
            if (this.sagittalPlaneHighlightCircular) this.sagittalPlaneHighlightCircular.visible = true;
          }
        }
        
        console.log(`✓ Style switched to: ${styleName}`);
      });
    });
    
    console.log('✓ Style switcher initialized');
  }

  /**
   * Setup reset button functionality
   */
  setupResetButton() {
    const resetButton = document.getElementById('reset-button');
    
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        this.resetRotation();
      });
    }
    
    console.log('✓ Reset button initialized');
  }

  /**
   * Make info panels draggable while preserving their default CSS position
   * Supports both mouse and touch events for mobile compatibility
   */
  makeDraggable(element) {
    const header = element.querySelector('.info-header');
    
    if (!header) {
      console.warn('⚠ Info header not found for draggable element');
      return;
    }
    
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;

    header.style.cursor = 'move';
    header.style.userSelect = 'none';
    header.style.touchAction = 'none'; // Prevent default touch behaviors
    
    // Initialize with no transform (keeps CSS default position)
    element.style.transform = 'translate(0px, 0px)';
    
    // Get client coordinates from mouse or touch event
    const getClientCoords = (e) => {
      if (e.type.startsWith('touch')) {
        const touch = e.touches[0] || e.changedTouches[0];
        return { clientX: touch.clientX, clientY: touch.clientY };
      }
      return { clientX: e.clientX, clientY: e.clientY };
    };
    
    const dragStart = (e) => {
      // Only drag if clicking/touching on the header (not the chevron area)
      if (e.target.classList.contains('chevron')) {
        return;
      }
      
      const coords = getClientCoords(e);
      initialX = coords.clientX - xOffset;
      initialY = coords.clientY - yOffset;

      if (e.target === header || e.target.tagName === 'H1' || header.contains(e.target)) {
        isDragging = true;
        // Prevent text selection on touch devices
        if (e.type.startsWith('touch')) {
          e.preventDefault();
        }
      }
    };

    const drag = (e) => {
      if (isDragging) {
        e.preventDefault();
        
        const coords = getClientCoords(e);
        currentX = coords.clientX - initialX;
        currentY = coords.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        element.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
    };

    const dragEnd = (e) => {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
    };
    
    // Mouse events
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    // Touch events for mobile
    header.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', dragEnd);
    document.addEventListener('touchcancel', dragEnd);
    
    console.log(`✓ Panel draggable (mouse & touch) at default position: ${element.id}`);
  }

  /**
   * Setup info panel toggle functionality
   */
  setupInfoToggle() {
    // Setup toggle for both info panels
    const panels = ['main-screen-info', 'touch-screen-info'];
    
    panels.forEach(panelId => {
      const panel = document.getElementById(panelId);
      if (!panel) {
        console.warn(`⚠ ${panelId} panel not found`);
        return;
      }
      
      // Make panel draggable
      this.makeDraggable(panel);
      
      const infoHeader = panel.querySelector('.info-header');
      const infoContent = panel.querySelector('.info-content');
      const chevron = panel.querySelector('.chevron');
      
      if (!infoHeader || !infoContent || !chevron) {
        console.warn(`⚠ ${panelId} elements not found`);
        return;
      }
      
      // Toggle on chevron click
      chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = infoContent.classList.contains('collapsed');
        
        if (isCollapsed) {
          // Expand
          infoContent.classList.remove('collapsed');
          chevron.classList.remove('collapsed');
          chevron.textContent = '▲';  // Up arrow when expanded
        } else {
          // Collapse
          infoContent.classList.add('collapsed');
          chevron.classList.add('collapsed');
          chevron.textContent = '▼';  // Down arrow when collapsed
        }
      });
    });
    
    console.log('✓ Info panel toggles initialized');
  }

  /**
   * Setup draggable plane interaction for MPR slice control
   * This modifies the InputHandler to support transverse slice control
   */
  setupDraggablePlane() {
    // Store reference to app instance for use in InputHandler
    this.isControllingSlice = false;
    this.sliceDragStartY = 0;
    this.sliceStartPosition = 0;
    
    console.log('✓ Transverse slice control ready (drag Y-axis to control)');
  }

  /**
   * Reset object rotation and camera to initial state with smooth animation
   */
  resetRotation() {
    console.log('🔄 Resetting rotation, camera, and slice planes to initial state');
    
    // Reset gizmo style to cube immediately (no need to animate this)
    this.gizmo.applyStyle('cube');
    
    // Update style buttons
    const styleButtons = document.querySelectorAll('.style-button');
    styleButtons.forEach(btn => {
      if (btn.getAttribute('data-style') === 'cube') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // Show/hide sphere and cube based on cube style (work scene)
    if (this.workSphere) {
      this.workSphere.visible = false;
      this.workCube.visible = true;
    }
    
    // Update touch screen gizmo shapes (preview scene)
    if (this.previewSphere && this.previewCube) {
      this.previewSphere.visible = false;
      this.previewCube.visible = true;
    }
    
    // Update summary gizmo shapes visibility for cube style
    if (this.summaryTransparentCube && this.summarySphere) {
      this.summaryTransparentCube.visible = true;
      this.summarySphere.visible = false;
      if (this.summarySquarePlanes) {
        this.summarySquarePlanes.xy.visible = true;
        this.summarySquarePlanes.yz.visible = true;
        this.summarySquarePlanes.zx.visible = true;
      }
      if (this.summaryCircularPlanes) {
        this.summaryCircularPlanes.xy.visible = false;
        this.summaryCircularPlanes.yz.visible = false;
        this.summaryCircularPlanes.zx.visible = false;
      }
      if (this.summaryPlaneHighlight) this.summaryPlaneHighlight.visible = true;
      if (this.summaryPlaneHighlightCircular) this.summaryPlaneHighlightCircular.visible = false;
    }
    
    // Update coronal summary gizmo shapes
    if (this.coronalSummaryTransparentCube && this.coronalSummarySphere) {
      this.coronalSummaryTransparentCube.visible = true;
      this.coronalSummarySphere.visible = false;
      if (this.coronalSummarySquarePlanes) {
        this.coronalSummarySquarePlanes.xy.visible = true;
        this.coronalSummarySquarePlanes.yz.visible = true;
        this.coronalSummarySquarePlanes.zx.visible = true;
      }
      if (this.coronalSummaryCircularPlanes) {
        this.coronalSummaryCircularPlanes.xy.visible = false;
        this.coronalSummaryCircularPlanes.yz.visible = false;
        this.coronalSummaryCircularPlanes.zx.visible = false;
      }
      if (this.coronalPlaneHighlight) this.coronalPlaneHighlight.visible = true;
      if (this.coronalPlaneHighlightCircular) this.coronalPlaneHighlightCircular.visible = false;
    }
    
    // Update sagittal summary gizmo shapes
    if (this.sagittalSummaryTransparentCube && this.sagittalSummarySphere) {
      this.sagittalSummaryTransparentCube.visible = true;
      this.sagittalSummarySphere.visible = false;
      if (this.sagittalSummarySquarePlanes) {
        this.sagittalSummarySquarePlanes.xy.visible = true;
        this.sagittalSummarySquarePlanes.yz.visible = true;
        this.sagittalSummarySquarePlanes.zx.visible = true;
      }
      if (this.sagittalSummaryCircularPlanes) {
        this.sagittalSummaryCircularPlanes.xy.visible = false;
        this.sagittalSummaryCircularPlanes.yz.visible = false;
        this.sagittalSummaryCircularPlanes.zx.visible = false;
      }
      if (this.sagittalPlaneHighlight) this.sagittalPlaneHighlight.visible = true;
      if (this.sagittalPlaneHighlightCircular) this.sagittalPlaneHighlightCircular.visible = false;
    }
    
    // Disable orbit controls during reset to prevent interference
    const controls = this.workCameraManager.getControls();
    controls.enabled = false;
    
    // Store start states
    const duration = 800; // milliseconds (longer for smoother appearance)
    const startTime = Date.now();
    const camera = this.workCameraManager.getCamera();
    const startRotation = this.testObject.quaternion.clone();
    const startCameraPosition = camera.position.clone();
    const startCameraTarget = controls.target.clone();
    const startCameraZoom = camera.zoom || 1;
    const startTransverseY = this.transverseYPosition || 0;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth ease-in-out (sine wave) for more natural motion
      const eased = 0.5 - Math.cos(progress * Math.PI) / 2;
      
      // Interpolate object rotation (quaternion)
      this.testObject.quaternion.slerpQuaternions(
        startRotation,
        this.initialRotation,
        eased
      );
      
      // Interpolate camera position (work viewport only)
      this.workCameraManager.getCamera().position.lerpVectors(
        startCameraPosition,
        this.initialCameraPosition,
        eased
      );
      
      // Interpolate camera target (where it's looking)
      controls.target.lerpVectors(
        startCameraTarget,
        this.initialCameraTarget,
        eased
      );
      
      // Interpolate camera zoom (for OrthographicCamera)
      if (camera.isOrthographicCamera) {
        camera.zoom = startCameraZoom + (this.initialCameraZoom - startCameraZoom) * eased;
        camera.updateProjectionMatrix();
      }
      
      // Interpolate transverse slice position back to center (gizmoYOffset)
      const targetY = this.gizmoYOffset;
      const newTransverseY = startTransverseY + (targetY - startTransverseY) * eased;
      this.updateTransverseClipping(newTransverseY);
      
      // Update controls without enabling them yet
      controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Re-enable controls after animation completes
        controls.enabled = true;
        console.log('✅ Reset complete - rotation, camera (position, target, zoom), style (cube), and slice planes restored');
      }
    };
    
    animate();
  }

  /**
   * Add a grid helper for spatial reference (only in work viewport)
   * Currently hidden as per user request
   */
  addGridHelper() {
    // Grid and axis helpers hidden for cleaner touch screen
    // Uncomment below if needed:
    // const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    // this.workSceneManager.add(gridHelper);
    // const axesHelper = new THREE.AxesHelper(5);
    // this.workSceneManager.add(axesHelper);
  }

  /**
   * Animation loop (renders both viewports)
   */
  animate() {
    requestAnimationFrame(() => this.animate());

    // Update work camera controls
    this.workCameraManager.update();

    // Sync preview camera with work camera
    const workCamera = this.workCameraManager.getCamera();
    const previewCamera = this.previewCameraManager.getCamera();
    const workControls = this.workCameraManager.getControls();
    
    // Get work camera's position relative to target
    const target = workControls.target.clone();
    const direction = new THREE.Vector3().subVectors(workCamera.position, target);
    const distance = direction.length();
    
    // Scale up the distance LESS than cube scale to make cube appear BIGGER
    // Cube is 15x but camera only 8x away = cube appears much larger!
    const scaledDistance = distance * 8.0;
    direction.normalize().multiplyScalar(scaledDistance);
    
    // Set preview camera position (same angle, closer than cube scale)
    previewCamera.position.copy(target).add(direction);
    
    // Add vertical offset to look higher (makes model appear lower in viewport)
    const adjustedTarget = target.clone();
    adjustedTarget.y += 2.0; // Look 2 units higher to move heart down
    
    previewCamera.lookAt(adjustedTarget);
    previewCamera.zoom = workCamera.zoom;
    previewCamera.updateProjectionMatrix();

    // Sync preview object rotation with work object (hidden in touch screen)
    this.previewObject.quaternion.copy(this.testObject.quaternion);

    // Sync work sphere rotation with work object
    if (this.workSphere) {
      this.workSphere.quaternion.copy(this.testObject.quaternion);
    }

    // Update gizmo position (follows model which is already at gizmoYOffset)
    this.gizmo.update();
    
    // Sync all summary gizmos with main gizmo rotation
    if (this.summaryCube) {
      this.summaryCube.quaternion.copy(this.testObject.quaternion);
    }
    if (this.coronalSummaryCube) {
      this.coronalSummaryCube.quaternion.copy(this.testObject.quaternion);
    }
    if (this.sagittalSummaryCube) {
      this.sagittalSummaryCube.quaternion.copy(this.testObject.quaternion);
    }
    
    // Sync transverse summary plane position with transverse slice
    if (this.summarySquarePlanes && this.summarySquarePlanes.zx) {
      const localY = this.transverseYPosition - this.gizmoYOffset;
      this.summarySquarePlanes.zx.position.y = this.gizmoYOffset + localY;
    }
    if (this.summaryCircularPlanes && this.summaryCircularPlanes.zx) {
      const localY = this.transverseYPosition - this.gizmoYOffset;
      this.summaryCircularPlanes.zx.position.y = this.gizmoYOffset + localY;
    }
    
    // Sync plane highlights with slice positions
    if (this.summaryPlaneHighlight) {
      const localY = this.transverseYPosition - this.gizmoYOffset;
      this.summaryPlaneHighlight.position.y = this.gizmoYOffset + localY;
    }
    if (this.summaryPlaneHighlightCircular) {
      const localY = this.transverseYPosition - this.gizmoYOffset;
      this.summaryPlaneHighlightCircular.position.y = this.gizmoYOffset + localY;
    }
    if (this.coronalPlaneHighlight) {
      // Coronal plane position (would need to track if we add coronal dragging)
      // For now, stays at center
    }
    if (this.coronalPlaneHighlightCircular) {
      // Coronal plane position (would need to track if we add coronal dragging)
      // For now, stays at center
    }
    if (this.sagittalPlaneHighlight) {
      // Sagittal plane position (would need to track if we add sagittal dragging)
      // For now, stays at center
    }
    if (this.sagittalPlaneHighlightCircular) {
      // Sagittal plane position (would need to track if we add sagittal dragging)
      // For now, stays at center
    }

    // Render all viewports with thin slab clipping for cross-section views
    this.renderer.render(
      this.previewSceneManager.getScene(),
      this.previewCameraManager.getCamera(),
      this.transverseCameraManager.getCamera(),
      this.coronalCameraManager.getCamera(),
      this.sagittalCameraManager.getCamera(),
      this.transverseClipPlanes,
      this.coronalClipPlanes,
      this.sagittalClipPlanes,
      this.workSceneManager.getScene(),
      this.workCameraManager.getCamera(),
      this.summarySceneManager.getScene(),
      this.summaryCamera,
      this.coronalSummarySceneManager.getScene(),
      this.coronalSummaryCamera,
      this.sagittalSummarySceneManager.getScene(),
      this.sagittalSummaryCamera
    );
  }
}

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    const app = new RotationGizmoApp();
    await app.init();
  });
} else {
  const app = new RotationGizmoApp();
  app.init();
}

