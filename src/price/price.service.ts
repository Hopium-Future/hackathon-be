import { Injectable } from '@nestjs/common';

@Injectable()
export class PriceService {
  constructor() {}

  async getSymbolTicker(symbol: string) {
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    );
    const data = await response.json();
    return parseFloat(data.price);
  }
}
