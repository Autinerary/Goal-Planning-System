"""What the 3D character creator offers, and where each piece comes from.

Every asset here is CC0, from the MakeHuman community's asset packs (listed in
README.md with authors). Ids are what an account saves, so keep them stable:
rename a label freely, never an id.

Folder names (`src`) are the asset's folder in MPFB's user data, which is where
MPFB unpacks the packs.
"""

# Hairstyles, in the order the grid shows them (short to long). (id, label, src)
# Most are CC0; the ones from the hair02 and hair03 packs are CC-BY (credited
# by their authors in credits.json, which the page shows).
HAIRS = [
    ("short-tousled", "Short and tousled", "short02"),
    ("short-neat", "Short and neat", "culturalibre_hair_02"),
    ("close-crop", "Close crop", "short01"),
    ("side-swept", "Side swept", "short03"),
    ("slicked-back", "Slicked back", "short04"),
    ("textured-crop", "Textured crop", "elvs_lara_hair"),
    ("wavy-quiff", "Wavy quiff", "culturalibre_hair_05"),
    ("spiky", "Spiky", "culturalibre_hair_06"),
    ("afro", "Afro", "afro01"),
    ("afro-puffs", "Afro puffs", "elvs_micky_afro"),
    ("braided-rows", "Braided rows", "elvs_braided_rows"),
    ("curly-bob", "Curly bob", "elvs_inverted_curly_bob"),
    ("big-curls", "Big curls", "elvs_wavy_bob"),
    ("curls-headband", "Curls with a headband", "sonntag78_blond_with_headband"),
    ("long-curls", "Long curls", "punkduck_alpha7_curly"),
    ("bob", "Bob", "bob02"),
    ("bob-bangs", "Bob with bangs", "toigo_blunt_bob_with_bangs"),
    ("inverted-bob", "Inverted bob", "toigo_inverted_bob"),
    ("ponytail", "Ponytail", "ponytail01"),
    ("top-bun", "Top bun", "rehmanpolanski_hair_bun_brown"),
    ("braided-bun", "Braided bun", "elvs_reverse_french_braid_bun"),
    ("side-braid", "Side braid", "braid01"),
    ("long-straight", "Long and straight", "long01"),
    ("long-layers", "Long layers", "culturalibre_hair_01"),
]

# Facial hair, coloured like the eyebrows. (id, label, src)
BEARDS = [
    ("moustache", "Moustache", "rehmanpolanski_moustache_viking"),
    ("goatee", "Goatee", "culturalibre_faun_beard"),
    ("chin-beard", "Long chin beard", "rehmanpolanski_beard_viking"),
    ("full-beard", "Full beard", "grinsegold_beard_sigmund_wip"),
    ("scruffy", "Scruffy beard", "wdg_scruffy_beard"),
]

# Eyebrow shapes. (id, label, src)
BROWS = [
    ("natural", "Natural", "eyebrow001"),
    ("soft-arch", "Soft arch", "eyebrow002"),
    ("angled", "Angled", "eyebrow007"),
    ("bushy", "Bushy", "eyebrow009"),
    ("thin-arch", "Thin arch", "eyebrow010"),
    ("sharp", "Sharp", "eyebrow011"),
    ("straight-bold", "Straight and bold", "mindfront_eyebrows_05"),
    ("full", "Full", "mindfront_eyebrows_06"),
    ("thick", "Thick", "mindfront_eyebrows_07"),
    ("arched", "Arched", "mindfront_eyebrows_09"),
    ("high-arch", "High arch", "mindfront_eyebrows_11"),
    ("soft-full", "Soft and full", "mindfront_eyebrows_12"),
]

# Outfits: each is one or more clothes pieces worn together. (id, label, [src])
# "basics" is what Attire: Basics shows (the screenshot's "Smallclothes"):
# a plain tee and shorts, so the character is never shown in underwear.
OUTFITS = [
    ("basics", "Basics", ["toigo_basic_tucked_t-shirt", "cortu_jeans_shorts"]),
    ("tee-jeans", "T-shirt and jeans", ["male_casualsuit06", "shoes06"]),
    ("denim", "Denim shirt", ["male_casualsuit01", "shoes02"]),
    ("jacket", "Jacket and jeans", ["male_casualsuit05", "culturalibre_male_boots"]),
    ("striped", "Striped shirt", ["male_casualsuit03", "shoes01"]),
    ("suit", "Suit and tie", ["male_elegantsuit01", "shoes03"]),
    ("blouse-skirt", "Blouse and skirt", ["female_elegantsuit01", "toigo_ballet_flats"]),
    ("sweater", "Cosy sweater", ["toigo_fisherman_sweater", "toigo_wool_pants", "toigo_ankle_boots_female"]),
    ("overalls", "Overalls", ["male_worksuit01", "shoes04"]),
    ("polo-cargo", "Polo and cargos", ["namuhekam_male_polo_shirt", "cortu_cargo_pants", "shoes05"]),
]

GLASSES = [
    ("rectangle", "Rectangle frames", "frankyaye_glasses_library_male"),
    ("bold-square", "Bold square", "spamrakuen_tbm_glasses_frames_01"),
    ("geometric", "Geometric", "spamrakuen_sagerfrogs_glasses_01"),
    ("thin-wire", "Thin wire", "spamrakuen_sagerfrogs_glasses_03"),
    ("clear", "Clear frames", "kwnet_at_optical_glasses"),
    ("round", "Round", "toigo_round_glasses_leopard"),
]

# Poses, from MakeHuman's own pose library (CC0, made for its default skeleton).
POSES = [
    ("standing", "Standing", "standing02"),
    ("hip", "Hand on hip", "standing04"),
    ("wave", "Wave", "standing05"),
]

# Eye colours: MakeHuman's eye textures. (id, label, file in eyes/materials)
EYES = [
    ("brown", "Brown", "brown_eye.png"),
    ("light-brown", "Light brown", "brownlight_eye.png"),
    ("green", "Green", "green_eye.png"),
    ("blue-green", "Blue-green", "bluegreen_eye.png"),
    ("blue", "Blue", "blue_eye.png"),
    ("deep-blue", "Deep blue", "deepblue_eye.png"),
    ("light-blue", "Light blue", "lightblue_eye.png"),
    ("grey", "Grey", "grey_eye.png"),
    ("ice", "Ice", "ice_eye.png"),
]

# Face sliders. Each becomes two morph targets, "<id>_down" and "<id>_up",
# from MakeHuman's targets (data/targets/<area>/<name>.target.gz in MPFB).
# (id, label, area, down targets, up targets, down words, up words)
_LR = lambda area, name: [f"{area}/l-{name}", f"{area}/r-{name}"]
FACE = [
    ("faceWidth", "Face width", "face", ["head/head-scale-horiz-decr"], ["head/head-scale-horiz-incr"], "Narrower", "Wider"),
    ("faceLength", "Face length", "face", ["head/head-scale-vert-decr"], ["head/head-scale-vert-incr"], "Shorter", "Longer"),
    ("faceShape", "Rounder or squarer", "face", ["head/head-round"], ["head/head-square"], "Rounder", "Squarer"),
    ("jaw", "Jaw", "face", ["chin/chin-bones-decr"], ["chin/chin-bones-incr"], "Softer", "Stronger"),
    ("chin", "Chin", "face", ["chin/chin-prominent-decr"], ["chin/chin-prominent-incr"], "Further back", "Further forward"),
    ("chinWidth", "Chin width", "face", ["chin/chin-width-decr"], ["chin/chin-width-incr"], "Narrower", "Wider"),
    ("cheekbones", "Cheekbones", "face", _LR("cheek", "cheek-bones-decr"), _LR("cheek", "cheek-bones-incr"), "Softer", "More defined"),
    ("cheeks", "Cheeks", "face", _LR("cheek", "cheek-volume-decr"), _LR("cheek", "cheek-volume-incr"), "Slimmer", "Fuller"),
    ("eyeSize", "Eye size", "eyes", _LR("eyes", "eye-scale-decr"), _LR("eyes", "eye-scale-incr"), "Smaller", "Bigger"),
    ("eyeSpacing", "Eye spacing", "eyes", _LR("eyes", "eye-trans-in"), _LR("eyes", "eye-trans-out"), "Closer together", "Further apart"),
    ("eyeHeight", "Eye height", "eyes", _LR("eyes", "eye-trans-down"), _LR("eyes", "eye-trans-up"), "Lower", "Higher"),
    ("eyeTilt", "Eye tilt", "eyes", _LR("eyes", "eye-corner2-down"), _LR("eyes", "eye-corner2-up"), "Down at the outside", "Up at the outside"),
    ("eyelid", "Eyelid fold", "eyes", _LR("eyes", "eye-epicanthus-out"), _LR("eyes", "eye-epicanthus-in"), "Less of a fold", "More of a fold"),
    ("browHeight", "Brow height", "eyes", ["eyebrows/eyebrows-trans-down"], ["eyebrows/eyebrows-trans-up"], "Lower", "Higher"),
    ("browAngle", "Brow angle", "eyes", ["eyebrows/eyebrows-angle-down"], ["eyebrows/eyebrows-angle-up"], "Lower at the outside", "Higher at the outside"),
    ("noseWidth", "Nose width", "nose", ["nose/nose-scale-horiz-decr"], ["nose/nose-scale-horiz-incr"], "Narrower", "Wider"),
    ("noseLength", "Nose length", "nose", ["nose/nose-scale-vert-decr"], ["nose/nose-scale-vert-incr"], "Shorter", "Longer"),
    ("noseBridge", "Nose bridge", "nose", ["nose/nose-hump-decr"], ["nose/nose-hump-incr"], "Smoother", "More of a bump"),
    ("noseTip", "Nose tip", "nose", ["nose/nose-point-down"], ["nose/nose-point-up"], "Pointing down", "Pointing up"),
    ("nostrils", "Nostrils", "nose", ["nose/nose-flaring-decr"], ["nose/nose-flaring-incr"], "Narrower", "Wider"),
    ("lips", "Lip fullness", "mouth", ["mouth/mouth-upperlip-volume-decr", "mouth/mouth-lowerlip-volume-decr"], ["mouth/mouth-upperlip-volume-incr", "mouth/mouth-lowerlip-volume-incr"], "Thinner", "Fuller"),
    ("mouthWidth", "Mouth width", "mouth", ["mouth/mouth-scale-horiz-decr"], ["mouth/mouth-scale-horiz-incr"], "Narrower", "Wider"),
    ("mouthCorners", "Mouth corners", "mouth", ["mouth/mouth-angles-down"], ["mouth/mouth-angles-up"], "Turned down", "Turned up"),
    ("earSize", "Ear size", "ears", _LR("ears", "ear-scale-decr"), _LR("ears", "ear-scale-incr"), "Smaller", "Bigger"),
    ("earPoint", "Pointed ears", "ears", None, _LR("ears", "ear-shape-pointed"), "Rounded", "Pointed"),
]

# Body sliders, from MakeHuman's "macro" settings (0..1, 0.5 is the middle).
# Each becomes "<id>_down"/"<id>_up" morph targets, plus how far each joint
# moves, so poses still bend at the right place.
# (id, label, macro, down value, up value, down words, up words)
BODY = [
    ("bodyShape", "Body shape", "gender", 0.0, 1.0, "More feminine", "More masculine"),
    ("build", "Build", "weight", 0.0, 1.0, "Slimmer", "Heavier"),
    ("muscle", "Muscle", "muscle", 0.0, 1.0, "Softer", "More toned"),
    ("age", "Age", "age", 0.3125, 0.875, "Younger (teen)", "Older"),
]

# Expressions, from the ARKit-style face units pack (data/targets/faceunits).
EXPRESSIONS = [
    ("smile", ["faceunits/mouthSmileLeft", "faceunits/mouthSmileRight"]),
    ("blink", ["faceunits/eyeBlinkLeft", "faceunits/eyeBlinkRight"]),
]

# Environment backdrops, from Poly Haven (CC0).
# (id, label, HDRI, backdrop exposure, photographer, where across the panorama
#  the part to show behind the character is (0..1), lighting strength)
ENVIRONMENTS = [
    ("studio", "Studio", "studio_small_09", 1.0, "Sergej Majboroda", 0.28, 1.0),
    ("loft", "Bright loft", "brown_photostudio_02", 1.0, "Sergej Majboroda", 0.62, 0.9),
    ("park", "Park", "rooitou_park", 1.0, "Greg Zaal", 0.35, 0.9),
    ("sunrise", "Sunrise", "spruit_sunrise", 1.0, "Greg Zaal", 0.6, 0.9),
    ("seaside", "Seaside", "venice_sunset", 1.0, "Greg Zaal", 0.5, 1.0),
    ("night", "Night", "moonlit_golf", 1.0, "Greg Zaal", 0.55, 3.2),
]

# Facial features (any number), face paints and tattoos (one each). The
# shapes are drawn in textures.py; ids must match its FEATURES, FACE_PAINT
# and TATTOOS.
FEATURES = [
    ("freckles", "Freckles"),
    ("blush", "Rosy cheeks"),
    ("beauty-mark", "Beauty mark"),
    ("mole", "Mole"),
    ("scar", "Scar"),
]
FACE_PAINTS = [
    ("stripes", "Stripes"),
    ("star", "Star"),
    ("heart", "Heart"),
    ("lightning", "Lightning bolt"),
    ("whiskers", "Whiskers"),
    ("eye-mask", "Eye mask"),
    ("dots", "Dots"),
    ("rainbow", "Rainbow"),
]
TATTOOS = [
    ("arm-band", "Arm band"),
    ("vine", "Vine"),
    ("wrist-star", "Wrist star"),
    ("sun", "Sun"),
    ("waves", "Waves"),
]

# Clothes with a printed logo (MakeHuman's own), painted out by build.py:
# {clothes folder: [where each logo is on its texture, as (left, top, right,
# bottom) fractions]}.
LOGO_FIX = {"male_casualsuit06": [(0.195, 0.115, 0.29, 0.165), (0.448, 0.122, 0.62, 0.205), (0.73, 0.15, 0.755, 0.178)]}

EYELASHES = "eyelashes02"
TEETH = "teeth_base"
TONGUE = "tongue01"
EYE_MESH = "high-poly"
RIG = "default"
# The skin the toned skin texture is made from (MakeHuman system assets).
SKIN_SOURCE = ("young_caucasian_female", "young_lightskinned_female_diffuse.png")
