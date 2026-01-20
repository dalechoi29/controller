# 3D Rotation Control (Axis Gizmo) – Web Development Plan

## 1. Goal Definition

### Objective
Create an **axis-based rotation gizmo** for a web-based 3D environment that allows users to:
- Select an axis (X, Y, Z)
- Click and drag the mouse
- Rotate a 3D object intuitively in real time

### Key UX Expectations
- Axis highlights on hover and selection
- Rotation constrained to the selected axis
- Smooth, proportional rotation
- Camera-independent behavior

---

## 2. Core System Architecture

### High-Level Interaction Flow

    Input System
      → Raycasting / Picking
          → Gizmo Axis Selection
              → Rotation Math Engine
                  → Object Transform Update

### Required Subsystems
- **Gizmo Renderer**  
  Renders axis lines or rotation rings and visual highlights
- **Input Handler**  
  Handles mouse down, move, and up events
- **Axis Picker**  
  Determines which axis is selected via raycasting
- **Rotation Solver**  
  Converts mouse movement into a rotation angle
- **Transform Applier**  
  Applies rotation to the target object

---

## 3. Gizmo Representation

### Visual Design
- Each axis is represented by:
  - A rotation ring (recommended), or
  - An axis line with an invisible hit area
- Color convention:
  - X axis: Red
  - Y axis: Green
  - Z axis: Blue

### Logical Data Model

    AxisGizmo:
      axis: Vector3   // (1,0,0), (0,1,0), (0,0,1)
      mesh: Renderable object
      collider: Picking geometry

---

## 4. Axis Selection (Picking)

### Interaction Flow
1. User presses the mouse button
2. Cast a ray from the camera through the mouse position
3. Test intersection with gizmo colliders
4. Lock the intersected axis as active

### Pseudocode

    onMouseDown(event):
      ray = camera.screenPointToRay(mousePosition)
      hit = raycast(gizmoColliders)
      if hit exists:
        activeAxis = hit.axis

### UX Notes
- Highlight axis on hover
- Keep axis locked during drag
- Ignore drag if no axis is selected

---

## 5. Rotation Interaction Model

### Recommended Method: Plane-Based Rotation
This approach is standard in professional 3D editors and works reliably from any camera angle.

---

## 6. Rotation Plane Definition

When an axis is selected:
- Create a plane perpendicular to the selected axis
- Plane passes through the object’s pivot point

| Axis | Plane Normal |
|-----|-------------|
| X   | (1, 0, 0)   |
| Y   | (0, 1, 0)   |
| Z   | (0, 0, 1)   |

---

## 7. Drag Start State Capture

On mouse down:
- Raycast mouse position onto the rotation plane
- Store the initial vector from pivot to hit point
- Store the object’s initial rotation

    startVector = normalize(hitPoint - objectPosition)
    startRotation = object.rotation

---

## 8. Mouse Movement to Rotation Conversion

On mouse move:
1. Raycast mouse position onto the same plane
2. Compute current vector from pivot
3. Calculate signed angle between start and current vectors

    currentVector = normalize(hitPoint - objectPosition)
    angle = signedAngle(startVector, currentVector, activeAxis)

- Sign determines clockwise vs counterclockwise
- Magnitude determines rotation amount

---

## 9. Applying the Rotation

- Create a quaternion from the axis and angle
- Apply rotation relative to the initial rotation

    deltaRotation = quaternionFromAxisAngle(activeAxis, angle)
    object.rotation = deltaRotation * startRotation

> Always rotate relative to the initial state to avoid cumulative floating-point errors.

---

## 10. Coordinate Space Handling

### Rotation Modes
- **Local Space**: Axis rotates with the object
- **World Space**: Axis remains aligned with world axes

    rotationAxis =
      if mode == "local":
        object.localAxis
      else:
        worldAxis

---

## 11. Input Sensitivity and Stability

### Sensitivity Rules
- Rotation is driven by angular difference, not pixel distance
- Resolution-independent behavior

### Stability Measures
- Ignore very small angle changes
- Apply dead zones to prevent jitter
- Optional angle snapping

    if abs(angle) < epsilon:
      return

---

## 12. Visual Feedback and UX Polish

### Required
- Axis highlight on hover
- Persistent highlight during drag
- Visual indication while rotating

### Optional Enhancements
- Angle snapping (e.g. 15° increments with modifier key)
- On-screen angle readout
- Rotation preview or ghost object

---

## 13. Edge Case Handling

| Scenario | Mitigation |
|--------|------------|
| Camera aligned with axis | Use fallback plane |
| Ray parallel to plane | Ignore current movement |
| Non-uniform scaling | Rotate pivot, not mesh |
| Fast mouse movement | Use angular delta, not pixel delta |

---

## 14. Testing Strategy

### Functional Tests
- Rotate each axis from multiple camera angles
- Rotate beyond 360°
- Rapid click–drag–release cycles

### Precision Tests
- Small incremental rotations
- Snapping accuracy
- Long-session floating-point stability

---

## 15. Web-Specific Implementation Notes

### Common Web Stack
- Three.js / Babylon.js / Custom WebGL engine
- Raycasting against meshes or custom picking geometry
- Quaternion-based rotations

### Required Math Utilities
- Ray–plane intersection
- Vector normalization and dot/cross products
- Signed angle calculation
- Quaternion construction from axis–angle

---

## 16. Deliverables

1. Axis gizmo meshes and hit areas
2. Mouse input and raycasting system
3. Plane-based rotation solver
4. Transform application logic
5. Visual feedback and snapping features
6. Edge case handling and test coverage

---

## 17. Development Plan

### Overview
This section outlines a phased implementation approach for building the axis-based rotation gizmo, breaking down the work into manageable, testable increments.

---

### **Phase 1: Project Foundation & Basic Scene Setup** (Day 1)

**Goal**: Establish the rendering environment and basic 3D scene

**Tasks**:
1. **Choose Primary Framework** (Three.js recommended)
   - Set up Three.js scene, camera, renderer
   - Add orbit controls for camera movement
   - Create a simple test object (cube or sphere)
   - Add basic lighting

2. **Project Structure**:
   ```
   /src
     /core
       - Scene.js          // Scene initialization
       - Camera.js         // Camera setup
       - Renderer.js       // WebGL renderer
     /gizmo
       - RotationGizmo.js  // Main gizmo class (stub)
     /utils
       - MathUtils.js      // Math helpers (stub)
     main.js               // Entry point
   ```

3. **Deliverables**:
   - Rotating 3D scene with a test object
   - Working camera controls
   - Clean, modular code structure

---

### **Phase 2: Gizmo Visual Representation** (Day 2)

**Goal**: Create the visual gizmo with three rotation rings

**Tasks**:
1. **Create Gizmo Geometry**:
   - Generate three torus rings (X, Y, Z axes)
   - Apply color coding: Red (X), Green (Y), Blue (Z)
   - Position gizmo at object center

2. **Implement Gizmo Class**:
   ```javascript
   class RotationGizmo {
     constructor(targetObject) {
       this.target = targetObject;
       this.axes = {
         x: this.createAxisRing('x', 0xff0000),
         y: this.createAxisRing('y', 0x00ff00),
         z: this.createAxisRing('z', 0x0000ff)
       };
     }
     
     createAxisRing(axis, color) { /* ... */ }
     update() { /* Position at target */ }
   }
   ```

3. **Visual Polish**:
   - Proper ring thickness and radius
   - Transparent material with emissive glow
   - Gizmo scales with distance (optional)

4. **Deliverables**:
   - Visible rotation gizmo attached to test object
   - Three distinct, color-coded axis rings

---

### **Phase 3: Input System & Axis Picking** (Day 3)

**Goal**: Detect which axis the user is interacting with

**Tasks**:
1. **Raycasting System**:
   ```javascript
   class InputHandler {
     constructor(camera, scene) {
       this.raycaster = new THREE.Raycaster();
       this.mouse = new THREE.Vector2();
     }
     
     getIntersectedAxis(event, gizmoObjects) {
       // Convert mouse to NDC
       // Cast ray
       // Return hit axis or null
     }
   }
   ```

2. **Mouse Event Handling**:
   - `onMouseDown`: Start interaction, lock axis
   - `onMouseMove`: Trigger hover effects, update rotation
   - `onMouseUp`: Release axis

3. **Visual Feedback**:
   - Hover state: Brighten hovered axis
   - Active state: Keep axis highlighted during drag
   - Inactive state: Dim non-selected axes

4. **Deliverables**:
   - Working axis selection via raycasting
   - Visual hover and selection feedback
   - Console logging selected axis (for testing)

---

### **Phase 4: Rotation Math Engine** (Day 4-5)

**Goal**: Convert mouse movement to rotation angles

**Tasks**:
1. **Implement Core Math Utilities** (`/utils/MathUtils.js`):
   ```javascript
   // Ray-plane intersection
   function rayPlaneIntersection(ray, planeNormal, planePoint) { /* ... */ }
   
   // Signed angle between vectors
   function signedAngle(v1, v2, axis) { /* ... */ }
   
   // Quaternion from axis-angle
   function quaternionFromAxisAngle(axis, angle) { /* ... */ }
   ```

2. **Rotation Plane System**:
   - On axis selection, create plane perpendicular to axis
   - Store initial raycast hit point
   - Store initial object rotation

3. **Drag-to-Rotate Logic**:
   ```javascript
   onMouseMove(event) {
     if (!this.activeAxis) return;
     
     // 1. Cast ray to rotation plane
     const currentPoint = this.rayPlaneIntersection(/* ... */);
     
     // 2. Calculate vectors from pivot
     const startVec = this.startPoint.sub(this.pivot).normalize();
     const currentVec = currentPoint.sub(this.pivot).normalize();
     
     // 3. Compute signed angle
     const angle = signedAngle(startVec, currentVec, this.activeAxis);
     
     // 4. Apply rotation
     this.applyRotation(angle);
   }
   ```

4. **Deliverables**:
   - Working mouse-to-rotation conversion
   - Rotation constrained to selected axis
   - Smooth, proportional rotation

---

### **Phase 5: Transform Application & Stability** (Day 6)

**Goal**: Apply rotations correctly and handle edge cases

**Tasks**:
1. **Rotation Application**:
   - Always rotate relative to initial state (avoid drift)
   - Support both world-space and local-space modes
   - Update gizmo orientation based on mode

2. **Stability Improvements**:
   - Implement dead zone for tiny movements (< 0.01 radians)
   - Handle ray-plane parallel cases gracefully
   - Fallback plane when camera aligned with axis

3. **Edge Case Handling**:
   ```javascript
   // Camera aligned with rotation axis
   if (Math.abs(camera.forward.dot(axis)) > 0.99) {
     // Use camera-relative fallback plane
   }
   
   // Ray parallel to plane (no intersection)
   const intersection = rayPlaneIntersection(ray, plane);
   if (!intersection) return; // Ignore this frame
   ```

4. **Deliverables**:
   - Stable rotation from any camera angle
   - No cumulative floating-point errors
   - Graceful handling of edge cases

---

### **Phase 6: UX Enhancements & Polish** (Day 7)

**Goal**: Professional user experience features

**Tasks**:
1. **Angle Snapping** (Optional):
   - Hold Shift key for 15° increments
   - Visual indication when snapping active

2. **On-Screen Feedback**:
   - Display current rotation angle during drag
   - Show active axis name
   - Optional: rotation preview ghost

3. **Visual Polish**:
   - Smooth transitions for hover states
   - Gizmo depth testing options
   - Better material shaders

4. **Deliverables**:
   - Angle snapping with modifier key
   - Real-time angle display
   - Polished visual feedback

---

### **Phase 7: Testing & Optimization** (Day 8)

**Goal**: Ensure reliability and performance

**Test Categories**:

#### Functional Testing
- ✓ Rotate each axis from 8+ camera angles
- ✓ Rotate beyond 360° multiple times
- ✓ Rapid click-drag-release cycles
- ✓ Test with different object scales

#### Precision Testing
- ✓ Small 1° incremental rotations
- ✓ Snapping accuracy at all angles
- ✓ 5-minute continuous rotation session

#### Performance Testing
- ✓ Monitor frame rate during rotation
- ✓ Test with multiple objects
- ✓ Memory leak detection

**Deliverables**:
- Test report with all cases passed
- Performance benchmarks
- Bug fixes and optimizations

---

### **Phase 8: Documentation & Code Cleanup** (Day 9)

**Goal**: Production-ready codebase

**Tasks**:
1. **Code Documentation**:
   - JSDoc comments for all public methods
   - Inline comments for complex math
   - README with usage examples

2. **API Documentation**:
   ```javascript
   // Basic usage example
   import { RotationGizmo } from './gizmo/RotationGizmo';
   
   const gizmo = new RotationGizmo(myObject, {
     mode: 'world',        // or 'local'
     snapAngle: 15,        // degrees (optional)
     sensitivity: 1.0      // rotation speed multiplier
   });
   
   scene.add(gizmo.mesh);
   
   // Update in render loop
   gizmo.update();
   ```

3. **Code Quality**:
   - Remove debug code and console logs
   - Refactor complex functions
   - Ensure consistent code style
   - Add error handling

4. **Deliverables**:
   - Complete API documentation
   - Usage examples and demos
   - Clean, well-commented code
   - User guide with GIFs/videos

---

### Technology Stack Recommendation

**Primary Choice: Three.js**
- Simpler learning curve
- Excellent documentation
- Large community support
- Built-in raycasting and quaternion support
- OrbitControls included

**Alternative: Babylon.js**
- More built-in features
- Powerful inspector/debugging tools
- Use if advanced features needed
- Similar architecture applies

---

### Project Setup Commands

```bash
# Initialize project
npm init -y

# Install dependencies
npm install three @babylonjs/core @babylonjs/loaders

# Install dev dependencies
npm install --save-dev vite @types/three

# Add to package.json scripts
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}

# Start development server
npm run dev
```

---

### Implementation Milestones

| Phase | Duration | Key Milestone |
|-------|----------|---------------|
| Phase 1 | Day 1 | Scene renders with test object |
| Phase 2 | Day 2 | Gizmo visible and attached |
| Phase 3 | Day 3 | Axis selection working |
| Phase 4-5 | Day 4-6 | Full rotation functionality |
| Phase 6 | Day 7 | UX polish complete |
| Phase 7 | Day 8 | All tests passing |
| Phase 8 | Day 9 | Documentation complete |

**Total Estimated Time**: 9 working days

---

### Success Criteria

The implementation will be considered complete when:

1. ✓ User can select any axis by clicking
2. ✓ Dragging rotates object around selected axis only
3. ✓ Rotation works smoothly from any camera angle
4. ✓ Visual feedback is clear and professional
5. ✓ All edge cases are handled gracefully
6. ✓ Performance is smooth (60 FPS)
7. ✓ Code is documented and maintainable
8. ✓ All functional and precision tests pass
