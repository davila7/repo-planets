import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Small seeded PRNG so the field is identical across re-renders
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

// Realistic stellar temperature palette (normalized RGB) with weights
const STAR_PALETTE = [
  { color: [0.792, 0.843, 1.0], weight: 0.3 }, // blue-white #cad7ff
  { color: [0.973, 0.969, 1.0], weight: 0.25 }, // blue-white #f8f7ff
  { color: [1.0, 0.957, 0.918], weight: 0.25 }, // warm white-yellow #fff4ea
  { color: [1.0, 0.824, 0.631], weight: 0.12 }, // orange #ffd2a1
  { color: [1.0, 0.8, 0.624], weight: 0.08 }, // reddish #ffcc9f
]

const GALAXY_TINTS = [
  { r: 255, g: 211, b: 168 }, // warm
  { r: 168, g: 198, b: 255 }, // blue
  { r: 199, g: 164, b: 255 }, // violet
  { r: 222, g: 176, b: 255 }, // pale violet
]

function pickStarColor(rand) {
  const t = rand()
  let acc = 0
  for (let i = 0; i < STAR_PALETTE.length; i++) {
    acc += STAR_PALETTE[i].weight
    if (t <= acc) return STAR_PALETTE[i].color
  }
  return STAR_PALETTE[0].color
}

// Distant galaxy impostor: radial core + elliptical smear on a canvas
function makeGalaxyTexture(tint) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const half = size / 2

  // Elliptical disk smear
  ctx.save()
  ctx.translate(half, half)
  ctx.scale(1, 0.38)
  const disk = ctx.createRadialGradient(0, 0, 0, 0, 0, half)
  disk.addColorStop(0, `rgba(${tint.r}, ${tint.g}, ${tint.b}, 0.85)`)
  disk.addColorStop(0.3, `rgba(${tint.r}, ${tint.g}, ${tint.b}, 0.32)`)
  disk.addColorStop(0.7, `rgba(${tint.r}, ${tint.g}, ${tint.b}, 0.08)`)
  disk.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = disk
  ctx.fillRect(-half, -half, size, size)
  ctx.restore()

  // Soft round halo
  const halo = ctx.createRadialGradient(half, half, 0, half, half, half * 0.55)
  halo.addColorStop(0, `rgba(${tint.r}, ${tint.g}, ${tint.b}, 0.25)`)
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, size, size)

  // Bright core
  const core = ctx.createRadialGradient(half, half, 0, half, half, size * 0.1)
  core.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  core.addColorStop(0.4, `rgba(${tint.r}, ${tint.g}, ${tint.b}, 0.5)`)
  core.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = core
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const starVertexShader = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute vec2 aTwinkle;
varying vec3 vColor;
varying vec2 vTwinkle;
varying float vBoost;

void main() {
  vColor = aColor;
  vTwinkle = aTwinkle;
  // Largest size bucket gets an HDR boost so bloom gives it a halo
  vBoost = 1.0 + smoothstep(2.0, 2.6, aSize) * 0.9;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * (320.0 / -mvPosition.z), 1.0, 14.0);
  gl_Position = projectionMatrix * mvPosition;
}
`

const starFragmentShader = /* glsl */ `
uniform float uTime;
varying vec3 vColor;
varying vec2 vTwinkle;
varying float vBoost;

void main() {
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (d > 1.0) discard;
  float falloff = smoothstep(1.0, 0.0, d);
  falloff *= falloff;
  float brightness = 0.7 + 0.3 * sin(uTime * vTwinkle.y + vTwinkle.x);
  gl_FragColor = vec4(vColor * brightness * vBoost, falloff);
}
`

export default function Starfield({ count = 5000 }) {
  const groupRef = useRef()
  const matRef = useRef()

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  const { positions, sizes, colors, twinkles } = useMemo(() => {
    const rand = mulberry32(0x51a7f1e1 + count)
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    const twinkles = new Float32Array(count * 2)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      // Uniform direction on the sphere, shell radius 150-500
      const theta = rand() * Math.PI * 2
      const cosPhi = rand() * 2 - 1
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi))
      const radius = 150 + rand() * 350

      positions[i3] = radius * sinPhi * Math.cos(theta)
      positions[i3 + 1] = radius * cosPhi
      positions[i3 + 2] = radius * sinPhi * Math.sin(theta)

      // Power-law sizes: most stars small, a handful large
      const s = rand()
      sizes[i] = 0.6 + 2.0 * s * s * s

      const base = pickStarColor(rand)
      const jitter = 0.9 + rand() * 0.2
      colors[i3] = Math.min(base[0] * jitter + (rand() - 0.5) * 0.04, 1.0)
      colors[i3 + 1] = Math.min(base[1] * jitter + (rand() - 0.5) * 0.04, 1.0)
      colors[i3 + 2] = Math.min(base[2] * jitter + (rand() - 0.5) * 0.04, 1.0)

      twinkles[i * 2] = rand() * Math.PI * 2
      twinkles[i * 2 + 1] = 0.5 + rand() * 2.5
    }

    return { positions, sizes, colors, twinkles }
  }, [count])

  const galaxies = useMemo(() => {
    const rand = mulberry32(0x9e3779b9)
    return GALAXY_TINTS.map((tint) => {
      const theta = rand() * Math.PI * 2
      const cosPhi = rand() * 1.6 - 0.8
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi))
      const radius = 450
      const scale = 30 + rand() * 30
      return {
        texture: makeGalaxyTexture(tint),
        position: [
          radius * sinPhi * Math.cos(theta),
          radius * cosPhi,
          radius * sinPhi * Math.sin(theta),
        ],
        scale: [scale, scale * (0.75 + rand() * 0.25), 1],
        opacity: 0.18 + rand() * 0.12,
        rotation: rand() * Math.PI * 2,
      }
    })
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (groupRef.current) groupRef.current.rotation.y = t * 0.002
    if (matRef.current) matRef.current.uniforms.uTime.value = t
  })

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry key={count}>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
          <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
          <bufferAttribute attach="attributes-aTwinkle" args={[twinkles, 2]} />
        </bufferGeometry>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={starVertexShader}
          fragmentShader={starFragmentShader}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
          depthTest
        />
      </points>
      {galaxies.map((g, i) => (
        <sprite key={i} position={g.position} scale={g.scale} renderOrder={-2}>
          <spriteMaterial
            map={g.texture}
            transparent
            opacity={g.opacity}
            rotation={g.rotation}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  )
}
