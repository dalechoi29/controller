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

    // Store axis colors for hover highlighting
    this.axisColors = {
      x: 0xff3333,  // Red
      y: 0x44ff44,  // Green
      z: 0x4444ff   // Blue
    };
    
    this.defaultColor = 0x888888;  // Stronger gray for inactive state

    // Axis ring meshes (default gray, colored on hover)
    this.axes = {
      x: this.createAxisRing('x', this.defaultColor),
      y: this.createAxisRing('y', this.defaultColor),
      z: this.createAxisRing('z', this.defaultColor)
    };

    // Add all rings to the gizmo group
    this.mesh.add(this.axes.x.mesh);
    this.mesh.add(this.axes.y.mesh);
    this.mesh.add(this.axes.z.mesh);

    // Create text labels for each axis
    // Position beyond the sphere/cube so they're clickable
    const labelDistance = this.config.radius + 0.5; // Beyond sphere radius (2.5 + 0.5 = 3.0)
    this.labels = {
      x: this.createAxisLabel('X', 0xff0000, new THREE.Vector3(labelDistance, 0, 0)),
      y: this.createAxisLabel('Y', 0x00ff00, new THREE.Vector3(0, labelDistance, 0)),
      z: this.createAxisLabel('Z', 0x0000ff, new THREE.Vector3(0, 0, labelDistance))
    };

    // Add labels to the gizmo group
    this.mesh.add(this.labels.x);
    this.mesh.add(this.labels.y);
    this.mesh.add(this.labels.z);

    // Create circular highlight planes for each axis
    this.highlightPlanes = {
      x: this.createHighlightPlane('x', 0xff0000, 'circle'),
      y: this.createHighlightPlane('y', 0x00ff00, 'circle'),
      z: this.createHighlightPlane('z', 0x0000ff, 'circle')
    };

    // Create square highlight planes for cube style
    this.squareHighlightPlanes = {
      x: this.createHighlightPlane('x', 0xff0000, 'square'),
      y: this.createHighlightPlane('y', 0x00ff00, 'square'),
      z: this.createHighlightPlane('z', 0x0000ff, 'square')
    };

    // Add highlight planes (initially hidden)
    this.mesh.add(this.highlightPlanes.x);
    this.mesh.add(this.highlightPlanes.y);
    this.mesh.add(this.highlightPlanes.z);
    this.mesh.add(this.squareHighlightPlanes.x);
    this.mesh.add(this.squareHighlightPlanes.y);
    this.mesh.add(this.squareHighlightPlanes.z);
    
    this.highlightPlanes.x.visible = false;
    this.highlightPlanes.y.visible = false;
    this.highlightPlanes.z.visible = false;
    this.squareHighlightPlanes.x.visible = false;
    this.squareHighlightPlanes.y.visible = false;
    this.squareHighlightPlanes.z.visible = false;

    // State tracking
    this.activeAxis = null;
    this.hoveredAxis = null;
    this.isRotating = false;
    this.currentStyle = 'cube';  // Track current style (default is cube)

    console.log('✓ Rotation Gizmo created with 3 axis rings and labels');
  }

  /**
   * Create an axis ring with proper geometry and material
   * @param {string} axisName - Axis name ('x', 'y', 'z')
   * @param {number} color - Hex color for the axis
   * @returns {Object} - Axis data object
   */
  createAxisRing(axisName, color) {
    // Create a circle curve for the ring path
    const curve = new THREE.EllipseCurve(
      0, 0,                    // Center
      this.config.radius,      // X radius
      this.config.radius,      // Y radius
      0, 2 * Math.PI,          // Start angle, end angle
      false,                   // Clockwise
      0                        // Rotation
    );
    
    // Get points along the curve
    const points = curve.getPoints(this.config.segments);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create dashed line material for dotted appearance
    const material = new THREE.LineDashedMaterial({
      color: color,
      transparent: true,
      opacity: this.config.opacity,
      dashSize: 0.3,           // Longer dashes for better visibility
      gapSize: 0.2,            // Shorter gaps
      linewidth: 3,            // Thicker line
      depthTest: true,
      depthWrite: true
    });

    // Create line and compute line distances for dashing
    const mesh = new THREE.Line(geometry, material);
    mesh.computeLineDistances();
    
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
    // Create canvas for text rendering (larger for better touch targets)
    const canvas = document.createElement('canvas');
    const size = 320;  // Even larger canvas for bigger buttons
    canvas.width = size;
    canvas.height = size;
    
    const context = canvas.getContext('2d');
    
    // Clear canvas
    context.clearRect(0, 0, size, size);
    
    // Draw colored circle background
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = 130;  // Bigger radius for better touch interaction
    
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
    context.font = 'Bold 180px Arial';  // Even larger font for bigger buttons
    context.fillStyle = '#FFFFFF';  // White text
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Add shadow for depth
    context.shadowColor = 'rgba(0, 0, 0, 0.6)';
    context.shadowBlur = 5;
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
    sprite.scale.set(1.4, 1.4, 1.4);  // Much larger scale for better touch interaction
    
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
   * @param {string} shape - 'circle' or 'square'
   * @returns {THREE.Mesh} - Highlight plane
   */
  createHighlightPlane(axisName, color, shape = 'circle') {
    // Create geometry based on shape
    let geometry;
    if (shape === 'square') {
      const size = this.config.radius * 1.2;  // Slightly larger than label
      geometry = new THREE.PlaneGeometry(size, size);
    } else {
      geometry = new THREE.CircleGeometry(this.config.radius, 64);
    }
    
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
        // Brighten and color hovered axis (rings or square frames)
        this.axes[key].material.opacity = this.config.hoverOpacity;
        this.axes[key].material.color.setHex(this.axisColors[key]);
        if (this.squareFrames && this.squareFrames[key]) {
          // Square frames are groups with multiple meshes
          this.squareFrames[key].children.forEach(mesh => {
            mesh.material.opacity = this.config.hoverOpacity;
            mesh.material.color.setHex(this.axisColors[key]);
          });
        }
          // Show appropriate highlight plane based on current style
          if (this.currentStyle === 'cube') {
            this.squareHighlightPlanes[key].visible = true;
            this.highlightPlanes[key].visible = false;
          } else {
            this.highlightPlanes[key].visible = true;
            this.squareHighlightPlanes[key].visible = false;
          }
          // Keep label normal
          this.labels[key].material.opacity = 1.0;
      } else {
        // Dim other axes and keep them gray
        this.axes[key].material.opacity = this.config.opacity * 0.3;
        this.axes[key].material.color.setHex(this.defaultColor);
        if (this.squareFrames && this.squareFrames[key]) {
          // Square frames are groups with multiple meshes
          this.squareFrames[key].children.forEach(mesh => {
            mesh.material.opacity = this.config.opacity * 0.3;
            mesh.material.color.setHex(this.defaultColor);
          });
        }
          // Hide other planes
          this.highlightPlanes[key].visible = false;
          this.squareHighlightPlanes[key].visible = false;
          // Dim other labels
          this.labels[key].material.opacity = 0.3;
        }
      });
      console.log(`🎨 Highlighting ${axisName.toUpperCase()}-axis (hover)`);
    } else {
      // Reset all to default (gray, normal opacity)
      Object.keys(this.axes).forEach(key => {
        this.axes[key].material.opacity = this.config.opacity;
        this.axes[key].material.color.setHex(this.defaultColor);
        if (this.squareFrames && this.squareFrames[key]) {
          // Square frames are groups with multiple meshes
          this.squareFrames[key].children.forEach(mesh => {
            mesh.material.opacity = this.config.opacity;
            mesh.material.color.setHex(this.defaultColor);
          });
        }
        this.highlightPlanes[key].visible = false;
        this.squareHighlightPlanes[key].visible = false;
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
        // Brighten and color active axis (rings or square frames)
        this.axes[key].material.opacity = this.config.hoverOpacity;
        this.axes[key].material.color.setHex(this.axisColors[key]);
        if (this.squareFrames && this.squareFrames[key]) {
          // Square frames are groups with multiple meshes
          this.squareFrames[key].children.forEach(mesh => {
            mesh.material.opacity = this.config.hoverOpacity;
            mesh.material.color.setHex(this.axisColors[key]);
          });
        }
        // Show appropriate highlight plane
        if (this.currentStyle === 'cube') {
          this.squareHighlightPlanes[key].visible = true;
          this.highlightPlanes[key].visible = false;
        } else {
          this.highlightPlanes[key].visible = true;
          this.squareHighlightPlanes[key].visible = false;
        }
        // Keep label bright
        this.labels[key].material.opacity = 1.0;
      } else {
        // Dim other axes and keep them gray
        this.axes[key].material.opacity = this.config.opacity * 0.2;
        this.axes[key].material.color.setHex(this.defaultColor);
        if (this.squareFrames && this.squareFrames[key]) {
          // Square frames are groups with multiple meshes
          this.squareFrames[key].children.forEach(mesh => {
            mesh.material.opacity = this.config.opacity * 0.2;
            mesh.material.color.setHex(this.defaultColor);
          });
        }
        // Hide other planes
        this.highlightPlanes[key].visible = false;
        this.squareHighlightPlanes[key].visible = false;
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
    // Restore all axes, planes, and labels to default (gray)
    Object.keys(this.axes).forEach(key => {
      this.axes[key].material.opacity = this.config.opacity;
      this.axes[key].material.color.setHex(this.defaultColor);
      if (this.squareFrames && this.squareFrames[key]) {
        // Square frames are groups with multiple meshes
        this.squareFrames[key].children.forEach(mesh => {
          mesh.material.opacity = this.config.opacity;
          mesh.material.color.setHex(this.defaultColor);
        });
      }
      this.highlightPlanes[key].visible = false;
      this.squareHighlightPlanes[key].visible = false;
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
    const meshes = [
      this.labels.x,  // Labels are always interactive
      this.labels.y,
      this.labels.z
    ];
    
    // Add appropriate axis meshes based on current style
    if (this.currentStyle === 'cube') {
      // In cube mode, use square frames and cube planes for picking
      if (this.squareFrames) {
        meshes.push(this.squareFrames.x, this.squareFrames.y, this.squareFrames.z);
      }
      if (this.cubePlanes) {
        meshes.push(this.cubePlanes.x, this.cubePlanes.y, this.cubePlanes.z);
      }
    } else if (this.currentStyle === 'linear') {
      // In linear mode, use linear lines
      if (this.linearLines) {
        meshes.push(this.linearLines.x, this.linearLines.y, this.linearLines.z);
      }
    } else {
      // In circular mode, use circular rings
      meshes.push(this.axes.x.mesh, this.axes.y.mesh, this.axes.z.mesh);
    }
    
    return meshes;
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
   * @param {string} styleName - 'circular', 'linear', or 'cube'
   */
  applyStyle(styleName) {
    console.log(`🎨 Applying style: ${styleName}`);
    
    this.currentStyle = styleName;  // Track current style
    
    if (styleName === 'circular') {
      this.applyCircularStyle();
    } else if (styleName === 'linear') {
      this.applyLinearStyle();
    } else if (styleName === 'cube') {
      this.applyCubeStyle();
    } else {
      console.warn(`Unknown style: ${styleName}, defaulting to circular`);
      this.applyCircularStyle();
    }
  }

  /**
   * Circular style - shows ring gizmos
   */
  applyCircularStyle() {
    // Show circular rings for all axes (Y ring will be movable for XZ plane)
    this.axes.x.mesh.visible = true;
    this.axes.y.mesh.visible = true; // Show Y circular ring (movable XZ plane)
    this.axes.z.mesh.visible = true;
    
    // Hide linear lines if they exist
    if (this.linearLines) {
      this.linearLines.x.visible = false;
      this.linearLines.y.visible = false;
      this.linearLines.z.visible = false;
    }
    
    // Hide cube planes if they exist
    if (this.cubePlanes) {
      this.cubePlanes.x.visible = false;
      this.cubePlanes.y.visible = false;
      this.cubePlanes.z.visible = false;
    }
    
    // Keep square frames for interaction but hide them visually
    // (Y frame still provides interaction for dragging)
    if (this.squareFrames) {
      this.squareFrames.x.visible = false;
      this.squareFrames.y.visible = false; // Hidden but still used for interaction
      this.squareFrames.z.visible = false;
    }
    
    // Hide cube axis lines if they exist
    if (this.cubeAxisLines) {
      this.cubeAxisLines.x.visible = false;
      this.cubeAxisLines.y.visible = false;
      this.cubeAxisLines.z.visible = false;
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
    
    // Hide cube planes if they exist
    if (this.cubePlanes) {
      this.cubePlanes.x.visible = false;
      this.cubePlanes.y.visible = false;
      this.cubePlanes.z.visible = false;
    }
    
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
    
    // Extend lines to reach the buttons (radius + 0.5 = 3.0)
    const lineLength = this.config.radius + 0.5;
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
   * Cube style - shows square frames and long axis lines
   */
  applyCubeStyle() {
    // Hide circular rings
    this.axes.x.mesh.visible = false;
    this.axes.y.mesh.visible = false;
    this.axes.z.mesh.visible = false;
    
    // Create and show long linear lines (extending to labels)
    if (!this.linearLines) {
      this.createLinearLines();
    }
    this.linearLines.x.visible = true;
    this.linearLines.y.visible = true;
    this.linearLines.z.visible = true;
    
    // Hide short cube axis lines (we're using long lines now)
    if (this.cubeAxisLines) {
      this.cubeAxisLines.x.visible = false;
      this.cubeAxisLines.y.visible = false;
      this.cubeAxisLines.z.visible = false;
    }
    
    // Create and show square frames for cube style (now smaller)
    if (!this.squareFrames) {
      this.createSquareAxisFrames();
    }
    this.squareFrames.x.visible = true;
    this.squareFrames.y.visible = true;
    this.squareFrames.z.visible = true;
    
    // Create cube planes if they don't exist yet
    if (!this.cubePlanes) {
      this.createCubePlanes();
    }
    
    // Keep cube planes for raycasting but make them invisible
    this.cubePlanes.x.visible = true;
    this.cubePlanes.y.visible = true;
    this.cubePlanes.z.visible = true;
    this.cubePlanes.x.material.opacity = 0;  // Invisible
    this.cubePlanes.y.material.opacity = 0;  // Invisible
    this.cubePlanes.z.material.opacity = 0;  // Invisible
    
    // Labels stay visible
    this.labels.x.visible = true;
    this.labels.y.visible = true;
    this.labels.z.visible = true;
    
    console.log('✓ Cube style applied');
  }

  /**
   * Create short axis lines for cube style (only to edge of cube)
   */
  createCubeAxisLines() {
    this.cubeAxisLines = {};
    
    const lineLength = 1.95;  // Half the cube size (3.9 / 2)
    const lineWidth = 0.03;
    
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
    this.cubeAxisLines.x = xLine;
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
    this.cubeAxisLines.y = yLine;
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
    this.cubeAxisLines.z = zLine;
    this.mesh.add(zLine);
    
    // Initially hide them
    this.cubeAxisLines.x.visible = false;
    this.cubeAxisLines.y.visible = false;
    this.cubeAxisLines.z.visible = false;
    
    console.log('✓ Cube axis lines created');
  }

  /**
   * Create square axis frames (like square rings) for cube style
   */
  createSquareAxisFrames() {
    this.squareFrames = {};
    
    const size = 3.6; // Smaller than labels (at ~2.05), larger than axis lines (at 1.75)
    const halfSize = size / 2;
    const tubeRadius = 0.035; // Thickness of the square frame lines (proportionally thicker)
    
    // Helper function to create a thick square wireframe using tubes
    const createSquareFrame = (color, axisName) => {
      const group = new THREE.Group();
      
      // Create 4 edges of the square using cylinders (tubes)
      const edges = [
        // Bottom edge
        { start: new THREE.Vector3(-halfSize, -halfSize, 0), end: new THREE.Vector3(halfSize, -halfSize, 0) },
        // Right edge
        { start: new THREE.Vector3(halfSize, -halfSize, 0), end: new THREE.Vector3(halfSize, halfSize, 0) },
        // Top edge
        { start: new THREE.Vector3(halfSize, halfSize, 0), end: new THREE.Vector3(-halfSize, halfSize, 0) },
        // Left edge
        { start: new THREE.Vector3(-halfSize, halfSize, 0), end: new THREE.Vector3(-halfSize, -halfSize, 0) }
      ];
      
      const material = new THREE.LineDashedMaterial({
        color: color,
        transparent: true,
        opacity: this.config.opacity,
        dashSize: 0.3,           // Longer dashes for better visibility
        gapSize: 0.2,            // Shorter gaps
        linewidth: 3,
        depthTest: true,
        depthWrite: true
      });
      
      edges.forEach(edge => {
        const points = [edge.start, edge.end];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material.clone());
        line.computeLineDistances();
        
        group.add(line);
      });
      
      // Store reference for raycasting
      group.userData = {
        type: 'gizmo-axis',
        axis: axisName,
        axisVector: axisName === 'x' ? new THREE.Vector3(1, 0, 0) :
                    axisName === 'y' ? new THREE.Vector3(0, 1, 0) :
                    new THREE.Vector3(0, 0, 1)
      };
      
      return group;
    };
    
    // X-axis square frame (YZ plane) - Default gray (colored on hover)
    this.squareFrames.x = createSquareFrame(this.defaultColor, 'x');
    this.squareFrames.x.rotation.y = Math.PI / 2;
    this.mesh.add(this.squareFrames.x);
    
    // Y-axis square frame (XZ plane) - Default gray (colored on hover)
    this.squareFrames.y = createSquareFrame(this.defaultColor, 'y');
    this.squareFrames.y.rotation.x = Math.PI / 2;
    this.mesh.add(this.squareFrames.y);
    
    // Z-axis square frame (XY plane) - Default gray (colored on hover)
    this.squareFrames.z = createSquareFrame(this.defaultColor, 'z');
    this.mesh.add(this.squareFrames.z);
    
    // Initially hide them
    this.squareFrames.x.visible = false;
    this.squareFrames.y.visible = false;
    this.squareFrames.z.visible = false;
    
    console.log('✓ Square axis frames created');
  }

  /**
   * Create square planes for cube style
   */
  createCubePlanes() {
    this.cubePlanes = {};
    
    const planeSize = this.config.radius * 0.7; // Size of the square planes
    const distance = this.config.radius; // Distance from center
    
    // === X-AXIS PLANE (YZ plane) ===
    const xGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const xMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false
    });
    const xPlane = new THREE.Mesh(xGeometry, xMaterial);
    xPlane.rotation.y = Math.PI / 2; // Face along X-axis
    xPlane.position.x = distance;
    xPlane.userData = {
      type: 'gizmo-axis',
      axis: 'x',
      axisVector: new THREE.Vector3(1, 0, 0)
    };
    this.cubePlanes.x = xPlane;
    this.mesh.add(xPlane);
    
    // === Y-AXIS PLANE (XZ plane) ===
    const yGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const yMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false
    });
    const yPlane = new THREE.Mesh(yGeometry, yMaterial);
    yPlane.rotation.x = Math.PI / 2; // Face along Y-axis
    yPlane.position.y = distance;
    yPlane.userData = {
      type: 'gizmo-axis',
      axis: 'y',
      axisVector: new THREE.Vector3(0, 1, 0)
    };
    this.cubePlanes.y = yPlane;
    this.mesh.add(yPlane);
    
    // === Z-AXIS PLANE (XY plane) ===
    const zGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const zMaterial = new THREE.MeshBasicMaterial({
      color: 0x0000ff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false
    });
    const zPlane = new THREE.Mesh(zGeometry, zMaterial);
    zPlane.position.z = distance;
    zPlane.userData = {
      type: 'gizmo-axis',
      axis: 'z',
      axisVector: new THREE.Vector3(0, 0, 1)
    };
    this.cubePlanes.z = zPlane;
    this.mesh.add(zPlane);
    
    // Initially hide them (circular is default)
    this.cubePlanes.x.visible = false;
    this.cubePlanes.y.visible = false;
    this.cubePlanes.z.visible = false;
    
    console.log('✓ Cube style planes created');
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

