import crypto from 'crypto';
import { env } from '../config/env';

export interface RazorpayOrder {
  id: string;
  amount: number; // in smallest currency unit (e.g. paise / cents)
  currency: string;
  keyId: string;
  isMock: boolean;
  notes?: Record<string, string>;
}

export class RazorpayService {
  /**
   * Determine if we are running in mock mode or live test/prod mode
   */
  static isMockMode(): boolean {
    return (
      !env.RAZORPAY_KEY_ID ||
      env.RAZORPAY_KEY_ID.includes('mock') ||
      !env.RAZORPAY_KEY_SECRET ||
      env.RAZORPAY_KEY_SECRET.includes('mock')
    );
  }

  /**
   * Create an order for a plan upgrade
   * Standard Pro Plan price: ₹3,999 (~$49) / month = 399900 paise
   */
  static async createOrder(
    workspaceId: string,
    amountInPaise: number = 399900,
    currency: string = 'INR'
  ): Promise<RazorpayOrder> {
    const isMock = this.isMockMode();

    if (isMock) {
      // Return simulated mock order
      const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return {
        id: mockOrderId,
        amount: amountInPaise,
        currency,
        keyId: env.RAZORPAY_KEY_ID,
        isMock: true,
        notes: {
          workspaceId,
          plan: 'pro',
        },
      };
    }

    // Call live Razorpay API
    const authHeader = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
        receipt: `rcpt_${workspaceId}_${Date.now()}`,
        notes: {
          workspaceId,
          plan: 'pro',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Razorpay API error (${response.status}): ${errorText}`);
    }

    const orderData: any = await response.json();
    return {
      id: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId: env.RAZORPAY_KEY_ID,
      isMock: false,
      notes: orderData.notes,
    };
  }

  /**
   * Verify Razorpay payment signature
   */
  static verifyPaymentSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    const { orderId, paymentId, signature } = params;

    // Allow mock verification in mock mode
    if (this.isMockMode() || orderId.startsWith('order_mock_')) {
      return Boolean(paymentId && orderId);
    }

    // Live Razorpay signature check: HMAC_SHA256(order_id + "|" + payment_id, secret)
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  }

  /**
   * Verify incoming Razorpay webhook signature
   */
  static verifyWebhookSignature(payload: string, signature: string): boolean {
    if (this.isMockMode()) {
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  }
}
