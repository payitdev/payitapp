import React, { useEffect, useState } from 'react';
import { apiFetch } from '../apiClient';
import { Plus, ArrowUpRight, ArrowDownLeft, CreditCard, PiggyBank, Copy, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { NuvionOnboardingWizard } from './NuvionOnboardingWizard';
import { NuvionFundingModal } from './NuvionFundingModal';
import { NuvionPayoutModal } from './NuvionPayoutModal';
import { NuvionCardHub } from './NuvionCardHub';
import { NuvionSavingsHub } from './NuvionSavingsHub';

interface NuvionHubProps {
  apiBaseUrl: string;
  entityId?: string;
}

export const NuvionHub: React.FC<NuvionHubProps> = ({ apiBaseUrl, entityId }) => {
  const [entityStatus, setEntityStatus] = useState<string>('incomplete');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [accountDetails, setAccountDetails] = useState<any[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'accounts' | 'cards' | 'savings'>('accounts');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [status, setStatus] = useState('');

  const loadData = async () => {
    if (!entityId) return;
    const query = encodeURIComponent(entityId);

    try {
      const [entityRes, accountRes, detailsRes] = await Promise.all([
        apiFetch(`${apiBaseUrl}/api/nuvion/entity?entityId=${query}`).then((r) => r.json()).catch(() => ({})),
        apiFetch(`${apiBaseUrl}/api/nuvion/accounts?entityId=${query}`).then((r) => r.json()).catch(() => ({})),
        apiFetch(`${apiBaseUrl}/api/nuvion/account-details?entityId=${query}`).then((r) => r.json()).catch(() => ({})),
      ]);

      const currentStatus = entityRes.entity?.status || 'incomplete';
      setEntityStatus(currentStatus);

      const accs = accountRes.success ? accountRes.accounts || [] : [];
      setAccounts(accs);
      if (accs.length > 0 && !selectedAccount) {
        setSelectedAccount(accs[0]);
      }

      const dets = detailsRes.success ? detailsRes.accountDetails || [] : [];
      setAccountDetails(dets);
    } catch {
      setStatus('Nuvion data is temporarily unavailable.');
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl, entityId]);

  const provisionCoordinates = async (account: any) => {
    if (!entityId) return;
    setSelectedAccount(account);
    setStatus('Requesting account coordinates...');

    try {
      const isCrypto = account.currency === 'USC' || account.currency === 'UST';
      const response = await apiFetch(`${apiBaseUrl}/api/nuvion/account-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localEntityId: entityId,
          accountRecordId: account.id,
          chain: isCrypto ? 'base' : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to provision coordinates.');

      setSelectedDetails(data.accountDetails);
      setStatus(data.accountDetails?.status === 'active' ? '' : 'Account coordinates are being provisioned.');
      await loadData();
    } catch (err: any) {
      setStatus(err.message || 'Unable to provision coordinates.');
    }
  };

  const handleCopy = async (key: string, value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  if (!entityId) return null;

  // If entity is incomplete / pending, show onboarding wizard / status
  if (entityStatus !== 'approved') {
    return (
      <section style={{ margin: '20px 0', padding: 24, borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <span style={{ color: '#d6b65a', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>
              Banking Verification
            </span>
            <h3 style={{ color: '#fff', margin: '4px 0 0', fontSize: 20 }}>Complete Identity Verification</h3>
          </div>
          <span style={{ color: entityStatus === 'pending' ? '#f6c177' : '#7ee2c3', fontSize: 12, padding: '4px 10px', borderRadius: 12, background: 'rgba(0,0,0,0.3)' }}>
            Status: {entityStatus.charAt(0).toUpperCase() + entityStatus.slice(1)}
          </span>
        </div>

        {entityStatus === 'pending' ? (
          <div style={{ textAlign: 'center', padding: '24px 12px' }}>
            <ShieldCheck size={44} color="#7ee2c3" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ color: '#fff', margin: '0 0 6px' }}>Verification In Progress</h4>
            <p style={{ color: '#9fb4b0', fontSize: 14, margin: '0 auto 16px', maxWidth: 400, lineHeight: 1.6 }}>
              Your identity documents are under review. Account details and payment limits will activate automatically upon completion.
            </p>
          </div>
        ) : (
          <NuvionOnboardingWizard apiBaseUrl={apiBaseUrl} entityId={entityId} onSuccess={loadData} />
        )}
      </section>
    );
  }

  const activeDetails =
    selectedDetails ||
    accountDetails.find((d) => d.accountId === selectedAccount?.accountId);

  return (
    <section style={{ margin: '20px 0', padding: 24, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
      {/* Top Bar with Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div>
          <span style={{ color: '#d6b65a', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>
            Global Multi-Currency Banking
          </span>
          <h3 style={{ color: '#fff', margin: '4px 0 0', fontSize: 20 }}>Your Accounts & Rails</h3>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 0,
              background: activeTab === 'accounts' ? '#d6b65a' : 'transparent',
              color: activeTab === 'accounts' ? '#061b18' : '#9fb4b0',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Accounts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cards')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 0,
              background: activeTab === 'cards' ? '#d6b65a' : 'transparent',
              color: activeTab === 'cards' ? '#061b18' : '#9fb4b0',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('savings')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 0,
              background: activeTab === 'savings' ? '#d6b65a' : 'transparent',
              color: activeTab === 'savings' ? '#061b18' : '#9fb4b0',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Savings
          </button>
        </div>
      </div>

      {status && <div style={{ color: '#f6c177', fontSize: 13, marginBottom: 12 }}>{status}</div>}

      {/* Main Tab Views */}
      {activeTab === 'accounts' && (
        <div style={{ display: 'grid', gap: 18 }}>
          {/* Quick Actions Row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowFundingModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 12,
                background: '#d6b65a',
                color: '#061b18',
                fontWeight: 700,
                border: 0,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <ArrowDownLeft size={16} /> Add Money
            </button>

            <button
              type="button"
              onClick={() => setShowPayoutModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontWeight: 700,
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <ArrowUpRight size={16} /> Send Payout
            </button>
          </div>

          {/* Accounts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {accounts.map((account) => {
              const isSelected = selectedAccount?.id === account.id;
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => provisionCoordinates(account)}
                  style={{
                    textAlign: 'left',
                    padding: 16,
                    borderRadius: 14,
                    color: '#fff',
                    background: isSelected ? 'rgba(126,226,195,0.18)' : 'rgba(0,0,0,0.25)',
                    border: isSelected ? '2px solid #7ee2c3' : '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: 16 }}>{account.currency}</strong>
                    <span style={{ fontSize: 11, color: '#d6b65a', textTransform: 'uppercase' }}>{account.type}</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: '#9fb4b0' }}>{account.displayName}</div>
                  <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    Available: {account.balanceAvailableMinor || '0'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Coordinates & Details for Selected Account */}
          {activeDetails ? (
            <div style={{ padding: 16, borderRadius: 14, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#7ee2c3', fontSize: 13 }}>
                  {activeDetails.currency || selectedAccount?.currency} Receiving Coordinates
                </strong>
                <span style={{ fontSize: 11, color: activeDetails.status === 'active' ? '#7ee2c3' : '#f6c177' }}>
                  {activeDetails.status === 'active' ? 'Active' : 'Provisioning'}
                </span>
              </div>

              {activeDetails.chain === 'base' || activeDetails.assetType === 'stablecoin' ? (
                <div>
                  <div style={{ color: '#9fb4b0', fontSize: 11 }}>USDC Receiving Wallet (Base)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontFamily: 'monospace', color: '#fff', fontSize: 13, wordBreak: 'break-all' }}>
                      {activeDetails.accountNumber || activeDetails.account_number}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('base', activeDetails.accountNumber || activeDetails.account_number)}
                      style={{ background: 'transparent', border: 0, color: '#7ee2c3', cursor: 'pointer' }}
                    >
                      {copiedKey === 'base' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  {(activeDetails.accountNumber || activeDetails.account_number) && (
                    <div>
                      <div style={{ color: '#9fb4b0', fontSize: 11 }}>Account Number</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, color: '#fff', fontWeight: 600 }}>
                        {activeDetails.accountNumber || activeDetails.account_number}
                        <button
                          type="button"
                          onClick={() => handleCopy('acc', activeDetails.accountNumber || activeDetails.account_number)}
                          style={{ background: 'transparent', border: 0, color: '#7ee2c3', cursor: 'pointer' }}
                        >
                          {copiedKey === 'acc' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {(activeDetails.routingNumber || activeDetails.routing_number) && (
                    <div>
                      <div style={{ color: '#9fb4b0', fontSize: 11 }}>Routing / Bank Code</div>
                      <div style={{ color: '#fff', fontWeight: 600, marginTop: 2 }}>
                        {activeDetails.routingNumber || activeDetails.routing_number}
                      </div>
                    </div>
                  )}

                  {activeDetails.iban && (
                    <div>
                      <div style={{ color: '#9fb4b0', fontSize: 11 }}>IBAN</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, color: '#fff', fontWeight: 600 }}>
                        {activeDetails.iban}
                        <button
                          type="button"
                          onClick={() => handleCopy('iban', activeDetails.iban)}
                          style={{ background: 'transparent', border: 0, color: '#7ee2c3', cursor: 'pointer' }}
                        >
                          {copiedKey === 'iban' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeDetails.issuer?.name && (
                    <div>
                      <div style={{ color: '#9fb4b0', fontSize: 11 }}>Bank Provider</div>
                      <div style={{ color: '#fff', fontWeight: 600, marginTop: 2 }}>{activeDetails.issuer.name}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            selectedAccount && (
              <button
                type="button"
                onClick={() => provisionCoordinates(selectedAccount)}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px dashed rgba(255,255,255,0.2)',
                  color: '#7ee2c3',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Provision Receiving Coordinates for {selectedAccount.currency}
              </button>
            )
          )}
        </div>
      )}

      {/* Cards Tab */}
      {activeTab === 'cards' && <NuvionCardHub apiBaseUrl={apiBaseUrl} entityId={entityId} accounts={accounts} />}

      {/* Savings Tab */}
      {activeTab === 'savings' && <NuvionSavingsHub apiBaseUrl={apiBaseUrl} entityId={entityId} accounts={accounts} />}

      {/* Funding Modal (On-Ramp) */}
      {showFundingModal && (
        <NuvionFundingModal
          apiBaseUrl={apiBaseUrl}
          entityId={entityId}
          accounts={accounts}
          onClose={() => setShowFundingModal(false)}
          onSuccess={loadData}
        />
      )}

      {/* Payout Modal (Off-Ramp) */}
      {showPayoutModal && (
        <NuvionPayoutModal
          apiBaseUrl={apiBaseUrl}
          entityId={entityId}
          accounts={accounts}
          onClose={() => setShowPayoutModal(false)}
          onSuccess={loadData}
        />
      )}
    </section>
  );
};
