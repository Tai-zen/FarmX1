/**
 * Paystack Integration Client Service for FarmX
 * Handles backend initialization, Paystack Inline popup triggering, and verification.
 */

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number; // in Kobo
        currency?: string;
        ref?: string;
        access_code?: string;
        metadata?: any;
        callback: (response: { reference: string; status?: string; trans?: string; message?: string }) => void;
        onClose: () => void;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

export interface PaystackInitResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
  amountInKobo: number;
  amountInNaira: number;
  isSandbox?: boolean;
}

export interface PaystackVerifyResponse {
  status: string;
  reference: string;
  amountInKobo: number;
  amountInNaira: number;
  currency: string;
  channel: string;
  paidAt: string;
  customer: {
    email: string;
    [key: string]: any;
  };
  metadata?: any;
  gatewayResponse?: string;
}

/**
 * Retrieves the client-safe Paystack Public Key from the backend
 */
export async function getPaystackConfig(): Promise<{
  publicKey: string;
  isLiveConfigured: boolean;
  hasCustomKey: boolean;
}> {
  try {
    const res = await fetch('/api/paystack/public-key');
    if (!res.ok) throw new Error('Failed to retrieve Paystack configuration');
    const data = await res.json();
    return {
      publicKey: data.publicKey || '',
      isLiveConfigured: Boolean(data.isLiveConfigured),
      hasCustomKey: Boolean(data.hasCustomKey),
    };
  } catch (err) {
    console.warn('[PaystackService] Could not load public key from server, using fallback', err);
    return {
      publicKey: (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY || '',
      isLiveConfigured: false,
      hasCustomKey: false,
    };
  }
}

/**
 * Step A: Initialize Paystack transaction via backend API
 * Converts Amount to Kobo on the server-side to satisfy currency unit rules
 */
export async function initializePaystackTransaction(params: {
  email: string;
  amount: number; // In Naira
  reference?: string;
  metadata?: Record<string, any>;
  callback_url?: string;
}): Promise<PaystackInitResponse> {
  const res = await fetch('/api/paystack/initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const body = await res.json();
  if (!res.ok || !body.status) {
    throw new Error(body.message || 'Failed to initialize Paystack checkout transaction');
  }

  return body.data;
}

/**
 * Step C: Verify Paystack transaction via backend API
 */
export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyResponse> {
  const res = await fetch(`/api/paystack/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const body = await res.json();
  if (!res.ok || !body.status) {
    throw new Error(body.message || 'Failed to verify transaction with Paystack');
  }

  return body.data;
}

/**
 * Dynamically loads Paystack Inline JS if not yet loaded in DOM
 */
export function ensurePaystackScriptLoaded(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.PaystackPop) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="paystack.co"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('[PaystackService] Failed to load Paystack Inline JS');
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

/**
 * Step B: Triggers Paystack Inline Modal
 */
export async function openPaystackInlineCheckout({
  publicKey,
  email,
  amountInNaira,
  reference,
  accessCode,
  metadata,
  onSuccess,
  onCancel,
}: {
  publicKey: string;
  email: string;
  amountInNaira: number;
  reference: string;
  accessCode?: string;
  metadata?: any;
  onSuccess: (response: { reference: string }) => void;
  onCancel?: () => void;
}): Promise<void> {
  await ensurePaystackScriptLoaded();

  // If PaystackPop is available and we have a valid key, launch standard Paystack Inline Popup
  if (typeof window !== 'undefined' && window.PaystackPop && publicKey && !publicKey.includes('placeholder')) {
    const amountInKobo = Math.round(amountInNaira * 100);

    const handler = window.PaystackPop.setup({
      key: publicKey,
      email,
      amount: amountInKobo, // Must be in kobo
      currency: 'NGN',
      ref: reference,
      access_code: accessCode,
      metadata: metadata || {},
      callback: (response) => {
        console.log('[Paystack Inline] Transaction approved:', response);
        onSuccess(response);
      },
      onClose: () => {
        console.log('[Paystack Inline] User closed the Paystack payment window');
        if (onCancel) onCancel();
      },
    });

    handler.openIframe();
  } else {
    // If running in development without live public key or when iFrame blocks third-party popups,
    // trigger our embedded sandbox modal
    throw new Error('PAYSTACK_INLINE_SANDBOX_FALLBACK');
  }
}
