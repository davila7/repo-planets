import { forwardRef, useRef, useMemo, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { noiseLib } from '../shaders/noise.js'

// Deterministic PRNG so the prominence layout is stable across re-renders
function mulberry32(seed) {
  let a = seed | 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const coreVertexShader = /* glsl */ `
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vViewPos;

void main() {
  vPos = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`

const coreFragmentShader = noiseLib + /* glsl */ `
uniform float uTime;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vViewPos;

void main() {
  vec3 p = vPos;

  // Large convection cells, slowly churning
  float base = fbm(p * 2.2 + vec3(uTime * 0.12, uTime * 0.08, -uTime * 0.06));

  // Ridged second octave for fine granulation
  float ridge = 1.0 - abs(fbm4(p * 4.6 - vec3(uTime * 0.06, 0.0, uTime * 0.1)));
  ridge = ridge * ridge;

  float heat = 0.5 + 0.5 * base;
  heat = clamp(heat * 0.72 + ridge * 0.42, 0.0, 1.0);

  // Color ramp: deep ember -> orange -> near-white hot cells
  vec3 ember = vec3(0.604, 0.204, 0.071);
  vec3 orange = vec3(0.961, 0.620, 0.043);
  vec3 hot = vec3(1.0, 0.969, 0.878);
  vec3 col = mix(ember, orange, smoothstep(0.12, 0.6, heat));
  col = mix(col, hot, smoothstep(0.64, 0.96, heat));

  // HDR boost so the hottest cells push past 1.0 and feed Bloom / GodRays
  col *= 1.4 + 1.0 * smoothstep(0.6, 0.98, heat);

  // Limb darkening: edges slightly darker and redder, like a real star
  vec3 viewDir = normalize(-vViewPos);
  float mu = clamp(dot(normalize(vNormal), viewDir), 0.0, 1.0);
  float limb = 0.6 + 0.4 * pow(mu, 0.85);
  col *= limb;
  col = mix(col * vec3(1.0, 0.7, 0.5), col, smoothstep(0.0, 0.45, mu));

  gl_FragColor = vec4(col, 1.0);
}
`

const coronaVertexShader = /* glsl */ `
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vViewPos;

void main() {
  vPos = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`

const coronaFragmentShader = noiseLib + /* glsl */ `
uniform float uTime;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vViewPos;

void main() {
  vec3 viewDir = normalize(-vViewPos);
  vec3 n = normalize(vNormal);

  // Back-face shell: the outward normal points away from the camera, so
  // -dot(viewDir, n) is 1 behind the core and falls to 0 at the outer
  // silhouette. The fresnel-style power gives a halo that is brightest at
  // the limb of the core and fades smoothly to nothing.
  float rim = clamp(-dot(viewDir, n), 0.0, 1.0);
  float fresnel = pow(rim, 2.5);

  // Slow drifting wisps so the corona edge shimmers
  vec3 dir = normalize(vPos);
  float w1 = snoise(dir * 3.0 + vec3(0.0, uTime * 0.05, uTime * 0.035));
  float w2 = snoise(dir * 6.5 - vec3(uTime * 0.07, 0.0, uTime * 0.045));
  float wisp = 0.7 + 0.22 * w1 + 0.14 * w2;

  float intensity = fresnel * wisp;
  vec3 coronaColor = vec3(1.6, 0.78, 0.28);

  gl_FragColor = vec4(coronaColor * intensity, clamp(intensity, 0.0, 1.0));
}
`

const prominenceVertexShader = /* glsl */ `
attribute float aPhase;
attribute float aSpeed;
attribute float aSize;
uniform float uTime;
uniform float uPixelRatio;
varying float vFlicker;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  // Per-point flicker, biased toward dim so embers only occasionally flare
  float f = 0.5 + 0.5 * sin(uTime * aSpeed + aPhase);
  vFlicker = 0.18 + 0.82 * f * f;

  gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPosition.z) * (0.8 + 0.35 * vFlicker);
  gl_Position = projectionMatrix * mvPosition;
}
`

const prominenceFragmentShader = /* glsl */ `
varying float vFlicker;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv) * 2.0;
  float falloff = smoothstep(1.0, 0.0, d);
  falloff *= falloff;

  vec3 cool = vec3(1.3, 0.42, 0.1);
  vec3 hot = vec3(1.9, 1.25, 0.55);
  vec3 col = mix(cool, hot, vFlicker);

  gl_FragColor = vec4(col * vFlicker, falloff * vFlicker);
}
`

const PROMINENCE_COUNT = 42

export default forwardRef(function Sun({ username }, ref) {
  const coreRef = useRef()
  const promRef = useRef()
  const coreMatRef = useRef()
  const coronaMatRef = useRef()
  const promMatRef = useRef()

  // The forwarded ref must point at the opaque core mesh (GodRays occluder),
  // while we keep a local ref for rotation.
  const setCoreRef = useCallback(
    (node) => {
      coreRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  const coreUniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const coronaUniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const promUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) }
    }),
    []
  )

  // Embers on a shell just above the surface, seeded by username
  const prominences = useMemo(() => {
    const rand = mulberry32(hashString(username || 'repo-planets'))
    const positions = new Float32Array(PROMINENCE_COUNT * 3)
    const phases = new Float32Array(PROMINENCE_COUNT)
    const speeds = new Float32Array(PROMINENCE_COUNT)
    const sizes = new Float32Array(PROMINENCE_COUNT)

    for (let i = 0; i < PROMINENCE_COUNT; i++) {
      const theta = rand() * Math.PI * 2
      const cosPhi = rand() * 2 - 1
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi))
      const radius = 2.32 + rand() * 0.45

      positions[i * 3] = sinPhi * Math.cos(theta) * radius
      positions[i * 3 + 1] = cosPhi * radius
      positions[i * 3 + 2] = sinPhi * Math.sin(theta) * radius

      phases[i] = rand() * Math.PI * 2
      speeds[i] = 0.5 + rand() * 1.1
      sizes[i] = 0.25 + rand() * 0.35
    }

    return { positions, phases, speeds, sizes }
  }, [username])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    if (coreRef.current) coreRef.current.rotation.y += delta * 0.04
    if (promRef.current) promRef.current.rotation.y = t * 0.03
    if (coreMatRef.current) coreMatRef.current.uniforms.uTime.value = t
    if (coronaMatRef.current) coronaMatRef.current.uniforms.uTime.value = t
    if (promMatRef.current) promMatRef.current.uniforms.uTime.value = t
  })

  return (
    <group>
      {/* Core: opaque, depth-writing — the GodRays occluder/light source */}
      <mesh ref={setCoreRef}>
        <sphereGeometry args={[2.2, 64, 64]} />
        <shaderMaterial
          ref={coreMatRef}
          uniforms={coreUniforms}
          vertexShader={coreVertexShader}
          fragmentShader={coreFragmentShader}
          transparent={false}
        />
      </mesh>

      {/* Corona: back-side shell with shimmering fresnel falloff */}
      <mesh scale={1.4}>
        <sphereGeometry args={[2.2, 48, 48]} />
        <shaderMaterial
          ref={coronaMatRef}
          uniforms={coronaUniforms}
          vertexShader={coronaVertexShader}
          fragmentShader={coronaFragmentShader}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Prominences: embers dancing just above the surface */}
      <points ref={promRef}>
        <bufferGeometry key={username || 'repo-planets'}>
          <bufferAttribute attach="attributes-position" args={[prominences.positions, 3]} />
          <bufferAttribute attach="attributes-aPhase" args={[prominences.phases, 1]} />
          <bufferAttribute attach="attributes-aSpeed" args={[prominences.speeds, 1]} />
          <bufferAttribute attach="attributes-aSize" args={[prominences.sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={promMatRef}
          uniforms={promUniforms}
          vertexShader={prominenceVertexShader}
          fragmentShader={prominenceFragmentShader}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </points>

      {/* Scene lighting for moons/asteroids with standard materials */}
      <pointLight color="#fde68a" intensity={2.2} distance={250} decay={0.6} />
      <pointLight color="#fb923c" intensity={0.9} distance={120} decay={1} />
    </group>
  )
})
