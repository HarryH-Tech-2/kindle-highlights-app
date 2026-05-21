# Privacy Policy — Highlight Capture for Books

_Last updated: May 2026_

Highlight Capture for Books ("the app") is built to be lightweight and private. Your highlights live on your device for offline access and, while you are signed in, also sync to your private Firebase account so they follow you across devices. This document explains exactly what data the app handles and how.

## Where your highlights live

Your books, highlights, notes, and tags are kept in a local SQLite database on your device for fast, offline access. When you are signed in, the same data is also uploaded to our Firebase Firestore backend so it syncs to your other devices. You can export everything as Markdown at any time from Settings, or remove the synced copy by signing out (which also clears local data on this device).

## Camera & photos

The camera is used only when you tap the capture button. The photo you take is held in temporary storage just long enough to extract the highlighted text, then deleted automatically — it is never written to your photo library and never persisted by us. Photo-library access is requested only if you choose to save a beautified quote card.

## Text extraction (Anthropic Claude)

When you capture a highlight, the photo is sent to Anthropic's Claude API over HTTPS for one-shot text extraction. Anthropic processes the request to return the extracted text and, per their API policy, does not use API inputs to train their models by default. See [anthropic.com/legal](https://www.anthropic.com/legal) for their privacy policy.

## Cloud sync (Firebase Firestore)

When you are signed in with Google, your books, highlights, notes, and tags are continuously synced to a private Firestore collection scoped to your Google account ID (`users/{your-uid}/...`). Firestore security rules enforce that only your signed-in account can read or write that data. Sync happens automatically after every change and only while signed in — sign out and the device stops syncing and clears its local copy.

## Sign-in data

Google Sign-In shares your Google account ID, email address, display name, and profile photo URL with the app. We use these only to identify you across devices, to scope your synced data to your account, and to display your profile in Settings. We do not contact you outside of essential account or billing notifications.

## Billing

Subscriptions are processed by Google Play Billing. We never see or store your payment details — Google handles them. We only receive the receipt token that proves your subscription status.

## No analytics or tracking

We do not use third-party analytics, advertising SDKs, behavioral tracking, fingerprinting, or any cross-app identifiers. The only network calls this app makes are:

1. Extraction requests to the Anthropic API.
2. Authentication via Google Sign-In.
3. Sync to Firestore when signed in.
4. Subscription verification via Google Play.

## Security

All network requests use HTTPS. Auth credentials are managed by Google Sign-In and Firebase Auth — we never see your password. Local data is stored in your app's private storage which other apps cannot read on a non-rooted device.

## Your data & deletion

You can export everything as Markdown from Settings → Export. Signing out from Settings stops sync on this device and wipes its local copy. Uninstalling the app removes all local data on the device.

## Children

This app is not directed at children under 13 and we do not knowingly collect data from them.

## Changes to this policy

If we change this policy in a material way, you'll see an in-app notice the next time you open the app. Continued use after that notice constitutes acceptance of the new policy.
