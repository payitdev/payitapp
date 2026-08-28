import React, { useState } from 'react';
import { apiFetch } from '../apiClient';

interface Props { apiBaseUrl: string; entityId: string; kind: 'PERSONAL' | 'BUSINESS'; }

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export const NuvionOnboardingForm: React.FC<Props> = ({ apiBaseUrl, entityId, kind }) => {
  const [values, setValues] = useState<Record<string, string>>({ firstName: '', lastName: '', email: '', dob: '', nationality: 'NG', gender: 'm', phone: '', documentNumber: '', country: 'NG', line1: '', city: '', state: '', postalCode: '', legalName: '', registrationNumber: '', industry: '', description: '', incorporationYear: '', incorporationMonth: '' });
  const [identityFile, setIdentityFile] = useState<File>();
  const [addressFile, setAddressFile] = useState<File>();
  const [message, setMessage] = useState('');
  const update = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const input = (key: string, label: string, type = 'text') => <label style={{ display: 'grid', gap: 5, color: '#dce9e6', fontSize: 12 }}>{label}<input required value={values[key] || ''} type={type} onChange={(event) => update(key, event.target.value)} style={{ padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff' }} /></label>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('Submitting information to Nuvion...');
    try {
      const payload = kind === 'PERSONAL' ? { name: `${values.firstName} ${values.lastName}`, person: { first_name: values.firstName, last_name: values.lastName, email: values.email, date_of_birth: values.dob, nationality: values.nationality, gender: values.gender, phonenumber: values.phone, identification: { document: { type: 'international_passport', number: values.documentNumber, issuing_country: values.nationality }, proof_of_address: { type: 'utility_bill' } } }, address: { line_1: values.line1, city: values.city, state: values.state, postal_code: values.postalCode, country_code: values.country } } : { name: values.legalName, business: { legal_name: values.legalName, registration_number: values.registrationNumber, industry: values.industry, email: values.email, type: 'llc', description: values.description, incorporation_meta: { year: Number(values.incorporationYear), month: Number(values.incorporationMonth), country: values.country, state: values.state } }, address: { line_1: values.line1, city: values.city, state: values.state, postal_code: values.postalCode, country_code: values.country }, business_officers: [{ job_title: 'Director', is_control_person: true, is_beneficial_owner: true, ownership_percentage: 100, person: { first_name: values.firstName, last_name: values.lastName, email: values.email, date_of_birth: values.dob, nationality: values.nationality, gender: values.gender, phonenumber: values.phone, identification: { document: { type: 'international_passport', number: values.documentNumber, issuing_country: values.nationality }, proof_of_address: { type: 'utility_bill' } }, address: { line_1: values.line1, city: values.city, state: values.state, postal_code: values.postalCode, country_code: values.country } } }] };
      const createResponse = await apiFetch(`${apiBaseUrl}/api/nuvion/entities/${kind === 'PERSONAL' ? 'individual' : 'business'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityId, payload }) });
      const created = await createResponse.json();
      if (!createResponse.ok) throw new Error(created.error || 'Nuvion entity creation failed');
      if (!identityFile || !addressFile) throw new Error('Both identity and proof-of-address files are required');
      for (const item of [{ file: identityFile, key: 'identity', description: 'Government-issued identity document' }, { file: addressFile, key: 'proof_of_address', description: 'Proof of residential address' }]) {
        const upload = await apiFetch(`${apiBaseUrl}/api/nuvion/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localEntityId: entityId, payload: { key: item.key, description: item.description, file: await fileToBase64(item.file), meta: { file_type: item.file.type }, link_to_identity: created.personId ? { person_id: created.personId } : undefined } }) });
        const uploaded = await upload.json();
        if (!upload.ok) throw new Error(uploaded.error || 'Nuvion document upload failed');
      }
      const review = await apiFetch(`${apiBaseUrl}/api/nuvion/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localEntityId: entityId }) });
      const reviewed = await review.json();
      if (!review.ok) throw new Error(reviewed.error || 'Nuvion review submission failed');
      setMessage('Submitted to Nuvion. Verification is pending.');
    } catch (error: any) { setMessage(error.message || 'Nuvion onboarding failed'); }
  };

  return <form onSubmit={submit} style={{ display: 'grid', gap: 12, margin: '18px 0', padding: 18, borderRadius: 14, background: '#0b211d', border: '1px solid #315a50' }}><strong style={{ color: '#fff' }}>Direct Nuvion {kind === 'PERSONAL' ? 'KYC' : 'KYB'} onboarding</strong><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>{input('firstName', 'First name')}{input('lastName', 'Last name')}{input('email', 'Email', 'email')}{input('dob', 'Date of birth', 'date')}{input('phone', 'Phone')}{input('documentNumber', 'Document number')}{kind === 'BUSINESS' && <>{input('legalName', 'Legal name')}{input('registrationNumber', 'Registration number')}{input('industry', 'Industry')}{input('description', 'Business description')}{input('incorporationYear', 'Incorporation year', 'number')}{input('incorporationMonth', 'Incorporation month', 'number')}</>}{input('line1', 'Address line 1')}{input('city', 'City')}{input('state', 'State')}{input('postalCode', 'Postal code')}</div><label style={{ color: '#dce9e6', fontSize: 12 }}>Identity document<input required type="file" accept="image/*,.pdf" onChange={(event) => setIdentityFile(event.target.files?.[0])} /></label><label style={{ color: '#dce9e6', fontSize: 12 }}>Proof of address<input required type="file" accept="image/*,.pdf" onChange={(event) => setAddressFile(event.target.files?.[0])} /></label><button type="submit" style={{ padding: 11, border: 0, borderRadius: 8, background: '#d6b65a', color: '#061b18', fontWeight: 800 }}>Submit to Nuvion</button>{message && <div style={{ color: '#9fe3cb', fontSize: 13 }}>{message}</div>}</form>;
};
