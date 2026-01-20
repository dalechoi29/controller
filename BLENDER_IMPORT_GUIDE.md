# Loading Blender 3D Models into the Rotation Gizmo

This guide explains how to replace the test cube with your own Blender 3D model.

## Step 1: Export from Blender

1. **Open your model in Blender**
2. **Select your model** (or select all objects you want to export)
3. **File → Export → glTF 2.0 (.glb/.gltf)**
4. **Export settings:**
   - Format: Choose **glTF Binary (.glb)** for single-file export (recommended)
   - Include: Check **Selected Objects** (if you only want specific objects)
   - Transform: Check **+Y Up** (Three.js uses Y-up coordinate system)
   - Geometry: Check **Apply Modifiers**
   - Materials: Choose **Export** (to keep your materials)
5. **Save to your project:**
   - Save as `public/models/your_model.glb`

## Step 2: Install GLTFLoader

The GLTFLoader is needed to load GLTF/GLB files into Three.js.

```bash
npm install three
```

GLTFLoader is included with Three.js, so no additional packages needed!

## Step 3: Update Your Code

### A. Create a model loader utility (`src/utils/ModelLoader.js`)

```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ModelLoader {
  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Load a GLTF/GLB model
   * @param {string} path - Path to the model file
   * @returns {Promise<THREE.Object3D>} - The loaded model
   */
  async loadModel(path) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => {
          const model = gltf.scene;
          
          // Center the model
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);
          
          // Optional: Scale to fit within unit cube (2x2x2)
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.0 / maxDim;
          model.scale.setScalar(scale);
          
          console.log('✅ Model loaded successfully');
          resolve(model);
        },
        (progress) => {
          const percent = (progress.loaded / progress.total * 100).toFixed(0);
          console.log(`Loading model: ${percent}%`);
        },
        (error) => {
          console.error('❌ Error loading model:', error);
          reject(error);
        }
      );
    });
  }
}
```

### B. Update `src/main.js`

The code is already set up! Just change the model path in the `init()` method:

```javascript
// In src/main.js, find the init() method and change the modelPath:

async init() {
  // ... existing code ...
  
  // Change this line to your model filename:
  const modelPath = '/models/your_model.glb';  // ← Change this!
  
  // The rest is handled automatically:
  // - Touch screen keeps simple cube for controls
  // - Main screen loads your Blender model
  // - Falls back to colorful cube if loading fails
}
```

That's it! The code is already set up with:
- ModelLoader integration
- Automatic centering and scaling
- Touch screen with simple cube
- Main screen with your model
- Automatic fallback handling

### C. Create the public/models directory

```bash
mkdir -p public/models
```

Then place your exported `.glb` file in `public/models/`.

## Step 4: Adjust for Your Model

Depending on your model's complexity and structure, you may need to adjust:

### Size and Scale
The code automatically scales models to fit a 2x2x2 unit cube. Adjust the scale factor in `ModelLoader.js` if needed:

```javascript
const scale = 2.0 / maxDim;  // Change 2.0 to your preferred size
```

### Rotation Pivot
If your model doesn't rotate around its center correctly:

```javascript
// In ModelLoader.js, after centering:
const box = new THREE.Box3().setFromObject(model);
const center = box.getCenter(new THREE.Vector3());
model.position.sub(center);

// Adjust pivot if needed:
model.position.y += 0.5;  // Move up by 0.5 units
```

### Note About Touch Screen
The touch screen keeps the simple grayscale cube for clear gizmo visibility. Your Blender model appears **only in the MAIN SCREEN** (top). The rotation is synced between both screens.

If you want to also show your model in the touch screen, you can modify the `init()` method in `main.js` to create a decolorized clone using `modelLoader.decolorizeModel()`.

## Step 5: Test Your Model

1. **Start the dev server**: `npm run dev`
2. **Check the browser console** for loading messages
3. **Test rotation** with the gizmo
4. **Adjust scale/position** as needed in `ModelLoader.js`

## Troubleshooting

### Model is too small/large
Adjust the scale factor in `ModelLoader.js`:
```javascript
const scale = 2.0 / maxDim;  // Try 1.0, 3.0, etc.
```

### Model is not centered
The centering code uses bounding box. For complex models, you might need manual adjustment:
```javascript
model.position.set(0, -0.5, 0);  // Adjust as needed
```

### Model rotates around wrong point
Ensure your model's origin is set correctly in Blender:
1. In Blender: Object → Set Origin → Origin to Geometry
2. Re-export the model

### Materials look wrong
Check export settings in Blender and ensure you're exporting materials. You can also override materials in code:
```javascript
testObject.traverse((child) => {
  if (child.isMesh) {
    child.material = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.5,
      metalness: 0.1
    });
  }
});
```

### Model doesn't show up at all
1. Check browser console for errors
2. Verify file path is correct (should be relative to `public/` folder)
3. Ensure model file is in `public/models/` directory
4. Try the fallback cube to confirm the rest of the app works

## Recommended Blender Export Settings

For best compatibility:

- **Format**: glTF Binary (.glb)
- **Remember +Y Up**: Three.js uses Y-up
- **Apply Modifiers**: Yes
- **UVs**: Yes (if using textures)
- **Normals**: Yes
- **Vertex Colors**: Yes (if using vertex colors)
- **Materials**: Export
- **Images**: Automatic (embeds textures in .glb)
- **Compression**: Off (for debugging, enable for production)

## Performance Tips

For large/complex models:

1. **Reduce polygon count** in Blender before export
2. **Use Draco compression** for smaller file sizes
3. **Optimize textures** (reduce resolution, use compressed formats)
4. **Use LOD (Level of Detail)** for very complex models

Enjoy your custom 3D model with the rotation gizmo! 🎨

