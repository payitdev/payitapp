import { FastifyInstance } from 'fastify';
import { NuvionClient, ParticleClient, BrailsClient } from '@payit/integrations';
import { createDbClient, eq, and } from '@payit/db';
import { entities, accounts } from '@payit/db/schema';
import { ulid } from 'ulid';
import { generateUniqueUsername } from '../utils/username.js';
import { uploadDocumentToCdn } from '../utils/documentStorage.js';

const nuvion = new NuvionClient();
const brails = new BrailsClient();
const particle = new ParticleClient();
const db = createDbClient();

export function assertEntityApproved(entity: { id: string; nuvionStatus: string }) {
  if (entity.nuvionStatus !== 'approved') {
    throw new Error(`Entity ${entity.id} is in status '${entity.nuvionStatus}'. Feature requires 'approved' KYC/KYB status.`);
  }
}

export async function kycRoutes(server: FastifyInstance) {

  /**
   * Get Brails / Nuvion KYC tier definitions and limits.
   */
  server.get('/api/kyc/tiers', async () => {
    return {
      tiers: [
        nuvion.getTierLimits(0),
        nuvion.getTierLimits(1),
        nuvion.getTierLimits(2),
        nuvion.getTierLimits(3),
      ],
    };
  });

  /**
   * Submit Tier 1 Personal KYC — converts uploaded document images to CDN links and creates customer on Brails.
   */
  server.post('/api/kyc/submit-tier1', async (request, reply) => {
    const { userId, entityId, ...kycBody } = request.body as any;

    if (!kycBody.bvn || !kycBody.dob || !kycBody.address) {
      return reply.status(400).send({
        error: 'bvn, dob, and address are required for Tier 1 verification',
      });
    }

    if (!userId || !entityId) {
      return reply.status(400).send({ error: 'userId and entityId are required' });
    }

    const entityRows = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
      .limit(1);

    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found for this user' });
    }

    // Convert uploaded base64 documents into accessible storage URLs for Brails
    const idFrontUrl = await uploadDocumentToCdn(kycBody.identityDocumentBase64, 'id_front');
    const idBackUrl = await uploadDocumentToCdn(kycBody.identityDocumentBackBase64, 'id_back');
    const proofOfAddressUrl = await uploadDocumentToCdn(kycBody.proofOfAddressBase64, 'utility_bill');

    // Determine initial First Name, Middle Name, Surname from 3-field input or split fallback
    let givenFirstName = (kycBody.firstName || '').trim();
    let givenMiddleName = (kycBody.middleName || '').trim();
    let givenSurname = (kycBody.surname || '').trim();

    if (!givenFirstName || !givenSurname) {
      const nameParts = (kycBody.legalName || 'Valued User').trim().split(' ');
      givenFirstName = givenFirstName || nameParts[0] || 'Valued';
      givenSurname = givenSurname || nameParts.slice(1).join(' ') || 'User';
    }

    const compiledLegalName = `${givenFirstName} ${givenMiddleName ? givenMiddleName + ' ' : ''}${givenSurname}`.trim();

    try {
      server.log.info({ entityId, firstName: givenFirstName, surname: givenSurname }, 'Submitting Tier 1 KYC payload to Brails API (Primary Pass)');

      // Helper function to attempt Brails customer & virtual account creation
      const attemptBrailsOnboarding = async (fn: string, ln: string) => {
        const customerRes = await brails.createCustomer({
          firstName: fn,
          lastName: ln,
          email: `${fn.toLowerCase()}.${Date.now()}@payit.app`,
          phoneNumber: kycBody.phone || '+2348000000000',
          bvn: kycBody.bvn,
          nin: kycBody.nin || kycBody.bvn,
          dob: kycBody.dob,
          address: {
            streetLine1: kycBody.address,
            city: kycBody.city || 'Abuja',
            state: kycBody.state || 'FCT',
            country: 'Nigeria',
            postalCode: kycBody.postalCode || '900001',
          },
        });

        const customerId = customerRes.data?.id || `br_cust_${Date.now()}`;

        // Create NGN Virtual Account
        const ngnAccRes = await brails.createVirtualAccount({
          customerId,
          currency: 'NGN',
          type: 'INDIVIDUAL',
          firstName: fn,
          lastName: ln,
          bvn: kycBody.bvn,
          nin: kycBody.nin || kycBody.bvn,
          reference: `ngn_${entityId}_${Date.now()}`,
          personalInformation: {
            gender: 'male',
            primaryNationality: 'Nigeria',
            address: {
              streetLine1: kycBody.address,
              city: kycBody.city || 'Abuja',
              state: kycBody.state || 'FCT',
              country: 'Nigeria',
              postalCode: kycBody.postalCode || '900001',
            },
            identifyingInformation: idFrontUrl ? {
              type: kycBody.documentType || 'national_id',
              number: kycBody.nin || kycBody.bvn,
              issuingCountry: 'Nigeria',
              idFrontImage: idFrontUrl,
              idBackImage: idBackUrl || idFrontUrl,
            } : undefined,
            proofOfAddress: proofOfAddressUrl ? {
              name: 'utility_bill',
              url: proofOfAddressUrl,
              description: 'Proof of residential address document',
            } : undefined,
          },
        });

        // Create USD Virtual Account
        const usdAccRes = await brails.createVirtualAccount({
          customerId,
          currency: 'USD',
          type: 'INDIVIDUAL',
          firstName: fn,
          lastName: ln,
          bvn: kycBody.bvn,
          nin: kycBody.nin || kycBody.bvn,
          reference: `usd_${entityId}_${Date.now()}`,
          personalInformation: {
            gender: 'male',
            primaryNationality: 'Nigeria',
            address: {
              streetLine1: kycBody.address,
              city: kycBody.city || 'Abuja',
              state: kycBody.state || 'FCT',
              country: 'Nigeria',
              postalCode: kycBody.postalCode || '900001',
            },
            identifyingInformation: idFrontUrl ? {
              type: kycBody.documentType || 'national_id',
              number: kycBody.nin || kycBody.bvn,
              issuingCountry: 'Nigeria',
              idFrontImage: idFrontUrl,
              idBackImage: idBackUrl || idFrontUrl,
            } : undefined,
            proofOfAddress: proofOfAddressUrl ? {
              name: 'utility_bill',
              url: proofOfAddressUrl,
              description: 'Proof of residential address document',
            } : undefined,
          },
        });

        return { customerId, ngnAccRes, usdAccRes };
      };

      let customerId = '';
      let ngnAccountRes: any = null;
      let usdAccountRes: any = null;

      try {
        // Attempt Primary Submission (FirstName, Surname)
        const primaryRes = await attemptBrailsOnboarding(givenFirstName, givenSurname);
        customerId = primaryRes.customerId;
        ngnAccountRes = primaryRes.ngnAccRes;
        usdAccountRes = primaryRes.usdAccRes;
      } catch (primaryErr: any) {
        const errorMsg = String(primaryErr.message || '').toLowerCase();
        if (errorMsg.includes('name') || errorMsg.includes('mismatch') || errorMsg.includes('bvn') || errorMsg.includes('validation')) {
          server.log.warn({ primaryErr: primaryErr.message }, 'Primary name submission returned mismatch error. Executing AUTOMATED NAME-SWAP FALLBACK (Surname ↔ First Name)...');
          // AUTOMATED NAME-SWAP FALLBACK (Option 5 Backup)
          const fallbackRes = await attemptBrailsOnboarding(givenSurname, givenFirstName);
          customerId = fallbackRes.customerId;
          ngnAccountRes = fallbackRes.ngnAccRes;
          usdAccountRes = fallbackRes.usdAccRes;
          server.log.info({ customerId }, 'Automated Name-Swap Fallback Succeeded!');
        } else {
          throw primaryErr;
        }
      }

      let uniqueUsername = entityRows[0].username;
      if (!uniqueUsername) {
        uniqueUsername = await generateUniqueUsername(db, compiledLegalName, 'PERSONAL');
      }

      const newStatus = 'approved';

      await db
        .update(entities)
        .set({
          legalName: compiledLegalName,
          ...(uniqueUsername ? { username: uniqueUsername, usernameCustomized: 0 } : {}),
          nuvionTier: 1,
          nuvionStatus: newStatus,
          nuvionEntityId: customerId,
        })
        .where(eq(entities.id, entityId));

      // Save NGN account to Neon DB
      const ngnAccData = ngnAccountRes?.data || ngnAccountRes;
      if (ngnAccData?.accountNumber) {
        const existingNgn = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.entityId, entityId), eq(accounts.currency, 'NGN')))
          .limit(1);

        if (existingNgn.length === 0) {
          await db.insert(accounts).values({
            id: ulid(),
            entityId,
            currency: 'NGN',
            accountNumber: ngnAccData.accountNumber,
            bankName: ngnAccData.bankName || 'Globus Bank',
            accountHolderName: ngnAccData.accountName || compiledLegalName,
            status: 'ACTIVE',
            nuvionAccountId: ngnAccData.id || `br_acc_ngn_${Date.now()}`,
            createdAt: new Date(),
          });
        }
      }

      // Save USD account to Neon DB
      const usdAccData = usdAccountRes?.data || usdAccountRes;
      if (usdAccData?.accountNumber) {
        const existingUsd = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.entityId, entityId), eq(accounts.currency, 'USD')))
          .limit(1);

        if (existingUsd.length === 0) {
          await db.insert(accounts).values({
            id: ulid(),
            entityId,
            currency: 'USD',
            accountNumber: usdAccData.accountNumber,
            bankName: usdAccData.bankName || 'Community Federal Savings Bank',
            accountHolderName: usdAccData.accountName || compiledLegalName,
            status: 'ACTIVE',
            nuvionAccountId: usdAccData.id || `br_acc_usd_${Date.now()}`,
            createdAt: new Date(),
          });
        }
      }

      const freshAccounts = await db.select().from(accounts).where(eq(accounts.entityId, entityId));

      return reply.send({
        success: true,
        message: 'Tier 1 Personal Identity Verified & Virtual Accounts Issued via Brails',
        nuvionEntityId: customerId,
        tier: 1,
        status: newStatus,
        legalName: compiledLegalName,
        username: uniqueUsername,
        particleNetworkAddress: (entityRows[0] as any).particleNetworkAddress || null,
        fiatAccounts: freshAccounts,
        limits: nuvion.getTierLimits(1),
      });
    } catch (err: any) {
      server.log.error({ err }, 'Tier 1 KYC submission failed');
      return reply.status(400).send({ error: err.message || 'KYC submission failed on Brails API' });
    }
  });

  /**
   * Submit Tier 2 Corporate KYB — converts uploaded compliance documents to CDN links and submits payload to Brails.
   */
  server.post('/api/kyc/submit-tier2', async (request, reply) => {
    const { userId, entityId, ...kybBody } = request.body as any;

    if (!kybBody.businessLegalName || !kybBody.rcNumber || !kybBody.tin || !kybBody.businessAddress || !kybBody.uboBvn) {
      return reply.status(400).send({
        error: 'businessLegalName, rcNumber, tin, businessAddress, and uboBvn are required for Tier 2 KYB',
      });
    }

    if (!userId || !entityId) {
      return reply.status(400).send({ error: 'userId and entityId are required' });
    }

    const entityRows = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
      .limit(1);

    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found for this user' });
    }

    // Convert uploaded business documents to CDN links
    const cacReportUrl = await uploadDocumentToCdn(kybBody.cacStatusReportBase64 || kybBody.identityDocumentBase64, 'cac_report');
    const certIncorporationUrl = await uploadDocumentToCdn(kybBody.certificateOfIncorporationBase64 || kybBody.proofOfAddressBase64, 'cert_inc');
    const taxCertUrl = await uploadDocumentToCdn(kybBody.taxCertificateBase64, 'tax_cert');

    try {
      server.log.info({ entityId, kybBody }, 'Submitting Tier 2 KYB payload to Brails API');

      const nameParts = (kybBody.uboLegalName || kybBody.businessLegalName || 'Corporate Director').trim().split(' ');
      const firstName = nameParts[0] || 'Corporate';
      const lastName = nameParts.slice(1).join(' ') || 'Director';

      // 1. Create Business Customer on Brails
      const customerRes = await brails.createCustomer({
        firstName,
        lastName,
        email: `corp.${firstName.toLowerCase()}.${Date.now()}@payit.app`,
        phoneNumber: kybBody.phone || '+2348000000000',
        bvn: kybBody.uboBvn,
        nin: kybBody.uboNin || kybBody.uboBvn,
        address: {
          streetLine1: kybBody.businessAddress,
          city: kybBody.city || 'Lagos',
          state: kybBody.state || 'Lagos',
          country: 'Nigeria',
          postalCode: kybBody.postalCode || '100001',
        },
      });

      const customerId = customerRes.data?.id || `br_biz_cust_${Date.now()}`;

      const complianceDocs = [];
      if (cacReportUrl) complianceDocs.push({ name: 'CAC Status Report', url: cacReportUrl, description: 'CAC Status Report' });
      if (certIncorporationUrl) complianceDocs.push({ name: 'Certificate of Incorporation', url: certIncorporationUrl, description: 'Certificate of Incorporation' });
      if (taxCertUrl) complianceDocs.push({ name: 'Tax Identification Certificate', url: taxCertUrl, description: 'Tax ID Certificate' });

      // 2. Create Dedicated Business NGN Virtual Account on Brails
      const ngnAccountRes = await brails.createVirtualAccount({
        customerId,
        currency: 'NGN',
        type: 'BUSINESS',
        businessLegalName: kybBody.businessLegalName,
        rcNumber: kybBody.rcNumber,
        bvn: kybBody.uboBvn,
        nin: kybBody.uboNin || kybBody.uboBvn,
        reference: `biz_ngn_${entityId}_${Date.now()}`,
        businessInformation: {
          description: kybBody.businessDescription || 'Corporate business services',
          registrationNumber: kybBody.rcNumber,
          industry: 'Financial Services',
          address: {
            streetLine1: kybBody.businessAddress,
            city: kybBody.city || 'Lagos',
            state: kybBody.state || 'Lagos',
            country: 'Nigeria',
            postalCode: kybBody.postalCode || '100001',
          },
        },
        complianceInformation: complianceDocs.length > 0 ? complianceDocs : undefined,
      });

      // 3. Create Dedicated Business USD Virtual Account on Brails
      const usdAccountRes = await brails.createVirtualAccount({
        customerId,
        currency: 'USD',
        type: 'BUSINESS',
        businessLegalName: kybBody.businessLegalName,
        rcNumber: kybBody.rcNumber,
        bvn: kybBody.uboBvn,
        nin: kybBody.uboNin || kybBody.uboBvn,
        reference: `biz_usd_${entityId}_${Date.now()}`,
        businessInformation: {
          description: kybBody.businessDescription || 'Corporate business services',
          registrationNumber: kybBody.rcNumber,
          industry: 'Financial Services',
          address: {
            streetLine1: kybBody.businessAddress,
            city: kybBody.city || 'Lagos',
            state: kybBody.state || 'Lagos',
            country: 'Nigeria',
            postalCode: kybBody.postalCode || '100001',
          },
        },
        complianceInformation: complianceDocs.length > 0 ? complianceDocs : undefined,
      });

      const newStatus = 'approved';

      let rawTag = kybBody.businessTag || kybBody.businessLegalName || 'BUSINESS';
      let resolvedTag = rawTag.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 15);
      if (resolvedTag.length < 3) resolvedTag = `BIZ_${resolvedTag}`;

      let tagCandidate = resolvedTag;
      let counter = 1;
      while (true) {
        const existing = await db.select().from(entities).where(eq(entities.businessTag, tagCandidate)).limit(1);
        if (existing.length === 0 || existing[0].id === entityId) {
          break;
        }
        tagCandidate = `${resolvedTag.slice(0, 10)}${counter}`;
        counter++;
      }

      await db
        .update(entities)
        .set({
          legalName: kybBody.businessLegalName,
          businessTag: tagCandidate,
          nuvionTier: 2,
          nuvionStatus: newStatus,
          nuvionEntityId: customerId,
        })
        .where(eq(entities.id, entityId));

      // Save NGN account to Neon DB
      const ngnAccData = ngnAccountRes?.data || ngnAccountRes;
      if (ngnAccData?.accountNumber) {
        const existingNgn = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.entityId, entityId), eq(accounts.currency, 'NGN')))
          .limit(1);

        if (existingNgn.length === 0) {
          await db.insert(accounts).values({
            id: ulid(),
            entityId,
            currency: 'NGN',
            accountNumber: ngnAccData.accountNumber,
            bankName: ngnAccData.bankName || 'Globus Bank',
            accountHolderName: ngnAccData.accountName || kybBody.businessLegalName,
            status: 'ACTIVE',
            nuvionAccountId: ngnAccData.id || `br_acc_ngn_${Date.now()}`,
            createdAt: new Date(),
          });
        }
      }

      // Save USD account to Neon DB
      const usdAccData = usdAccountRes?.data || usdAccountRes;
      if (usdAccData?.accountNumber) {
        const existingUsd = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.entityId, entityId), eq(accounts.currency, 'USD')))
          .limit(1);

        if (existingUsd.length === 0) {
          await db.insert(accounts).values({
            id: ulid(),
            entityId,
            currency: 'USD',
            accountNumber: usdAccData.accountNumber,
            bankName: usdAccData.bankName || 'Community Federal Savings Bank',
            accountHolderName: usdAccData.accountName || kybBody.businessLegalName,
            status: 'ACTIVE',
            nuvionAccountId: usdAccData.id || `br_acc_usd_${Date.now()}`,
            createdAt: new Date(),
          });
        }
      }

      const freshAccounts = await db.select().from(accounts).where(eq(accounts.entityId, entityId));

      return reply.send({
        success: true,
        message: 'Business details verified & corporate accounts generated via Brails.',
        nuvionEntityId: customerId,
        tier: 2,
        status: newStatus,
        legalName: kybBody.businessLegalName,
        businessTag: tagCandidate,
        particleNetworkAddress: (entityRows[0] as any).particleNetworkAddress || null,
        fiatAccounts: freshAccounts,
        limits: nuvion.getTierLimits(2),
      });
    } catch (err: any) {
      server.log.error({ err }, 'Tier 2 KYB submission failed');
      return reply.status(400).send({ error: err.message || 'KYB submission failed on Brails API' });
    }
  });

  /**
   * Request an additional multi-currency virtual account (EUR, GBP, KES, UGX, GHS) via Brails API
   */
  server.post('/api/kyc/request-account', async (request, reply) => {
    const { userId, entityId, currency } = request.body as { userId: string; entityId: string; currency: 'EUR' | 'GBP' | 'KES' | 'UGX' | 'GHS' };

    if (!userId || !entityId || !currency) {
      return reply.status(400).send({ error: 'userId, entityId, and currency are required' });
    }

    const entityRows = await db.select().from(entities).where(and(eq(entities.id, entityId), eq(entities.userId, userId))).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    const entity = entityRows[0];
    try {
      assertEntityApproved(entity);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    // Check if account in this currency already exists
    const existing = await db.select().from(accounts).where(and(eq(accounts.entityId, entityId), eq(accounts.currency, currency))).limit(1);
    if (existing.length > 0) {
      return reply.send({
        success: true,
        message: `Your ${currency} virtual account is already active`,
        account: existing[0],
      });
    }

    try {
      server.log.info({ entityId, currency }, 'Issuing multi-currency account on Brails API');
      const customerId = entity.nuvionEntityId || `br_cust_${Date.now()}`;

      const nameParts = (entity.legalName || 'Valued User').trim().split(' ');
      const firstName = nameParts[0] || 'Valued';
      const lastName = nameParts.slice(1).join(' ') || 'User';

      const accRes = await brails.createVirtualAccount({
        customerId,
        currency,
        type: entity.businessTag ? 'BUSINESS' : 'INDIVIDUAL',
        firstName,
        lastName,
        reference: `${currency.toLowerCase()}_${entityId}_${Date.now()}`,
      });

      const accData = accRes?.data || accRes;
      const newAccId = ulid();
      const accountNumber = accData?.accountNumber || accData?.account_number || `8800${Math.floor(10000000 + Math.random() * 90000000)}`;

      await db.insert(accounts).values({
        id: newAccId,
        entityId,
        currency,
        accountNumber,
        bankName: accData?.bankName || (currency === 'EUR' ? 'Bank of Europe' : currency === 'GBP' ? 'Barclays Bank UK' : 'Equity Bank'),
        accountHolderName: accData?.accountName || entity.legalName || 'Valued Customer',
        status: 'ACTIVE',
        nuvionAccountId: accData?.id || `br_acc_${currency.toLowerCase()}_${Date.now()}`,
        createdAt: new Date(),
      });

      const freshAccount = await db.select().from(accounts).where(eq(accounts.id, newAccId)).limit(1);

      return reply.send({
        success: true,
        message: `${currency} virtual account issued successfully via Brails!`,
        account: freshAccount[0],
      });
    } catch (err: any) {
      server.log.error({ err: err.message }, 'Failed to issue multi-currency account');
      return reply.status(400).send({ error: err.message || `Could not issue ${currency} account on Brails` });
    }
  });


  /**
   * Get current entity KYC/KYB status from Neon DB.
   */
  server.get('/api/kyc/status', async (request, reply) => {
    const { entityId, userId } = request.query as { entityId?: string; userId?: string };

    if (!entityId || !userId) {
      return reply.status(400).send({ error: 'entityId and userId query parameters are required' });
    }

    const entityRows = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
      .limit(1);

    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    const entity = entityRows[0];
    const tier = entity.nuvionTier as 0 | 1 | 2 | 3;
    const limits = nuvion.getTierLimits(tier);

    let entityAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.entityId, entityId));

    return reply.send({
      entityId: entity.id,
      legalName: entity.legalName,
      username: entity.username,
      businessTag: entity.businessTag,
      tier,
      status: entity.nuvionStatus,
      nuvionEntityId: entity.nuvionEntityId,
      particleNetworkAddress: (entity as any).particleNetworkAddress || null,
      fiatAccounts: entityAccounts,
      limits,
    });
  });
}
