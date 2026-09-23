import React, { useState } from 'react';
import { usePayroll } from '../hooks/usePayroll';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { triggerLightHaptic } from '../hooks/useHaptics';
import type { PrimaryScreen, SecondaryScreen } from '../types/navigation';

interface PayrollNewScreenProps {
  onNavigate: (screen: PrimaryScreen | SecondaryScreen) => void;
  onEnterScreen?: Partial<Record<PrimaryScreen, () => void>>;
}

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

export const PayrollNewScreen: React.FC<PayrollNewScreenProps> = ({ onNavigate }) => {
  const { fetchPayroll } = usePayroll(undefined);

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Form state
  const [payrollTitle, setPayrollTitle] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [totalAmount, setTotalAmount] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(totalAmount);
    const count = parseInt(employeeCount);
    if (isNaN(amount) || amount <= 0) {
      setSubmitError('Please enter a valid total amount.');
      return;
    }
    if (isNaN(count) || count < 1) {
      setSubmitError('Please enter the number of team members.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await fetch('/api/payroll/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: payrollTitle, totalAmount: amount, currency, employeeCount: count }),
      });
      onNavigate('payroll');
    } catch (err: any) {
      setSubmitError(err.message || 'We couldn\'t complete the payroll run. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="screen-container">
      <ScreenHeader
        title={step === 0 ? 'Payroll details' : 'Review'}
        onBack={() => {
          if (step > 0) setStep(step - 1);
          else onNavigate('payroll');
        }}
      />

      <div style={{ padding: '0 20px 24px', flex: 1 }}>
        <StepIndicator total={2} current={step} />

        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Input
              id="payroll-title"
              label="Payroll batch title"
              type="text"
              placeholder="July 2026 Engineering team"
              value={payrollTitle}
              onChange={(e) => setPayrollTitle(e.target.value)}
              required
            />

            {/* Currency */}
            <div>
              <div style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 500, marginBottom: 8 }}>
                Currency
              </div>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
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
                <option value="NGN">NGN (₦)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>

            <Input
              id="payroll-amount"
              label="Total batch amount"
              type="number"
              step="0.01"
              min="1"
              placeholder="450,000.00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
            />
            <Input
              id="payroll-employee-count"
              label="Number of team members"
              type="number"
              min="1"
              placeholder="5"
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
              required
            />
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                if (!payrollTitle.trim() || !totalAmount || !employeeCount) return;
                triggerLightHaptic();
                setStep(1);
              }}
            >
              Review payroll
            </Button>
          </div>
        )}

        {step === 1 && (
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
                { label: 'Batch title', value: payrollTitle },
                { label: 'Currency', value: currency },
                { label: 'Total amount', value: `${currency} ${parseFloat(totalAmount || '0').toLocaleString()}` },
                { label: 'Recipients', value: `${employeeCount} team members` },
              ].map((row, i, arr) => (
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

            <Button variant="primary" type="submit" fullWidth disabled={isSubmitting}>
              {isSubmitting ? 'Sending salaries…' : 'Disburse payroll'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
