import React, { useEffect, useState } from 'react';
import { apiFetch, setActiveEntityId } from './apiClient';

type AccountType = 'personal' | 'business';
type Field = { name: string; type: string; label: string; required?: boolean; placeholder?: string; pattern?: string; help?: string; options?: Array<{ value: string; label: string }>; maxLength?: number; accept?: string };
type Schema = { title: string; description: string; estimatedTimeMinutes: number; currenciesSupported: string[]; sections: Array<{ id: string; title: string; description?: string; fields: Field[] }> };
type Entity = { id: string; kind: 'PERSONAL' | 'BUSINESS'; dueStatus?: string };

const apiBaseUrl = String((import.meta as any).env?.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export const TelegramKycApp: React.FC = () => {
  const [accountType, setAccountType] = useState<AccountType>('personal');
  const [schema, setSchema] = useState<Schema | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityId, setEntityId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [verificationId, setVerificationId] = useState('');
  const [status, setStatus] = useState('Authenticating Telegram…');
  const [submitting, setSubmitting] = useState(false);
  const [claimingWeb, setClaimingWeb] = useState(false);

  useEffect(() => {
    const webApp = (window as any).Telegram?.WebApp;
    const initData = webApp?.initData;
    if (!initData || !apiBaseUrl) {
      setStatus('This verification screen must be opened from the configured Telegram Mini App.');
      return;
    }
    webApp.ready();
    webApp.expand();
    const authenticate = async () => {
      try {
        const authResponse = await fetch(`${apiBaseUrl}/api/auth/telegram/mini-app`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData }),
        });
        const auth = await authResponse.json();
        if (!authResponse.ok) throw new Error(auth.error || 'Telegram authentication failed.');
        localStorage.setItem('proxim_auth_token', auth.token);
        const linkedEntities = (auth.user.entities || []) as Entity[];
        if (linkedEntities.length === 0) throw new Error('No account entity is available for this Telegram user.');
        setEntities(linkedEntities);
        setEntityId(linkedEntities.find((item) => item.kind === 'PERSONAL')?.id || linkedEntities[0].id);
        setStatus('Loading verification form…');
      } catch (error: any) {
        setStatus(error.message || 'Unable to authenticate Telegram.');
      }
    };
    void authenticate();
  }, []);

  useEffect(() => {
    if (!entities.length || !entityId) return;
    const loadSchema = async () => {
      setStatus('Loading verification form…');
      const response = await apiFetch(`${apiBaseUrl}/api/kyc/schema?accountType=${accountType}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load verification form.');
      setSchema(data.schema);
      setValues(Object.fromEntries(data.schema.sections.flatMap((section: any) => section.fields.filter((field: Field) => field.type !== 'file').map((field: Field) => [field.name, '']))));
      setFiles({});
      setStatus('');
    };
    void loadSchema().catch((error: any) => setStatus(error.message || 'Unable to load verification form.'));
  }, [accountType, entities, entityId]);

  useEffect(() => {
    if (!verificationId) return;
    const poll = async () => {
      const response = await apiFetch(`${apiBaseUrl}/api/kyc/verification-status?verificationId=${encodeURIComponent(verificationId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to read verification status.');
      setStatus(data.message || `Verification status: ${data.status}`);
      if (!['approved', 'rejected'].includes(data.status)) window.setTimeout(() => void poll(), 5000);
    };
    void poll().catch((error: any) => setStatus(error.message || 'Unable to read verification status.'));
  }, [verificationId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schema || !entityId) return;
    setSubmitting(true);
    try {
      const formData: Record<string, string> = {};
      for (const field of schema.sections.flatMap((section) => section.fields)) {
        if (field.type === 'file') {
          const file = files[field.name];
          if (field.required && !file) throw new Error(`Please upload: ${field.label}`);
          if (file) formData[field.name] = await fileToBase64(file);
          continue;
        }
        const value = (values[field.name] || '').trim();
        if (field.required && !value) throw new Error(`Please complete: ${field.label}`);
        if (value) formData[field.name] = value;
      }
      const response = await apiFetch(`${apiBaseUrl}/api/kyc/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, accountType, formData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'KYC submission failed.');
      setVerificationId(data.verificationId);
      setStatus(data.message || 'Verification submitted.');
    } catch (error: any) {
      setStatus(error.message || 'KYC submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const continueOnWeb = async () => {
    setClaimingWeb(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/auth/telegram/web-claim/start`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start web account linking.');
      window.location.assign(data.webUrl);
    } catch (error: any) {
      setStatus(error.message || 'Unable to start web account linking.');
      setClaimingWeb(false);
    }
  };

  if (!schema) return <main style={styles.page}><section style={styles.panel}><h1>Identity verification</h1><p>{status}</p></section></main>;
  return <main style={styles.page}><section style={styles.panel}>
    <h1>{schema.title}</h1><p>{schema.description}</p>
    <button type="button" onClick={() => void continueOnWeb()} disabled={claimingWeb} style={styles.tab}>{claimingWeb ? 'Opening web sign-in…' : 'Add web app access'}</button>
    <div style={styles.tabs}>{(['personal', 'business'] as AccountType[]).map((type) => <button key={type} type="button" onClick={() => setAccountType(type)} style={type === accountType ? styles.activeTab : styles.tab}>{type === 'personal' ? 'Personal' : 'Business'}</button>)}</div>
    <select value={entityId} onChange={(event) => { setEntityId(event.target.value); setActiveEntityId(event.target.value); }} style={styles.input}>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.kind}</option>)}</select>
    <form onSubmit={submit} style={styles.form}>{schema.sections.map((section) => <fieldset key={section.id} style={styles.fieldset}><legend>{section.title}</legend>{section.description && <small>{section.description}</small>}{section.fields.map((field) => <label key={field.name} style={styles.label}>{field.label}{field.help && <small>{field.help}</small>}{field.type === 'file' ? <input type="file" accept={field.accept || 'image/*,.pdf'} required={!!field.required} onChange={(event) => setFiles((current) => ({ ...current, [field.name]: event.target.files?.[0] }))} /> : field.type === 'select' ? <select value={values[field.name] || ''} required={!!field.required} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} style={styles.input}><option value="">Select…</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.type === 'date' ? 'date' : 'text'} value={values[field.name] || ''} required={!!field.required} placeholder={field.placeholder} pattern={field.pattern} maxLength={field.maxLength} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} style={styles.input} />}</label>)}</fieldset>)}<button type="submit" disabled={submitting} style={styles.submit}>{submitting ? 'Submitting…' : 'Submit verification'}</button></form>{status && <p>{status}</p>}
  </section></main>;
};

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', padding: 20, background: '#071512', color: '#effcf7', fontFamily: 'Satoshi, sans-serif' },
  panel: { maxWidth: 720, margin: '0 auto', padding: 20, background: '#0d2722', border: '1px solid #315a50', borderRadius: 12 },
  tabs: { display: 'flex', gap: 8, margin: '18px 0' },
  tab: { padding: '10px 14px', background: '#183b33', color: '#dce9e6', border: 0, borderRadius: 6 },
  activeTab: { padding: '10px 14px', background: '#d6b65a', color: '#071512', border: 0, borderRadius: 6, fontWeight: 700 },
  form: { display: 'grid', gap: 14 },
  fieldset: { display: 'grid', gap: 10, border: '1px solid #315a50', borderRadius: 8, padding: 14 },
  label: { display: 'grid', gap: 5, fontSize: 13 },
  input: { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 6, border: '1px solid #52756c', background: '#071512', color: '#fff' },
  submit: { padding: 12, border: 0, borderRadius: 6, background: '#d6b65a', color: '#071512', fontWeight: 800 },
};
