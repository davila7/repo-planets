import { useMemo, useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Tiny seeded PRNG so the belt layout is identical across re-renders
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function AsteroidBelt({ innerRadius, outerRadius, count = 700 }) {
  const groupRef = useRef()
  const meshRef = useRef()

  // Hoisted temporaries — never allocated in effects per-instance or in useFrame
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colorA = useMemo(() => new THREE.Color('#8a8694'), [])
  const colorB = useMemo(() => new THREE.Color('#7d6e63'), [])
  const tmpColor = useMemo(() => new THREE.Color(), [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const rand = mulberry32(0xbe17)

    for (let i = 0; i < count; i++) {
      // Triangular distribution -> density peaks mid-belt, soft falloff at edges
      const t = (rand() + rand()) * 0.5
      const radius = innerRadius + t * (outerRadius - innerRadius)
      const angle = rand() * Math.PI * 2

      // Roughly gaussian vertical scatter (+-0.8) via sum of uniforms
      const y = (rand() + rand() + rand() + rand() - 2) * 0.8

      // Power-law sizes: many pebbles, few boulders
      const scale = 0.04 + Math.pow(rand(), 3) * 0.18

      dummy.position.set(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      )
      dummy.rotation.set(
        rand() * Math.PI * 2,
        rand() * Math.PI * 2,
        rand() * Math.PI * 2
      )
      // Slightly anisotropic so rocks read as rubble, not spheres
      dummy.scale.set(
        scale * (0.7 + rand() * 0.6),
        scale * (0.7 + rand() * 0.6),
        scale * (0.7 + rand() * 0.6)
      )
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      // Gray-brown variation between the two base tones, with value jitter
      tmpColor.copy(colorA).lerp(colorB, rand())
      tmpColor.multiplyScalar(0.7 + rand() * 0.55)
      mesh.setColorAt(i, tmpColor)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [count, innerRadius, outerRadius, dummy, colorA, colorB, tmpColor])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.006
    }
  })

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        args={[null, null, count]}
        frustumCulled={false}
      >
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.95} metalness={0.05} />
      </instancedMesh>
    </group>
  )
}
