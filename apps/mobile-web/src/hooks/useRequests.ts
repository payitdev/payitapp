import { useState, useCallback } from "react";
import { apiFetch } from "../apiClient";

const configuredApiBaseUrl = String((import.meta as any).env?.VITE_API_BASE_URL || "").trim();
const API_BASE_URL = configuredApiBaseUrl
  ? (/^https?:\/\//i.test(configuredApiBaseUrl) ? configuredApiBaseUrl : `https://${configuredApiBaseUrl}`).replace(/\/$/, "")
  : "";

export function useRequests(activeEntityId: string | undefined) {
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [allRequestsList, setAllRequestsList] = useState<any[]>([]);
  const [requestsFilter, setRequestsFilter] = useState<'all' | 'pending' | 'paid' | 'declined'>('all');
  const [requestPayer, setRequestPayer] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [requestNarration, setRequestNarration] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestStatusMsg, setRequestStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async (entityId?: string, signal?: AbortSignal) => {
    const id = entityId ?? activeEntityId;
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/payments/requests?entityId=${id}`, { signal });
      const data = await res.json();
      if (!signal?.aborted && data.requests) {
        setPendingRequests(data.requests.filter((r: any) => r.status === 'pending'));
        setAllRequestsList(data.requests);
      }
    } catch (e: any) {
      if (!signal?.aborted) setError(e?.message ?? "We couldn't load your requests. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeEntityId]);

  const handleCreatePaymentRequest = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEntityId) return;
    setIsSubmittingRequest(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/payments/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: activeEntityId, payerUsernameOrId: requestPayer, amount: parseFloat(requestAmount), currency: 'NGN', narration: requestNarration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'We couldn\'t send your payment request.');
      setRequestStatusMsg({ type: 'success', text: data.message || 'Payment request sent.' });
      setTimeout(() => {
        setShowRequestModal(false);
        setRequestStatusMsg(null);
        setRequestPayer('');
        setRequestAmount('');
        setRequestNarration('');
        if (activeEntityId) fetchRequests(activeEntityId);
      }, 1500);
    } catch (err: any) {
      setRequestStatusMsg({ type: 'error', text: err.message || 'We couldn\'t send your payment request.' });
    } finally {
      setIsSubmittingRequest(false);
    }
  }, [activeEntityId, requestPayer, requestAmount, requestNarration, fetchRequests]);

  const handleFulfillRequest = useCallback(async (requestId: string) => {
    if (!activeEntityId) return;
    try {
      await apiFetch(`${API_BASE_URL}/api/payments/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: activeEntityId, requestId }),
      });
      fetchRequests(activeEntityId);
    } catch (err: any) {
      alert(err.message);
    }
  }, [activeEntityId, fetchRequests]);

  return {
    pendingRequests, setPendingRequests,
    allRequestsList, setAllRequestsList,
    requestsFilter, setRequestsFilter,
    requestPayer, setRequestPayer,
    requestAmount, setRequestAmount,
    requestNarration, setRequestNarration,
    isSubmittingRequest, setIsSubmittingRequest,
    requestStatusMsg, setRequestStatusMsg,
    showRequestModal, setShowRequestModal,
    loading, error,
    fetchRequests, handleCreatePaymentRequest, handleFulfillRequest,
  };
}
