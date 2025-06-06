export interface ISymbolTickerStreamPayload {
  E: number; // 123456789; // Event time
  e: string; // '24hrTicker'; // Event type
  s: string; // 'BNBBTC'; // Symbol
  p: string; // '0.0015'; // Price change
  P: string; // '250.00'; // Price change percent
  w: string; // '0.0018'; // Weighted average price
  x: string; // '0.0009'; // First trade(F)-1 price (first trade before the 24hr rolling window)
  c: string; // '0.0025'; // Last price
  Q: string; // '10'; // Last quantity
  o: string; // '0.0010'; // Open price
  h: string; //  '0.0025'; // High price
  l: string; //'0.0010'; // Low price
  v: string; // '10000'; // Total traded base asset volume
  q: string; // '18'; // Total traded quote asset volume
  O: number; // 0; // Statistics open time
  C: number; // 86400000; // Statistics close time
  F: number; // 0; // First trade ID
  L: number; // 18150; // Last trade Id
  n: number; // 18151; // Total number of trades
}
