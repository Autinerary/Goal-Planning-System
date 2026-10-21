"""The creator's Environment backdrops, from Poly Haven HDRIs (CC0).

    blender -b --python scripts/avatar3d/environments.py -- <hdri dir> <out dir>

For each 2k HDRI, writes <id>.hdr (512x256, lights the character) and <id>.jpg
(2048x1024, tone-mapped, the backdrop you see). One big HDR would be both, but
these two together are a fifth of its size and the backdrop is sharper.
"""
import bpy, os, sys, json
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catalog as C  # noqa: E402

src, out = sys.argv[sys.argv.index("--") + 1:][:2]
os.makedirs(out, exist_ok=True)


def to_image(name, arr, float_buffer):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False, float_buffer=float_buffer)
    rgba = np.concatenate([arr, np.ones((h, w, 1), np.float32)], axis=2)
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    return img


def aces(x):
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    return np.clip((x * (a * x + b)) / (x * (c * x + d) + e), 0, 1)


def srgb(x):
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)


report = {}
for env in C.ENVIRONMENTS:
    eid, src_name, exposure = env[0], env[2], env[3]
    img = bpy.data.images.load(os.path.join(src, src_name + ".hdr"))
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    hdr = px.reshape(h, w, 4)[:, :, :3]

    small = bpy.data.images.new(eid + "_small", w, h, alpha=False, float_buffer=True)
    small.pixels.foreach_set(px)
    small.scale(512, 256)
    small.filepath_raw = os.path.join(out, eid + ".hdr")
    small.file_format = "HDR"
    small.save()

    ldr = srgb(aces(hdr * exposure))
    big = to_image(eid + "_jpg", ldr, False)
    big.scale(2048, 1024)
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 84
    scene.view_settings.view_transform = "Standard"
    big.save_render(os.path.join(out, eid + ".jpg"), scene=scene)

    lum = (0.2126 * hdr[..., 0] + 0.7152 * hdr[..., 1] + 0.0722 * hdr[..., 2])
    report[eid] = {"mean": round(float(lum.mean()), 3), "median": round(float(np.median(lum)), 3),
                   "hdrKB": os.path.getsize(os.path.join(out, eid + ".hdr")) // 1024,
                   "jpgKB": os.path.getsize(os.path.join(out, eid + ".jpg")) // 1024}
    print("ENV", eid, report[eid], flush=True)
