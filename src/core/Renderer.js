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
    
    // Enable clipping planes for thin slab visualization
    this.previewRenderer.localClippingEnabled = false; // Use global clipping
    this.previewRenderer.clippingPlanes = [];

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
    const previewHeight = window.innerHeight * 0.7; // 70% for main screen
    const workHeight = window.innerHeight * 0.3;    // 30% for touch screen
    const previewWidth = previewHeight * 1.6;       // 1.6:1 aspect ratio for main screen
    const workWidth = workHeight * 1.6;             // 1.6:1 aspect ratio for touch screen

    this.previewRenderer.setSize(previewWidth, previewHeight);
    this.workRenderer.setSize(workWidth, workHeight);
  }

  /**
   * Render all viewports with thin slab clipping for MPR views
   * @param {THREE.Scene} previewScene - Scene for preview viewport
   * @param {THREE.Camera} previewCamera - Camera for 3D perspective view (left)
   * @param {THREE.Camera} transverseCamera - Camera for transverse plane (top right)
   * @param {THREE.Camera} coronalCamera - Camera for coronal plane (middle right)
   * @param {THREE.Camera} sagittalCamera - Camera for sagittal plane (bottom right)
   * @param {Array} transverseClipPlanes - Dual clipping planes for transverse slab
   * @param {Array} coronalClipPlanes - Dual clipping planes for coronal slab
   * @param {Array} sagittalClipPlanes - Dual clipping planes for sagittal slab
   * @param {THREE.Scene} workScene - Scene for work viewport
   * @param {THREE.Camera} workCamera - Camera for work viewport
   * @param {THREE.Scene} summaryScene - Summary gizmo scene for transverse
   * @param {THREE.Camera} summaryCamera - Summary gizmo camera for transverse
   * @param {THREE.Scene} coronalSummaryScene - Summary gizmo scene for coronal
   * @param {THREE.Camera} coronalSummaryCamera - Summary gizmo camera for coronal
   * @param {THREE.Scene} sagittalSummaryScene - Summary gizmo scene for sagittal
   * @param {THREE.Camera} sagittalSummaryCamera - Summary gizmo camera for sagittal
   */
  render(previewScene, previewCamera, transverseCamera, coronalCamera, sagittalCamera,
         transverseClipPlanes, coronalClipPlanes, sagittalClipPlanes, workScene, workCamera,
         summaryScene, summaryCamera, coronalSummaryScene, coronalSummaryCamera,
         sagittalSummaryScene, sagittalSummaryCamera) {
    const previewHeight = window.innerHeight * 0.7;
    const width = previewHeight * 1.6; // 1.6:1 aspect ratio
    const halfWidth = Math.floor(width / 2);
    const thirdHeight = Math.floor(previewHeight / 3);
    
    // Enable scissor test for split viewports
    this.previewRenderer.setScissorTest(true);
    
    // === LEFT HALF: 3D Perspective View (No clipping) ===
    this.previewRenderer.clippingPlanes = [];
    this.previewRenderer.setViewport(0, 0, halfWidth, previewHeight);
    this.previewRenderer.setScissor(0, 0, halfWidth, previewHeight);
    this.previewRenderer.render(previewScene, previewCamera);
    
    // === RIGHT TOP THIRD: Transverse Slab (Full width) ===
    this.previewRenderer.clippingPlanes = transverseClipPlanes || [];
    this.previewRenderer.setViewport(halfWidth, thirdHeight * 2, halfWidth, thirdHeight);
    this.previewRenderer.setScissor(halfWidth, thirdHeight * 2, halfWidth, thirdHeight);
    this.previewRenderer.render(previewScene, transverseCamera);
    
    // Overlay: Summary Gizmo (top-left corner of transverse, square viewport)
    if (summaryScene && summaryCamera) {
      const overlaySize = Math.min(thirdHeight, halfWidth) * 0.55; // 55% of smaller dimension (larger)
      const overlayX = halfWidth + 15; // 15px from left edge
      const overlayY = thirdHeight * 2 + thirdHeight - overlaySize - 15; // 15px from top
      
      this.previewRenderer.clippingPlanes = [];
      this.previewRenderer.setViewport(overlayX, overlayY, overlaySize, overlaySize);
      this.previewRenderer.setScissor(overlayX, overlayY, overlaySize, overlaySize);
      this.previewRenderer.render(summaryScene, summaryCamera);
      
      // Update CSS border position
      this.updateSummaryBorder(overlayX, overlayY, overlaySize, 'summary-gizmo-border');
    }
    
    // === RIGHT MIDDLE THIRD: Coronal Slab (Thin front-to-back slice) ===
    this.previewRenderer.clippingPlanes = coronalClipPlanes || [];
    this.previewRenderer.setViewport(halfWidth, thirdHeight, halfWidth, thirdHeight);
    this.previewRenderer.setScissor(halfWidth, thirdHeight, halfWidth, thirdHeight);
    this.previewRenderer.render(previewScene, coronalCamera);
    
    // Overlay: Coronal Summary Gizmo (top-left corner of coronal, square viewport)
    if (coronalSummaryScene && coronalSummaryCamera) {
      const overlaySize = Math.min(thirdHeight, halfWidth) * 0.55;
      const overlayX = halfWidth + 15;
      const overlayY = thirdHeight + thirdHeight - overlaySize - 15;
      
      this.previewRenderer.clippingPlanes = [];
      this.previewRenderer.setViewport(overlayX, overlayY, overlaySize, overlaySize);
      this.previewRenderer.setScissor(overlayX, overlayY, overlaySize, overlaySize);
      this.previewRenderer.render(coronalSummaryScene, coronalSummaryCamera);
      
      // Update CSS border position
      this.updateSummaryBorder(overlayX, overlayY, overlaySize, 'coronal-summary-gizmo-border');
    }
    
    // === RIGHT BOTTOM THIRD: Sagittal Slab (Thin left-to-right slice) ===
    this.previewRenderer.clippingPlanes = sagittalClipPlanes || [];
    this.previewRenderer.setViewport(halfWidth, 0, halfWidth, thirdHeight);
    this.previewRenderer.setScissor(halfWidth, 0, halfWidth, thirdHeight);
    this.previewRenderer.render(previewScene, sagittalCamera);
    
    // Overlay: Sagittal Summary Gizmo (top-left corner of sagittal, square viewport)
    if (sagittalSummaryScene && sagittalSummaryCamera) {
      const overlaySize = Math.min(thirdHeight, halfWidth) * 0.55;
      const overlayX = halfWidth + 15;
      const overlayY = thirdHeight - overlaySize - 15;
      
      this.previewRenderer.clippingPlanes = [];
      this.previewRenderer.setViewport(overlayX, overlayY, overlaySize, overlaySize);
      this.previewRenderer.setScissor(overlayX, overlayY, overlaySize, overlaySize);
      this.previewRenderer.render(sagittalSummaryScene, sagittalSummaryCamera);
      
      // Update CSS border position
      this.updateSummaryBorder(overlayX, overlayY, overlaySize, 'sagittal-summary-gizmo-border');
    }
    
    // Clear clipping planes and disable scissor test for work viewport
    this.previewRenderer.clippingPlanes = [];
    this.previewRenderer.setScissorTest(false);
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
   * Update summary gizmo border position
   * @param {number} x - X position in pixels
   * @param {number} y - Y position in pixels
   * @param {number} size - Size in pixels
   * @param {string} elementId - ID of the border element
   */
  updateSummaryBorder(x, y, size, elementId) {
    const border = document.getElementById(elementId);
    if (border) {
      const previewHeight = window.innerHeight * 0.7;
      const canvasWidth = previewHeight * 1.6; // 1.6:1 aspect ratio
      const windowWidth = window.innerWidth;
      const canvasOffsetX = (windowWidth - canvasWidth) / 2; // Canvas is centered
      
      // Convert from WebGL coordinates (bottom-left origin) to CSS coordinates (top-left origin)
      const cssY = previewHeight - y - size;
      const cssX = canvasOffsetX + x;
      
      border.style.left = `${cssX}px`;
      border.style.top = `${cssY}px`;
      border.style.width = `${size}px`;
      border.style.height = `${size}px`;
    }
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
