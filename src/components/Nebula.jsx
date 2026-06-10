import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { noiseLib } from '../shaders/noise.js'

const vertexShader = /* glsl */ `
varying vec3 vDir;

void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = noiseLib + /* glsl */ `
uniform float uTime;
varying vec3 vDir;

void main() {
  vec3 dir = normalize(vDir);

  // Layered, domain-warped fbm over the view direction
  float n1 = fbm(dir * 2.2 + vec3(uTime * 0.004));
  float n2 = fbm(dir * 4.5 - uTime * 0.002 + n1 * 0.6);
  float n3 = fbm4(dir * 7.5 + vec3(n2 * 0.8, n1 * 0.5, uTime * 0.003));

  // Faint band of higher density along a tilted great circle
  vec3 bandNormal = normalize(vec3(0.35, 0.85, 0.25));
  float bd = dot(dir, bandNormal);
  float band = exp(-bd * bd * 14.0);
  band *= 0.55 + 0.45 * smoothstep(-0.4, 0.6, n2);

  float d1 = smoothstep(0.12, 0.78, n1 + band * 0.35);
  float d2 = smoothstep(0.22, 0.85, n2 + band * 0.2);
  float crossBands = d1 * d2;

  vec3 base = vec3(0.0118, 0.0, 0.0784);    // #030014 near-black
  vec3 violet = vec3(0.180, 0.063, 0.396);  // #2e1065
  vec3 blue = vec3(0.090, 0.145, 0.329);    // #172554
  vec3 teal = vec3(0.075, 0.306, 0.290);    // #134e4a
  vec3 magenta = vec3(0.439, 0.102, 0.459); // #701a75

  vec3 col = base;
  col = mix(col, violet, d1 * 0.8);
  col = mix(col, blue, d2 * 0.65);
  // Teal and magenta accents only where the noise bands cross
  col += teal * crossBands * smoothstep(0.45, 0.9, n3 * 0.5 + 0.5) * 0.4;
  col += magenta * crossBands * smoothstep(0.55, 0.95, n1 * 0.5 + 0.5) * 0.5;

  // Subtle veil: most of the sky near 0, peaks around 0.32
  float alpha = smoothstep(0.08, 0.95, d1 * 0.55 + d2 * 0.45 + band * 0.25);
  alpha *= 0.32;

  gl_FragColor = vec4(col, alpha);
}
`

export default function Nebula() {
  const meshRef = useRef()
  const matRef = useRef()

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (meshRef.current) meshRef.current.rotation.y = t * 0.001
    if (matRef.current) matRef.current.uniforms.uTime.value = t
  })

  return (
    <mesh ref={meshRef} renderOrder={-3}>
      <sphereGeometry args={[600, 48, 32]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}
