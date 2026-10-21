# The 3D character's models (scripts/avatar3d)

These scripts make everything in `frontend/public/avatar3d/`, which the
character creator (`/character`, `frontend/app/character`) loads. They run on
a Mac with Blender; nothing here runs in the app's build.

## What it makes

| File | What it is |
| --- | --- |
| `body.glb` | The body, eyes, eyelashes, teeth, tongue, the skeleton (MakeHuman's "default" rig) and the three poses |
| `hair/`, `brows/`, `beard/`, `outfit/`, `glasses/<id>.glb` | One choice each, on the same skeleton; the page binds it to the body's |
| `meta.json` | How far each joint moves for each body slider, and which bit of the body's `_HIDE` attribute is each outfit's |
| `skin/detail.webp` | MakeHuman's skin with its colour divided out: the page multiplies in the skin tone |
| `skin/<mask>.webp`, `skin/masks.json` | Lips, facial features, face paints and tattoos, as masks the page tints and layers |
| `eyes/<id>.webp` | The nine eye colours |
| `backdrops/<id>.hdr`, `backdrops/<id>.jpg` | The backdrops: a small HDR lights the character, the JPEG is what you see (not `env/`, which the repository's `.gitignore` leaves out) |
| `thumbs/`, `icons/` | The pictures in the creator's grids |
| `credits.json` | Who made each asset, and its licence (the page shows it) |

How the page uses them is in `frontend/lib/avatar3d/scene.ts`. In short:

- Every slider is two morph targets, `<id>_down` and `<id>_up`, on the body and on every piece it moves. A piece's morphs are made with MPFB's own fitting formula (each of its vertices follows three body vertices), so hair and clothes follow the face and body as MPFB would refit them.
- Body sliders also move the joints (`meta.json` "joints"), so a pose still bends a broader shoulder at the shoulder.
- `_HIDE` says which outfits cover each body vertex. The page leaves out the triangles under the outfit being worn, so skin never pokes through clothes in a pose. Covered means the garment's own delete group, plus skin with the garment within 2.5 cm outside it, shrunk by two rings of vertices (`SkinCover` in `common.py`).

## Setting it up (once)

1. **Blender 5.2 LTS:** `brew install --cask blender@lts`.
2. **MPFB 2.0.18** (MakeHuman for Blender), from extensions.blender.org. Check its SHA-256, then:
   `/Applications/Blender.app/Contents/MacOS/Blender --command extension install-file -r user_default -e add-on-mpfb-v2.0.18.zip`
3. **The asset packs**, from static.makehumancommunity.org/assets/assetpacks.html. Unzip each into MPFB's user data folder, `~/Library/Application Support/Blender/5.2/extensions/.user/user_default/mpfb/data`:
   - CC0: makehuman_system_assets, makehuman_system_poses, hair01, eyebrows01, eyelashes01, shirts01, pants01, shoes01, glasses01, faceunits01, bodyparts05
   - CC-BY: hair02 and hair03 (six hairstyles come from them, credited by author)
   Check a pack's zip has no `..` or absolute paths, and no code, before unzipping.
4. **The backdrops:** the six 2k HDRIs named in `catalog.py` (ENVIRONMENTS), from polyhaven.com (CC0), into `~/autinerary-3d/downloads/polyhaven/<name>.hdr`.
5. **The Node tools:** `cd scripts/avatar3d && npm install`.

## Running it

```
scripts/avatar3d/run_all.sh
```

About three minutes. It runs, in order:

1. `gen_catalog.py`: writes the catalogue block into `frontend/lib/avatar3d/character.ts`.
2. `build.py`: the models and `meta.json`.
3. `textures.py`: the skin, masks, eyes and icons.
4. `thumbs.py`: the grid pictures.
5. `environments.py`: the backdrops.
6. `optimize.mjs`: compresses everything into `frontend/public/avatar3d` (meshopt, WebP).

Each Blender step can be run alone, for example
`blender -b --python scripts/avatar3d/build.py -- --out ~/autinerary-3d/build`.
`--quick` builds a few of each, to try a change. Builds go to
`~/autinerary-3d/build`, outside the repo.

## Adding a hairstyle, outfit, beard or pair of glasses

1. Find the asset in an installed pack and check its licence in the pack's `packs/<pack>.json`. CC0 and CC-BY only; `build.py` stops on anything else.
2. Add a line to `catalog.py`. The id is what accounts save, so never change an id once it's live; labels can change.
3. Run `run_all.sh`, look at the thumbnail and at the creator, and commit `frontend/public/avatar3d`.

A shirt with a printed logo can be painted clean: add its texture boxes to
`LOGO_FIX` in `catalog.py` (MakeHuman's white tee had their logo).

## Licences

- **The models' assets:** the MakeHuman community asset packs. All CC0 except six hairstyles, which are CC-BY 4.0: five from hair02 (Elvaerwyn) and one from hair03 (punkduck). `credits.json` lists every asset, author and licence, and the creator shows it under "Credits and licences". One shoe in shoes01 is CC-BY and isn't used.
- **The backdrops:** Poly Haven, CC0 (Sergej Majboroda, Greg Zaal).
- **MPFB** is GPL. It makes the models here, but none of its code is in the app or in these files.
- **three.js**, which draws the character in the page, is MIT.
