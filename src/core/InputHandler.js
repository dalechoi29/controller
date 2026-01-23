import * as THREE from 'three';
import { rayPlaneIntersection, signedAngle, quaternionFromAxisAngle, createRotationPlane } from '../utils/MathUtils.js';

/**
 * Input Handler - Manages mouse interactions with the 3D scene
 * Handles raycasting, axis picking, and user input events
 */
export class InputHandler {
  constructor(camera, domElement, gizmo, app = null) {
    this.camera = camera;
    this.domElement = domElement;
    this.gizmo = gizmo;
    this.app = app; // Reference to main app for slice control

    // Raycasting setup
    this.raycaster = new THREE.Raycaster();
    // Increase threshold for easier picking of thin geometries
    this.raycaster.params.Points.threshold = 0.5;
    this.raycaster.params.Line.threshold = 0.5;
    this.mouse = new THREE.Vector2();
    
    // Debug mode
    this.debugMode = true;

    // Stability settings (Phase 5)
    this.config = {
      minAngleThreshold: 0.001,  // Dead zone: ignore tiny rotations (radians)
      maxCameraAlignmentDot: 0.99  // Threshold for camera-axis alignment detection
    };

    // State tracking
    this.isDragging = false;
    this.hoveredAxis = null;
    this.selectedAxis = null;
    this.isCameraRotating = false;  // Track camera rotation to prevent hover flicker
    
    // For detecting click vs drag
    this.mouseDownPosition = new THREE.Vector2();
    this.mouseDownTime = 0;
    
    // Track if we hit a label vs a ring
    this.hitType = null; // 'label' or 'ring'

    // Rotation state (Phase 4)
    this.rotationPlane = null;
    this.initialHitPoint = null;
    this.initialRotation = null;
    this.currentAxisVector = null;

    // Callbacks for orbit controls integration
    this.onGizmoInteractionStart = null;
    this.onGizmoInteractionEnd = null;

    // Bind event handlers
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);

    // Attach event listeners with capture phase to intercept before OrbitControls
    this.attachEventListeners();

    console.log('✓ Input Handler initialized');
  }

  /**
   * Attach mouse event listeners to the DOM element
   * Using capture phase (true) to intercept events before OrbitControls
   */
  attachEventListeners() {
    // Use capture phase to get events before OrbitControls
    this.domElement.addEventListener('mousemove', this.onMouseMove, true);
    this.domElement.addEventListener('mousedown', this.onMouseDown, true);
    this.domElement.addEventListener('mouseup', this.onMouseUp, true);
  }

  /**
   * Remove event listeners (cleanup)
   */
  detachEventListeners() {
    this.domElement.removeEventListener('mousemove', this.onMouseMove, true);
    this.domElement.removeEventListener('mousedown', this.onMouseDown, true);
    this.domElement.removeEventListener('mouseup', this.onMouseUp, true);
  }

  /**
   * Convert mouse coordinates to Normalized Device Coordinates (NDC)
   * @param {MouseEvent} event - Mouse event
   */
  updateMousePosition(event) {
    const rect = this.domElement.getBoundingClientRect();
    
    // Convert to NDC (-1 to +1)
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Perform raycasting to detect gizmo axis intersection
   * @returns {Object|null} - Intersected axis data or null
   */
  raycastGizmo() {
    // Update raycaster with current mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Get all gizmo meshes for picking
    const pickingMeshes = this.gizmo.getPickingMeshes();

    // Perform raycast (recursive=true to check children of Groups like square frames)
    const intersects = this.raycaster.intersectObjects(pickingMeshes, true);

    // Debug: Log raycast attempts
    if (this.debugMode && intersects.length > 0) {
      console.log(`🔍 Raycast hit ${intersects.length} object(s)`);
    }

    if (intersects.length > 0) {
      const intersection = intersects[0];
      let userData = intersection.object.userData;
      
      // If the hit object doesn't have userData, check parent (for groups/children)
      let checkObject = intersection.object;
      while ((!userData.type || !userData.axis) && checkObject.parent) {
        checkObject = checkObject.parent;
        userData = checkObject.userData;
        if (userData.axis) break;
      }

      // Handle both axis rings and labels
      if (userData.type === 'gizmo-axis' || userData.type === 'gizmo-label') {
        const isLabel = userData.type === 'gizmo-label';
        if (this.debugMode) {
          const type = isLabel ? 'label' : 'axis';
          console.log(`✅ Hit ${userData.axis.toUpperCase()}-axis ${type} at distance ${intersection.distance.toFixed(2)}`);
        }
        return {
          axis: userData.axis,
          axisVector: userData.axisVector,
          point: intersection.point,
          object: intersection.object,
          isLabel: isLabel  // Track if this is a label or ring
        };
      }
    }

    return null;
  }

  /**
   * Handle mouse move event
   * @param {MouseEvent} event - Mouse event
   */
  onMouseMove(event) {
    // Update mouse position
    this.updateMousePosition(event);

    // Handle Y-axis dual interaction (detect drag direction on first move)
    if (this.yAxisDragMode !== undefined) {
      if (this.yAxisDragMode === null) {
        // Determine drag direction based on initial movement
        const deltaX = Math.abs(event.clientX - this.sliceDragStartX);
        const deltaY = Math.abs(event.clientY - this.sliceDragStartY);
        
        if (deltaX > 5 || deltaY > 5) {  // Threshold to detect direction
          if (deltaY > deltaX) {
            // More vertical movement - slice control
            this.yAxisDragMode = 'slice';
            this.isControllingSlice = true;
            this.isDragging = false;
            this.domElement.style.cursor = "url('/pointer.png') 3 3, ns-resize";
            console.log(`🎯 Y-axis: Vertical drag detected - slice control`);
          } else {
            // More horizontal movement - rotation
            this.yAxisDragMode = 'rotate';
            this.isDragging = true;
            this.isControllingSlice = false;
            this.gizmo.isRotating = true;
            this.domElement.style.cursor = "url('/pointer.png') 3 3, ew-resize";
            this.setupRotation({ axis: 'y', axisVector: new THREE.Vector3(0, 1, 0) });
            console.log(`🎯 Y-axis: Horizontal drag detected - rotation`);
          }
        }
      }
      
      // Execute the determined action
      if (this.yAxisDragMode === 'slice') {
        this.updateSlicePosition(event);
      } else if (this.yAxisDragMode === 'rotate') {
        this.updateRotation(event);
      }
    } else if (this.isControllingSlice) {
      // Legacy slice control (for Y-axis label)
      this.updateSlicePosition(event);
    } else if (this.isDragging) {
      // Perform rotation during drag
      this.updateRotation();
    } else if (!this.isCameraRotating) {
      // Only check for hover if not dragging and not rotating camera
      this.updateHover();
    }
  }

  /**
   * Update hover state based on raycasting
   */
  updateHover() {
    const hit = this.raycastGizmo();

    if (hit) {
      // Mouse is over a gizmo axis
      if (this.hoveredAxis !== hit.axis) {
        this.hoveredAxis = hit.axis;
        this.gizmo.setHoverAxis(hit.axis);
        this.domElement.style.cursor = "url('/pointer.png') 3 3, auto";
        
        console.log(`✨ Hovering over ${hit.axis.toUpperCase()}-axis`);
      }
    } else {
      // Mouse is not over any axis
      if (this.hoveredAxis !== null) {
        console.log('👋 Hover ended');
        this.gizmo.setHoverAxis(null);
        this.hoveredAxis = null;
        this.domElement.style.cursor = "url('/pointer.png') 3 3, auto";
      }
    }
  }

  /**
   * Handle mouse down event
   * @param {MouseEvent} event - Mouse event
   */
  onMouseDown(event) {
    // Only handle left mouse button
    if (event.button !== 0) return;

    // Update mouse position
    this.updateMousePosition(event);

    // Check if clicking on gizmo
    const hit = this.raycastGizmo();

    if (hit) {
      // Store mouse down info for click detection
      this.mouseDownPosition.copy(this.mouse);
      this.mouseDownTime = Date.now();
      this.hitType = hit.isLabel ? 'label' : 'ring';
      this.selectedAxis = hit.axis;
      
      if (hit.isLabel) {
        // LABEL CLICKED: Check if it's Y-axis for slice control
        if (hit.axis === 'y' && this.app) {
          // Y-AXIS LABEL: Start slice control mode
          event.stopPropagation();
          event.preventDefault();
          
          this.isControllingSlice = true;
          this.isDragging = false;
          this.isCameraRotating = false;
          this.sliceDragStartY = event.clientY;
          this.sliceStartPosition = this.app.transverseYPosition || 0;
          
          this.domElement.style.cursor = "url('/pointer.png') 3 3, ns-resize";
          
          console.log(`🏷️ Y-axis label clicked - transverse slice control enabled`);
          
        } else {
          // OTHER LABELS: Allow camera rotation (don't block OrbitControls)
          this.isCameraRotating = true;
          this.isDragging = false;
          
          console.log(`🏷️ Label ${hit.axis.toUpperCase()} clicked - camera rotation enabled`);
        }
        
      } else {
        // RING/AXIS CLICKED: Check if it's Y-axis for dual interaction
        if (hit.axis === 'y' && this.app) {
          // Y-AXIS: Support both slice control (vertical) and rotation (horizontal)
          event.stopPropagation();
          event.preventDefault();
          
          // Store initial mouse position to detect drag direction
          this.yAxisDragMode = null; // Will be set to 'slice' or 'rotate' on first move
          this.sliceDragStartY = event.clientY;
          this.sliceDragStartX = event.clientX;
          this.sliceStartPosition = this.app.transverseYPosition || 0;
          
          // Update gizmo visual state for Y-axis
          this.gizmo.setActiveAxis(hit.axis);
          
          this.domElement.style.cursor = "url('/pointer.png') 3 3, move";
          
          // Disable orbit controls
          if (this.onGizmoInteractionStart) {
            this.onGizmoInteractionStart();
          }
          
          console.log(`🎯 Y-axis grabbed - waiting for drag direction`);
          
        } else {
          // OTHER AXES (X, Z): Setup axis rotation (block OrbitControls)
          event.stopPropagation();
          event.preventDefault();
          
          this.isDragging = true;
          this.isCameraRotating = false;
          
          // Update gizmo visual state
          this.gizmo.setActiveAxis(hit.axis);
          this.gizmo.isRotating = true;
          
          // Change cursor
          this.domElement.style.cursor = "url('/pointer.png') 3 3, auto";
          
          // Disable orbit controls
          if (this.onGizmoInteractionStart) {
            this.onGizmoInteractionStart();
          }
          
          console.log(`🎯 Ring ${hit.axis.toUpperCase()} grabbed - axis rotation enabled`);
          
          // Phase 4: Store initial rotation state
          this.setupRotation(hit);
        }
      }
    } else {
      // Clicking on empty space - camera rotation will start
      this.isCameraRotating = true;
      this.hitType = null;
      // Clear any hover state
      this.gizmo.setHoverAxis(null);
      this.hoveredAxis = null;
    }
  }

  /**
   * Handle mouse up event
   * @param {MouseEvent} event - Mouse event
   */
  onMouseUp(event) {
    // Check if this was a quick click on a label
    const mouseUpTime = Date.now();
    const timeDiff = mouseUpTime - this.mouseDownTime;
    const mouseDist = this.mouse.distanceTo(this.mouseDownPosition);
    
    // Handle Y-axis dual interaction end
    if (this.yAxisDragMode !== undefined) {
      this.yAxisDragMode = undefined;
      this.isControllingSlice = false;
      this.isDragging = false;
      this.domElement.style.cursor = "url('/pointer.png') 3 3, auto";
      
      // Clear active axis visual state
      this.gizmo.clearActiveAxis();
      this.gizmo.isRotating = false;
      
      // Re-enable orbit controls
      if (this.onGizmoInteractionEnd) {
        this.onGizmoInteractionEnd();
      }
      
      console.log(`✅ Y-axis interaction ended`);
    }
    
    // Handle slice control end (legacy for Y-axis label)
    if (this.isControllingSlice) {
      this.isControllingSlice = false;
      this.domElement.style.cursor = "url('/pointer.png') 3 3, auto";
      
      // Clear active axis visual state
      this.gizmo.clearActiveAxis();
      
      // Re-enable orbit controls
      if (this.onGizmoInteractionEnd) {
        this.onGizmoInteractionEnd();
      }
      
      console.log(`✅ Transverse slice control ended at Y = ${this.app.transverseYPosition.toFixed(2)}`);
    }
    
    // If quick click with minimal movement on a LABEL (not Y-axis), snap to axis view
    if (timeDiff < 250 && mouseDist < 0.05 && this.selectedAxis && this.hitType === 'label' && this.selectedAxis !== 'y') {
      console.log(`🎯 Quick label click - snapping to ${this.selectedAxis.toUpperCase()}-axis view`);
      this.snapToAxisView(this.selectedAxis);
    }
    
    if (this.isDragging) {
      // Stop propagation if we were dragging a RING
      event.stopPropagation();
      event.preventDefault();
      
      this.isDragging = false;
      
      // Clear active axis
      this.gizmo.clearActiveAxis();
      
      // Restore cursor
      this.domElement.style.cursor = "url('/pointer.png') 8 8, auto";
      
      // Re-enable orbit controls
      if (this.onGizmoInteractionEnd) {
        this.onGizmoInteractionEnd();
      }
      
      console.log('✅ Ring rotation ended');
      
      // Phase 4: Clear rotation state
      this.clearRotationState();
    }
    
    // Clear selection state
    this.selectedAxis = null;
    this.hitType = null;
    
    // End camera rotation mode
    this.isCameraRotating = false;
  }

  /**
   * Setup rotation state when axis is selected (Phase 4/5)
   * @param {Object} hit - Raycast hit data
   */
  setupRotation(hit) {
    // Get axis vector (in world space for local mode support)
    this.currentAxisVector = this.gizmo.getWorldAxisVector(hit.axis);
    
    if (!this.currentAxisVector) {
      console.error('⚠️ Failed to get axis vector');
      return;
    }

    // Phase 5: Check if camera is aligned with rotation axis
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    const alignment = Math.abs(cameraDirection.dot(this.currentAxisVector));

    if (alignment > this.config.maxCameraAlignmentDot) {
      // Camera is too aligned with axis, use fallback plane
      console.log('⚠️ Camera aligned with axis - using fallback plane');
      this.currentAxisVector = this.getFallbackAxis(this.currentAxisVector, cameraDirection);
    }
    
    // Create a plane perpendicular to the rotation axis
    const targetPosition = this.gizmo.target.position;
    this.rotationPlane = createRotationPlane(this.currentAxisVector, targetPosition);
    
    // Get initial hit point on the plane
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const ray = this.raycaster.ray;
    this.initialHitPoint = rayPlaneIntersection(ray, this.rotationPlane);
    
    // Store initial rotation
    this.initialRotation = this.gizmo.target.quaternion.clone();
    
    if (this.initialHitPoint) {
      console.log(`✅ Rotation setup complete for ${hit.axis.toUpperCase()}-axis`);
    } else {
      console.warn('⚠️ Could not establish initial hit point');
    }
  }

  /**
   * Get fallback axis when camera is aligned with rotation axis (Phase 5)
   * @param {THREE.Vector3} originalAxis - Original rotation axis
   * @param {THREE.Vector3} cameraDirection - Camera direction
   * @returns {THREE.Vector3} - Fallback axis perpendicular to camera
   */
  getFallbackAxis(originalAxis, cameraDirection) {
    // Use camera's up vector as fallback
    const cameraUp = this.camera.up.clone();
    const fallbackAxis = new THREE.Vector3().crossVectors(cameraDirection, cameraUp);
    fallbackAxis.normalize();
    
    console.log('🔄 Using fallback rotation plane');
    return fallbackAxis;
  }

  /**
   * Update transverse slice position during Y-axis drag
   */
  updateSlicePosition(event) {
    if (!this.app) return;
    
    const deltaY = event.clientY - this.sliceDragStartY;
    const sensitivity = 0.02; // Adjust sensitivity
    const newY = this.sliceStartPosition - deltaY * sensitivity; // Invert for intuitive control
    
    // Clamp to gizmo bounds (don't go beyond Y-axis label button)
    // Gizmo is at Y=1.0, radius is 3.5, so label is at ~Y=4.0 in world space
    // Model space: clamp to ±3.0 (safe range within gizmo)
    const clampedY = Math.max(-3.0, Math.min(3.0, newY));
    
    this.app.updateTransverseClipping(clampedY);
  }

  /**
   * Update rotation during mouse drag (Phase 4/5)
   */
  updateRotation() {
    if (!this.initialHitPoint || !this.rotationPlane || !this.currentAxisVector) {
      return;
    }

    // Cast ray to rotation plane
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const ray = this.raycaster.ray;
    const currentHitPoint = rayPlaneIntersection(ray, this.rotationPlane);

    // Phase 5: Handle ray parallel to plane (no intersection)
    if (!currentHitPoint) {
      // Ray is parallel to plane or no intersection - skip this frame
      return;
    }

    // Get target position (pivot point)
    const pivot = this.gizmo.target.position;

    // Calculate vectors from pivot to hit points
    const startVector = new THREE.Vector3().subVectors(this.initialHitPoint, pivot);
    const currentVector = new THREE.Vector3().subVectors(currentHitPoint, pivot);

    // Phase 5: Check if vectors are valid (not zero-length)
    const startLength = startVector.length();
    const currentLength = currentVector.length();
    
    if (startLength < 0.001 || currentLength < 0.001) {
      // Too close to pivot point - skip
      return;
    }

    // Normalize vectors
    startVector.normalize();
    currentVector.normalize();

    // Calculate signed angle between vectors
    const angle = signedAngle(startVector, currentVector, this.currentAxisVector);

    // Phase 5: Dead zone - ignore very small angle changes to prevent jitter
    if (Math.abs(angle) < this.config.minAngleThreshold) {
      return;
    }

    // Create rotation quaternion
    const deltaRotation = quaternionFromAxisAngle(this.currentAxisVector, angle);

    // Apply rotation relative to initial rotation (prevents drift)
    this.gizmo.target.quaternion.copy(this.initialRotation);
    this.gizmo.target.quaternion.premultiply(deltaRotation);

    // Optional: Log rotation for debugging (only significant angles)
    if (this.debugMode && Math.abs(angle) > 0.01) {
      const degrees = (angle * 180 / Math.PI).toFixed(1);
      console.log(`🔄 Rotating ${degrees}° around ${this.selectedAxis.toUpperCase()}-axis`);
    }
  }

  /**
   * Clear rotation state (Phase 4)
   */
  clearRotationState() {
    this.rotationPlane = null;
    this.initialHitPoint = null;
    this.initialRotation = null;
    this.currentAxisVector = null;
  }

  /**
   * Snap camera to look down the clicked axis (orthographic-like view)
   * @param {string} axisName - Axis to look down ('x', 'y', 'z')
   */
  snapToAxisView(axisName) {
    // Calculate target camera position to look down the clicked axis
    const distance = this.camera.position.length(); // Maintain current distance
    const targetPosition = new THREE.Vector3();
    
    if (axisName === 'x') {
      // Look down X-axis: camera on +X, looking toward origin
      // This puts X label at center, Y and Z perpendicular
      targetPosition.set(distance, 0, 0);
    } else if (axisName === 'y') {
      // Look down Y-axis: camera on +Y, looking toward origin
      // This puts Y label at center, X and Z perpendicular
      targetPosition.set(0, distance, 0);
    } else if (axisName === 'z') {
      // Look down Z-axis: camera on +Z, looking toward origin
      // This puts Z label at center, X and Y perpendicular
      targetPosition.set(0, 0, distance);
    }

    // Animate camera to target position
    const duration = 600;
    const startTime = Date.now();
    const startPosition = this.camera.position.clone();

    // Temporarily disable orbit controls during animation
    if (this.onGizmoInteractionStart) {
      this.onGizmoInteractionStart();
    }

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth ease-in-out
      const eased = 0.5 - Math.cos(progress * Math.PI) / 2;
      
      // Interpolate camera position
      this.camera.position.lerpVectors(startPosition, targetPosition, eased);
      
      // Keep camera looking at origin (where gizmo is)
      this.camera.lookAt(0, 0, 0);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Re-enable orbit controls after animation
        if (this.onGizmoInteractionEnd) {
          this.onGizmoInteractionEnd();
        }
        console.log(`✅ Camera aligned to ${axisName.toUpperCase()}-axis view`);
      }
    };

    animate();
  }

  /**
   * Get current interaction state
   * @returns {Object} - Current state
   */
  getState() {
    return {
      isDragging: this.isDragging,
      hoveredAxis: this.hoveredAxis,
      selectedAxis: this.selectedAxis
    };
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.detachEventListeners();
  }
}

