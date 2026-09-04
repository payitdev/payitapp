import { useState, useCallback, useEffect, useRef } from 'react';
import { apiFetch } from '../apiClient';
import { useAccount } from '../context/AccountContext';
import { useWallets } from '@privy-io/react-auth';

const configuredApiBaseUrl = String((import.meta as any).env?.VITE_API_BASE_URL || '').trim();
const API_BASE_URL = configuredApiBaseUrl
  ? (/^https?:\/\//i.test(configuredApiBaseUrl) ? configuredApiBaseUrl : `https://${configuredApiBaseUrl}`).replace(/\/$/, '')
  : '';

export interface YieldOption {
  id: string;
  provider: string;
  name: string;
  chain: string;
  asset: string;
  grossApy: number;
  userNetApy: number;
  apyByDuration?: Record<string, number>;
  verified?: boolean;
}

export interface KaminoPosition {
  id: string;
  name?: string;
  principalAmountUsd?: string;
  principalUsd?: string;
  accruedInterestUsd?: string;
  userNetApy?: string;
  lockDurationDays?: number;
  status?: string;
}

export function useSavings(entityIdOverride?: string) {
  const { activeEntity } = useAccount();
  const { wallets } = useWallets();
  const entityId = entityIdOverride || activeEntity?.id;

  const [savingsPool, setSavingsPool] = useState<number>(0);
  const [kaminoPositions, setKaminoPositions] = useState<KaminoPosition[]>([]);
  const [yieldOptions, setYieldOptions] = useState<YieldOption[]>([]);
  const [autoSweepEnabled, setAutoSweepEnabled] = useState<boolean>(true);
  const [liquidBufferUsd, setLiquidBufferUsd] = useState<number>(250);
  const [isSweepingNow, setIsSweepingNow] = useState<boolean>(false);
  const [sweepMessage, setSweepMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSavingsSummary = useCallback(async (id: string, signal?: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/savings/summary?entityId=${id}`, { signal });
      const data = await res.json();
      if (!signal?.aborted && data) {
        if (data.savingsPool !== undefined) setSavingsPool(Number(data.savingsPool));
      }
    } catch { }
  }, []);

  const fetchKaminoPositions = useCallback(async (id: string, signal?: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/kamino/positions/${id}`, { signal });
      const data = await res.json();
      if (!signal?.aborted && data.positions) {
        setKaminoPositions(data.positions);
        const lockedTotal = data.positions.reduce(
          (acc: number, p: any) => acc + parseFloat(p.principalAmountUsd || p.principalUsd || p.amount || '0'),
          0
        );
        if (lockedTotal > 0) setSavingsPool(lockedTotal);
      }
    } catch { }
  }, []);

  const fetchYieldOptions = useCallback(async () => {
    try {
      const [kaminoResponse, podsResponse] = await Promise.all([
        apiFetch(`${API_BASE_URL}/api/kamino/yield-options`, { cache: 'no-store' }),
        apiFetch(`${API_BASE_URL}/api/pods/strategies`, { cache: 'no-store' }).catch(() => ({ ok: false, json: async () => ({}) })),
      ]);

      const kaminoData = await kaminoResponse.json();
      const podsData = podsResponse.ok ? await (podsResponse as any).json() : {};

      const kaminoOpts: YieldOption[] = Array.isArray(kaminoData.options) ? kaminoData.options : [];
      const podsOpts: YieldOption[] = Array.isArray(podsData.strategies)
        ? podsData.strategies
            .filter((strategy: any) => !strategy.paused)
            .map((strategy: any) => ({
              id: strategy.id,
              provider: 'Pods',
              name: strategy.assetName || strategy.id,
              chain: strategy.network,
              asset: strategy.asset || 'USDC',
              grossApy: Number(strategy.grossApy ?? strategy.apy * 100),
              userNetApy: Number(strategy.userNetApy ?? strategy.apy * 100),
              verified: true,
            }))
        : [];

      const combined = [...kaminoOpts, ...podsOpts].sort((a, b) => (b.userNetApy || 0) - (a.userNetApy || 0));
      setYieldOptions(combined);
    } catch {
      setYieldOptions([]);
    }
  }, []);

  const triggerAutoSweep = useCallback(async () => {
    if (!entityId) return;
    setIsSweepingNow(true);
    setSweepMessage(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/pods/sweep-idle-cash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, liquidBufferUsd }),
      });
      const data = await res.json();
      if (data.sweptAmountUsd > 0) {
        setSweepMessage(`Swept $${data.sweptAmountUsd.toFixed(2)} idle cash into high-yield strategy.`);
      } else {
        setSweepMessage(data.message || 'Balance is within liquid buffer. No sweep needed.');
      }
      await Promise.all([fetchSavingsSummary(entityId), fetchKaminoPositions(entityId)]);
    } catch (err: any) {
      setSweepMessage(err.message || 'Auto-sweep completed.');
    } finally {
      setIsSweepingNow(false);
    }
  }, [entityId, liquidBufferUsd, fetchSavingsSummary, fetchKaminoPositions]);

  const signAndSubmitBiconomyQuote = useCallback(
    async (provider: 'pods' | 'ondo', quote: any) => {
      if (!wallets?.length) throw new Error('Connect a Privy wallet before submitting this transaction.');
      const wallet = wallets[0];
      const providerApi = await wallet.getEthereumProvider();
      const quoteId = quote?.quoteId || quote?.id;
      const userOp = quote?.userOp || quote?.userOperation || {};
      if (!quoteId || !Object.keys(userOp).length) {
        throw new Error('Provider returned no signable Biconomy user operation.');
      }
      let signature = quote.signature;
      if (!signature) {
        const typedData = quote.typedData || quote.eip712 || quote.signingData;
        if (!typedData) throw new Error('Provider returned no signing payload.');
        signature = await providerApi.request({
          method: 'eth_signTypedData_v4',
          params: [wallet.address, typeof typedData === 'string' ? typedData : JSON.stringify(typedData)],
        });
      }
      const response = await apiFetch(`${API_BASE_URL}/api/${provider}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, signature, userOp, chainId: quote.chainId || 8453 }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Biconomy submission failed.');
      return data.result;
    },
    [wallets]
  );

  const loadAll = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchSavingsSummary(entityId),
        fetchKaminoPositions(entityId),
        fetchYieldOptions(),
      ]);
    } catch {
      setError("We couldn't load your savings details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [entityId, fetchSavingsSummary, fetchKaminoPositions, fetchYieldOptions]);

  useEffect(() => {
    if (entityId) {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      loadAll();
      return () => {
        controller.abort();
      };
    }
  }, [entityId, loadAll]);

  return {
    savingsPool,
    setSavingsPool,
    kaminoPositions,
    yieldOptions,
    autoSweepEnabled,
    setAutoSweepEnabled,
    liquidBufferUsd,
    setLiquidBufferUsd,
    isSweepingNow,
    sweepMessage,
    loading,
    error,
    fetchSavingsSummary,
    fetchKaminoPositions,
    fetchYieldOptions,
    triggerAutoSweep,
    signAndSubmitBiconomyQuote,
    loadAll,
  };
}
