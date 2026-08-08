import React from 'react';

export interface ResolvedIdentity {
  entityId: string;
  legalName: string;
  username: string;
  businessTag?: string;
  accountNumber?: string;
  bankName?: string;
  solanaAddress?: string;
  relationshipStatus: 'MUTUAL_CONTACT' | 'ONE_WAY_CONTACT' | 'STRANGER';
  isSelf?: boolean;
}

interface Props {
  identity: ResolvedIdentity;
  onSaveContact?: () => void;
  isSavingContact?: boolean;
}

export const UniversalIdentityCard: React.FC<Props> = ({
  identity,
  onSaveContact,
  isSavingContact,
}) => {
  const getBadgeConfig = () => {
    switch (identity.relationshipStatus) {
      case 'MUTUAL_CONTACT':
        return {
          text: 'Mutual Contact',
          bgColor: 'rgba(16, 185, 129, 0.15)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          textColor: '#34D399',
          icon: '🟢',
        };
      case 'ONE_WAY_CONTACT':
        return {
          text: "In Your Contacts (They Haven't Saved You)",
          bgColor: 'rgba(234, 179, 8, 0.15)',
          borderColor: 'rgba(234, 179, 8, 0.3)',
          textColor: '#FDE047',
          icon: '🟡',
        };
      default:
        return {
          text: 'Stranger / Not in Contacts',
          bgColor: 'rgba(239, 68, 68, 0.15)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          textColor: '#F87171',
          icon: '🔴',
        };
    }
  };

  const badge = getBadgeConfig();

  return (
    <div style={{
      backgroundColor: '#1E293B',
      border: '1px solid #334155',
      borderRadius: '20px',
      padding: '20px',
      color: '#F8FAFC',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
      marginTop: '12px',
      marginBottom: '12px',
    }}>
      {/* Identity Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          fontWeight: '700',
          color: '#FFFFFF',
        }}>
          {identity.legalName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#F8FAFC' }}>
              {identity.legalName}
            </h3>
          </div>
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#38BDF8', margin: '2px 0 0 0' }}>
            {identity.username}
          </p>
        </div>
      </div>

      {/* Relationship Status Pill */}
      <div style={{
        backgroundColor: badge.bgColor,
        border: `1px solid ${badge.borderColor}`,
        borderRadius: '10px',
        padding: '8px 12px',
        marginBottom: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px' }}>{badge.icon}</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: badge.textColor }}>
            {badge.text}
          </span>
        </div>
        {identity.relationshipStatus !== 'MUTUAL_CONTACT' && onSaveContact && !identity.isSelf && (
          <button
            type="button"
            onClick={onSaveContact}
            disabled={isSavingContact}
            style={{
              backgroundColor: '#0EA5E9',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: '700',
              color: '#FFFFFF',
              cursor: isSavingContact ? 'not-allowed' : 'pointer',
            }}
          >
            {isSavingContact ? 'Saving...' : '+ Add Contact'}
          </button>
        )}
      </div>

      {/* Account Number Details */}
      <div style={{
        backgroundColor: '#0F172A',
        borderRadius: '12px',
        padding: '12px 14px',
        fontSize: '13px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#64748B' }}>Account Number:</span>
          <span style={{ fontWeight: '700', color: '#F8FAFC', fontFamily: 'monospace' }}>
            {identity.accountNumber || 'Pending Issuance'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748B' }}>Settlement Bank:</span>
          <span style={{ fontWeight: '600', color: '#94A3B8' }}>
            {identity.bankName || 'Nuvion Partner Bank'}
          </span>
        </div>
      </div>
    </div>
  );
};
