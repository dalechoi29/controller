# 3D Rotation Gizmo

An axis-based rotation control system for Three.js that allows intuitive 3D object manipulation.

## Overview

This project implements a professional-grade rotation gizmo similar to those found in 3D editors like Blender, Unity, and Maya. Users can select an axis (X, Y, or Z) and drag to rotate objects around that axis.

## Current Status: Phase 1 Complete ✓

### Completed Features
- ✓ Project foundation with Vite + Three.js
- ✓ Modular architecture (Scene, Camera, Renderer)
- ✓ Working 3D scene with test object
- ✓ Orbit camera controls
- ✓ Basic lighting setup
- ✓ Grid and axis helpers for spatial reference

## Project Structure

```
3d_cursor/
├── src/
│   ├── core/
│   │   ├── Scene.js          # Scene management and lighting
│   │   ├── Camera.js         # Camera and orbit controls
│   │   └── Renderer.js       # WebGL renderer setup
│   ├── gizmo/
│   │   └── RotationGizmo.js  # Gizmo implementation (stub)
│   ├── utils/
│   │   └── MathUtils.js      # Math utilities (stub)
│   └── main.js               # Application entry point
├── index.html                # HTML template
├── vite.config.js            # Vite configuration
└── package.json              # Dependencies and scripts
```

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies (already done)
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Development Roadmap

See `.cursor/rules/README.md` for the complete development plan.

### Upcoming Phases

- **Phase 2**: Gizmo Visual Representation (3 rotation rings)
- **Phase 3**: Input System & Axis Picking (raycasting)
- **Phase 4**: Rotation Math Engine (plane-based rotation)
- **Phase 5**: Transform Application & Stability
- **Phase 6**: UX Enhancements & Polish
- **Phase 7**: Testing & Optimization
- **Phase 8**: Documentation & Code Cleanup

## Controls (Current)

- **Left Mouse**: Rotate camera around scene
- **Right Mouse**: Pan camera
- **Scroll Wheel**: Zoom in/out

## Technology Stack

- **Three.js**: 3D rendering library
- **Vite**: Build tool and dev server
- **ES6 Modules**: Modern JavaScript

## License

ISC

## Development Notes

This is an active development project following a phased implementation approach. Each phase builds upon the previous one, ensuring a solid foundation and testable increments.



