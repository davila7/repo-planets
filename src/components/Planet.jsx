import { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { getLanguageColor } from '../services/languageColors'
import { noiseLib } from '../shaders/noise.js'
import OrbitRing from './OrbitRing'

// Procedural shader planet on a tilted elliptical orbit with a fading
// motion trail, fresnel atmosphere, drifting clouds, rings and moons.

const TYPE_INDEX = { gas: 0, rocky: 1, ice: 2, lava: 3, dead: 4 }

const SPAWN_DURATION = 0.7
const SPAWN_STAGGER = 0.08

function fract(x) {
  return x - Math.floor(x)
}

function easeOutBack(x) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const planetVertexShader = `
varying vec3 vObjPos;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vObjPos = position;
  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const surfaceFragmentShader = noiseLib + `
uniform vec3 uColor;
uniform float uTime;
uniform float uSeed;
uniform int uType;
uniform float uHover;
uniform float uActivity;
varying vec3 vObjPos;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(-vWorldPos); // sun sits at world origin
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 p = normalize(vObjPos);

  float ndl = dot(N, L);
  float diffuse = smoothstep(-0.08, 0.25, ndl);
  float light = 0.07 + 0.93 * diffuse;

  vec3 surf = uColor;
  vec3 emissive = vec3(0.0);
  float spec = 0.0;

  if (uType == 0) {
    // Gas giant: domain-warped latitude bands with slow longitudinal flow
    float warp = fbm4(p * 1.5 + uSeed * 13.0 + vec3(uTime * 0.02, 0.0, 0.0));
    float band = fbm(vec3(p.x * 0.9 + uTime * 0.03, p.y * 4.0 + warp * 1.2, p.z * 0.9 + uSeed * 29.0));
    float bv = clamp(band * 0.65 + 0.5, 0.0, 1.0);
    vec3 dark = uColor * 0.45;
    vec3 lite = uColor * 1.25 + vec3(0.08);
    surf = mix(dark, lite, bv);

    // oval storm vortices
    vec3 sc1 = normalize(vec3(sin(uSeed * 40.0), 0.35 * sin(uSeed * 73.0), cos(uSeed * 40.0)));
    float sd1 = distance(p, sc1) + snoise(p * 6.0 + uSeed * 7.0) * 0.08;
    float storm1 = 1.0 - smoothstep(0.05, 0.32, sd1);
    surf += (uColor * 0.55 + vec3(0.12)) * storm1;

    vec3 sc2 = normalize(vec3(cos(uSeed * 91.0), -0.4 * cos(uSeed * 57.0), sin(uSeed * 91.0)));
    float sd2 = distance(p, sc2) + snoise(p * 5.0 - uSeed * 11.0) * 0.07;
    float storm2 = 1.0 - smoothstep(0.04, 0.22, sd2);
    surf += (uColor * 0.4 + vec3(0.08)) * storm2;
  } else if (uType == 1) {
    // Rocky: continents above a darker ocean, glint on water, polar caps
    float h = fbm(p * 2.8 + uSeed * 17.0);
    float landMask = smoothstep(0.0, 0.05, h);
    float lum = dot(uColor, vec3(0.299, 0.587, 0.114));
    vec3 ocean = mix(uColor, vec3(lum), 0.45) * 0.4;
    vec3 lowland = uColor * 0.6;
    vec3 midland = uColor;
    vec3 highland = mix(uColor, vec3(1.0), 0.3) * 1.1;
    float th = clamp(h * 1.8, 0.0, 1.0);
    vec3 land = mix(lowland, midland, smoothstep(0.05, 0.5, th));
    land = mix(land, highland, smoothstep(0.5, 0.9, th));
    surf = mix(ocean, land, landMask);
    vec3 R = reflect(-L, N);
    spec = pow(max(dot(R, V), 0.0), 24.0) * (1.0 - landMask) * 0.8;
    float capEdge = snoise(p * 4.0 + uSeed * 23.0) * 0.1;
    float cap = smoothstep(0.72, 0.85, abs(p.y) + capEdge);
    surf = mix(surf, vec3(0.93, 0.96, 1.0), cap);
  } else if (uType == 2) {
    // Ice: pale base, ridged crack veins, frost patches
    vec3 base = mix(uColor, vec3(1.0), 0.6);
    float crack = 1.0 - abs(snoise(p * 3.2 + uSeed * 19.0));
    crack = pow(crack, 6.0);
    vec3 vein = mix(uColor * 0.5, vec3(0.25, 0.4, 0.75), 0.5);
    surf = mix(base, vein, crack * 0.65);
    float frost = smoothstep(0.3, 0.7, fbm4(p * 2.2 + uSeed * 7.0));
    surf = mix(surf, vec3(1.02), frost * 0.3);
  } else if (uType == 3) {
    // Lava: charred crust with pulsing emissive magma cracks (HDR, blooms)
    surf = uColor * 0.12;
    float ridge = 1.0 - abs(snoise(p * 3.0 + uSeed * 11.0));
    float cracks = pow(ridge, 8.0);
    float pulse = 0.7 + 0.3 * sin(uTime * 1.4 + uSeed * 20.0 + p.y * 3.0);
    float glow = 0.35 + 0.65 * uActivity;
    emissive = vec3(2.5, 1.0, 0.2) * cracks * pulse * glow;
    float ridge2 = 1.0 - abs(snoise(p * 7.5 - uSeed * 5.0));
    emissive += vec3(1.6, 0.45, 0.08) * pow(ridge2, 12.0) * 0.6 * pulse * glow;
  } else {
    // Dead: gray, cratered, low contrast, no glow
    surf = mix(uColor, vec3(0.55), 0.8);
    float c1 = smoothstep(0.45, 0.75, snoise(p * 5.0 + uSeed * 31.0));
    float c2 = smoothstep(0.5, 0.8, snoise(p * 9.0 - uSeed * 13.0));
    surf *= 1.0 - c1 * 0.28 - c2 * 0.18;
    surf += vec3(fbm4(p * 3.0 + uSeed * 9.0) * 0.06);
  }

  vec3 col = surf * light + vec3(spec * diffuse) + emissive;

  // inactive repos fade slightly toward gray
  float grayLum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(grayLum), col, 0.6 + 0.4 * uActivity);

  // hover: fresnel rim brighten in the language color (HDR -> bloom)
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uColor * fres * uHover * 1.4;

  gl_FragColor = vec4(col, 1.0);
}
`

const atmosphereFragmentShader = `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uHover;
varying vec3 vObjPos;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(-vWorldPos);
  float fres = pow(clamp(1.0 + dot(N, V), 0.0, 1.0), 3.0);
  float day = 0.45 + 0.75 * smoothstep(-0.4, 0.6, dot(N, L));
  float intensity = uIntensity * (1.0 + uHover);
  gl_FragColor = vec4(uColor * fres * intensity * day, 1.0);
}
`

const cloudFragmentShader = noiseLib + `
uniform float uSeed;
varying vec3 vObjPos;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(-vWorldPos);
  float diffuse = smoothstep(-0.08, 0.25, dot(N, L));
  float light = 0.07 + 0.93 * diffuse;
  vec3 p = normalize(vObjPos);
  float c = fbm(p * 3.5 + uSeed * 23.0);
  float alpha = smoothstep(0.1, 0.65, c) * 0.55;
  gl_FragColor = vec4(vec3(light), alpha);
}
`

const ringVertexShader = `
uniform float uInner;
uniform float uOuter;
varying float vR;
void main() {
  vR = (length(position.xy) - uInner) / (uOuter - uInner);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const ringFragmentShader = noiseLib + `
uniform vec3 uColor;
uniform float uSeed;
varying float vR;
void main() {
  float bands = snoise(vec3(vR * 16.0 + uSeed * 47.0, uSeed * 9.0, 0.0));
  float fine = snoise(vec3(vR * 60.0 - uSeed * 31.0, uSeed * 5.0, 0.0));
  float a = clamp(smoothstep(-0.35, 0.7, bands) * 0.6 + fine * 0.08, 0.0, 0.6);
  a *= smoothstep(0.0, 0.1, vR) * (1.0 - smoothstep(0.88, 1.0, vR));
  vec3 col = mix(uColor, vec3(1.0), 0.4);
  gl_FragColor = vec4(col * 0.9, a);
}
`

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Planet({ data, onHover, onUnhover }) {
  const orbitGroupRef = useRef()
  const planetRef = useRef()
  const cloudsRef = useRef()
  const moonRefs = useRef([])
  const headRef = useRef(data.initialAngle)
  const spawnStartRef = useRef(null)
  const hoverRef = useRef(0)
  const [hovered, setHovered] = useState(false)

  const langColor = getLanguageColor(data.language)
  const typeIndex = TYPE_INDEX[data.planetType] ?? 4
  const showAtmosphere = data.planetType !== 'dead'
  const showClouds =
    (data.planetType === 'rocky' || data.planetType === 'ice') && data.activity > 0.3

  const orbitB = useMemo(
    () => data.orbitRadius * Math.sqrt(1 - data.eccentricity * data.eccentricity),
    [data.orbitRadius, data.eccentricity]
  )

  const surfaceUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(langColor) },
      uTime: { value: 0 },
      uSeed: { value: data.seed },
      uType: { value: typeIndex },
      uHover: { value: 0 },
      uActivity: { value: data.activity },
    }),
    [langColor, data.seed, typeIndex, data.activity]
  )

  const atmosphereUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(langColor) },
      uIntensity: { value: 0.18 + 0.5 * data.activity },
      uHover: { value: 0 },
    }),
    [langColor, data.activity]
  )

  const cloudUniforms = useMemo(
    () => ({
      uSeed: { value: data.seed },
    }),
    [data.seed]
  )

  const ringUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(langColor) },
      uSeed: { value: data.seed },
      uInner: { value: data.size * 1.45 },
      uOuter: { value: data.size * 2.5 },
    }),
    [langColor, data.seed, data.size]
  )

  const moons = useMemo(() => {
    const arr = []
    const baseOrbit = data.hasRings ? data.size * 2.8 : data.size * 1.9
    for (let i = 0; i < data.moons; i++) {
      const color = new THREE.Color('#9ca3af')
      color.offsetHSL(0, 0, (fract(data.seed * 11.7 + i * 3.1) - 0.5) * 0.12)
      arr.push({
        orbitRadius: baseOrbit + i * 0.55 * data.size,
        size: data.size * (0.1 + fract(data.seed * 7 + i) * 0.08),
        speed: 0.4 + fract(data.seed * 13.7 + i * 2.39) * 0.6,
        phase: fract(data.seed * 29.3 + i * 0.77) * Math.PI * 2,
        tilt: (fract(data.seed * 43.1 + i * 1.13) - 0.5) * 0.35,
        color,
      })
    }
    return arr
  }, [data.moons, data.hasRings, data.size, data.seed])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // elliptical orbit
    const theta = data.initialAngle + t * data.orbitSpeed
    headRef.current = theta
    const g = orbitGroupRef.current
    if (g) {
      g.position.x = Math.cos(theta) * data.orbitRadius
      g.position.y = 0
      g.position.z = Math.sin(theta) * orbitB

      // staggered spawn pop
      if (spawnStartRef.current === null) spawnStartRef.current = t
      const st = (t - spawnStartRef.current - data.index * SPAWN_STAGGER) / SPAWN_DURATION
      if (st <= 0) {
        g.visible = false
        g.scale.setScalar(0.0001)
      } else if (st >= 1) {
        g.visible = true
        g.scale.setScalar(1)
      } else {
        g.visible = true
        g.scale.setScalar(Math.max(0.0001, easeOutBack(st)))
      }
    }

    // hover lerp -> shader uniforms
    const target = hovered ? 1 : 0
    hoverRef.current += (target - hoverRef.current) * Math.min(1, delta * 7)
    surfaceUniforms.uTime.value = t
    surfaceUniforms.uHover.value = hoverRef.current
    atmosphereUniforms.uHover.value = hoverRef.current

    // self rotation (clouds drift slightly faster)
    if (planetRef.current) {
      planetRef.current.rotation.y = data.seed * Math.PI * 2 + t * data.rotationSpeed * 0.6
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = data.seed * Math.PI * 2 + t * data.rotationSpeed * 0.78
    }

    // moons
    for (let i = 0; i < moons.length; i++) {
      const ref = moonRefs.current[i]
      if (!ref) continue
      const m = moons[i]
      const ang = m.phase + t * m.speed
      ref.position.x = Math.cos(ang) * m.orbitRadius
      ref.position.y = Math.sin(ang) * m.orbitRadius * m.tilt
      ref.position.z = Math.sin(ang) * m.orbitRadius
    }
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
    <group rotation={[data.inclination, data.ascendingNode, 0]}>
      <OrbitRing a={data.orbitRadius} e={data.eccentricity} color={langColor} headRef={headRef} />

      <group ref={orbitGroupRef}>
        {/* Planet body */}
        <mesh
          ref={planetRef}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          <sphereGeometry args={[data.size, 48, 48]} />
          <shaderMaterial
            uniforms={surfaceUniforms}
            vertexShader={planetVertexShader}
            fragmentShader={surfaceFragmentShader}
          />
        </mesh>

        {/* Atmosphere shell */}
        {showAtmosphere && (
          <mesh scale={1.13}>
            <sphereGeometry args={[data.size, 32, 32]} />
            <shaderMaterial
              uniforms={atmosphereUniforms}
              vertexShader={planetVertexShader}
              fragmentShader={atmosphereFragmentShader}
              side={THREE.BackSide}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        )}

        {/* Cloud layer */}
        {showClouds && (
          <mesh ref={cloudsRef} scale={1.04}>
            <sphereGeometry args={[data.size, 32, 32]} />
            <shaderMaterial
              uniforms={cloudUniforms}
              vertexShader={planetVertexShader}
              fragmentShader={cloudFragmentShader}
              side={THREE.FrontSide}
              transparent
              depthWrite={false}
            />
          </mesh>
        )}

        {/* Rings */}
        {data.hasRings && (
          <mesh rotation={[-Math.PI / 2 + 0.35 + data.seed * 0.25, 0, 0.15]}>
            <ringGeometry args={[data.size * 1.45, data.size * 2.5, 96]} />
            <shaderMaterial
              uniforms={ringUniforms}
              vertexShader={ringVertexShader}
              fragmentShader={ringFragmentShader}
              side={THREE.DoubleSide}
              transparent
              depthWrite={false}
            />
          </mesh>
        )}

        {/* Moons */}
        {moons.map((m, i) => (
          <mesh
            key={i}
            ref={(el) => {
              moonRefs.current[i] = el
            }}
          >
            <sphereGeometry args={[m.size, 12, 12]} />
            <meshStandardMaterial color={m.color} roughness={0.9} metalness={0.05} />
          </mesh>
        ))}

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
    </group>
  )
}
