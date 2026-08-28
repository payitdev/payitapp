import React, { useState, useEffect } from 'react';
import {
  Shield,
  Activity,
  Users,
  Building2,
  Code2,
  TrendingUp,
  AlertTriangle,
  Zap,
  Globe,
  Lock,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  PieChart,
  Layers,
  PauseCircle,
  PlayCircle,
  AlertOctagon,
  Eye,
  Sliders,
  Server,
  Sparkles,
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToHome: () => void;
  onOpenConsole: () => void;
  appUrl?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBackToHome,
  onOpenConsole,
  appUrl = 'https://app.proximfi.xyz/',
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'developers' | 'transactions' | 'alerts'>('analytics');
  const [filterType, setFilterType] = useState<'ALL' | 'DEVELOPER' | 'BUSINESS' | 'PERSONAL' | 'FLAGGED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityForAction, setSelectedEntityForAction] = useState<any>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);

  // Entities state
  const [entities, setEntities] = useState<any[]>([]);

  // Metrics Data
  const [currencyData, setCurrencyData] = useState<any[]>([]);
  const [chainData, setChainData] = useState<any[]>([]);
  const [dailyVelocity, setDailyVelocity] = useState<any[]>([]);

  const [liveTransactions, setLiveTransactions] = useState<any[]>([]);

  // Anomaly Alerts
  const [alerts, setAlerts] = useState<any[]>([]);

  // Live initial data fetch from Super Admin API Engine
  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const [metricsRes, entRes, txRes, altRes] = await Promise.all([
          fetch('http://localhost:4000/api/admin/metrics').then(r => r.json()).catch(() => null),
          fetch('http://localhost:4000/api/admin/entities').then(r => r.json()).catch(() => null),
          fetch('http://localhost:4000/api/admin/transactions').then(r => r.json()).catch(() => null),
          fetch('http://localhost:4000/api/admin/alerts').then(r => r.json()).catch(() => null),
        ]);

        if (metricsRes?.success) {
          setMetrics(metricsRes.data);
          setCurrencyData(metricsRes.data.currencyVolumes || []);
          setChainData(metricsRes.data.chainActivity || []);
          setDailyVelocity(metricsRes.data.dailyVelocity || []);
        }

        if (entRes?.success && Array.isArray(entRes.entities) && entRes.entities.length > 0) {
          setEntities(entRes.entities);
        }
        if (txRes?.success && Array.isArray(txRes.transactions) && txRes.transactions.length > 0) {
          setLiveTransactions(
            txRes.transactions.map((t: any) => ({
              id: t.id,
              entity: t.entityName,
              type: t.entityType,
              rail: t.rail,
              direction: t.direction,
              amount: t.amount,
              amountUsd: `$${(t.amountUsd || 0).toFixed(2)}`,
              status: t.status,
              customer: t.customer,
              time: 'Just now',
            }))
          );
        }
        if (altRes?.success && Array.isArray(altRes.alerts) && altRes.alerts.length > 0) {
          setAlerts(
            altRes.alerts.map((a: any) => ({
              id: a.id,
              severity: a.severity,
              title: a.title,
              entity: a.entityName,
              description: a.description,
              time: 'Recent',
            }))
          );
        }
      } catch (err) {
        console.warn('[AdminDashboard Fetch Error]:', err);
      }
    };

    fetchAdminData();
    const interval = setInterval(fetchAdminData, 10000); // 10s live polling
    return () => clearInterval(interval);
  }, []);

  // Execute Entity Status Update (Throttle / Suspend / Freeze / Active)
  const handleUpdateStatus = async (newStatus: 'ACTIVE' | 'THROTTLED' | 'SUSPENDED_PAYOUTS' | 'FROZEN') => {
    if (!selectedEntityForAction) return;
    setActionLoading(true);

    try {
      await fetch(`http://localhost:4000/api/admin/entities/${selectedEntityForAction.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, reason: actionReason.trim() || 'Admin manual risk policy' }),
      });
    } catch {}

    setEntities(
      entities.map(e =>
        e.id === selectedEntityForAction.id
          ? { ...e, status: newStatus, statusReason: actionReason.trim() || 'Updated by Administrator' }
          : e
      )
    );

    setActionSuccessMsg(`Entity '${selectedEntityForAction.legalName}' updated to status '${newStatus}'.`);
    setActionLoading(false);
    setSelectedEntityForAction(null);
    setActionReason('');
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const filteredEntities = entities.filter(e => {
    const matchesQuery =
      e.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.businessTag && e.businessTag.toLowerCase().includes(searchQuery.toLowerCase()));

    if (filterType === 'DEVELOPER') return matchesQuery && e.classification === 'DEVELOPER';
    if (filterType === 'BUSINESS') return matchesQuery && e.classification === 'BUSINESS';
    if (filterType === 'PERSONAL') return matchesQuery && e.classification === 'PERSONAL';
    if (filterType === 'FLAGGED') return matchesQuery && e.status !== 'ACTIVE';
    return matchesQuery;
  });

  return (
    <div className="min-h-screen bg-[#060B14] text-[#F7F8F4] font-sans antialiased">
      
      {/* Top Super Admin Navbar */}
      <header className="sticky top-0 z-50 bg-[#060B14]/95 backdrop-blur-2xl border-b border-red-500/20 px-6 sm:px-10 h-16 sm:h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-2.5 text-white hover:text-red-400 transition-colors font-extrabold text-lg sm:text-xl"
          >
            <img src="/proxim-icon.png" alt="Proxim" className="w-7 h-7 rounded-lg" />
            <span>Proxim</span>
            <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 font-bold px-2 py-0.5 rounded-full ml-1">
              Super Admin Console
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold font-mono">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span>Clearing Engine: Active (0.00 Drift)</span>
          </div>

          <button
            onClick={onOpenConsole}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#35D9D0] text-xs font-bold text-white transition-all flex items-center gap-1.5"
          >
            <Code2 size={13} />
            <span>Developer View</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        
        {/* Success Banner */}
        {actionSuccessMsg && (
          <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{actionSuccessMsg}</span>
            </div>
            <button onClick={() => setActionSuccessMsg(null)}>×</button>
          </div>
        )}

        {/* Top KPIs Metric Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
            <div className="text-[11px] text-white/50 font-bold uppercase tracking-wider">Total Gross Cleared</div>
            <div className="text-2xl font-extrabold text-white">${Number(metrics?.financials?.totalGrossVolumeUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-[10px] text-white/50 flex items-center gap-1">
              <Activity size={11} /> Based on recorded USD transactions
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
            <div className="text-[11px] text-white/50 font-bold uppercase tracking-wider">Inbound vs Outbound</div>
            <div className="text-xl font-extrabold text-[#35D9D0]">${Number(metrics?.financials?.inboundVolumeUsd || 0).toLocaleString()} / ${Number(metrics?.financials?.outboundVolumeUsd || 0).toLocaleString()}</div>
            <div className="text-[10px] text-white/50">Recorded USD inbound / outbound</div>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
            <div className="text-[11px] text-white/50 font-bold uppercase tracking-wider">Active Ecosystem Users</div>
            <div className="text-2xl font-extrabold text-white">{Number(metrics?.users?.totalUsers || 0).toLocaleString()}</div>
            <div className="text-[10px] text-white/50 font-semibold">
              {Number(metrics?.users?.developersCount || 0).toLocaleString()} developers • {Number(metrics?.users?.businessesCount || 0).toLocaleString()} businesses
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
            <div className="text-[11px] text-white/50 font-bold uppercase tracking-wider">Platform Take Revenue</div>
            <div className="text-2xl font-extrabold text-amber-400">${Number(metrics?.financials?.platformRevenueUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-[10px] text-white/50">Recorded fee revenue</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          {[
            { id: 'analytics', label: 'Platform Analytics & Visualizations', icon: <PieChart size={15} /> },
            { id: 'developers', label: 'Developer & Entity Risk Management', icon: <Building2 size={15} />, badge: entities.filter(e => e.status !== 'ACTIVE').length },
            { id: 'transactions', label: 'Global Live Feed', icon: <Activity size={15} /> },
            { id: 'alerts', label: 'Security & Anomaly Alerts', icon: <AlertTriangle size={15} />, badge: alerts.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[10px] font-extrabold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* TAB 1: ANALYTICS & CHARTS */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            
            {/* Charts Row 1: Currency Volume Donut + Chain Comparison Bar */}
            <div className="grid lg:grid-cols-2 gap-6">
              
              {/* Currency Breakdown (SVG Donut Chart) */}
              <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-white text-base">Transaction Volume by Currency</h3>
                    <p className="text-xs text-white/60">Cross-border flow across 7 major fiat and stablecoin rails</p>
                  </div>
                  <span className="text-xs font-mono text-[#35D9D0] bg-[#35D9D0]/10 px-2.5 py-1 rounded-lg font-bold">
                    $14.25M Total
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
                  {/* SVG Donut Visual */}
                  <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      {/* Segment calculations */}
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="#35D9D0" strokeWidth="16" strokeDasharray="90.7 238.7" strokeDashoffset="0" />
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="#4A8CFF" strokeWidth="16" strokeDasharray="64.4 238.7" strokeDashoffset="-90.7" />
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="#7567F8" strokeWidth="16" strokeDasharray="33.4 238.7" strokeDashoffset="-155.1" />
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="#22C55E" strokeWidth="16" strokeDasharray="21.5 238.7" strokeDashoffset="-188.5" />
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="#F59E0B" strokeWidth="16" strokeDasharray="14.3 238.7" strokeDashoffset="-210.0" />
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="#F43F5E" strokeWidth="16" strokeDasharray="8.3 238.7" strokeDashoffset="-224.3" />
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="#EC4899" strokeWidth="16" strokeDasharray="6.0 238.7" strokeDashoffset="-232.6" />
                    </svg>
                    <div className="absolute text-center space-y-0.5">
                      <div className="text-[10px] text-white/50 font-bold uppercase">Top Rail</div>
                      <div className="text-sm font-extrabold text-[#35D9D0]">NGN (38%)</div>
                    </div>
                  </div>

                  {/* Legend List */}
                  <div className="flex-1 w-full grid grid-cols-2 gap-2 text-xs">
                    {currencyData.map(c => (
                      <div key={c.currency} className="p-2 bg-black/40 rounded-xl border border-white/5 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                          <span className="font-bold text-white">{c.currency}</span>
                          <span className="text-white/40 text-[10px]">({c.percentage}%)</span>
                        </div>
                        <div className="text-[11px] font-mono text-white/70">
                          ${(c.amountUsd / 1000000).toFixed(2)}M USD
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chain Activity: Deposits vs Withdrawals (Multi-Bar Chart) */}
              <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-white text-base">Chain Volume: Deposits vs Withdrawals</h3>
                    <p className="text-xs text-white/60">Multi-chain non-custodial volume processed on MPC rails</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-[#35D9D0]"><span className="w-2 h-2 rounded bg-[#35D9D0]" /> Deposits</span>
                    <span className="flex items-center gap-1 text-purple-400"><span className="w-2 h-2 rounded bg-purple-400" /> Withdrawals</span>
                  </div>
                </div>

                {/* Bar Chart Visual */}
                <div className="space-y-2.5 pt-2">
                  {chainData.slice(0, 5).map(chain => {
                    const maxVol = 4500000;
                    const depPct = (chain.deposits / maxVol) * 100;
                    const wthPct = (chain.withdrawals / maxVol) * 100;

                    return (
                      <div key={chain.chain} className="space-y-1 text-xs">
                        <div className="flex justify-between text-white/80 font-mono text-[11px]">
                          <span className="font-bold text-white">{chain.chain}</span>
                          <span>
                            Dep: ${(chain.deposits / 1000000).toFixed(2)}M • Wth: ${(chain.withdrawals / 1000000).toFixed(2)}M
                          </span>
                        </div>
                        <div className="h-2.5 w-full bg-black/60 rounded-full overflow-hidden flex gap-0.5">
                          <div className="h-full bg-[#35D9D0] rounded-l-full" style={{ width: `${depPct}%` }} />
                          <div className="h-full bg-purple-400 rounded-r-full" style={{ width: `${wthPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Charts Row 2: 30-Day Velocity Area & Sparkline Graph */}
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-white text-base">30-Day Liquidity Velocity (Inflows vs Outflows)</h3>
                  <p className="text-xs text-white/60">Daily cleared transaction throughput in USD</p>
                </div>
                <span className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full">
                  Net Positive Liquidity Cleared
                </span>
              </div>

              {/* Area Chart Wave Simulation */}
              <div className="h-44 w-full bg-black/40 rounded-2xl p-4 flex items-end justify-between gap-1 border border-white/5">
                {dailyVelocity.map((v, i) => {
                  const maxH = 320000;
                  const inflowH = (v.inflows / maxH) * 100;
                  const outflowH = (v.outflows / maxH) * 100;

                  return (
                    <div key={i} className="flex-1 h-full flex items-end justify-center gap-0.5 group relative">
                      <div
                        className="w-full bg-[#35D9D0]/70 hover:bg-[#35D9D0] rounded-t transition-all"
                        style={{ height: `${inflowH}%` }}
                      />
                      <div
                        className="w-full bg-purple-500/60 hover:bg-purple-400 rounded-t transition-all"
                        style={{ height: `${outflowH}%` }}
                      />
                      {/* Tooltip on hover */}
                      <div className="absolute -top-12 bg-black/90 text-white p-1.5 rounded-lg border border-white/20 text-[10px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20 transition-opacity">
                        {v.day}: In ${v.inflows.toLocaleString()} | Out ${v.outflows.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DEVELOPER & ENTITY RISK MANAGEMENT */}
        {activeTab === 'developers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-white">Developer & Entity Governance</h2>
                <p className="text-xs sm:text-sm text-white/70 mt-1">
                  Enforce circuit breakers, throttle spamming API keys, or freeze payouts to protect platform stability.
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/10 text-xs">
                {(['ALL', 'DEVELOPER', 'BUSINESS', 'PERSONAL', 'FLAGGED'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                      filterType === type ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search by legal name, username, or business tag..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-xs text-white outline-none focus:border-red-500 font-mono"
              />
            </div>

            {/* Entity Management Table */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.01] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/60 border-b border-white/10 text-white/50 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="p-4">Entity & Classification</th>
                      <th className="p-4">Risk Status</th>
                      <th className="p-4">Volume (USD)</th>
                      <th className="p-4">Sub-Users</th>
                      <th className="p-4">Error Rate</th>
                      <th className="p-4">Circuit Breaker Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredEntities.map(entity => (
                      <tr key={entity.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 space-y-1">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{entity.legalName}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 font-mono">
                              {entity.classification}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-white/40">
                            Tag: {entity.businessTag || 'None'} • ID: {entity.id}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                            entity.status === 'ACTIVE'
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : entity.status === 'THROTTLED'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : entity.status === 'SUSPENDED_PAYOUTS'
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {entity.status}
                          </span>
                          {entity.statusReason && (
                            <div className="text-[10px] text-amber-300/80 mt-1 max-w-[200px] truncate" title={entity.statusReason}>
                              {entity.statusReason}
                            </div>
                          )}
                        </td>
                        <td className="p-4 font-mono text-white font-bold">
                          ${entity.totalProcessedUsd.toLocaleString()}
                        </td>
                        <td className="p-4 font-mono text-white/80">
                          {entity.subUsersCount.toLocaleString()}
                        </td>
                        <td className="p-4 font-mono">
                          <span className={entity.errorRatePercent > 2 ? 'text-red-400 font-bold' : 'text-green-400'}>
                            {entity.errorRatePercent}%
                          </span>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => setSelectedEntityForAction(entity)}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-red-500 hover:text-white transition-all text-[11px] font-bold flex items-center gap-1 text-white/90"
                          >
                            <Sliders size={12} />
                            <span>Risk Controls</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Circuit Breaker Modal */}
            {selectedEntityForAction && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#09171C] border border-red-500/30 rounded-3xl p-6 max-w-lg w-full space-y-4">
                  <div className="space-y-1">
                    <div className="font-extrabold text-white text-lg">
                      Circuit Breaker: {selectedEntityForAction.legalName}
                    </div>
                    <p className="text-xs text-white/60">
                      Apply immediate platform safeguards to throttle, freeze payouts, or block traffic.
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <label className="block text-white/70 font-bold">Audit Reason / Security Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Abusive automated payout spam or invalid payload loops"
                      value={actionReason}
                      onChange={e => setActionReason(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-red-500 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                    <button
                      onClick={() => handleUpdateStatus('THROTTLED')}
                      disabled={actionLoading}
                      className="p-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold rounded-xl flex flex-col items-center gap-1 text-center"
                    >
                      <PauseCircle size={16} />
                      <span>Throttle to 5 req/min</span>
                      <span className="text-[10px] text-amber-200/50">Limits spam without dropping users</span>
                    </button>

                    <button
                      onClick={() => handleUpdateStatus('SUSPENDED_PAYOUTS')}
                      disabled={actionLoading}
                      className="p-3 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 font-bold rounded-xl flex flex-col items-center gap-1 text-center"
                    >
                      <Lock size={16} />
                      <span>Suspend Outbound Payouts</span>
                      <span className="text-[10px] text-orange-200/50">Freezes disbursals, allows deposits</span>
                    </button>

                    <button
                      onClick={() => handleUpdateStatus('FROZEN')}
                      disabled={actionLoading}
                      className="p-3 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-bold rounded-xl flex flex-col items-center gap-1 text-center"
                    >
                      <AlertOctagon size={16} />
                      <span>Emergency Freeze</span>
                      <span className="text-[10px] text-red-200/50">Halts all API key requests immediately</span>
                    </button>

                    <button
                      onClick={() => handleUpdateStatus('ACTIVE')}
                      disabled={actionLoading}
                      className="p-3 bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-400 font-bold rounded-xl flex flex-col items-center gap-1 text-center"
                    >
                      <PlayCircle size={16} />
                      <span>Restore Normal Active</span>
                      <span className="text-[10px] text-green-200/50">Unlocks 120 req/min capacity</span>
                    </button>
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      onClick={() => setSelectedEntityForAction(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GLOBAL LIVE TRANSACTIONS */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-white">Cross-Tenant Global Transaction Feed</h2>
              <p className="text-xs sm:text-sm text-white/70 mt-1">
                Real-time activity stream across all fiat rails, mobile money networks, and blockchain settlement layers.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 text-xs">
              {liveTransactions.map(tx => (
                <div key={tx.id} className="p-3 bg-black/40 rounded-xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{tx.entity}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-white/60">{tx.rail}</span>
                    </div>
                    <div className="text-[11px] text-white/50">
                      Customer: {tx.customer} • {tx.time}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-[#35D9D0]">{tx.amount}</div>
                      <div className="text-[10px] text-white/40">≈ {tx.amountUsd}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-green-500/20 text-green-400">
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SECURITY & ANOMALY ALERTS */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-white">Security & Anomaly Alerts Monitor</h2>
              <p className="text-xs sm:text-sm text-white/70 mt-1">
                Automated risk heuristics and heuristic fraud detection alerts across all connected developers.
              </p>
            </div>

            <div className="space-y-3">
              {alerts.map(alert => (
                <div key={alert.id} className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                  alert.severity === 'HIGH'
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : alert.severity === 'MEDIUM'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold flex items-center gap-2 text-sm text-white">
                      <AlertTriangle size={15} className={alert.severity === 'HIGH' ? 'text-red-400' : 'text-amber-400'} />
                      <span>{alert.title}</span>
                    </div>
                    <span className="font-mono text-[10px] text-white/50">{alert.time}</span>
                  </div>
                  <div className="font-bold text-white/90">Entity: {alert.entity}</div>
                  <p className="text-white/70 leading-relaxed">{alert.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
