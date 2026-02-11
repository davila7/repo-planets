import { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { getLanguageColor } from '../services/languageColors'

// Procedural planet texture via canvas
function createPlanetTexture(baseColor, size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const color = new THREE.Color(baseColor)

  // Base fill
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, size, size)

  // Add surface noise / craters
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 18 + 2
    const darken = 0.7 + Math.random() * 0.3
    const c = color.clone().multiplyScalar(darken)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = `#${c.getHexString()}`
    ctx.fill()
  }

  // Add lighter highlights
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 12 + 1
    const lighten = 1.15 + Math.random() * 0.25
    const c = color.clone().multiplyScalar(lighten)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = `#${c.getHexString()}`
    ctx.globalAlpha = 0.5
    ctx.fill()
    ctx.globalAlpha = 1.0
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

export default function Planet({ data, onHover, onUnhover }) {
  const groupRef = useRef()
  const meshRef = useRef()
  const [hovered, setHovered] = useState(false)

  const baseColor = getLanguageColor(data.language)

  const texture = useMemo(() => createPlanetTexture(baseColor), [baseColor])

  const glowColor = useMemo(() => new THREE.Color(baseColor), [baseColor])

  useFrame((state) => {
    const t = state.clock.elapsedTime

    // Orbit
    const angle = data.initialAngle + t * data.orbitSpeed
    groupRef.current.position.x = Math.cos(angle) * data.orbitRadius
    groupRef.current.position.z = Math.sin(angle) * data.orbitRadius
    groupRef.current.position.y = Math.sin(angle * 0.5) * 0.3

    // Self rotation
    meshRef.current.rotation.y += data.rotationSpeed * 0.005
  })

  const handlePointerOver = (e) => {
    e.stopPropagation()
    setHovered(true)
    document.body.style.cursor = 'pointer'
    const nativeEvent = e.nativeEvent || e
    onHover?.(data, { clientX: nativeEvent.clientX, clientY: nativeEvent.clientY })
  }

  const handlePointerOut = (e) => {
    e.stopPropagation()
    setHovered(false)
    document.body.style.cursor = 'auto'
    onUnhover?.()
  }

  const handleClick = (e) => {
    e.stopPropagation()
    window.open(data.url, '_blank', 'noopener')
  }

  return (
    <group ref={groupRef}>
      {/* Planet mesh */}
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        scale={hovered ? 1.15 : 1}
      >
        <sphereGeometry args={[data.size, 32, 32]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Glow ring on hover */}
      {hovered && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[data.size * 1.3, data.size * 1.5, 64]} />
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Atmosphere glow */}
      <mesh scale={1.08}>
        <sphereGeometry args={[data.size, 32, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={hovered ? 0.15 : 0.06}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Name label */}
      {hovered && (
        <Html
          position={[0, data.size + 0.6, 0]}
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(15, 10, 40, 0.9)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              padding: '4px 10px',
              fontFamily: "'Space Mono', monospace",
              fontSize: '12px',
              color: '#c4b5fd',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(10px)',
            }}
          >
            {data.name}
          </div>
        </Html>
      )}
    </group>
  )
}
