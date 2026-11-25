'use client';

import React, { useState } from 'react';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { api, ApiError } from '@/lib/api';
import { Order } from '@/lib/types';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

interface PayPalCheckoutProps {
  orderId: string;
  token: string;
  totalAmount: number;
  onCaptured: (order: Order) => void;
}

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';

export function PayPalCheckout({
  orderId,
  token,
  totalAmount,
  onCaptured,
}: PayPalCheckoutProps) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  if (!PAYPAL_CLIENT_ID) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-200">
        Falta configurar <code>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> en el
        entorno del frontend.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-stone-700 bg-obsidian/70 px-3.5 py-2.5 text-xs text-stone-300">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
        <span>
          Pago verificado por el servidor LibroYa contra PayPal Sandbox (
          <strong>${totalAmount.toFixed(2)} USD</strong>).
        </span>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-200">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-950/40 p-3.5 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div>
            <p className="font-medium">No se completó el pago</p>
            <p className="text-xs text-rose-200/90 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {processing && (
        <p className="text-center text-xs text-amber-300 animate-pulse">
          Confirmando captura en PayPal Sandbox y reservando stock en servidor...
        </p>
      )}

      <div className="rounded-xl bg-stone-100 p-4">
        <PayPalScriptProvider
          options={{
            clientId: PAYPAL_CLIENT_ID,
            currency: 'USD',
            intent: 'capture',
          }}
        >
          <PayPalButtons
            style={{
              layout: 'vertical',
              color: 'gold',
              shape: 'rect',
              label: 'paypal',
            }}
            disabled={processing}
            createOrder={async () => {
              setErrorMessage(null);
              setStatusMessage(null);
              try {
                const res = await api.createPayPalOrder(token, orderId);
                return res.paypalOrderId;
              } catch (err) {
                const msg =
                  err instanceof ApiError
                    ? err.message
                    : 'No se pudo iniciar la orden en PayPal Sandbox.';
                setErrorMessage(msg);
                throw err;
              }
            }}
            onApprove={async (data) => {
              setProcessing(true);
              setErrorMessage(null);
              try {
                const res = await api.capturePayPalOrder(token, {
                  orderId,
                  paypalOrderId: data.orderID,
                });
                onCaptured(res.order);
              } catch (err) {
                const msg =
                  err instanceof ApiError
                    ? err.message
                    : 'Error al validar la captura del pago en el servidor.';
                setErrorMessage(msg);
              } finally {
                setProcessing(false);
              }
            }}
            onCancel={async (data) => {
              setProcessing(false);
              setStatusMessage(
                'Pago cancelado en PayPal. Tu pedido sigue pendiente y puedes reintentar cuando desees.'
              );
              try {
                await api.cancelPayPalOrder(token, {
                  orderId,
                  paypalOrderId:
                    typeof data?.orderID === 'string'
                      ? data.orderID
                      : undefined,
                });
              } catch {
                // Silencioso; el pedido permanece PENDING_PAYMENT
              }
            }}
            onError={() => {
              setProcessing(false);
              setErrorMessage(
                'Ocurrió un error de comunicación con PayPal Sandbox. Tu pedido no se duplicó; puedes volver a intentarlo.'
              );
            }}
          />
        </PayPalScriptProvider>
      </div>
    </div>
  );
}
