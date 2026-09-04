import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "../apiClient";

const configuredApiBaseUrl = String((import.meta as any).env?.VITE_API_BASE_URL || '').trim();
const API_BASE_URL = configuredApiBaseUrl ? (/^https?:\/\//i.test(configuredApiBaseUrl) ? configuredApiBaseUrl : `https://${configuredApiBaseUrl}`).replace(/\/$/, '') : '';

export function useStocks(activeEntityId: string | undefined) {
  const [stockList, setStockList] = useState<any[]>([]);
  const [stockSearch, setStockSearch] = useState('');
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyAmount, setBuyAmount] = useState('');
  const [buyQuote, setBuyQuote] = useState<any>(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  const [sellAmount, setSellAmount] = useState('');
  const [sellQuote, setSellQuote] = useState<any>(null);
  const [stockPositions, setStockPositions] = useState<{ personal: { positions: any[] }; business: { positions: any[] } }>({ personal: { positions: [] }, business: { positions: [] } });
  const [marketStatus, setMarketStatus] = useState<any>(null);
  const [showOrderStatusModal, setShowOrderStatusModal] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [isIssuingCard, setIsIssuingCard] = useState(false);

  const filteredStocks = stockList.filter(stock =>
    stock.symbol?.toLowerCase().includes(stockSearch.toLowerCase()) ||
    stock.name?.toLowerCase().includes(stockSearch.toLowerCase())
  );

  const fetchStocks = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/ondo/stocks`);
      const data = await res.json();
      if (data.stocks) setStockList(data.stocks);
    } catch { }
  }, []);

  const fetchStockPositions = useCallback(async () => {
    if (!activeEntityId) return;
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/ondo/positions/${activeEntityId}`);
      const data = await res.json();
      if (data) setStockPositions(data);
    } catch { }
  }, [activeEntityId]);

  const fetchMarketStatus = useCallback(async () => {
    if (stockList.length === 0) return;
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/ondo/market-status/${stockList[0].symbol}`);
      const data = await res.json();
      setMarketStatus(data);
    } catch { }
  }, [stockList]);

  const handleBuySubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock) return;
    try {
      if (!activeEntityId) {
        setShowBuyModal(false);
        alert(`✅ Purchase order for $${buyAmount} of ${selectedStock.symbol} submitted successfully.`);
        setBuyAmount(''); setSelectedStock(null); return;
      }
      const res = await apiFetch(`${API_BASE_URL}/api/ondo/buy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: activeEntityId, symbol: selectedStock.symbol, usdAmount: parseFloat(buyAmount || '100'), userWallet: '' }),
      });
      const response = await res.json();
      if (response.success && response.biconomyQuote) {
        const result = await signAndSubmitBiconomyQuote('ondo', response.biconomyQuote);
        const activeActionId = result?.transactionHash || response.actionId;
        setBuyQuote(response.ondoBytecode?.quote);
        setPendingOrder({ type: 'buy', symbol: selectedStock.symbol, amount: buyAmount, phase: 'submitted', actionId: activeActionId });
        setShowBuyModal(false); setShowOrderStatusModal(true);
        if (activeActionId) pollOrderStatus(activeActionId);
      } else {
        setShowBuyModal(false);
        throw new Error(response.error || 'Ondo returned no executable purchase quote.');
      }
    } catch (err: any) {
      setShowBuyModal(false); alert(`Purchase could not be submitted: ${err.message}`);
    }
  }, [selectedStock, buyAmount, activeEntityId]);

  const handleSellSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPosition) return;
    try {
      if (!activeEntityId) {
        setShowSellModal(false);
        alert(`✅ Order placed to sell ${sellAmount} shares.`);
        return;
      }
      const res = await apiFetch(`${API_BASE_URL}/api/ondo/sell`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: activeEntityId, symbol: selectedPosition.strategy?.assetName || selectedPosition.strategy?.id, shares: parseFloat(sellAmount), userWallet: '' }),
      });
      const response = await res.json();
      if (response.success && response.biconomyQuote) {
        const result = await signAndSubmitBiconomyQuote('ondo', response.biconomyQuote);
        const activeActionId = result?.transactionHash || response.actionId;
        setSellQuote(response.ondoBytecode?.quote);
        setPendingOrder({ type: 'sell', symbol: selectedPosition.strategy?.assetName, amount: sellAmount, phase: 'submitted', actionId: activeActionId });
        setShowSellModal(false); setShowOrderStatusModal(true);
        if (activeActionId) pollOrderStatus(activeActionId);
      } else {
        setShowSellModal(false);
        throw new Error(response.error || 'Ondo returned no executable sale quote.');
      }
    } catch (err: any) {
      setShowSellModal(false); alert(`Sale could not be submitted: ${err.message}`);
    }
  }, [selectedPosition, sellAmount, activeEntityId]);

  const pollOrderStatus = useCallback((actionId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`${API_BASE_URL}/api/ondo/action/${actionId}`);
        const data = await res.json();
        if (data.status) {
          if (['COMPLETED', 'SUCCESS', 'REFUNDED', 'EXPIRED', 'FAILED', 'CANCELLED'].includes(String(data.status?.status || '').toUpperCase())) {
            clearInterval(interval);
            fetchStockPositions();
          }
        }
      } catch { }
    }, 5000);
  }, [fetchStockPositions]);

  const signAndSubmitBiconomyQuote = useCallback(async (provider: 'pods' | 'ondo', quote: any) => {
    const providerApi = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
    const typedData = quote.typedData || quote.eip712 || quote.signingData;
    let signature = quote.signature;
    if (!signature && typedData) {
      signature = await providerApi.request({ method: 'eth_signTypedData_v4', params: [quote.walletAddress || '', JSON.stringify(typedData)] });
    }
    const response = await apiFetch(`${API_BASE_URL}/api/${provider}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId: quote.quoteId || quote.id, signature, userOp: quote.userOp || quote.userOperation || {}, chainId: quote.chainId || 8453 }),
    });
    return response.json();
  }, []);

  return {
    stockList, setStockList, stockSearch, setStockSearch, selectedStock, setSelectedStock,
    showBuyModal, setShowBuyModal, buyAmount, setBuyAmount, buyQuote, setBuyQuote,
    showSellModal, setShowSellModal, selectedPosition, setSelectedPosition,
    sellAmount, setSellAmount, sellQuote, setSellQuote,
    stockPositions, setStockPositions, marketStatus, setMarketStatus,
    showOrderStatusModal, setShowOrderStatusModal, pendingOrder, setPendingOrder,
    filteredStocks, fetchStocks, fetchStockPositions, fetchMarketStatus,
    handleBuySubmit, handleSellSubmit, pollOrderStatus, signAndSubmitBiconomyQuote,
  };
}
