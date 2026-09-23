import {
  createDbClient,
  eq,
  and,
  users,
  entities,
  ledgerAccounts,
  ledgerEntries,
  nuvionAccountDetails,
  nuvionCards,
  brailsCards,
  transfers,
  telegramUserLinks,
} from '@payit/db';
import { deriveUserAddresses, deriveNearNamedAddress, PrivyNEARBridge } from '@payit/integrations';
import { ulid } from 'ulid';

const db = createDbClient();




export interface LiveBalances {
  usdc: string;
  ngn: string;
  usd: string;
  gbp: string;
  eur: string;
  kes: string;
  totalEstimatedUsd: string;
}

export interface LiveBankAccount {
  currency: string;
  bankName: string;
  accountNumber: string;
  routingNumber?: string;
  beneficiaryName: string;
  status: string;
}

export interface LiveCard {
  id: string;
  cardType: string;
  last4: string;
  status: string;
  currency: string;
  dailyLimit: string;
  monthlyLimit: string;
}

export interface MpcAddresses {
  evmAddress: string;
  nearNamedAddress: string;
  solanaAddress: string;
  btcAddress: string;
  tronAddress?: string;
  tonAddress?: string;
  suiAddress?: string;
  aptosAddress?: string;
  cosmosAddress?: string;
  xrpAddress?: string;
}

export class LiveDataService {
  /**
   * Provision or fetch real user & dual entities in PostgreSQL with NEAR MPC addresses.
   */
  public async getOrCreateUserEntities(telegramUserId: number, username?: string): Promise<{
    personalEntityId: string;
    businessEntityId: string;
    personalMpc: MpcAddresses;
    businessMpc: MpcAddresses;
    kycStatus: 'UNVERIFIED' | 'PENDING' | 'APPROVED';
  }> {
    const userHandle = username ? username.toLowerCase().replace(/[^a-z0-9_]/g, '') : `tg${telegramUserId}`;
    const fallbackUserId = `tg_${telegramUserId}`;
    const fallbackPersonalEntityId = `ent_${fallbackUserId}_personal`;
    const fallbackBusinessEntityId = `ent_${fallbackUserId}_business`;

    try {
      const linkRows = await db.select().from(telegramUserLinks).where(eq(telegramUserLinks.telegramUserId, telegramUserId)).limit(1);
      const linkedRecord = linkRows[0];

      if (linkedRecord && linkedRecord.status === 'linked') {
        const userRows = await db.select().from(users).where(eq(users.id, linkedRecord.userId)).limit(1);
        const linkedUser = userRows[0];

        if (linkedUser) {
          const entityRows = await db.select().from(entities).where(eq(entities.userId, linkedUser.id)).orderBy(entities.kind);
          const personalEntity = entityRows.find(e => e.kind === 'PERSONAL') || entityRows[0];
          const businessEntity = entityRows.find(e => e.kind === 'BUSINESS');

          const personalContext = linkedUser.privyUserId ? await PrivyNEARBridge.deriveAddress(linkedUser.privyUserId, 'personal', linkedUser.email) : await deriveUserAddresses(linkedUser.id, 'personal', linkedUser.email);
          const businessContext = linkedUser.privyUserId ? await PrivyNEARBridge.deriveAddress(linkedUser.privyUserId, 'business', linkedUser.email) : await deriveUserAddresses(linkedUser.id, 'business', linkedUser.email);

          const personalEntityId = personalEntity?.id || `ent_${linkedUser.id}_personal`;
          const businessEntityId = businessEntity?.id || `ent_${linkedUser.id}_business`;

          if (!personalEntity) {
            await db.insert(entities).values({
              id: personalEntityId,
              userId: linkedUser.id,
              kind: 'PERSONAL',
              legalName: linkedUser.fullName || username || `Linked User ${telegramUserId}`,
              username: userHandle,
              evmDepositAddress: personalContext.evmAddress,
              nearDepositAddress: personalContext.nearNamedAddress,
              solanaDepositAddress: personalContext.solanaAddress,
              btcDepositAddress: personalContext.btcAddress,
              tronDepositAddress: personalContext.tronAddress,
              tonDepositAddress: personalContext.tonAddress,
              suiDepositAddress: personalContext.suiAddress,
              aptosDepositAddress: personalContext.aptosAddress,
              cosmosDepositAddress: personalContext.cosmosAddress,
              xrpDepositAddress: personalContext.xrpAddress,
              dueStatus: 'incomplete',
            }).onConflictDoNothing();
          } else {
            await db.update(entities).set({
              evmDepositAddress: personalContext.evmAddress,
              nearDepositAddress: personalContext.nearNamedAddress,
              solanaDepositAddress: personalContext.solanaAddress,
              btcDepositAddress: personalContext.btcAddress,
              tronDepositAddress: personalContext.tronAddress,
              tonDepositAddress: personalContext.tonAddress,
              suiDepositAddress: personalContext.suiAddress,
              aptosDepositAddress: personalContext.aptosAddress,
              cosmosDepositAddress: personalContext.cosmosAddress,
              xrpDepositAddress: personalContext.xrpAddress,
            }).where(eq(entities.id, personalEntity.id));
          }

          if (!businessEntity) {
            await db.insert(entities).values({
              id: businessEntityId,
              userId: linkedUser.id,
              kind: 'BUSINESS',
              legalName: `${linkedUser.fullName || username || `Linked User ${telegramUserId}`} Business`,
              businessTag: `${userHandle.toUpperCase()}_BIZ`,
              evmDepositAddress: businessContext.evmAddress,
              nearDepositAddress: businessContext.nearNamedAddress,
              solanaDepositAddress: businessContext.solanaAddress,
              btcDepositAddress: businessContext.btcAddress,
              tronDepositAddress: businessContext.tronAddress,
              tonDepositAddress: businessContext.tonAddress,
              suiDepositAddress: businessContext.suiAddress,
              aptosDepositAddress: businessContext.aptosAddress,
              cosmosDepositAddress: businessContext.cosmosAddress,
              xrpDepositAddress: businessContext.xrpAddress,
              dueStatus: 'incomplete',
            }).onConflictDoNothing();
          } else {
            await db.update(entities).set({
              evmDepositAddress: businessContext.evmAddress,
              nearDepositAddress: businessContext.nearNamedAddress,
              solanaDepositAddress: businessContext.solanaAddress,
              btcDepositAddress: businessContext.btcAddress,
              tronDepositAddress: businessContext.tronAddress,
              tonDepositAddress: businessContext.tonAddress,
              suiDepositAddress: businessContext.suiAddress,
              aptosDepositAddress: businessContext.aptosAddress,
              cosmosDepositAddress: businessContext.cosmosAddress,
              xrpDepositAddress: businessContext.xrpAddress,
            }).where(eq(entities.id, businessEntity.id));
          }

          const updatedPersonal = (await db.select().from(entities).where(eq(entities.id, personalEntityId)).limit(1))[0] || (personalEntity ?? { dueStatus: 'incomplete' });
          return {
            personalEntityId,
            businessEntityId: businessEntityId,
            personalMpc: {
              evmAddress: personalContext.evmAddress,
              nearNamedAddress: personalContext.nearNamedAddress,
              solanaAddress: personalContext.solanaAddress,
              btcAddress: personalContext.btcAddress,
              tronAddress: personalContext.tronAddress,
              tonAddress: personalContext.tonAddress,
              suiAddress: personalContext.suiAddress,
              aptosAddress: personalContext.aptosAddress,
              cosmosAddress: personalContext.cosmosAddress,
              xrpAddress: personalContext.xrpAddress,
            },
            businessMpc: {
              evmAddress: businessContext.evmAddress,
              nearNamedAddress: businessContext.nearNamedAddress,
              solanaAddress: businessContext.solanaAddress,
              btcAddress: businessContext.btcAddress,
              tronAddress: businessContext.tronAddress,
              tonAddress: businessContext.tonAddress,
              suiAddress: businessContext.suiAddress,
              aptosAddress: businessContext.aptosAddress,
              cosmosAddress: businessContext.cosmosAddress,
              xrpAddress: businessContext.xrpAddress,
            },
            kycStatus: updatedPersonal?.dueStatus === 'approved' ? 'APPROVED' : updatedPersonal?.dueStatus === 'pending' ? 'PENDING' : 'UNVERIFIED',
          };
        }
      }
    } catch (err: any) {
      throw new Error(`Unable to resolve linked Telegram account: ${err.message}`);
    }

    const userId = `tg_${telegramUserId}`;
    const personalEntityId = `ent_${userId}_personal`;
    const businessEntityId = `ent_${userId}_business`;
    const accountEmail = `${userId}@telegram.proxim.app`;
    const legalName = username ? `@${username}` : `Telegram User ${telegramUserId}`;
    const personalContext = await deriveUserAddresses(userId, 'personal', accountEmail);
    const businessContext = await deriveUserAddresses(userId, 'business', accountEmail);

    await db.insert(users).values({
      id: userId,
      email: accountEmail,
      fullName: legalName,
    }).onConflictDoNothing();

    await db.insert(telegramUserLinks).values({
      id: ulid(),
      userId,
      nonce: ulid(),
      telegramUserId,
      telegramUsername: username || null,
      status: 'linked',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      linkedAt: new Date(),
    }).onConflictDoNothing();

    await db.insert(entities).values([
      {
        id: personalEntityId,
        userId,
        kind: 'PERSONAL',
        legalName,
        username: `tg_${telegramUserId}`,
        evmDepositAddress: personalContext.evmAddress,
        nearDepositAddress: personalContext.nearNamedAddress,
        solanaDepositAddress: personalContext.solanaAddress,
        btcDepositAddress: personalContext.btcAddress,
        tronDepositAddress: personalContext.tronAddress,
        tonDepositAddress: personalContext.tonAddress,
        cosmosDepositAddress: personalContext.cosmosAddress,
        suiDepositAddress: personalContext.suiAddress,
        aptosDepositAddress: personalContext.aptosAddress,
        xrpDepositAddress: personalContext.xrpAddress,
        dueStatus: 'incomplete',
      },
      {
        id: businessEntityId,
        userId,
        kind: 'BUSINESS',
        legalName: `${legalName} Business`,
        businessTag: `TG_${telegramUserId}_BIZ`,
        evmDepositAddress: businessContext.evmAddress,
        nearDepositAddress: businessContext.nearNamedAddress,
        solanaDepositAddress: businessContext.solanaAddress,
        btcDepositAddress: businessContext.btcAddress,
        tronDepositAddress: businessContext.tronAddress,
        tonDepositAddress: businessContext.tonAddress,
        cosmosDepositAddress: businessContext.cosmosAddress,
        suiDepositAddress: businessContext.suiAddress,
        aptosDepositAddress: businessContext.aptosAddress,
        xrpDepositAddress: businessContext.xrpAddress,
        dueStatus: 'incomplete',
      },
    ]).onConflictDoNothing();

    return {
      personalEntityId,
      businessEntityId,
      personalMpc: personalContext,
      businessMpc: businessContext,
      kycStatus: 'UNVERIFIED',
    };

    /*
    const personalMpc = await deriveUserAddresses(userHandle, 'personal');
    const businessMpc = await deriveUserAddresses(userHandle, 'business');
    let kycStatus: 'UNVERIFIED' | 'PENDING' | 'APPROVED' = 'UNVERIFIED';

    const existingUsers = await db.select().from(users).where(eq(users.id, fallbackUserId)).limit(1);
    if (existingUsers.length === 0) {
      await db.insert(users).values({
        id: fallbackUserId,
        fullName: username ? `@${username}` : `Telegram User ${telegramUserId}`,
        email: `${userHandle}@telegram.proxim.financial`,
      }).onConflictDoNothing();
    }

    const personalRows = await db.select().from(entities).where(eq(entities.id, fallbackPersonalEntityId)).limit(1);
    if (personalRows.length === 0) {
      await db.insert(entities).values({
        id: fallbackPersonalEntityId,
        userId: fallbackUserId,
        kind: 'PERSONAL',
        legalName: username ? `@${username}` : `Telegram User ${telegramUserId}`,
        username: userHandle,
        evmDepositAddress: personalMpc.evmAddress,
        nearDepositAddress: personalMpc.nearNamedAddress,
        solanaDepositAddress: personalMpc.solanaAddress,
        btcDepositAddress: personalMpc.btcAddress,
        tronDepositAddress: personalMpc.tronAddress,
        tonDepositAddress: personalMpc.tonAddress,
        suiDepositAddress: personalMpc.suiAddress,
        aptosDepositAddress: personalMpc.aptosAddress,
        cosmosDepositAddress: personalMpc.cosmosAddress,
        xrpDepositAddress: personalMpc.xrpAddress,
        dueStatus: 'incomplete',
      }).onConflictDoNothing();
    } else {
      await db.update(entities).set({
        evmDepositAddress: personalMpc.evmAddress,
        nearDepositAddress: personalMpc.nearNamedAddress,
        solanaDepositAddress: personalMpc.solanaAddress,
        btcDepositAddress: personalMpc.btcAddress,
        tronDepositAddress: personalMpc.tronAddress,
        tonDepositAddress: personalMpc.tonAddress,
        suiDepositAddress: personalMpc.suiAddress,
        aptosDepositAddress: personalMpc.aptosAddress,
        cosmosDepositAddress: personalMpc.cosmosAddress,
        xrpDepositAddress: personalMpc.xrpAddress,
      }).where(eq(entities.id, fallbackPersonalEntityId));
    }

    const businessRows = await db.select().from(entities).where(eq(entities.id, fallbackBusinessEntityId)).limit(1);
    if (businessRows.length === 0) {
      await db.insert(entities).values({
        id: fallbackBusinessEntityId,
        userId: fallbackUserId,
        kind: 'BUSINESS',
        legalName: username ? `${username} Enterprise` : `Business ${telegramUserId}`,
        businessTag: `${userHandle.toUpperCase()}_BIZ`,
        evmDepositAddress: businessMpc.evmAddress,
        nearDepositAddress: businessMpc.nearNamedAddress,
        solanaDepositAddress: businessMpc.solanaAddress,
        btcDepositAddress: businessMpc.btcAddress,
        tronDepositAddress: businessMpc.tronAddress,
        tonDepositAddress: businessMpc.tonAddress,
        suiDepositAddress: businessMpc.suiAddress,
        aptosDepositAddress: businessMpc.aptosAddress,
        cosmosDepositAddress: businessMpc.cosmosAddress,
        xrpDepositAddress: businessMpc.xrpAddress,
        dueStatus: 'incomplete',
      }).onConflictDoNothing();
    } else {
      await db.update(entities).set({
        evmDepositAddress: businessMpc.evmAddress,
        nearDepositAddress: businessMpc.nearNamedAddress,
        solanaDepositAddress: businessMpc.solanaAddress,
        btcDepositAddress: businessMpc.btcAddress,
        tronDepositAddress: businessMpc.tronAddress,
        tonDepositAddress: businessMpc.tonAddress,
        suiDepositAddress: businessMpc.suiAddress,
        aptosDepositAddress: businessMpc.aptosAddress,
        cosmosDepositAddress: businessMpc.cosmosAddress,
        xrpDepositAddress: businessMpc.xrpAddress,
      }).where(eq(entities.id, fallbackBusinessEntityId));
    }

    const currentPersonal = (await db.select().from(entities).where(eq(entities.id, fallbackPersonalEntityId)).limit(1))[0];
    kycStatus = currentPersonal?.dueStatus === 'approved' ? 'APPROVED' : currentPersonal?.dueStatus === 'pending' ? 'PENDING' : 'UNVERIFIED';

    return {
      personalEntityId: fallbackPersonalEntityId,
      businessEntityId: fallbackBusinessEntityId,
      personalMpc,
      businessMpc,
      kycStatus,
    };
    */
  }


  /**
   * Calculate Real Live Double-Entry Balances for an Entity
   */
  public async getEntityBalances(entityId: string): Promise<LiveBalances> {
    const balanceMap: Record<string, number> = { USDC: 0, NGN: 0, USD: 0, GBP: 0, EUR: 0, KES: 0 };

    try {
      const accounts = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.entityId, entityId));
      for (const acc of accounts) {
        if (acc.type !== 'ASSET') continue;
        const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.ledgerAccountId, acc.id));
        let accBal = 0;
        for (const entry of entries) {
          const amt = Number(entry.amount || 0);
          if (entry.type === 'DEBIT') accBal += amt;
          if (entry.type === 'CREDIT') accBal -= amt;
        }
        const curr = (acc.currency || 'USD').toUpperCase();
        balanceMap[curr] = (balanceMap[curr] || 0) + accBal;
      }
    } catch {
      // Return clean zero balances if DB is offline or account is newly created
    }


    const usdc = (balanceMap['USDC'] || 0).toFixed(2);
    const ngn = (balanceMap['NGN'] || 0).toFixed(2);
    const usd = (balanceMap['USD'] || 0).toFixed(2);
    const gbp = (balanceMap['GBP'] || 0).toFixed(2);
    const eur = (balanceMap['EUR'] || 0).toFixed(2);
    const kes = (balanceMap['KES'] || 0).toFixed(2);

    const totalEstimated = (
      Number(usdc) +
      Number(usd) +
      Number(ngn) / 1450 +
      Number(gbp) * 1.28 +
      Number(eur) * 1.08 +
      Number(kes) / 130
    ).toFixed(2);

    return {
      usdc,
      ngn,
      usd,
      gbp,
      eur,
      kes,
      totalEstimatedUsd: totalEstimated,
    };
  }

  /**
   * Fetch Real Provisioned Virtual Bank Accounts for an Entity
   */
  public async getEntityBankAccounts(entityId: string): Promise<LiveBankAccount[]> {
    const rows = await db.select().from(nuvionAccountDetails).where(eq(nuvionAccountDetails.localEntityId, entityId));
    return rows.map((r: any) => ({
      currency: r.currency || 'USD',
      bankName: (r.issuer as any)?.name || 'Proxim Partner Bank',
      accountNumber: r.accountNumber || '',
      routingNumber: r.routingNumber || undefined,
      beneficiaryName: r.beneficiaryName || 'Proxim Account Holder',
      status: 'ACTIVE',
    }));
  }

  /**
   * Fetch Real Active Cards for an Entity
   */
  public async getEntityCards(entityId: string): Promise<LiveCard[]> {
    const nuvionCardRows = await db.select().from(nuvionCards).where(eq(nuvionCards.localEntityId, entityId));

    const result: LiveCard[] = [];

    for (const c of nuvionCardRows) {
      result.push({
        id: c.id,
        cardType: (c.type || 'virtual').toUpperCase(),
        last4: c.lastFour || '••••',
        status: (c.status || 'ACTIVE').toUpperCase(),
        currency: 'USD',
        dailyLimit: String((c.spendingLimits as any)?.dailyMinor ? (Number((c.spendingLimits as any).dailyMinor) / 100).toFixed(2) : '500.00'),
        monthlyLimit: String((c.spendingLimits as any)?.monthlyMinor ? (Number((c.spendingLimits as any).monthlyMinor) / 100).toFixed(2) : '2000.00'),
      });
    }

    return result;
  }
}


export const liveDataService = new LiveDataService();
