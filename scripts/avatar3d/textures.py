"""Skin, eyes, face paint and tattoo textures for the creator.

    blender -b --python scripts/avatar3d/textures.py -- --out ~/autinerary-3d/build

Writes into <out>/skin, <out>/eyes and <out>/icons:
- skin/detail.png: MakeHuman's skin with its own colour divided out, so the
  page can multiply in any skin tone (light to deep) and keep the detail.
- skin/<mask>.png + skin/masks.json: where the lips are, and each facial
  feature, face paint and tattoo, as alpha masks cropped to where they are on
  the 2048px texture. The page tints and layers them on a canvas.
- eyes/<id>.png: the eye colours.
- icons/...: flat icons of each face paint, feature and tattoo, as alpha masks
  the page tints with the colour picked (CSS mask-image).

Designs are drawn in "face units": 0,0 between the eyes, 1 unit = the distance
between the eyes, x towards the character's left, z up. Each texel of the skin
texture knows where it is on the body (the mesh is rasterised in UV space), so
a design drawn from the front lands on the face as if painted there.
"""
import bpy, os, sys, json, math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import C, USER, RIG_FILE, arg, log, build_human, coords, load_png, save_png, blur, dilate  # noqa: E402
from bl_ext.user_default.mpfb.entities.rig import Rig  # noqa: E402

OUT = os.path.expanduser(arg("--out", "~/autinerary-3d/build"))
R = 2048
for d in ("skin", "eyes", "icons"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)


# ---------------------------------------------------------------- shapes (SDFs)

def soft(d, w):
    """Alpha from a signed distance (negative inside), with an edge w wide."""
    return np.clip(0.5 - d / w, 0.0, 1.0)


def sd_circle(x, y, cx, cy, r):
    return np.hypot(x - cx, y - cy) - r


def sd_segment(x, y, ax, ay, bx, by, r):
    px, py, dx, dy = x - ax, y - ay, bx - ax, by - ay
    t = np.clip((px * dx + py * dy) / (dx * dx + dy * dy), 0, 1)
    return np.hypot(px - t * dx, py - t * dy) - r


def sd_polygon(x, y, pts):
    pts = np.asarray(pts, np.float64)
    d = np.full(x.shape, np.inf)
    inside = np.zeros(x.shape, bool)
    n = len(pts)
    for i in range(n):
        ax, ay = pts[i]
        bx, by = pts[(i + 1) % n]
        d = np.minimum(d, sd_segment(x, y, ax, ay, bx, by, 0.0))
        cond = ((ay > y) != (by > y)) & (x < (bx - ax) * (y - ay) / (by - ay + 1e-12) + ax)
        inside ^= cond
    return np.where(inside, -d, d)


def star_pts(cx, cy, r, points=5, inner=0.45, rot=0.0):
    pts = []
    for i in range(points * 2):
        a = rot + math.pi / 2 + i * math.pi / points
        rr = r if i % 2 == 0 else r * inner
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


def heart_pts(cx, cy, s, n=72):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * s / 17, cy + y * s / 17))
    return pts


def union(*alphas):
    out = np.zeros_like(alphas[0])
    for a in alphas:
        out = np.maximum(out, a)
    return out


# Designs in face units (x: character's left, z: up). Each returns alpha 0..1.
E = 0.012  # edge softness, in face units

def mirror(fn):
    return lambda x, z: union(fn(x, z), fn(-x, z))


FEATURES = {
    "freckles": None,  # made below from seeded dots
    "blush": lambda x, z: 0.5 * np.exp(-(((np.abs(x) - 0.62) / 0.26) ** 2 + ((z + 0.62) / 0.2) ** 2)),
    "beauty-mark": lambda x, z: 0.9 * soft(sd_circle(x, z, 0.36, -1.06, 0.032), E),
    "mole": lambda x, z: 0.85 * soft(sd_circle(x, z, -0.66, -0.5, 0.028), E),
    "scar": lambda x, z: 0.55 * soft(sd_segment(x, z, 0.5, 0.42, 0.66, -0.2, 0.018), E),
}

FACE_PAINT = {
    "stripes": mirror(lambda x, z: union(
        soft(sd_segment(x, z, 0.5, -0.5, 0.9, -0.44, 0.045), E),
        soft(sd_segment(x, z, 0.52, -0.68, 0.9, -0.62, 0.045), E))),
    "star": lambda x, z: soft(sd_polygon(x, z, star_pts(0.66, -0.56, 0.22, rot=0.1)), E),
    "heart": lambda x, z: soft(sd_polygon(x, z, heart_pts(-0.64, -0.58, 0.2)), E),
    "lightning": lambda x, z: soft(sd_polygon(x, z, [(-0.62, 0.62), (-0.2, 0.62), (-0.42, 0.12), (-0.18, 0.12), (-0.72, -0.72), (-0.55, -0.08), (-0.78, -0.08)]), E),
    "whiskers": mirror(lambda x, z: union(
        soft(sd_segment(x, z, 0.36, -0.78, 0.95, -0.6, 0.016), E),
        soft(sd_segment(x, z, 0.38, -0.86, 0.98, -0.84, 0.016), E),
        soft(sd_segment(x, z, 0.36, -0.94, 0.94, -1.08, 0.016), E))),
    "eye-mask": lambda x, z: soft(np.maximum(np.hypot(x / 1.05, (z - 0.02) / 0.3) - 1.0, -np.inf), 0.02),
    "dots": mirror(lambda x, z: union(
        soft(sd_circle(x, z, 0.34, -0.44, 0.045), E),
        soft(sd_circle(x, z, 0.52, -0.5, 0.045), E),
        soft(sd_circle(x, z, 0.7, -0.44, 0.045), E))),
    "rainbow": lambda x, z: union(*[
        soft(np.abs(np.hypot(x - 0.66, z + 0.78) - r) - 0.028, E) * (z > -0.78) for r in (0.16, 0.24, 0.32)]),
}

# Tattoos, on the left arm, below where a short sleeve ends, in metres: along
# the bone from shoulder/elbow, and
# around the arm (0 = facing forward, positive = towards the outside).
TATTOOS = {
    "arm-band": ("upper", lambda t, s, L: union(
        soft(np.abs(t * L - 0.66 * L) - 0.004, 0.0015),
        soft(np.abs(t * L - 0.66 * L - 0.03) - 0.004, 0.0015),
        soft(np.abs((t * L - 0.66 * L - 0.015) + 0.009 * np.abs(((s / 0.018) % 2) - 1) * 2 - 0.009) - 0.0025, 0.0015)
        * (np.abs(t * L - 0.66 * L - 0.015) < 0.011))),
    "vine": ("lower", lambda t, s, L: union(
        soft(np.abs(s - 0.045 - 0.012 * np.sin(t * L / 0.035)) - 0.0022, 0.0012) * ((t > 0.12) & (t < 0.86)),
        *[soft(np.hypot((t * L - tl * L) / 0.011, (s - 0.045 - 0.012 * math.sin(tl * L / 0.035) - side * 0.012) / 0.006) - 1, 0.25)
          for tl, side in ((0.22, 1), (0.34, -1), (0.46, 1), (0.58, -1), (0.7, 1), (0.8, -1))])),
    "wrist-star": ("lower", lambda t, s, L: soft(sd_polygon(t * L, s, star_pts(0.86 * L, 0.04, 0.016)), 0.0012)),
    "sun": ("upper", lambda t, s, L: union(
        soft(sd_circle(t * L, s, 0.7 * L, 0.03, 0.016), 0.0012),
        *[soft(sd_segment(t * L, s, 0.7 * L + 0.022 * math.cos(a), 0.03 + 0.022 * math.sin(a),
                          0.7 * L + 0.034 * math.cos(a), 0.03 + 0.034 * math.sin(a), 0.0022), 0.0012)
          for a in np.linspace(0, 2 * math.pi, 12, endpoint=False)])),
    "waves": ("lower", lambda t, s, L: union(*[
        soft(np.abs(s - 0.02 - k * 0.016 - 0.006 * np.sin(t * L / 0.012)) - 0.0018, 0.0012) * ((t > 0.3) & (t < 0.7))
        for k in range(3)])),
}


def freckles(x, z):
    rng = np.random.default_rng(7)
    out = np.zeros_like(x)
    dots = []
    for _ in range(140):
        side = rng.choice([-1, 1])
        cx = side * abs(rng.normal(0.42, 0.2))
        cz = rng.normal(-0.5, 0.12)
        if abs(cx) < 0.12 and cz < -0.62:
            continue
        dots.append((cx, cz, rng.uniform(0.012, 0.024), rng.uniform(0.35, 0.75)))
    for cx, cz, r, a in dots:
        out = np.maximum(out, a * soft(sd_circle(x, z, cx, cz, r), 0.008))
    return out


FEATURES["freckles"] = freckles


# ---------------------------------------------------------------- the body in UV space

def rasterise(basemesh, H):
    me = basemesh.data
    n = len(me.vertices)
    gi = basemesh.vertex_groups["body"].index
    li = basemesh.vertex_groups["lips"].index
    si = basemesh.vertex_groups["scalp"].index
    ni = basemesh.vertex_groups["nipple"].index
    body = np.zeros(n, bool)
    lips = np.zeros(n, np.float32)
    scalp = np.zeros(n, np.float32)
    nipple = np.zeros(n, np.float32)
    for v in me.vertices:
        for g in v.groups:
            if g.group == gi:
                body[v.index] = True
            elif g.group == li:
                lips[v.index] = g.weight
            elif g.group == si:
                scalp[v.index] = g.weight
            elif g.group == ni:
                nipple[v.index] = max(g.weight, 0.0) or 1.0
    # Vertex normals of the neutral (shaped) body.
    tris = []
    uv = me.uv_layers.active.data
    for poly in me.polygons:
        vs = list(poly.vertices)
        if not body[vs].all():
            continue
        ls = list(poly.loop_indices)
        for k in range(1, len(vs) - 1):
            tris.append((vs[0], vs[k], vs[k + 1], ls[0], ls[k], ls[k + 1]))
    tris = np.array(tris, np.int64)
    fn = np.cross(H[tris[:, 1]] - H[tris[:, 0]], H[tris[:, 2]] - H[tris[:, 0]])
    vn = np.zeros_like(H)
    for k in range(3):
        np.add.at(vn, tris[:, k], fn)
    vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)
    uvs = np.empty(len(uv) * 2, np.float32)
    uv.foreach_get("uv", uvs)
    uvs = uvs.reshape(-1, 2)

    pos = np.zeros((R, R, 3), np.float32)
    nrm = np.zeros((R, R, 3), np.float32)
    lip = np.zeros((R, R), np.float32)
    scp = np.zeros((R, R), np.float32)
    nip = np.zeros((R, R), np.float32)
    cover = np.zeros((R, R), bool)
    for a, b, c, la, lb, lc in tris:
        p = np.array([uvs[la], uvs[lb], uvs[lc]], np.float64)
        px = p[:, 0] * R - 0.5
        py = (1 - p[:, 1]) * R - 0.5
        x0, x1 = int(max(0, math.floor(px.min()))), int(min(R - 1, math.ceil(px.max())))
        y0, y1 = int(max(0, math.floor(py.min()))), int(min(R - 1, math.ceil(py.max())))
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        den = (py[1] - py[2]) * (px[0] - px[2]) + (px[2] - px[1]) * (py[0] - py[2])
        if abs(den) < 1e-12:
            continue
        w0 = ((py[1] - py[2]) * (gx - px[2]) + (px[2] - px[1]) * (gy - py[2])) / den
        w1 = ((py[2] - py[0]) * (gx - px[2]) + (px[0] - px[2]) * (gy - py[2])) / den
        w2 = 1 - w0 - w1
        inside = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
        if not inside.any():
            continue
        yy, xx = gy[inside], gx[inside]
        W = np.stack([w0[inside], w1[inside], w2[inside]], 1)
        pos[yy, xx] = W @ H[[a, b, c]]
        nn = W @ vn[[a, b, c]]
        nrm[yy, xx] = nn / np.maximum(np.linalg.norm(nn, axis=1, keepdims=True), 1e-12)
        lip[yy, xx] = W @ lips[[a, b, c]]
        scp[yy, xx] = W @ scalp[[a, b, c]]
        nip[yy, xx] = W @ nipple[[a, b, c]]
        cover[yy, xx] = True
    return pos, nrm, lip, scp, nip, cover


def crop_save(name, alpha, masks):
    ys, xs = np.nonzero(alpha > 0.01)
    if not len(ys):
        raise RuntimeError(f"mask {name} came out empty")
    y0, y1 = max(0, ys.min() - 4), min(R, ys.max() + 5)
    x0, x1 = max(0, xs.min() - 4), min(R, xs.max() + 5)
    a = alpha[y0:y1, x0:x1].astype(np.float32)
    rgba = np.concatenate([np.ones(a.shape + (3,), np.float32), a[:, :, None]], 2)
    save_png(os.path.join(OUT, "skin", name + ".png"), rgba)
    masks[name] = {"x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0)}
    log("mask", name, masks[name])


def main():
    basemesh, rig = build_human(rig=False)
    H = coords(basemesh)
    pos, nrm, lip, scp, nip, cover = rasterise(basemesh, H)
    log("rasterised", int(cover.sum()), "texels")

    # ------------------------------------------------ landmarks
    eyes = next(o for o in bpy.data.objects if o.type == "MESH" and C.EYE_MESH in o.name)
    E3 = coords(eyes)
    eyeL = E3[E3[:, 0] > 0].mean(0)
    eyeR = E3[E3[:, 0] < 0].mean(0)
    origin = (eyeL + eyeR) / 2
    unit = float(np.linalg.norm(eyeL - eyeR))
    log("eyes", eyeL.round(4), eyeR.round(4), "unit", round(unit, 4))
    fx = (pos[..., 0] - origin[0]) / unit
    fz = (pos[..., 2] - origin[2]) / unit
    front = np.clip((-nrm[..., 1] - 0.25) / 0.35, 0, 1)
    face_zone = cover & (fz > -2.4) & (fz < 1.6) & (np.abs(fx) < 1.6) & (pos[..., 1] < origin[1] + 0.03)

    masks = {}
    # Lips, from the body's lips group, softened at the edge.
    lips_a = np.clip(blur(lip, 1.5) * 1.6 - 0.15, 0, 1) * cover
    crop_save("lips", lips_a, masks)

    def face_mask(fn):
        a = np.zeros((R, R), np.float32)
        a[face_zone] = fn(fx[face_zone], fz[face_zone])
        return a * front

    for fid, fn in FEATURES.items():
        crop_save("feature-" + fid, face_mask(fn), masks)
    for pid, fn in FACE_PAINT.items():
        crop_save("paint-" + pid, face_mask(fn), masks)

    # Arms, from the rig's joints (the rig file names them; positions from this body).
    rigdef = Rig.from_json_file_and_basemesh(RIG_FILE, basemesh)
    J = {n: np.array(rigdef.get_best_location_from_strategy(i["head"])) for n, i in rigdef.rig_definition.items()}
    shoulder, elbow, wrist = J["upperarm01.L"], J["lowerarm01.L"], J["wrist.L"]
    segs = {"upper": (shoulder, elbow), "lower": (elbow, wrist)}
    for tid, (seg, fn) in TATTOOS.items():
        A, B = segs[seg]
        axis = B - A
        L = float(np.linalg.norm(axis))
        ax = axis / L
        fwd = np.array([0.0, -1.0, 0.0])
        fwd = fwd - fwd.dot(ax) * ax
        fwd /= np.linalg.norm(fwd)
        out_dir = np.cross(ax, fwd)
        if out_dir[0] < 0:
            out_dir = -out_dir
        rel = pos - A
        t = rel @ ax / L
        perp = rel - (rel @ ax)[..., None] * ax
        r = np.linalg.norm(perp, axis=-1)
        theta = np.arctan2(perp @ out_dir, perp @ fwd)
        s = theta * 0.04  # arc length on a ~4 cm arm
        zone = cover & (t > -0.05) & (t < 1.05) & (r < 0.07) & (pos[..., 0] > 0.12)
        a = np.zeros((R, R), np.float32)
        a[zone] = fn(t[zone], s[zone], L)
        crop_save("tattoo-" + tid, a, masks)

    with open(os.path.join(OUT, "skin", "masks.json"), "w") as f:
        json.dump({"size": R, "masks": masks}, f, indent=1)

    # ------------------------------------------------ the toned skin's detail
    folder, fname = C.SKIN_SOURCE
    src = load_png(os.path.join(USER, "skins", folder, fname))[..., :3]
    if src.shape[0] != R:
        raise RuntimeError("expected a 2048px skin")
    body_px = cover & (scp < 0.2) & (lips_a < 0.05)
    mean = src[body_px].mean(0)
    detail = src / mean
    detail = 1 + (detail - 1) * 0.85
    # A smoother scalp (MakeHuman's has stubble painted on).
    sc = np.clip(blur(scp, 2.0) * 1.2, 0, 1)[..., None]
    detail = detail * (1 - 0.6 * sc) + 0.6 * sc * blur(detail.mean(-1), 6)[..., None]
    # No nipple colour: the chest is always covered, but if a garment ever
    # fails to load the body reads as a mannequin, not as undressed.
    ys, xs = np.nonzero(nip > 0)
    y0, y1 = max(0, ys.min() - 80), min(R, ys.max() + 80)
    x0, x1 = max(0, xs.min() - 80), min(R, xs.max() + 80)
    nz = np.clip(blur(nip[y0:y1, x0:x1], 3.0) * 2.0, 0, 1)[..., None]
    crop = detail[y0:y1, x0:x1]
    around = np.stack([blur(crop[..., ch], 14) for ch in range(3)], -1)
    detail[y0:y1, x0:x1] = crop * (1 - nz) + around * nz
    detail = np.clip(detail * 0.92, 0, 1)
    near = dilate(cover, 10)
    detail[~near] = 0.92
    save_png(os.path.join(OUT, "skin", "detail.png"), detail.astype(np.float32))
    log("skin detail saved; source mean colour", mean.round(3))

    # ------------------------------------------------ eyes
    # Kept with their alpha: the eye's clear outer layer (cornea) is see-through.
    # Each eye colour's tile is its iris, cut out round.
    os.makedirs(os.path.join(OUT, "thumbs", "eyes"), exist_ok=True)
    for eid, _, f in C.EYES:
        img = load_png(os.path.join(USER, "eyes", "materials", f))
        save_png(os.path.join(OUT, "eyes", eid + ".png"), img)
        n = img.shape[0]
        cx, cy, half = int(0.7075 * n), int(0.295 * n), int(0.1 * n)
        crop = img[cy - half:cy + half, cx - half:cx + half, :3].copy()
        yy, xx = np.mgrid[-half:half, -half:half] / half
        alpha = soft(np.hypot(xx, yy) - 0.96, 0.03)
        save_png(os.path.join(OUT, "thumbs", "eyes", eid + ".png"), np.dstack([crop, alpha]).astype(np.float32))
    log("eyes saved", len(C.EYES))

    # ------------------------------------------------ icons (flat, front view)
    S = 160
    g = (np.arange(S) + 0.5) / S
    ix = (g - 0.5) * 3.2           # face units across
    iz = (0.5 - g) * 3.6 - 0.35    # face units down
    IX, IZ = np.meshgrid(ix, iz)
    os.makedirs(os.path.join(OUT, "icons", "paint"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "icons", "feature"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "icons", "tattoo"), exist_ok=True)
    head = soft(np.hypot(IX / 1.2, (IZ + 0.35) / 1.6) - 1, 0.03)
    line = lambda d: soft(np.abs(d) - 0.025, 0.02)
    face = union(
        line(np.hypot(IX / 1.2, (IZ + 0.35) / 1.6) - 1),
        line(np.hypot((np.abs(IX) - 0.5) / 0.2, IZ / 0.09) - 1),
        line(sd_segment(IX, IZ, 0.0, -0.1, 0.06, -0.62, 0.0)),
        line(np.where(IZ < -1.0, np.hypot(IX / 0.32, (IZ + 0.98) / 0.12) - 1, 1)),
    )
    save_png(os.path.join(OUT, "icons", "face.png"), np.dstack([np.ones((S, S, 3)), face]).astype(np.float32))
    save_png(os.path.join(OUT, "icons", "face-fill.png"), np.dstack([np.ones((S, S, 3)), head]).astype(np.float32))
    for pid, fn in FACE_PAINT.items():
        save_png(os.path.join(OUT, "icons", "paint", pid + ".png"), np.dstack([np.ones((S, S, 3)), fn(IX, IZ) * head]).astype(np.float32))
    for fid, fn in FEATURES.items():
        a = fn(IX, IZ) * head
        a = a / max(1e-6, a.max())
        if fid in ("beauty-mark", "mole", "scar"):
            # Tiny on a face; thickened so the icon shows what it is.
            for _ in range(3):
                g = a.copy()
                g[1:] = np.maximum(g[1:], a[:-1]); g[:-1] = np.maximum(g[:-1], a[1:])
                g[:, 1:] = np.maximum(g[:, 1:], a[:, :-1]); g[:, :-1] = np.maximum(g[:, :-1], a[:, 1:])
                a = g
        save_png(os.path.join(OUT, "icons", "feature", fid + ".png"), np.dstack([np.ones((S, S, 3)), a]).astype(np.float32))
    # Tattoo icons: the arm's skin unrolled, 26 cm long and 18 cm around.
    tt = (np.arange(S) + 0.5) / S
    T, Sg = np.meshgrid(tt, (0.5 - tt) * 0.18)
    arm = soft(np.abs(Sg) - 0.075, 0.003)
    save_png(os.path.join(OUT, "icons", "arm.png"), np.dstack([np.ones((S, S, 3)), arm]).astype(np.float32))
    for tid, (seg, fn) in TATTOOS.items():
        L = 0.28 if seg == "upper" else 0.26
        save_png(os.path.join(OUT, "icons", "tattoo", tid + ".png"), np.dstack([np.ones((S, S, 3)), fn(T, Sg, L) * arm]).astype(np.float32))
    log("icons saved")


main()
