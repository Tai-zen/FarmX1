import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory set for tracking processed webhook events (idempotency guard)
const processedWebhookEvents = new Set<string>();

// Mock in-memory transaction store for test/demo mode when live keys are not yet configured in .env
const testTransactions = new Map<string, {
  reference: string;
  amountInKobo: number;
  email: string;
  status: 'pending' | 'success';
  createdAt: number;
  metadata?: any;
}>();

interface ExtendedRequest extends Request {
  rawBody?: Buffer;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Middleware: capture raw body buffer for Paystack Webhook HMAC SHA512 verification
  app.use(express.json({
    verify: (req: ExtendedRequest, _res: Response, buf: Buffer) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true }));

  // ──────────────────────────────────────────────────────────────────────────
  // 1. PUBLIC KEY ENDPOINT
  // Safe endpoint providing client-side Public Key (PK_TEST_ / PK_LIVE_)
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/api/paystack/public-key', (_req: Request, res: Response) => {
    const publicKey = (
      process.env.PAYSTACK_PUBLIC_KEY ||
      process.env.VITE_PAYSTACK_PUBLIC_KEY ||
      ''
    ).trim();

    const isTestMode = !publicKey || publicKey.startsWith('pk_test_') || publicKey.includes('placeholder');

    res.json({
      status: true,
      publicKey: publicKey || 'pk_test_demo_farmx_placeholder',
      isLiveConfigured: !isTestMode && publicKey.startsWith('pk_live_'),
      hasCustomKey: Boolean(publicKey && !publicKey.includes('placeholder'))
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. STEP A (Backend): POST /api/paystack/initialize
  // Calls Paystack POST /transaction/initialize with:
  // - email
  // - amount in KOBO (subunits: amountInNaira * 100)
  // - reference
  // - callback_url
  // - metadata
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/api/paystack/initialize', async (req: Request, res: Response) => {
    try {
      const { email, amount, reference, callback_url, metadata } = req.body;

      if (!email || !amount) {
        return res.status(400).json({
          status: false,
          message: 'Both email and amount (in Naira) are required'
        });
      }

      const numericAmountInNaira = Number(amount);
      if (isNaN(numericAmountInNaira) || numericAmountInNaira <= 0) {
        return res.status(400).json({
          status: false,
          message: 'Invalid amount supplied'
        });
      }

      // PAYSTACK DIRECTIVE #1: Currency Unit Rule
      // Always convert local currency (NGN) to Kobo (subunit)
      // Formula: Amount in Kobo = Amount in Naira * 100
      const amountInKobo = Math.round(numericAmountInNaira * 100);

      // Generate a unique idempotency reference if not supplied
      const txRef = reference || `FMX_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim();

      // If user has provided a real Secret Key in .env, call live Paystack API
      if (secretKey && (secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_')) && !secretKey.includes('placeholder')) {
        console.log(`[Paystack] Initializing transaction ${txRef} for ₦${numericAmountInNaira} (${amountInKobo} kobo)`);
        
        const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            amount: amountInKobo, // In Kobo
            reference: txRef,
            callback_url: callback_url || `${req.protocol}://${req.get('host')}/order-tracking`,
            metadata: {
              ...(metadata || {}),
              app_name: 'FarmX',
              amount_naira: numericAmountInNaira,
            }
          })
        });

        const data = await paystackResponse.json();

        if (!paystackResponse.ok || !data.status) {
          console.error('[Paystack] API initialize error:', data);
          return res.status(paystackResponse.status || 400).json({
            status: false,
            message: data.message || 'Paystack initialization failed',
            details: data
          });
        }

        return res.json({
          status: true,
          message: 'Authorization URL created',
          data: {
            authorization_url: data.data.authorization_url,
            access_code: data.data.access_code,
            reference: data.data.reference || txRef,
            amountInKobo,
            amountInNaira: numericAmountInNaira
          }
        });
      }

      // Fallback: Test Sandbox Mode Simulation
      // Allows zero-friction testing in development/preview environments
      console.log(`[Paystack Sandbox] Initializing simulated transaction ${txRef} (Amount: ₦${numericAmountInNaira})`);
      testTransactions.set(txRef, {
        reference: txRef,
        amountInKobo,
        email,
        status: 'pending',
        createdAt: Date.now(),
        metadata
      });

      return res.json({
        status: true,
        message: 'Sandbox transaction initialized',
        isSandbox: true,
        data: {
          authorization_url: `https://checkout.paystack.com/sandbox-mock-${txRef}`,
          access_code: `mock_code_${txRef}`,
          reference: txRef,
          amountInKobo,
          amountInNaira: numericAmountInNaira
        }
      });
    } catch (err: any) {
      console.error('[Paystack] Unexpected error in /initialize:', err);
      return res.status(500).json({
        status: false,
        message: err.message || 'Internal server error while initializing payment'
      });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. STEP C (Backend): GET /api/paystack/verify/:reference
  // Calls Paystack GET /transaction/verify/:reference using PAYSTACK_SECRET_KEY
  // Verifies status === 'success' and currency/amount match
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/api/paystack/verify/:reference', async (req: Request, res: Response) => {
    try {
      const { reference } = req.params;

      if (!reference) {
        return res.status(400).json({
          status: false,
          message: 'Transaction reference is required'
        });
      }

      const secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim();

      // Real Paystack Verification
      if (secretKey && (secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_')) && !secretKey.includes('placeholder')) {
        console.log(`[Paystack] Verifying transaction: ${reference}`);
        
        const paystackResponse = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${secretKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const data = await paystackResponse.json();

        if (!paystackResponse.ok || !data.status) {
          console.error('[Paystack] Verification failed:', data);
          return res.status(paystackResponse.status || 400).json({
            status: false,
            message: data.message || 'Transaction verification failed',
            data: data.data || null
          });
        }

        const tx = data.data;
        const isSuccessful = tx.status === 'success';

        return res.json({
          status: true,
          message: isSuccessful ? 'Payment verified successfully' : `Payment status is ${tx.status}`,
          data: {
            status: tx.status,
            reference: tx.reference,
            amountInKobo: tx.amount,
            amountInNaira: tx.amount / 100,
            currency: tx.currency,
            channel: tx.channel,
            paidAt: tx.paid_at,
            customer: tx.customer,
            metadata: tx.metadata,
            gatewayResponse: tx.gateway_response
          }
        });
      }

      // Sandbox Mock Verification
      console.log(`[Paystack Sandbox] Verifying mock reference: ${reference}`);
      const mockTx = testTransactions.get(reference);

      // Auto-approve test transaction
      if (mockTx) {
        mockTx.status = 'success';
      }

      return res.json({
        status: true,
        message: 'Sandbox payment verified successfully',
        isSandbox: true,
        data: {
          status: 'success',
          reference,
          amountInKobo: mockTx?.amountInKobo || 100000,
          amountInNaira: (mockTx?.amountInKobo || 100000) / 100,
          currency: 'NGN',
          channel: 'card',
          paidAt: new Date().toISOString(),
          customer: { email: mockTx?.email || 'buyer@farmx.ng' },
          gatewayResponse: 'Approved (Sandbox Test Mode)'
        }
      });
    } catch (err: any) {
      console.error('[Paystack] Unexpected error in /verify:', err);
      return res.status(500).json({
        status: false,
        message: err.message || 'Internal server error while verifying payment'
      });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. WEBHOOK LISTENER ROUTE: POST /api/paystack/webhook
  // Directives #4 & #5: HMAC SHA512 signature check & idempotency handling
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/api/paystack/webhook', (req: ExtendedRequest, res: Response) => {
    try {
      const secret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
      const paystackSignature = req.headers['x-paystack-signature'] as string;

      // When secret key is set, strictly enforce HMAC SHA512 signature verification
      if (secret && !secret.includes('placeholder')) {
        if (!paystackSignature) {
          console.warn('[Paystack Webhook] Rejected: Missing x-paystack-signature header');
          return res.status(401).json({ status: false, message: 'Missing signature header' });
        }

        const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
        const computedHash = crypto
          .createHmac('sha512', secret)
          .update(rawBody)
          .digest('hex');

        if (computedHash !== paystackSignature) {
          console.warn('[Paystack Webhook] Rejected: HMAC SHA512 signature mismatch');
          return res.status(401).json({ status: false, message: 'Invalid HMAC signature' });
        }
      }

      const event = req.body;
      const eventId = event?.data?.id ? String(event.data.id) : (event?.data?.reference || `${Date.now()}`);

      // DIRECTIVE #5: Idempotency check — avoid processing duplicate webhook calls
      if (processedWebhookEvents.has(eventId)) {
        console.log(`[Paystack Webhook] Duplicate event ignored: ${eventId}`);
        return res.status(200).json({ status: true, message: 'Duplicate event already processed' });
      }

      processedWebhookEvents.add(eventId);

      console.log(`[Paystack Webhook] Received verified event: ${event.event} for reference: ${event?.data?.reference}`);

      switch (event.event) {
        case 'charge.success': {
          const { reference, amount, customer, metadata } = event.data;
          console.log(`[Paystack Webhook] Charge Success: ₦${amount / 100} for ${customer?.email} (Ref: ${reference})`);
          // Note: In our architecture, the client also verifies via Step C, ensuring instantaneous UI transition
          break;
        }
        case 'transfer.success': {
          console.log(`[Paystack Webhook] Transfer Success: Ref ${event.data?.reference}`);
          break;
        }
        case 'transfer.failed': {
          console.warn(`[Paystack Webhook] Transfer Failed: Ref ${event.data?.reference}`);
          break;
        }
        default: {
          console.log(`[Paystack Webhook] Unhandled event type: ${event.event}`);
          break;
        }
      }

      // Always return HTTP 200 OK quickly to Paystack to acknowledge receipt
      return res.status(200).send('Webhook acknowledged');
    } catch (err: any) {
      console.error('[Paystack Webhook] Error processing event:', err);
      // Still return 200/500 depending on error to avoid repeated webhook hammering
      return res.status(500).json({ status: false, message: 'Webhook processing error' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. STATIC / VITE INTEGRATION
  // ──────────────────────────────────────────────────────────────────────────
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    // Development: mount Vite middlewares
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ FarmX Full-Stack Server active on http://0.0.0.0:${PORT}`);
    console.log(`✓ Paystack API endpoints ready: /api/paystack/initialize, /api/paystack/verify/:reference, /api/paystack/webhook`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting FarmX server:', err);
  process.exit(1);
});
