# Delete your account — Lumio

_Last updated: May 2026_

This page explains how to delete your **Lumio** account and the data associated with it.

## Delete from inside the app (recommended)

If you still have the app installed and can sign in:

1. Open **Lumio**.
2. Tap the **Settings** tab.
3. Scroll to the bottom of the screen.
4. Tap **Delete account**.
5. Confirm the two warning prompts.

The app will then:

- Permanently remove every book, highlight, note, and tag stored under your account in our Firebase Firestore backend.
- Delete your Firebase Authentication record (the entry that links your Google account to the app).
- Wipe the same data from the local SQLite database on this device.
- Sign you out and return you to the login screen.

The deletion is immediate and cannot be undone. If you sign back in afterwards with the same Google account, a fresh empty account is created — none of your old highlights will return.

> **Note:** Firebase requires a recent sign-in to delete the account. If you see a "Please sign in again" message, sign out from Settings, sign back in, and tap **Delete account** again.

## If you no longer have the app installed

If you've already uninstalled the app and can't reinstall it, you can request manual deletion:

1. Reinstall the app from the [Google Play Store](https://play.google.com/store/apps/details?id=com.harry.highlightcapture).
2. Sign in with the same Google account you originally used.
3. Follow the **Delete from inside the app** steps above.

The app is free to install and signing in does not create any new billing charges — it only restores access to your existing data long enough to delete it.

## What gets deleted

- **Cloud data (Firebase Firestore):** every document under `users/{your-uid}/books`, `users/{your-uid}/highlights`, and `users/{your-uid}/tags`. Including soft-delete tombstones — nothing is retained.
- **Authentication record:** your Firebase Auth user is fully removed, so the link between your Google account and any data we hold is severed.
- **Local data on this device:** SQLite tables holding books, highlights, tags, sync cursor, and subscription state.
- **Photos:** capture photos are never stored beyond the few seconds needed to extract text, so there is nothing to clean up.

## What is kept (and for how long)

- **Billing records:** if you ever purchased a Pro subscription, Google Play retains the purchase receipt and transaction history on their side, governed by Google's own policies. We do not store payment details.
- **Backups:** Firebase Firestore does not retain user-deleted documents in any backup we have access to. Google's internal infrastructure retention is governed by their data-retention policy.
- **Server logs:** anonymous request logs from our Anthropic API calls (used for text extraction) may persist for up to 30 days for abuse detection. These contain no highlight content — only timestamps and request sizes.

## Subscriptions

Deleting your account does **not** automatically cancel your Google Play subscription. If you have an active Pro subscription you should also cancel it via:

- **Google Play app → Profile → Payments & subscriptions → Subscriptions → Lumio → Cancel subscription.**

Cancelling stops future renewals; you keep Pro access for the remainder of the current billing period.
