/**
 * Procedural 3D character, built from three.js primitives.
 *
 * Deliberately self-contained: no GLB downloads, no avatar service, no CDN.
 * Ready Player Me was wired in here and had already shut down, taking every
 * avatar with it — so the character is generated from code that ships in the
 * bundle and cannot go offline.
 *
 * It is stylised low-poly, not photoreal: real geometry, real materials, real
 * lighting, which is what makes it read as 3D rather than a flat sprite.
 *
 * Consumes the SAME hairStyle / hairColor / skinColor ids the vector avatar
 * uses, so a character chosen before this existed renders unchanged.
 */
import * as THREE from 'three'

export interface CharacterOptions {
  bodyType?: string   // 'tall' | 'short' | 'skip' | ''
  hairStyle?: string  // short_straight | short_curly | long_straight | long_curly | braids | buzz | none
  hairColor?: string  // 6-hex, no '#'
  skinColor?: string  // 6-hex, no '#'
}

const hex = (v: string | undefined, fallback: string) =>
  new THREE.Color(`#${(v && /^[0-9a-fA-F]{6}$/.test(v) ? v : fallback)}`)

/** Toon-ish material: matte, readable at small sizes, cheap to render. */
const skinMat = (c: THREE.Color) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.72, metalness: 0.0, flatShading: false })

const hairMat = (c: THREE.Color) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.04, flatShading: false })

/** A clump of hair — used to build curls, braids and volume. */
function strand(
  mat: THREE.Material, r: number, len: number,
  pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]
) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat)
  m.position.set(...pos)
  m.rotation.set(...rot)
  m.castShadow = true
  return m
}

function buildHair(style: string, mat: THREE.Material, headR: number): THREE.Group {
  const g = new THREE.Group()
  if (!style || style === 'none' || style === 'skip') return g

  // Skull cap common to every style with hair.
  const capDepth = style === 'buzz' ? 0.52 : 0.62
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(headR * 1.045, 32, 24, 0, Math.PI * 2, 0, Math.PI * capDepth),
    mat
  )
  cap.castShadow = true
  g.add(cap)

  const R = headR
  switch (style) {
    case 'buzz':
      break // cap alone reads as a close crop

    case 'short_straight': {
      // Slight fringe with a side part.
      const fringe = new THREE.Mesh(new THREE.BoxGeometry(R * 1.5, R * 0.30, R * 0.42), mat)
      fringe.position.set(R * 0.10, R * 0.66, R * 0.72)
      fringe.rotation.z = -0.14
      g.add(fringe)
      break
    }

    case 'short_curly': {
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2
        const tilt = 0.34 + (i % 3) * 0.18
        const curl = new THREE.Mesh(new THREE.SphereGeometry(R * 0.25, 10, 10), mat)
        curl.position.set(
          Math.cos(a) * R * 0.86,
          R * (0.36 + Math.sin(i * 1.7) * 0.26),
          Math.sin(a) * R * 0.86 * Math.cos(tilt) + R * 0.06
        )
        g.add(curl)
      }
      break
    }

    case 'long_straight': {
      const back = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.84, R * 1.5, 6, 16), mat)
      back.position.set(0, -R * 0.72, -R * 0.30)
      back.scale.set(1, 1, 0.62)
      g.add(back)
      g.add(strand(mat, R * 0.20, R * 1.25, [ R * 0.80, -R * 0.34, R * 0.24]))
      g.add(strand(mat, R * 0.20, R * 1.25, [-R * 0.80, -R * 0.34, R * 0.24]))
      break
    }

    case 'long_curly': {
      const back = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.90, R * 1.1, 6, 16), mat)
      back.position.set(0, -R * 0.58, -R * 0.30)
      back.scale.set(1, 1, 0.66)
      g.add(back)
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2
        const y = -R * (0.15 + (i % 5) * 0.30)
        const curl = new THREE.Mesh(new THREE.SphereGeometry(R * 0.29, 10, 10), mat)
        curl.position.set(Math.cos(a) * R * 0.92, y, Math.sin(a) * R * 0.66 - R * 0.16)
        g.add(curl)
      }
      break
    }

    case 'braids': {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const bead = new THREE.Mesh(new THREE.SphereGeometry(R * 0.20, 10, 10), mat)
          bead.position.set(side * R * 0.84, R * 0.30 - i * R * 0.36, R * 0.10)
          bead.scale.set(1, 0.86, 1)
          g.add(bead)
        }
      }
      for (let i = 0; i < 7; i++) {
        const a = -0.9 + (i / 6) * 1.8
        g.add(strand(mat, R * 0.11, R * 0.5, [Math.sin(a) * R * 0.72, R * 0.62, Math.cos(a) * R * 0.72], [0.3, 0, 0]))
      }
      break
    }
  }
  return g
}

/**
 * Build the full character. Returns the group plus a dispose() that releases
 * every geometry and material — three.js does not garbage-collect GPU
 * resources, so a creator the user opens repeatedly would leak without it.
 */
export function buildCharacter(opts: CharacterOptions): {
  group: THREE.Group
  dispose: () => void
} {
  const skin = hex(opts.skinColor, 'd08b5b')
  const hair = hex(opts.hairColor, '724133')
  const sMat = skinMat(skin)
  const hMat = hairMat(hair)

  // Body type changes proportions, not just scale — 'short' is stockier.
  const tall = opts.bodyType === 'tall'
  const short = opts.bodyType === 'short'
  const torsoH = tall ? 1.28 : short ? 0.94 : 1.10
  const torsoW = tall ? 0.56 : short ? 0.68 : 0.62
  const headR = tall ? 0.50 : short ? 0.56 : 0.53

  const group = new THREE.Group()

  const shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4f7cf0'), roughness: 0.78 })

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(torsoW, torsoH * 0.62, 8, 20), shirt)
  torso.position.y = torsoH * 0.30
  torso.castShadow = true
  torso.receiveShadow = true
  group.add(torso)

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.36, headR * 0.42, headR * 0.44, 16), sMat)
  neck.position.y = torsoH * 0.30 + torsoH * 0.34
  group.add(neck)

  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 40, 32), sMat)
  head.position.y = neck.position.y + headR * 0.86
  head.scale.set(1, 1.07, 0.95)
  head.castShadow = true
  group.add(head)

  // Ears keep the silhouette from reading as a ball.
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.17, 12, 12), sMat)
    ear.position.set(side * headR * 0.96, head.position.y - headR * 0.04, 0)
    ear.scale.set(0.6, 1, 0.8)
    group.add(ear)
  }

  // Eyes — dark spheres set into the face. Enough to give it a gaze.
  const eyeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2320'), roughness: 0.3 })
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.10, 14, 14), eyeMat)
    eye.position.set(side * headR * 0.33, head.position.y + headR * 0.10, headR * 0.83)
    group.add(eye)
  }

  const hairGroup = buildHair(opts.hairStyle || '', hMat, headR)
  hairGroup.position.y = head.position.y
  group.add(hairGroup)

  // Arms.
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(torsoW * 0.24, torsoH * 0.52, 6, 12), shirt)
    arm.position.set(side * (torsoW + torsoW * 0.20), torsoH * 0.30, 0)
    arm.rotation.z = side * 0.14
    arm.castShadow = true
    group.add(arm)
  }

  // Centre the character on the origin so orbit rotation feels right.
  group.position.y = -(head.position.y + headR) / 2

  const dispose = () => {
    group.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else if (mat) mat.dispose()
    })
  }

  return { group, dispose }
}
