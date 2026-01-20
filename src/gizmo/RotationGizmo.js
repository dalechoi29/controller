import * as THREE from 'three';

/**
 * Rotation Gizmo - Axis-based rotation control
 * Provides visual rotation rings for X, Y, and Z axes
 */
export class RotationGizmo {
  constructor(targetObject, options = {}) {
    this.target = targetObject;
    this.mesh = new THREE.Group();
    
    // Configuration
    this.config = {
      radius: options.radius || 2.5,           // Ring radius
      tubeRadius: options.tubeRadius || 0.04,  // Ring thickness (balanced for visibility and aesthetics)
      segments: options.segments || 64,        // Smoothness
      opacity: options.opacity || 0.6,         // Base opacity
      hoverOpacity: options.hoverOpacity || 1.0 // Hover opacity
    };

    // Rotation mode: 'world' or 'local'
    this.rotationMode = options.rotationMode || 'world';

    // Axis ring meshes
    this.axes = {
      x: this.createAxisRing('x', 0xff0000),
      y: this.createAxisRing('y', 0x00ff00),
      z: this.createAxisRing('z', 0x0000ff)
    };

    // Add all rings to the gizmo group
    this.mesh.add(this.axes.x.mesh);
    this.mesh.add(this.axes.y.mesh);
    this.mesh.add(this.axes.z.mesh);

    // Create text labels for each axis
    this.labels = {
      x: this.createAxisLabel('X', 0xff0000, new THREE.Vector3(this.config.radius + 0.5, 0, 0)),
      y: this.createAxisLabel('Y', 0x00ff00, new THREE.Vector3(0, this.config.radius + 0.5, 0)),
      z: this.createAxisLabel('Z', 0x0000ff, new THREE.Vector3(0, 0, this.config.radius + 0.5))
    };

    // Add labels to the gizmo group
    this.mesh.add(this.labels.x);
    this.mesh.add(this.labels.y);
    this.mesh.add(this.labels.z);

    // Create highlight planes for each axis
    this.highlightPlanes = {
      x: this.createHighlightPlane('x', 0xff0000),
      y: this.createHighlightPlane('y', 0x00ff00),
      z: this.createHighlightPlane('z', 0x0000ff)
    };

    // Add highlight planes (initially hidden)
    this.mesh.add(this.highlightPlanes.x);
    this.mesh.add(this.highlightPlanes.y);
    this.mesh.add(this.highlightPlanes.z);
    
    this.highlightPlanes.x.visible = false;
    this.highlightPlanes.y.visible = false;
    this.highlightPlanes.z.visible = false;

    // State tracking
    this.activeAxis = null;
    this.hoveredAxis = null;
    this.isRotating = false;

    console.log('✓ Rotation Gizmo created with 3 axis rings and labels');
  }

  /**
   * Create an axis ring with proper geometry and material
   * @param {string} axisName - Axis name ('x', 'y', 'z')
   * @param {number} color - Hex color for the axis
   * @returns {Object} - Axis data object
   */
  createAxisRing(axisName, color) {
    // Create torus geometry for the rotation ring
    const geometry = new THREE.TorusGeometry(
      this.config.radius,      // Radius of the torus
      this.config.tubeRadius,  // Tube thickness
      16,                      // Radial segments (cross-section)
      this.config.segments     // Tubular segments (around the ring)
    );

    // Create material with emissive properties for visibility
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: this.config.opacity,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false
    });

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    
    // Rotate ring to align with the correct axis
    if (axisName === 'x') {
      // X-axis: rotate to face along X
      mesh.rotation.y = Math.PI / 2;
    } else if (axisName === 'y') {
      // Y-axis: already upright, rotate to face along Y
      mesh.rotation.x = Math.PI / 2;
    } else if (axisName === 'z') {
      // Z-axis: already faces along Z (no rotation needed)
    }

    // Store axis direction vector
    const axisVector = new THREE.Vector3();
    if (axisName === 'x') axisVector.set(1, 0, 0);
    if (axisName === 'y') axisVector.set(0, 1, 0);
    if (axisName === 'z') axisVector.set(0, 0, 1);

    // Store reference for raycasting (Phase 3)
    mesh.userData = {
      type: 'gizmo-axis',
      axis: axisName,
      axisVector: axisVector
    };

    return {
      name: axisName,
      mesh: mesh,
      material: material,
      color: color,
      axisVector: axisVector
    };
  }

  /**
   * Create a text label sprite for an axis with colored circle background
   * @param {string} text - Text to display (e.g., 'X', 'Y', 'Z')
   * @param {number} color - Hex color for the circle background
   * @param {THREE.Vector3} position - Position relative to gizmo center
   * @returns {THREE.Sprite} - Text sprite
   */
  createAxisLabel(text, color, position) {
    // Create canvas for text rendering
    const canvas = document.createElement('canvas');
    const size = 256;  // Larger canvas for better quality
    canvas.width = size;
    canvas.height = size;
    
    const context = canvas.getContext('2d');
    
    // Clear canvas
    context.clearRect(0, 0, size, size);
    
    // Draw colored circle background
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = 100;  // Larger radius
    
    // Use darker colors for better contrast with white text
    let darkColor;
    if (color === 0xff0000) {
      darkColor = '#CC0000';  // Darker red
    } else if (color === 0x00ff00) {
      darkColor = '#009900';  // Darker green (much better contrast)
    } else if (color === 0x0000ff) {
      darkColor = '#0000CC';  // Darker blue
    } else {
      darkColor = '#' + color.toString(16).padStart(6, '0');
    }
    
    // Create circle with darker color for contrast
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = darkColor;
    context.fill();
    
    // Add subtle border to circle
    context.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    context.lineWidth = 3;
    context.stroke();
    
    // Draw large white text on top of circle
    context.font = 'Bold 140px Arial';  // Much larger font
    context.fillStyle = '#FFFFFF';  // White text
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Add shadow for depth
    context.shadowColor = 'rgba(0, 0, 0, 0.6)';
    context.shadowBlur = 4;
    context.shadowOffsetX = 2;
    context.shadowOffsetY = 2;
    
    // Draw text
    context.fillText(text, centerX, centerY);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create sprite material
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,  // Always visible on top
      depthWrite: false
    });
    
    // Create sprite
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.scale.set(1.0, 1.0, 1.0);  // Larger scale for better visibility
    
    // Mark as label (now pickable for interaction!)
    sprite.userData = {
      type: 'gizmo-label',
      axis: text.toLowerCase(),
      axisVector: this.axes[text.toLowerCase()].axisVector  // Same as ring
    };
    
    return sprite;
  }

  /**
   * Create a transparent highlight plane for an axis
   * @param {string} axisName - Axis name ('x', 'y', 'z')
   * @param {number} color - Hex color for the plane
   * @returns {THREE.Mesh} - Highlight plane
   */
  createHighlightPlane(axisName, color) {
    // Create circular plane matching gizmo radius
    const geometry = new THREE.CircleGeometry(this.config.radius, 64);
    
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const plane = new THREE.Mesh(geometry, material);
    
    // Rotate plane to align with axis
    if (axisName === 'x') {
      plane.rotation.y = Math.PI / 2;  // YZ plane
    } else if (axisName === 'y') {
      plane.rotation.x = Math.PI / 2;  // XZ plane
    }
    // Z-axis plane is already XY (no rotation needed)

    return plane;
  }

  /**
   * Update gizmo position and orientation
   */
  update() {
    if (this.target) {
      // Position gizmo at target object's position
      this.mesh.position.copy(this.target.position);
      
      // In local mode, gizmo rotates with the object
      if (this.rotationMode === 'local') {
        this.mesh.quaternion.copy(this.target.quaternion);
      } else {
        // In world mode, gizmo stays aligned with world axes
        this.mesh.quaternion.identity();
      }
    }
  }

  /**
   * Set rotation mode (world or local)
   * @param {string} mode - 'world' or 'local'
   */
  setRotationMode(mode) {
    if (mode === 'world' || mode === 'local') {
      this.rotationMode = mode;
      console.log(`🌍 Rotation mode: ${mode.toUpperCase()}`);
    }
  }

  /**
   * Get current axis vector in world space
   * @param {string} axisName - Axis name ('x', 'y', 'z')
   * @returns {THREE.Vector3} - Axis vector in world space
   */
  getWorldAxisVector(axisName) {
    const axis = this.axes[axisName];
    if (!axis) return null;

    if (this.rotationMode === 'local') {
      // Transform local axis to world space
      const worldAxis = axis.axisVector.clone();
      worldAxis.applyQuaternion(this.target.quaternion);
      return worldAxis.normalize();
    } else {
      // Already in world space
      return axis.axisVector.clone();
    }
  }

  /**
   * Set hover state for an axis
   * @param {string|null} axisName - Axis name or null
   */
  setHoverAxis(axisName) {
    // Don't change hover state if we're actively rotating
    if (this.isRotating) return;

    this.hoveredAxis = axisName;

    if (axisName) {
      // Highlight hovered axis, dim others
      Object.keys(this.axes).forEach(key => {
        if (key === axisName) {
          // Brighten hovered axis
          this.axes[key].material.opacity = this.config.hoverOpacity;
          // Show highlight plane
          this.highlightPlanes[key].visible = true;
          // Keep label normal
          this.labels[key].material.opacity = 1.0;
        } else {
          // Dim other axes
          this.axes[key].material.opacity = this.config.opacity * 0.3;
          // Hide other planes
          this.highlightPlanes[key].visible = false;
          // Dim other labels
          this.labels[key].material.opacity = 0.3;
        }
      });
      console.log(`🎨 Highlighting ${axisName.toUpperCase()}-axis (hover)`);
    } else {
      // Reset all to default
      Object.keys(this.axes).forEach(key => {
        this.axes[key].material.opacity = this.config.opacity;
        this.highlightPlanes[key].visible = false;
        this.labels[key].material.opacity = 1.0;
      });
    }
  }

  /**
   * Set active axis for rotation
   * @param {string|null} axisName - Axis name or null
   */
  setActiveAxis(axisName) {
    this.isRotating = true;
    this.activeAxis = axisName;

    // Dim all axes and labels
    Object.keys(this.axes).forEach(key => {
      if (key === axisName) {
        // Brighten active axis
        this.axes[key].material.opacity = this.config.hoverOpacity;
        // Show highlight plane
        this.highlightPlanes[key].visible = true;
        // Keep label bright
        this.labels[key].material.opacity = 1.0;
      } else {
        // Dim other axes
        this.axes[key].material.opacity = this.config.opacity * 0.2;
        // Hide other planes
        this.highlightPlanes[key].visible = false;
        // Dim other labels
        this.labels[key].material.opacity = 0.2;
      }
    });

    if (axisName) {
      console.log(`🔒 Locked ${axisName.toUpperCase()}-axis (active)`);
    }
  }

  /**
   * Clear active axis (end rotation)
   */
  clearActiveAxis() {
    // Restore all axes, planes, and labels to default
    Object.keys(this.axes).forEach(key => {
      this.axes[key].material.opacity = this.config.opacity;
      this.highlightPlanes[key].visible = false;
      this.labels[key].material.opacity = 1.0;
    });
    
    this.activeAxis = null;
    this.isRotating = false;
  }

  /**
   * Get all gizmo meshes for raycasting (including labels)
   * @returns {Array<THREE.Object3D>}
   */
  getPickingMeshes() {
    return [
      this.axes.x.mesh,
      this.axes.y.mesh,
      this.axes.z.mesh,
      this.labels.x,  // Labels are now interactive
      this.labels.y,
      this.labels.z
    ];
  }

  /**
   * Get the gizmo's Three.js group
   * @returns {THREE.Group}
   */
  getMesh() {
    return this.mesh;
  }

  /**
   * Apply a visual style to the gizmo
   * @param {string} styleName - 'circular' or 'linear'
   */
  applyStyle(styleName) {
    console.log(`🎨 Applying style: ${styleName}`);
    
    if (styleName === 'circular') {
      this.applyCircularStyle();
    } else if (styleName === 'linear') {
      this.applyLinearStyle();
    } else {
      console.warn(`Unknown style: ${styleName}, defaulting to circular`);
      this.applyCircularStyle();
    }
  }

  /**
   * Circular style - shows ring gizmos
   */
  applyCircularStyle() {
    // Show circular rings
    this.axes.x.mesh.visible = true;
    this.axes.y.mesh.visible = true;
    this.axes.z.mesh.visible = true;
    
    // Hide linear lines if they exist
    if (this.linearLines) {
      this.linearLines.x.visible = false;
      this.linearLines.y.visible = false;
      this.linearLines.z.visible = false;
    }
    
    // Labels stay visible (they're common to both styles)
    this.labels.x.visible = true;
    this.labels.y.visible = true;
    this.labels.z.visible = true;
    
    console.log('✓ Circular style applied');
  }

  /**
   * Linear style - shows straight axis lines instead of rings
   */
  applyLinearStyle() {
    // Hide circular rings
    this.axes.x.mesh.visible = false;
    this.axes.y.mesh.visible = false;
    this.axes.z.mesh.visible = false;
    
    // Create linear lines if they don't exist yet
    if (!this.linearLines) {
      this.createLinearLines();
    }
    
    // Show linear lines
    this.linearLines.x.visible = true;
    this.linearLines.y.visible = true;
    this.linearLines.z.visible = true;
    
    // Labels stay visible
    this.labels.x.visible = true;
    this.labels.y.visible = true;
    this.labels.z.visible = true;
    
    console.log('✓ Linear style applied');
  }

  /**
   * Create straight axis lines for linear style
   */
  createLinearLines() {
    this.linearLines = {};
    
    const lineLength = this.config.radius + 0.5; // Extend to label position
    const lineWidth = 0.04;
    
    // X-axis line (red)
    const xGeometry = new THREE.CylinderGeometry(lineWidth, lineWidth, lineLength, 16);
    const xMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      transparent: true,
      opacity: 0.8
    });
    const xLine = new THREE.Mesh(xGeometry, xMaterial);
    xLine.rotation.z = -Math.PI / 2;
    xLine.position.x = lineLength / 2;
    this.linearLines.x = xLine;
    this.mesh.add(xLine);
    
    // Y-axis line (green)
    const yGeometry = new THREE.CylinderGeometry(lineWidth, lineWidth, lineLength, 16);
    const yMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8
    });
    const yLine = new THREE.Mesh(yGeometry, yMaterial);
    yLine.position.y = lineLength / 2;
    this.linearLines.y = yLine;
    this.mesh.add(yLine);
    
    // Z-axis line (blue)
    const zGeometry = new THREE.CylinderGeometry(lineWidth, lineWidth, lineLength, 16);
    const zMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x0000ff,
      transparent: true,
      opacity: 0.8
    });
    const zLine = new THREE.Mesh(zGeometry, zMaterial);
    zLine.rotation.x = Math.PI / 2;
    zLine.position.z = lineLength / 2;
    this.linearLines.z = zLine;
    this.mesh.add(zLine);
    
    // Initially hide them (circular is default)
    this.linearLines.x.visible = false;
    this.linearLines.y.visible = false;
    this.linearLines.z.visible = false;
    
    console.log('✓ Linear axis lines created');
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Dispose axis rings
    Object.keys(this.axes).forEach(key => {
      const axis = this.axes[key];
      axis.mesh.geometry.dispose();
      axis.material.dispose();
    });
    
    // Dispose labels
    if (this.labels) {
      Object.keys(this.labels).forEach(key => {
        const label = this.labels[key];
        if (label.material.map) {
          label.material.map.dispose();
        }
        label.material.dispose();
      });
    }
  }
}

