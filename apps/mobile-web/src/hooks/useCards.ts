import { useState, useCallback, useEffect, useRef } from 'react';
import { apiFetch } from '../apiClient';
import { useAccount } from '../context/AccountContext';

const configuredApiBaseUrl = String((import.meta as any).env?.VITE_API_BASE_URL || '').trim();
const API_BASE_URL = configuredApiBaseUrl
  ? (/^https?:\/\//i.test(configuredApiBaseUrl) ? configuredApiBaseUrl : `https://${configuredApiBaseUrl}`).replace(/\/$/, '')
  : '';

export interface CardItem {
  id: string;
  brand: 'VISA' | 'MASTERCARD';
  cardType: 'PERSONAL' | 'BUSINESS' | 'BURNER';
  status: 'ACTIVE' | 'FROZEN' | 'TERMINATED';
  maskedPan: string;
  expiry: string;
  balance?: number;
  currency?: string;
  cardholderName?: string;
}

export function useCards(entityIdOverride?: string) {
  const { activeEntity, currentUser } = useAccount();
  const entityId = entityIdOverride || activeEntity?.id;

  const [issuedCards, setIssuedCards] = useState<CardItem[]>([]);
  const [cardBrand, setCardBrand] = useState<'VISA' | 'MASTERCARD'>('VISA');
  const [selectedCardType, setSelectedCardType] = useState<'PERSONAL' | 'BUSINESS' | 'BURNER'>('PERSONAL');
  const [isIssuingCard, setIsIssuingCard] = useState(false);
  const [showCardsModal, setShowCardsModal] = useState(false);
  const [showCardFundModal, setShowCardFundModal] = useState(false);
  const [cardFundAction, setCardFundAction] = useState<'TOPUP' | 'WITHDRAW'>('TOPUP');
  const [cardFundAmount, setCardFundAmount] = useState('');
  const [targetCardId, setTargetCardId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCards = useCallback(async (targetId?: string, signal?: AbortSignal) => {
    const id = targetId || entityId;
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/cards?entityId=${id}`, { signal });
      const data = await res.json();
      if (!signal?.aborted && data.cards) {
        setIssuedCards(data.cards);
      }
    } catch (err: any) {
      if (!signal?.aborted) {
        setError("We couldn't load your cards. Please try again.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [entityId]);

  useEffect(() => {
    if (entityId) {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      fetchCards(entityId, controller.signal);
      return () => {
        controller.abort();
      };
    }
  }, [entityId, fetchCards]);

  const handleIssueVirtualCard = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const userId = currentUser?.id || currentUser?.userId;
      if (!entityId || !userId) return;
      setIsIssuingCard(true);
      setError(null);
      try {
        const res = await apiFetch(`${API_BASE_URL}/api/cards/issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityId, brand: cardBrand, cardType: selectedCardType }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Card issuance failed.');
        setShowCardsModal(false);
        await fetchCards(entityId);
      } catch (err: any) {
        setError(err.message || 'We were unable to issue your card. Please try again.');
      } finally {
        setIsIssuingCard(false);
      }
    },
    [entityId, currentUser, cardBrand, selectedCardType, fetchCards]
  );

  const handleFreezeVirtualCard = useCallback(
    async (cardId: string, currentStatus: string) => {
      if (!entityId) return;
      const isFrozen = currentStatus === 'FROZEN';
      setError(null);
      try {
        const res = await apiFetch(`${API_BASE_URL}/api/cards/freeze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityId, cardId, freeze: !isFrozen }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update card.');
        await fetchCards(entityId);
      } catch (err: any) {
        setError(err.message || 'We could not update your card status. Please try again.');
      }
    },
    [entityId, fetchCards]
  );

  const handleFundVirtualCard = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!entityId || !targetCardId || !cardFundAmount) return;
      setError(null);
      try {
        const endpoint =
          cardFundAction === 'TOPUP' ? `${API_BASE_URL}/api/cards/top-up` : `${API_BASE_URL}/api/cards/withdraw`;
        const res = await apiFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityId,
            cardId: targetCardId,
            amount: parseFloat(cardFundAmount),
            currency: 'USD',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Card ${cardFundAction.toLowerCase()} failed.`);
        setShowCardFundModal(false);
        setCardFundAmount('');
        await fetchCards(entityId);
      } catch (err: any) {
        setError(err.message || `We could not complete your card ${cardFundAction.toLowerCase()}. Please try again.`);
      }
    },
    [entityId, targetCardId, cardFundAmount, cardFundAction, fetchCards]
  );

  return {
    issuedCards,
    setIssuedCards,
    cardBrand,
    setCardBrand,
    selectedCardType,
    setSelectedCardType,
    isIssuingCard,
    setIsIssuingCard,
    showCardsModal,
    setShowCardsModal,
    showCardFundModal,
    setShowCardFundModal,
    cardFundAction,
    setCardFundAction,
    cardFundAmount,
    setCardFundAmount,
    targetCardId,
    setTargetCardId,
    loading,
    error,
    fetchCards,
    handleIssueVirtualCard,
    handleFreezeVirtualCard,
    handleFundVirtualCard,
  };
}
