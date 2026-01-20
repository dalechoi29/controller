# Quick Start: Load Your Blender Model

## 🎯 Three Simple Steps

### Step 1: Export from Blender

1. Open your model in **Blender**
2. Select the object(s) you want to export
3. **File → Export → glTF 2.0 (.glb/.gltf)**
4. **Important Settings:**
   - Format: **glTF Binary (.glb)** ← Single file, easier!
   - Transform: Check **+Y Up** ← Required for Three.js!
   - Apply Modifiers: Check this
5. Save as `my_model.glb` (or any name you like)

### Step 2: Place Your File

Copy your exported `.glb` file to:
```
public/models/my_model.glb
```

### Step 3: Update the Code

Open `src/main.js` and find this line (around line 48):

```javascript
const modelPath = '/models/your_model.glb';
```

Change it to match your filename:

```javascript
const modelPath = '/models/my_model.glb';  // ← Your actual filename
```

### Step 4: Run & View

```bash
npm run dev
```

Your model should now appear in the **MAIN SCREEN** (top)!

## 🎨 What Happens

- **MAIN SCREEN (top)**: Your full-color Blender model at 15x scale
- **TOUCH SCREEN (bottom)**: Keeps the simple cube for easy control

The rotation gizmo in the touch screen controls your Blender model:
- Drag rings to rotate → See changes in MAIN SCREEN
- Click axis labels to snap to that view → Both screens sync
- Use Reset button to return to original position
- Touch screen cube stays simple for clear gizmo visibility

## ⚙️ How It Works

The code now:
1. Always creates simple cube for TOUCH SCREEN (for clear gizmo controls)
2. Tries to load your `.glb` file for MAIN SCREEN only
3. Automatically centers and scales your model
4. Syncs rotation between both screens
5. Falls back to colored cube if model fails to load

**Why keep cube in touch screen?**
- Clear visibility of rotation gizmo
- Simple reference for manipulation
- Your detailed Blender model shows in MAIN SCREEN where it matters!

## 🔧 Customization

### Adjust Model Size

In `src/utils/ModelLoader.js`, line ~32:

```javascript
const targetSize = 2.0; // Change this number
```

- Larger number = bigger model
- Smaller number = smaller model

### Adjust Touch Screen Cube Size

The touch screen uses the standard cube (not your Blender model).
To adjust its size, modify `createDecolorizedCube()` in `src/main.js`:

```javascript
const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2); // Change 1.2 to adjust
```

### Adjust Main Screen Size

In `src/main.js`, find:

```javascript
this.previewObject.scale.set(15.0, 15.0, 15.0); // Change 15.0 to adjust size
```

## 🐛 Troubleshooting

### "Could not load model" error?
- ✓ File is in `public/models/` folder?
- ✓ Filename matches exactly in `main.js`?
- ✓ File is `.glb` format (not `.blend`)?
- ✓ Check browser console (F12) for specific error

### Model appears but looks wrong?
- **Too dark?** Check Blender materials/lighting
- **Wrong orientation?** Re-export with **+Y Up** enabled
- **Wrong size?** Adjust `targetSize` in ModelLoader.js
- **Off-center?** In Blender: Object → Set Origin → Origin to Geometry

### Model rotates around wrong point?
- In Blender, set origin: Object → Set Origin → Origin to Geometry
- Re-export the model

## 📚 Additional Resources

- Full guide: `BLENDER_IMPORT_GUIDE.md`
- Models folder: `public/models/README.md`
- Three.js docs: https://threejs.org/docs/#examples/en/loaders/GLTFLoader

---

Need help? Check the browser console (F12) for detailed error messages!

