/**
 * The 3D character for the creator (app/character): three.js, loaded only on
 * that page.
 *
 * public/avatar3d holds what scripts/avatar3d builds: body.glb (body, eyes,
 * every eyebrow shape, the skeleton and the poses), one GLB per hairstyle,
 * outfit and pair of glasses, the skin's textures and the backdrops. A
 * hairstyle or outfit is bound to the body's skeleton when chosen, so it moves
 * with the body and follows the face and body sliders (it has the same morph
 * targets, made by the same fitting MakeHuman uses).
 *
 * Body sliders also move the joints (meta.json "joints"), so a broader
 * shoulder still bends at the shoulder in a pose. Renders only when something
 * changes, unless the idle motion (breathing, blinking) is on, and that stays
 * off for people who prefer reduced motion.
 */
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js'
import { BODY_SLIDERS, ENVIRONMENTS, FACE_SLIDERS, type Character3D } from './character'
import { SkinPainter } from './skin'

export const ASSET_BASE = '/avatar3d/'

interface Meta {
  version: number
  height: number
  /** Which bit of the body's _HIDE attribute is each outfit's. */
  outfitBits: Record<string, number>
  joints: Record<string, Record<string, [number, number, number]>>
  ground: Record<string, number>
}

export type Framing = 'body' | 'upper' | 'face'

// Where the camera looks (height on the body, metres) and from how far.
const FRAMES: Record<Framing, { y: number; dist: number }> = {
  body: { y: 0.9, dist: 4.5 },
  upper: { y: 1.34, dist: 1.85 },
  face: { y: 1.56, dist: 0.78 },
}

export interface SceneOptions {
  reducedMotion: boolean
  /** Smaller textures and no shadows (phones, or a slow first frame). */
  lowPower?: boolean
  onProgress?: (fraction: number) => void
}

/** What can be worn, each its own GLB in public/avatar3d/<kind>/<id>.glb. */
type Piece = 'hair' | 'brows' | 'beard' | 'outfit' | 'glasses'
const HAIRLIKE: Piece[] = ['hair', 'brows', 'beard']

const ZERO = new THREE.Vector3()
const linear = (hex: string) => new THREE.Color(hex)

export class CharacterScene {
  readonly canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(30, 1, 0.05, 300)
  /** Turned by dragging or the turn buttons. */
  private turntable = new THREE.Group()
  /** Scaled by height; lifted so the feet stay on the ground. */
  private holder = new THREE.Group()
  private model!: THREE.Object3D
  private meshParent!: THREE.Object3D
  private meta!: Meta
  private loader: GLTFLoader
  private pmrem: THREE.PMREMGenerator
  private painter: SkinPainter
  private skinTexture: THREE.CanvasTexture
  private skinMaterial: THREE.MeshPhysicalMaterial
  private eyeMaterial: THREE.MeshPhysicalMaterial | null = null
  private eyeTextures = new Map<string, Promise<THREE.Texture>>()
  private bones = new Map<string, THREE.Bone>()
  private boneList: THREE.Bone[] = []
  private rest = new Map<THREE.Bone, { p: THREE.Vector3; q: THREE.Quaternion; parentQInv: THREE.Quaternion }>()
  private inverses = new Map<string, THREE.Matrix4>()
  private bindMatrix = new THREE.Matrix4()
  private skeletons = new Set<THREE.Skeleton>()
  /** Each skin's dequantisation (see dequantisation()). */
  private skinQ = new WeakMap<THREE.Skeleton, THREE.Matrix4>()
  private skinned = new Set<THREE.SkinnedMesh>()
  /** The body, its whole triangle list, and which outfits cover each vertex (bits). */
  private body: THREE.SkinnedMesh | null = null
  private bodyIndex: Uint32Array | Uint16Array | null = null
  private covered: ArrayLike<number> | null = null
  private coveredBy = ''
  private lashes: THREE.Mesh | null = null
  private morphValues = new Map<string, number>()
  private poses = new Map<string, Map<string, THREE.Quaternion>>()
  /** Each piece's meshes, kept after first load (they leave their file's scene once worn). */
  private pieces = new Map<string, Promise<THREE.SkinnedMesh[]>>()
  private worn: Record<Piece, { id: string; meshes: THREE.SkinnedMesh[] } | null> = { hair: null, brows: null, beard: null, outfit: null, glasses: null }
  private env: { id: string; skybox: GroundedSkybox; target: THREE.WebGLRenderTarget } | null = null
  private envLoading = new Map<string, Promise<{ hdr: THREE.DataTexture; jpg: THREE.Texture }>>()
  private keyLight = new THREE.DirectionalLight(0xffffff, 1.6)
  private shadowCatcher: THREE.Mesh
  private current: Character3D | null = null
  private applying: Promise<void> = Promise.resolve()

  // Camera and motion
  private framing = { y: FRAMES.body.y, dist: FRAMES.body.dist }
  private framingTarget = { ...this.framing }
  private viewShift = 0
  private poseFrom = new Map<string, THREE.Quaternion>()
  private poseTo = new Map<string, THREE.Quaternion>()
  private poseT = 1
  private smile = { value: 0, target: 0 }
  private nextBlink = 2
  private blinkT = -1
  private timer = new THREE.Timer()
  private raf = 0
  private visible = true
  private disposed = false
  private reducedMotion: boolean
  private lowPower: boolean

  private constructor(canvas: HTMLCanvasElement, private opts: SceneOptions) {
    this.canvas = canvas
    this.reducedMotion = opts.reducedMotion
    this.lowPower = Boolean(opts.lowPower)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.5 : 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.shadowMap.enabled = !this.lowPower
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    this.painter = new SkinPainter(ASSET_BASE, this.lowPower ? 1024 : 2048)
    this.skinTexture = new THREE.CanvasTexture(this.painter.canvas)
    this.skinTexture.flipY = false // glTF's UVs
    this.skinTexture.colorSpace = THREE.SRGBColorSpace
    this.skinTexture.anisotropy = 4
    this.skinMaterial = new THREE.MeshPhysicalMaterial({
      map: this.skinTexture, roughness: 0.52, metalness: 0,
      sheen: 0.35, sheenRoughness: 0.75, sheenColor: new THREE.Color(1, 0.85, 0.8),
      specularIntensity: 0.55,
    })
    this.skinMaterial.name = 'skin'

    this.scene.add(this.turntable)
    this.turntable.add(this.holder)

    this.keyLight.position.set(1.6, 3.2, 2.6)
    this.keyLight.castShadow = !this.lowPower
    this.keyLight.shadow.mapSize.set(1024, 1024)
    const sc = this.keyLight.shadow.camera
    sc.left = -1.2; sc.right = 1.2; sc.top = 2.2; sc.bottom = -0.2; sc.near = 0.5; sc.far = 8
    this.keyLight.shadow.bias = -0.0004
    this.keyLight.shadow.radius = 4
    this.scene.add(this.keyLight)
    this.shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.32 }))
    this.shadowCatcher.receiveShadow = true
    this.shadowCatcher.position.y = 0.001
    this.scene.add(this.shadowCatcher)

    canvas.addEventListener('webglcontextlost', this.onContextLost)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  /** Load the body and get ready to draw. Throws if WebGL or the models aren't available. */
  static async create(canvas: HTMLCanvasElement, opts: SceneOptions): Promise<CharacterScene> {
    const s = new CharacterScene(canvas, opts)
    await s.loadBase()
    return s
  }

  // ------------------------------------------------------------------ loading

  private async loadBase() {
    const progress = { body: 0, rest: 0 }
    const report = () => this.opts.onProgress?.(Math.min(0.99, progress.body * 0.8 + progress.rest * 0.2))
    const [gltf, meta] = await Promise.all([
      this.loader.loadAsync(`${ASSET_BASE}body.glb`, (e) => {
        if (e.total) { progress.body = e.loaded / e.total; report() }
      }),
      fetch(`${ASSET_BASE}meta.json`).then((r) => {
        if (!r.ok) throw new Error('The character data is missing')
        return r.json() as Promise<Meta>
      }),
      this.painter.load().then(() => { progress.rest = 1; report() }),
    ])
    this.meta = meta
    this.model = gltf.scene
    this.holder.add(this.model)

    this.model.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        const b = o as THREE.Bone
        this.bones.set(b.name, b)
        this.boneList.push(b)
      }
    })
    this.model.updateMatrixWorld(true)
    for (const b of this.boneList) {
      const parentQ = new THREE.Quaternion()
      if (b.parent) b.parent.matrixWorld.decompose(new THREE.Vector3(), parentQ, new THREE.Vector3())
      this.rest.set(b, { p: b.position.clone(), q: b.quaternion.clone(), parentQInv: parentQ.invert() })
    }

    for (const clip of gltf.animations) {
      const pose = new Map<string, THREE.Quaternion>()
      for (const track of clip.tracks) {
        const [bone, prop] = track.name.split('.')
        if (prop === 'quaternion' && track.values.length >= 4) {
          pose.set(bone, new THREE.Quaternion(track.values[0], track.values[1], track.values[2], track.values[3]))
        }
      }
      this.poses.set(clip.name, pose)
    }

    const meshes: THREE.SkinnedMesh[] = []
    this.model.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh) })
    if (!meshes.length) throw new Error('The body model has no meshes')
    this.meshParent = this.model
    this.scene.updateMatrixWorld(true)
    for (const m of meshes) this.prepareBodyMesh(m)
    this.recomputeBind()
    this.keyLight.target = this.holder
  }

  private prepareBodyMesh(m: THREE.SkinnedMesh) {
    const matName = (m.material as THREE.Material).name || ''
    const name = m.name
    m.frustumCulled = false // morphs and poses move the mesh past its bounds
    m.castShadow = true
    m.receiveShadow = false
    this.register(m)
    if (matName === 'skin' || name === 'body') {
      ;(m.material as THREE.Material).dispose()
      m.material = this.skinMaterial
      this.body = m
      const index = m.geometry.getIndex()
      this.bodyIndex = index ? (index.array as Uint32Array | Uint16Array).slice() : null
      this.covered = (m.geometry.getAttribute('_hide') as THREE.BufferAttribute | undefined)?.array || null
    } else if (matName === 'part__eyelashes' || name.startsWith('eyelashes')) {
      this.hairLike(m, 0.3)
      this.attachEdges(m)
      ;(m.material as THREE.MeshStandardMaterial).color.set('#1a1412')
      m.castShadow = false
      this.lashes = m
    } else if (matName === 'part__eyes' || name.startsWith('eyes')) {
      const old = m.material as THREE.MeshStandardMaterial
      // The eye's clear outer layer is see-through in the texture (and black
      // under that), so cut it away rather than draw it.
      this.eyeMaterial = new THREE.MeshPhysicalMaterial({ map: old.map, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, alphaTest: 0.5 })
      old.dispose()
      m.material = this.eyeMaterial
      m.castShadow = false
    } else {
      m.castShadow = false
    }
  }

  /**
   * Hair, eyebrows, facial hair and lashes: grey textures we tint, cut out by
   * their alpha. Drawn twice, the way games draw hair cards: the solid middle
   * first (alpha test, writing depth), then the soft edges blended over it, so
   * a hairline fades instead of stopping in a jagged line.
   */
  private hairLike(m: THREE.SkinnedMesh, alphaTest: number) {
    const mat = m.material as THREE.MeshStandardMaterial
    mat.transparent = false
    mat.alphaTest = Math.max(alphaTest, 0.5)
    mat.alphaToCoverage = true
    mat.side = THREE.DoubleSide
    mat.depthWrite = true
    mat.roughness = 0.55
    mat.metalness = 0
    const soft = mat.clone()
    soft.alphaTest = 0.02
    soft.alphaToCoverage = false
    soft.transparent = true
    soft.depthWrite = false
    const edge = new THREE.SkinnedMesh(m.geometry, soft)
    edge.name = `${m.name}__edges`
    edge.frustumCulled = false
    edge.renderOrder = 1
    edge.userData.edgeOf = m
    m.userData.edges = edge
  }

  /** Put a hair-like mesh's soft-edge copy beside it, on the same skeleton. */
  private attachEdges(m: THREE.SkinnedMesh) {
    const edge = m.userData.edges as THREE.SkinnedMesh | undefined
    if (!edge || !m.parent) return
    m.parent.add(edge)
    edge.bind(m.skeleton, m.bindMatrix)
    edge.morphTargetInfluences = m.morphTargetInfluences
    edge.morphTargetDictionary = m.morphTargetDictionary
    this.skinned.add(edge)
  }

  private detachEdges(m: THREE.SkinnedMesh) {
    const edge = m.userData.edges as THREE.SkinnedMesh | undefined
    if (!edge) return
    edge.removeFromParent()
    this.skinned.delete(edge)
  }

  /**
   * A skin's inverse bind matrices also undo the mesh's quantisation
   * (optimize.mjs stores positions as small integers and glTF-Transform folds
   * the scale into them). Keep that part, Q = bone at rest x inverse, so the
   * bind can be recomputed when the joints move. The skeleton must be in its
   * rest pose, at the identity turn and scale, when this runs.
   */
  private dequantisation(sk: THREE.Skeleton) {
    const b = sk.bones[0]
    return new THREE.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[0])
  }

  private register(m: THREE.SkinnedMesh, q?: THREE.Matrix4) {
    this.skinned.add(m)
    if (!this.skinQ.has(m.skeleton)) this.skinQ.set(m.skeleton, q || this.dequantisation(m.skeleton))
    this.skeletons.add(m.skeleton)
    if (m.morphTargetDictionary && m.morphTargetInfluences) {
      for (const [name, value] of this.morphValues) {
        const i = m.morphTargetDictionary[name]
        if (i !== undefined) m.morphTargetInfluences[i] = value
      }
    }
  }

  private unregister(m: THREE.SkinnedMesh) {
    this.skinned.delete(m)
    this.skeletons.delete(m.skeleton)
  }

  // ------------------------------------------------------------------ binding

  /**
   * After the joints move (body sliders): make the current joint positions
   * the skeleton's rest, so skinning starts from the reshaped body.
   */
  private recomputeBind() {
    const rot = this.turntable.rotation.y
    const scale = this.holder.scale.x
    this.turntable.rotation.y = 0
    this.holder.scale.setScalar(1)
    const saved = this.boneList.map((b) => b.quaternion.clone())
    for (const b of this.boneList) b.quaternion.copy(this.rest.get(b)!.q)
    this.scene.updateMatrixWorld(true)
    for (const b of this.boneList) this.inverses.set(b.name, b.matrixWorld.clone().invert())
    this.bindMatrix.copy(this.meshParent.matrixWorld)
    for (const sk of this.skeletons) {
      const q = this.skinQ.get(sk) || new THREE.Matrix4()
      sk.boneInverses = sk.bones.map((b) => (this.inverses.get(b.name) || new THREE.Matrix4()).clone().multiply(q))
    }
    for (const m of this.skinned) {
      m.bindMatrix.copy(m.matrixWorld)
      m.bindMatrixInverse.copy(m.matrixWorld).invert()
    }
    this.boneList.forEach((b, i) => b.quaternion.copy(saved[i]))
    this.turntable.rotation.y = rot
    this.holder.scale.setScalar(scale)
    this.scene.updateMatrixWorld(true)
  }

  private bodyJoints(weights: Record<string, number>) {
    const delta = new Map<string, THREE.Vector3>()
    let ground = 0
    for (const [key, w] of Object.entries(weights)) {
      if (!w) continue
      ground += (this.meta.ground[key] || 0) * w
      const joints = this.meta.joints[key]
      if (!joints) continue
      for (const [bone, d] of Object.entries(joints)) {
        const v = delta.get(bone) || new THREE.Vector3()
        v.x += d[0] * w; v.y += d[1] * w; v.z += d[2] * w
        delta.set(bone, v)
      }
    }
    for (const b of this.boneList) {
      const r = this.rest.get(b)!
      const own = delta.get(b.name) || ZERO
      const parent = b.parent && (b.parent as THREE.Bone).isBone ? delta.get(b.parent.name) || ZERO : ZERO
      b.position.copy(r.p).add(own.clone().sub(parent).applyQuaternion(r.parentQInv))
    }
    this.holder.position.y = -ground
    this.recomputeBind()
  }

  /** A hairstyle, eyebrows, facial hair, an outfit or glasses, bound to the body's skeleton. */
  private async wear(kind: Piece, id: string | null) {
    const was = this.worn[kind]
    if ((was?.id || null) === id) return
    let meshes: THREE.SkinnedMesh[] = []
    if (id) {
      const url = `${ASSET_BASE}${kind}/${id}.glb`
      if (!this.pieces.has(url)) {
        this.pieces.set(url, this.loader.loadAsync(url).then((gltf: GLTF) => {
          const found: THREE.SkinnedMesh[] = []
          gltf.scene.updateMatrixWorld(true)
          gltf.scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) found.push(o as THREE.SkinnedMesh) })
          // Its quantisation, while it's still in its own scene at rest.
          for (const m of found) m.userData.q = this.dequantisation(m.skeleton)
          return found
        }))
      }
      try {
        meshes = await this.pieces.get(url)!
      } catch (e) {
        this.pieces.delete(url)
        throw e
      }
      if (this.worn[kind]?.id === id) return
      for (const m of meshes) {
        if (!m.userData.prepared) {
          m.userData.prepared = true
          m.frustumCulled = false
          m.castShadow = kind === 'hair' || kind === 'outfit'
          m.receiveShadow = false
          if (HAIRLIKE.includes(kind)) this.hairLike(m, kind === 'hair' ? 0.35 : 0.3)
          if (kind === 'outfit') {
            // Pull clothes a little towards the camera, so skin a millimetre
            // too close never shows through them.
            const mat = m.material as THREE.MeshStandardMaterial
            mat.polygonOffset = true
            mat.polygonOffsetFactor = -1
            mat.polygonOffsetUnits = -2
          }
          if (kind === 'glasses') {
            const mat = m.material as THREE.MeshStandardMaterial
            mat.alphaTest = 0.45
            mat.transparent = false
            mat.side = THREE.DoubleSide
            mat.metalness = 0.2
            mat.roughness = 0.3
          }
        }
        const bones = m.skeleton.bones.map((b) => this.bones.get(b.name))
        if (bones.some((b) => !b)) continue
        const q = m.userData.q as THREE.Matrix4
        const sk = new THREE.Skeleton(bones as THREE.Bone[], (bones as THREE.Bone[]).map((b) => this.inverses.get(b.name)!.clone().multiply(q)))
        this.skinQ.set(sk, q)
        m.removeFromParent()
        m.position.set(0, 0, 0)
        m.quaternion.identity()
        m.scale.set(1, 1, 1)
        this.meshParent.add(m)
        m.bind(sk, this.bindMatrix)
        this.register(m, q)
        this.attachEdges(m)
      }
    }
    if (was) {
      for (const m of was.meshes) {
        m.removeFromParent()
        this.unregister(m)
        this.detachEdges(m)
      }
    }
    this.worn[kind] = id ? { id, meshes } : null
    if (this.current) this.tint()
  }

  /** Hair in the hair colour; eyebrows and facial hair in the eyebrow colour. */
  private tint() {
    const c = this.current
    if (!c) return
    const colours: Partial<Record<Piece, string>> = { hair: c.hairColor, brows: c.browColor, beard: c.browColor }
    const paint = (m: THREE.Mesh, color: THREE.Color) => {
      ;(m.material as THREE.MeshStandardMaterial).color.copy(color)
      const edge = m.userData.edges as THREE.Mesh | undefined
      if (edge) (edge.material as THREE.MeshStandardMaterial).color.copy(color)
    }
    for (const kind of HAIRLIKE) {
      for (const m of this.worn[kind]?.meshes || []) paint(m, linear(colours[kind]!))
    }
    if (this.lashes) paint(this.lashes, linear(c.browColor).lerp(new THREE.Color('#2a1f1a'), 0.55))
  }

  // ------------------------------------------------------------------ applying a character

  /** Show this character. Changes are applied in order; resolves when drawn. */
  apply(c: Character3D): Promise<void> {
    this.applying = this.applying.then(() => this.applyNow(c)).catch((e) => { console.error(e) })
    return this.applying
  }

  private async applyNow(c: Character3D) {
    if (this.disposed) return
    const prev = this.current
    this.current = c
    const tasks: Promise<unknown>[] = []

    if (!prev || prev.environment !== c.environment) tasks.push(this.setEnvironment(c.environment))
    if (!prev || prev.hair !== c.hair) tasks.push(this.wear('hair', c.hair === 'none' ? null : c.hair))
    if (!prev || prev.brows !== c.brows) tasks.push(this.wear('brows', c.brows === 'none' ? null : c.brows))
    if (!prev || prev.beard !== c.beard) tasks.push(this.wear('beard', c.beard === 'none' ? null : c.beard))
    const outfitId = c.attire === 'basics' ? 'basics' : c.outfit
    if (!prev || (prev.attire === 'basics' ? 'basics' : prev.outfit) !== outfitId) tasks.push(this.wear('outfit', outfitId))
    if (!prev || prev.glasses !== c.glasses) tasks.push(this.wear('glasses', c.glasses === 'none' ? null : c.glasses))
    if (!prev || prev.eyes !== c.eyes) tasks.push(this.setEyes(c.eyes))
    const skinChanged = !prev || ['skin', 'lips', 'facePaint', 'facePaintColor', 'tattoo', 'tattooColor'].some((k) => (prev as any)[k] !== (c as any)[k]) || prev.features.join() !== c.features.join()
    if (skinChanged) tasks.push(this.painter.paint(c).then(() => { this.skinTexture.needsUpdate = true }))
    await Promise.all(tasks)

    this.coverBody(outfitId)
    this.tint()

    // Morphs: face and body sliders, then joints for the body ones.
    const values = new Map<string, number>()
    for (const s of FACE_SLIDERS) {
      const v = c.face[s.id] || 0
      values.set(`${s.id}_down`, Math.max(0, -v))
      values.set(`${s.id}_up`, Math.max(0, v))
    }
    const bodyWeights: Record<string, number> = {}
    for (const s of BODY_SLIDERS) {
      const v = c.body[s.id] || 0
      values.set(`${s.id}_down`, Math.max(0, -v))
      values.set(`${s.id}_up`, Math.max(0, v))
      bodyWeights[`${s.id}_down`] = Math.max(0, -v)
      bodyWeights[`${s.id}_up`] = Math.max(0, v)
    }
    for (const [k, v] of values) this.setMorph(k, v)
    const bodyChanged = !prev || BODY_SLIDERS.some((s) => (prev.body[s.id] || 0) !== (c.body[s.id] || 0))
    if (bodyChanged) this.bodyJoints(bodyWeights)
    const scale = 1 + c.height * 0.09
    if (this.holder.scale.x !== scale) this.holder.scale.setScalar(scale)

    this.smile.target = c.smile ? 0.85 : 0
    if (this.reducedMotion) this.smile.value = this.smile.target
    if (!prev || prev.pose !== c.pose) this.setPose(c.pose)
    this.invalidate()
  }

  /**
   * Leave out the body's triangles under this outfit (all three corners
   * covered), so skin can't poke through it in a pose.
   */
  private coverBody(outfitId: string) {
    if (!this.body || !this.bodyIndex || !this.covered || this.coveredBy === outfitId) return
    this.coveredBy = outfitId
    const bit = this.meta.outfitBits?.[outfitId]
    const all = this.bodyIndex
    let keep: Uint32Array | Uint16Array = all
    if (bit !== undefined) {
      const b = 2 ** bit
      const on = (i: number) => Math.floor(this.covered![i] / b) % 2 === 1
      const out = new (all.constructor as Uint32ArrayConstructor)(all.length)
      let n = 0
      for (let t = 0; t < all.length; t += 3) {
        const i0 = all[t], i1 = all[t + 1], i2 = all[t + 2]
        if (on(i0) && on(i1) && on(i2)) continue
        out[n++] = i0; out[n++] = i1; out[n++] = i2
      }
      keep = out.slice(0, n)
    }
    this.body.geometry.setIndex(new THREE.BufferAttribute(keep, 1))
  }

  private setMorph(name: string, value: number) {
    this.morphValues.set(name, value)
    for (const m of this.skinned) {
      const i = m.morphTargetDictionary?.[name]
      if (i !== undefined && m.morphTargetInfluences) m.morphTargetInfluences[i] = value
    }
  }

  private async setEyes(id: string) {
    if (!this.eyeMaterial) return
    if (!this.eyeTextures.has(id)) {
      this.eyeTextures.set(id, new THREE.TextureLoader().loadAsync(`${ASSET_BASE}eyes/${id}.webp`).then((t) => {
        t.flipY = false
        t.colorSpace = THREE.SRGBColorSpace
        return t
      }))
    }
    const tex = await this.eyeTextures.get(id)!
    this.eyeMaterial.map = tex
    this.eyeMaterial.needsUpdate = true
  }

  private setPose(id: string) {
    const target = this.poses.get(id) || this.poses.get('standing')
    this.poseFrom = new Map(this.boneList.map((b) => [b.name, b.quaternion.clone()]))
    this.poseTo = new Map(this.boneList.map((b) => [b.name, (target?.get(b.name) || this.rest.get(b)!.q).clone()]))
    this.poseT = this.reducedMotion || !this.current ? 1 : 0
    if (this.poseT === 1) this.applyPoseBlend(1)
  }

  private applyPoseBlend(t: number) {
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    for (const b of this.boneList) {
      const from = this.poseFrom.get(b.name)
      const to = this.poseTo.get(b.name)
      if (from && to) b.quaternion.slerpQuaternions(from, to, e)
    }
  }

  // ------------------------------------------------------------------ environment

  private loadEnv(id: string) {
    if (!this.envLoading.has(id)) {
      this.envLoading.set(id, Promise.all([
        new HDRLoader().loadAsync(`${ASSET_BASE}backdrops/${id}.hdr`),
        new THREE.TextureLoader().loadAsync(`${ASSET_BASE}backdrops/${id}.jpg`),
      ]).then(([hdr, jpg]) => ({ hdr, jpg })))
    }
    return this.envLoading.get(id)!
  }

  private async setEnvironment(id: string) {
    const info = ENVIRONMENTS.find((e) => e.id === id) || ENVIRONMENTS[0]
    const { hdr, jpg } = await this.loadEnv(info.id)
    if (this.disposed) return
    hdr.mapping = THREE.EquirectangularReflectionMapping
    const target = this.pmrem.fromEquirectangular(hdr)
    jpg.colorSpace = THREE.SRGBColorSpace
    const skybox = new GroundedSkybox(jpg, 1.6, 60)
    ;(skybox.material as THREE.MeshBasicMaterial).toneMapped = false
    skybox.position.y = 1.6
    // Turn the panorama so its chosen part is behind the character (-Z).
    const yaw = (info.backdrop - 0.25) * Math.PI * 2
    skybox.rotation.y = yaw
    this.scene.environmentRotation.set(0, yaw, 0)
    this.scene.environment = target.texture
    this.scene.environmentIntensity = info.light
    this.keyLight.intensity = id === 'night' ? 1.1 : 1.6
    this.keyLight.color.set(id === 'night' ? '#9fb4ff' : id === 'sunrise' || id === 'seaside' ? '#ffd9b0' : '#ffffff')
    if (this.env) {
      this.scene.remove(this.env.skybox)
      this.env.skybox.geometry.dispose()
      ;(this.env.skybox.material as THREE.Material).dispose()
      this.env.target.dispose()
    }
    this.scene.add(skybox)
    this.env = { id: info.id, skybox, target }
  }

  // ------------------------------------------------------------------ camera

  setFraming(f: Framing) {
    this.framingTarget = { ...FRAMES[f] }
    if (this.reducedMotion) this.framing = { ...this.framingTarget }
    this.invalidate()
  }

  /** Zoom by a factor (wheel, pinch, + and -), between the face and the whole body. */
  zoomBy(factor: number) {
    const d = Math.min(FRAMES.body.dist, Math.max(FRAMES.face.dist, this.framingTarget.dist * factor))
    const t = (d - FRAMES.face.dist) / (FRAMES.body.dist - FRAMES.face.dist)
    this.framingTarget = { dist: d, y: FRAMES.face.y + (FRAMES.body.y - FRAMES.face.y) * Math.pow(t, 0.8) }
    if (this.reducedMotion) this.framing = { ...this.framingTarget }
    this.invalidate()
  }

  /** Turn the character (radians). */
  turnBy(radians: number) {
    this.turntable.rotation.y += radians
    this.invalidate()
  }

  get turn() {
    return this.turntable.rotation.y
  }

  /**
   * Size the view. `shift` moves the character sideways as a fraction of the
   * width (positive: right), leaving room for the panels.
   */
  resize(width: number, height: number, shift = 0) {
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / Math.max(1, height)
    this.viewShift = shift
    if (shift) this.camera.setViewOffset(width, height, -shift * width, 0, width, height)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
    this.invalidate()
  }

  private placeCamera() {
    const { y, dist } = this.framing
    this.camera.position.set(0, y + dist * 0.04, dist)
    this.camera.lookAt(0, y, 0)
  }

  // ------------------------------------------------------------------ the loop

  setReducedMotion(on: boolean) {
    this.reducedMotion = on
    if (on) {
      this.framing = { ...this.framingTarget }
      this.smile.value = this.smile.target
      if (this.poseT < 1) { this.poseT = 1; this.applyPoseBlend(1) }
      this.setMorph('x_blink', 0)
    }
    this.invalidate()
  }

  invalidate() {
    if (!this.raf && !this.disposed && this.visible) this.raf = requestAnimationFrame(this.tick)
  }

  private tick = () => {
    this.raf = 0
    if (this.disposed) return
    this.timer.update()
    const dt = Math.min(0.05, this.timer.getDelta())
    const t = this.timer.getElapsed()
    let moving = false

    const f = this.framing, g = this.framingTarget
    if (Math.abs(f.dist - g.dist) > 0.001 || Math.abs(f.y - g.y) > 0.001) {
      const k = 1 - Math.pow(0.0005, dt)
      f.dist += (g.dist - f.dist) * k
      f.y += (g.y - f.y) * k
      moving = true
    } else {
      f.dist = g.dist; f.y = g.y
    }
    if (this.poseT < 1) {
      this.poseT = Math.min(1, this.poseT + dt / 0.5)
      this.applyPoseBlend(this.poseT)
      moving = true
    } else {
      this.applyPoseBlend(1)
    }
    if (Math.abs(this.smile.value - this.smile.target) > 0.001) {
      this.smile.value += Math.sign(this.smile.target - this.smile.value) * Math.min(Math.abs(this.smile.target - this.smile.value), dt * 3)
      moving = true
    }
    this.setMorph('x_smile', this.smile.value)

    if (!this.reducedMotion) {
      // Breathing and a small sway, on top of the pose.
      const breath = Math.sin(t * 1.6) * 0.012
      const chest = this.bones.get('spine02')
      const neck = this.bones.get('neck01')
      if (chest) chest.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(breath, 0, 0)))
      if (neck) neck.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-breath * 0.6, Math.sin(t * 0.37) * 0.02, 0)))
      // Blink every few seconds.
      if (this.blinkT < 0 && t > this.nextBlink) this.blinkT = 0
      if (this.blinkT >= 0) {
        this.blinkT += dt
        const b = this.blinkT < 0.08 ? this.blinkT / 0.08 : Math.max(0, 1 - (this.blinkT - 0.08) / 0.1)
        this.setMorph('x_blink', b)
        if (this.blinkT > 0.18) { this.blinkT = -1; this.nextBlink = t + 2.5 + Math.random() * 3.5; this.setMorph('x_blink', 0) }
      }
      moving = true
    }

    this.placeCamera()
    this.renderer.render(this.scene, this.camera)
    if (moving) this.invalidate()
  }

  private onVisibility = () => {
    this.visible = document.visibilityState === 'visible'
    if (this.visible) { this.timer.update(); this.invalidate() }
  }

  private onContextLost = (e: Event) => {
    e.preventDefault()
    this.opts.onProgress?.(-1)
  }

  /** For checking the scene from a test: what's drawn and where. */
  debugInfo() {
    const box = new THREE.Box3()
    const meshes: { name: string; material: string; visible: boolean; verts: number; morphs: number }[] = []
    this.scene.updateMatrixWorld(true)
    for (const m of this.skinned) {
      meshes.push({ name: m.name, material: (m.material as THREE.Material).name, visible: m.visible && Boolean(m.parent), verts: m.geometry.attributes.position.count, morphs: m.morphTargetInfluences?.length || 0 })
    }
    const head = this.bones.get('head')
    const hp = head ? head.getWorldPosition(new THREE.Vector3()) : null
    const root = this.bones.get('root')
    const rp = root ? root.getWorldPosition(new THREE.Vector3()) : null
    box.setFromObject(this.holder)
    return {
      meshes, bones: this.boneList.length, poses: [...this.poses.keys()],
      bodyTriangles: [(this.body?.geometry.getIndex()?.count || 0) / 3, (this.bodyIndex?.length || 0) / 3],
      head: hp?.toArray().map((v) => +v.toFixed(3)), root: rp?.toArray().map((v) => +v.toFixed(3)),
      box: [box.min.toArray().map((v) => +v.toFixed(3)), box.max.toArray().map((v) => +v.toFixed(3))],
      camera: this.camera.position.toArray().map((v) => +v.toFixed(3)), env: this.env?.id,
    }
  }

  /** A PNG of the current view (for a saved picture of the character). */
  snapshot(): string {
    this.placeCamera()
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL('image/png')
  }

  dispose() {
    this.disposed = true
    if (this.raf) cancelAnimationFrame(this.raf)
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose()
        mat.dispose()
      }
    })
    this.env?.target.dispose()
    this.skinTexture.dispose()
    this.pmrem.dispose()
    this.renderer.dispose()
  }
}

/** Whether this browser can draw WebGL 2 (the creator needs it). */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2'))
  } catch {
    return false
  }
}
