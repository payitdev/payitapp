import React, { useState } from 'react';
import { apiFetch } from '../apiClient';
import { ShieldCheck, ArrowRight, ArrowLeft, Upload, Check, AlertCircle, Building2, User, FileText, CheckCircle2 } from 'lucide-react';

interface Props {
  apiBaseUrl: string;
  entityId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const NuvionOnboardingWizard: React.FC<Props> = ({ apiBaseUrl, entityId, onSuccess, onCancel }) => {
  const [step, setStep] = useState<number>(1);
  const [accountType, setAccountType] = useState<'individual' | 'business'>('individual');

  // Personal / Individual Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('NG');
  const [gender, setGender] = useState<'m' | 'f'>('m');
  const [phone, setPhone] = useState('+234');
  const [idSubtype, setIdSubtype] = useState<'BVN' | 'NIN' | 'SSN' | 'NONE'>('BVN');
  const [idSubtypeValue, setIdSubtypeValue] = useState('');
  const [docType, setDocType] = useState<'international_passport' | 'drivers_license' | 'national_id'>('international_passport');
  const [docNumber, setDocNumber] = useState('');
  const [docAuthority, setDocAuthority] = useState('');

  // Business Form State
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [industry, setIndustry] = useState('Technology');
  const [businessType, setBusinessType] = useState<'llc' | 'corporation' | 'partnership' | 'sole_proprietorship'>('llc');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('+234');
  const [regNumber, setRegNumber] = useState('');
  const [description, setDescription] = useState('');
  const [incYear, setIncYear] = useState('2022');
  const [incMonth, setIncMonth] = useState('1');
  const [incCountry, setIncCountry] = useState('NG');
  const [incState, setIncState] = useState('Lagos');

  // Address Form State
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [countryCode, setCountryCode] = useState('NG');

  // Document Uploads State
  const [idFile, setIdFile] = useState<File | null>(null);
  const [addressFile, setAddressFile] = useState<File | null>(null);
  const [certIncFile, setCertIncFile] = useState<File | null>(null);
  const [memAssocFile, setMemAssocFile] = useState<File | null>(null);

  // Status & Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (!idFile || !addressFile) {
        throw new Error('Please upload both your identity document and proof of address.');
      }
      if (accountType === 'business' && (!certIncFile || !memAssocFile)) {
        throw new Error('Please upload certificate of incorporation and memorandum of association.');
      }

      // Step 1: Create Entity
      let createdEntityId = '';
      let createdPersonId = '';

      if (accountType === 'individual') {
        const payload = {
          name: `${firstName} ${lastName}`.trim(),
          person: {
            first_name: firstName,
            last_name: lastName,
            middle_name: middleName || undefined,
            date_of_birth: dob,
            email,
            nationality,
            gender,
            phonenumber: phone,
            bvn: idSubtype === 'BVN' ? idSubtypeValue : undefined,
            nin: idSubtype === 'NIN' ? idSubtypeValue : undefined,
            ssn: idSubtype === 'SSN' ? idSubtypeValue : undefined,
          },
          address: {
            line_1: line1,
            line_2: line2 || undefined,
            city,
            state,
            postal_code: postalCode,
            country_code: countryCode,
          },
          identification: {
            document: {
              type: docType,
              number: docNumber,
              issuing_country: nationality,
              issuing_authority: docAuthority || `${nationality} Government Authority`,
              type_specific: idSubtype !== 'NONE' ? { id_subtype: idSubtype } : undefined,
            },
            proof_of_address: {
              type: 'utility_bill',
            },
          },
        };

        const res = await apiFetch(`${apiBaseUrl}/api/nuvion/entities/individual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityId, payload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create personal entity.');
        createdEntityId = data.entityId;
        createdPersonId = data.personId;
      } else {
        const payload = {
          name: legalName,
          business: {
            legal_name: legalName,
            trade_name: tradeName || undefined,
            industry,
            email: businessEmail || email,
            phonenumber: businessPhone || phone,
            type: businessType,
            description: description || `${legalName} financial operations`,
            registration_number: regNumber,
            incorporation_meta: {
              year: Number(incYear),
              month: Number(incMonth),
              country: incCountry,
              state: incState,
            },
          },
          address: {
            line_1: line1,
            line_2: line2 || undefined,
            city,
            state,
            postal_code: postalCode,
            country_code: countryCode,
          },
          business_officers: [
            {
              job_title: 'Director',
              is_control_person: true,
              is_beneficial_owner: true,
              ownership_percentage: 100,
              person: {
                first_name: firstName,
                last_name: lastName,
                date_of_birth: dob,
                email,
                nationality,
                gender,
                phonenumber: phone,
                bvn: idSubtype === 'BVN' ? idSubtypeValue : undefined,
                nin: idSubtype === 'NIN' ? idSubtypeValue : undefined,
                ssn: idSubtype === 'SSN' ? idSubtypeValue : undefined,
                identification: {
                  document: {
                    type: docType,
                    number: docNumber,
                    issuing_country: nationality,
                    issuing_authority: docAuthority || `${nationality} Government Authority`,
                  },
                  proof_of_address: { type: 'utility_bill' },
                },
                address: {
                  line_1: line1,
                  city,
                  state,
                  postal_code: postalCode,
                  country_code: countryCode,
                },
              },
            },
          ],
        };

        const res = await apiFetch(`${apiBaseUrl}/api/nuvion/entities/business`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityId, payload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create business entity.');
        createdEntityId = data.entityId;
        createdPersonId = data.personId;
      }

      // Step 2: Upload Documents
      const uploads = [
        { file: idFile, key: 'identity', desc: 'Government-issued ID' },
        { file: addressFile, key: 'proof_of_address', desc: 'Proof of residential address' },
      ];

      if (accountType === 'business') {
        if (certIncFile) uploads.push({ file: certIncFile, key: 'certificate_of_incorporation', desc: 'Certificate of Incorporation' });
        if (memAssocFile) uploads.push({ file: memAssocFile, key: 'memorandum_of_association', desc: 'Memorandum of Association' });
      }

      for (const item of uploads) {
        const base64 = await fileToBase64(item.file);
        const docRes = await apiFetch(`${apiBaseUrl}/api/nuvion/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            localEntityId: entityId,
            payload: {
              key: item.key,
              description: item.desc,
              file: base64,
              meta: { file_type: item.file.type || 'application/pdf' },
              link_to_identity: createdPersonId ? { person_id: createdPersonId } : undefined,
            },
          }),
        });
        const docData = await docRes.json();
        if (!docRes.ok) throw new Error(docData.error || `Failed to upload ${item.desc}`);
      }

      // Step 3: Submit for verification
      const reviewRes = await apiFetch(`${apiBaseUrl}/api/nuvion/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localEntityId: entityId }),
      });
      const reviewData = await reviewRes.json();
      if (!reviewRes.ok) throw new Error(reviewData.error || 'Failed to submit verification.');

      setIsCompleted(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during verification submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <div style={{ padding: 24, borderRadius: 20, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
        <CheckCircle2 size={48} color="#7ee2c3" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ color: '#fff', margin: '0 0 8px' }}>Verification Submitted</h3>
        <p style={{ color: '#9fb4b0', fontSize: 14, margin: '0 0 20px', lineHeight: 1.6 }}>
          Your verification documents have been received. We will notify you as soon as your accounts are ready.
        </p>
        <button
          type="button"
          onClick={onSuccess || onCancel}
          style={{ padding: '12px 24px', borderRadius: 12, background: '#d6b65a', color: '#061b18', fontWeight: 700, border: 0, cursor: 'pointer' }}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, borderRadius: 20, background: '#0a1a17', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <span style={{ color: '#d6b65a', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>
            Identity Verification
          </span>
          <h2 style={{ color: '#fff', margin: '4px 0 0', fontSize: 20 }}>
            {accountType === 'individual' ? 'Personal Account Setup' : 'Business Account Setup'}
          </h2>
        </div>
        <div style={{ color: '#7ee2c3', fontSize: 13, fontWeight: 600 }}>Step {step} of 4</div>
      </div>

      {errorMessage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, background: 'rgba(255, 85, 85, 0.15)', border: '1px solid rgba(255, 85, 85, 0.3)', color: '#ff7b72', fontSize: 13, marginBottom: 16 }}>
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step 1: Account Type Selection */}
      {step === 1 && (
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ color: '#9fb4b0', fontSize: 14, margin: 0 }}>
            Select the type of account you would like to open with Proxim.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <button
              type="button"
              onClick={() => setAccountType('individual')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: 16,
                borderRadius: 14,
                border: accountType === 'individual' ? '2px solid #7ee2c3' : '1px solid rgba(255,255,255,0.1)',
                background: accountType === 'individual' ? 'rgba(126, 226, 195, 0.1)' : 'rgba(0,0,0,0.2)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <User size={24} color={accountType === 'individual' ? '#7ee2c3' : '#9fb4b0'} style={{ marginBottom: 10 }} />
              <strong style={{ color: '#fff', fontSize: 15 }}>Personal Account</strong>
              <span style={{ color: '#9fb4b0', fontSize: 12, marginTop: 4 }}>For individuals sending, receiving and managing personal funds.</span>
            </button>

            <button
              type="button"
              onClick={() => setAccountType('business')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: 16,
                borderRadius: 14,
                border: accountType === 'business' ? '2px solid #7ee2c3' : '1px solid rgba(255,255,255,0.1)',
                background: accountType === 'business' ? 'rgba(126, 226, 195, 0.1)' : 'rgba(0,0,0,0.2)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Building2 size={24} color={accountType === 'business' ? '#7ee2c3' : '#9fb4b0'} style={{ marginBottom: 10 }} />
              <strong style={{ color: '#fff', fontSize: 15 }}>Business Account</strong>
              <span style={{ color: '#9fb4b0', fontSize: 12, marginTop: 4 }}>For registered companies, partnerships, and sole proprietors.</span>
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 10, background: '#d6b65a', color: '#061b18', fontWeight: 700, border: 0, cursor: 'pointer' }}
            >
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Information */}
      {step === 2 && (
        <div style={{ display: 'grid', gap: 14 }}>
          {accountType === 'business' && (
            <div style={{ padding: 14, borderRadius: 12, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 10 }}>
              <strong style={{ color: '#7ee2c3', fontSize: 13 }}>Business Information</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ color: '#dce9e6', fontSize: 12 }}>Legal Company Name *
                  <input value={legalName} onChange={(e) => setLegalName(e.target.value)} required placeholder="Acme Ltd" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
                </label>
                <label style={{ color: '#dce9e6', fontSize: 12 }}>Registration Number (RC) *
                  <input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} required placeholder="RC1234567" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ color: '#dce9e6', fontSize: 12 }}>Industry *
                  <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Technology" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
                </label>
                <label style={{ color: '#dce9e6', fontSize: 12 }}>Business Type *
                  <select value={businessType} onChange={(e: any) => setBusinessType(e.target.value)} style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }}>
                    <option value="llc">LLC / Limited Company</option>
                    <option value="corporation">Corporation</option>
                    <option value="sole_proprietorship">Sole Proprietorship</option>
                    <option value="partnership">Partnership</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          <div style={{ padding: 14, borderRadius: 12, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 10 }}>
            <strong style={{ color: '#7ee2c3', fontSize: 13 }}>
              {accountType === 'business' ? 'Authorized Director / Officer Details' : 'Personal Details'}
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>First Name *
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="John" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>Last Name *
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Doe" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>Email Address *
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="john@example.com" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>Phone Number (+Country) *
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+2348012345678" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>Date of Birth *
                <input value={dob} onChange={(e) => setDob(e.target.value)} type="date" required style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>Nationality *
                <select value={nationality} onChange={(e) => setNationality(e.target.value)} style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }}>
                  <option value="NG">Nigeria (NG)</option>
                  <option value="KE">Kenya (KE)</option>
                  <option value="TZ">Tanzania (TZ)</option>
                  <option value="GH">Ghana (GH)</option>
                  <option value="UG">Uganda (UG)</option>
                  <option value="ZA">South Africa (ZA)</option>
                  <option value="US">United States (US)</option>
                  <option value="GB">United Kingdom (GB)</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>Identifier Type
                <select value={idSubtype} onChange={(e: any) => setIdSubtype(e.target.value)} style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }}>
                  <option value="BVN">BVN (Bank Verification Number)</option>
                  <option value="NIN">NIN (National ID Number)</option>
                  <option value="SSN">SSN (Social Security Number)</option>
                  <option value="NONE">None</option>
                </select>
              </label>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>Identifier Value
                <input value={idSubtypeValue} onChange={(e) => setIdSubtypeValue(e.target.value)} placeholder="22334455667" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <button type="button" onClick={() => setStep(1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, background: 'transparent', color: '#9fb4b0', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
              <ArrowLeft size={16} /> Back
            </button>
            <button type="button" onClick={() => setStep(3)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 10, background: '#d6b65a', color: '#061b18', fontWeight: 700, border: 0, cursor: 'pointer' }}>
              Address Details <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Address */}
      {step === 3 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ padding: 14, borderRadius: 12, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 10 }}>
            <strong style={{ color: '#7ee2c3', fontSize: 13 }}>Address Information</strong>
            <label style={{ color: '#dce9e6', fontSize: 12 }}>Street Address Line 1 *
              <input value={line1} onChange={(e) => setLine1(e.target.value)} required placeholder="123 Marina Street" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
            </label>
            <label style={{ color: '#dce9e6', fontSize: 12 }}>Street Address Line 2 (Optional)
              <input value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Suite 4B" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>City *
                <input value={city} onChange={(e) => setCity(e.target.value)} required placeholder="Lagos" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>State / Province *
                <input value={state} onChange={(e) => setState(e.target.value)} required placeholder="Lagos State" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>Postal / ZIP Code *
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} required placeholder="100001" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>Country *
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }}>
                  <option value="NG">Nigeria (NG)</option>
                  <option value="KE">Kenya (KE)</option>
                  <option value="TZ">Tanzania (TZ)</option>
                  <option value="GH">Ghana (GH)</option>
                  <option value="UG">Uganda (UG)</option>
                  <option value="ZA">South Africa (ZA)</option>
                  <option value="US">United States (US)</option>
                  <option value="GB">United Kingdom (GB)</option>
                </select>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <button type="button" onClick={() => setStep(2)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, background: 'transparent', color: '#9fb4b0', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
              <ArrowLeft size={16} /> Back
            </button>
            <button type="button" onClick={() => setStep(4)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 10, background: '#d6b65a', color: '#061b18', fontWeight: 700, border: 0, cursor: 'pointer' }}>
              Upload Documents <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Documents & Submit */}
      {step === 4 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ padding: 14, borderRadius: 12, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 12 }}>
            <strong style={{ color: '#7ee2c3', fontSize: 13 }}>Identity Document Details</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>Document Type *
                <select value={docType} onChange={(e: any) => setDocType(e.target.value)} style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }}>
                  <option value="international_passport">International Passport</option>
                  <option value="drivers_license">Driver's License</option>
                  <option value="national_id">National ID Card</option>
                </select>
              </label>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>Document Number *
                <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} required placeholder="A12345678" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 6 }}>
              <label style={{ color: '#dce9e6', fontSize: 12, display: 'grid', gap: 4 }}>
                Upload Government ID (PDF/Image) *
                <input type="file" accept="image/*,.pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)} style={{ padding: 6, borderRadius: 8, background: '#071512', color: '#fff', border: '1px solid #38534f' }} />
                {idFile && <span style={{ color: '#7ee2c3', fontSize: 11 }}>Selected: {idFile.name}</span>}
              </label>
              <label style={{ color: '#dce9e6', fontSize: 12, display: 'grid', gap: 4 }}>
                Upload Proof of Address (Utility/Bank) *
                <input type="file" accept="image/*,.pdf" onChange={(e) => setAddressFile(e.target.files?.[0] || null)} style={{ padding: 6, borderRadius: 8, background: '#071512', color: '#fff', border: '1px solid #38534f' }} />
                {addressFile && <span style={{ color: '#7ee2c3', fontSize: 11 }}>Selected: {addressFile.name}</span>}
              </label>
            </div>

            {accountType === 'business' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 6, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <label style={{ color: '#dce9e6', fontSize: 12, display: 'grid', gap: 4 }}>
                  Certificate of Incorporation (PDF) *
                  <input type="file" accept=".pdf,image/*" onChange={(e) => setCertIncFile(e.target.files?.[0] || null)} style={{ padding: 6, borderRadius: 8, background: '#071512', color: '#fff', border: '1px solid #38534f' }} />
                  {certIncFile && <span style={{ color: '#7ee2c3', fontSize: 11 }}>Selected: {certIncFile.name}</span>}
                </label>
                <label style={{ color: '#dce9e6', fontSize: 12, display: 'grid', gap: 4 }}>
                  Memorandum of Association (PDF) *
                  <input type="file" accept=".pdf,image/*" onChange={(e) => setMemAssocFile(e.target.files?.[0] || null)} style={{ padding: 6, borderRadius: 8, background: '#071512', color: '#fff', border: '1px solid #38534f' }} />
                  {memAssocFile && <span style={{ color: '#7ee2c3', fontSize: 11 }}>Selected: {memAssocFile.name}</span>}
                </label>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <button type="button" onClick={() => setStep(3)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, background: 'transparent', color: '#9fb4b0', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 24px',
                borderRadius: 10,
                background: isSubmitting ? '#9fb4b0' : '#d6b65a',
                color: '#061b18',
                fontWeight: 800,
                border: 0,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Verification'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
