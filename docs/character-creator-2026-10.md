# The 3D character creator (October 2026)

A character creator like a video game's (the reference was Final Fantasy XIV's):
a 3D character you can turn, in a scene, with a list of parts on the left,
pictures to choose from, and Pose, Attire and Environment on the right.

It's at **`/character`**, linked from Dream Self ("New: try the 3D character
creator"). It's on its own page while the team tries it: **the 2D character is
unchanged**, on Dream Self and on the race track. Built 21 October 2026.

**There's no database change.** A saved character is kept in the account's
preferences (`preferences.character3d`), like the 2D one.

## What needs someone on the team

| What | Why |
| --- | --- |
| Try it, and say what's missing | It's new. Everything below works and is tested, but only people using it will find what feels wrong |
| Hijab, turban, locs and hats | The 2D character has a hijab, a turban and locs, because people arrive from different places. The free (CC0 and CC-BY) 3D asset packs have none of them. They'd need modelling, or paid assets |
| Whether the 3D character replaces the 2D one anywhere | Nothing uses it yet. The race track and Dream Self show small pictures, and a 3D view is heavy for those. The next step would be still pictures of the 3D character, made when it's saved |
| Where the models live | They're 34 MB in the repository (`frontend/public/avatar3d`). Every rebuild of them adds to the repository's history, so if they'll change often, a storage bucket would be better |

## What you can change

Each part is in the list on the left, like the game's:

| Part | Choices |
| --- | --- |
| Body | Body shape (more feminine to more masculine), build, muscle, age (teen to older), height |
| Skin tone | 14 tones, lightest to deepest, or any colour |
| Face shape | 25 sliders: face, eyes and brows, nose, mouth, ears (pointed ears too) |
| Eye colour | 9 |
| Hairstyle | 24, and no hair: short, textured and curly (afro, afro puffs, braided rows, curly bob, big curls, long curls), bobs, ponytail, buns, braids, long |
| Hair colour | 18, or any colour |
| Eyebrows | 12 shapes, or none, in their own colour (or matching the hair) |
| Facial hair | Moustache, goatee, long chin beard, full beard, scruffy beard |
| Lip colour | Natural, 11 colours, or any colour |
| Facial features | Freckles, rosy cheeks, beauty mark, mole, scar (any number) |
| Face paint | 8 designs, in 12 colours or any colour |
| Tattoos | 5 designs on the left arm, in 6 ink colours |
| Glasses | 6 |
| Outfit | 9 outfits |

And on the right:

- **Pose:** Standing, Hand on hip, Wave.
- **Attire:** Outfit, or **Basics**. This is the game's "Smallclothes", but here it's a plain tee and shorts, never underwear, because the app has teenagers and children.
- **Environment:** Studio, Bright loft, Park, Sunrise, Seaside, Night.
- **Smile.**
- **View:** whole body, upper body or face.
- **Turn and zoom:** the turn and zoom buttons, or drag to turn and scroll or pinch to zoom.

Choosing a part moves the camera to it (the face for face paint, for
example). **Save character** keeps it on the account, and **Undo changes**
goes back to the saved one. A first visit starts from the person's 2D
character: its skin, hair colour, hairstyle and glasses.

## How it's made

The models are made once, on a Mac, by scripts in `scripts/avatar3d`
(`scripts/avatar3d/README.md` says how to run them and how to add a
hairstyle or outfit):

- **The character:** MakeHuman's (MPFB in Blender). The body, face, eyes, most hair, clothes, glasses and poses are CC0 assets from the MakeHuman community.
- **The six CC-BY hairstyles:** credited by author. The page lists every asset, its author and its licence under "Credits and licences".
- **The backdrops:** Poly Haven (CC0).
- **In the browser:** three.js draws it, loaded only on this page.

What makes it work well:

- **Hair and clothes fit.** Each slider changes the body, and also every hairstyle, outfit and pair of glasses, made with MakeHuman's own fitting. So hair and clothes follow a wider face or a heavier build.
- **Poses bend in the right places.** Body sliders move the joints too, so a broader shoulder still bends at the shoulder.
- **No skin through clothes.** Under each outfit, the body's skin is left out where the outfit covers it, so it can't poke through in a pose.
- **Any skin tone.** The skin is MakeHuman's with its own colour taken out, so any tone keeps the skin's detail. Lip colour, freckles, face paint and tattoos are painted onto it.
- **The logo is gone.** MakeHuman's white T-shirt had their logo on it, and the build paints it out.

**How much it downloads.** The first visit fetches about 4 MB: the body
(1.3 MB), the hairstyle, the outfit, the skin and a backdrop. three.js adds
about 600 KB. Each other choice loads when picked: a hairstyle is 0.2 to
1 MB, an outfit 0.3 to 1.2 MB. Other pages are unchanged; three.js isn't in
their code.

## Accessibility

- **Choices:** every choice is a button with its name on it, which says whether it's chosen. Colours have names ("Hair colour: Auburn").
- **The list of parts:** tabs. Arrow keys move through them; Home and End jump to the first and last.
- **Sliders:** they work with the keyboard and say their value in words ("A little wider", "Quite a bit more feminine"). Double-click puts one back in the middle.
- **Screen readers:** the character is described in words ("Your character: skin tone 6, green eyes, afro hair in auburn…"), and changes are read out once they settle.
- **Calm motion:** with calm motion (the app's setting, or the device's), the character doesn't breathe or blink, and the camera doesn't glide.
- **Without WebGL 2:** a browser that can't draw it says so, and offers the 2D character.
- **Phones:** the character, then the parts in a row, then the choices. There's no sideways scroll at 320 px.
- **Checks:** axe finds no serious or critical problems at 1280, 375 and 320 px. The accessibility checker now includes `/character`.

## How it was tested

- **`lib/avatar3d/character.test.mjs`:** checking a saved character (unknown or unsafe parts fall back), and the description in words.
- **`.qa-local/browser/creator.mjs`:** QA A, 38 checks. It puts QA A's preferences back afterwards. It covers:
  - every part, and that each choice loads its model or texture;
  - the keyboard;
  - saving, checked in the database, then reloading and undoing;
  - axe, and phone widths;
  - the fallback without WebGL;
  - the link on Dream Self.

  **38/38 on the local build, and on production (app.autinerary.ca) after the deploy on 21 October.**
- **The earlier suites that touch Dream Self or the page guides:** g15 76/76, g34 57/57, plan16 31/31, g20 80/80, plan12 39/39.
- **The library tests:** 37/37.
- **The accessibility checker, signed in:** no serious or critical problems on any page.
- **By eye:** many characters (body shapes, ages, every backdrop, face paint and tattoos, Basics), and every option's picture.
