export interface CreateOrderParams {
  amountPaise: number;
  requestId: string;
  invoiceNumber: string;
  customerEmail: string;
}

export interface OrderResult {
  orderId: string;
  amountPaise: number;
  currency: string;
  provider: string;
}

export interface VerifyPaymentParams {
  orderId: string;
  paymentId: string;
  signature?: string;
  amountPaise?: number;
}

export interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<OrderResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<boolean>;
}

export class MockPaymentProvider implements PaymentProvider {
  async createOrder(params: CreateOrderParams): Promise<OrderResult> {
    // Generate deterministic or random mock order
    const orderId = `order_mock_${Date.now()}_${params.requestId.slice(0, 8)}`;
    return {
      orderId,
      amountPaise: params.amountPaise,
      currency: 'INR',
      provider: 'MOCK',
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
    // In mock test mode, payment succeeds unless explicitly simulating a failure test ID
    if (params.paymentId.includes('fail')) {
      return false;
    }
    return true;
  }
}

// Extension point: RazorpayPaymentProvider can be instantiated here when env.PAYMENT_PROVIDER === 'RAZORPAY'
export const paymentProvider: PaymentProvider = new MockPaymentProvider();
