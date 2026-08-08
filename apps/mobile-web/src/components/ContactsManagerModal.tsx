import React, { useState, useEffect } from 'react';
import { UniversalIdentityCard, ResolvedIdentity } from './UniversalIdentityCard';
import { apiFetch } from '../apiClient';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

interface ContactItem {
  id: string;
  entityId: string;
  targetEntityId?: string;
  name: string;
  paytag?: string;
  accountNumber?: string;
  bankName?: string;
  type: 'INTERNAL' | 'EXTERNAL';
}

interface Props {
  isOpen: boolean;
  entityId: string;
  onClose: () => void;
  onSelectContactForTransfer?: (contact: ContactItem) => void;
}

export const ContactsManagerModal: React.FC<Props> = ({
  isOpen,
  entityId,
  onClose,
  onSelectContactForTransfer,
}) => {
  const [contactsList, setContactsList] = useState<ContactItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Add Contact Sub-State
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedContact, setResolvedContact] = useState<ResolvedIdentity | null>(null);
  const [resolveError, setResolveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && entityId) {
      fetchContacts();
    }
  }, [isOpen, entityId]);

  if (!isOpen) return null;

  const fetchContacts = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/social/contacts?entityId=${encodeURIComponent(entityId)}`);
      const data = await res.json();
      if (res.ok) {
        setContactsList(data.contacts || []);
      } else {
        setErrorMsg(data.error || 'Failed to fetch contacts');
      }
    } catch {
      setErrorMsg('Network error loading contacts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveContact = async () => {
    if (!addInput.trim()) return;
    setIsResolving(true);
    setResolveError('');
    setResolvedContact(null);

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/users/resolve-identity?query=${encodeURIComponent(addInput.trim())}&entityId=${encodeURIComponent(entityId)}`);
      const data = await res.json();
      if (res.ok && data.found) {
        setResolvedContact(data.identity);
      } else {
        setResolveError(data.message || 'User not found');
      }
    } catch {
      setResolveError('Error resolving PayIT identity');
    } finally {
      setIsResolving(false);
    }
  };

  const handleSaveContact = async () => {
    if (!resolvedContact) return;
    setIsSaving(true);
    setErrorMsg('');

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/social/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityId,
          name: resolvedContact.legalName,
          paytag: resolvedContact.username,
          accountNumber: resolvedContact.accountNumber,
          bankName: resolvedContact.bankName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save contact');
      }

      setIsAddingNew(false);
      setAddInput('');
      setResolvedContact(null);
      fetchContacts();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredContacts = contactsList.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.paytag && c.paytag.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.accountNumber && c.accountNumber.includes(searchQuery))
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(10, 15, 29, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '24px',
        maxWidth: '480px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: '#F8FAFC',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1E293B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Contacts & Beneficiaries</h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: '2px 0 0 0' }}>Saved PayIT contacts and accounts</p>
          </div>
          <button
            onClick={onClose}
            style={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          {errorMsg && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', padding: '12px', color: '#F87171', fontSize: '13px', marginBottom: '16px' }}>
              {errorMsg}
            </div>
          )}

          {!isAddingNew ? (
            <div>
              {/* Search & Add Bar */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, @username, or account #"
                  style={{ flex: 1, backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '12px', color: '#F8FAFC', outline: 'none' }}
                />
                <button
                  onClick={() => setIsAddingNew(true)}
                  style={{ backgroundColor: '#0EA5E9', border: 'none', borderRadius: '12px', padding: '12px 16px', color: '#FFF', fontWeight: '700', cursor: 'pointer' }}
                >
                  + Add
                </button>
              </div>

              {/* Contacts List */}
              {isLoading ? (
                <p style={{ textAlign: 'center', color: '#64748B', fontSize: '14px' }}>Loading contacts...</p>
              ) : filteredContacts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>👤</span>
                  <p style={{ fontSize: '14px', margin: 0 }}>No saved contacts found.</p>
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => {
                      if (onSelectContactForTransfer) {
                        onSelectContactForTransfer(contact);
                        onClose();
                      }
                    }}
                    style={{
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      borderRadius: '16px',
                      padding: '14px 16px',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: onSelectContactForTransfer ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0EA5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#FFF' }}>
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>{contact.name}</h4>
                        <p style={{ fontSize: '12px', color: '#38BDF8', margin: '2px 0 0 0' }}>{contact.paytag || contact.accountNumber}</p>
                      </div>
                    </div>
                    {onSelectContactForTransfer && (
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#0EA5E9' }}>Send / Request →</span>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Add New PayIT Contact</h3>
                <button onClick={() => setIsAddingNew(false)} style={{ backgroundColor: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>Cancel</button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Enter @username or Account Number
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={addInput}
                    onChange={(e) => setAddInput(e.target.value)}
                    placeholder="e.g. @david or 0015640025"
                    style={{ flex: 1, backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '12px', color: '#F8FAFC', outline: 'none' }}
                  />
                  <button
                    onClick={handleResolveContact}
                    disabled={isResolving || !addInput.trim()}
                    style={{ backgroundColor: '#0EA5E9', border: 'none', borderRadius: '12px', padding: '12px 16px', color: '#FFF', fontWeight: '700', cursor: 'pointer' }}
                  >
                    {isResolving ? 'Searching...' : 'Resolve'}
                  </button>
                </div>
                {resolveError && <p style={{ fontSize: '12px', color: '#F87171', marginTop: '6px' }}>{resolveError}</p>}
              </div>

              {resolvedContact && (
                <div>
                  <UniversalIdentityCard identity={resolvedContact} />
                  <button
                    onClick={handleSaveContact}
                    disabled={isSaving}
                    style={{ width: '100%', backgroundColor: '#10B981', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: '700', color: '#FFF', cursor: 'pointer', marginTop: '12px' }}
                  >
                    {isSaving ? 'Saving...' : `Save ${resolvedContact.legalName} to Contacts`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
