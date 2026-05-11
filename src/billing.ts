// Thin wrapper around react-native-iap (v12.x). We require the module lazily so
// the JS bundle keeps loading on dev builds that haven't been rebuilt with the
// native module yet. Anything that calls these helpers will fail loudly with a
// useful error in that case, instead of breaking the whole app at startup.
//
// react-native-iap's purchase flow is event-based: requestSubscription() kicks
// off the store sheet, then the result arrives through purchaseUpdatedListener.
// We promisify that by attaching one-shot listeners around the request.

import { Platform } from 'react-native';

// SKU you create in Google Play Console for the $2/month subscription.
// Keep this in sync with the product ID in the Play console.
export const MONTHLY_SUBSCRIPTION_SKU = 'kindle_pro_monthly';

type IapModule = typeof import('react-native-iap');

let cached: IapModule | null = null;
let connected = false;

function loadIap(): IapModule {
  if (cached) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-iap') as IapModule;
    return cached;
  } catch {
    throw new Error(
      'In-app purchases require a dev build with react-native-iap installed. Run `npm install react-native-iap` and rebuild.'
    );
  }
}

export async function ensureConnected(): Promise<void> {
  if (connected) return;
  const iap = loadIap();
  await iap.initConnection();
  connected = true;
}

export async function disconnect(): Promise<void> {
  if (!connected) return;
  const iap = loadIap();
  await iap.endConnection();
  connected = false;
}

export type SubscriptionOffer = {
  productId: string;
  title: string;
  priceLabel: string;
};

async function fetchSubscriptionRaw(): Promise<any | null> {
  await ensureConnected();
  const iap = loadIap();
  const list: any[] = (await iap.getSubscriptions({ skus: [MONTHLY_SUBSCRIPTION_SKU] })) as any[];
  return list.find((s) => s.productId === MONTHLY_SUBSCRIPTION_SKU) ?? null;
}

export async function getMonthlySubscription(): Promise<SubscriptionOffer | null> {
  const sub = await fetchSubscriptionRaw();
  if (!sub) return null;
  // Android: pricing lives under subscriptionOfferDetails[0].pricingPhases.pricingPhaseList[0].formattedPrice.
  // iOS: localizedPrice on the product itself.
  const androidPrice =
    sub.subscriptionOfferDetails?.[0]?.pricingPhases?.pricingPhaseList?.[0]?.formattedPrice;
  const priceLabel = androidPrice ?? sub.localizedPrice ?? '$2.00 / month';
  return {
    productId: sub.productId,
    title: sub.title ?? 'Kindle Highlights Pro',
    priceLabel,
  };
}

export async function purchaseMonthly(): Promise<boolean> {
  await ensureConnected();
  const iap = loadIap();

  // Convert the event-based flow into a promise.
  return new Promise<boolean>(async (resolve, reject) => {
    let updatedSub: { remove: () => void } | null = null;
    let errorSub: { remove: () => void } | null = null;

    const cleanup = () => {
      updatedSub?.remove();
      errorSub?.remove();
    };

    updatedSub = iap.purchaseUpdatedListener(async (purchase: any) => {
      const productIds: string[] = purchase?.productIds ?? [];
      const matches =
        purchase?.productId === MONTHLY_SUBSCRIPTION_SKU ||
        productIds.includes(MONTHLY_SUBSCRIPTION_SKU);
      if (!matches) return;
      try {
        await iap.finishTransaction({ purchase, isConsumable: false });
      } catch {
        // Non-fatal: subscription is still active, we just didn't ack it.
      }
      cleanup();
      resolve(true);
    });

    errorSub = iap.purchaseErrorListener((err: any) => {
      cleanup();
      // react-native-iap surfaces user cancel as 'E_USER_CANCELLED'.
      if (err?.code === 'E_USER_CANCELLED') {
        resolve(false);
      } else {
        reject(err instanceof Error ? err : new Error(err?.message ?? 'Purchase failed'));
      }
    });

    try {
      if (Platform.OS === 'android') {
        const sub = await fetchSubscriptionRaw();
        const offerToken: string | undefined =
          sub?.subscriptionOfferDetails?.[0]?.offerToken;
        if (!offerToken) {
          cleanup();
          reject(new Error('No subscription offer available. Check Play Console product setup.'));
          return;
        }
        await iap.requestSubscription({
          subscriptionOffers: [{ sku: MONTHLY_SUBSCRIPTION_SKU, offerToken }],
        });
      } else {
        await iap.requestSubscription({ sku: MONTHLY_SUBSCRIPTION_SKU });
      }
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
}

export async function isCurrentlySubscribed(): Promise<boolean> {
  await ensureConnected();
  const iap = loadIap();
  const purchases: any[] = await iap.getAvailablePurchases();
  return purchases.some((p) => {
    const productIds: string[] = p?.productIds ?? [];
    return p?.productId === MONTHLY_SUBSCRIPTION_SKU || productIds.includes(MONTHLY_SUBSCRIPTION_SKU);
  });
}

export async function restorePurchases(): Promise<boolean> {
  // Android: getAvailablePurchases is the restore mechanism.
  // iOS: also goes through getAvailablePurchases (StoreKit 2 path in v12.x).
  return await isCurrentlySubscribed();
}
