import { useEffect, useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

// Cinematic fly-in: when a new system loads, the camera starts far out
// and sweeps down into viewing position while controls are paused.
export default function CameraRig({ trigger, cameraZ }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)

  const anim = useMemo(
    () => ({
      active: false,
      t: 0,
      duration: 3.2,
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
    }),
    []
  )
  const controlsRef = useRef(controls)
  controlsRef.current = controls

  useEffect(() => {
    if (!trigger) return
    anim.to.set(0, cameraZ * 0.45, cameraZ)
    anim.from.set(cameraZ * 1.6, cameraZ * 1.9, cameraZ * 2.4)
    anim.t = 0
    anim.active = true
    camera.position.copy(anim.from)
    camera.lookAt(0, 0, 0)
    if (controlsRef.current) controlsRef.current.enabled = false
  }, [trigger, cameraZ, anim, camera])

  useFrame((state, delta) => {
    if (!anim.active) return
    anim.t = Math.min(1, anim.t + delta / anim.duration)
    const k = easeInOutCubic(anim.t)
    camera.position.lerpVectors(anim.from, anim.to, k)
    camera.lookAt(0, 0, 0)
    if (anim.t >= 1) {
      anim.active = false
      const c = controlsRef.current
      if (c) {
        c.enabled = true
        c.target.set(0, 0, 0)
        c.update()
      }
    }
  })

  return null
}
