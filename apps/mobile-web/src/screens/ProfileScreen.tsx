import React, { useState } from 'react';
import { useAccount, getLegalDisplayName, getLegalFirstName } from '../context/AccountContext';
import { BottomNav } from '../components/layout/BottomNav';
import { ListRow } from '../components/ListRow';
import { Chip } from '../components/Chip';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { TelegramManagerModal } from '../components/TelegramManagerModal';
import { triggerLightHaptic } from '../hooks/useHaptics';
import type { PrimaryScreen } from '../types/navigation';

interface ProfileScreenProps {
  onNavigate: (screen: PrimaryScreen) => void;
  onEnterScreen?: Partial<Record<PrimaryScreen, () => void>>;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onNavigate, onEnterScreen }) => {
  const {
    accountType,
    activeEntity,
    currentUser,
    kycStatus,
    kycTier,
    toggleAccountMode,
    handleLogout,
  } = useAccount();

  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('NGN');

  const displayName = getLegalDisplayName(activeEntity, currentUser);
  const initial = (displayName.charAt(0) || 'P').toUpperCase();

  const getKycChip = () => {
    if (kycStatus === 'approved') {
      return <Chip tone="success">Verified</Chip>;
    }
    if (kycStatus === 'pending') {
      return <Chip tone="warning">In review</Chip>;
    }
    return <Chip tone="neutral">Unverified</Chip>;
  };

  return (
    <div className="screen-container">
      {/* Top bar with plain title (24px Bricolage) */}
      <div style={{ padding: '20px 20px 16px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--type-24)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.3px',
          }}
        >
          Profile
        </div>
      </div>

      <div style={{ padding: '0 20px 24px', flex: 1 }}>
        {/* Top: Avatar + Name + Account Type Chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 0 24px',
            borderBottom: '1px solid var(--hairline)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--type-20)',
              fontWeight: 800,
              color: 'var(--accent-teal)',
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--type-20)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: 'var(--type-13)',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {currentUser?.email || currentUser?.phone || 'Personal account'}
            </div>
          </div>
          <Chip tone={accountType === 'PERSONAL' ? 'teal' : 'neutral'}>
            {accountType === 'PERSONAL' ? 'Personal' : 'Business'}
          </Chip>
        </div>

        {/* Section: Account */}
        <div style={{ marginTop: '24px' }}>
          <div
            style={{
              fontSize: 'var(--type-11)',
              fontWeight: 700,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              marginBottom: '4px',
              textTransform: 'none',
            }}
          >
            Account
          </div>
          <ListRow
            title="Security & PIN"
            meta="Manage transaction authorization PIN"
            showChevron
            onClick={() => {
              triggerLightHaptic();
              setShowSecurityModal(true);
            }}
          />
          <ListRow
            title="Identity verification"
            meta={
              kycStatus === 'approved'
                ? `Tier ${kycTier} · Naira bank accounts active`
                : kycStatus === 'pending'
                ? 'Verification documents in review'
                : 'Complete verification to unlock banking features'
            }
            statusChip={getKycChip()}
            showChevron
            onClick={() => {
              triggerLightHaptic();
            }}
          />
          <ListRow
            title="Account type"
            meta={accountType === 'PERSONAL' ? 'Personal account active' : 'Business treasury active'}
            statusChip={
              <Chip tone="neutral" onClick={toggleAccountMode}>
                Switch
              </Chip>
            }
            showChevron
            onClick={() => {
              triggerLightHaptic();
              toggleAccountMode();
            }}
          />
        </div>

        {/* Section: Preferences */}
        <div style={{ marginTop: '24px' }}>
          <div
            style={{
              fontSize: 'var(--type-11)',
              fontWeight: 700,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              marginBottom: '4px',
              textTransform: 'none',
            }}
          >
            Preferences
          </div>
          <ListRow
            title="Default currency"
            meta={`${selectedCurrency} · Primary balance display`}
            showChevron
            onClick={() => {
              triggerLightHaptic();
              setShowCurrencyModal(true);
            }}
          />
          <ListRow
            title="Account switch"
            meta={`Switch to ${accountType === 'PERSONAL' ? 'Business mode' : 'Personal mode'}`}
            showChevron
            onClick={() => {
              triggerLightHaptic();
              toggleAccountMode();
            }}
          />
          <ListRow
            title="Telegram bot"
            meta="Manage connected Telegram account"
            showChevron
            onClick={() => {
              triggerLightHaptic();
              setShowTelegramModal(true);
            }}
          />
        </div>

        {/* Section: Support */}
        <div style={{ marginTop: '24px' }}>
          <div
            style={{
              fontSize: 'var(--type-11)',
              fontWeight: 700,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              marginBottom: '4px',
              textTransform: 'none',
            }}
          >
            Support
          </div>
          <ListRow
            title="Help center"
            meta="Answers to common questions and support channels"
            showChevron
            onClick={() => {
              triggerLightHaptic();
              window.open('https://t.me/proximsupport', '_blank');
            }}
          />
          <ListRow
            title="Terms of service"
            meta="Legal terms, privacy, and compliance policies"
            showChevron
            onClick={() => {
              triggerLightHaptic();
            }}
          />
        </div>

        {/* Log out row separated by 24px */}
        <div style={{ marginTop: '32px' }}>
          <button
            onClick={async () => {
              triggerLightHaptic();
              if (handleLogout) await handleLogout();
            }}
            style={{
              width: '100%',
              padding: '16px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              color: 'var(--danger)',
              fontSize: 'var(--type-15)',
              fontWeight: 700,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              outline: 'none',
              textAlign: 'center',
            }}
          >
            Log out
          </button>
        </div>
      </div>

      {/* Security Sheet */}
      <Sheet isOpen={showSecurityModal} onClose={() => setShowSecurityModal(false)} title="Security & PIN">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'var(--font-body)' }}>
          <div style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Your 6-digit security PIN protects all financial transactions and sensitive actions.
          </div>
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              triggerLightHaptic();
              setShowSecurityModal(false);
            }}
          >
            Change security PIN
          </Button>
        </div>
      </Sheet>

      {/* Currency Picker Sheet */}
      <Sheet isOpen={showCurrencyModal} onClose={() => setShowCurrencyModal(false)} title="Select primary currency">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(['NGN', 'USD', 'EUR', 'GBP'] as const).map((curr) => (
            <div
              key={curr}
              onClick={() => {
                triggerLightHaptic();
                setSelectedCurrency(curr);
                setShowCurrencyModal(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: 'var(--radius-sm)',
                background: selectedCurrency === curr ? 'rgba(53, 217, 208, 0.1)' : 'var(--surface)',
                border: selectedCurrency === curr ? '1.5px solid var(--accent-teal)' : '1px solid var(--hairline)',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--type-15)',
                  fontWeight: 700,
                  color: selectedCurrency === curr ? 'var(--accent-teal)' : 'var(--text-primary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {curr}
              </span>
              {selectedCurrency === curr && <Chip tone="teal">Selected</Chip>}
            </div>
          ))}
        </div>
      </Sheet>

      {/* Floating Bottom Nav */}
      <TelegramManagerModal isOpen={showTelegramModal} onClose={() => setShowTelegramModal(false)} />
      <BottomNav active="profile" onNavigate={onNavigate} onEnterScreen={onEnterScreen} />
    </div>
  );
};
