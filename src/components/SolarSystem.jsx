import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import Sun from './Sun'
import Planet from './Planet'
import OrbitRing from './OrbitRing'
import Starfield from './Starfield'

export default function SolarSystem({ planets, username, onHoverPlanet, onUnhoverPlanet }) {
  // Camera distance based on the outermost planet orbit
  const maxOrbit = planets.length > 0
    ? Math.max(...planets.map((p) => p.orbitRadius))
    : 20
  const cameraZ = maxOrbit * 0.9 + 10

  return (
    <Canvas
      camera={{ position: [0, cameraZ * 0.5, cameraZ], fov: 50, near: 0.1, far: 500 }}
      style={{ position: 'fixed', inset: 0 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor('#030014')
        gl.toneMapping = 2 // ACESFilmic
        gl.toneMappingExposure = 1.2
      }}
    >
      <Suspense fallback={null}>
        {/* Ambient and directional fill */}
        <ambientLight intensity={0.15} color="#c4b5fd" />
        <directionalLight position={[10, 10, 5]} intensity={0.3} color="#e2d9f3" />

        {/* Stars in the background */}
        <Starfield />

        {/* The Sun at center (represents the user) */}
        <Sun username={username} />

        {/* Orbit rings */}
        {planets.map((planet) => (
          <OrbitRing key={`orbit-${planet.id}`} radius={planet.orbitRadius} />
        ))}

        {/* Planets */}
        {planets.map((planet) => (
          <Planet
            key={planet.id}
            data={planet}
            onHover={onHoverPlanet}
            onUnhover={onUnhoverPlanet}
          />
        ))}

        {/* Camera controls */}
        <OrbitControls
          enablePan={false}
          minDistance={5}
          maxDistance={cameraZ * 2}
          autoRotate
          autoRotateSpeed={0.3}
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI * 0.85}
        />

        {/* Post-processing bloom for that glowy space feel */}
        <EffectComposer>
          <Bloom
            intensity={0.5}
            luminanceThreshold={0.6}
            luminanceSmoothing={0.9}
            radius={0.8}
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
