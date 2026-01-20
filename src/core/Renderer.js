import * as THREE from 'three';

/**
 * Dual viewport renderer manager
 * Handles rendering for both preview and work viewports
 */
export class RendererManager {
  constructor() {
    // Create preview renderer (top viewport)
    this.previewRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.previewRenderer.setPixelRatio(window.devicePixelRatio);
    this.previewRenderer.shadowMap.enabled = true;
    this.previewRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Create work renderer (bottom viewport)
    this.workRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.workRenderer.setPixelRatio(window.devicePixelRatio);
    this.workRenderer.shadowMap.enabled = true;
    this.workRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Add canvases to their respective containers
    const previewContainer = document.getElementById('preview-viewport');
    const workContainer = document.getElementById('work-viewport');

    if (previewContainer && workContainer) {
      previewContainer.appendChild(this.previewRenderer.domElement);
      workContainer.appendChild(this.workRenderer.domElement);
    }

    // Set initial sizes
    this.handleResize();

    // Handle window resize
    window.addEventListener('resize', () => this.handleResize());
  }

  /**
   * Handle window resize event
   */
  handleResize() {
    const width = window.innerWidth;
    const previewHeight = window.innerHeight * 0.6; // 60% for main screen
    const workHeight = window.innerHeight * 0.4;    // 40% for touch screen

    this.previewRenderer.setSize(width, previewHeight);
    this.workRenderer.setSize(width, workHeight);
  }

  /**
   * Render both viewports
   * @param {THREE.Scene} previewScene - Scene for preview viewport
   * @param {THREE.Camera} previewCamera - Camera for preview viewport
   * @param {THREE.Scene} workScene - Scene for work viewport
   * @param {THREE.Camera} workCamera - Camera for work viewport
   */
  render(previewScene, previewCamera, workScene, workCamera) {
    this.previewRenderer.render(previewScene, previewCamera);
    this.workRenderer.render(workScene, workCamera);
  }

  /**
   * Get the work viewport's DOM element (for input handling)
   * @returns {HTMLCanvasElement}
   */
  get domElement() {
    return this.workRenderer.domElement;
  }

  /**
   * Get work renderer instance
   * @returns {THREE.WebGLRenderer}
   */
  getRenderer() {
    return this.workRenderer;
  }

  /**
   * Get preview renderer instance
   * @returns {THREE.WebGLRenderer}
   */
  getPreviewRenderer() {
    return this.previewRenderer;
  }

  /**
   * Clean up renderer resources
   */
  dispose() {
    this.previewRenderer.dispose();
    this.workRenderer.dispose();
  }
}
