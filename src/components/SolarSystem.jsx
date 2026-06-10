import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  GodRays,
  Vignette,
} from '@react-three/postprocessing'
import * as THREE from 'three'
import Sun from './Sun'
import Planet from './Planet'
import Starfield from './Starfield'
import Nebula from './Nebula'
import AsteroidBelt from './AsteroidBelt'
import Comets from './Comets'
import CameraRig from './CameraRig'

export default function SolarSystem({ planets, username, onHoverPlanet, onUnhoverPlanet }) {
  // GodRays needs the actual sun mesh, so capture it via callback ref
  const [sunMesh, setSunMesh] = useState(null)

  // Camera distance based on the outermost planet orbit
  const maxOrbit = planets.length > 0
    ? Math.max(...planets.map((p) => p.orbitRadius))
    : 20
  const cameraZ = maxOrbit * 0.9 + 10

  return (
    <Canvas
      camera={{ position: [0, cameraZ * 0.5, cameraZ], fov: 50, near: 0.1, far: 2000 }}
      dpr={[1, 2]}
      style={{ position: 'fixed', inset: 0 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor('#030014')
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.1
      }}
    >
      <Suspense fallback={null}>
        {/* Dim cosmic fill — the sun does the real lighting */}
        <ambientLight intensity={0.1} color="#c4b5fd" />

        {/* Deep-space backdrop */}
        <Nebula />
        <Starfield />

        {/* The Sun at center (represents the user) */}
        <Sun ref={setSunMesh} username={username} />

        {/* Planets — each renders its own tilted orbit + trail */}
        {planets.map((planet) => (
          <Planet
            key={planet.id}
            data={planet}
            onHover={onHoverPlanet}
            onUnhover={onUnhoverPlanet}
          />
        ))}

        {/* Outer asteroid belt and wandering comets */}
        <AsteroidBelt innerRadius={maxOrbit + 5} outerRadius={maxOrbit + 11} />
        <Comets maxOrbit={maxOrbit} />

        {/* Cinematic fly-in when a system loads */}
        <CameraRig trigger={planets.length > 0 ? username : ''} cameraZ={cameraZ} />

        {/* Camera controls */}
        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={5}
          maxDistance={cameraZ * 2.5}
          autoRotate
          autoRotateSpeed={0.25}
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI * 0.85}
        />

        {/* Post-processing: god rays from the sun, bloom, subtle lens artifacts */}
        {sunMesh && (
          <EffectComposer multisampling={0}>
            <GodRays
              sun={sunMesh}
              samples={60}
              density={0.97}
              decay={0.94}
              weight={0.25}
              exposure={0.28}
              clampMax={1}
              blur
            />
            <Bloom
              intensity={0.85}
              luminanceThreshold={0.2}
              luminanceSmoothing={0.6}
              mipmapBlur
              radius={0.75}
            />
            <ChromaticAberration
              offset={[0.0006, 0.0006]}
              radialModulation
              modulationOffset={0.4}
            />
            <Vignette eskil={false} offset={0.22} darkness={0.62} />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  )
}
