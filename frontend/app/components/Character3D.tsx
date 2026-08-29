'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildCharacter, CharacterOptions } from '@/lib/character3d'

interface Character3DProps extends CharacterOptions {
  height?: number
  /** Let the user spin the character. Off for small inline avatars. */
  interactive?: boolean
  className?: string
}

/**
 * Real-time 3D character view.
 *
 * Import this with next/dynamic({ ssr: false }) — three.js touches window and
 * must not run during SSR, and keeping it dynamic keeps ~600KB out of the
 * initial bundle for every page that never shows a character.
 */
export default function Character3D({
  height = 340,
  interactive = true,
  className = '',
  ...opts
}: Character3DProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth || 300
    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
    camera.position.set(0, 0.25, 4.1)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // uncapped DPR melts phones
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    // Three-point lighting is what separates this from a flat sprite: a warm
    // key, a cool fill so shadowed sides keep colour, and a rim to lift the
    // silhouette off the background.
    scene.add(new THREE.AmbientLight(0xffffff, 0.62))
    const key = new THREE.DirectionalLight(0xfff2d6, 1.5)
    key.position.set(2.4, 3.2, 3.0)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xbfd4ff, 0.55)
    fill.position.set(-3.0, 0.8, 1.6)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 0.85)
    rim.position.set(-1.2, 2.0, -3.0)
    scene.add(rim)

    const { group, dispose: disposeChar } = buildCharacter(opts)
    scene.add(group)

    let controls: OrbitControls | null = null
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enablePan = false
      controls.enableZoom = false          // scroll must still scroll the page
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.minPolarAngle = Math.PI * 0.28  // don't let it be spun underneath
      controls.maxPolarAngle = Math.PI * 0.60
      controls.rotateSpeed = 0.8
    }

    // Only render while actually on screen. A permanently-running rAF loop
    // drains battery on a page the user has scrolled away from.
    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0.05 })
    io.observe(mount)

    let raf = 0
    const clock = new THREE.Clock()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible || document.hidden) return
      const t = clock.getElapsedTime()
      // Idle motion so it reads as alive rather than a still render.
      group.position.y += Math.sin(t * 1.6) * 0.0006
      if (!interactive) group.rotation.y = Math.sin(t * 0.4) * 0.45
      controls?.update()
      renderer.render(scene, camera)
    }
    tick()

    const onResize = () => {
      const w = mount.clientWidth || width
      camera.aspect = w / height
      camera.updateProjectionMatrix()
      renderer.setSize(w, height)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('resize', onResize)
      controls?.dispose()
      disposeChar()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
    // Rebuild when any visual choice changes.
  }, [opts.bodyType, opts.hairStyle, opts.hairColor, opts.skinColor, height, interactive])

  return (
    <div
      ref={mountRef}
      className={`w-full overflow-hidden rounded-2xl ${className}`}
      style={{
        height,
        background: 'linear-gradient(180deg, #dbeafe 0%, #ede9fe 55%, #fae8ff 100%)',
        touchAction: interactive ? 'none' : 'auto',
      }}
      aria-label="Your character in 3D"
      role="img"
    />
  )
}
