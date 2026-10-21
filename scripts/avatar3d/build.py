"""Build the 3D character creator's models with Blender + MPFB.

    blender -b --python scripts/avatar3d/build.py -- --out ~/autinerary-3d/build

Writes raw GLBs and meta.json; optimize.mjs then compresses them into
frontend/public/avatar3d/. See README.md for the whole pipeline.

How the pieces fit together in the browser:
- body.glb: the body (one mesh; _HIDE says which outfits cover each vertex), eyes,
  eyelashes, teeth, tongue, the skeleton and the poses.
- hair/, brows/, beard/, outfit/, glasses/<id>.glb: one choice each, with the
  same skeleton, so the page binds them to the body's.
- Every slider is a pair of morph targets ("<id>_down", "<id>_up") on the body
  and on every piece it moves. A piece's morphs are computed with MPFB's own
  fitting formula (each piece's vertex follows three body vertices), so hair
  and clothes follow the face and body exactly as MPFB would refit them.
- Body sliders also say how far each joint moves (meta.json "joints"), so a
  pose still bends a broader shoulder at the shoulder.
"""
import bpy, bmesh, os, sys, json, time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (C, USER, RIG_FILE, arg, log, asset_path, find_mhclo, target_path, coords, Fit,  # noqa: E402
                    build_human, add_piece, reset_pose, read_mhmat, TargetService, load_png, save_png, remove_marks,
                    SkinCover)

from bl_ext.user_default.mpfb.services.animationservice import AnimationService  # noqa: E402
from bl_ext.user_default.mpfb.entities.objectproperties import HumanObjectProperties, GeneralObjectProperties  # noqa: E402
from bl_ext.user_default.mpfb.entities.rig import Rig  # noqa: E402

OUT = os.path.expanduser(arg("--out", "~/autinerary-3d/build"))
QUICK = "--quick" in sys.argv  # a few assets only, for trying the pipeline


# ---------------------------------------------------------------- build

def main():
    os.makedirs(OUT, exist_ok=True)
    hairs = C.HAIRS[:3] if QUICK else C.HAIRS
    brows = C.BROWS[:3] if QUICK else C.BROWS
    outfits = C.OUTFITS[:3] if QUICK else C.OUTFITS
    glasses = C.GLASSES[:2] if QUICK else C.GLASSES
    beards = C.BEARDS[:2] if QUICK else C.BEARDS

    basemesh, rig = build_human()
    log("human built", basemesh.name, len(basemesh.data.vertices), "verts")

    # Pieces: (object, Fit, kind, id). Parts first, from what MPFB added.
    pieces = []
    for o in rig.children:
        if o is basemesh or o.type != "MESH":
            continue
        src = str(GeneralObjectProperties.get_value("asset_source", entity_reference=o) or "")
        name = os.path.basename(src).replace(".mhclo", "")
        kind = str(GeneralObjectProperties.get_value("object_type", entity_reference=o) or "").lower()
        path = asset_path(kind if kind != "eyes" else "eyes", name)
        part = {"eyes": "eyes", "eyelashes": "eyelashes", "teeth": "teeth", "tongue": "tongue"}.get(kind, kind)
        pieces.append({"obj": o, "fit": Fit(path), "kind": "part", "id": part, "asset": name})

    for bid, _, src in brows:
        o = add_piece(basemesh, asset_path("eyebrows", src), "Eyebrows")
        pieces.append({"obj": o, "fit": Fit(asset_path("eyebrows", src)), "kind": "brow", "id": bid, "asset": src})
    for hid, _, src in hairs:
        o = add_piece(basemesh, asset_path("hair", src), "Hair")
        pieces.append({"obj": o, "fit": Fit(asset_path("hair", src)), "kind": "hair", "id": hid, "asset": src})
    for oid, _, srcs in outfits:
        for src in srcs:
            sub, path = find_mhclo(src)
            o = add_piece(basemesh, path, "Clothes")
            pieces.append({"obj": o, "fit": Fit(path), "kind": "outfit", "id": oid, "src": src, "asset": src})
    for gid, _, src in glasses:
        sub, path = find_mhclo(src)
        o = add_piece(basemesh, path, "Clothes")
        pieces.append({"obj": o, "fit": Fit(path), "kind": "glasses", "id": gid, "asset": src})
    for bid, _, src in beards:
        sub, path = find_mhclo(src)
        o = add_piece(basemesh, path, "Clothes")
        pieces.append({"obj": o, "fit": Fit(path), "kind": "beard", "id": bid, "asset": src})
    log("pieces added", len(pieces))

    # ---------------------------------------------------------- capture shapes
    H0 = coords(basemesh)
    worst = 0.0
    for p in pieces:
        P = coords(p["obj"])
        F = p["fit"].apply(H0)
        if P.shape != F.shape:
            raise RuntimeError(f"vertex count differs for {p['obj'].name}: {P.shape} vs {F.shape}")
        err = float(np.abs(P - F).max())
        worst = max(worst, err)
        p["P0"] = P
    log("fit check: worst difference from MPFB's own fit", round(worst * 1000, 4), "mm")
    if worst > 1e-4:
        raise RuntimeError("the vectorised fit does not match MPFB's; stop")

    def joints():
        r = Rig.from_json_file_and_basemesh(RIG_FILE, basemesh)
        return {name: np.array(r.get_best_location_from_strategy(info["head"]), np.float64) for name, info in r.rig_definition.items()}

    J0 = joints()
    body_mask = np.zeros(len(basemesh.data.vertices), bool)
    gi = basemesh.vertex_groups["body"].index
    for v in basemesh.data.vertices:
        if any(g.group == gi for g in v.groups):
            body_mask[v.index] = True
    ground0 = H0[body_mask, 2].min()

    keys = {}      # morph name -> basemesh delta (Nx3)
    joints_out = {}  # morph name -> {bone: delta}
    ground_out = {}

    def capture_targets(name, specs):
        added = []
        for i, spec in enumerate(specs):
            added.append(TargetService.load_target(basemesh, target_path(spec), weight=1.0, name=f"__cap{i}"))
        D = coords(basemesh) - H0
        for sk in added:
            basemesh.shape_key_remove(sk)
        keys[name] = D

    for fid, _, _, down, up, *_ in C.FACE:
        if down:
            capture_targets(f"{fid}_down", down)
        capture_targets(f"{fid}_up", up)
    for xid, specs in C.EXPRESSIONS:
        capture_targets(f"x_{xid}", specs)
    log("face and expression shapes captured", len(keys))

    for bid, _, macro, lo, hi, _, _ in C.BODY:
        old = HumanObjectProperties.get_value(macro, entity_reference=basemesh)
        for suffix, value in (("_down", lo), ("_up", hi)):
            HumanObjectProperties.set_value(macro, value, entity_reference=basemesh)
            TargetService.reapply_macro_details(basemesh)
            H = coords(basemesh)
            name = bid + suffix
            keys[name] = H - H0
            J = joints()
            joints_out[name] = {b: J[b] - J0[b] for b in J0 if np.abs(J[b] - J0[b]).max() > 1e-5}
            ground_out[name] = float(H[body_mask, 2].min() - ground0)
        HumanObjectProperties.set_value(macro, old, entity_reference=basemesh)
        TargetService.reapply_macro_details(basemesh)
    if np.abs(coords(basemesh) - H0).max() > 1e-6:
        raise RuntimeError("the body did not return to neutral after the body shapes")
    log("body shapes captured", len(keys), "joints moved by", {k: len(v) for k, v in joints_out.items()})

    # ---------------------------------------------------------- bake + keys
    TargetService.bake_targets(basemesh)
    if np.abs(coords(basemesh) - H0).max() > 1e-6:
        raise RuntimeError("baking moved the body")

    def add_keys(obj, base, deltas):
        if not deltas:
            return 0
        if obj.data.shape_keys is None:
            obj.shape_key_add(name="Basis", from_mix=False)
        for name, D in deltas.items():
            sk = obj.shape_key_add(name=name, from_mix=False)
            sk.data.foreach_set("co", (base + D).astype(np.float32).ravel())
            sk.value = 0.0
        return len(deltas)

    add_keys(basemesh, H0, keys)
    total = 0
    for p in pieces:
        F0 = p["fit"].apply(H0)
        d = {}
        for name, D in keys.items():
            dP = p["fit"].apply(H0 + D) - F0
            if np.abs(dP).max() > 2e-5:
                d[name] = dP
        p["morphs"] = sorted(d)
        total += add_keys(p["obj"], p["P0"], d)
    log("shape keys added: body", len(keys), "pieces", total)

    # ---------------------------------------------------------- body regions
    n = len(basemesh.data.vertices)
    attr = basemesh.data.attributes.new("orig_index", "INT", "POINT")
    attr.data.foreach_set("value", np.arange(n, dtype=np.int32))
    hide = {}  # outfit id -> boolean mask over original vertices
    # Which skin each outfit covers (common.covered_skin), as a mask over the
    # original vertices.
    cover = SkinCover(basemesh, H0, body_mask)
    for p in pieces:
        if p["kind"] != "outfit":
            continue
        m = hide.setdefault(p["id"], np.zeros(n, bool))
        m |= cover.of(p["P0"], p["fit"].delverts)
    log("covered skin by outfit", {k: int(v.sum()) for k, v in hide.items()})

    bpy.context.view_layer.objects.active = basemesh
    for o in bpy.context.selected_objects:
        o.select_set(False)
    basemesh.select_set(True)
    for m in list(basemesh.modifiers):
        if m.type == "MASK":
            basemesh.modifiers.remove(m)
    bm = bmesh.new()
    bm.from_mesh(basemesh.data)
    bm.verts.ensure_lookup_table()
    doomed = [v for v in bm.verts if not body_mask[v.index]]
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(basemesh.data)
    bm.free()
    basemesh.data.update()
    orig = np.empty(len(basemesh.data.vertices), np.int32)
    basemesh.data.attributes["orig_index"].data.foreach_get("value", orig)
    log("helpers removed:", n, "->", len(basemesh.data.vertices), "verts")

    # Which outfits cover each vertex, as bits (outfit i is bit i) in a "_HIDE"
    # attribute. The page leaves out a triangle when all three of its corners
    # are covered by the outfit being worn: one mesh, exact for every outfit.
    outfit_ids = [o[0] for o in outfits]
    if len(outfit_ids) > 20:
        raise RuntimeError("more outfits than _HIDE has bits for")
    bits = np.zeros(len(orig), np.float32)
    for i, oid in enumerate(outfit_ids):
        if oid in hide:
            bits += np.where(hide[oid][orig], float(1 << i), 0.0).astype(np.float32)
    hide_attr = basemesh.data.attributes.new("_HIDE", "FLOAT", "POINT")
    hide_attr.data.foreach_set("value", bits)
    basemesh.data.attributes.remove(basemesh.data.attributes["orig_index"])
    basemesh.data.materials.clear()
    basemesh.data.materials.append(bpy.data.materials.new("skin"))
    outfit_bits = {oid: i for i, oid in enumerate(outfit_ids)}
    log("outfit bits", outfit_bits, "vertices covered by any outfit:", int((bits > 0).sum()))

    # Lip, scalp and ear vertex groups are kept for the texture step; the rest go.
    for g in list(basemesh.vertex_groups):
        if g.name in ("body",) or g.name.startswith(("helper-", "joint-")) or g.name in ("Mid", "Left", "Right", "HelperGeometry", "JointCubes"):
            basemesh.vertex_groups.remove(g)

    # ---------------------------------------------------------- materials
    for p in pieces:
        set_material(p)
    log("materials set")

    # ---------------------------------------------------------- names
    basemesh.name = basemesh.data.name = "body"
    rig.name = rig.data.name = "skeleton"
    for p in pieces:
        o = p["obj"]
        if p["kind"] == "part":
            nm = p["id"]
        elif p["kind"] == "outfit":
            nm = f"outfit__{p['id']}__{p['src']}"
        else:
            nm = f"{p['kind']}__{p['id']}"
        o.name = o.data.name = nm

    # ---------------------------------------------------------- poses
    for pid, _, bvh in C.POSES:
        reset_pose(rig)
        AnimationService.import_bvh_file_as_pose(rig, os.path.join(USER, "poses", bvh, bvh + ".bvh"))
        rig.animation_data_create()
        act = bpy.data.actions.new(name=pid)
        act.use_fake_user = True
        rig.animation_data.action = act
        for pb in rig.pose.bones:
            path = "rotation_quaternion" if pb.rotation_mode == "QUATERNION" else "rotation_euler"
            pb.keyframe_insert(data_path=path, frame=1)
        log("pose", pid, "from", bvh)
    rig.animation_data.action = None
    reset_pose(rig)
    # Importing a BVH leaves its own action behind; keep only ours.
    for act in list(bpy.data.actions):
        if act.name not in [p[0] for p in C.POSES]:
            bpy.data.actions.remove(act)

    # ---------------------------------------------------------- export
    def export(path, objs, animations=False):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        for o in objs:
            o.hide_set(False)
            o.select_set(True)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.export_scene.gltf(
            filepath=path, export_format="GLB", use_selection=True,
            export_animations=animations, export_animation_mode="ACTIONS",
            export_force_sampling=False, export_optimize_animation_size=True,
            export_skins=True, export_morph=True, export_morph_normal=True,
            export_morph_animation=False, export_try_sparse_sk=True,
            export_shared_accessors=True, export_yup=True, export_apply=False,
            export_image_format="AUTO", export_materials="EXPORT", export_attributes=True,
        )
        log("exported", os.path.relpath(path, OUT), os.path.getsize(path) // 1024, "KB")

    parts = [p["obj"] for p in pieces if p["kind"] == "part"]
    export(os.path.join(OUT, "body.glb"), [rig, basemesh] + parts, animations=True)
    # Eyebrows load when chosen, like hair: some are modelled hair by hair.
    for bid, _, _ in brows:
        export(os.path.join(OUT, "brows", bid + ".glb"), [rig] + [p["obj"] for p in pieces if p["kind"] == "brow" and p["id"] == bid])
    for hid, _, _ in hairs:
        export(os.path.join(OUT, "hair", hid + ".glb"), [rig] + [p["obj"] for p in pieces if p["kind"] == "hair" and p["id"] == hid])
    for oid, _, _ in outfits:
        export(os.path.join(OUT, "outfit", oid + ".glb"), [rig] + [p["obj"] for p in pieces if p["kind"] == "outfit" and p["id"] == oid])
    for gid, _, _ in glasses:
        export(os.path.join(OUT, "glasses", gid + ".glb"), [rig] + [p["obj"] for p in pieces if p["kind"] == "glasses" and p["id"] == gid])
    for bid, _, _ in beards:
        export(os.path.join(OUT, "beard", bid + ".glb"), [rig] + [p["obj"] for p in pieces if p["kind"] == "beard" and p["id"] == bid])

    # ---------------------------------------------------------- credits
    # Who made each asset, from the asset packs' own records (CC-BY needs this).
    packs = {}
    for f in sorted(os.listdir(os.path.join(USER, "packs"))):
        if f.endswith(".json"):
            packs.update(json.load(open(os.path.join(USER, "packs", f))))
    credits = []
    for p in pieces:
        info = packs.get(p["asset"], {})
        credits.append({"kind": p["kind"], "id": p["id"], "asset": p["asset"], "author": info.get("author", "MakeHuman"),
                        "license": info.get("license", "CC0"), "source": info.get("source", "")})
    bad = [c for c in credits if c["license"] not in ("CC0", "CC-BY")]
    if bad:
        raise RuntimeError(f"assets with a licence we can't use: {bad}")
    with open(os.path.join(OUT, "credits.json"), "w") as f:
        json.dump(credits, f, indent=1)
    log("credits", {k: sum(1 for c in credits if c["license"] == k) for k in ("CC0", "CC-BY")})

    # ---------------------------------------------------------- meta
    def to_gltf(v):  # Blender Z-up -> glTF Y-up
        return [round(float(v[0]), 6), round(float(v[2]), 6), round(float(-v[1]), 6)]

    meta = {
        "version": 1,
        "built": time.strftime("%Y-%m-%d"),
        "height": round(float(H0[body_mask, 2].max() - ground0), 4),
        "outfitBits": outfit_bits,
        "face": [{"id": f[0], "label": f[1], "area": f[2], "down": bool(f[3])} for f in C.FACE],
        "body": [{"id": b[0], "label": b[1], "downLabel": b[5], "upLabel": b[6]} for b in C.BODY],
        "joints": {k: {b: to_gltf(d) for b, d in v.items()} for k, v in joints_out.items()},
        "ground": {k: round(v, 6) for k, v in ground_out.items()},
        "morphs": {f"{p['kind']}__{p['id']}" + (f"__{p['src']}" if p["kind"] == "outfit" else ""): p["morphs"] for p in pieces},
    }
    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "character.blend"))
    log("done")


# ---------------------------------------------------------------- materials

ROUGH = {"hair": 0.55, "brow": 0.9, "beard": 0.7, "outfit": 0.85, "glasses": 0.25, "part": 0.6}


def set_material(p):
    o = p["obj"]
    mm = read_mhmat(p["fit"].material)
    mat = bpy.data.materials.new(f"{p['kind']}__{p['id']}" + (f"__{p.get('src')}" if p["kind"] == "outfit" else ""))
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = ROUGH.get(p["kind"], 0.7)
    try:
        r, g, b = [float(x) for x in mm.get("diffuseColor", "1 1 1").split()[:3]]
    except Exception:
        r = g = b = 1.0
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1)
    tex = mm.get("diffuseTexture")
    if tex and p.get("src") in C.LOGO_FIX:
        clean, n = remove_marks(load_png(tex), C.LOGO_FIX[p["src"]])
        fixed = os.path.join(OUT, "_tex", os.path.basename(tex))
        os.makedirs(os.path.dirname(fixed), exist_ok=True)
        save_png(fixed, clean)
        log("logo painted out of", p["src"], n, "px")
        tex = fixed
    if tex:
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(tex, check_existing=True)
        nt.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
        transparent = str(mm.get("transparent", "False")).lower() == "true" or p["kind"] in ("hair", "brow", "beard") or p["id"] == "eyelashes"
        if transparent and node.image.channels == 4:
            nt.links.new(node.outputs["Alpha"], bsdf.inputs["Alpha"])
    nrm = mm.get("normalmapTexture")
    if nrm and p["kind"] == "outfit":
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(nrm, check_existing=True)
        node.image.colorspace_settings.name = "Non-Color"
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(node.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    o.data.materials.clear()
    o.data.materials.append(mat)


main()
