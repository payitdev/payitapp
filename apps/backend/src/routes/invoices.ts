import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and, desc, sql, lte } from '@payit/db';
import { invoices, invoiceItems, entities, accounts, feeLedger, transfers } from '@payit/db/schema';
import { feeService, BrailsClient } from '@payit/integrations';
import { ulid } from 'ulid';

const db = createDbClient();
const brails = new BrailsClient();

function brailsCollectionDetails(currency: string, accountName: string, phoneNumber?: string, provider?: string): { country: 'NG' | 'KE' | 'UG'; payload: Record<string, string>; channel: 'bank_transfer' | 'mobile_money' } {
  const normalized = currency.toUpperCase();
  if (normalized === 'NGN') {
    const payload: Record<string, string> = { type: 'BANK', accountName };
    return { country: 'NG' as const, payload, channel: 'bank_transfer' as const };
  }
  if (normalized === 'KES') {
    const payload: Record<string, string> = { network: 'MPESA', type: 'MOMO', accountNumber: phoneNumber || '', accountName };
    return { country: 'KE' as const, payload, channel: 'mobile_money' as const };
  }
  if (normalized === 'UGX') {
    const payload: Record<string, string> = { network: (provider || 'MTN').toUpperCase(), type: 'MOMO', accountNumber: phoneNumber || '', accountName };
    return { country: 'UG' as const, payload, channel: 'mobile_money' as const };
  }
  throw new Error(`Brails collections do not support ${normalized}`);
}

/**
 * Helper to settle an invoice, record fees, and record an inbound activity transfer for merchant.
 */
export async function settleInvoiceAndRecordLedger(invoiceId: string, paymentMethod = 'Direct Transfer', txHashOrRef?: string) {
  const invRows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (invRows.length === 0) return null;

  const inv = invRows[0];
  if (inv.status === 'paid') return { invoice: inv, alreadyPaid: true };

  const totalNum = parseFloat(inv.totalAmount || '0');
  const fxQuote = feeService.calculateInvoiceFxQuote(isNaN(totalNum) ? 0 : totalNum, inv.currency);

  await db.update(invoices).set({ status: 'paid' }).where(eq(invoices.id, invoiceId));

  // 1. Record realized platform fee in feeLedger
  await db.insert(feeLedger).values({
    id: ulid(),
    entityId: inv.entityId,
    transactionType: 'INVOICE',
    referenceId: inv.id,
    grossAmount: String(fxQuote.grossUsd.toFixed(4)),
    feeAmount: String(fxQuote.feeUsd.toFixed(4)),
    netAmount: String(fxQuote.netUsd.toFixed(4)),
    currency: 'USD',
    description: `Proxim Merchant Invoice Fee (${fxQuote.feePercent}%) settled for ${inv.tag}`,
  });

  // 2. Insert Inbound Transaction into activity feed so merchant gets instant activity notification
  const transferRef = txHashOrRef || `inv_settle_${inv.id}_${Date.now()}`;
  try {
    await db.insert(transfers).values({
      id: ulid(),
      entityId: inv.entityId,
      dueTransferId: transferRef,
      sourceCurrency: inv.currency,
      targetCurrency: inv.currency,
      sourceAmount: String(totalNum.toFixed(2)),
      targetAmount: String(totalNum.toFixed(2)),
      feeAmount: String(fxQuote.feeAmount.toFixed(2)),
      direction: 'CREDIT',
      status: 'completed',
      paymentInstructions: `Invoice ${inv.tag} paid by ${inv.clientName} (${paymentMethod})`,
    });
  } catch (err: any) {
    console.warn('[Invoice Settlement Transfer Feed Note]:', err.message);
  }

  return {
    invoice: { ...inv, status: 'paid' },
    fxQuote,
    alreadyPaid: false,
  };
}

export async function invoiceRoutes(server: FastifyInstance) {

  /**
   * Real-time FX Quote for Invoicing (with Proxim platform fee included)
   */
  server.post('/api/invoices/quote', async (request, reply) => {
    const { amount, currency = 'USD' } = request.body as { amount: number; currency?: string };
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return reply.status(400).send({ error: 'Valid positive amount is required' });
    }

    const quote = feeService.calculateInvoiceFxQuote(Number(amount), currency);
    return reply.send({
      success: true,
      quote,
    });
  });

  /**
   * List Invoices for an Entity (with parsed payment details, overdue checks, and items)
   */
  server.get('/api/invoices', async (request, reply) => {
    const { entityId } = (request.query || {}) as { entityId?: string };
    const targetEntityId: string = entityId || request.session?.userEntityIds?.[0] || '';
    if (!targetEntityId) return reply.send({ success: true, invoices: [] });
    if (!request.session?.userEntityIds.includes(targetEntityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const todayStr = new Date().toISOString().split('T')[0];

    // Automated Overdue Status Check: Update any pending invoice whose due date has passed
    try {
      await db
        .update(invoices)
        .set({ status: 'overdue' })
        .where(
          and(
            eq(invoices.entityId, targetEntityId),
            eq(invoices.status, 'pending'),
            lte(invoices.dueDate, todayStr)
          )
        );
    } catch (err: any) {
      console.warn('[Auto-Overdue Check Note]:', err.message);
    }

    const invoiceList = await db
      .select()
      .from(invoices)
      .where(eq(invoices.entityId, targetEntityId))
      .orderBy(desc(invoices.createdAt));

    const result = [];
    for (const inv of invoiceList) {
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));

      let paymentDetails: any = {};
      let paymentLink = `https://pay.proxim.finance/inv/${inv.id}`;
      try {
        const parsed = JSON.parse(inv.paymentAccountOrLink || '{}');
        paymentDetails = parsed;
        if (parsed.link) paymentLink = parsed.link;
      } catch {
        paymentDetails = { link: inv.paymentAccountOrLink };
      }

      const totalNum = parseFloat(inv.totalAmount || '0');
      const fxQuote = feeService.calculateInvoiceFxQuote(isNaN(totalNum) ? 0 : totalNum, inv.currency);

      result.push({
        ...inv,
        items,
        paymentDetails,
        paymentLink,
        fxQuote,
      });
    }

    return reply.send({ success: true, invoices: result });
  });

  /**
   * Create New Business Invoice (Fiat or Crypto Settlement)
   */
  const handleCreateInvoice = async (request: any, reply: any) => {
    const {
      entityId,
      clientName,
      clientEmail,
      totalAmount,
      currency = 'USD',
      settlementType = 'fiat', // 'fiat' | 'crypto'
      cryptoNetwork = 'Base',
      cryptoAsset = 'USDC',
      dueDate,
      description,
      items,
    } = request.body as {
      entityId: string;
      clientName: string;
      clientEmail: string;
      totalAmount?: number;
      currency?: string;
      settlementType?: 'fiat' | 'crypto';
      cryptoNetwork?: string;
      cryptoAsset?: string;
      dueDate?: string;
      description?: string;
      items?: Array<{ description: string; quantity: number; unitPrice: number }>;
    };

    if (!entityId || !clientName || !clientEmail) {
      return reply.status(400).send({ error: 'entityId, clientName, and clientEmail are required' });
    }
    if (!request.session?.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    const entity = entityRows[0];
    const invoiceId = ulid();

    // Generate collision-proof unique business invoice tag
    const prefix = (entity.businessTag || 'PROX').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PROX';
    const tag = `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const itemTotal = items && items.length > 0
      ? items.reduce((sum, item) => sum + ((Number(item.quantity) || 1) * (Number(item.unitPrice) || 0)), 0)
      : 0;

    const parsedTotal = Number(totalAmount);
    if ((!items || items.length === 0) && (isNaN(parsedTotal) || parsedTotal <= 0)) {
      return reply.status(400).send({ error: 'A valid totalAmount greater than 0 is required.' });
    }

    const computedTotal = items && items.length > 0 ? itemTotal : parsedTotal;
    const currUpper = (currency || 'USD').toUpperCase();
    const fxQuote = feeService.calculateInvoiceFxQuote(computedTotal, currUpper);

    let paymentDetails: any = {};
    let paymentAccountOrLink = `https://pay.proxim.finance/inv/${invoiceId}`;

    if (settlementType === 'fiat') {
      // 1. Look up dedicated virtual account for billing currency from DB
      let accRows = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.entityId, entityId), eq(accounts.currency, currUpper)))
        .limit(1);

      if (accRows.length === 0) {
        // Fallback to primary entity account (e.g. NGN or USD)
        accRows = await db
          .select()
          .from(accounts)
          .where(eq(accounts.entityId, entityId))
          .limit(1);
      }

      const activeAcc = accRows[0];

      if (activeAcc) {
        paymentDetails = {
          mode: 'fiat',
          currency: currUpper,
          bankName: activeAcc.bankName,
          accountNumber: activeAcc.accountNumber,
          accountHolderName: activeAcc.accountHolderName || `${entity.legalName} / Proxim`,
          routingNumber: activeAcc.routingNumber || (currUpper === 'GBP' ? '04-00-04' : '021000021'),
          rail: activeAcc.rail || (currUpper === 'NGN' ? 'nip' : currUpper === 'EUR' ? 'sepa' : 'ach'),
        };
      } else {
        // Provider fallback default instructions
        paymentDetails = {
          mode: 'fiat',
          currency: currUpper,
          bankName: currUpper === 'NGN' ? 'Wema Bank' : currUpper === 'EUR' ? 'Banking Circle S.A.' : 'Evolve Bank & Trust',
          accountNumber: null,
          accountHolderName: `${entity.legalName} / Proxim`,
          routingNumber: currUpper === 'GBP' ? '04-00-04' : '021000021',
          rail: currUpper === 'NGN' ? 'nip' : currUpper === 'EUR' ? 'sepa' : 'ach',
          message: 'Dedicated virtual account will be attached once KYC verification is completed.',
        };
      }

      // Try generating Brails collection checkout link if API key is active
      try {
        if (process.env.BRAILS_API_KEY && ['NGN', 'USD', 'KES', 'UGX', 'GHS'].includes(currUpper)) {
          const collectionDetails = brailsCollectionDetails(currUpper, clientName);
          const brailsRes = await brails.createCollection({
            amount: Math.round(computedTotal),
            currency: currUpper as any,
            country: collectionDetails.country,
            payload: collectionDetails.payload,
            channel: collectionDetails.channel,
            email: clientEmail,
            customerName: clientName,
            reference: tag,
            redirectUrl: `https://pay.proxim.finance/inv/${invoiceId}/success`,
            description: description || `Invoice ${tag}`,
          });
          const onlineLink = brailsRes?.data?.paymentUrl || brailsRes?.paymentUrl || brailsRes?.data?.checkoutUrl;
          if (onlineLink) {
            paymentDetails.onlineCheckoutUrl = onlineLink;
            paymentAccountOrLink = onlineLink;
          }
        }
      } catch (colErr: any) {
        console.warn(`[Brails Collection] Notice:`, colErr.message);
      }
    } else {
      // 2. Crypto / Stablecoin Settlement across NEAR MPC supported multi-chain addresses
      const netLower = (cryptoNetwork || 'Base').toLowerCase();
      let depositAddress = entity.evmDepositAddress || '';

      if (netLower.includes('solana') || netLower === 'sol') {
        depositAddress = entity.solanaDepositAddress || entity.evmDepositAddress || '';
      } else if (netLower.includes('bitcoin') || netLower === 'btc') {
        depositAddress = entity.btcDepositAddress || entity.evmDepositAddress || '';
      } else if (netLower.includes('tron') || netLower === 'trx') {
        depositAddress = entity.tronDepositAddress || entity.evmDepositAddress || '';
      } else if (netLower.includes('ton')) {
        depositAddress = entity.tonDepositAddress || entity.evmDepositAddress || '';
      } else if (netLower.includes('near')) {
        depositAddress = entity.nearDepositAddress || entity.evmDepositAddress || '';
      }

      paymentDetails = {
        mode: 'crypto',
        network: cryptoNetwork || 'Base',
        asset: cryptoAsset || 'USDC',
        depositAddress,
        amount: computedTotal,
        currency: cryptoAsset || 'USDC',
      };
    }

    await db.insert(invoices).values({
      id: invoiceId,
      entityId,
      tag,
      clientName,
      clientEmail,
      totalAmount: String(computedTotal.toFixed(2)),
      currency: currUpper,
      dueDate: dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      dueQuoteId: null,
      dueTransferId: null,
      paymentAccountOrLink: JSON.stringify({ ...paymentDetails, link: paymentAccountOrLink }),
      expiresAt: new Date(Date.now() + 14 * 86400000),
      settlementType: settlementType === 'crypto' ? 'stablecoin' : 'fiat',
      status: 'pending',
    });

    if (items && items.length > 0) {
      for (const item of items) {
        const q = Number(item.quantity) || 1;
        const p = Number(item.unitPrice) || 0;
        await db.insert(invoiceItems).values({
          id: ulid(),
          invoiceId,
          description: item.description || 'Line Item',
          quantity: q,
          unitPrice: String(p.toFixed(2)),
          amount: String((q * p).toFixed(2)),
        });
      }
    } else {
      const fallbackDesc = (description && description.trim()) || 'Professional Services';
      await db.insert(invoiceItems).values({
        id: ulid(),
        invoiceId,
        description: fallbackDesc,
        quantity: 1,
        unitPrice: String(computedTotal.toFixed(2)),
        amount: String(computedTotal.toFixed(2)),
      });
    }

    return reply.send({
      success: true,
      invoice: {
        id: invoiceId,
        tag,
        clientName,
        clientEmail,
        totalAmount: computedTotal,
        currency: currUpper,
        settlementType,
        paymentDetails,
        paymentLink: paymentAccountOrLink,
        fxQuote,
        dueDate: dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        status: 'pending',
        merchantName: entity.legalName,
      },
    });
  };

  server.post('/api/invoices', handleCreateInvoice);
  server.post('/api/invoices/create', handleCreateInvoice);

  /**
   * Settle / Mark Invoice as Paid & Record Realized Platform Fee
   */
  server.post('/api/invoices/:id/settle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { paymentMethod = 'Merchant Confirmation', reference } = (request.body || {}) as any;

    const result = await settleInvoiceAndRecordLedger(id, paymentMethod, reference);
    if (!result) {
      return reply.status(404).send({ error: 'Invoice not found' });
    }

    return reply.send({
      success: true,
      message: result.alreadyPaid ? 'Invoice is already settled' : 'Invoice marked as paid and platform fee recorded',
      invoice: result.invoice,
      fxQuote: result.fxQuote,
    });
  });

  /**
   * Public Pay / Settle Endpoint for External Web Checkout (No Auth Required)
   */
  server.post('/api/invoices/public/:id/pay', async (request, reply) => {
    return reply.status(409).send({
      error: 'PAYMENT_CONFIRMATION_REQUIRED',
      message: 'Payment confirmation is completed automatically after Brails or an approved settlement webhook verifies the payment.',
    });
  });

  /**
   * Generate Mobile Money / Local Checkout Collection Link via Brails
   */
  server.post('/api/invoices/generate-collection-link', async (request, reply) => {
    const { invoiceId, channel = 'mobile_money', provider = 'mpesa', phoneNumber } = request.body as any;
    if (!invoiceId) return reply.status(400).send({ error: 'invoiceId is required' });

    const invRows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    if (invRows.length === 0) return reply.status(404).send({ error: 'Invoice not found' });
    const inv = invRows[0];

    let checkoutUrl = `https://pay.proxim.finance/checkout/${invoiceId}?channel=${channel}&provider=${provider}`;

    try {
      if (process.env.BRAILS_API_KEY) {
        const currency = String(inv.currency || 'NGN').toUpperCase();
        const collectionDetails = brailsCollectionDetails(currency, inv.clientName, phoneNumber, provider);
        const brailsRes = await brails.createCollection({
          amount: Math.round(parseFloat(inv.totalAmount)),
          currency: currency as any,
          country: collectionDetails.country,
          payload: collectionDetails.payload,
          channel: collectionDetails.channel,
          paymentProvider: provider,
          phoneNumber,
          email: inv.clientEmail,
          customerName: inv.clientName,
          reference: inv.tag || `INV-${invoiceId.slice(0, 8)}`,
          redirectUrl: `https://pay.proxim.finance/inv/${invoiceId}/success`,
          description: `Payment for Invoice ${inv.tag}`,
        });
        const onlineUrl = brailsRes?.data?.paymentUrl || brailsRes?.paymentUrl || brailsRes?.data?.checkoutUrl;
        if (onlineUrl) checkoutUrl = onlineUrl;
      }
    } catch (err: any) {
      console.warn(`[Brails Collection Notice]:`, err.message);
    }

    return reply.send({
      success: true,
      invoiceId,
      checkoutUrl,
      channel,
      provider,
    });
  });

  /**
   * Get Public Invoice by ID (for Payers, Public Checkout & PDF generator)
   */
  server.get('/api/invoices/public/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const invRows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (invRows.length === 0) {
      return reply.status(404).send({ error: 'Invoice not found' });
    }

    const inv = invRows[0];
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));
    const entityRows = await db.select().from(entities).where(eq(entities.id, inv.entityId)).limit(1);
    const merchant = entityRows[0];

    const totalNum = parseFloat(inv.totalAmount || '0');
    const fxQuote = feeService.calculateInvoiceFxQuote(isNaN(totalNum) ? 0 : totalNum, inv.currency);

    let paymentData: any = {};
    try {
      paymentData = JSON.parse(inv.paymentAccountOrLink || '{}');
    } catch {
      paymentData = { link: inv.paymentAccountOrLink };
    }

    return reply.send({
      success: true,
      invoice: {
        ...inv,
        items,
        merchantName: merchant?.legalName || 'Proxim Business',
        merchantTag: merchant?.businessTag || 'PROXIM',
        merchantEvmAddress: merchant?.evmDepositAddress,
        merchantSolanaAddress: merchant?.solanaDepositAddress,
        paymentData,
        paymentDetails: paymentData,
        fxQuote,
      },
    });
  });

  /**
   * Export Visual Invoice Graphic (SVG Format Payload)
   * Renders graphic invoice payload with embedded QR code and NEAR MPC deposit address
   */
  server.get('/api/invoices/:id/export', async (request, reply) => {
    const { id } = request.params as { id: string };
    const invRows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (invRows.length === 0) return reply.status(404).send({ error: 'Invoice not found' });

    const inv = invRows[0];
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));
    const entityRows = await db.select().from(entities).where(eq(entities.id, inv.entityId)).limit(1);
    const merchant = entityRows[0]?.legalName || 'Proxim Merchant';

    let payData: any = {};
    try { payData = JSON.parse(inv.paymentAccountOrLink || '{}'); } catch {}

    const address = payData.depositAddress || payData.accountNumber || 'Address unavailable';
    const isCrypto = inv.settlementType === 'stablecoin' || payData.mode === 'crypto';

    const svgContent = `
<svg width="600" height="750" xmlns="http://www.w3.org/2000/svg" style="background:#0F172A; font-family: system-ui, sans-serif;">
  <rect width="600" height="750" fill="#0F172A" rx="20"/>
  <rect x="20" y="20" width="560" height="710" fill="#1E293B" rx="16" stroke="#334155" stroke-width="2"/>
  
  <text x="50" y="70" fill="#38BDF8" font-size="24" font-weight="bold">PROXIM INVOICE</text>
  <text x="500" y="70" fill="#94A3B8" font-size="14" text-anchor="end">${inv.tag}</text>
  
  <line x1="50" y1="90" x2="550" y2="90" stroke="#334155" stroke-width="1"/>
  
  <text x="50" y="130" fill="#64748B" font-size="12">ISSUED BY</text>
  <text x="50" y="150" fill="#F8FAFC" font-size="16" font-weight="bold">${merchant}</text>
  
  <text x="350" y="130" fill="#64748B" font-size="12">BILLED TO</text>
  <text x="350" y="150" fill="#F8FAFC" font-size="16" font-weight="bold">${inv.clientName}</text>
  <text x="350" y="170" fill="#94A3B8" font-size="12">${inv.clientEmail}</text>

  <rect x="50" y="210" width="500" height="40" fill="#334155" rx="8"/>
  <text x="70" y="235" fill="#F8FAFC" font-size="13" font-weight="bold">Item Description</text>
  <text x="530" y="235" fill="#F8FAFC" font-size="13" font-weight="bold" text-anchor="end">Amount (${inv.currency})</text>
  
  ${items.map((item, i) => `
    <text x="70" y="${280 + i * 30}" fill="#CBD5E1" font-size="13">${item.description} (x${item.quantity})</text>
    <text x="530" y="${280 + i * 30}" fill="#F8FAFC" font-size="13" text-anchor="end">$${parseFloat(item.amount).toFixed(2)}</text>
  `).join('')}
  
  <line x1="50" y1="420" x2="550" y2="420" stroke="#334155" stroke-width="1"/>
  
  <text x="50" y="460" fill="#94A3B8" font-size="16">Total Due</text>
  <text x="550" y="460" fill="#38BDF8" font-size="28" font-weight="bold" text-anchor="end">$${parseFloat(inv.totalAmount).toFixed(2)} ${inv.currency}</text>

  <rect x="50" y="500" width="500" height="180" fill="#0F172A" rx="12" stroke="#38BDF8" stroke-width="1"/>
  <text x="70" y="530" fill="#38BDF8" font-size="12" font-weight="bold">${isCrypto ? 'CRYPTO SETTLEMENT (NEAR MPC MULTI-CHAIN)' : 'FIAT VIRTUAL BANK ACCOUNT'}</text>
  <text x="70" y="555" fill="#94A3B8" font-size="11">${isCrypto ? `Network: ${payData.network || 'EVM'} · Asset: ${payData.asset || 'USDC'}` : `Bank: ${payData.bankName || 'Partner Bank'}`}</text>
  <text x="70" y="585" fill="#F8FAFC" font-size="12" font-family="monospace" font-weight="bold">${address}</text>
  <text x="70" y="615" fill="#64748B" font-size="11">⚡ Automatically settled into non-custodial USDC/USDT treasury via NEAR MPC.</text>
  <text x="70" y="655" fill="#38BDF8" font-size="11">Scan or copy address to complete payment · Proxim Financial Enclave</text>
</svg>`.trim();

    return reply.type('image/svg+xml').send(svgContent);
  });
}


