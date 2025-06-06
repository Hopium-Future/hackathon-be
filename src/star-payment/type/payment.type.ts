export type PreCheckoutQueryPayload = {
  id: string;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name: string;
    username: string;
    language_code: string;
  };
  currency: string;
  total_amount: number;
  invoice_payload: Record<string, any>;
};

export type LabeledPrice = {
  label: string;
  amount: number;
};

export type CreateInvoiceLinkPayload = {
  currency: string;
  title: string;
  description: string;
  prices: LabeledPrice[];
  payload?: Record<string, any>;
};

export type SuccessfulPaymentPayload = {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name: string;
    username: string;
    language_code: string;
  };
  chat: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
    type: string;
  };
  date: number;
  successful_payment: {
    currency: string;
    total_amount: number;
    invoice_payload: Record<string, any>;
    telegram_payment_charge_id: string;
    provider_payment_charge_id: string;
  };
};
