import { MONETIZATION_ENABLED } from '../config/features.js';

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export function loadRazorpayCheckout({
  monetizationEnabled = MONETIZATION_ENABLED,
  documentRef = globalThis.document,
  windowRef = globalThis.window,
} = {}) {
  if (!monetizationEnabled) return Promise.resolve(false);
  if (windowRef?.Razorpay) return Promise.resolve(true);
  if (!documentRef) return Promise.reject(new Error('Checkout requires a browser document'));

  const existingScript = documentRef.querySelector(`script[src="${CHECKOUT_SRC}"]`);
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve(true), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Checkout failed to load')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = documentRef.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Checkout failed to load'));
    documentRef.head.appendChild(script);
  });
}
