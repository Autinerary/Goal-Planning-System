# Autinerary desktop

Exists for one thing the web genuinely cannot do: a **floating mascot that
stays above your other windows**, showing the task you are on, draggable
anywhere, click to jump back into the app.

A browser tab cannot draw outside itself. For an executive-function tool, a
persistent visible reminder of the current task is the feature, not decoration.

## Running it

```bash
npm install
npm start                 # against the deployed app
npm run start:local       # against http://localhost:3000
```

`AUTINERARY_URL` overrides the target.

### If it dies with `Cannot read properties of undefined (reading 'handle')`

`ELECTRON_RUN_AS_NODE=1` is set in your environment — usually inherited from a
parent Electron app such as VS Code's terminal. It makes Electron boot as
plain Node, so `require('electron')` returns the binary path instead of the
API. The npm scripts already unset it; you only hit this running
`electron .` by hand.

## How it works

The main window is a thin shell around the deployed web app rather than a
reimplementation — one codebase to fix bugs in.

The mascot's task is **real**. The main process reads the session cookies
created when you sign in inside the main window and calls `/api/me/calendar`
itself (that route authenticates by cookie), so there is no second auth flow
and the renderer never touches credentials. When there is no task it says so
rather than inventing one.

Security posture: remote content runs sandboxed with `contextIsolation` and no
Node integration; the mascot's preload exposes exactly three argument-checked
functions rather than raw IPC; external links open in the real browser instead
of a chromeless window.

## Building an installer

```bash
npm run pack        # unpacked .app, fastest way to test packaging
npm run dist:mac    # .dmg for Apple Silicon + Intel
npm run dist:win    # .exe (NSIS installer)
npm run dist:linux  # AppImage
```

Output lands in `dist/`. Icons for every platform are generated from the
single `build/icon.png`, so the three cannot drift apart.

Verified on macOS: both DMGs build, mount with the usual drag-to-Applications
layout, and the packaged app launches clean.

## Code signing — the remaining gap

Builds are currently **unsigned** (`CSC_IDENTITY_AUTO_DISCOVERY=false` in the
mac scripts, or electron-builder fails looking for a keychain identity).

An unsigned build is fine for you and for testers who are told what to expect,
but macOS Gatekeeper will refuse to open it normally — the recipient has to
right-click → Open and confirm a warning that says the app cannot be checked
for malware. Windows SmartScreen shows a comparable warning.

To remove that:

- **macOS** — Apple Developer Program ($99/yr), a Developer ID Application
  certificate, then set `CSC_LINK`/`CSC_KEY_PASSWORD` and notarise with
  `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
  `hardenedRuntime` is already on, which notarisation requires.
- **Windows** — an Authenticode code-signing certificate.

Nothing in the config needs to change to sign; only the credentials are
missing.
