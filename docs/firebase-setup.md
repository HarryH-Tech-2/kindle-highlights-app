# Firebase Setup (manual, one-time)

This app's cross-device sync needs a Firebase project. Once these steps are
done, future EAS builds pick up `google-services.json` automatically.

## 1. Create the Firebase project

1. Visit https://console.firebase.google.com → **Add project** → name it
   `kindle-highlights`.
2. You can disable Google Analytics — it's not needed.

## 2. Register the Android app

1. Inside the project: **Add app** → Android.
2. Package name: `com.harry.kindlehighlights` (must match `app.json` →
   `android.package`).
3. Add **both** debug and release SHA-1 fingerprints. Get them from EAS:

   ```
   eas credentials
   ```

   Pick Android → your build profile → keystore → "View credentials". Copy the
   SHA-1 line. For the debug keystore (development client), run:

   ```
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

   Paste both into Firebase under **Project settings → Your apps → Android app
   → Add fingerprint**.

## 3. Download `google-services.json`

1. Click **Download google-services.json**.
2. Place it at the **project root** (next to `package.json`):
   `C:\Users\harry\Documents\code\kindle-screenshot-app\google-services.json`.
3. `app.json` already references it via
   `"android": { "googleServicesFile": "./google-services.json" }`.
4. **Do not commit it** — it contains keys (it's already in `.gitignore`).

## 4. Enable Authentication

1. Build → **Authentication** → **Get started**.
2. **Sign-in method** → **Google** → **Enable**. Provide a support email.
3. Under "Web SDK configuration" copy the **Web client ID**
   (looks like `…-….apps.googleusercontent.com`).
4. Open `src/auth/firebase.ts` and replace
   `REPLACE_ME_WITH_FIREBASE_WEB_CLIENT_ID.apps.googleusercontent.com`
   with that value.

## 5. Enable Firestore

1. Build → **Firestore Database** → **Create database**.
2. Start in **production mode**.
3. Pick a region close to your users (e.g. `europe-west1` or `us-central1`).
   Region cannot be changed later.

## 6. Set Firestore security rules

In Firestore → **Rules**, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{collection=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Click **Publish**. This locks every user's data to their own UID — no global
reads, no cross-user writes.

## 7. Build a new dev/release client

The Firebase + Google Sign-In native modules are not in the JS bundle alone —
you need a fresh native build:

```
eas build --profile development --platform android   # for the dev client
eas build --profile production  --platform android   # for the Play release
```

After install, open the app → **Settings → Account & Sync → Sign in with
Google**. The first run will prompt for Google account selection and then
silently sync.

## 8. Smoke-test sync end-to-end

1. Sign in.
2. On the Account screen tap **Sync now**. Expect "Pushed N • Pulled 0".
3. Open Firebase Console → Firestore → `users/{your-uid}/highlights` and
   confirm documents exist.
4. Install the same build on a second device. Sign in with the same account.
   First sync there should report "Pushed 0 • Pulled N" and your highlights
   should appear.

## 9. Things to know

- Sync is **Pro-only**. Free-tier users sign in but `Sync now` will say
  "Pro required". Cold-start auto-sync silently skips them too.
- Last-write-wins per row, by `updated_at`. There is no conflict UI — most
  recent edit on either device takes precedence.
- Soft-delete: deleting a highlight or book doesn't remove the Firestore doc;
  it sets `deleted_at` so other devices can pick up the deletion. We could
  add a periodic hard-delete sweep later if doc counts grow.
- Tags are stored as a flat `tag_names: string[]` on each highlight document
  — there is no separate tags collection. The local tags table is rebuilt on
  pull from these names.

## 10. Cost guardrails

The Firestore free tier covers 50k reads / 20k writes / 1GiB storage per day.
With sync gated to Pro subscribers and cursor-based pulls, a typical user is
on the order of tens of writes per day plus one read per device per session,
so the free tier should be ample until you have hundreds of paying users.
