import React, { useState, useEffect } from 'react';
import { Check, Copy, Download, QrCode, ShieldCheck, CreditCard, Building2, Zap, ArrowLeft } from 'lucide-react';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

interface Props {
  invoiceId: string;
  onBack?: () => void;
}

export const PublicInvoiceCheckout: React.FC<Props> = ({ invoiceId, onBack }) => {
  const [invoice, setInvoice] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRail, setSelectedRail] = useState<'crypto' | 'bank' | 'card'>('crypto');
  const [isSettling, setIsSettling] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicInvoice();
  }, [invoiceId]);

  const fetchPublicInvoice = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/invoices/public/${encodeURIComponent(invoiceId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invoice not found or expired.');
      setInvoice(data.invoice);
      if (data.invoice.status === 'paid') {
        setIsPaid(true);
      }
      if (data.invoice.settlementType === 'fiat') {
        setSelectedRail('bank');
      } else {
        setSelectedRail('crypto');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load invoice details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyToast(`${label} copied to clipboard!`);
    setTimeout(() => setCopyToast(null), 2400);
  };

  const handleSimulatePayment = async (_method: string) => {
    setIsSettling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/invoices/public/${encodeURIComponent(invoiceId)}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: _method,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment confirmation failed.');
      setReceiptData(data);
    } catch (err: any) {
      alert(err.message || 'Payment settlement failed.');
    } finally {
      setIsSettling(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050811', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F7F8F4', fontFamily: "'Satoshi', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, border: '3px solid rgba(53, 217, 208, 0.2)', borderTopColor: '#35D9D0', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: 'rgba(247, 248, 244, 0.7)', fontSize: 14, fontWeight: 600 }}>Loading Secure Proxim Invoice…</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ minHeight: '100vh', background: '#050811', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, color: '#F7F8F4', fontFamily: "'Satoshi', sans-serif" }}>
        <div style={{ maxWidth: 420, width: '100%', background: '#0D1424', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>✕</div>
          <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Invoice Unavailable</h3>
          <p style={{ fontSize: 13, color: 'rgba(247, 248, 244, 0.7)', lineHeight: 1.6, margin: '0 0 24px' }}>{error || 'This invoice may have expired, been cancelled, or the link is invalid.'}</p>
          {onBack && (
            <button onClick={onBack} style={{ background: '#35D9D0', color: '#050811', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', width: '100%' }}>
              Return to App
            </button>
          )}
        </div>
      </div>
    );
  }

  const payData = invoice.paymentData || invoice.paymentDetails || {};
  const isCrypto = invoice.settlementType === 'stablecoin' || payData.mode === 'crypto';
  const cryptoDepositAddress = payData.depositAddress || invoice.merchantEvmAddress || '';
  const bankAccount = payData.accountNumber || '';
  const bankName = payData.bankName || (invoice.currency === 'NGN' ? 'Wema Bank' : 'Banking Circle S.A.');
  const totalAmountFormatted = parseFloat(invoice.totalAmount || '0').toLocaleString('en-US', { minimumFractionDigits: 2 });

  return (
    <div style={{ minHeight: '100vh', background: '#050811', color: '#F7F8F4', fontFamily: "'Satoshi', sans-serif", padding: '24px 16px 60px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 540, width: '100%' }}>
        
        {/* Top Branding & Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onBack && (
              <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#F7F8F4', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <ArrowLeft size={18} />
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#35D9D0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#050811' }}>P</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.5 }}>Proxim</div>
                <div style={{ fontSize: 10, color: 'rgba(247, 248, 244, 0.5)' }}>Financial Enclave</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#35D9D0', background: 'rgba(53, 217, 208, 0.12)', padding: '6px 12px', borderRadius: 999, fontWeight: 700 }}>
            <ShieldCheck size={14} /> 256-Bit Encrypted
          </div>
        </div>

        {/* Invoice Card */}
        <div style={{ background: '#0D1424', border: '1px solid rgba(53, 217, 208, 0.25)', borderRadius: 24, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
          
          {/* Header Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#35D9D0', letterSpacing: 0.5 }}>INVOICE #{invoice.tag}</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Bricolage Grotesque', margin: '4px 0 2px', color: '#ffffff' }}>{invoice.merchantName}</h2>
              <div style={{ fontSize: 12, color: 'rgba(247, 248, 244, 0.6)' }}>Billed to: <strong style={{ color: '#F7F8F4' }}>{invoice.clientName}</strong> ({invoice.clientEmail})</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: isPaid ? 'rgba(34, 197, 94, 0.2)' : 'rgba(251, 191, 36, 0.2)', color: isPaid ? '#4ADE80' : '#FBBF24', textTransform: 'uppercase' }}>
                {isPaid ? 'PAID & SETTLED' : invoice.status?.toUpperCase() || 'DUE'}
              </span>
              <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.5)', marginTop: 6 }}>Due: {invoice.dueDate}</div>
            </div>
          </div>

          {/* Amount Box */}
          <div style={{ background: 'rgba(5, 8, 17, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(247, 248, 244, 0.6)', textTransform: 'uppercase' }}>Total Amount Due</div>
            <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'Bricolage Grotesque', color: '#35D9D0', margin: '4px 0 0' }}>
              {invoice.currency} {totalAmountFormatted}
            </div>
            {invoice.items && invoice.items.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {invoice.items.map((it: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(247, 248, 244, 0.8)' }}>
                    <span>{it.description} <span style={{ color: 'rgba(247, 248, 244, 0.4)' }}>(x{it.quantity})</span></span>
                    <strong style={{ color: '#F7F8F4' }}>${parseFloat(it.amount || '0').toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isPaid ? (
            /* Paid Success Screen */
            <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 18, padding: 24, textAlign: 'center' }}>
              <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#22C55E', color: '#050811', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Check size={28} strokeWidth={3} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', color: '#ffffff' }}>Payment Completed</h3>
              <p style={{ fontSize: 13, color: 'rgba(247, 248, 244, 0.7)', margin: '0 0 16px', lineHeight: 1.5 }}>
                This invoice has been settled in full. The merchant has received instant notification and accounting clearance.
              </p>
              {receiptData?.receiptRef && (
                <div style={{ fontSize: 11, color: '#4ADE80', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: 8, display: 'inline-block', marginBottom: 16 }}>
                  Receipt: {receiptData.receiptRef}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={() => window.print()}
                  style={{ background: '#35D9D0', color: '#050811', border: 'none', padding: '10px 20px', borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={15} /> Download PDF Receipt
                </button>
              </div>
            </div>
          ) : (
            /* Payment Rails Selector */
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(247, 248, 244, 0.7)', marginBottom: 10 }}>Select Payment Method</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
                <button
                  type="button"
                  onClick={() => setSelectedRail('crypto')}
                  style={{
                    padding: '12px 6px',
                    borderRadius: 14,
                    border: selectedRail === 'crypto' ? '1px solid #35D9D0' : '1px solid rgba(255,255,255,0.1)',
                    background: selectedRail === 'crypto' ? 'rgba(53, 217, 208, 0.15)' : 'rgba(255,255,255,0.04)',
                    color: selectedRail === 'crypto' ? '#35D9D0' : '#ffffff',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Zap size={18} />
                  <span>Stablecoin</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRail('bank')}
                  style={{
                    padding: '12px 6px',
                    borderRadius: 14,
                    border: selectedRail === 'bank' ? '1px solid #35D9D0' : '1px solid rgba(255,255,255,0.1)',
                    background: selectedRail === 'bank' ? 'rgba(53, 217, 208, 0.15)' : 'rgba(255,255,255,0.04)',
                    color: selectedRail === 'bank' ? '#35D9D0' : '#ffffff',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Building2 size={18} />
                  <span>Bank Wire</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRail('card')}
                  style={{
                    padding: '12px 6px',
                    borderRadius: 14,
                    border: selectedRail === 'card' ? '1px solid #35D9D0' : '1px solid rgba(255,255,255,0.1)',
                    background: selectedRail === 'card' ? 'rgba(53, 217, 208, 0.15)' : 'rgba(255,255,255,0.04)',
                    color: selectedRail === 'card' ? '#35D9D0' : '#ffffff',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <CreditCard size={18} />
                  <span>Card / Mobile</span>
                </button>
              </div>

              {/* Rail Content: Crypto */}
              {selectedRail === 'crypto' && (
                <div style={{ background: 'rgba(5, 8, 17, 0.85)', border: '1px solid rgba(53, 217, 208, 0.2)', borderRadius: 16, padding: 18, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#35D9D0' }}>⚡ NEAR MPC Multi-Chain Enclave</div>
                    <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                      {payData.network || 'Base'} ({payData.asset || 'USDC'})
                    </span>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.6)', marginBottom: 4 }}>Deposit Address:</div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{cryptoDepositAddress || 'Address unavailable'}</span>
                      {cryptoDepositAddress && (
                        <button
                          type="button"
                          onClick={() => handleCopy(cryptoDepositAddress, 'Deposit Address')}
                          style={{ marginLeft: 8, background: '#35D9D0', border: 'none', color: '#050811', padding: '6px 12px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Copy size={13} /> Copy
                        </button>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.5)', margin: '0 0 16px', lineHeight: 1.4 }}>
                    Send exactly <strong style={{ color: '#ffffff' }}>${totalAmountFormatted} {payData.asset || 'USDC'}</strong> on <strong style={{ color: '#ffffff' }}>{payData.network || 'Base'}</strong>. Auto-reconciliation will instantly clear the invoice upon receipt.
                  </p>

                  <button
                    type="button"
                    disabled={isSettling}
                    onClick={() => handleSimulatePayment('1-Click Web3 Stablecoin Settlement')}
                    style={{ width: '100%', padding: '14px', borderRadius: 12, background: '#35D9D0', color: '#050811', border: 'none', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}
                  >
                    {isSettling ? 'Confirming Payment on Enclave…' : '✓ I Have Sent This Payment / Settle Now'}
                  </button>
                </div>
              )}

              {/* Rail Content: Bank Wire */}
              {selectedRail === 'bank' && (
                <div style={{ background: 'rgba(5, 8, 17, 0.85)', border: '1px solid rgba(53, 217, 208, 0.2)', borderRadius: 16, padding: 18, marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#35D9D0', marginBottom: 12 }}>🏦 Dedicated Business Bank Account</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(247, 248, 244, 0.6)' }}>Bank Name:</span>
                      <strong style={{ color: '#ffffff' }}>{bankName}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'rgba(247, 248, 244, 0.6)' }}>Account Number:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong style={{ color: '#ffffff' }}>{bankAccount || 'Virtual Account in KYC Setup'}</strong>
                        {bankAccount && (
                          <button
                            type="button"
                            onClick={() => handleCopy(bankAccount, 'Account Number')}
                            style={{ background: '#35D9D0', border: 'none', color: '#050811', padding: '4px 8px', borderRadius: 6, fontWeight: 800, fontSize: 11, cursor: 'pointer' }}
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(247, 248, 244, 0.6)' }}>Account Name:</span>
                      <strong style={{ color: '#ffffff' }}>{payData.accountHolderName || invoice.merchantName}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(247, 248, 244, 0.6)' }}>Payment Reference:</span>
                      <strong style={{ color: '#35D9D0', fontFamily: 'monospace' }}>{invoice.tag}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isSettling}
                    onClick={() => handleSimulatePayment('Direct Bank Transfer')}
                    style={{ width: '100%', padding: '14px', borderRadius: 12, background: '#35D9D0', color: '#050811', border: 'none', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}
                  >
                    {isSettling ? 'Confirming Wire Transfer…' : '✓ Confirm Bank Transfer Payment'}
                  </button>
                </div>
              )}

              {/* Rail Content: Card / Mobile Money */}
              {selectedRail === 'card' && (
                <div style={{ background: 'rgba(5, 8, 17, 0.85)', border: '1px solid rgba(53, 217, 208, 0.2)', borderRadius: 16, padding: 18, marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#35D9D0', marginBottom: 12 }}>💳 Instant Card & Mobile Money Gateway</div>
                  <p style={{ fontSize: 13, color: 'rgba(247, 248, 244, 0.7)', lineHeight: 1.5, margin: '0 0 16px' }}>
                    Pay securely using Visa, Mastercard, Apple Pay, or MPesa mobile money via Brails payment rails.
                  </p>

                  <button
                    type="button"
                    disabled={isSettling}
                    onClick={() => handleSimulatePayment('Online Card / Mobile Money Payment')}
                    style={{ width: '100%', padding: '14px', borderRadius: 12, background: '#35D9D0', color: '#050811', border: 'none', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}
                  >
                    {isSettling ? 'Processing Online Checkout…' : `Pay ${invoice.currency} ${totalAmountFormatted} with Card`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer Print / Download Button */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'rgba(247, 248, 244, 0.5)' }}>
            <span>Powered by Proxim Enclave</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE_URL}/api/invoices/${invoice.id}/export`);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Invoice-${invoice.tag || 'Proxim'}.svg`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    setCopyToast('Invoice image downloaded!');
                    setTimeout(() => setCopyToast(null), 2400);
                  } catch {
                    alert('Unable to download invoice image.');
                  }
                }}
                style={{ background: 'transparent', border: 'none', color: '#35D9D0', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Download size={13} /> Save as Image
              </button>
              <button onClick={() => window.print()} style={{ background: 'transparent', border: 'none', color: '#35D9D0', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Download size={13} /> Print PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Copy Feedback Toast */}
      {copyToast && (
        <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: '#35D9D0', color: '#050811', padding: '10px 20px', borderRadius: 12, fontWeight: 800, fontSize: 12, zIndex: 9999, boxShadow: '0 4px 20px rgba(53, 217, 208, 0.4)' }}>
          {copyToast}
        </div>
      )}
    </div>
  );
};
