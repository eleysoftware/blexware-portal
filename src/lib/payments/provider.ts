// Processor-agnostic payment interface. The invoice system talks to PaymentService,
// which delegates to one of these providers (Hyperswitch, PayPal, etc.).

export type PaymentStatus =
  | "created"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "disputed"
  | "action_required";

export type PaymentMethodChoice = "bank" | "card";

export type PaymentSnapshot = {
  providerPaymentId: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  /** Provider-specific client token / order id / client secret. */
  clientToken: string | null;
  paymentMethod: string | null;
  connector: string | null;
  processorTransactionId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
};

export type CreatePaymentInput = {
  amountCents: number;
  currency?: string;
  reference: string;
  description: string;
  customerEmail?: string | null;
  customerName?: string | null;
  returnUrl: string;
  methods?: PaymentMethodChoice;
  metadata?: Record<string, string>;
};

export type RefundResult = {
  refundId: string;
  status: string;
  amountCents: number;
};

export type SettlementView = {
  providerPaymentId: string;
  status: PaymentStatus;
  amountCents: number;
  netAmountCents: number | null;
  feeCents: number | null;
  connector: string | null;
  paymentMethod: string | null;
  settledAt: string | null;
};

export type CheckoutConfig =
  | { kind: "hyperswitch"; publishableKey: string; profileId: string; environment: "sandbox" | "production" }
  | { kind: "paypal"; clientId: string; environment: "sandbox" | "live" };

export type PublicConfig = {
  /** Provider slug, e.g. "hyperswitch" or "paypal". */
  provider: string;
  /** Browser-safe config the checkout component needs. */
  checkout: CheckoutConfig;
};

export type WebhookParseResult =
  | { kind: "payment"; providerPaymentId: string; status: PaymentStatus; amountCents?: number; paymentMethod?: string | null; processorTransactionId?: string | null; failureMessage?: string | null }
  | { kind: "refund"; refundId: string; providerPaymentId: string; status: string; amountCents: number; processorRefundId?: string | null }
  | { kind: "ignore" };

export interface PaymentProvider {
  readonly name: string;
  isConfigured(): boolean;
  publicConfig(): PublicConfig;
  createPayment(input: CreatePaymentInput): Promise<PaymentSnapshot>;
  getPayment(providerPaymentId: string): Promise<PaymentSnapshot>;
  getSettlement(providerPaymentId: string): Promise<SettlementView>;
  cancelPayment(providerPaymentId: string, reason?: string): Promise<PaymentSnapshot>;
  refundPayment(input: { providerPaymentId: string; amountCents: number; reason?: string | null }): Promise<RefundResult>;
  parseWebhook(request: Request): Promise<WebhookParseResult>;
}
