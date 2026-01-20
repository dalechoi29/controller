import * as THREE from 'three';
import { SceneManager } from './core/Scene.js';
import { CameraManager } from './core/Camera.js';
import { RendererManager } from './core/Renderer.js';
import { RotationGizmo } from './gizmo/RotationGizmo.js';
import { InputHandler } from './core/InputHandler.js';
import { ModelLoader } from './utils/ModelLoader.js';

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

    // Store initial states for reset functionality
    this.initialRotation = null;

    // Create camera for PREVIEW viewport
    this.previewCameraManager = this.createPreviewCamera();

    // Create camera for WORK viewport (with orbit controls)
    this.workCameraManager = new CameraManager(this.renderer);
    this.initialCameraPosition = this.workCameraManager.getCamera().position.clone();
    this.initialCameraTarget = this.workCameraManager.getControls().target.clone();
    
    // Gizmo and input handler will be initialized after model loads
    this.gizmo = null;
    this.inputHandler = null;
  }

  /**
   * Async initialization - loads model and sets up scene
   */
  async init() {
    console.log('🚀 Initializing 3D Rotation Gizmo...');
    
    // ===== TOUCH SCREEN (Bottom) =====
    // Always use decolorized cube for touch screen controls
    this.testObject = this.createDecolorizedCube();
    this.workSceneManager.add(this.testObject);
    
    // Create transparent sphere tangent to axis rings (touch screen only)
    this.workSphere = this.createTransparentSphere();
    this.workSceneManager.add(this.workSphere);
    
    // ===== MAIN SCREEN (Top) - LOAD YOUR BLENDER MODEL =====
    // IMPORTANT: Change this path to your actual .glb file!
    // Example: '/models/your_model.glb'
    const modelPath = '/models/heart.glb';
    
    try {
      console.log(`📦 Attempting to load Blender model from: ${modelPath}`);
      
      // Load your Blender model for main screen ONLY
      this.previewObject = await this.modelLoader.loadModel(modelPath);
      
      // Make model MASSIVE - almost fills main screen (15x scale)
      this.previewObject.scale.set(15.0, 15.0, 15.0);
      this.previewSceneManager.add(this.previewObject);
      
      console.log('✅ Blender model loaded successfully for MAIN SCREEN!');
      console.log('   Touch screen will continue using cube for controls');
      
    } catch (error) {
      console.warn('⚠️ Could not load Blender model, using fallback colorful cube');
      console.warn('   Make sure your .glb file is in: public/models/');
      console.warn('   Error:', error.message);
      
      // FALLBACK: Use colorful cube if model fails to load
      this.previewObject = this.createTestObject();
      this.previewObject.scale.set(15.0, 15.0, 15.0);
      this.previewSceneManager.add(this.previewObject);
    }

    // Store initial rotation for reset functionality
    this.initialRotation = this.testObject.quaternion.clone();

    // Initialize gizmo (only in work scene)
    this.gizmo = new RotationGizmo(this.testObject);
    this.workSceneManager.add(this.gizmo.getMesh());

    // Add grid and helpers (only in work scene)
    this.addGridHelper();

    // Initialize input handler for gizmo interaction (only in work viewport)
    this.inputHandler = new InputHandler(
      this.workCameraManager.getCamera(),
      this.renderer.domElement,
      this.gizmo
    );

    // Disable orbit controls when interacting with gizmo
    this.setupOrbitControlsIntegration();

    // Setup reset button
    this.setupResetButton();

    // Setup style switcher
    this.setupStyleSwitcher();

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
      // Update work camera aspect ratio
      this.workCameraManager.handleResize();
      
      // Update preview camera aspect ratio
      if (this.previewCameraManager && this.previewCameraManager.handleResize) {
        this.previewCameraManager.handleResize();
      }
      
      console.log('✓ Cameras resized');
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
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / (window.innerHeight * 0.6), // 60vh viewport
      0.1,
      1000
    );
    
    // Initial camera position (will sync with work camera)
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);

    return {
      getCamera: () => camera,
      update: () => {}, // Camera position syncs in main animate loop
      handleResize: () => {
        camera.aspect = window.innerWidth / (window.innerHeight * 0.6);
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
    // Sphere radius should match gizmo ring radius (2.5)
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
  setupResetButton() {
    const resetButton = document.getElementById('reset-button');
    
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        this.resetRotation();
      });
    }
  }

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
        
        // Show/hide sphere based on style
        if (this.workSphere) {
          if (styleName === 'circular') {
            this.workSphere.visible = true;
            console.log('✓ Sphere visible');
          } else if (styleName === 'linear') {
            this.workSphere.visible = false;
            console.log('✓ Sphere hidden');
          }
        }
        
        console.log(`✓ Style switched to: ${styleName}`);
      });
    });
    
    console.log('✓ Style switcher initialized');
  }

  /**
   * Reset object rotation and camera to initial state with smooth animation
   */
  resetRotation() {
    console.log('🔄 Resetting rotation and camera to initial state');
    
    // Disable orbit controls during reset to prevent interference
    const controls = this.workCameraManager.getControls();
    controls.enabled = false;
    
    // Store start states
    const duration = 800; // milliseconds (longer for smoother appearance)
    const startTime = Date.now();
    const startRotation = this.testObject.quaternion.clone();
    const startCameraPosition = this.workCameraManager.getCamera().position.clone();
    const startCameraTarget = controls.target.clone();
    
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
      
      // Update controls without enabling them yet
      controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Re-enable controls after animation completes
        controls.enabled = true;
        console.log('✅ Reset complete - object and camera restored');
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

    // Update gizmo position
    this.gizmo.update();

    // Render both viewports
    this.renderer.render(
      this.previewSceneManager.getScene(),
      this.previewCameraManager.getCamera(),
      this.workSceneManager.getScene(),
      this.workCameraManager.getCamera()
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

