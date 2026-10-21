"""Shared by build.py, textures.py and thumbs.py: building the character with MPFB."""
import bpy, os, sys, time, math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catalog as C  # noqa: E402,F401

from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.user_default.mpfb.services.targetservice import TargetService  # noqa: E402,F401
from bl_ext.user_default.mpfb.services.locationservice import LocationService  # noqa: E402
from bl_ext.user_default.mpfb.entities.clothes.mhclo import Mhclo  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
USER = LocationService.get_user_data()
SYS_TARGETS = LocationService.get_mpfb_data("targets")
RIG_FILE = os.path.join(LocationService.get_mpfb_data("rigs"), "standard", f"rig.{C.RIG}.json")
T0 = time.time()


def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default


def log(*a):
    print(f"[{time.time() - T0:6.1f}s]", *a, flush=True)


def clear_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def asset_path(sub, name, ext=".mhclo"):
    p = os.path.join(USER, sub, name, name + ext)
    if not os.path.isfile(p):
        raise IOError(f"missing asset {sub}/{name}")
    return p


def find_mhclo(name):
    for sub in ("clothes", "hair", "eyebrows"):
        p = os.path.join(USER, sub, name)
        if os.path.isdir(p):
            for f in os.listdir(p):
                if f.endswith(".mhclo"):
                    return sub, os.path.join(p, f)
    raise IOError(f"missing asset {name}")


def target_path(spec):
    if spec.startswith("faceunits/"):
        return os.path.join(USER, "targets", spec + ".target")
    return os.path.join(SYS_TARGETS, spec + ".target.gz")


def coords(obj):
    """The mesh's vertex positions with its shape keys mixed in, as float64 Nx3."""
    me = obj.data
    arr = np.empty(len(me.vertices) * 3, np.float32)
    if me.shape_keys and len(me.shape_keys.key_blocks):
        sk = obj.shape_key_add(name="__mix", from_mix=True)
        sk.data.foreach_get("co", arr)
        obj.shape_key_remove(sk)
    else:
        me.vertices.foreach_get("co", arr)
    return arr.reshape(-1, 3).astype(np.float64)


class Fit:
    """MPFB's fitting (ClothesService.fit_clothes_to_human), vectorised."""

    def __init__(self, path):
        m = Mhclo()
        m.load(path)
        n = len(m.verts)
        self.idx = np.array([m.verts[i]["verts"] for i in range(n)], np.int64)
        self.w = np.array([m.verts[i]["weights"] for i in range(n)], np.float64)
        self.off = np.array([tuple(m.verts[i]["offsets"]) for i in range(n)], np.float64)
        self.scales = (m.x_scale, m.y_scale, m.z_scale)
        self.delverts = np.array(sorted(set(m.delverts)), np.int64)
        self.material = m.material

    def apply(self, H, scale_factor=0.1):
        xs, ys, zs = self.scales
        if xs:
            x = abs(H[xs[0], 0] - H[xs[1], 0]) / xs[2]
            y = abs(H[ys[0], 2] - H[ys[1], 2]) / ys[2]
            z = abs(H[zs[0], 1] - H[zs[1], 1]) / zs[2]
        else:
            x = y = z = scale_factor
        return (self.w[:, :, None] * H[self.idx]).sum(1) + self.off * np.array([x, z, y])


def build_human(rig=True, skin=None):
    """The neutral character: body, eyes, eyelashes, teeth, tongue (and the rig)."""
    clear_scene()
    info = HumanService._create_default_human_info_dict()
    if rig:
        info["rig"] = C.RIG
    info["eyes"] = f"{C.EYE_MESH}/{C.EYE_MESH}.mhclo"
    info["eyelashes"] = f"{C.EYELASHES}/{C.EYELASHES}.mhclo"
    info["teeth"] = f"{C.TEETH}/{C.TEETH}.mhclo"
    info["tongue"] = f"{C.TONGUE}/{C.TONGUE}.mhclo"
    info["clothes"] = []
    if skin:
        info["skin_mhmat"] = skin
        info["skin_material_type"] = "MAKESKIN"
    settings = HumanService.get_default_deserialization_settings()
    settings["subdiv_levels"] = 0
    basemesh = HumanService.deserialize_from_dict(info, settings)
    return basemesh, basemesh.parent


def add_piece(basemesh, path, kind, material_type="MAKESKIN"):
    obj = HumanService.add_mhclo_asset(path, basemesh, asset_type=kind, subdiv_levels=0, material_type=material_type)
    # MPFB hides the body under clothes with a Mask modifier; build.py's regions do that instead.
    for m in list(basemesh.modifiers):
        if m.type == "MASK" and m.vertex_group != "body":
            basemesh.modifiers.remove(m)
    return obj


def reset_pose(rig):
    for pb in rig.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()


def read_mhmat(path):
    out = {}
    if not path or not os.path.isfile(path):
        return out
    folder = os.path.dirname(path)
    for line in open(path, encoding="utf-8", errors="replace"):
        w = line.strip().split(None, 1)
        if len(w) < 2 or w[0].startswith(("#", "//")):
            continue
        key, val = w[0], w[1].strip()
        if key.endswith("Texture"):
            f = os.path.join(folder, val)
            if not os.path.isfile(f):
                f = os.path.join(folder, os.path.basename(val))
            out[key] = f if os.path.isfile(f) else None
        else:
            out[key] = val
    return out


# ---------------------------------------------------------------- image io

def load_png(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.empty(w * h * img.channels, np.float32)
    img.pixels.foreach_get(px)
    arr = px.reshape(h, w, img.channels)[::-1]  # top row first
    bpy.data.images.remove(img)
    return arr


def save_png(path, arr):
    """arr: HxWx(1|3|4) float 0..1, top row first."""
    h, w = arr.shape[:2]
    if arr.ndim == 2:
        arr = arr[:, :, None]
    c = arr.shape[2]
    if c == 1:
        arr = np.concatenate([arr, arr, arr, np.ones((h, w, 1), np.float32)], 2)
    elif c == 3:
        arr = np.concatenate([arr, np.ones((h, w, 1), np.float32)], 2)
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr[::-1], np.float32).ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def blur(a, sigma):
    if sigma <= 0:
        return a
    r = int(math.ceil(sigma * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    pad = np.pad(a, ((r, r), (0, 0)), mode="edge")
    a = sum(k[i] * pad[i:i + a.shape[0]] for i in range(2 * r + 1))
    pad = np.pad(a, ((0, 0), (r, r)), mode="edge")
    return sum(k[i] * pad[:, i:i + a.shape[1]] for i in range(2 * r + 1))


def dilate(mask, n):
    m = mask.copy()
    for _ in range(n):
        g = m.copy()
        g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
        m = g
    return m


def erode(mask, n):
    return ~dilate(~mask, n)


def remove_marks(img, boxes):
    """Paint printed logos out of a fabric texture (top row first, RGBA).

    Inside each box (left, top, right, bottom, as fractions of the texture),
    whatever isn't plain fabric (coloured, or darker than the fabric) is a
    mark; each is filled with the average of the fabric around it.
    """
    H, W = img.shape[:2]
    rgb = img[..., :3]
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    mark = np.zeros((H, W), bool)
    for x0, y0, x1, y1 in boxes:
        ys, xs = slice(int(y0 * H), int(y1 * H)), slice(int(x0 * W), int(x1 * W))
        base = float(np.median(lum[ys, xs]))
        mark[ys, xs] = (sat[ys, xs] > 0.16) | (lum[ys, xs] < base - 0.05)
    mark = dilate(mark, 3)
    # The fabric's average around each mark: unmarked pixels averaged in 8px
    # blocks, then a blur of those (weighted by how much of each block is
    # fabric), widening until every mark has fabric near it.
    k = 8
    hb, wb = H // k, W // k
    keep = (~mark).astype(np.float32)[: hb * k, : wb * k]
    n = keep.reshape(hb, k, wb, k).sum((1, 3))
    sums = [(rgb[: hb * k, : wb * k, ch] * keep).reshape(hb, k, wb, k).sum((1, 3)) for ch in range(3)]
    avg = np.zeros((hb, wb, 3), np.float32)
    done = np.zeros((hb, wb), bool)
    for sigma in (2, 4, 8, 16):
        nn = blur(n, sigma)
        ok = (nn > 0.5) & ~done
        for ch in range(3):
            avg[..., ch] = np.where(ok, blur(sums[ch], sigma) / np.maximum(nn, 1e-6), avg[..., ch])
        done |= ok
        if done.all():
            break
    big = np.repeat(np.repeat(avg, k, 0), k, 1)
    big = np.pad(big, ((0, H - big.shape[0]), (0, W - big.shape[1]), (0, 0)), mode="edge")
    out = img.copy()
    out[..., :3] = np.where(mark[..., None], big, rgb)
    return out, int(mark.sum())


class SkinCover:
    """Which skin a garment covers, so the page can leave it out under that
    garment (skin left under clothes pokes through it in a pose).

    Covered: the garment's own delete group, where it has one, plus skin with
    the garment just outside it (within 2.5 cm, on the outward side). Many CC0
    garments have no delete group. The area is shrunk by two rings of
    vertices, so wrists and necks never open up at a cuff or a collar.
    """

    def __init__(self, basemesh, H, body_mask):
        me = basemesh.data
        self.H = H
        self.body_mask = body_mask
        self.body_idx = np.nonzero(body_mask)[0]
        edges = np.empty(len(me.edges) * 2, np.int64)
        me.edges.foreach_get("vertices", edges)
        self.edges = edges.reshape(-1, 2)
        tri = []
        for poly in me.polygons:
            vs = list(poly.vertices)
            for k in range(1, len(vs) - 1):
                tri.append((vs[0], vs[k], vs[k + 1]))
        tri = np.array(tri, np.int64)
        fn = np.cross(H[tri[:, 1]] - H[tri[:, 0]], H[tri[:, 2]] - H[tri[:, 0]])
        vn = np.zeros_like(H)
        for k in range(3):
            np.add.at(vn, tri[:, k], fn)
        self.vn = vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)

    def _near(self, P, reach=0.025):
        out = np.zeros(len(self.H), bool)
        for start in range(0, len(self.body_idx), 1500):
            ids = self.body_idx[start:start + 1500]
            d = self.H[ids][:, None, :] - P[None, :, :]
            dist2 = (d * d).sum(-1)
            j = dist2.argmin(1)
            near = dist2[np.arange(len(ids)), j] < reach * reach
            outward = ((P[j] - self.H[ids]) * self.vn[ids]).sum(-1) > -0.002
            out[ids[near & outward]] = True
        return out

    def _erode(self, mask, rings):
        m = mask.copy()
        a, b = self.edges[:, 0], self.edges[:, 1]
        for _ in range(rings):
            lose = np.zeros_like(m)
            lose[a[~m[b]]] = True
            lose[b[~m[a]]] = True
            m &= ~lose
        return m

    def of(self, P, delverts=()):
        """Covered vertices (a mask over the body's original vertices) for a garment at positions P."""
        m = np.zeros(len(self.H), bool)
        if len(delverts):
            m[np.asarray(delverts)] = True
        m |= self._erode(self._near(P), 2)
        return m & self.body_mask
