// src/types/razorpay.d.ts
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
}

declare class Razorpay {
  constructor(options: RazorpayOptions);
  open(): void;
}
