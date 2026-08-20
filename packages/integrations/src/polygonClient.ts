import axios from 'axios';

export class PolygonClient {
  private apiKey: string;
  private client: any;

  constructor() {
    this.apiKey = process.env.POLYGON_API_KEY || '';
    this.client = axios.create({
      baseURL: 'https://api.polygon.io',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
  }

  async getLatestPrice(symbol: string): Promise<any> {
    if (!this.apiKey) return null;
    try {
      // Get previous close as a proxy for live price on free tier
      // (Free tier might have 15m delay or end of day data)
      const res = await this.client.get(`/v2/aggs/ticker/${symbol}/prev`);
      if (res.data && res.data.results && res.data.results.length > 0) {
        const result = res.data.results[0];
        return {
          price: result.c, // close
          change: result.c - result.o,
          changePercent: ((result.c - result.o) / result.o) * 100,
          volume: result.v,
        };
      }
      return null;
    } catch (e) {
      console.error(`[PolygonClient] Failed to fetch price for ${symbol}`);
      return null;
    }
  }
}
