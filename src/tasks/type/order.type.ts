export type OrderCreatedPayload = {
  liquidity_broker: string;
  displaying_id: number;
  user_id: number;
  status: number;
  side: string;
  type: string;
  symbol: string;
  quantity: number;
  leverage: number;
  sl: number | null;
  tp: number | null;
  price: number;
  transfer_quantity: number;
  hold_quantity: number;
  open_price: number;
  opened_at: string;
  fee: number;
  fee_currency: number;
  margin: number;
  margin_currency: number;
  order_value: number;
  origin_order_value: number;
  order_value_currency: number;
  fee_metadata: {
    place_order: {
      value: number;
      currency: number;
    };
    close_order: {
      currency: number;
    };
  };
  fee_data: {
    place_order: {
      [key: number]: number;
    };
  };
  volume_data: {
    place_order: {
      [key: number]: number;
    };
  };
  request_id: {
    place: string;
  };
  _b: boolean;
  partner_type: number;
  user_category: number;
  promotion_category: number;
  swap: number;
  created_at: string;
  updated_at: string;
  metadata: any;
  profit: number;
  reason_close: string;
  raw_profit: number;
};

export type OrderUpdatedPayload = OrderCreatedPayload & {};

export type OrderClosedPayload = OrderCreatedPayload & {
  close_order_value?: number;
  profit: number;
  raw_profit: number;
  share_to_master: number;
};
