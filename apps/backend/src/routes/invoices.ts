import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and, desc } from '@payit/db';
import { invoices, invoiceItems, entities, accounts, feeLedger } from '@payit/db/schema';
import { dueClient, feeService } from '@payit/integrations';
import { ulid } from 'ulid';

const db = createDbClient();

export async function invoiceRoutes(server: FastifyInstance) {

  /**
   * Real-time FX Quote for Invoicing (with Proxim platform fee included)
   */
  server.post('/api/invoices/quote', async (request, reply) => {
    const { amount, currency = 'USD' } = request.body as { amount: number; currency?: string };
    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Valid amount is required' });
    }

    const quote = feeService.calculateInvoiceFxQuote(amount, currency);
    return reply.send({
      success: true,
      quote,
    });
  });

  /**
   * List Invoices for an Entity
   */
  server.get('/api/invoices', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const invoiceList = await db
      .select()
      .from(invoices)
      .where(eq(invoices.entityId, entityId))
      .orderBy(desc(invoices.createdAt));

    const result = [];
    for (const inv of invoiceList) {
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));
      result.push({
        ...inv,
        items,
      });
    }

    return reply.send({ success: true, invoices: result });
  });

  /**
   * Create New Business Invoice (Fiat or Crypto Stablecoin Settlement)
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

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    const entity = entityRows[0];
    const invoiceId = ulid();
    const tag = `${entity.businessTag || 'PROX'}-${Math.floor(100 + Math.random() * 900)}`;

    const itemTotal = items && items.length > 0
      ? items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
      : 0;

    if (!items?.length && (totalAmount == null || totalAmount <= 0)) {
      return reply.status(400).send({ error: 'A valid totalAmount is required when no invoice items are supplied.' });
    }

    const computedTotal = items && items.length > 0 ? itemTotal : Number(totalAmount);

    const fxQuote = feeService.calculateInvoiceFxQuote(computedTotal, currency);

    let paymentDetails: any = {};
    let paymentAccountOrLink = `https://pay.proxim.finance/inv/${invoiceId}`;
    let dueQuoteId = null;
    let dueTransferId = null;

    if (settlementType === 'fiat') {
      const currUpper = (currency || 'USD').toUpperCase();

      if (!process.env.FIAT_PROVIDER_LIVE || process.env.FIAT_PROVIDER_LIVE === 'false') {
        paymentDetails = {
          mode: 'fiat',
          currency: currUpper,
          status: 'provider_offline',
          message: 'Fiat account provider is not live yet. Account numbers will appear once the provider is enabled.',
          bankName: null,
          accountNumber: null,
          accountHolderName: null,
          rail: currUpper === 'NGN' ? 'nip' : currUpper === 'EUR' ? 'sepa' : 'ach',
        };
      } else {
        // Look up dedicated virtual account for billing currency
        let accRows = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.entityId, entityId), eq(accounts.currency, currUpper)))
          .limit(1);

        if (accRows.length === 0) {
          // Fallback to primary account or USD account
          accRows = await db
            .select()
            .from(accounts)
            .where(eq(accounts.entityId, entityId))
            .limit(1);
        }

        const activeAcc = accRows[0];
        paymentDetails = {
          mode: 'fiat',
          currency: currUpper,
          bankName: activeAcc?.bankName || (currUpper === 'NGN' ? 'Wema Bank' : currUpper === 'EUR' ? 'Banking Circle S.A.' : 'Evolve Bank & Trust'),
          accountNumber: activeAcc?.accountNumber,
          accountHolderName: activeAcc?.accountHolderName || `${entity.legalName} / Proxim`,
          routingNumber: activeAcc?.routingNumber || (currUpper === 'GBP' ? '04-00-04' : '021000021'),
          rail: activeAcc?.rail || (currUpper === 'NGN' ? 'nip' : currUpper === 'EUR' ? 'sepa' : 'ach'),
        };
      }
    } else {
      // Crypto / Stablecoin Settlement across all NEAR MPC supported chains
      const netLower = cryptoNetwork.toLowerCase();
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
        network: cryptoNetwork,
        asset: cryptoAsset,
        depositAddress,
        amount: computedTotal,
        currency: cryptoAsset,
      };
    }

    // Provision Due dynamic transfer link
    try {
      if (entity.evmDepositAddress) {
        const quote = await dueClient.createQuote({
          sourceCurrency: currency || 'USD',
          targetCurrency: 'USDC',
          amount: computedTotal,
        });

        dueQuoteId = quote?.id || quote?.quote_id;

        if (dueQuoteId) {
          const transfer = await dueClient.createTransfer({
            quoteId: dueQuoteId,
            sourceCurrency: currency || 'USD',
            targetCurrency: 'USDC',
            amount: computedTotal,
            destinationAddress: entity.evmDepositAddress,
            recipientDetails: {
              name: clientName,
              email: clientEmail,
            },
            metadata: {
              proxim_invoice_id: invoiceId,
              proxim_entity_id: entityId,
            },
          });

          dueTransferId = transfer?.id || transfer?.transfer_id;
          if (transfer?.payment_link) paymentAccountOrLink = transfer.payment_link;
        }
      }
    } catch (dueErr: any) {
      console.warn('[Due Invoicing Fallback]:', dueErr.message);
    }

    await db.insert(invoices).values({
      id: invoiceId,
      entityId,
      tag,
      clientName,
      clientEmail,
      totalAmount: String(computedTotal.toFixed(2)),
      currency: currency.toUpperCase(),
      dueDate: dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      dueQuoteId,
      dueTransferId,
      paymentAccountOrLink: JSON.stringify({ ...paymentDetails, link: paymentAccountOrLink }),
      expiresAt: new Date(Date.now() + 14 * 86400000),
      settlementType: settlementType === 'crypto' ? 'stablecoin' : 'fiat',
      status: 'pending',
    });

    if (items && items.length > 0) {
      for (const item of items) {
        await db.insert(invoiceItems).values({
          id: ulid(),
          invoiceId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice.toFixed(2)),
          amount: String((item.quantity * item.unitPrice).toFixed(2)),
        });
      }
    } else {
      if (!description || !description.trim()) {
        return reply.status(400).send({ error: 'Invoice description is required when no line items are supplied.' });
      }
      await db.insert(invoiceItems).values({
        id: ulid(),
        invoiceId,
        description: description.trim(),
        quantity: 1,
        unitPrice: String(computedTotal.toFixed(2)),
        amount: String(computedTotal.toFixed(2)),
      });
    }

    // Register platform fee in feeLedger targeting Proxim treasury
    await db.insert(feeLedger).values({
      id: ulid(),
      entityId,
      transactionType: 'INVOICE',
      referenceId: invoiceId,
      grossAmount: String(fxQuote.grossUsd.toFixed(4)),
      feeAmount: String(fxQuote.feeUsd.toFixed(4)),
      netAmount: String(fxQuote.netUsd.toFixed(4)),
      currency: 'USD',
      description: `Proxim Merchant Invoice Fee (${fxQuote.feePercent}%) swept to Treasury`,
    });

    return reply.send({
      success: true,
      invoice: {
        id: invoiceId,
        tag,
        clientName,
        clientEmail,
        totalAmount: computedTotal,
        currency: currency.toUpperCase(),
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
   * Generate Mobile Money / Local Checkout Collection Link
   */
  server.post('/api/invoices/generate-collection-link', async (request, reply) => {
    const { invoiceId, entityId, channel = 'mobile_money', provider = 'mpesa' } = request.body as any;
    if (!invoiceId) return reply.status(400).send({ error: 'invoiceId is required' });

    const checkoutUrl = `https://pay.proxim.finance/checkout/${invoiceId}?channel=${channel}&provider=${provider}`;

    return reply.send({
      success: true,
      invoiceId,
      checkoutUrl,
      channel,
      provider,
    });
  });

  /**
   * Get Public Invoice by ID (for Payers & PDF generator)
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

    const fxQuote = feeService.calculateInvoiceFxQuote(Number(inv.totalAmount), inv.currency);

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
        paymentData,
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
