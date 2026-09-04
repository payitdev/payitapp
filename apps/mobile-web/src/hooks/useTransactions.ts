import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../apiClient';
import { useAccount } from '../context/AccountContext';

const configuredApiBaseUrl = String((import.meta as any).env?.VITE_API_BASE_URL || '').trim();
const API_BASE_URL = configuredApiBaseUrl
  ? (/^https?:\/\//i.test(configuredApiBaseUrl) ? configuredApiBaseUrl : `https://${configuredApiBaseUrl}`).replace(/\/$/, '')
  : '';

export interface Transaction {
  id: string;
  type: 'INBOUND' | 'OUTBOUND';
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
  symbol: string;
  date: string;
  time: string;
  mode: 'fiat' | 'crypto';
  senderAccount: string;
  recipientAccount: string;
  reference: string;
}

export interface PayoutTrackerData {
  payoutId: string;
  status: string;
  stepIndex: number;
  currency: string;
  amount: number;
  uetrReference: string;
  clearingNetwork: string;
  estimatedDelivery: string;
  updatedAt: string;
}

export function useTransactions() {
  const { activeEntity } = useAccount();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activityFilter, setActivityFilter] = useState<'all' | 'in' | 'out'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackerData, setTrackerData] = useState<PayoutTrackerData | null>(null);
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTransactions = useCallback(async (entityIdOverride?: string, signal?: AbortSignal) => {
    const entityId = entityIdOverride || activeEntity?.id;
    if (!entityId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/transfers/history?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal?.aborted && data.transactions) {
        setTransactions(
          data.transactions.map((tx: any) => ({
            id: tx.id,
            type: tx.type as 'INBOUND' | 'OUTBOUND',
            title: tx.title,
            subtitle: tx.subtitle || 'Payment activity',
            amount: Number(tx.amount) || 0,
            symbol: tx.symbol || (tx.currency === 'USD' ? '$' : '₦'),
            currency: tx.currency || 'NGN',
            date: tx.date,
            time: tx.time || '',
            mode: tx.mode || 'fiat',
            senderAccount: tx.senderAccount || 'Proxim Account',
            recipientAccount: tx.recipientAccount || 'External Account',
            reference: tx.reference || tx.id,
          }))
        );
      }
    } catch (err: any) {
      if (!signal?.aborted) {
        setError("We couldn't load your transactions. Please try again.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [activeEntity?.id]);

  const fetchPayoutTracker = useCallback(async (payoutId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/transfers/status/${payoutId}`);
      const data = await res.json();
      if (data.success && data.tracking) {
        setTrackerData(data.tracking);
      } else {
        setTrackerData({
          payoutId,
          status: 'processing',
          stepIndex: 2,
          currency: 'USD',
          amount: 0,
          uetrReference: `UETR-${payoutId.slice(-8).toUpperCase()}`,
          clearingNetwork: 'NIBSS / SWIFT / SEPA',
          estimatedDelivery: 'Within 1–2 business days',
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      setTrackerData({
        payoutId,
        status: 'processing',
        stepIndex: 2,
        currency: 'USD',
        amount: 0,
        uetrReference: `UETR-${payoutId.slice(-8).toUpperCase()}`,
        clearingNetwork: 'NIBSS / SWIFT / SEPA',
        estimatedDelivery: 'Within 1–2 business days',
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setShowTrackerModal(true);
    }
  }, []);

  useEffect(() => {
    if (activeEntity?.id) {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      fetchTransactions(activeEntity.id, controller.signal);
      return () => {
        controller.abort();
      };
    }
  }, [activeEntity?.id, fetchTransactions]);

  const filteredTransactions = transactions.filter((tx) => {
    if (activityFilter === 'in') return tx.type === 'INBOUND';
    if (activityFilter === 'out') return tx.type === 'OUTBOUND';
    return true;
  });

  return {
    transactions: filteredTransactions,
    rawTransactions: transactions,
    activityFilter,
    setActivityFilter,
    loading,
    error,
    fetchTransactions,
    fetchPayoutTracker,
    trackerData,
    showTrackerModal,
    setShowTrackerModal,
  };
}
