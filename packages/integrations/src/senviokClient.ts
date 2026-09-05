import crypto from 'crypto';

export interface SenviokClientOptions {
  apiKey?: string;
  baseUrl?: string;
}

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  fromName?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  addUnsubscribeFooter?: boolean;
  addListUnsubscribeHeader?: boolean;
}

export interface SendSmsParams {
  from: string;
  to: string;
  text: string;
}

export interface SendWhatsappParams {
  from?: string;
  to: string;
  text: string;
}

export interface SenviokMessageResponse {
  id: string;
  [key: string]: any;
}

export class SenviokApiError extends Error {
  public status: number;
  public body: any;

  constructor(status: number, message: string, body?: any) {
    super(message);
    this.name = 'SenviokApiError';
    this.status = status;
    this.body = body;
  }
}

export class SenviokClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, options?: { BASE?: string; baseUrl?: string }) {
    this.apiKey = apiKey || process.env.SENVIOK_API_KEY || '';
    this.baseUrl = (options?.BASE || options?.baseUrl || process.env.SENVIOK_BASE_URL || 'https://api.senviok.live/v1').replace(/\/+$/, '');
  }

  private async request<T>(endpoint: string, method: string, body?: any): Promise<T> {
    if (!this.apiKey) {
      console.warn(`[Senviok] Warning: SENVIOK_API_KEY is not set. Mocking success response for ${endpoint}.`);
      return { id: `msg_mock_${Date.now()}` } as unknown as T;
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      const errorMsg = json?.message || json?.error || `Senviok API request failed with status ${res.status}`;
      throw new SenviokApiError(res.status, errorMsg, json);
    }

    return json as T;
  }

  public emails = {
    send: async (params: SendEmailParams): Promise<SenviokMessageResponse> => {
      return this.request<SenviokMessageResponse>('/emails', 'POST', params);
    },
  };

  public sms = {
    send: async (params: SendSmsParams): Promise<SenviokMessageResponse> => {
      return this.request<SenviokMessageResponse>('/sms', 'POST', params);
    },
  };

  public whatsapp = {
    send: async (params: SendWhatsappParams): Promise<SenviokMessageResponse> => {
      return this.request<SenviokMessageResponse>('/whatsapp', 'POST', params);
    },
  };

  public webhooks = {
    verifySignature: (rawBody: string, signature: string | string[] | undefined, secret: string): boolean => {
      if (!signature || !secret || !rawBody) return false;
      const sigStr = Array.isArray(signature) ? signature[0] : signature;
      try {
        const hmac = crypto.createHmac('sha256', secret);
        const digest = hmac.update(rawBody).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sigStr));
      } catch {
        return false;
      }
    },
  };
}

export const senviok = new SenviokClient();
