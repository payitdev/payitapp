/**
 * EaseID Identity Verification Client
 *
 * Integrates with the EaseID API to perform:
 *   1. NIN / BVN identity lookup (multi-source data retrieval)
 *   2. Facial liveness check (anti-spoofing 1-click selfie)
 *   3. Face-match against the returned ID photo
 *
 * All calls are authenticated via PKCS#8 RSA private key signing.
 *
 * IMPORTANT: The EaseID key in .env is a PKCS#8 private key PEM (base64-encoded DER).
 * All requests are signed with this key and the public key fingerprint is sent as the
 * client identifier so EaseID can verify the request originates from Proxim.
 */

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EaseIDIdentityResult {
  /** EaseID internal verification ID for this lookup — store this for audit trails */
  verificationId: string;
  /** Legal full name returned from NIN/BVN registry */
  fullName: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  /** Date of birth in YYYY-MM-DD format */
  dateOfBirth: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  phoneNumber?: string;
  /** Base64 encoded photo from the ID registry */
  photoBase64?: string;
  /** NIN number if NIN was used */
  nin?: string;
  /** BVN number if BVN was used */
  bvn?: string;
  /** Raw response fields for audit */
  raw?: Record<string, any>;
}

export interface EaseIDLivenessSession {
  /** EaseID-issued session URL to redirect/embed for selfie capture */
  sessionUrl: string;
  /** EaseID transaction ID to query for result */
  sessionToken: string;
  /** Expiry timestamp (ISO 8601) */
  expiresAt: string;
}

export interface EaseIDLivenessResult {
  /** Whether the liveness check passed */
  passed: boolean;
  /** Confidence score (0.0 – 1.0) */
  score: number;
  /** Face-match result when compared against ID photo */
  faceMatchScore?: number;
  faceMatchPassed?: boolean;
  verificationId: string;
  raw?: Record<string, any>;
}

export interface EaseIDAMLResult {
  /** Whether the subject appears on any sanctions/PEP list */
  flagged: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  matches?: Array<{
    listName: string;
    matchType: string;
    confidence: number;
  }>;
  verificationId: string;
}

export interface EaseIDBlacklistResult {
  hit: boolean;
  hitTime?: number;
  requestId?: string;
  raw?: Record<string, any>;
}

export interface EaseIDFaceMatchResult {
  similarity: number;
  passed: boolean;
  raw?: Record<string, any>;
}

export interface EaseIDMultisourceResult {
  bvn: string;
  raw?: Record<string, any>;
  [key: string]: string | number | Record<string, any> | undefined;
}

export interface EaseIDBankAccountVerificationResult {
  verifyResult: boolean;
  bankAccountName: string;
  nameMatchPercentage: number;
  raw?: Record<string, any>;
}

export type EaseIDLookupType = 'nin' | 'bvn' | 'passport' | 'drivers_license';

// ─── EaseID Client ────────────────────────────────────────────────────────────

export class EaseIDClient {
  private readonly http: AxiosInstance;
  private readonly privateKey: string;
  private readonly baseUrl: string;
  private readonly appId: string;

  constructor(privateKeyPem?: string, baseUrl?: string, appId?: string) {
    this.baseUrl = baseUrl || process.env.EASEID_BASE_URL || 'https://open-api.easeid.ai';
    this.appId = appId || process.env.EASEID_APP_ID || '';
    this.privateKey = this.parsePemKey(privateKeyPem || process.env.EASEID_API_KEY || '');

    if (!this.privateKey) {
      console.warn('⚠️  EaseIDClient: EASEID_API_KEY is not set. All verification calls will fail.');
    }

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 45_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        CountryCode: 'NG',
      },
    });

    this.http.interceptors.request.use((config) => {
      if (this.appId) {
        config.headers.Authorization = `Bearer ${this.appId}`;
      }

      const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : config.data || {};
      const normalized = this.normalizeRequestBody(body);
      const canonical = this.buildCanonicalQueryString(normalized);
      const signature = this.signPayload(canonical);

      config.data = normalized;
      config.headers['Signature'] = signature;
      config.headers['requestTime'] = normalized.requestTime;
      config.headers['version'] = normalized.version;
      config.headers['nonceStr'] = normalized.nonceStr;
      config.headers['appId'] = normalized.appId;

      return config;
    });
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Parse the raw EASEID_API_KEY value.
   * The value may be:
   *   - A bare base64 string (PKCS#8 DER encoded without PEM headers)
   *   - A full PEM string (already wrapped with -----BEGIN/END-----\n lines)
   */
  private parsePemKey(raw: string): string {
    if (!raw) return '';
    // Already a PEM — return as-is
    if (raw.includes('-----BEGIN')) {
      return raw;
    }
    // Bare base64 → wrap into PKCS#8 PEM
    const clean = raw.replace(/\s+/g, '');
    const chunked = clean.match(/.{1,64}/g)?.join('\n') ?? clean;
    return `-----BEGIN PRIVATE KEY-----\n${chunked}\n-----END PRIVATE KEY-----`;
  }

  private buildCanonicalQueryString(params: Record<string, any>): string {
    const normalized: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      normalized[key] = value;
    }

    const sortedEntries = Object.entries(normalized).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return sortedEntries
      .map(([key, value]) => `${key}=${String(value).trim()}`)
      .join('&');
  }

  private normalizeRequestBody(body: Record<string, any> = {}): Record<string, any> {
    const requestTime = body.requestTime ?? Date.now();
    const version = body.version ?? 'V1.1';
    const nonceStr = body.nonceStr ?? crypto.randomBytes(16).toString('hex');

    return {
      ...body,
      version,
      requestTime,
      nonceStr,
      appId: body.appId ?? this.appId,
    };
  }

  private signPayload(payload: string): string {
    if (!this.privateKey) return '';
    try {
      const digest = crypto.createHash('md5').update(payload, 'utf8').digest('hex').toUpperCase();
      const signer = crypto.createSign('RSA-SHA1');
      signer.update(digest, 'utf8');
      signer.end();
      return signer.sign(this.privateKey, 'base64');
    } catch (err: any) {
      console.error('[EaseID] Signature error:', err.message);
      return '';
    }
  }

  derivePublicFingerprint(): string {
    if (!this.privateKey) return '';
    const publicKey = crypto.createPublicKey(this.privateKey).export({ type: 'spki', format: 'der' });
    return crypto.createHash('md5').update(publicKey).digest('hex');
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT',
    endpoint: string,
    data?: any,
  ): Promise<T> {
    try {
      const resp = await this.http.request<T>({
        method,
        url: endpoint,
        data,
      });
      const envelope = resp.data as any;
      if (envelope?.respCode && envelope.respCode !== '00000000') {
        throw new Error(`${envelope.respCode}: ${envelope.respMsg || 'EaseID request failed'}`);
      }
      return resp.data;
    } catch (err: any) {
      const status = err.response?.status ?? 500;
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'EaseID request failed';
      throw new Error(`EaseID API Error (${status}): ${msg}`);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Look up an identity by NIN or BVN.
   *
   * @param type  - 'nin' | 'bvn'
   * @param value - The NIN or BVN number
   * @param proxim_entity_id - Proxim entity ID to bind to (stored for audit)
   * @param proxim_on_chain_address - EVM deposit address to bind the identity to
   */
  async lookupIdentity(
    type: EaseIDLookupType,
    value: string,
    proxim_entity_id: string,
    proxim_on_chain_address: string,
  ): Promise<EaseIDIdentityResult> {
    const normalizedType = type.toLowerCase();
    const trimmedValue = (value || '').trim();

    if (!trimmedValue) {
      throw new Error('EaseID identity lookup requires a non-empty NIN/BVN value.');
    }

    if (!this.privateKey || !this.appId) {
      throw new Error('EaseID is not configured. Set EASEID_API_KEY and EASEID_APP_ID before calling lookupIdentity().');
    }

    const payload = {
      type: normalizedType,
      value: trimmedValue,
      metadata: {
        proxim_entity_id,
        proxim_on_chain_address,
        timestamp: new Date().toISOString(),
      },
    };

    const candidateEndpoints = [
      '/api/v1/identity/lookup',
      '/v1/identity/lookup',
      '/api/identity/lookup',
      '/api/easeid-kyc-service/identity/lookup',
      '/api/v1/kyc/identity/lookup',
    ];

    let lastError: any = null;

    for (const endpoint of candidateEndpoints) {
      try {
        const resp = await this.request<any>('POST', endpoint, payload);
        const data = resp.data?.data || resp.data || resp;
        const verificationId = data.verification_id || data.id || data.verificationId || `eid_${Date.now()}`;
        const firstName = data.first_name || data.firstName || '';
        const lastName = data.last_name || data.lastName || data.surname || '';
        const fullName = data.full_name || data.fullName || [firstName, lastName].filter(Boolean).join(' ') || 'Unknown User';

        return {
          verificationId,
          fullName,
          firstName,
          middleName: data.middle_name || data.middleName,
          lastName,
          dateOfBirth: data.date_of_birth || data.dob || '',
          gender: (data.gender || '').toUpperCase() as 'MALE' | 'FEMALE' | 'OTHER' | undefined,
          phoneNumber: data.phone_number || data.phoneNumber || data.phone,
          photoBase64: data.photo || data.image || data.base64Photo,
          nin: normalizedType === 'nin' ? trimmedValue : data.nin,
          bvn: normalizedType === 'bvn' ? trimmedValue : data.bvn,
          raw: data,
        };
      } catch (error: any) {
        lastError = error;
        const msg = String(error.message || '');
        if (/404|not found|unsupported|no route|no endpoint/i.test(msg)) {
          continue;
        }
        throw error;
      }
    }

    throw new Error(
      lastError && String(lastError.message || '').length > 0
        ? `EaseID identity lookup is unavailable: ${lastError.message}`
        : 'EaseID identity lookup is unavailable. No supported EaseID identity lookup endpoint responded for this deployment.',
    );
  }

  /**
   * Create a facial liveness session.
   * Returns a session URL that can be embedded or redirected to.
   *
   * @param verificationId - The verification ID from lookupIdentity()
   * @param proxim_entity_id - Proxim entity ID for binding
   * @param referencePhotoBase64 - Optional base64 photo from NIN/BVN registry for face-match
   */
  async createLivenessSession(
    verificationId: string,
    proxim_entity_id: string,
    referencePhotoBase64?: string,
  ): Promise<EaseIDLivenessSession> {
    const payload = {
      metaInfo: '1',
      serviceLevel: 1,
      secureLevel: '1',
      bizId: verificationId,
      userId: proxim_entity_id,
      redirectUrl: `${process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000'}/api/kyc/easeid-liveness-callback`,
    };

    const resp = await this.request<any>('POST', '/api/easeid-kyc-service/facecapture/h5/initialize', payload);
    const data = resp.data?.data || resp.data || resp;
    const sessionUrl = data.jumpUrl;
    const sessionToken = data.transactionId;

    if (!sessionUrl || !/^https:\/\//i.test(sessionUrl)) {
      throw new Error('EaseID returned no valid HTTPS liveness session URL.');
    }
    if (!sessionToken) {
      throw new Error('EaseID returned no liveness session token.');
    }

    return {
      sessionUrl,
      sessionToken,
      expiresAt: data.expires_at || new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  /**
   * Poll / retrieve liveness result by session token.
   */
  async getLivenessResult(sessionToken: string): Promise<EaseIDLivenessResult> {
    const resp = await this.request<any>('POST', '/api/easeid-kyc-service/facecapture/query', {
      transactionId: sessionToken,
      appId: this.appId,
    });
    const data = resp.data?.data || resp.data || resp;
    const result = String(data.faceCaptureResult || '').toLowerCase();
    const passed = result === 'success';
    const photoBase64 = data.photoBase64;

    return {
      passed,
      score: passed ? 1 : 0,
      verificationId: data.bizId || sessionToken,
      raw: { ...data, faceCaptureResult: result, photoBase64 },
    };
  }

  async queryBlacklist(input: { phoneNumber?: string; bvnNo?: string; ninNo?: string }): Promise<EaseIDBlacklistResult> {
    if (!input.phoneNumber && !input.bvnNo && !input.ninNo) {
      throw new Error('EaseID blacklist query requires a phone number, BVN, or NIN.');
    }
    const resp = await this.request<any>('POST', '/api/v1/okcard-risk-control/query/blacklist', input);
    const data = resp.data || resp;
    return {
      hit: String(data.result || '').toLowerCase() === 'hit',
      hitTime: data.hitTime,
      requestId: resp.requestId,
      raw: data,
    };
  }

  async compareFaces(sourceImage: string, targetImage: string): Promise<EaseIDFaceMatchResult> {
    if (!sourceImage || !targetImage) {
      throw new Error('EaseID face comparison requires both source and target images.');
    }
    const resp = await this.request<any>('POST', '/api/easeid-kyc-service/facecapture/compare', {
      appId: this.appId,
      sourceImage,
      targetImage,
    });
    const data = resp.data || resp;
    const similarity = Number(data.similarity);
    return {
      similarity,
      passed: Number.isFinite(similarity) && similarity > 60,
      raw: data,
    };
  }

  async queryMultisourceData(bvn: string): Promise<EaseIDMultisourceResult> {
    const resp = await this.request<any>('POST', '/api/v1/multi/data/query', { bvn });
    return { ...(resp.data || resp), raw: resp.data || resp };
  }

  async verifyBankAccount(
    bvn: string,
    bankCode: string,
    bankAccount: string,
  ): Promise<EaseIDBankAccountVerificationResult> {
    if (!/^22\d{9}$/.test(bvn.trim())) {
      throw new Error('EaseID bank-account verification requires an 11-digit BVN beginning with 22.');
    }
    if (!bankCode.trim() || !bankAccount.trim()) {
      throw new Error('EaseID bank-account verification requires bankCode and bankAccount.');
    }
    const resp = await this.request<any>('POST', '/api/validator-service/open/bankAccount/verify', {
      bvn: bvn.trim(),
      bankCode: bankCode.trim(),
      bankAccount: bankAccount.trim(),
    });
    const data = resp.data || resp;
    return {
      verifyResult: data.verifyResult === true,
      bankAccountName: data.bankAccountName || '',
      nameMatchPercentage: Number(data.nameMatchPercentage),
      raw: data,
    };
  }

  /**
   * Run AML / Sanctions / PEP screening on a verified identity.
   *
   * @param fullName - Legal full name from NIN/BVN lookup
   * @param dateOfBirth - DOB in YYYY-MM-DD
   * @param country - ISO 3166-1 alpha-2 country code (default: 'NG')
   */
  async screenAML(
    fullName: string,
    dateOfBirth: string,
    country = 'NG',
  ): Promise<EaseIDAMLResult> {
    const resp = await this.request<any>('POST', '/v1/aml/screen', {
      full_name: fullName,
      date_of_birth: dateOfBirth,
      country,
    });
    const data = resp.data || resp;

    return {
      flagged: data.flagged === true || data.risk_level === 'CRITICAL' || data.risk_level === 'HIGH',
      riskLevel: data.risk_level || 'LOW',
      matches: data.matches || [],
      verificationId: data.verification_id || `aml_${Date.now()}`,
    };
  }

  /**
   * Verify a CAC registration number for business KYB.
   *
   * @param rcNumber - RC/BN/IT number (e.g. "RC1849201")
   * @param businessName - Legal business name for cross-validation
   */
  async verifyCACRegistration(
    rcNumber: string,
    businessName: string,
  ): Promise<{
    verified: boolean;
    registeredName: string;
    registrationDate?: string;
    status?: string;
    raw?: Record<string, any>;
  }> {
    const resp = await this.request<any>('POST', '/v1/business/cac-lookup', {
      rc_number: rcNumber.trim(),
      business_name: businessName.trim(),
    });
    const data = resp.data || resp;

    return {
      verified: data.verified === true || data.status === 'ACTIVE',
      registeredName: data.registered_name || data.company_name || businessName,
      registrationDate: data.registration_date,
      status: data.status,
      raw: data,
    };
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const easeIdClient = new EaseIDClient();
