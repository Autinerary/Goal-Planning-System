"""Thumbnails for the creator's grids, rendered in Blender (EEVEE).

    blender -b --python scripts/avatar3d/thumbs.py -- --out ~/autinerary-3d/build

Writes <out>/thumbs/{hair,brows,glasses,outfit}/<id>.png (and none.png),
on a plain grey mannequin with a see-through background, so they read like
the game's icons and suit any colour behind them. Hair and eyebrows are shown
in one mid brown (the page tints them with the colour picked).
"""
import bpy, os, sys, math
import mathutils

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from common import C, USER, arg, log, build_human, add_piece, asset_path, find_mhclo, reset_pose, read_mhmat, Fit, coords, SkinCover  # noqa: E402
from bl_ext.user_default.mpfb.services.animationservice import AnimationService  # noqa: E402

OUT = os.path.expanduser(arg("--out", "~/autinerary-3d/build"))
QUICK = "--quick" in sys.argv
SIZE = 256
HAIR_TINT = (0.30, 0.20, 0.13)


def plain(name, color, rough=0.6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    return m


def sock(sockets, identifier):
    """A node socket by identifier (Mix nodes have several sockets with the same name)."""
    return next(x for x in sockets if x.identifier == identifier)


def tinted(name, image_path, color, rough=0.5):
    """Grey version of a hair/brow texture, times a colour, cut out by its alpha (like the page)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(image_path, check_existing=True)
    bw = nt.nodes.new("ShaderNodeRGBToBW")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["To Min"].default_value = 0.3
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    sock(mul.inputs, "B_Color").default_value = (*color, 1)
    nt.links.new(tex.outputs["Color"], bw.inputs["Color"])
    nt.links.new(bw.outputs["Val"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], sock(mul.inputs, "A_Color"))
    nt.links.new(sock(mul.outputs, "Result_Color"), b.inputs["Base Color"])
    nt.links.new(tex.outputs["Alpha"], b.inputs["Alpha"])
    b.inputs["Roughness"].default_value = rough
    return m


def textured(name, mm, rough=0.8):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = rough
    tex = mm.get("diffuseTexture")
    if tex:
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(tex, check_existing=True)
        nt.links.new(node.outputs["Color"], b.inputs["Base Color"])
        if node.image.channels == 4:
            nt.links.new(node.outputs["Alpha"], b.inputs["Alpha"])
    return m


def set_mat(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def aim(obj, target):
    obj.rotation_euler = (mathutils.Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def main():
    basemesh, rig = build_human(rig=True)
    set_mat(basemesh, plain("mannequin", (0.62, 0.66, 0.71)))
    eyes = lashes = None
    for o in rig.children:
        if o.type != "MESH" or o is basemesh:
            continue
        n = o.name.lower()
        if C.EYE_MESH in n:
            eyes = o
            set_mat(o, plain("eyes", (0.85, 0.86, 0.88), 0.2))
        elif "eyelash" in n:
            lashes = o
            o.hide_render = True
        else:
            o.hide_render = True  # teeth, tongue
    top = max((basemesh.matrix_world @ v.co).z for v in basemesh.data.vertices)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    try:
        scene.eevee.taa_render_samples = 32
    except Exception:
        pass
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_x = scene.render.resolution_y = SIZE
    scene.view_settings.view_transform = "AgX"
    scene.world = scene.world or bpy.data.worlds.new("w")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.58, 0.64, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.45
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    for name, loc, energy in [("key", (1.2, -2.0, top + 0.5), 70), ("fill", (-2.0, -1.2, top - 0.1), 25), ("rim", (0.4, 2.2, top + 0.6), 90)]:
        lo = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
        lo.data.energy = energy
        lo.data.size = 1.6
        lo.location = loc
        scene.collection.objects.link(lo)
        aim(lo, (0, 0, top - 0.25))

    def frame(kind):
        if kind == "head":
            cam.data.lens = 85
            a, d, tz = math.radians(30), 1.25, top - 0.13
            cam.location = (math.sin(a) * d, -math.cos(a) * d, tz + 0.03)
            aim(cam, (0, 0, tz))
        elif kind == "face":
            # Close on the eyes and brows, so brow shapes are easy to tell apart.
            cam.data.lens = 190
            cam.location = (0, -0.85, top - 0.095)
            aim(cam, (0, 0, top - 0.098))
        else:
            cam.data.lens = 50
            cam.location = (0.6, -2.75, top * 0.52)
            aim(cam, (0, 0, top * 0.5))

    def shot(sub, name):
        os.makedirs(os.path.join(OUT, "thumbs", sub), exist_ok=True)
        scene.render.filepath = os.path.join(OUT, "thumbs", sub, name + ".png")
        bpy.ops.render.render(write_still=True)

    hairs = C.HAIRS[:3] if QUICK else C.HAIRS
    brows = C.BROWS[:3] if QUICK else C.BROWS
    glasses = C.GLASSES[:2] if QUICK else C.GLASSES
    outfits = C.OUTFITS[:3] if QUICK else C.OUTFITS

    # Hairstyles: the head, three quarters on.
    frame("head")
    shot("hair", "none")
    for hid, _, src in hairs:
        path = asset_path("hair", src)
        o = add_piece(basemesh, path, "Hair")
        tex = read_mhmat(Fit(path).material).get("diffuseTexture")
        set_mat(o, tinted("hair_" + hid, tex, HAIR_TINT) if tex else plain("hair_" + hid, HAIR_TINT))
        shot("hair", hid)
        bpy.data.objects.remove(o, do_unlink=True)
    log("hair thumbnails", len(hairs) + 1)

    # Eyebrows: the face, straight on, with lashes.
    frame("face")
    if lashes:
        lashes.hide_render = False
        set_mat(lashes, plain("lashes", (0.08, 0.06, 0.05)))
    shot("brows", "none")
    for bid, _, src in brows:
        path = asset_path("eyebrows", src)
        o = add_piece(basemesh, path, "Eyebrows")
        tex = read_mhmat(Fit(path).material).get("diffuseTexture")
        set_mat(o, tinted("brow_" + bid, tex, (0.07, 0.05, 0.035)) if tex else plain("brow_" + bid, HAIR_TINT))
        shot("brows", bid)
        bpy.data.objects.remove(o, do_unlink=True)
    log("eyebrow thumbnails", len(brows) + 1)

    # Glasses: the face, three quarters on.
    cam.data.lens = 100
    a, d, tz = math.radians(25), 0.95, top - 0.12
    cam.location = (math.sin(a) * d, -math.cos(a) * d, tz)
    aim(cam, (0, 0, tz))
    shot("glasses", "none")
    for gid, _, src in glasses:
        _, path = find_mhclo(src)
        o = add_piece(basemesh, path, "Clothes")
        set_mat(o, textured("glasses_" + gid, read_mhmat(Fit(path).material), 0.3))
        shot("glasses", gid)
        bpy.data.objects.remove(o, do_unlink=True)
    log("glasses thumbnails", len(glasses) + 1)

    # Facial hair: the head, three quarters on, in the eyebrow brown.
    beards = C.BEARDS[:2] if QUICK else C.BEARDS
    frame("head")
    cam.location = (cam.location.x, cam.location.y, cam.location.z - 0.04)
    aim(cam, (0, 0, top - 0.17))
    shot("beard", "none")
    for bid, _, src in beards:
        _, path = find_mhclo(src)
        o = add_piece(basemesh, path, "Clothes")
        tex = read_mhmat(Fit(path).material).get("diffuseTexture")
        set_mat(o, tinted("beard_" + bid, tex, (0.16, 0.11, 0.08)) if tex else plain("beard_" + bid, (0.16, 0.11, 0.08)))
        shot("beard", bid)
        bpy.data.objects.remove(o, do_unlink=True)
    log("facial hair thumbnails", len(beards) + 1)

    # Outfits: the whole body, standing (the pose the page starts in).
    if lashes:
        lashes.hide_render = True
    reset_pose(rig)
    pid, _, bvh = C.POSES[0]
    AnimationService.import_bvh_file_as_pose(rig, os.path.join(USER, "poses", bvh, bvh + ".bvh"))
    bpy.context.view_layer.update()
    frame("body")
    scene.render.resolution_x, scene.render.resolution_y = SIZE, int(SIZE * 1.25)
    H = coords(basemesh)
    body_mask = np.zeros(len(basemesh.data.vertices), bool)
    gi = basemesh.vertex_groups["body"].index
    for v in basemesh.data.vertices:
        if any(g.group == gi for g in v.groups):
            body_mask[v.index] = True
    cover = SkinCover(basemesh, H, body_mask)
    for oid, _, srcs in outfits:
        added = []
        hidden = np.zeros(len(H), bool)
        for src in srcs:
            _, path = find_mhclo(src)
            o = add_piece(basemesh, path, "Clothes")
            fit = Fit(path)
            hidden |= cover.of(fit.apply(H), fit.delverts)
            mm = read_mhmat(Fit(path).material)
            fixed = os.path.join(OUT, "_tex", os.path.basename(mm.get("diffuseTexture") or ""))
            if src in C.LOGO_FIX and os.path.isfile(fixed):
                mm["diffuseTexture"] = fixed
            set_mat(o, textured("outfit_" + src, mm))
            added.append(o)
        # Leave out the skin under the outfit, as the page does.
        group = basemesh.vertex_groups.new(name="covered")
        group.add([int(i) for i in np.nonzero(hidden)[0]], 1.0, "REPLACE")
        mask = basemesh.modifiers.new("covered", "MASK")
        mask.vertex_group = "covered"
        mask.invert_vertex_group = True
        shot("outfit", oid)
        basemesh.modifiers.remove(mask)
        basemesh.vertex_groups.remove(group)
        for o in added:
            bpy.data.objects.remove(o, do_unlink=True)
    log("outfit thumbnails", len(outfits))


main()
