import React, { createContext, useContext, useState, useCallback } from 'react';
import { setActiveEntityId } from '../apiClient';

export type AccountType = 'PERSONAL' | 'BUSINESS';
export type KycStatus = 'unverified' | 'pending' | 'approved';

export interface UserEntity {
  id: string;
  legalName?: string;
  firstName?: string;
  [key: string]: unknown;
}

export interface AccountState {
  accountType: AccountType;
  activeEntity: UserEntity | null;
  currentUser: any;
  kycStatus: KycStatus;
  kycTier: number;
  toggleAccountMode: () => void;
  setAccountType?: (type: AccountType) => void;
  setActiveEntity?: (entity: UserEntity | null) => void;
  setCurrentUser?: (user: any) => void;
  setKycStatus?: (status: KycStatus) => void;
  setKycTier?: (tier: number) => void;
  handleLogout?: () => Promise<void>;
  restoreSession?: () => Promise<void>;
}

const AccountContext = createContext<AccountState | undefined>(undefined);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accountType, setAccountType] = useState<AccountType>('PERSONAL');
  const [activeEntity, setActiveEntity] = useState<UserEntity | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [kycStatus, setKycStatus] = useState<KycStatus>('unverified');
  const [kycTier, setKycTier] = useState(0);

  const toggleAccountMode = useCallback(() => {
    setAccountType((prev) => (prev === 'PERSONAL' ? 'BUSINESS' : 'PERSONAL'));
  }, []);

  const handleLogout = useCallback(async () => {
    // Clear stored session data
    localStorage.removeItem('proxim_auth_token');
    localStorage.removeItem('proxim_session_token');
    localStorage.removeItem('payit_auth_token');
    setActiveEntityId(null);
    setCurrentUser(null);
    setActiveEntity(null);
  }, []);

  const restoreSession = useCallback(async () => {
    // Ported in Step 7
  }, []);

  return (
    <AccountContext.Provider
      value={{
        accountType,
        activeEntity,
        currentUser,
        kycStatus,
        kycTier,
        toggleAccountMode,
        setAccountType,
        setActiveEntity,
        setCurrentUser,
        setKycStatus,
        setKycTier,
        handleLogout,
        restoreSession,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = (): AccountState => {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within an AccountProvider');
  return ctx;
};

/** Robust legal-name display helpers handling Privy user shapes and email objects safely. */
export const getLegalDisplayName = (entity?: UserEntity | null, user?: any): string => {
  if (entity?.legalName && typeof entity.legalName === 'string' && !entity.legalName.toLowerCase().startsWith('proxim') && !entity.legalName.includes('@') && entity.legalName.toLowerCase() !== 'test') {
    return entity.legalName;
  }
  if (user?.fullName && typeof user.fullName === 'string' && !user.fullName.toLowerCase().startsWith('proxim') && !user.fullName.includes('@')) {
    return user.fullName;
  }
  if (user?.name && typeof user.name === 'string' && !user.name.toLowerCase().startsWith('proxim') && !user.name.includes('@')) {
    return user.name;
  }
  if (user?.google?.name && typeof user.google.name === 'string') {
    return user.google.name;
  }

  let email = '';
  if (typeof user?.email === 'string') {
    email = user.email;
  } else if (user?.email?.address && typeof user.email.address === 'string') {
    email = user.email.address;
  } else if (user?.google?.email && typeof user.google.email === 'string') {
    email = user.google.email;
  } else if (user?.apple?.email && typeof user.apple.email === 'string') {
    email = user.apple.email;
  } else if (entity?.username && typeof entity.username === 'string') {
    email = entity.username;
  }

  if (email && email.includes('@')) {
    const handle = email.split('@')[0];
    const parts = handle.split(/[._-]/).filter(Boolean);
    if (parts.length > 0) {
      return parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return handle;
  }

  if (user?.wallet?.address && typeof user.wallet.address === 'string') {
    return `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`;
  }

  return 'Valued Client';
};

export const getLegalFirstName = (entity?: UserEntity | null, user?: any): string => {
  const full = getLegalDisplayName(entity, user);
  if (full === 'Valued Client') return 'there';
  return full.split(' ')[0] || 'there';
};
