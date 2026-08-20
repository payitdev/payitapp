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
  /** Session token to poll for result */
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

    const sortedEntries = Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b));
    return sortedEntries
      .map(([key, value]) => `${key}=${String(value)}`)
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
      const signer = crypto.createSign('RSA-MD5');
      signer.update(payload, 'utf8');
      signer.end();
      return signer.sign(this.privateKey, 'base64');
    } catch (err: any) {
      console.error('[EaseID] Signature error:', err.message);
      return '';
    }
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
    const payload = {
      type,
      value: value.trim(),
      metadata: {
        proxim_entity_id,
        proxim_on_chain_address,
        timestamp: new Date().toISOString(),
      },
    };

    const resp = await this.request<any>('POST', '/v1/identity/lookup', payload);

    // Normalise the EaseID response into our standard shape
    const data = resp.data || resp;
    return {
      verificationId: data.verification_id || data.id || `eid_${Date.now()}`,
      fullName: data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
      firstName: data.first_name || '',
      middleName: data.middle_name || data.middleName,
      lastName: data.last_name || data.surname || '',
      dateOfBirth: data.date_of_birth || data.dob || '',
      gender: data.gender?.toUpperCase(),
      phoneNumber: data.phone_number || data.phone,
      photoBase64: data.photo || data.image || data.base64Photo,
      nin: type === 'nin' ? value : data.nin,
      bvn: type === 'bvn' ? value : data.bvn,
      raw: data,
    };
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
    const payload: any = {
      verification_id: verificationId,
      callback_url: `${process.env.BACKEND_PUBLIC_URL || 'https://api.proxim.finance'}/api/kyc/easeid-liveness-callback`,
      metadata: {
        proxim_entity_id,
      },
    };

    if (referencePhotoBase64) {
      payload.reference_photo = referencePhotoBase64;
    }

    const resp = await this.request<any>('POST', '/v1/liveness/session', payload);
    const data = resp.data || resp;

    return {
      sessionUrl: data.session_url || data.url,
      sessionToken: data.session_token || data.token,
      expiresAt: data.expires_at || new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  /**
   * Poll / retrieve liveness result by session token.
   */
  async getLivenessResult(sessionToken: string): Promise<EaseIDLivenessResult> {
    const resp = await this.request<any>('GET', `/v1/liveness/result?session_token=${sessionToken}`);
    const data = resp.data || resp;

    return {
      passed: data.passed === true || data.status === 'PASSED',
      score: data.liveness_score ?? data.score ?? 0,
      faceMatchScore: data.face_match_score,
      faceMatchPassed: data.face_match_passed,
      verificationId: data.verification_id || sessionToken,
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
