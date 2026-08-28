import React, { useState, useEffect } from 'react';
import {
  Code2,
  Terminal,
  Key,
  Webhook,
  ArrowRight,
  Copy,
  Check,
  Shield,
  Layers,
  Zap,
  Server,
  FileText,
  Users,
  PieChart,
  RefreshCw,
  Cpu,
  Lock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ChevronRight,
  ExternalLink,
  BookOpen,
  UserCheck,
  TrendingUp,
  CreditCard,
  Split,
  Sparkles,
  Fingerprint,
  Building2,
  Wallet,
  Activity,
  Globe,
  DollarSign,
} from 'lucide-react';

interface DeveloperDocsProps {
  onBackToHome: () => void;
  appUrl?: string;
}

export const DeveloperDocs: React.FC<DeveloperDocsProps> = ({
  onBackToHome,
  appUrl = 'https://app.proximfi.xyz/',
}) => {
  const [selectedSection, setSelectedSection] = useState<string>('master-vs-dynamic');
  const [selectedLang, setSelectedLang] = useState<'curl' | 'node' | 'python' | 'go'>('curl');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedSection]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  const navItems = [
    {
      group: 'Core FinTech Architecture',
      items: [
        { id: 'master-vs-dynamic', label: 'Master vs Dynamic Accounts', icon: <Building2 size={14} /> },
        { id: 'fee-models', label: 'Pricing & Modular Fee Options', icon: <DollarSign size={14} /> },
        { id: 'overview', label: 'Platform Infrastructure', icon: <Layers size={14} /> },
        { id: 'authentication', label: 'Authentication & Peppered Keys', icon: <Key size={14} /> },
        { id: 'idempotency', label: 'Two-Phase Idempotency', icon: <Clock size={14} /> },
        { id: 'rate-limits', label: 'Rate Limits & Token Bucket', icon: <Zap size={14} /> },
        { id: 'errors', label: 'Error Handling & RFC-7807', icon: <AlertTriangle size={14} /> },
      ],
    },
    {
      group: 'Core APIs (v1 - Live)',
      items: [
        { id: 'dynamic-accounts', label: '1. Dynamic Account Sessions', icon: <Wallet size={14} /> },
        { id: 'identity', label: '2. Identity & 3D Biometrics', icon: <UserCheck size={14} /> },
        { id: 'invoices', label: '3. Invoices & Checkout API', icon: <FileText size={14} /> },
        { id: 'wallets', label: '4. 10-Chain MPC Wallets', icon: <Lock size={14} /> },
        { id: 'payouts', label: '5. Batch Payouts & Payroll', icon: <Users size={14} /> },
        { id: 'resolve-account', label: '6. Account Name Resolution', icon: <CheckCircle2 size={14} /> },
        { id: 'sub-ledger', label: '7. Virtual Sub-Ledger Pots', icon: <Layers size={14} /> },
        { id: 'reports', label: '8. Balance Sheets & P&L', icon: <PieChart size={14} /> },
        { id: 'treasury', label: '9. Devaluation Shield & Sweep', icon: <RefreshCw size={14} /> },
        { id: 'stocks', label: '10. Tokenized Assets & RWAs', icon: <TrendingUp size={14} /> },
        { id: 'brails-rates', label: '11. Live FX Rates', icon: <DollarSign size={14} /> },
        { id: 'brails-accounts', label: '12. Virtual Accounts', icon: <Building2 size={14} /> },
        { id: 'brails-transactions', label: '13. Transaction History', icon: <Activity size={14} /> },
        { id: 'brails-cards', label: '14. Virtual Cards', icon: <CreditCard size={14} /> },
      ],
    },
    {
      group: 'Webhooks & Events',
      items: [
        { id: 'webhooks-overview', label: 'Durable Outbox & Retries', icon: <Webhook size={14} /> },
        { id: 'webhooks-verify', label: 'HMAC-SHA256 Verification', icon: <Shield size={14} /> },
      ],
    },
    {
      group: 'V2 Roadmap & Preview',
      items: [
        { id: 'v2-overview', label: 'V2 Architecture Overview', icon: <Sparkles size={14} /> },
        { id: 'v2-escrows', label: 'Sub-Accounts & Split Escrows', icon: <Split size={14} /> },
        { id: 'v2-cards', label: 'Corporate Card Issuance', icon: <CreditCard size={14} /> },
        { id: 'v2-gasless', label: 'Gasless Transaction Relayers', icon: <Cpu size={14} /> },
      ],
    },
  ];

  const codeSnippets: Record<string, Record<string, string>> = {
    dynamicAccounts: {
      curl: `curl -X POST https://api.proxim.finance/v1/accounts/dynamic-session \\\n  -H "Authorization: Bearer px_live_sk_YOUR_SECRET_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "customerId": "user_948201",\n    "amount": 25000,\n    "currency": "NGN",\n    "customerName": "John Doe",\n    "customerEmail": "john@example.com",\n    "expiresInMinutes": 30,\n    "metadata": { "inAppTopupId": "top_849201" }\n  }'`,
      node: `// Generate a 30-Minute Dynamic Bank Account Session for Wallet Top-Up\nconst res = await fetch('https://api.proxim.finance/v1/accounts/dynamic-session', {\n  method: 'POST',\n  headers: {\n    'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({\n    customerId: 'user_948201',\n    amount: 25000,\n    currency: 'NGN',\n    customerName: 'John Doe',\n    expiresInMinutes: 30,\n    metadata: { topupId: 'top_849201' }\n  })\n});\nconst { data } = await res.json();\nconsole.log('Account Number to Show User:', data.bankDetails.accountNumber);\nconsole.log('Bank Name:', data.bankDetails.bankName);\nconsole.log('Master Settlement Ledger:', data.masterSettlementAccount);`,
      python: `import requests\n\npayload = {\n    'customerId': 'user_948201',\n    'amount': 25000,\n    'currency': 'NGN',\n    'customerName': 'John Doe',\n    'expiresInMinutes': 30\n}\nres = requests.post(\n    'https://api.proxim.finance/v1/accounts/dynamic-session',\n    headers={'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY'},\n    json=payload\n)\nprint(res.json()['data']['bankDetails'])`,
      go: `// Proxim Dynamic Account Session Client\npayload := []byte(\`{\n  "customerId": "user_948201",\n  "amount": 25000,\n  "currency": "NGN",\n  "expiresInMinutes": 30\n}\`)\nreq, _ := http.NewRequest("POST", "https://api.proxim.finance/v1/accounts/dynamic-session", bytes.NewBuffer(payload))\nreq.Header.Set("Authorization", "Bearer px_live_sk_YOUR_SECRET_KEY")\nresp, _ := http.DefaultClient.Do(req)`,
    },
    resolveAccount: {
      curl: `curl -X POST https://api.proxim.finance/v1/payouts/resolve-account \\\n  -H "Authorization: Bearer px_live_sk_YOUR_SECRET_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "accountNumber": "0123456789",\n    "bankCode": "058"\n  }'`,
      node: `const res = await fetch('https://api.proxim.finance/v1/payouts/resolve-account', {\n  method: 'POST',\n  headers: {\n    'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({\n    accountNumber: '0123456789',\n    bankCode: '058'\n  })\n});\nconst { data } = await res.json();\nconsole.log('Beneficiary Name:', data.accountName);`,
      python: `import requests\n\nres = requests.post(\n    'https://api.proxim.finance/v1/payouts/resolve-account',\n    headers={'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY'},\n    json={'accountNumber': '0123456789', 'bankCode': '058'}\n)\nprint(res.json()['data']['accountName'])`,
      go: `// Resolve Bank Account Name\npayload := []byte(\`{"accountNumber":"0123456789","bankCode":"058"}\`)\nreq, _ := http.NewRequest("POST", "https://api.proxim.finance/v1/payouts/resolve-account", bytes.NewBuffer(payload))\nreq.Header.Set("Authorization", "Bearer px_live_sk_YOUR_SECRET_KEY")\nresp, _ := http.DefaultClient.Do(req)`,
    },
    subLedger: {
      curl: `curl -X GET https://api.proxim.finance/v1/ledger/sub-accounts/user_948201?currency=NGN \\\n  -H "Authorization: Bearer px_live_sk_YOUR_SECRET_KEY"`,
      node: `const res = await fetch('https://api.proxim.finance/v1/ledger/sub-accounts/user_948201?currency=NGN', {\n  headers: { 'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY' }\n});\nconst { data } = await res.json();\nconsole.log('Customer Virtual Balance:', data.totalMasterAvailableBalance);`,
      python: `import requests\n\nres = requests.get(\n    'https://api.proxim.finance/v1/ledger/sub-accounts/user_948201?currency=NGN',\n    headers={'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY'}\n)\nprint(res.json()['data'])`,
      go: `// Query Virtual Sub-Ledger Balance\nreq, _ := http.NewRequest("GET", "https://api.proxim.finance/v1/ledger/sub-accounts/user_948201?currency=NGN", nil)\nreq.Header.Set("Authorization", "Bearer px_live_sk_YOUR_SECRET_KEY")\nresp, _ := http.DefaultClient.Do(req)`,
    },
    identity: {
      curl: `# Step 1: Authoritative Identity Lookup (NIN or BVN)\ncurl -X POST https://api.proxim.finance/v1/identity/verify \\\n  -H "Authorization: Bearer px_live_sk_YOUR_SECRET_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "customerId": "cust_849201",\n    "type": "bvn",\n    "value": "22233344455"\n  }'\n\n# Step 2: Initialize 3D Biometric Liveness Capture Session\ncurl -X POST https://api.proxim.finance/v1/identity/liveness/session \\\n  -H "Authorization: Bearer px_live_sk_YOUR_SECRET_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "customerId": "cust_849201"\n  }'`,
      node: `// 1. Authoritative Identity Registry Lookup\nconst verifyRes = await fetch('https://api.proxim.finance/v1/identity/verify', {\n  method: 'POST',\n  headers: {\n    'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({\n    customerId: 'cust_849201',\n    type: 'bvn',\n    value: '22233344455'\n  })\n});\nconst identity = await verifyRes.json();\nconsole.log('Verified Name:', identity.data.firstName, identity.data.lastName);\n\n// 2. Initialize 3D Liveness Session for Client Embed\nconst sessionRes = await fetch('https://api.proxim.finance/v1/identity/liveness/session', {\n  method: 'POST',\n  headers: { 'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY', 'Content-Type': 'application/json' },\n  body: JSON.stringify({ customerId: 'cust_849201' })\n});\nconst session = await sessionRes.json();\nconsole.log('Embed URL:', session.data.livenessUrl);`,
      python: `import requests\n\n# 1. Authoritative Identity Lookup\nres = requests.post(\n    'https://api.proxim.finance/v1/identity/verify',\n    headers={'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY'},\n    json={'customerId': 'cust_849201', 'type': 'bvn', 'value': '22233344455'}\n)\nprint(res.json()['data'])\n\n# 2. 3D Liveness Session Initialization\nsession = requests.post(\n    'https://api.proxim.finance/v1/identity/liveness/session',\n    headers={'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY'},\n    json={'customerId': 'cust_849201'}\n)\nprint('Embed URL:', session.json()['data']['livenessUrl'])`,
      go: `// Proxim EaseID KYC Verification Client\npayload := []byte(\`{"customerId": "cust_849201", "type": "bvn", "value": "22233344455"}\`)\nreq, _ := http.NewRequest("POST", "https://api.proxim.finance/v1/identity/verify", bytes.NewBuffer(payload))\nreq.Header.Set("Authorization", "Bearer px_live_sk_YOUR_SECRET_KEY")\nresp, _ := http.DefaultClient.Do(req)`,
    },
    invoices: {
      curl: `curl -X POST https://api.proxim.finance/v1/invoices \\\n  -H "Authorization: Bearer px_live_sk_YOUR_SECRET_KEY" \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: 7b56a31c-d784-482a-a921-9e48f0211a01" \\\n  -d '{\n    "clientName": "Acme Global Corp",\n    "clientEmail": "finance@acme.com",\n    "totalAmount": 2500.00,\n    "currency": "USD",\n    "settlementType": "crypto",\n    "cryptoNetwork": "Base",\n    "cryptoAsset": "USDC"\n  }'`,
      node: `const res = await fetch('https://api.proxim.finance/v1/invoices', {\n  method: 'POST',\n  headers: {\n    'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY',\n    'Content-Type': 'application/json',\n    'Idempotency-Key': crypto.randomUUID()\n  },\n  body: JSON.stringify({\n    clientName: 'Acme Global Corp',\n    clientEmail: 'finance@acme.com',\n    totalAmount: 2500.00,\n    currency: 'USD',\n    settlementType: 'crypto',\n    cryptoNetwork: 'Base',\n    cryptoAsset: 'USDC'\n  })\n});\nconst invoice = await res.json();\nconsole.log(invoice.data.checkoutUrl);`,
      python: `import requests, uuid\n\npayload = {\n    'clientName': 'Acme Global Corp',\n    'clientEmail': 'finance@acme.com',\n    'totalAmount': 2500.00,\n    'currency': 'USD',\n    'settlementType': 'crypto',\n    'cryptoNetwork': 'Base',\n    'cryptoAsset': 'USDC'\n}\nheaders = {\n    'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY',\n    'Idempotency-Key': str(uuid.uuid4())\n}\nres = requests.post('https://api.proxim.finance/v1/invoices', json=payload, headers=headers)\nprint(res.json()['data']['checkoutUrl'])`,
      go: `// Proxim Go Invoice Client\npayload := []byte(\`{\n  "clientName": "Acme Global Corp",\n  "clientEmail": "finance@acme.com",\n  "totalAmount": 2500.00,\n  "currency": "USD",\n  "settlementType": "crypto",\n  "cryptoNetwork": "Base"\n}\`)\nreq, _ := http.NewRequest("POST", "https://api.proxim.finance/v1/invoices", bytes.NewBuffer(payload))\nreq.Header.Set("Authorization", "Bearer px_live_sk_YOUR_SECRET_KEY")\nresp, _ := http.DefaultClient.Do(req)`,
    },
    payouts: {
      curl: `curl -X POST https://api.proxim.finance/v1/payouts/batch \\\n  -H "Authorization: Bearer px_live_sk_YOUR_SECRET_KEY" \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: pay_batch_94821048201" \\\n  -d '{\n    "title": "Engineering Team Payroll (August 2026)",\n    "currency": "NGN",\n    "recipients": [\n      { "name": "David Adeleke", "accountOrPhone": "0123456789", "bankOrNetwork": "GTBank", "amount": 850000 },\n      { "name": "Sarah Connor", "accountOrPhone": "0987654321", "bankOrNetwork": "Access Bank", "amount": 920000 }\n    ]\n  }'`,
      node: `const res = await fetch('https://api.proxim.finance/v1/payouts/batch', {\n  method: 'POST',\n  headers: {\n    'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY',\n    'Content-Type': 'application/json',\n    'Idempotency-Key': 'payroll-august-2026'\n  },\n  body: JSON.stringify({\n    title: 'Engineering Team Payroll',\n    currency: 'NGN',\n    recipients: [\n      { name: 'David Adeleke', accountOrPhone: '0123456789', bankOrNetwork: 'GTBank', amount: 850000 },\n      { name: 'Sarah Connor', accountOrPhone: '0987654321', bankOrNetwork: 'Access Bank', amount: 920000 }\n    ]\n  })\n});\nconst batchResult = await res.json();\nconsole.log('Batch ID:', batchResult.data.batchId);`,
      python: `import requests\n\npayload = {\n    'title': 'Engineering Team Payroll',\n    'currency': 'NGN',\n    'recipients': [\n        {'name': 'David Adeleke', 'accountOrPhone': '0123456789', 'bankOrNetwork': 'GTBank', 'amount': 850000},\n        {'name': 'Sarah Connor', 'accountOrPhone': '0987654321', 'bankOrNetwork': 'Access Bank', 'amount': 920000}\n    ]\n}\nres = requests.post(\n    'https://api.proxim.finance/v1/payouts/batch',\n    headers={'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY', 'Idempotency-Key': 'batch_001'},\n    json=payload\n)\nprint(res.json())`,
      go: `// Proxim Batch Payout Disbursal\npayload := []byte(\`{\n  "title": "August Payroll",\n  "currency": "NGN",\n  "recipients": [\n    {"name": "David", "accountOrPhone": "0123456789", "amount": 850000}\n  ]\n}\`)\nreq, _ := http.NewRequest("POST", "https://api.proxim.finance/v1/payouts/batch", bytes.NewBuffer(payload))\nreq.Header.Set("Authorization", "Bearer px_live_sk_YOUR_SECRET_KEY")\nresp, _ := http.DefaultClient.Do(req)`,
    },
    reports: {
      curl: `curl -X GET https://api.proxim.finance/v1/reports/balance-sheet \\\n  -H "Authorization: Bearer px_live_sk_YOUR_SECRET_KEY"`,
      node: `const res = await fetch('https://api.proxim.finance/v1/reports/balance-sheet', {\n  headers: { 'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY' }\n});\nconst { data } = await res.json();\nconsole.log('Balance Sheet:', data.assets, data.liabilities);`,
      python: `import requests\nres = requests.get('https://api.proxim.finance/v1/reports/balance-sheet', headers={'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY'})\nprint(res.json()['data'])`,
      go: `// Proxim Balance Sheet Client\nreq, _ := http.NewRequest("GET", "https://api.proxim.finance/v1/reports/balance-sheet", nil)\nreq.Header.Set("Authorization", "Bearer px_live_sk_YOUR_SECRET_KEY")\nresp, _ := http.DefaultClient.Do(req)`,
    },
    treasury: {
      curl: `curl -X POST https://api.proxim.finance/v1/treasury/auto-sweep \\\n  -H "Authorization: Bearer px_live_sk_YOUR_SECRET_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "sourceCurrency": "NGN",\n    "thresholdAmount": 10000000,\n    "destinationAsset": "USDC",\n    "targetChain": "Base"\n  }'`,
      node: `const res = await fetch('https://api.proxim.finance/v1/treasury/auto-sweep', {\n  method: 'POST',\n  headers: {\n    'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({\n    sourceCurrency: 'NGN',\n    thresholdAmount: 10000000,\n    destinationAsset: 'USDC',\n    targetChain: 'Base'\n  })\n});\nconst result = await res.json();\nconsole.log('Sweep Policy Configured:', result.data);`,
      python: `import requests\npayload = {'sourceCurrency': 'NGN', 'thresholdAmount': 10000000, 'destinationAsset': 'USDC', 'targetChain': 'Base'}\nres = requests.post('https://api.proxim.finance/v1/treasury/auto-sweep', headers={'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY'}, json=payload)\nprint(res.json()['data'])`,
      go: `// Proxim Auto-Sweep Policy Client\npayload := []byte(\`{"sourceCurrency":"NGN","thresholdAmount":10000000,"destinationAsset":"USDC","targetChain":"Base"}\`)\nreq, _ := http.NewRequest("POST", "https://api.proxim.finance/v1/treasury/auto-sweep", bytes.NewBuffer(payload))\nreq.Header.Set("Authorization", "Bearer px_live_sk_YOUR_SECRET_KEY")\nresp, _ := http.DefaultClient.Do(req)`,
    },
    stocks: {
      curl: `curl -X GET https://api.proxim.finance/v1/yields/vaults \\\n  -H "Authorization: Bearer px_live_sk_YOUR_SECRET_KEY"`,
      node: `const res = await fetch('https://api.proxim.finance/v1/yields/vaults', {\n  headers: { 'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY' }\n});\nconst { data } = await res.json();\nconsole.log('Available RWA Yield Vaults:', data.vaults);`,
      python: `import requests\nres = requests.get('https://api.proxim.finance/v1/yields/vaults', headers={'Authorization': 'Bearer px_live_sk_YOUR_SECRET_KEY'})\nprint(res.json()['data']['vaults'])`,
      go: `// Proxim Tokenized Vaults Client\nreq, _ := http.NewRequest("GET", "https://api.proxim.finance/v1/yields/vaults", nil)\nreq.Header.Set("Authorization", "Bearer px_live_sk_YOUR_SECRET_KEY")\nresp, _ := http.DefaultClient.Do(req)`,
    },
    webhooksVerify: {
      node: `import crypto from 'crypto';\n\nfunction verifyProximWebhook(rawBodyBuffer, signatureHeader, webhookSecret) {\n  const parts = Object.fromEntries(signatureHeader.split(',').map(kv => kv.split('=')));\n  const timestamp = parts.t;\n  const expectedSignature = parts.v1;\n\n  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) {\n    throw new Error('Webhook timestamp outside allowed tolerance (Replay attack prevention).');\n  }\n\n  const signaturePayload = \`\${timestamp}.\${rawBodyBuffer.toString('utf8')}\`;\n  const computedSignature = crypto\n    .createHmac('sha256', webhookSecret)\n    .update(signaturePayload)\n    .digest('hex');\n\n  return crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(expectedSignature));\n}`,
      python: `import hmac, hashlib, time\n\ndef verify_proxim_webhook(raw_body_bytes, signature_header, webhook_secret):\n    parts = dict(kv.split('=') for kv in signature_header.split(','))\n    timestamp = parts['t']\n    expected_signature = parts['v1']\n\n    if abs(time.time() - int(timestamp)) > 300:\n        raise ValueError("Timestamp outside tolerance")\n\n    signature_payload = f"{timestamp}.".encode('utf-8') + raw_body_bytes\n    computed = hmac.new(webhook_secret.encode('utf-8'), signature_payload, hashlib.sha256).hexdigest()\n\n    return hmac.compare_digest(computed, expected_signature)`,
      curl: `# Webhook Header Format Sent by Proxim:\n# X-Proxim-Signature: t=1755829200,v1=a9c8f01b8e4...`,
      go: `// Proxim Webhook Verifier\nmac := hmac.New(sha256.New, []byte(secret))\nmac.Write([]byte(fmt.Sprintf("%s.%s", timestamp, rawBody)))\nexpected := hex.EncodeToString(mac.Sum(nil))\nreturn hmac.Equal([]byte(expected), []byte(receivedSig))`,
    },
  };

  return (
    <div className="min-h-screen bg-[#060B14] text-[#F7F8F4] font-sans antialiased">
      
      {/* Top Navigation Banner */}
      <header className="sticky top-0 z-50 bg-[#060B14]/95 backdrop-blur-2xl border-b border-white/10 px-6 sm:px-10 h-16 sm:h-20 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-2.5 text-white hover:text-[#35D9D0] transition-colors font-extrabold text-lg sm:text-xl"
          >
            <img src="/proxim-icon.png" alt="Proxim" className="w-7 h-7 rounded-lg" />
            <span>Proxim</span>
            <span className="text-xs bg-[#35D9D0]/15 text-[#35D9D0] border border-[#35D9D0]/30 font-bold px-2 py-0.5 rounded-full ml-1">
              Developers & BaaS
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHome}
            className="text-xs sm:text-sm font-semibold text-white/70 hover:text-white transition-colors"
          >
            ← Back to Home
          </button>
          <button
            onClick={() => {
              window.location.hash = 'dashboard';
            }}
            className="btn-primary !text-xs sm:!text-sm !py-2 !px-4 !rounded-xl flex items-center gap-1.5"
          >
            <span>Developer Console</span> <Zap size={14} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col lg:flex-row gap-10">
        
        {/* Left Sidebar Nav */}
        <aside className="lg:w-72 shrink-0">
          <div className="sticky top-28 space-y-6">
            {navItems.map((group, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#35D9D0]/80 px-3">
                  {group.group}
                </div>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedSection(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-[13px] font-semibold transition-all text-left ${
                        selectedSection === item.id
                          ? 'bg-[#35D9D0]/15 text-[#35D9D0] border border-[#35D9D0]/30'
                          : 'text-white/70 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-xs space-y-2">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Server size={13} className="text-[#35D9D0]" /> API Base URL
              </div>
              <code className="block bg-black/40 text-[#35D9D0] p-2 rounded-lg text-[11px] font-mono select-all">
                https://api.proxim.finance/v1
              </code>
            </div>

            <div className="p-4 rounded-2xl bg-[#09171C] border border-[#35D9D0]/20 text-xs space-y-2 text-white/80">
              <div className="font-bold text-[#35D9D0] flex items-center gap-1">
                <CheckCircle2 size={13} /> Architecture Guarantees
              </div>
              <ul className="space-y-1 text-[11px] text-white/70 list-disc list-inside">
                <li>Master Static vs Dynamic Accounts</li>
                <li>Double-Entry Balanced Ledger</li>
                <li>Pessimistic Balance Pre-Flights</li>
                <li>Authoritative Identity & 3D Liveness</li>
                <li>5-Attempt Webhook Outbox Retries</li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Center / Right Content Pane */}
        <main className="flex-1 min-w-0 space-y-10">
          
          {/* SECTION: MASTER VS DYNAMIC ACCOUNTS */}
          {selectedSection === 'master-vs-dynamic' && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#35D9D0]/10 border border-[#35D9D0]/20 text-[#35D9D0] text-xs font-bold mb-3">
                  <Building2 size={13} /> Core FinTech Architecture
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Master Static Account vs. Dynamic Transaction Accounts
                </h1>
                <p className="text-sm sm:text-base text-white/70 mt-2 leading-relaxed">
                  Due to the multi-tier compliance structure of global banking rails, businesses operating on Proxim hold a permanent <strong>Master Static Account</strong>, while their end-users receive lightweight <strong>Dynamic Transaction-Based Accounts</strong>.
                </p>
              </div>

              {/* Visual Breakdown Card */}
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
                <div className="grid md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-black/40 rounded-xl border border-[#35D9D0]/30 space-y-2">
                    <div className="font-extrabold text-[#35D9D0] text-sm flex items-center gap-2">
                      <Building2 size={16} /> 1. The Company (Master Static Account)
                    </div>
                    <p className="text-white/70 leading-relaxed">
                      Provisioned once during corporate onboarding (CAC/KYB). This is your permanent treasury vault holding all collected fiat and digital dollars. Used for funding batch payroll, corporate expenses, and withdrawal settlements.
                    </p>
                    <div className="p-2 bg-white/5 rounded font-mono text-[11px] text-white/80">
                      Ledger ID: {`{entityId}`}_cash_NGN (Permanent)
                    </div>
                  </div>

                  <div className="p-4 bg-black/40 rounded-xl border border-blue-500/30 space-y-2">
                    <div className="font-extrabold text-blue-400 text-sm flex items-center gap-2">
                      <Wallet size={16} /> 2. Your Customers (Dynamic Accounts)
                    </div>
                    <p className="text-white/70 leading-relaxed">
                      Generated on-demand via <code className="text-[#35D9D0]">/v1/accounts/dynamic-session</code> with 30m–24h expiry. End-users pay into this dynamic account; Proxim automatically sweeps the deposit into your Master Ledger and emits a webhook.
                    </p>
                    <div className="p-2 bg-white/5 rounded font-mono text-[11px] text-white/80">
                      Session ID: dyn_{`{session_id}`} (Ephemeral)
                    </div>
                  </div>
                </div>

                {/* Why this saves millions in compliance */}
                <div className="p-4 rounded-xl bg-[#09171C] border border-white/10 text-xs space-y-2">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Shield size={14} className="text-[#35D9D0]" /> Why This Architecture Protects SMEs & Neo-Banks:
                  </div>
                  <ul className="text-white/70 space-y-1.5 list-disc list-inside">
                    <li><strong>Zero Account Maintenance Fees:</strong> You do not pay monthly bank maintenance fees for 50,000 inactive customer accounts.</li>
                    <li><strong>Instant Checkout:</strong> End-users do not have to submit utility bills or pass full KYB before completing a payment cart.</li>
                    <li><strong>Automated Double-Entry Sweep:</strong> Every customer deposit automatically debits the clearing rail and credits your Master Operational Ledger with zero manual reconciliation.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: PRICING & MODULAR FEE OPTIONS */}
          {selectedSection === 'fee-models' && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold mb-3">
                  <DollarSign size={13} /> Institutional B2B Monetization
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Pricing Models: Pay-As-You-Go vs. Flat Modular SaaS Subscriptions
                </h1>
                <p className="text-sm sm:text-base text-white/70 mt-2 leading-relaxed">
                  High-volume SMEs and neo-banks can choose between <strong>Dynamic Pay-As-You-Go % Fees</strong> or a <strong>Flat Modular Monthly SaaS Subscription (0% Processing Fee / FX Clearing Spreads Only)</strong>.
                </p>
              </div>

              {/* Dual Model Comparison */}
              <div className="grid md:grid-cols-2 gap-4 text-xs">
                
                {/* Model 1: Pay-As-You-Go */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                  <div className="font-extrabold text-[#35D9D0] text-sm flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Zap size={15} /> Option A: Dynamic Pay-As-You-Go</span>
                    <span className="text-[10px] bg-[#35D9D0]/10 text-[#35D9D0] px-2 py-0.5 rounded-full font-bold">Standard</span>
                  </div>
                  <p className="text-white/70 leading-relaxed">
                    Zero monthly subscription commitment. Best for early-stage fintechs, low or variable transaction volume.
                  </p>
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-white/60">🇳🇬 NGN Dynamic Accounts</span>
                      <span className="font-mono font-bold text-white">1.0% (Capped at ₦2,000)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-white/60">🇺🇸 / 🇪🇺 / 🇬🇧 Collections</span>
                      <span className="font-mono font-bold text-white">0.75% + $0.30</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-white/60">🇰🇪 / 🇬🇭 / 🇺🇬 Mobile Money</span>
                      <span className="font-mono font-bold text-white">1.20% flat</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-white/60">Outbound Batch Payouts</span>
                      <span className="font-mono font-bold text-white">₦50 / $0.50 flat</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-white/60">Self-Custody Auto-Sweep</span>
                      <span className="font-mono font-bold text-white">0.30% conversion</span>
                    </div>
                  </div>
                </div>

                {/* Model 2: Flat Modular SaaS Subscription */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-purple-500/10 to-transparent border border-purple-500/30 space-y-3">
                  <div className="font-extrabold text-purple-300 text-sm flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Layers size={15} /> Option B: Modular SaaS Subscriptions</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold">0% Fee (FX Only)</span>
                  </div>
                  <p className="text-white/70 leading-relaxed">
                    Pay a predictable monthly fee for specific feature modules. Enjoy <strong>0% platform fees</strong>, paying only tight interbank FX spreads on currency conversions.
                  </p>
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-white/60">Dynamic Accounts Rail Suite</span>
                      <span className="font-mono font-bold text-purple-300">$99 / month (0% Fee)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-white/60">Identity & 3D Biometrics KYC</span>
                      <span className="font-mono font-bold text-purple-300">$149 / month (1,000 free)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-white/60">Multi-Chain MPC Wallet Engine</span>
                      <span className="font-mono font-bold text-purple-300">$199 / month (Unlimited)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-white/60">Batch Payroll & Disbursals Suite</span>
                      <span className="font-mono font-bold text-purple-300">$79 / month (At-Cost)</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-white/80 font-bold">All-In-One BaaS Enterprise Pass</span>
                      <span className="font-mono font-extrabold text-green-400">$399 / month</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* FX Spread Architecture Note */}
              <div className="p-5 rounded-2xl bg-[#09171C] border border-white/10 space-y-2 text-xs">
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <RefreshCw size={15} className="text-[#35D9D0]" /> How FX Spreads Work on Modular Subscriptions:
                </div>
                <p className="text-white/80 leading-relaxed">
                  On the <strong>Modular SaaS Subscription</strong>, Proxim removes all percentage processing fees. Proxim clears cross-border transactions at wholesale institutional rates with a narrow, transparent <strong>0.25% to 0.40% FX spread</strong>. This guarantees high-volume SMEs save up to <strong>75% in total transaction costs</strong> compared to traditional percentage-fee payment gateways.
                </p>
              </div>
            </div>
          )}

          {/* SECTION: PLATFORM INFRASTRUCTURE OVERVIEW */}
          {selectedSection === 'overview' && (
            <div className="space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#35D9D0]/10 border border-[#35D9D0]/20 text-[#35D9D0] text-xs font-bold mb-3">
                  <Layers size={13} /> Institutional Technical Architecture
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Proxim Financial Network: Platform Infrastructure
                </h1>
                <p className="text-sm sm:text-base text-white/70 mt-2 leading-relaxed">
                  Proxim is a unified <strong>Banking-as-a-Service (BaaS) and Cross-Border Liquidity Engine</strong> designed to orchestrate fiat clearing across 7 global currencies, 10-chain non-custodial MPC settlements, and automated double-entry ledger balancing under an <em>invisible infrastructure</em> model.
                </p>
              </div>

              {/* 4-Tier Architectural Stack Diagram */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">4-Tier System Architecture</h3>
                
                <div className="grid md:grid-cols-2 gap-4 text-xs">
                  {/* Layer 1 */}
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[#35D9D0] text-sm flex items-center gap-2">
                        <Zap size={16} /> 1. Client & Integration Layer
                      </span>
                      <span className="text-[10px] bg-white/10 text-white/80 px-2 py-0.5 rounded font-mono">Edge</span>
                    </div>
                    <p className="text-white/70 leading-relaxed">
                      Developer REST API (<code className="text-[#35D9D0]">/v1/*</code>), Mobile-Optimized Web App, Developer Console Sandbox, and Super Admin Command Center.
                    </p>
                    <div className="p-2 bg-black/40 rounded border border-white/5 font-mono text-[11px] text-white/60">
                      Standard JSON REST & RFC-7807 Problem Details
                    </div>
                  </div>

                  {/* Layer 2 */}
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-blue-400 text-sm flex items-center gap-2">
                        <Shield size={16} /> 2. Gateway & Security Perimeter
                      </span>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono">Perimeter</span>
                    </div>
                    <p className="text-white/70 leading-relaxed">
                      TLS 1.3 HTTPS enforcement, Enterprise SSRF & RFC-1918 CIDR validators, Peppered SHA-256 API Key Authentication, and Groq Llama 3.3 70B AI Security Sentinel.
                    </p>
                    <div className="p-2 bg-black/40 rounded border border-white/5 font-mono text-[11px] text-white/60">
                      In-Memory Token Bucket: 120 req/min dynamic SLA
                    </div>
                  </div>

                  {/* Layer 3 */}
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-purple-400 text-sm flex items-center gap-2">
                        <RefreshCw size={16} /> 3. Core Financial & Settlement Engines
                      </span>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono">Engine</span>
                    </div>
                    <p className="text-white/70 leading-relaxed">
                      Dual B2B Fee Engine (PAYG vs Modular SaaS 0% Fee), 60s Cryptographic FX Quote Locks, NEAR Defuse 1Click Intent Solvers, and NEAR MPC Multi-Chain Signers (<code className="text-purple-300">v1.signer</code>).
                    </p>
                    <div className="p-2 bg-black/40 rounded border border-white/5 font-mono text-[11px] text-white/60">
                      Atomic Compensating Dispute Reversal Engine
                    </div>
                  </div>

                  {/* Layer 4 */}
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-green-400 text-sm flex items-center gap-2">
                        <CheckCircle2 size={16} /> 4. Double-Entry Persistence Layer
                      </span>
                      <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded font-mono">Storage</span>
                    </div>
                    <p className="text-white/70 leading-relaxed">
                      Managed PostgreSQL with AES-256 disk encryption, real-time balanced Asset/Liability sub-ledgers, Corporate Tax Fee Ledger, and Durable Exponential Backoff Webhook Outbox.
                    </p>
                    <div className="p-2 bg-black/40 rounded border border-white/5 font-mono text-[11px] text-white/60">
                      Σ Debits ≡ Σ Credits Mathematical Invariant
                    </div>
                  </div>
                </div>
              </div>

              {/* Supported Rails & Settlement Matrix */}
              <div className="p-6 rounded-2xl bg-[#09171C] border border-white/10 space-y-4">
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <Globe size={16} className="text-[#35D9D0]" /> Supported Fiat Clearing Rails Matrix
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <div className="font-bold text-[#35D9D0]">NGN (Naira)</div>
                    <div className="text-white/60 text-[11px]">NIBSS Instant / Dynamic NUBAN</div>
                    <div className="text-green-400 font-mono text-[10px] mt-1">Sub-second</div>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <div className="font-bold text-[#4A8CFF]">USD (Dollar)</div>
                    <div className="text-white/60 text-[11px]">Fedwire & Domestic ACH</div>
                    <div className="text-green-400 font-mono text-[10px] mt-1">Same-Day / Realtime</div>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <div className="font-bold text-[#7567F8]">EUR (Euro)</div>
                    <div className="text-white/60 text-[11px]">SEPA Instant / vIBAN</div>
                    <div className="text-green-400 font-mono text-[10px] mt-1">Sub-10s</div>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <div className="font-bold text-[#22C55E]">GBP (Pound)</div>
                    <div className="text-white/60 text-[11px]">Faster Payments (FPS)</div>
                    <div className="text-green-400 font-mono text-[10px] mt-1">Real-Time</div>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <div className="font-bold text-[#F59E0B]">KES (Shilling)</div>
                    <div className="text-white/60 text-[11px]">Safaricom M-Pesa STK</div>
                    <div className="text-green-400 font-mono text-[10px] mt-1">Real-Time</div>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <div className="font-bold text-[#F43F5E]">GHS (Cedi)</div>
                    <div className="text-white/60 text-[11px]">MTN & AirtelTigo MoMo</div>
                    <div className="text-green-400 font-mono text-[10px] mt-1">Real-Time</div>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <div className="font-bold text-[#EC4899]">UGX (Shilling)</div>
                    <div className="text-white/60 text-[11px]">MTN Mobile Money</div>
                    <div className="text-green-400 font-mono text-[10px] mt-1">Real-Time</div>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <div className="font-bold text-cyan-400">10-Chain Crypto</div>
                    <div className="text-white/60 text-[11px]">Base, Solana, Arb, Tron, Near</div>
                    <div className="text-green-400 font-mono text-[10px] mt-1">Sub-3s Solvers</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: 1. DYNAMIC ACCOUNT SESSIONS */}
          {selectedSection === 'dynamic-accounts' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">POST</span>
                  <code className="text-sm font-bold text-white">/v1/accounts/dynamic-session</code>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">1. Dynamic Transaction-Based Account Sessions</h2>
                <p className="text-sm text-white/70 mt-1">
                  Generate a dedicated, time-bound virtual bank account for an end-user checkout or wallet top-up without creating permanent banking compliance records.
                </p>
              </div>

              {/* Multi-Currency Rails Matrix */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3 text-xs">
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <Globe size={16} className="text-[#35D9D0]" /> Supported Multi-Currency Dynamic Rails & Payout Disbursals
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                    <div className="font-bold text-[#35D9D0]">🇳🇬 Nigerian Naira (NGN)</div>
                    <div className="text-white/60 text-[11px]">Collections: NIP Instant Virtual NUBAN</div>
                    <div className="text-white/40 text-[10px]">Payouts: All Nigerian Commercial Banks</div>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                    <div className="font-bold text-[#4A8CFF]">🇺🇸 US Dollar (USD)</div>
                    <div className="text-white/60 text-[11px]">Collections: Dynamic ACH & Fedwire</div>
                    <div className="text-white/40 text-[10px]">Payouts: Domestic ACH & Fedwire</div>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                    <div className="font-bold text-purple-400">🇪🇺 Euro (EUR)</div>
                    <div className="text-white/60 text-[11px]">Collections: Dynamic SEPA & SEPA Instant</div>
                    <div className="text-white/40 text-[10px]">Payouts: Eurozone SEPA Credit Transfers</div>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                    <div className="font-bold text-green-400">🇬🇧 British Pound (GBP)</div>
                    <div className="text-white/60 text-[11px]">Collections: Faster Payments (FPS) & BACS</div>
                    <div className="text-white/40 text-[10px]">Payouts: UK Faster Payments Disbursals</div>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                    <div className="font-bold text-amber-400">🇰🇪 Kenyan Shilling (KES)</div>
                    <div className="text-white/60 text-[11px]">Collections: Safaricom M-Pesa & Airtel</div>
                    <div className="text-white/40 text-[10px]">Payouts: M-Pesa B2C & Bank Accounts</div>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                    <div className="font-bold text-rose-400">🇬🇭 / 🇺🇬 Ghana & Uganda (GHS/UGX)</div>
                    <div className="text-white/60 text-[11px]">Collections: MTN & Airtel Mobile Money</div>
                    <div className="text-white/40 text-[10px]">Payouts: MTN MoMo & Local Banks</div>
                  </div>
                </div>
              </div>

              {/* End-User Self-Custodial Auto-Sweep Feature */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-[#35D9D0]/10 to-transparent border border-[#35D9D0]/30 space-y-2 text-xs">
                <div className="font-bold text-[#35D9D0] text-sm flex items-center gap-2">
                  <Shield size={16} /> Non-Custodial Sovereignty Shield: Real-Time Self-Custody Sweep
                </div>
                <p className="text-white/80 leading-relaxed">
                  To ensure developers and third-party apps never hold custodial control over user funds (and to protect users if a partner platform experiences downtime or shuts down), pass <code className="text-[#35D9D0]">"autoSweepToCrypto": true</code> with the user's <code className="text-[#35D9D0]">"destinationAddress"</code>. Proxim instantly converts incoming fiat deposits into digital dollars (USDC/USDT) and sweeps them directly to the end-user's sovereign wallet.
                </p>
              </div>

              {/* What it does & How it works */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3 text-xs">
                <div className="font-bold text-white text-sm">How the Dynamic Session Pipeline Executes:</div>
                <ol className="list-decimal list-inside space-y-2 text-white/70">
                  <li>Your application calls <code className="text-[#35D9D0]">POST /v1/accounts/dynamic-session</code> with a <code className="text-white">customerId</code> and desired fiat currency.</li>
                  <li>Proxim returns dynamic bank or mobile money instructions and a unique payment reference (<code className="text-[#35D9D0]">PX-DYN-XXXX</code>).</li>
                  <li>Your user transfers funds via their local banking app or mobile money (e.g. M-Pesa, NIP, SEPA).</li>
                  <li>Proxim's clearing listener detects the deposit, applies the settlement policy (Master Treasury Credit or Self-Custody Crypto Sweep), and dispatches an <code className="text-[#35D9D0]">account.deposit.completed</code> webhook.</li>
                </ol>
              </div>

              {/* Implementation DOs and DONTs */}
              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="font-bold text-white flex items-center gap-1.5 text-sm">
                    <CheckCircle2 size={15} className="text-green-400" /> Implementation DOs
                  </div>
                  <ul className="space-y-1.5 text-white/70 list-disc list-inside">
                    <li>Pass your internal customer UUID in <code className="text-[#35D9D0]">customerId</code> to correlate deposits automatically.</li>
                    <li>Display a countdown timer (e.g. 30 minutes) on your checkout UI before refreshing the session.</li>
                    <li>Listen to the signed HMAC webhook to unlock digital goods or top-up in-app wallets.</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-2">
                  <div className="font-bold text-red-400 flex items-center gap-1.5 text-sm">
                    <XCircle size={15} className="text-red-400" /> Implementation DON'Ts
                  </div>
                  <ul className="space-y-1.5 text-white/70 list-disc list-inside">
                    <li>Do not instruct users to save dynamic transaction account numbers as permanent beneficiaries.</li>
                    <li>Do not create multiple simultaneous sessions for the exact same cart item.</li>
                  </ul>
                </div>
              </div>

              {/* Code Snippet */}
              <div className="rounded-2xl bg-[#09171C] border border-white/10 overflow-hidden">
                <div className="px-4 py-3 bg-black/40 border-b border-white/10 flex justify-between items-center">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Create Dynamic Account Session</span>
                  <div className="flex gap-1.5">
                    {(['curl', 'node', 'python', 'go'] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setSelectedLang(lang)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-md uppercase ${
                          selectedLang === lang ? 'bg-[#35D9D0] text-black' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4 font-mono text-xs text-[#35D9D0] overflow-x-auto relative">
                  <button
                    onClick={() => copyToClipboard(codeSnippets.dynamicAccounts[selectedLang] || codeSnippets.dynamicAccounts.curl, 'dyn-code')}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 text-[11px]"
                  >
                    {copiedSnippet === 'dyn-code' ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    <span>{copiedSnippet === 'dyn-code' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <pre className="m-0 leading-relaxed">{codeSnippets.dynamicAccounts[selectedLang] || codeSnippets.dynamicAccounts.curl}</pre>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: 6. ACCOUNT NAME RESOLUTION */}
          {selectedSection === 'resolve-account' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">POST</span>
                  <code className="text-sm font-bold text-white">/v1/payouts/resolve-account</code>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">6. Real-Time Account Name Resolution</h2>
                <p className="text-sm text-white/70 mt-1">
                  Resolve the official legal account holder name from any bank account number and bank code before initiating single or batch payouts.
                </p>
              </div>

              <div className="rounded-2xl bg-[#09171C] border border-white/10 overflow-hidden">
                <div className="px-4 py-3 bg-black/40 border-b border-white/10 flex justify-between items-center">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Resolve Account Request</span>
                  <div className="flex gap-1.5">
                    {(['curl', 'node', 'python', 'go'] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setSelectedLang(lang)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-md uppercase ${
                          selectedLang === lang ? 'bg-[#35D9D0] text-black' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4 font-mono text-xs text-[#35D9D0] overflow-x-auto relative">
                  <pre className="m-0 leading-relaxed">{codeSnippets.resolveAccount[selectedLang] || codeSnippets.resolveAccount.curl}</pre>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: 7. VIRTUAL SUB-LEDGER POTS */}
          {selectedSection === 'sub-ledger' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">GET</span>
                  <code className="text-sm font-bold text-white">/v1/ledger/sub-accounts/:customerId</code>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">7. Virtual Sub-Ledger Pots & Partitioning</h2>
                <p className="text-sm text-white/70 mt-1">
                  Query virtual customer balances partitioned internally under your company's single Master Static Holding Account without opening external bank accounts.
                </p>
              </div>

              <div className="p-4 font-mono text-xs text-[#35D9D0] bg-[#09171C] rounded-2xl border border-white/10 overflow-x-auto">
                <pre className="m-0 leading-relaxed">{codeSnippets.subLedger[selectedLang] || codeSnippets.subLedger.curl}</pre>
              </div>
            </div>
          )}

          {/* SECTION: 2. IDENTITY & BIOMETRICS */}
          {selectedSection === 'identity' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">POST</span>
                  <code className="text-sm font-bold text-white">/v1/identity/verify</code>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">2. Proxim Identity Engine & 3D Biometrics</h2>
                <p className="text-sm text-white/70 mt-1">
                  Verify customer identities directly against national registries (NIN, BVN) and capture 3D biometric selfie liveness with automated AML compliance screening.
                </p>
              </div>

              <div className="p-4 font-mono text-xs text-[#35D9D0] bg-[#09171C] rounded-2xl border border-white/10 overflow-x-auto">
                <pre className="m-0 leading-relaxed">{codeSnippets.identity[selectedLang] || codeSnippets.identity.curl}</pre>
              </div>
            </div>
          )}

          {/* SECTION: 3. INVOICES */}
          {selectedSection === 'invoices' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">POST</span>
                  <code className="text-sm font-bold text-white">/v1/invoices</code>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">3. Multi-Rail Invoices & Standalone Checkout</h2>
                <p className="text-sm text-white/70 mt-1">
                  Issue dynamic invoices settleable via direct bank transfer (NUBAN, ACH, SEPA) or stablecoins on 10 chains with standalone web checkout and downloadable SVG image cards.
                </p>
              </div>

              <div className="p-4 font-mono text-xs text-[#35D9D0] bg-[#09171C] rounded-2xl border border-white/10 overflow-x-auto">
                <pre className="m-0 leading-relaxed">{codeSnippets.invoices[selectedLang] || codeSnippets.invoices.curl}</pre>
              </div>
            </div>
          )}

          {/* SECTION: 4. 10-CHAIN MPC WALLETS */}
          {selectedSection === 'wallets' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">POST</span>
                  <code className="text-sm font-bold text-white">/v1/wallets/derive</code>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">4. 10-Chain Non-Custodial MPC Wallets</h2>
                <p className="text-sm text-white/70 mt-1">
                  Derive non-custodial multi-chain deposit addresses for any customer or transaction context on demand without holding private keys.
                </p>
              </div>

              <div className="p-4 font-mono text-xs text-[#35D9D0] bg-[#09171C] rounded-2xl border border-white/10 overflow-x-auto">
                <pre className="m-0 leading-relaxed">{codeSnippets.dynamicAccounts[selectedLang] || codeSnippets.dynamicAccounts.curl}</pre>
              </div>
            </div>
          )}

          {/* SECTION: 5. BATCH PAYOUTS */}
          {selectedSection === 'payouts' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">POST</span>
                  <code className="text-sm font-bold text-white">/v1/payouts/batch</code>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">5. Batch Payouts & Double-Entry Ledger</h2>
                <p className="text-sm text-white/70 mt-1">
                  Disburse batch payments to thousands of bank accounts simultaneously with automated double-entry ledger balancing (<code className="text-[#35D9D0]">Debit Customer Cash, Credit Clearing Liability</code>).
                </p>
              </div>

              <div className="p-4 font-mono text-xs text-[#35D9D0] bg-[#09171C] rounded-2xl border border-white/10 overflow-x-auto">
                <pre className="m-0 leading-relaxed">{codeSnippets.payouts[selectedLang] || codeSnippets.payouts.curl}</pre>
              </div>
            </div>
          )}

          {selectedSection === 'brails-rates' && (
            <div className="space-y-6">
              <div><div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">GET</span><code className="text-sm font-bold text-white">/v1/rates</code></div><h2 className="text-xl sm:text-2xl font-extrabold text-white">11. Live FX Rates</h2><p className="text-sm text-white/70 mt-1">Fetch the current Proxim rate table. This endpoint takes no query parameters and returns live rates under <code>data</code>; do not use documentation sample values for pricing.</p></div>
              <div className="p-4 font-mono text-xs text-[#35D9D0] bg-[#09171C] rounded-2xl border border-white/10 overflow-x-auto"><pre className="m-0 leading-relaxed">{`curl https://api.proxim.finance/v1/rates \\\n+  -H "Authorization: Bearer px_live_sk_YOUR_SECRET_KEY" \\\n+  -H "Accept: application/json"`}</pre></div>
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 text-sm text-white/70 space-y-2"><p>Response fields include <code className="text-[#35D9D0]">data.NGN.buyRate</code>, <code className="text-[#35D9D0]">data.NGN.sellRate</code>, and equivalent currency entries.</p><p>Display the retrieval timestamp and use Proxim's executable transaction quote when available. Never hard-code sample rates.</p></div>
            </div>
          )}

          {selectedSection === 'brails-accounts' && (
            <div className="space-y-6"><div><div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">GET</span><code className="text-sm font-bold text-white">/v1/accounts</code></div><h2 className="text-xl sm:text-2xl font-extrabold text-white">12. Virtual Accounts</h2><p className="text-sm text-white/70 mt-1">List the selected business or personal entity's persistent virtual accounts. Proxim scopes results to the authenticated API-key entity.</p></div><div className="p-4 font-mono text-xs text-[#35D9D0] bg-[#09171C] rounded-2xl border border-white/10 overflow-x-auto"><pre className="m-0 leading-relaxed">{`curl "https://api.proxim.finance/v1/accounts" \\\n+  -H "Authorization: Bearer px_live_sk_YOUR_SECRET_KEY"`}</pre></div><p className="text-sm text-white/70">Use dynamic sessions for temporary end-customer collection instructions and persistent accounts for approved rails. Account balances remain isolated to the selected Proxim entity.</p></div>
          )}

          {selectedSection === 'brails-transactions' && (
            <div className="space-y-6"><div><div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">GET</span><code className="text-sm font-bold text-white">/v1/transactions</code></div><h2 className="text-xl sm:text-2xl font-extrabold text-white">13. Transaction History</h2><p className="text-sm text-white/70 mt-1">Retrieve the authenticated Proxim account's transaction history with status, currency, action, channel, date-range, limit, and cursor filters.</p></div><div className="p-4 font-mono text-xs text-[#35D9D0] bg-[#09171C] rounded-2xl border border-white/10 overflow-x-auto"><pre className="m-0 leading-relaxed">{`curl "https://api.proxim.finance/v1/transactions?currency=NGN&status=success&limit=50" \\\n+  -H "Authorization: Bearer px_live_sk_YOUR_SECRET_KEY"\n\n# A transaction detail request uses /v1/transactions/{transactionId}`}</pre></div><p className="text-sm text-white/70">Transaction results are tenant-scoped. A business or neobank can only access transactions belonging to the entity attached to its API key.</p></div>
          )}

          {selectedSection === 'brails-cards' && (
            <div className="space-y-6"><div><div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">POST / GET</span><code className="text-sm font-bold text-white">/v1/cards</code></div><h2 className="text-xl sm:text-2xl font-extrabold text-white">14. Virtual Card Issuance and Lifecycle</h2><p className="text-sm text-white/70 mt-1">Issue and operate Proxim virtual cards. Card records are persisted and isolated by API-key entity and account kind.</p></div><div className="p-4 font-mono text-xs text-[#35D9D0] bg-[#09171C] rounded-2xl border border-white/10 overflow-x-auto"><pre className="m-0 leading-relaxed">{`GET  /v1/cards?customerId=CUSTOMER_ID&accountKind=BUSINESS\nPOST /v1/cards\nPOST /v1/cards/:cardId/freeze\nPOST /v1/cards/:cardId/unfreeze\nPOST /v1/cards/:cardId/top-up\nPOST /v1/cards/:cardId/withdraw\nPOST /v1/cards/:cardId/reconcile`}</pre></div><div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 text-sm text-white/70 space-y-2"><p>Issuance creates and persists a Proxim card record and applies the configured issuance fee. Top-ups and withdrawals apply the configured transaction fees.</p><p>Personal and business cards use different entities. Every operation is scoped to the API key's entity; card records and funds cannot cross account boundaries.</p></div></div>
          )}

          {/* SECTION: 8. BALANCE SHEETS & P&L REPORTS */}
          {selectedSection === 'reports' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">GET</span>
                  <code className="text-sm font-bold text-white">/v1/reports/balance-sheet</code>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">8. Corporate Balance Sheets & P&L Telemetry</h2>
                <p className="text-sm text-white/70 mt-1">
                  Retrieve cryptographic, double-entry financial statements and fee ledger breakdowns aggregated across all currency holding accounts and sub-ledgers.
                </p>
              </div>

              <div className="p-4 font-mono text-xs text-[#35D9D0] bg-[#09171C] rounded-2xl border border-white/10 overflow-x-auto">
                <pre className="m-0 leading-relaxed">{codeSnippets.reports[selectedLang] || codeSnippets.reports.curl}</pre>
              </div>
            </div>
          )}

          {/* SECTION: 9. DEVALUATION SHIELD & AUTO-SWEEP */}
          {selectedSection === 'treasury' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">POST</span>
                  <code className="text-sm font-bold text-white">/v1/treasury/auto-sweep</code>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">9. Currency Devaluation Shield & Treasury Auto-Sweep</h2>
                <p className="text-sm text-white/70 mt-1">
                  Program automated threshold sweeps from local volatile currencies (NGN, KES, GHS) into yield-bearing digital dollars (USDC on Base Network) with zero manual intervention.
                </p>
              </div>

              <div className="p-4 font-mono text-xs text-[#35D9D0] bg-[#09171C] rounded-2xl border border-white/10 overflow-x-auto">
                <pre className="m-0 leading-relaxed">{codeSnippets.treasury[selectedLang] || codeSnippets.treasury.curl}</pre>
              </div>
            </div>
          )}

          {/* SECTION: 10. TOKENIZED ASSETS & RWAS */}
          {selectedSection === 'stocks' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">GET</span>
                  <code className="text-sm font-bold text-white">/v1/yields/vaults</code>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">10. Tokenized Real-World Assets & Institutional Yield</h2>
                <p className="text-sm text-white/70 mt-1">
                  Access institutional yield strategies (US Treasury Bills via Ondo USDY, high-yield institutional cash vaults) seamlessly through unified BaaS endpoints.
                </p>
              </div>

              <div className="p-4 font-mono text-xs text-[#35D9D0] bg-[#09171C] rounded-2xl border border-white/10 overflow-x-auto">
                <pre className="m-0 leading-relaxed">{codeSnippets.stocks[selectedLang] || codeSnippets.stocks.curl}</pre>
              </div>
            </div>
          )}

          {/* SECTION: V2 ROADMAP */}
          {selectedSection === 'v2-overview' && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-3">
                  <Sparkles size={13} /> Next Generation FinTech Engine
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">V2 Architecture & Milestone Preview</h2>
                <p className="text-sm text-white/70 mt-2 leading-relaxed">
                  The Proxim V2 protocol expands our infrastructure from single-merchant payment rails into programmable multi-tenant fintech orchestration.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-purple-500/20 space-y-2">
                  <div className="font-bold text-purple-300 flex items-center gap-2">
                    <Split size={14} /> Sub-Account Escrows & Marketplace Splits
                  </div>
                  <p className="text-white/70">
                    Automate split payments between marketplace platforms, service providers, and affiliate partners with programmatic escrow hold and release conditions.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-purple-500/20 space-y-2">
                  <div className="font-bold text-purple-300 flex items-center gap-2">
                    <CreditCard size={14} /> Corporate Metal Cards Issuance
                  </div>
                  <p className="text-white/70">
                    Issue virtual and physical Visa/Mastercard debit cards connected directly to multi-currency and USDC treasury balances with granular spending limits.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-purple-500/20 space-y-2">
                  <div className="font-bold text-purple-300 flex items-center gap-2">
                    <Cpu size={14} /> Biconomy Gasless Bundlers
                  </div>
                  <p className="text-white/70">
                    100% sponsored gasless transaction relaying so end-users never experience network gas fees or native token gas requirements.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-purple-500/20 space-y-2">
                  <div className="font-bold text-purple-300 flex items-center gap-2">
                    <RefreshCw size={14} /> Real-Time FX Streaming Engine
                  </div>
                  <p className="text-white/70">
                    Sub-second WebSocket orderbook pricing and automated currency forward locks to protect cross-border margins against FX slippage.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: AUTHENTICATION */}
          {selectedSection === 'authentication' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">Authentication & Peppered Key Security</h2>
                <p className="text-sm text-white/70 mt-1">
                  Authenticate every API request with an API Secret Key passed in the HTTP <code className="text-[#35D9D0]">Authorization</code> header.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="font-bold text-white flex items-center gap-1.5 text-sm">
                    <CheckCircle2 size={15} className="text-green-400" /> Implementation DOs
                  </div>
                  <ul className="space-y-1.5 text-white/70 list-disc list-inside">
                    <li>Store keys securely in server-side environment variables (`.env`).</li>
                    <li>Use <code className="text-[#35D9D0]">px_test_sk_...</code> keys for local development and CI testing.</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-2">
                  <div className="font-bold text-red-400 flex items-center gap-1.5 text-sm">
                    <XCircle size={15} className="text-red-400" /> Implementation DON'Ts
                  </div>
                  <ul className="space-y-1.5 text-white/70 list-disc list-inside">
                    <li><strong>NEVER</strong> embed secret keys in frontend React, Vue, or mobile code.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: TWO-PHASE IDEMPOTENCY */}
          {selectedSection === 'idempotency' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">Two-Phase Idempotency Locks</h2>
                <p className="text-sm text-white/70 mt-1">
                  Prevent accidental double-disbursements and network collision race conditions by including an <code className="text-[#35D9D0]">Idempotency-Key</code> header on all financial mutations.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-xs space-y-3 text-white/80">
                <div className="font-bold text-white">How Two-Phase Idempotency Protects Financial Systems:</div>
                <ol className="list-decimal list-inside space-y-2 text-white/70">
                  <li><strong>Phase 1 (Lock Acquisition):</strong> Proxim records the key in state <code className="text-amber-400">PROCESSING</code> before executing any balance queries or debits.</li>
                  <li><strong>Concurrent Collision Defense:</strong> If a network retry arrives while the transaction is in-flight, Proxim halts and returns <code className="text-red-400">409 Conflict (CONCURRENT_REQUEST)</code> immediately.</li>
                  <li><strong>Phase 2 (Completion & Replay):</strong> Once completed, the final response is cached for 24 hours. Future network retries return the exact cached result with <code className="text-green-400">200 OK</code>.</li>
                </ol>
              </div>
            </div>
          )}

          {/* SECTION: RATE LIMITS */}
          {selectedSection === 'rate-limits' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">Rate Limits & Token-Bucket Throttling</h2>
                <p className="text-sm text-white/70 mt-1">
                  Proxim uses an in-memory Token Bucket rate limiter to guarantee institutional SLA and prevent Denial of Service.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                  <div className="font-bold text-white">Standard REST Endpoints</div>
                  <div className="text-2xl font-extrabold text-[#35D9D0]">120 req / min</div>
                  <div className="text-white/60">Dynamic accounts, invoices, payouts, balance sheets, and reports.</div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                  <div className="font-bold text-white">10-Chain MPC Derivations</div>
                  <div className="text-2xl font-extrabold text-[#4A8CFF]">25 req / min</div>
                  <div className="text-white/60">Cryptographic multi-chain MPC key derivations.</div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: ERROR CATALOG */}
          {selectedSection === 'errors' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">Error Handling & RFC-7807 Catalog</h2>
                <p className="text-sm text-white/70 mt-1">
                  Proxim returns standardized, machine-readable RFC-7807 error objects across all endpoints.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    code: 'UNAUTHORIZED',
                    status: '401 Unauthorized',
                    cause: 'Missing or malformed Authorization Bearer header.',
                    solution: 'Pass your API secret key as `Authorization: Bearer px_live_sk_...`.',
                  },
                  {
                    code: 'INSUFFICIENT_FUNDS',
                    status: '402 Payment Required',
                    cause: 'Available cash balance in the requested currency is lower than total payout amount.',
                    solution: 'Deposit funds or reduce the payout batch size. Query `/v1/reports/balance-sheet` to verify funds.',
                  },
                  {
                    code: 'CONCURRENT_REQUEST',
                    status: '409 Conflict',
                    cause: 'Another request with the exact same Idempotency-Key is actively executing.',
                    solution: 'Wait 2 seconds and retry with the same key without changing the payload.',
                  },
                  {
                    code: 'RATE_LIMIT_EXCEEDED',
                    status: '429 Too Many Requests',
                    cause: 'Exceeded the 120 req/min (or 25 req/min for MPC) token bucket capacity.',
                    solution: 'Inspect the `Retry-After` header and pause requests for the indicated seconds.',
                  },
                  {
                    code: 'INVALID_REQUEST',
                    status: '400 Bad Request',
                    cause: 'Missing required fields or negative numeric amounts.',
                    solution: 'Validate client parameters before issuing the API call.',
                  },
                ].map((err, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <code className="text-[#35D9D0] font-bold text-sm">{err.code}</code>
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">{err.status}</span>
                    </div>
                    <div className="text-white/70"><strong>Cause:</strong> {err.cause}</div>
                    <div className="text-white/90"><strong>Solution:</strong> {err.solution}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION: WEBHOOK DELIVERY & RETRIES */}
          {selectedSection === 'webhooks-overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">Durable Outbox Webhook Delivery & Retries</h2>
                <p className="text-sm text-white/70 mt-1">
                  Proxim persists all outbound webhook events to a durable database outbox to guarantee delivery even if your server experiences downtime.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 text-xs">
                <div className="font-bold text-white">Exponential Backoff Retry Schedule:</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="p-2 bg-black/40 rounded-lg border border-white/10">
                    <div className="text-[10px] text-white/50">Attempt 1</div>
                    <div className="font-bold text-[#35D9D0]">Immediate</div>
                  </div>
                  <div className="p-2 bg-black/40 rounded-lg border border-white/10">
                    <div className="text-[10px] text-white/50">Attempt 2</div>
                    <div className="font-bold text-white">+1 minute</div>
                  </div>
                  <div className="p-2 bg-black/40 rounded-lg border border-white/10">
                    <div className="text-[10px] text-white/50">Attempt 3</div>
                    <div className="font-bold text-white">+5 minutes</div>
                  </div>
                  <div className="p-2 bg-black/40 rounded-lg border border-white/10">
                    <div className="text-[10px] text-white/50">Attempt 4</div>
                    <div className="font-bold text-white">+1 hour</div>
                  </div>
                  <div className="p-2 bg-black/40 rounded-lg border border-white/10">
                    <div className="text-[10px] text-white/50">Attempt 5</div>
                    <div className="font-bold text-white">+6 hours</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: WEBHOOKS VERIFICATION */}
          {selectedSection === 'webhooks-verify' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">HMAC Webhook Signature Verification</h2>
                <p className="text-sm text-white/70 mt-1">
                  Every webhook request sent by Proxim contains a cryptographic signature in the <code className="text-[#35D9D0]">X-Proxim-Signature</code> header.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-xs space-y-2">
                <div className="font-bold text-white">Signature Header Format:</div>
                <code className="block bg-black/40 text-[#35D9D0] p-2 rounded font-mono">
                  X-Proxim-Signature: t=1755829200,v1=a9c8f01b8e4f1a2390a...
                </code>
              </div>

              <div className="rounded-2xl bg-[#09171C] border border-white/10 overflow-hidden">
                <div className="px-4 py-3 bg-black/40 border-b border-white/10 flex justify-between items-center">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Verification Function Recipe</span>
                  <div className="flex gap-1.5">
                    {(['node', 'python', 'go'] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setSelectedLang(lang as any)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-md uppercase ${
                          selectedLang === lang ? 'bg-[#35D9D0] text-black' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4 font-mono text-xs text-[#35D9D0] overflow-x-auto relative">
                  <pre className="m-0 leading-relaxed">{codeSnippets.webhooksVerify[selectedLang] || codeSnippets.webhooksVerify.node}</pre>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
