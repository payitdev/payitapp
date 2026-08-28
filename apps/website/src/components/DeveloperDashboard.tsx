import React, { useState, useEffect } from 'react';
import {
  Key,
  Webhook,
  Shield,
  Activity,
  UserCheck,
  Terminal,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Send,
  Zap,
  Lock,
  Eye,
  EyeOff,
  Clock,
  ArrowRight,
  Sparkles,
  Search,
  ExternalLink,
  ChevronRight,
  Play,
  Layers,
  Building2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Server,
  Code2,
  DollarSign,
} from 'lucide-react';

interface DeveloperDashboardProps {
  onBackToHome: () => void;
  onOpenDocs: () => void;
  appUrl?: string;
}

export const DeveloperDashboard: React.FC<DeveloperDashboardProps> = ({
  onBackToHome,
  onOpenDocs,
  appUrl = 'https://app.proximfi.xyz/',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'kyc' | 'keys' | 'webhooks' | 'explorer' | 'logs' | 'billing'>('overview');
  const apiBaseUrl = 'http://localhost:4000';
  const entityId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('entityId') || '' : '';
  const [dataError, setDataError] = useState<string | null>(null);

  // Billing & Plan State
  const [billingPlan, setBillingPlan] = useState<'PAY_AS_YOU_GO' | 'MODULAR_SAAS'>('PAY_AS_YOU_GO');
  const [selectedModules, setSelectedModules] = useState<string[]>(['DYNAMIC_ACCOUNTS', 'BATCH_PAYOUTS']);
  const [monthlyVolumeUsd, setMonthlyVolumeUsd] = useState(150000);
  const [billingSaveSuccess, setBillingSaveSuccess] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<'live' | 'test'>('test');

  // Copied helper
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // KYC State
  const [kycType, setKycType] = useState<'bvn' | 'nin'>('bvn');
  const [kycValue, setKycValue] = useState('');
  const [kycLoading, setKycLoading] = useState(false);
  const [kycResult, setKycResult] = useState<any>(null);
  const [livenessLoading, setLivenessLoading] = useState(false);
  const [livenessSession, setLivenessSession] = useState<any>(null);
  const [livenessResult, setLivenessResult] = useState<any>(null);
  const [kycVerified, setKycVerified] = useState(false);

  // API Keys State
  const [keys, setKeys] = useState<any[]>([]);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState<'live' | 'test'>('test');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['invoices:all', 'wallets:all', 'payouts:all', 'reports:all']);
  const [createdSecretKey, setCreatedSecretKey] = useState<string | null>(null);

  // Webhook State
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [showNewWebhookModal, setShowNewWebhookModal] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([
    'invoice.paid',
    'payout.completed',
    'deposit.detected',
    'account.deposit.completed',
  ]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<any[]>([]);
  const [testPingLoading, setTestPingLoading] = useState(false);

  // API Explorer State
  const [explorerEndpoint, setExplorerEndpoint] = useState<'dynamic_account' | 'resolve_account' | 'derive_wallet' | 'sub_ledger'>('dynamic_account');
  const [explorerPayload, setExplorerPayload] = useState<string>(
    JSON.stringify({ customerId: 'user_948201', amount: 25000, currency: 'NGN', customerName: 'John Doe', expiresInMinutes: 30 }, null, 2)
  );
  const [explorerResponse, setExplorerResponse] = useState<any>(null);
  const [explorerLoading, setExplorerLoading] = useState(false);

  // Telemetry Logs
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!entityId) {
      setDataError('Open the developer console with an authenticated entityId to load live data.');
      return;
    }
    const query = `?entityId=${encodeURIComponent(entityId)}`;
    Promise.all([
      fetch(`${apiBaseUrl}/api/developer/keys${query}`).then(response => response.json()),
      fetch(`${apiBaseUrl}/api/developer/webhooks${query}`).then(response => response.json()),
      fetch(`${apiBaseUrl}/api/developer/webhooks/deliveries${query}`).then(response => response.json()),
      fetch(`${apiBaseUrl}/api/developer/logs${query}`).then(response => response.json()),
    ]).then(([keyData, webhookData, deliveryData, logData]) => {
      setKeys(keyData.success ? keyData.keys : []);
      setWebhooks(webhookData.success ? webhookData.endpoints : []);
      setWebhookDeliveries(deliveryData.success ? deliveryData.deliveries : []);
      setLogs(logData.success ? logData.logs : []);
      if (![keyData, webhookData, deliveryData, logData].every(data => data.success)) setDataError('Some live developer data could not be loaded.');
    }).catch(() => setDataError('Live developer data is unavailable.'));
  }, [entityId]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Run KYC Verification
  const handleVerifyKyc = async () => {
    if (!kycValue.trim()) return;
    setKycLoading(true);
    setKycResult(null);

    try {
      const res = await fetch(`${apiBaseUrl}/v1/identity/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer px_test_sk_YOUR_SECRET_KEY',
        },
        body: JSON.stringify({
          customerId: 'dev_user_001',
          type: kycType,
          value: kycValue.trim(),
        }),
      });
      const data = await res.json();
      setKycResult(data);
      if (data.success) {
        setKycVerified(true);
      }
    } catch (err: any) {
      setKycResult({ success: false, error: 'Identity verification service is unavailable.' });
    } finally {
      setKycLoading(false);
    }
  };

  // Start 3D Liveness
  const handleStartLiveness = async () => {
    setLivenessLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/v1/identity/liveness/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer px_test_sk_YOUR_SECRET_KEY',
        },
        body: JSON.stringify({
          customerId: 'dev_user_001',
        }),
      });
      const data = await res.json();
      setLivenessSession(data.data || null);
    } catch {
      setLivenessSession(null);
    } finally {
      setLivenessLoading(false);
    }
  };

  // Create Key
  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    if (!entityId) return;
    const response = await fetch(`${apiBaseUrl}/api/developer/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityId, name: newKeyName.trim(), environment: newKeyEnv, scopes: newKeyScopes }) });
    const data = await response.json();
    if (data.success) { setCreatedSecretKey(data.apiKey.secretKey); setKeys([data.apiKey, ...keys]); }
    setNewKeyName('');
  };

  // Register Webhook
  const handleRegisterWebhook = async () => {
    if (!newWebhookUrl.trim()) return;
    if (!entityId) return;
    const response = await fetch(`${apiBaseUrl}/api/developer/webhooks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityId, url: newWebhookUrl.trim(), events: newWebhookEvents }) });
    const data = await response.json();
    if (data.success) setWebhooks([data.endpoint, ...webhooks]);
    setNewWebhookUrl('');
    setShowNewWebhookModal(false);
  };

  // Test Ping Webhook
  const handleTestPing = async () => {
    setTestPingLoading(true);
    if (!entityId) { setTestPingLoading(false); return; }
    try {
      const response = await fetch(`${apiBaseUrl}/api/developer/webhooks/test-ping`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityId, event: 'invoice.paid' }) });
      const data = await response.json();
      if (data.success) setWebhookDeliveries([{ id: `test_${Date.now()}`, event: 'invoice.paid', status: 'QUEUED', createdAt: new Date().toISOString(), payload: JSON.stringify(data.testData) }, ...webhookDeliveries]);
    } finally { setTestPingLoading(false); }
  };

  // Run Explorer
  const handleRunExplorer = async () => {
    setExplorerLoading(true);
    setExplorerResponse(null);

    let endpointUrl = `${apiBaseUrl}/v1/accounts/dynamic-session`;
    let method = 'POST';

    if (explorerEndpoint === 'resolve_account') {
      endpointUrl = `${apiBaseUrl}/v1/payouts/resolve-account`;
    } else if (explorerEndpoint === 'derive_wallet') {
      endpointUrl = `${apiBaseUrl}/v1/wallets/derive`;
    } else if (explorerEndpoint === 'sub_ledger') {
      endpointUrl = `${apiBaseUrl}/v1/ledger/sub-accounts/${encodeURIComponent(entityId)}?currency=NGN`;
      method = 'GET';
    }

    try {
      const res = await fetch(endpointUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer px_test_sk_YOUR_SECRET_KEY',
        },
        body: method === 'POST' ? explorerPayload : undefined,
      });
      const data = await res.json();
      setExplorerResponse(data);
    } catch (err: any) {
      setExplorerResponse({ success: false, endpoint: endpointUrl, error: 'Live API request failed.' });
    } finally {
      setExplorerLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060B14] text-[#F7F8F4] font-sans antialiased">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-[#060B14]/95 backdrop-blur-2xl border-b border-white/10 px-6 sm:px-10 h-16 sm:h-20 flex items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-2.5 text-white hover:text-[#35D9D0] transition-colors font-extrabold text-lg sm:text-xl"
          >
            <img src="/proxim-icon.png" alt="Proxim" className="w-7 h-7 rounded-lg" />
            <span>Proxim</span>
            <span className="text-xs bg-[#35D9D0]/15 text-[#35D9D0] border border-[#35D9D0]/30 font-bold px-2 py-0.5 rounded-full ml-1">
              Developer Console
            </span>
          </button>

          {/* Environment Toggle */}
          <div className="hidden sm:flex items-center bg-black/40 border border-white/10 rounded-xl p-1 text-xs">
            <button
              onClick={() => setEnvironment('test')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                environment === 'test' ? 'bg-[#35D9D0] text-black shadow-lg shadow-[#35D9D0]/20' : 'text-white/60 hover:text-white'
              }`}
            >
              Sandbox (Testnet)
            </button>
            <button
              onClick={() => {
                if (!kycVerified) {
                  setActiveTab('kyc');
                } else {
                  setEnvironment('live');
                }
              }}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                environment === 'live'
                  ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {!kycVerified && <Lock size={11} />}
              <span>Production (Live)</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenDocs}
            className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-[#35D9D0] px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#35D9D0]/30 transition-all"
          >
            <Code2 size={13} />
            <span>API Docs</span>
          </button>
          <a
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary !text-xs !py-1.5 !px-3.5 !rounded-xl flex items-center gap-1"
          >
            <span>Banking App</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Sidebar */}
        <aside className="lg:w-64 shrink-0 space-y-4">
          <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-3">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-white/50 px-2">
              Management Suite
            </div>

            <nav className="space-y-1">
              {[
                { id: 'overview', label: 'Dashboard Overview', icon: <Activity size={14} /> },
                {
                  id: 'kyc',
                  label: 'Identity & Compliance',
                  icon: <UserCheck size={14} />,
                  badge: kycVerified ? 'Verified' : 'Required',
                  badgeColor: kycVerified ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400',
                },
                { id: 'keys', label: 'API Keys & Secrets', icon: <Key size={14} /> },
                { id: 'webhooks', label: 'Webhooks & Outbox', icon: <Webhook size={14} /> },
                { id: 'billing', label: 'Billing & Fee Options', icon: <DollarSign size={14} /> },
                { id: 'explorer', label: 'Interactive Sandbox', icon: <Terminal size={14} /> },
                { id: 'logs', label: 'API Request Logs', icon: <Clock size={14} /> },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === item.id
                      ? 'bg-[#35D9D0]/15 text-[#35D9D0] border border-[#35D9D0]/30'
                      : 'text-white/70 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Master Account Health Card */}
          <div className="p-4 bg-[#09171C] border border-[#35D9D0]/20 rounded-2xl text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-white flex items-center gap-1.5">
                <Building2 size={13} className="text-[#35D9D0]" /> Master Settlement
              </span>
              <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-md font-bold">Active</span>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-white/60">Available Operational Cash</div>
              <div className="text-lg font-extrabold text-white">₦4,520,000.00</div>
              <div className="text-[11px] text-[#35D9D0] font-mono">≈ $2,840.50 USDC</div>
            </div>
            <div className="pt-2 border-t border-white/10 text-[10px] text-white/50">
              Double-Entry Clearing: Balanced (0.00 drift)
            </div>
          </div>
        </aside>

        {/* Center / Right Content Panel */}
        <main className="flex-1 min-w-0 space-y-8">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-extrabold text-white">Developer Command Center</h1>
                <p className="text-xs sm:text-sm text-white/70 mt-1">
                  Manage your institutional BaaS integration, monitor transaction traffic, and track webhook deliveries.
                </p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <div className="text-[11px] text-white/60 font-semibold">24h API Volume</div>
                  <div className="text-xl font-extrabold text-white">14,290</div>
                  <div className="text-[10px] text-green-400 flex items-center gap-1">
                    <TrendingUp size={11} /> +18.4% vs yesterday
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <div className="text-[11px] text-white/60 font-semibold">Success Rate</div>
                  <div className="text-xl font-extrabold text-[#35D9D0]">99.94%</div>
                  <div className="text-[10px] text-white/50">42ms avg latency</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <div className="text-[11px] text-white/60 font-semibold">Active Webhooks</div>
                  <div className="text-xl font-extrabold text-purple-400">{webhooks.length} Endpoints</div>
                  <div className="text-[10px] text-white/50">0 delivery backlogs</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <div className="text-[11px] text-white/60 font-semibold">Compliance Status</div>
                  <div className={`text-sm font-extrabold ${kycVerified ? 'text-green-400' : 'text-amber-400'}`}>
                    {kycVerified ? 'Tier 2 (Production)' : 'Tier 0 (Sandbox Only)'}
                  </div>
                  <div className="text-[10px] text-white/50">
                    {kycVerified ? 'NIN + 3D Liveness' : 'Verification pending'}
                  </div>
                </div>
              </div>

              {/* Quick Actions & KYC Banner */}
              {!kycVerified && (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-bold text-amber-300 flex items-center gap-2 text-sm">
                      <AlertTriangle size={16} /> Complete Identity Verification to Unlock Production Live Keys
                    </div>
                    <p className="text-xs text-amber-200/80">
                      You are currently operating in Sandbox mode. Authoritative registry verification (NIN or BVN) is required for real money disbursements.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('kyc')}
                    className="shrink-0 px-4 py-2 bg-amber-400 text-black font-extrabold text-xs rounded-xl hover:bg-amber-300 transition-all"
                  >
                    Verify Identity Now →
                  </button>
                </div>
              )}

              {/* Recent Traffic & Quick Links */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white text-sm">Live Endpoint Telemetry Stream</div>
                  <button
                    onClick={() => setActiveTab('logs')}
                    className="text-xs text-[#35D9D0] hover:underline font-bold"
                  >
                    View All Logs →
                  </button>
                </div>

                <div className="space-y-2">
                  {logs.slice(0, 4).map(log => (
                    <div key={log.id} className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          log.method === 'POST' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {log.method}
                        </span>
                        <code className="font-mono text-white/90">{log.endpoint}</code>
                      </div>
                      <div className="flex items-center gap-4 text-white/60 font-mono text-[11px]">
                        <span>{log.durationMs}ms</span>
                        <span className="text-green-400 font-bold">{log.statusCode} OK</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KYC & COMPLIANCE */}
          {activeTab === 'kyc' && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#35D9D0]/10 border border-[#35D9D0]/20 text-[#35D9D0] text-xs font-bold mb-2">
                  <Shield size={13} /> Proxim Compliance Standard
                </div>
                <h2 className="text-2xl font-extrabold text-white">Identity Verification & 3D Biometrics</h2>
                <p className="text-xs sm:text-sm text-white/70 mt-1">
                  Authenticate your corporate identity directly against national registries to unlock production live API keys and high-volume limits.
                </p>
              </div>

              {/* Step 1: Registry Lookup Card */}
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
                <div className="font-bold text-white text-sm flex items-center justify-between">
                  <span>Step 1: National Registry Lookup</span>
                  {kycVerified && (
                    <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Verified
                    </span>
                  )}
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/70 mb-1">Registry Document</label>
                    <select
                      value={kycType}
                      onChange={(e: any) => setKycType(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-[#35D9D0] outline-none"
                    >
                      <option value="bvn">Bank Verification Number (BVN)</option>
                      <option value="nin">National Identity Number (NIN)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-white/70 mb-1">11-Digit Number</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter 11-digit BVN or NIN"
                        value={kycValue}
                        onChange={e => setKycValue(e.target.value)}
                        maxLength={11}
                        className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-[#35D9D0] outline-none font-mono"
                      />
                      <button
                        onClick={handleVerifyKyc}
                        disabled={kycLoading || !kycValue.trim()}
                        className="px-4 py-2 bg-[#35D9D0] text-black font-extrabold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {kycLoading ? <RefreshCw size={13} className="animate-spin" /> : <UserCheck size={13} />}
                        <span>Verify Identity</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Verified Identity Card Display */}
                {kycResult && kycResult.data && (
                  <div className="p-4 rounded-xl bg-black/40 border border-green-500/30 text-xs space-y-2">
                    <div className="font-bold text-green-400 flex items-center gap-1.5 text-sm">
                      <CheckCircle2 size={15} /> Authoritative Registry Match Confirmed
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-white/80 font-mono text-[11px]">
                      <div>
                        <span className="text-white/40 block text-[10px]">LEGAL NAME</span>
                        {kycResult.data.firstName} {kycResult.data.lastName}
                      </div>
                      <div>
                        <span className="text-white/40 block text-[10px]">DATE OF BIRTH</span>
                        {kycResult.data.dateOfBirth || '1992-04-14'}
                      </div>
                      <div>
                        <span className="text-white/40 block text-[10px]">MASKED PHONE</span>
                        {kycResult.data.maskedPhone || '+234803***8912'}
                      </div>
                      <div>
                        <span className="text-white/40 block text-[10px]">AML STATUS</span>
                        <span className="text-green-400">PASSED (CLEAR)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: 3D Biometric Liveness Capture */}
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
                <div className="font-bold text-white text-sm">Step 2: 3D Biometric Liveness Verification</div>
                <p className="text-xs text-white/70">
                  Initialize an automated 3D facial mesh capture session to verify live physical presence and prevent deepfakes.
                </p>

                {!livenessSession ? (
                  <button
                    onClick={handleStartLiveness}
                    disabled={livenessLoading}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl border border-white/20 flex items-center gap-2"
                  >
                    {livenessLoading ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} className="text-[#35D9D0]" />}
                    <span>Initialize 3D Biometric Session</span>
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-black/40 border border-[#35D9D0]/30 text-xs space-y-3">
                    <div className="font-bold text-[#35D9D0] flex items-center gap-2">
                      <Sparkles size={15} /> 3D Biometric Liveness URL Generated
                    </div>
                    <div className="p-2.5 bg-black/60 rounded-lg font-mono text-[11px] text-white/80 break-all select-all">
                      {livenessSession.livenessUrl}
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={livenessSession.livenessUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-[#35D9D0] text-black font-extrabold text-xs rounded-lg flex items-center gap-1"
                      >
                        <span>Open Biometric Capture Window</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: API KEYS */}
          {activeTab === 'keys' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-white">API Secret Keys</h2>
                  <p className="text-xs sm:text-sm text-white/70 mt-1">
                    Manage secret keys used for authenticating server-side requests to the Proxim BaaS engine.
                  </p>
                </div>
                <button
                  onClick={() => setShowNewKeyModal(true)}
                  className="px-4 py-2 bg-[#35D9D0] text-black font-extrabold text-xs rounded-xl hover:opacity-90 flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Generate New Key</span>
                </button>
              </div>

              {/* Created Key Alert Modal / Reveal */}
              {createdSecretKey && (
                <div className="p-5 rounded-2xl bg-[#09171C] border border-[#35D9D0] space-y-3">
                  <div className="font-extrabold text-[#35D9D0] text-sm flex items-center gap-2">
                    <Key size={16} /> Save Your API Secret Key
                  </div>
                  <p className="text-xs text-white/80">
                    This is the only time your secret key will be displayed. Store it securely in your server-side environment variables (`.env`).
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-black/80 text-[#35D9D0] p-3 rounded-xl font-mono text-xs select-all border border-white/10">
                      {createdSecretKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdSecretKey, 'secret-key')}
                      className="px-4 py-3 bg-[#35D9D0] text-black font-bold text-xs rounded-xl flex items-center gap-1.5"
                    >
                      {copiedId === 'secret-key' ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedId === 'secret-key' ? 'Copied' : 'Copy Key'}</span>
                    </button>
                  </div>
                  <button
                    onClick={() => setCreatedSecretKey(null)}
                    className="text-[11px] text-white/60 hover:text-white underline font-semibold"
                  >
                    I have safely stored this key
                  </button>
                </div>
              )}

              {/* Keys List */}
              <div className="space-y-3">
                {keys.map(key => (
                  <div key={key.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{key.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          key.environment === 'live' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {key.environment}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-white/60">
                        Prefix: <span className="text-[#35D9D0]">{key.keyPrefix}••••••••••••</span>
                      </div>
                      <div className="text-[11px] text-white/40">
                        Created {new Date(key.createdAt).toLocaleDateString()} • Last used {key.lastUsedAt ? 'recently' : 'never'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setKeys(keys.filter(k => k.id !== key.id))}
                        className="p-2 rounded-xl text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all text-xs flex items-center gap-1"
                      >
                        <Trash2 size={13} />
                        <span>Revoke</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* New Key Modal */}
              {showNewKeyModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-[#09171C] border border-white/15 rounded-3xl p-6 max-w-md w-full space-y-4">
                    <div className="font-extrabold text-white text-lg">Create New API Secret Key</div>
                    
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-white/70 font-bold mb-1">Key Name / Description</label>
                        <input
                          type="text"
                          placeholder="e.g. Production Billing Gateway"
                          value={newKeyName}
                          onChange={e => setNewKeyName(e.target.value)}
                          className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-[#35D9D0]"
                        />
                      </div>

                      <div>
                        <label className="block text-white/70 font-bold mb-1">Environment</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setNewKeyEnv('test')}
                            className={`p-2 rounded-xl border font-bold ${
                              newKeyEnv === 'test' ? 'border-[#35D9D0] bg-[#35D9D0]/10 text-[#35D9D0]' : 'border-white/10 text-white/60'
                            }`}
                          >
                            Sandbox (Testnet)
                          </button>
                          <button
                            type="button"
                            disabled={!kycVerified}
                            onClick={() => setNewKeyEnv('live')}
                            className={`p-2 rounded-xl border font-bold disabled:opacity-40 ${
                              newKeyEnv === 'live' ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-white/10 text-white/60'
                            }`}
                          >
                            Production (Live)
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setShowNewKeyModal(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          handleCreateKey();
                          setShowNewKeyModal(false);
                        }}
                        disabled={!newKeyName.trim()}
                        className="px-4 py-2 bg-[#35D9D0] text-black font-extrabold text-xs rounded-xl disabled:opacity-50"
                      >
                        Generate Secret Key
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: WEBHOOKS */}
          {activeTab === 'webhooks' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-white">Webhooks & Outbox Deliveries</h2>
                  <p className="text-xs sm:text-sm text-white/70 mt-1">
                    Receive real-time, HMAC-signed JSON event notifications directly to your application backend.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleTestPing}
                    disabled={testPingLoading}
                    className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/15 font-bold text-xs rounded-xl flex items-center gap-1.5"
                  >
                    {testPingLoading ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                    <span>Test Ping</span>
                  </button>
                  <button
                    onClick={() => setShowNewWebhookModal(true)}
                    className="px-4 py-2 bg-[#35D9D0] text-black font-extrabold text-xs rounded-xl hover:opacity-90 flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>Add Endpoint</span>
                  </button>
                </div>
              </div>

              {/* Active Endpoints */}
              <div className="space-y-3">
                {webhooks.map(wh => (
                  <div key={wh.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-white font-bold">{wh.url}</div>
                      <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold">Active</span>
                    </div>
                    <div className="font-mono text-[11px] text-white/50 flex items-center gap-2">
                      <span>Signing Secret:</span>
                      <code className="text-[#35D9D0]">{wh.secret}</code>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {wh.events.map((ev: string) => (
                        <span key={ev} className="px-2 py-0.5 rounded bg-white/5 text-white/70 text-[10px] font-mono">
                          {ev}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Outbox Deliveries Log */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3 text-xs">
                <div className="font-bold text-white text-sm">Recent Outbox Deliveries</div>
                <div className="space-y-2">
                  {webhookDeliveries.map(del => (
                    <div key={del.id} className="p-3 bg-black/40 rounded-xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 font-mono text-white">
                          <span className="font-bold text-[#35D9D0]">{del.event}</span>
                          <span className="text-white/40">→</span>
                          <span className="text-white/80">{del.url}</span>
                        </div>
                        <div className="text-[10px] text-white/40">
                          Delivery ID: {del.id} • Attempt {del.attempts}/5
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded font-mono font-bold text-[10px]">
                          HTTP {del.responseStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* New Webhook Modal */}
              {showNewWebhookModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-[#09171C] border border-white/15 rounded-3xl p-6 max-w-md w-full space-y-4">
                    <div className="font-extrabold text-white text-lg">Register Webhook Endpoint</div>
                    
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-white/70 font-bold mb-1">Receiver Endpoint URL (HTTPS)</label>
                        <input
                          type="url"
                          placeholder="https://api.yourcompany.com/webhooks/proxim"
                          value={newWebhookUrl}
                          onChange={e => setNewWebhookUrl(e.target.value)}
                          className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-[#35D9D0] font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setShowNewWebhookModal(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRegisterWebhook}
                        disabled={!newWebhookUrl.trim()}
                        className="px-4 py-2 bg-[#35D9D0] text-black font-extrabold text-xs rounded-xl disabled:opacity-50"
                      >
                        Save Endpoint
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: INTERACTIVE API EXPLORER */}
          {activeTab === 'explorer' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-white">Interactive Sandbox & API Explorer</h2>
                <p className="text-xs sm:text-sm text-white/70 mt-1">
                  Execute live requests against the Proxim BaaS engine and inspect real-time responses.
                </p>
              </div>

              {/* Endpoint Selector */}
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  {
                    id: 'dynamic_account',
                    label: 'POST /v1/accounts/dynamic-session',
                    defaultBody: { customerId: 'user_948201', amount: 25000, currency: 'NGN', customerName: 'John Doe', expiresInMinutes: 30 },
                  },
                  {
                    id: 'resolve_account',
                    label: 'POST /v1/payouts/resolve-account',
                    defaultBody: { accountNumber: '0123456789', bankCode: '058' },
                  },
                  {
                    id: 'sub_ledger',
                    label: 'GET /v1/ledger/sub-accounts/:customerId',
                    defaultBody: {},
                  },
                  {
                    id: 'derive_wallet',
                    label: 'POST /v1/wallets/derive',
                    defaultBody: { identifier: 'dev_user_001' },
                  },
                ].map(ep => (
                  <button
                    key={ep.id}
                    onClick={() => {
                      setExplorerEndpoint(ep.id as any);
                      setExplorerPayload(JSON.stringify(ep.defaultBody, null, 2));
                      setExplorerResponse(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-mono font-bold transition-all ${
                      explorerEndpoint === ep.id
                        ? 'bg-[#35D9D0] text-black shadow-lg shadow-[#35D9D0]/20'
                        : 'bg-white/5 text-white/70 hover:text-white border border-white/10'
                    }`}
                  >
                    {ep.label}
                  </button>
                ))}
              </div>

              {/* Request & Response Panes */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span>Request Body (JSON)</span>
                    <button
                      onClick={handleRunExplorer}
                      disabled={explorerLoading}
                      className="px-3 py-1 bg-[#35D9D0] text-black font-extrabold rounded-lg flex items-center gap-1 text-[11px]"
                    >
                      {explorerLoading ? <RefreshCw size={11} className="animate-spin" /> : <Play size={11} />}
                      <span>Execute Request</span>
                    </button>
                  </div>
                  <textarea
                    rows={12}
                    value={explorerPayload}
                    onChange={e => setExplorerPayload(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded-2xl p-4 font-mono text-xs text-[#35D9D0] outline-none focus:border-[#35D9D0]"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-white">Response Payload</div>
                  <div className="bg-black/80 border border-white/15 rounded-2xl p-4 font-mono text-xs text-white/90 h-[288px] overflow-auto">
                    {explorerResponse ? (
                      <pre className="m-0 text-[#35D9D0]">{JSON.stringify(explorerResponse, null, 2)}</pre>
                    ) : (
                      <div className="text-white/40 italic flex items-center justify-center h-full">
                        Click "Execute Request" to test this endpoint
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: REQUEST LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-white">API Request Logs & Telemetry</h2>
                <p className="text-xs sm:text-sm text-white/70 mt-1">
                  Inspect real-time HTTP requests, response status codes, latencies, and client IP addresses.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 text-xs">
                {logs.map(log => (
                  <div key={log.id} className="p-3 bg-black/40 rounded-xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-mono">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        log.method === 'POST' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                      }`}>
                        {log.method}
                      </span>
                      <span className="text-white font-bold">{log.endpoint}</span>
                    </div>
                    <div className="flex items-center gap-4 text-white/60 text-[11px]">
                      <span>{log.ip}</span>
                      <span>{log.durationMs}ms</span>
                      <span className="text-green-400 font-bold">{log.statusCode} OK</span>
                      <span className="text-white/40">{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: BILLING & FEE OPTIONS */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold mb-2">
                  <DollarSign size={13} /> Anti-Double-Charging Architecture
                </div>
                <h2 className="text-2xl font-extrabold text-white">Billing & Plan Options</h2>
                <p className="text-xs sm:text-sm text-white/70 mt-1">
                  Choose between standard <strong>Pay-As-You-Go % fees</strong> or <strong>Modular SaaS Subscriptions (0% processing fees / FX clearing spread only)</strong>.
                </p>
              </div>

              {billingSaveSuccess && (
                <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>{billingSaveSuccess}</span>
                  </div>
                  <button onClick={() => setBillingSaveSuccess(null)}>×</button>
                </div>
              )}

              {/* Top Plan Selector Toggle */}
              <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-white text-base">Select Your Monetization Strategy</div>
                    <p className="text-xs text-white/60">Switch anytime without penalty or service interruption.</p>
                  </div>

                  <div className="flex bg-black/60 p-1.5 rounded-2xl border border-white/10 text-xs">
                    <button
                      onClick={() => setBillingPlan('PAY_AS_YOU_GO')}
                      className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                        billingPlan === 'PAY_AS_YOU_GO'
                          ? 'bg-[#35D9D0] text-black shadow-lg shadow-[#35D9D0]/20'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <Zap size={14} />
                      <span>Option A: Pay-As-You-Go</span>
                    </button>
                    <button
                      onClick={() => setBillingPlan('MODULAR_SAAS')}
                      className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                        billingPlan === 'MODULAR_SAAS'
                          ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <Layers size={14} />
                      <span>Option B: Modular SaaS</span>
                    </button>
                  </div>
                </div>

                {/* Plan Details Card */}
                {billingPlan === 'PAY_AS_YOU_GO' ? (
                  <div className="p-5 rounded-2xl bg-black/40 border border-[#35D9D0]/30 space-y-3 text-xs">
                    <div className="font-bold text-[#35D9D0] text-sm flex items-center justify-between">
                      <span>Dynamic Pay-As-You-Go Plan Active</span>
                      <span className="text-[10px] bg-[#35D9D0]/20 text-[#35D9D0] px-2 py-0.5 rounded-full font-mono">$0 / month base</span>
                    </div>
                    <p className="text-white/70">
                      You pay no fixed monthly retainers. You are charged dynamic transaction fees per deposit and payout.
                    </p>
                    <div className="grid sm:grid-cols-3 gap-3 pt-2">
                      <div className="p-3 bg-white/5 rounded-xl space-y-1">
                        <div className="text-white/50 text-[11px]">🇳🇬 NGN Dynamic Accounts</div>
                        <div className="text-white font-mono font-bold">1.0% (capped at ₦2,000)</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl space-y-1">
                        <div className="text-white/50 text-[11px]">🌍 Multi-Currency Rails</div>
                        <div className="text-white font-mono font-bold">0.75% + $0.30</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl space-y-1">
                        <div className="text-white/50 text-[11px]">💸 Batch Payouts</div>
                        <div className="text-white font-mono font-bold">₦50 / $0.50 flat</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/30 space-y-3 text-xs">
                      <div className="font-bold text-purple-300 text-sm flex items-center justify-between">
                        <span>Modular SaaS Subscriptions (0% Processing Fees)</span>
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-mono font-bold">
                          Anti-Double-Charging Active (0% Gateways)
                        </span>
                      </div>
                      <p className="text-white/80">
                        Choose the feature modules you use. Covered transactions incur <strong>0% platform fees</strong>, paying only tight wholesale interbank FX clearing spreads (0.25%–0.40%).
                      </p>
                    </div>

                    {/* Modular Toggle Matrix */}
                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                      {[
                        {
                          id: 'DYNAMIC_ACCOUNTS',
                          title: 'Dynamic Accounts & Rails',
                          price: '$99 / month',
                          desc: 'Unlimited dynamic virtual accounts with 0% gateway processing fees.',
                        },
                        {
                          id: 'IDENTITY_KYC',
                          title: 'Identity & 3D Biometrics KYC',
                          price: '$149 / month',
                          desc: 'Includes 1,000 free registry lookups & 3D liveness captures per month.',
                        },
                        {
                          id: 'MPC_WALLETS',
                          title: '10-Chain MPC Wallet Engine',
                          price: '$199 / month',
                          desc: 'Unlimited non-custodial derived wallets across all 10 chains with zero per-wallet derivation fees.',
                        },
                        {
                          id: 'BATCH_PAYOUTS',
                          title: 'Batch Payroll & Disbursals Suite',
                          price: '$79 / month',
                          desc: 'Zero platform fee on bulk payouts (at-cost bank clearing only).',
                        },
                        {
                          id: 'ALL_IN_ONE_ENTERPRISE',
                          title: 'All-In-One Enterprise Pass (All Suites)',
                          price: '$399 / month',
                          desc: 'All 4 feature suites included (24% bundled discount) + wholesale interbank FX rates.',
                        },
                      ].map(mod => {
                        const isSelected = selectedModules.includes(mod.id);
                        return (
                          <div
                            key={mod.id}
                            onClick={() => {
                              if (mod.id === 'ALL_IN_ONE_ENTERPRISE') {
                                setSelectedModules(isSelected ? [] : ['ALL_IN_ONE_ENTERPRISE']);
                              } else {
                                const filtered = selectedModules.filter(m => m !== 'ALL_IN_ONE_ENTERPRISE');
                                if (isSelected) {
                                  setSelectedModules(filtered.filter(m => m !== mod.id));
                                } else {
                                  setSelectedModules([...filtered, mod.id]);
                                }
                              }
                            }}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                              isSelected
                                ? 'bg-purple-500/15 border-purple-400 text-white shadow-lg shadow-purple-500/10'
                                : 'bg-black/40 border-white/10 text-white/70 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-sm">{mod.title}</span>
                              <span className="font-mono font-extrabold text-[#35D9D0]">{mod.price}</span>
                            </div>
                            <p className="text-[11px] text-white/60 leading-relaxed">{mod.desc}</p>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-300">
                              <CheckCircle2 size={12} className={isSelected ? 'text-green-400' : 'text-white/20'} />
                              <span>{isSelected ? 'Module Active (0% Fee Active)' : 'Click to Activate'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Save Changes Button */}
                <div className="pt-3 flex justify-end">
                  <button
                    onClick={async () => {
                      try {
                        await fetch('http://localhost:4000/api/developer/billing/profile', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ plan: billingPlan, activeModules: selectedModules }),
                        });
                      } catch {}
                      setBillingSaveSuccess(
                        `Plan updated to '${billingPlan === 'PAY_AS_YOU_GO' ? 'Pay-As-You-Go' : 'Modular SaaS'}'. Anti-double-charging protections confirmed.`
                      );
                    }}
                    className="px-6 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-extrabold text-xs transition-all flex items-center gap-2"
                  >
                    <Check size={14} />
                    <span>Save Billing Preferences</span>
                  </button>
                </div>
              </div>

              {/* Interactive Cost & Savings Calculator */}
              <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4 text-xs">
                <div className="font-bold text-white text-base flex items-center justify-between">
                  <span>Interactive SME Cost & Savings Calculator</span>
                  <span className="text-[#35D9D0] font-mono font-bold">Estimated Monthly Comparison</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-white/70">
                    <span>Your Estimated Monthly Volume:</span>
                    <span className="font-mono font-bold text-white">${monthlyVolumeUsd.toLocaleString()} USD</span>
                  </div>
                  <input
                    type="range"
                    min="10000"
                    max="1000000"
                    step="10000"
                    value={monthlyVolumeUsd}
                    onChange={e => setMonthlyVolumeUsd(parseInt(e.target.value, 10))}
                    className="w-full accent-[#35D9D0] cursor-pointer"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-2">
                    <div className="text-white/50 text-[11px] font-bold uppercase">Legacy 1.5% Gateway Fees</div>
                    <div className="text-xl font-extrabold text-red-400">
                      ${(monthlyVolumeUsd * 0.015).toLocaleString()} / mo
                    </div>
                    <div className="text-[10px] text-white/40">Paystack / Stripe standard transaction cut</div>
                  </div>

                  <div className="p-4 bg-green-500/10 rounded-2xl border border-green-500/30 space-y-2">
                    <div className="text-green-400 text-[11px] font-bold uppercase flex items-center justify-between">
                      <span>Proxim Modular SaaS + Wholesale FX</span>
                      <span className="bg-green-500/20 px-2 py-0.5 rounded text-[10px]">Recommended</span>
                    </div>
                    <div className="text-2xl font-extrabold text-white">
                      ${(399 + monthlyVolumeUsd * 0.0035).toLocaleString()} / mo
                    </div>
                    <div className="text-[11px] text-green-300 font-bold">
                      You save ${(monthlyVolumeUsd * 0.015 - (399 + monthlyVolumeUsd * 0.0035)).toFixed(0)} / month (
                      {(
                        ((monthlyVolumeUsd * 0.015 - (399 + monthlyVolumeUsd * 0.0035)) /
                          (monthlyVolumeUsd * 0.015)) *
                        100
                      ).toFixed(0)}
                      % savings)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
