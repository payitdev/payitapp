import { useState, useCallback } from "react";
import { apiFetch } from "../apiClient";

const configuredApiBaseUrl = String((import.meta as any).env?.VITE_API_BASE_URL || "").trim();
const API_BASE_URL = configuredApiBaseUrl
  ? (/^https?:\/\//i.test(configuredApiBaseUrl) ? configuredApiBaseUrl : `https://${configuredApiBaseUrl}`).replace(/\/$/, "")
  : "";

export function usePayroll(activeEntityId: string | undefined) {
  const [payrollRunsList, setPayrollRunsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayroll = useCallback(async (entityId?: string, signal?: AbortSignal) => {
    const id = entityId ?? activeEntityId;
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/payroll?entityId=${id}`, { signal });
      const data = await res.json();
      if (!signal?.aborted && data.payrollRuns) setPayrollRunsList(data.payrollRuns);
    } catch (e: any) {
      if (!signal?.aborted) setError(e?.message ?? "We couldn't load payroll data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeEntityId]);

  return {
    payrollRunsList, setPayrollRunsList,
    loading, error,
    fetchPayroll,
  };
}
