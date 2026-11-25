import { env } from '../config/env';

export interface PayPalCreateOrderInput {
  orderId: string;
  orderNumber: string;
  total: number;
  currency: 'USD';
}

export interface PayPalCreateOrderResult {
  paypalOrderId: string;
  status: string;
}

export interface PayPalCaptureOrderResult {
  paypalOrderId: string;
  status: string;
  captureId: string;
  amountValue: number;
  currencyCode: string;
  customId?: string;
  payerEmail?: string;
}

export interface PayPalGateway {
  createOrder(input: PayPalCreateOrderInput): Promise<PayPalCreateOrderResult>;
  captureOrder(paypalOrderId: string): Promise<PayPalCaptureOrderResult>;
}

interface PayPalAccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface PayPalOrderApiResponse {
  id: string;
  status: string;
  payer?: { email_address?: string };
  purchase_units?: Array<{
    custom_id?: string;
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount?: {
          value?: string;
          currency_code?: string;
        };
      }>;
    };
  }>;
  message?: string;
}

export class SandboxPayPalGateway implements PayPalGateway {
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 30_000) {
      return this.cachedToken;
    }

    if (!env.paypalClientId || !env.paypalClientSecret) {
      throw new Error(
        'Credenciales de PayPal Sandbox no configuradas en el backend.'
      );
    }

    const credentials = Buffer.from(
      `${env.paypalClientId}:${env.paypalClientSecret}`
    ).toString('base64');

    const response = await fetch(`${env.paypalApiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const data = (await response.json()) as PayPalAccessTokenResponse;
    if (!response.ok || !data.access_token) {
      throw new Error(
        `No se pudo autenticar con PayPal Sandbox (${response.status}).`
      );
    }

    this.cachedToken = data.access_token;
    const ttlSeconds = Number(data.expires_in) || 300;
    this.tokenExpiresAt = Date.now() + ttlSeconds * 1000;
    return this.cachedToken;
  }

  async createOrder(
    input: PayPalCreateOrderInput
  ): Promise<PayPalCreateOrderResult> {
    const token = await this.getAccessToken();

    const response = await fetch(`${env.paypalApiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: input.orderNumber,
            custom_id: input.orderId,
            description: `Pedido LibroYa ${input.orderNumber}`,
            amount: {
              currency_code: input.currency,
              value: input.total.toFixed(2),
            },
          },
        ],
      }),
    });

    const data = (await response.json()) as PayPalOrderApiResponse;
    if (!response.ok || !data.id) {
      throw new Error(
        `Error creando orden en PayPal Sandbox (${response.status}): ${data.message || 'Respuesta inválida'}`
      );
    }

    return {
      paypalOrderId: data.id,
      status: data.status,
    };
  }

  async captureOrder(
    paypalOrderId: string
  ): Promise<PayPalCaptureOrderResult> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${env.paypalApiBase}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = (await response.json()) as PayPalOrderApiResponse;
    if (!response.ok) {
      throw new Error(
        `Error capturando orden en PayPal Sandbox (${response.status}): ${data.message || 'No capturada'}`
      );
    }

    const unit = data.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    const amountValue = Number(capture?.amount?.value || 0);
    const currencyCode = capture?.amount?.currency_code || '';

    return {
      paypalOrderId: data.id,
      status: capture?.status || data.status,
      captureId: capture?.id || '',
      amountValue,
      currencyCode,
      customId: unit?.custom_id,
      payerEmail: data.payer?.email_address,
    };
  }
}
