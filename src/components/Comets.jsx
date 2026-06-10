import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 240
const TWO_PI = Math.PI * 2

const tailVertexShader = /* glsl */ `
attribute float aLife;
attribute float aSize;
attribute float aSeed;
varying float vLife;
varying float vSeed;

void main() {
  vLife = aLife;
  vSeed = aSeed;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(64.0, aSize * aLife * (260.0 / -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;
}
`

const tailFragmentShader = /* glsl */ `
varying float vLife;
varying float vSeed;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  float falloff = smoothstep(1.0, 0.0, d);
  falloff *= falloff;

  // HDR blue-white at birth -> faint violet at death
  vec3 birth = vec3(1.2, 1.6, 2.2);
  vec3 death = vec3(0.42, 0.22, 0.65);
  vec3 col = mix(death, birth, vLife);
  col *= 0.8 + 0.4 * fract(vSeed * 7.13);

  float alpha = vLife * falloff;
  gl_FragColor = vec4(col, alpha);
}
`

function Comet({ a, e, inclination, node, speed, phase }) {
  const nucleusGroupRef = useRef()
  const pointsRef = useRef()

  const thetaRef = useRef(phase)
  const cursorRef = useRef(0)

  // Ring buffers, allocated once and mutated in place
  const buffers = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const life = new Float32Array(PARTICLE_COUNT)
    const size = new Float32Array(PARTICLE_COUNT)
    const seed = new Float32Array(PARTICLE_COUNT)
    const velocities = new Float32Array(PARTICLE_COUNT * 3)
    const decay = new Float32Array(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      seed[i] = (i * 0.61803398875) % 1
    }
    return { positions, life, size, seed, velocities, decay }
  }, [])

  // HDR colors so the nucleus blooms
  const nucleusColor = useMemo(() => new THREE.Color(1.6, 1.9, 2.4), [])
  const glowColor = useMemo(() => new THREE.Color(0.6, 0.85, 1.4), [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const { positions, life, size, velocities, decay } = buffers

    // Advance along the ellipse, sweeping faster near perihelion (Kepler-ish)
    const p = a * (1 - e * e)
    let theta = thetaRef.current
    let r = p / (1 + e * Math.cos(theta))
    const sweep = Math.min(6, Math.pow(a / r, 1.5))
    theta += speed * sweep * dt
    if (theta > TWO_PI) theta -= TWO_PI
    thetaRef.current = theta

    r = p / (1 + e * Math.cos(theta))
    const x = r * Math.cos(theta)
    const z = r * Math.sin(theta)

    if (nucleusGroupRef.current) {
      nucleusGroupRef.current.position.set(x, 0, z)
    }

    // Direction pushed AWAY from the sun (origin of this tilted frame)
    const invLen = 1 / Math.max(0.0001, Math.sqrt(x * x + z * z))
    const dx = x * invLen
    const dz = z * invLen

    // Spawn 3-5 particles at the nucleus (cosmetic jitter may use Math.random)
    const spawnCount = 3 + ((Math.random() * 3) | 0)
    for (let s = 0; s < spawnCount; s++) {
      const i = cursorRef.current
      cursorRef.current = (i + 1) % PARTICLE_COUNT
      const i3 = i * 3

      const outSpeed = 2.2 + Math.random() * 0.9
      velocities[i3] = dx * outSpeed + (Math.random() - 0.5) * 0.5
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.5
      velocities[i3 + 2] = dz * outSpeed + (Math.random() - 0.5) * 0.5

      positions[i3] = x + (Math.random() - 0.5) * 0.1
      positions[i3 + 1] = (Math.random() - 0.5) * 0.1
      positions[i3 + 2] = z + (Math.random() - 0.5) * 0.1

      life[i] = 1
      decay[i] = 0.45 + Math.random() * 0.4
      size[i] = 0.5 + Math.random() * 0.9
    }

    // Age and advect all live particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (life[i] <= 0) continue
      life[i] -= decay[i] * dt
      if (life[i] < 0) life[i] = 0
      const i3 = i * 3
      positions[i3] += velocities[i3] * dt
      positions[i3 + 1] += velocities[i3 + 1] * dt
      positions[i3 + 2] += velocities[i3 + 2] * dt
    }

    if (pointsRef.current) {
      const attrs = pointsRef.current.geometry.attributes
      attrs.position.needsUpdate = true
      attrs.aLife.needsUpdate = true
      attrs.aSize.needsUpdate = true
    }
  })

  return (
    <group rotation={[inclination, node, 0]}>
      <group ref={nucleusGroupRef}>
        <mesh>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshBasicMaterial color={nucleusColor} toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.34, 16, 16]} />
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
          <bufferAttribute attach="attributes-aLife" args={[buffers.life, 1]} />
          <bufferAttribute attach="attributes-aSize" args={[buffers.size, 1]} />
          <bufferAttribute attach="attributes-aSeed" args={[buffers.seed, 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={tailVertexShader}
          fragmentShader={tailFragmentShader}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}

export default function Comets({ maxOrbit }) {
  // Deterministic orbit parameters, recomputed when the system grows/shrinks
  const comets = useMemo(() => ([
    {
      a: maxOrbit * 0.95,
      e: 0.72,
      inclination: 0.38,
      node: 0.7,
      speed: 0.05,
      phase: 0.4
    },
    {
      a: maxOrbit * 1.18,
      e: 0.65,
      inclination: -0.3,
      node: 2.3,
      speed: 0.038,
      phase: 3.6
    }
  ]), [maxOrbit])

  return (
    <group>
      {comets.map((c, i) => (
        <Comet key={i} {...c} />
      ))}
    </group>
  )
}
