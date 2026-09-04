import React from 'react';
import { Home, ArrowUpDown, TrendingUp, Shield, CreditCard, User } from 'lucide-react';

export const HomeIcon: React.FC = () => <Home size={20} strokeWidth={1.7} />;
export const ActivityIcon: React.FC = () => <ArrowUpDown size={20} strokeWidth={1.7} />;
export const InvestIcon: React.FC = () => <TrendingUp size={20} strokeWidth={1.7} />;
export const VaultIcon: React.FC = () => <Shield size={20} strokeWidth={1.7} />;
export const CardsIcon: React.FC = () => <CreditCard size={20} strokeWidth={1.7} />;
export const ProfileIcon: React.FC = () => <User size={20} strokeWidth={1.7} />;
