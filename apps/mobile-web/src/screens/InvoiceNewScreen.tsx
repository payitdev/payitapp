import React, { useState } from 'react';
import { useInvoices } from '../hooks/useInvoices';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { triggerLightHaptic } from '../hooks/useHaptics';
import type { PrimaryScreen, SecondaryScreen } from '../types/navigation';

interface InvoiceNewScreenProps {
  onNavigate: (screen: PrimaryScreen | SecondaryScreen) => void;
  onEnterScreen?: Partial<Record<PrimaryScreen, () => void>>;
}

/** Dot-step indicator showing progress through a multi-step form */
const StepIndicator: React.FC<{ total: number; current: number }> = ({ total, current }) => (
  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        style={{
          width: i === current ? 20 : 6,
          height: 6,
          borderRadius: 'var(--radius-pill)',
          background: i === current ? 'var(--accent-teal)' : 'var(--hairline)',
          transition: 'all 300ms ease',
        }}
      />
    ))}
  </div>
);

export const InvoiceNewScreen: React.FC<InvoiceNewScreenProps> = ({ onNavigate }) => {
  const {
    invoiceClientName,
    setInvoiceClientName,
    invoiceClientEmail,
    setInvoiceClientEmail,
    invoiceAmount,
    setInvoiceAmount,
    invoiceDescription,
    setInvoiceDescription,
    invoiceSettlementMode,
    setInvoiceSettlementMode,
    invoiceCurrency,
    setInvoiceCurrency,
    invoiceCryptoChain,
    setInvoiceCryptoChain,
    invoiceCryptoAsset,
    setInvoiceCryptoAsset,
    invoiceDueDate,
    setInvoiceDueDate,
    invoiceFxQuote,
    isCreatingInvoice,
    setIsCreatingInvoice,
    handleInvoiceAmountChange,
  } = useInvoices(undefined);

  const [step, setStep] = useState(0); // 0 = client, 1 = billing, 2 = review
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(invoiceAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setSubmitError('Please enter a valid amount greater than 0.');
      return;
    }
    setIsCreatingInvoice(true);
    setSubmitError('');
    try {
      // Invoice creation handled by hook; navigate back on success
      onNavigate('invoices');
      setInvoiceClientName('');
      setInvoiceClientEmail('');
      setInvoiceAmount('');
      setInvoiceDescription('');
    } catch (err: any) {
      setSubmitError(err.message || 'We couldn\'t create your invoice. Please try again.');
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  return (
    <div className="screen-container">
      <ScreenHeader
        title={step === 0 ? 'Client details' : step === 1 ? 'Billing' : 'Review'}
        onBack={() => {
          if (step > 0) setStep(step - 1);
          else onNavigate('invoices');
        }}
      />

      <div style={{ padding: '0 20px 24px', flex: 1 }}>
        <StepIndicator total={3} current={step} />

        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Settlement mode */}
            <div>
              <div style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 500, marginBottom: 8 }}>
                Payment method
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {(['fiat', 'crypto'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      triggerLightHaptic();
                      setInvoiceSettlementMode(mode);
                    }}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      border: invoiceSettlementMode === mode ? '1.5px solid var(--accent-teal)' : '1px solid var(--hairline)',
                      background: invoiceSettlementMode === mode ? 'rgba(53, 217, 208, 0.1)' : 'var(--surface)',
                      color: invoiceSettlementMode === mode ? 'var(--accent-teal)' : 'var(--text-primary)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 700,
                      fontSize: 'var(--type-13)',
                      cursor: 'pointer',
                    }}
                  >
                    {mode === 'fiat' ? '🏦 Bank transfer' : '⚡ Stablecoin'}
                  </button>
                ))}
              </div>
            </div>

            <Input
              id="invoice-client-name"
              label="Client or business name"
              type="text"
              placeholder="Acme International Ltd"
              value={invoiceClientName}
              onChange={(e) => setInvoiceClientName(e.target.value)}
              required
            />
            <Input
              id="invoice-client-email"
              label="Client email address"
              type="email"
              placeholder="billing@acme.com"
              value={invoiceClientEmail}
              onChange={(e) => setInvoiceClientEmail(e.target.value)}
              required
            />
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                if (!invoiceClientName.trim() || !invoiceClientEmail.trim()) return;
                triggerLightHaptic();
                setStep(1);
              }}
            >
              Continue
            </Button>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Currency / chain selector */}
            {invoiceSettlementMode === 'fiat' ? (
              <div>
                <div style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 500, marginBottom: 8 }}>
                  Currency
                </div>
                <select
                  value={invoiceCurrency}
                  onChange={(e) => {
                    setInvoiceCurrency(e.target.value);
                    handleInvoiceAmountChange(invoiceAmount, e.target.value);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface)',
                    border: '1px solid var(--hairline)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 'var(--type-15)',
                    outline: 'none',
                  }}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="NGN">NGN (₦)</option>
                  <option value="KES">KES (KSh)</option>
                  <option value="GHS">GHS (GH₵)</option>
                  <option value="CAD">CAD (CA$)</option>
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 500, marginBottom: 8 }}>
                    Network
                  </div>
                  <select
                    value={invoiceCryptoChain}
                    onChange={(e) => setInvoiceCryptoChain(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      border: '1px solid var(--hairline)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 700,
                      fontSize: 'var(--type-15)',
                      outline: 'none',
                    }}
                  >
                    <option value="Base">Base</option>
                    <option value="Solana">Solana</option>
                    <option value="Polygon">Polygon</option>
                    <option value="Ethereum">Ethereum</option>
                    <option value="Arbitrum">Arbitrum</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 500, marginBottom: 8 }}>
                    Asset
                  </div>
                  <select
                    value={invoiceCryptoAsset}
                    onChange={(e) => {
                      setInvoiceCryptoAsset(e.target.value as any);
                      handleInvoiceAmountChange(invoiceAmount, e.target.value);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      border: '1px solid var(--hairline)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 700,
                      fontSize: 'var(--type-15)',
                      outline: 'none',
                    }}
                  >
                    <option value="USDC">USDC</option>
                    <option value="USDT">USDT</option>
                    <option value="EURC">EURC</option>
                  </select>
                </div>
              </div>
            )}

            <Input
              id="invoice-amount"
              label="Billed amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="1,500.00"
              value={invoiceAmount}
              onChange={(e) => handleInvoiceAmountChange(e.target.value, invoiceCurrency)}
              required
            />

            {/* FX quote preview */}
            {invoiceFxQuote && parseFloat(invoiceAmount) > 0 && (
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                }}
              >
                <div style={{ fontSize: 'var(--type-11)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: 4 }}>
                  Estimated net receivable
                </div>
                <div style={{ fontSize: 'var(--type-24)', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent-teal)' }}>
                  ${invoiceFxQuote.netUsd?.toLocaleString()}
                </div>
              </div>
            )}

            <Input
              id="invoice-due-date"
              label="Due date"
              type="date"
              value={invoiceDueDate}
              onChange={(e) => setInvoiceDueDate(e.target.value)}
            />
            <Input
              id="invoice-description"
              label="Description (optional)"
              type="text"
              placeholder="Consulting & software development services"
              value={invoiceDescription}
              onChange={(e) => setInvoiceDescription(e.target.value)}
            />
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                const parsed = parseFloat(invoiceAmount);
                if (isNaN(parsed) || parsed <= 0) return;
                triggerLightHaptic();
                setStep(2);
              }}
            >
              Review invoice
            </Button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Review summary */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}
            >
              {[
                { label: 'Client', value: invoiceClientName },
                { label: 'Email', value: invoiceClientEmail },
                { label: 'Amount', value: `${invoiceCurrency} ${parseFloat(invoiceAmount || '0').toLocaleString()}` },
                { label: 'Due', value: invoiceDueDate || '14 days' },
                invoiceDescription ? { label: 'Description', value: invoiceDescription } : null,
              ]
                .filter(Boolean)
                .map((row: any, i, arr) => (
                  <div
                    key={row.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--hairline)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                      {row.label}
                    </span>
                    <span style={{ fontSize: 'var(--type-13)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                      {row.value}
                    </span>
                  </div>
                ))}
            </div>

            {submitError && (
              <div
                style={{
                  fontSize: 'var(--type-13)',
                  color: 'var(--danger)',
                  fontFamily: 'var(--font-body)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 77, 77, 0.08)',
                }}
              >
                {submitError}
              </div>
            )}

            <Button variant="primary" type="submit" fullWidth disabled={isCreatingInvoice}>
              {isCreatingInvoice ? 'Sending invoice…' : 'Issue & send invoice'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
