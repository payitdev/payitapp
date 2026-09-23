import { useState, useCallback } from "react";
import { apiFetch } from "../apiClient";

const configuredApiBaseUrl = String((import.meta as any).env?.VITE_API_BASE_URL || "").trim();
const API_BASE_URL = configuredApiBaseUrl
  ? (/^https?:\/\//i.test(configuredApiBaseUrl) ? configuredApiBaseUrl : `https://${configuredApiBaseUrl}`).replace(/\/$/, "")
  : "";

export function useInvoices(activeEntityId: string | undefined) {
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'overdue'>('all');
  const [invoiceClientName, setInvoiceClientName] = useState('');
  const [invoiceClientEmail, setInvoiceClientEmail] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceCurrency, setInvoiceCurrency] = useState('USD');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [invoiceSettlementMode, setInvoiceSettlementMode] = useState<'fiat' | 'crypto'>('fiat');
  const [invoiceCryptoChain, setInvoiceCryptoChain] = useState<'Base' | 'Solana' | 'Polygon' | 'Ethereum' | 'Arbitrum'>('Base');
  const [invoiceCryptoAsset, setInvoiceCryptoAsset] = useState<'USDC' | 'USDT' | 'EURC'>('USDC');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceFxQuote, setInvoiceFxQuote] = useState<any>(null);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<any>(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('invoices');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvoiceAmountChange = useCallback(async (val: string, curr = invoiceCurrency) => {
    setInvoiceAmount(val);
    const num = parseFloat(val);
    if (!num || num <= 0) { setInvoiceFxQuote(null); return; }
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/invoices/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: num, currency: curr }),
      });
      const data = await res.json();
      if (data.quote) setInvoiceFxQuote(data.quote);
    } catch {
      const rates: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.28, NGN: 1 / 1550, KES: 1 / 129, GHS: 1 / 15.5, USDC: 1, USDT: 1 };
      const rate = rates[curr] || 1;
      const fee = num * 0.012;
      const net = num - fee;
      setInvoiceFxQuote({ sourceAmount: num, sourceCurrency: curr, feeAmount: fee, netSourceAmount: net, feePercent: 1.2, rateToUsd: rate, grossUsd: num * rate, feeUsd: fee * rate, netUsd: net * rate });
    }
  }, [invoiceCurrency]);

  const fetchInvoices = useCallback(async (entityId?: string, signal?: AbortSignal) => {
    const id = entityId ?? activeEntityId;
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/invoices?entityId=${id}`, { signal });
      const data = await res.json();
      if (!signal?.aborted && data.invoices) setInvoicesList(data.invoices);
    } catch (e: any) {
      if (!signal?.aborted) setError(e?.message ?? "We couldn't load your invoices. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeEntityId]);

  return {
    invoicesList, setInvoicesList,
    invoiceStatusFilter, setInvoiceStatusFilter,
    invoiceClientName, setInvoiceClientName,
    invoiceClientEmail, setInvoiceClientEmail,
    invoiceAmount, setInvoiceAmount,
    invoiceCurrency, setInvoiceCurrency,
    invoiceDescription, setInvoiceDescription,
    invoiceSettlementMode, setInvoiceSettlementMode,
    invoiceCryptoChain, setInvoiceCryptoChain,
    invoiceCryptoAsset, setInvoiceCryptoAsset,
    invoiceDueDate, setInvoiceDueDate,
    invoiceFxQuote, setInvoiceFxQuote,
    selectedInvoiceForModal, setSelectedInvoiceForModal,
    isCreatingInvoice, setIsCreatingInvoice,
    currentScreen, setCurrentScreen,
    loading, error,
    handleInvoiceAmountChange, fetchInvoices,
  };
}
