import React, { useEffect } from 'react'
import VoxelEngine from './VoxelEngine'
import { useVoxelStore } from './VoxelStore'
import './App.css'

const COLORS = [
  '#00ffff', // Cyan (Brighter)
  '#ff003c', // Neon Red
  '#ccff00', // Neon Lime
  '#ff00ff', // Neon Pink
  '#ffff00', // Neon Yellow
  '#ffffff', // White
]

function App() {
  const initializeVoxels = useVoxelStore((state) => state.initializeVoxels)
  const subscribeToVoxels = useVoxelStore((state) => state.subscribeToVoxels)
  const selectedColor = useVoxelStore((state) => state.selectedColor)
  const setSelectedColor = useVoxelStore((state) => state.setSelectedColor)

  useEffect(() => {
    console.log("App mounted, initializing voxels...");
    initializeVoxels()
    const unsubscribe = subscribeToVoxels()
    return () => unsubscribe()
  }, [initializeVoxels, subscribeToVoxels])

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = parseInt(e.key)
      if (key >= 1 && key <= 6) {
        setSelectedColor(COLORS[key - 1])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setSelectedColor])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      <VoxelEngine />

      {/* HUD Layer */}
      <div className="hud">
        <div className="crosshair">+</div>
        <div className="top-hud">
          {/* MTV Style Logo */}
          <div className="mtv-logo">
            <div className="mtv-m">V</div>
            <div className="mtv-tv">OX</div>
          </div>

          <div className="status-bar">
            <span className="scrolling-text">NEOVOX /// WASD to Fly /// Click to Build /// Alt+Click Delete /// 1-6 Color</span>
          </div>
        </div>

        {/* Color Picker */}
        <div className="color-picker">
          {COLORS.map((color, index) => (
            <div
              key={color}
              className={`color-swatch ${selectedColor === color ? 'active' : ''}`}
              style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
              onClick={() => setSelectedColor(color)}
            >
              <span className="key-hint">{index + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
