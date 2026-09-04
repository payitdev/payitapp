import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../apiClient';

interface Props { apiBaseUrl: string; entityId: string; kind: 'PERSONAL' | 'BUSINESS'; }

interface KycSchemaField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  pattern?: string;
  help?: string;
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
  accept?: string;
}

interface KycSchemaSection {
  id: string;
  title: string;
  description?: string;
  fields: KycSchemaField[];
}

interface KycSchemaResponse {
  success: boolean;
  accountType: string;
  provider: string;
  schema: {
    title: string;
    description: string;
    estimatedTimeMinutes: number;
    currenciesSupported: string[];
    sections: KycSchemaSection[];
  };
}

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const normalizeInputs = (schema: KycSchemaResponse['schema']) => {
  const values: Record<string, string> = {};
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.type === 'file') {
        values[field.name] = '';
      } else {
        values[field.name] = '';
      }
    }
  }
  return values;
};

export const NuvionOnboardingForm: React.FC<Props> = ({ apiBaseUrl, entityId, kind }) => {
  const [schema, setSchema] = useState<KycSchemaResponse['schema'] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadSchema = async () => {
      try {
        const accountType = kind === 'PERSONAL' ? 'personal' : 'business';
        const response = await apiFetch(`${apiBaseUrl}/api/kyc/schema?accountType=${accountType}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load KYC form schema.');
        setSchema(data.schema);
        setValues(normalizeInputs(data.schema));
      } catch (error: any) {
        setMessage(error.message || 'Unable to load KYC form schema.');
      } finally {
        setLoading(false);
      }
    };
    loadSchema();
  }, [apiBaseUrl, kind]);

  const fieldEntries = useMemo(() => schema ? schema.sections.flatMap((section) => section.fields.map((field) => ({ ...field, sectionTitle: section.title }))) : [], [schema]);

  const updateValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schema) return;

    setSubmitting(true);
    setMessage('Submitting verification to the provider...');

    try {
      const formData: Record<string, any> = {};

      for (const field of fieldEntries) {
        if (field.type === 'file') {
          const file = files[field.name];
          if (field.required && !file) {
            throw new Error(`Please upload: ${field.label}`);
          }
          if (file) {
            formData[field.name] = await fileToBase64(file);
          }
          continue;
        }

        const value = (values[field.name] || '').trim();
        if (field.required && !value) {
          throw new Error(`Please complete: ${field.label}`);
        }
        if (value) {
          formData[field.name] = value;
        }
      }

      const response = await apiFetch(`${apiBaseUrl}/api/kyc/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          accountType: kind === 'PERSONAL' ? 'personal' : 'business',
          formData,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'KYC verification submission failed.');
      setMessage(data.message || 'KYC verification submitted successfully.');
    } catch (error: any) {
      setMessage(error.message || 'KYC verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ color: '#dce9e6', margin: '18px 0' }}>Loading KYC form…</div>;
  }

  if (!schema) {
    return <div style={{ color: '#fca5a5', margin: '18px 0' }}>{message || 'Unable to load the verification form.'}</div>;
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12, margin: '18px 0', padding: 18, borderRadius: 14, background: '#0b211d', border: '1px solid #315a50' }}>
      <strong style={{ color: '#fff' }}>{schema.title}</strong>
      <div style={{ color: '#9fe3cb', fontSize: 12 }}>{schema.description}</div>
      {schema.sections.map((section) => (
        <div key={section.id} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#f0fdf4', fontWeight: 700, fontSize: 13 }}>{section.title}</div>
          {section.description && <div style={{ color: '#9fb4b0', fontSize: 11 }}>{section.description}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {section.fields.map((field) => {
              if (field.type === 'file') {
                return (
                  <label key={field.name} style={{ display: 'grid', gap: 5, color: '#dce9e6', fontSize: 12 }}>
                    {field.label}
                    <input
                      type="file"
                      accept={field.accept || 'image/*,.pdf'}
                      required={Boolean(field.required)}
                      onChange={(event) => setFiles((current) => ({ ...current, [field.name]: event.target.files?.[0] || null }))}
                    />
                  </label>
                );
              }

              if (field.type === 'select') {
                return (
                  <label key={field.name} style={{ display: 'grid', gap: 5, color: '#dce9e6', fontSize: 12 }}>
                    {field.label}
                    <select
                      value={values[field.name] || ''}
                      required={Boolean(field.required)}
                      onChange={(event) => updateValue(field.name, event.target.value)}
                      style={{ padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff' }}
                    >
                      <option value="">Select…</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                );
              }

              if (field.type === 'textarea') {
                return (
                  <label key={field.name} style={{ display: 'grid', gap: 5, color: '#dce9e6', fontSize: 12, gridColumn: '1 / -1' }}>
                    {field.label}
                    <textarea
                      value={values[field.name] || ''}
                      required={Boolean(field.required)}
                      placeholder={field.placeholder}
                      onChange={(event) => updateValue(field.name, event.target.value)}
                      rows={3}
                      style={{ padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff' }}
                    />
                  </label>
                );
              }

              return (
                <label key={field.name} style={{ display: 'grid', gap: 5, color: '#dce9e6', fontSize: 12 }}>
                  {field.label}
                  <input
                    value={values[field.name] || ''}
                    type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.type === 'date' ? 'date' : 'text'}
                    required={Boolean(field.required)}
                    placeholder={field.placeholder}
                    pattern={field.pattern}
                    maxLength={field.maxLength}
                    onChange={(event) => updateValue(field.name, event.target.value)}
                    style={{ padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff' }}
                  />
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <button type="submit" disabled={submitting} style={{ padding: 11, border: 0, borderRadius: 8, background: '#d6b65a', color: '#061b18', fontWeight: 800, opacity: submitting ? 0.7 : 1 }}>
        {submitting ? 'Submitting…' : 'Submit verification'}
      </button>
      {message && <div style={{ color: '#9fe3cb', fontSize: 13 }}>{message}</div>}
    </form>
  );
};
