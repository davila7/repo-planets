import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Fading motion trail along an elliptical orbit.
// A flat ribbon (triangle strip) in the local XZ plane whose alpha fades
// from bright at the planet head to nothing ~2.4 rad behind it, plus a
// faint constant base so the whole orbit stays barely visible.

const SEGMENTS = 256

const vertexShader = `
attribute float aAngle;
attribute float aAcross;
varying float vAngle;
varying float vAcross;
void main() {
  vAngle = aAngle;
  vAcross = aAcross;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform float uHead;
uniform vec3 uColor;
varying float vAngle;
varying float vAcross;
void main() {
  float d = mod(uHead - vAngle, 6.2831853);
  float trail = smoothstep(2.4, 0.0, d);
  float base = 0.045;
  float edge = smoothstep(0.0, 0.25, vAcross) * smoothstep(1.0, 0.75, vAcross);
  float alpha = (base + trail * 0.5) * edge;
  vec3 col = uColor * (1.0 + trail);
  gl_FragColor = vec4(col, alpha);
}
`

export default function OrbitRing({ a, e, color, headRef }) {
  const geometry = useMemo(() => {
    const b = a * Math.sqrt(1 - e * e)
    const halfWidth = Math.max(0.04, a * 0.0035)
    const count = (SEGMENTS + 1) * 2
    const positions = new Float32Array(count * 3)
    const angles = new Float32Array(count)
    const across = new Float32Array(count)
    const indices = new Uint16Array(SEGMENTS * 6)

    for (let i = 0; i <= SEGMENTS; i++) {
      const theta = (i / SEGMENTS) * Math.PI * 2
      const x = Math.cos(theta) * a
      const z = Math.sin(theta) * b
      const len = Math.sqrt(x * x + z * z) || 1
      const nx = x / len
      const nz = z / len
      const vi = i * 2
      positions[vi * 3] = x - nx * halfWidth
      positions[vi * 3 + 1] = 0
      positions[vi * 3 + 2] = z - nz * halfWidth
      positions[vi * 3 + 3] = x + nx * halfWidth
      positions[vi * 3 + 4] = 0
      positions[vi * 3 + 5] = z + nz * halfWidth
      angles[vi] = theta
      angles[vi + 1] = theta
      across[vi] = 0
      across[vi + 1] = 1
    }

    for (let i = 0; i < SEGMENTS; i++) {
      const k = i * 2
      const ii = i * 6
      indices[ii] = k
      indices[ii + 1] = k + 1
      indices[ii + 2] = k + 2
      indices[ii + 3] = k + 1
      indices[ii + 4] = k + 3
      indices[ii + 5] = k + 2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1))
    geo.setAttribute('aAcross', new THREE.BufferAttribute(across, 1))
    geo.setIndex(new THREE.BufferAttribute(indices, 1))
    return geo
  }, [a, e])

  const uniforms = useMemo(
    () => ({
      uHead: { value: 0 },
      uColor: { value: new THREE.Color(color) },
    }),
    // color is stable per planet (derived from repo language)
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  useFrame(() => {
    if (headRef && typeof headRef.current === 'number') {
      uniforms.uHead.value = headRef.current
    }
  })

  return (
    <mesh geometry={geometry}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
