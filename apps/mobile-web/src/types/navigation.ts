/**
 * Proxim navigation types.
 */

export type PrimaryScreen =
  | 'home'
  | 'activity'
  | 'stocks'
  | 'savings'
  | 'cards'
  | 'profile';

export type SecondaryScreen =
  | 'requests'
  | 'invoices'
  | 'invoice-new'
  | 'payroll'
  | 'payroll-new';

export type OnboardingScreen =
  | 'launch'
  | 'welcome'
  | 'auth'
  | 'kyc-intro'
  | 'kyc-form'
  | 'kyc-pending';

export type Screen = PrimaryScreen | SecondaryScreen | OnboardingScreen;

export const PRIMARY_SCREENS: readonly PrimaryScreen[] = [
  'home',
  'activity',
  'stocks',
  'savings',
  'cards',
  'profile',
];

export const SECONDARY_SCREENS: readonly SecondaryScreen[] = [
  'requests',
  'invoices',
  'invoice-new',
  'payroll',
  'payroll-new',
];
