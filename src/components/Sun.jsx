import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Sun({ username }) {
  const meshRef = useRef()
  const glowRef = useRef()

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')

    // Radial gradient for sun surface
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, '#fff7ed')
    grad.addColorStop(0.3, '#fbbf24')
    grad.addColorStop(0.7, '#f59e0b')
    grad.addColorStop(1, '#d97706')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 256)

    // Sun spots
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * 256
      const y = Math.random() * 256
      const r = Math.random() * 15 + 3
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(180, 100, 0, ${Math.random() * 0.3})`
      ctx.fill()
    }

    return new THREE.CanvasTexture(canvas)
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    meshRef.current.rotation.y = t * 0.05
    // Pulsing glow
    const scale = 1.15 + Math.sin(t * 1.5) * 0.03
    glowRef.current.scale.setScalar(scale)
  })

  return (
    <group>
      {/* Sun body */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[2.2, 48, 48]} />
        <meshBasicMaterial map={texture} />
      </mesh>

      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.8, 48, 48]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Point light from sun */}
      <pointLight color="#fde68a" intensity={2} distance={100} decay={0.5} />
      <pointLight color="#f59e0b" intensity={0.8} distance={60} decay={1} />
    </group>
  )
}
