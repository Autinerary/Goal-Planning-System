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

## Not done yet

No packaging. `electron-builder` produces the `.dmg`/`.exe`, and needs an icon
set and (for distribution without scary warnings) code signing — Apple
Developer for macOS, a cert for Windows.
