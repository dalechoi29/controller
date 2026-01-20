# 3D Models Directory

Place your exported Blender 3D model here!

## Quick Start

1. **Export from Blender:**
   - Open your model in Blender
   - Select your object(s)
   - File → Export → glTF 2.0 (.glb/.gltf)
   - Choose **glTF Binary (.glb)** format
   - **IMPORTANT**: Enable **+Y Up** in export settings
   - Save as `your_model.glb`

2. **Place file here:**
   ```
   public/models/your_model.glb
   ```

3. **Update the code:**
   - Open `src/main.js`
   - Find line with: `const modelPath = '/models/your_model.glb';`
   - Change `your_model.glb` to your actual filename

4. **Run the app:**
   ```bash
   npm run dev
   ```

## Recommended Blender Export Settings

- **Format**: glTF Binary (.glb) ✓
- **Include**: Selected Objects
- **Transform**: +Y Up ✓ (REQUIRED for Three.js)
- **Geometry**: Apply Modifiers ✓
- **Materials**: Export ✓
- **Compression**: Off (for debugging), On (for production)

## Troubleshooting

### Model doesn't appear?
- Check browser console for errors
- Verify file is in `public/models/` folder
- Check filename matches exactly in `main.js`
- Try refreshing the page (Ctrl+Shift+R)

### Model is too small/large?
- The ModelLoader automatically scales models to fit
- Adjust scale in `ModelLoader.js` if needed (line ~32)

### Model is off-center?
- ModelLoader automatically centers models
- If still off, check origin in Blender: Object → Set Origin → Origin to Geometry

### Materials look wrong?
- Ensure you exported with materials enabled
- Check that textures are embedded in .glb file

## Example Files

You can test with simple models first:
- Export a basic cube from Blender
- Export a UV sphere
- Try more complex models once basic ones work

Happy modeling! 🎨

