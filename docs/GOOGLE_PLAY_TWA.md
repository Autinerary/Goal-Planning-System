# Shipping Autinerary to Google Play

Google Play accepts a web app wrapped as a **Trusted Web Activity** (TWA).
Apple does not accept the equivalent, which is why the App Store route needs a
native rewrite and this one does not.

## Already done

- The PWA is installable and passes every criterion Play checks: manifest with
  `name`, `short_name`, `start_url`, `display: standalone`, 192px and 512px
  icons including a maskable one, theme and background colours, and a service
  worker with a fetch handler.
- `/.well-known/assetlinks.json` is served by
  `frontend/app/.well-known/assetlinks.json/route.ts`. It returns 404 until
  configured, deliberately — a placeholder fingerprint fails verification
  silently and is far harder to debug than a missing file.

## What blocks it right now

**The PWA has to be live first.** Bubblewrap reads the manifest from a real
HTTPS URL to generate the project; it cannot work against localhost. So the
order is: deploy, then wrap.

Secondary: this machine has no JDK and no Android SDK. Bubblewrap offers to
install both on first run (~1GB), or the build can run in CI.

## Sequence

1. **Deploy the PWA.** Confirm `https://<your-domain>/manifest.json` and
   `/sw.js` both return 200.

2. **Generate the project.**

       npx @bubblewrap/cli init --manifest https://<your-domain>/manifest.json

   Accept the JDK/SDK download when prompted. Use `com.autinerary.twa` as the
   package name, or change `TWA_PACKAGE_NAME` to match whatever you pick.

3. **Build.**

       npx @bubblewrap/cli build

   Produces `app-release-bundle.aab` for Play plus a local APK for testing.

4. **Create the Play listing** ($25 one-time) and upload the `.aab`. Enrol in
   Play App Signing when offered — it is the default and makes key loss
   recoverable.

5. **Wire Digital Asset Links.** Play gives you a SHA-256 fingerprint under
   **Setup → App integrity**. Set on Vercel:

       TWA_SHA256_FINGERPRINTS=AB:CD:EF:...   # 32 colon-separated hex pairs
       TWA_PACKAGE_NAME=com.autinerary.twa

   Redeploy, then confirm `https://<your-domain>/.well-known/assetlinks.json`
   returns JSON rather than a 404.

   **Skipping this is the classic TWA mistake.** The app still installs and
   runs, but with a browser address bar across the top, which defeats the
   entire point. During key rotation the variable accepts a comma-separated
   list so the upload key and Play's signing key can both be present.

## Play requirements that are not code

Both apply regardless of how the app is built:

- **In-app account deletion.** Mandatory since 2023 for any app with accounts,
  including a web-accessible route. This conflicts with the standing
  "we are not deleting any data" rule — anonymising the account instead of
  erasing it is the usual resolution, and is a product decision.
- **Privacy policy**, plus a Data Safety form declaring what is collected.
  Onboarding collects diagnostic information and Norms, so expect closer
  review than a typical app.
