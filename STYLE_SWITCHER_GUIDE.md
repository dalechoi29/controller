# Gizmo Style Switcher Guide

## Overview

The Style Switcher lets you toggle between two different gizmo visualization styles: **Circular** (rings) and **Linear** (straight lines).

## 🎨 Available Styles

### 1. **⭕ Circular** (Default)
- Circular ring gizmos (torus shapes)
- X, Y, Z axis rings in red, green, blue
- Half-transparent sphere visible
- Interactive labels
- Classic rotation gizmo appearance

### 2. **➡️ Linear**
- Straight axis lines instead of rings
- Lines extend from center to labels
- X, Y, Z axis lines in red, green, blue
- Sphere hidden for cleaner view
- Interactive labels remain
- Minimal, precision-focused appearance

## 🎯 How to Use

1. **Open the Application**
   - Run `npm run dev`
   - Look for the **"🎨 Gizmo Style"** panel in the bottom-right corner

2. **Click to Switch**
   - **⭕ Circular**: Shows ring gizmos + sphere
   - **➡️ Linear**: Shows straight axis lines, hides sphere
   - Active button highlights in green

3. **Test Both Styles**
   - Try rotating with each style
   - See which feels better for your workflow
   - All interactive features work with both styles

## ✨ Key Differences

| Feature | Circular | Linear |
|---------|----------|--------|
| Axis visualization | Ring (torus) | Straight line |
| Sphere | Visible | Hidden |
| Labels | Visible | Visible |
| Interactivity | Full | Full |
| Visual style | Classic | Minimal |
| Best for | General use | Precision work |

## 🔧 Technical Details

### Circular Style
- Uses `THREE.TorusGeometry` for rings
- Ring radius: 2.5 units
- Tube radius: 0.04 units
- Opacity: 0.6
- Sphere opacity: 0.15

### Linear Style
- Uses `THREE.CylinderGeometry` for lines
- Line length: 3.0 units (to label position)
- Line width: 0.04 units
- Opacity: 0.8
- Lines are created once and toggled visibility

### Style Switching
- Circular rings and linear lines both exist in the scene
- Switching styles toggles their visibility
- No geometry recreation needed (fast switching)
- Labels remain visible in both styles
- Sphere visibility tied to style choice

## 💡 Implementation Notes

**File locations:**
- Style switcher UI: `index.html`
- Style methods: `src/gizmo/RotationGizmo.js`
- Sphere visibility logic: `src/main.js`

**How it works:**
1. Linear lines are created lazily (first time Linear is selected)
2. Both ring and line geometries exist simultaneously
3. Style switching just toggles visibility flags
4. Very efficient - no geometry disposal/recreation

## 🎮 Interactive Features (Both Styles)

Both styles support:
- ✅ Drag axis to rotate object
- ✅ Hover highlighting
- ✅ Click label to snap to axis view
- ✅ Click ring/line to activate
- ✅ Reset button
- ✅ Camera controls

The only visual difference is the axis representation - all functionality remains the same!

## 📝 Current Location

The Style Switcher panel is in the **bottom-right corner** of the touch screen. You can move it by editing the CSS in `index.html`:

```css
#style-switcher {
    bottom: 20px;   /* Distance from bottom */
    right: 20px;    /* Distance from right */
}
```

Choose the style that works best for you! 🎨
