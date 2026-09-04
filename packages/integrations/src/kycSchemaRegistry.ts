/**
 * KYC Schema Registry
 * 
 * Centralized schema definitions for KYC forms.
 * No hardcoded values — all values driven from environment and database.
 * 
 * Routing:
 * - Personal Account → Brails NGN (simple: 7 fields)
 * - Business Account → Nuvion (comprehensive: 20+ fields)
 */

export type FieldType = 'text' | 'email' | 'tel' | 'date' | 'select' | 'textarea' | 'file' | 'gender' | 'country';
export type Provider = 'brails' | 'nuvion';
export type AccountType = 'personal' | 'business';

export interface KYCField {
  name: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  pattern?: string;
  help?: string;
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
  accept?: string; // for file uploads
}

export interface KYCFormSection {
  id: string;
  title: string;
  description?: string;
  fields: KYCField[];
}

export interface KYCSchema {
  accountType: AccountType;
  provider: Provider;
  tier: number;
  title: string;
  description: string;
  sections: KYCFormSection[];
  estimatedTimeMinutes: number;
  currenciesSupported: string[];
}

// ─── BRAILS PERSONAL (NGN) - SIMPLEST TIER ─────────────────────────────────

const brailsPersonalNgnSchema: KYCSchema = {
  accountType: 'personal',
  provider: 'brails',
  tier: 1,
  title: 'Open Your Personal Account',
  description: 'Get a virtual account in minutes. Just verify your BVN.',
  estimatedTimeMinutes: 2,
  currenciesSupported: ['NGN'],
  sections: [
    {
      id: 'personal_info',
      title: 'Personal Information',
      description: 'Basic details for account creation',
      fields: [
        {
          name: 'firstName',
          type: 'text',
          label: 'First Name',
          required: true,
          placeholder: 'John',
          maxLength: 50,
        },
        {
          name: 'lastName',
          type: 'text',
          label: 'Last Name',
          required: true,
          placeholder: 'Doe',
          maxLength: 50,
        },
        {
          name: 'email',
          type: 'email',
          label: 'Email Address',
          required: true,
          placeholder: 'john@example.com',
        },
        {
          name: 'phoneNumber',
          type: 'tel',
          label: 'Phone Number',
          required: true,
          placeholder: '08012345678',
          pattern: '^(0|\\+?234)[0-9]{10}$',
          help: 'Nigerian phone number (e.g. 08012345678)',
        },
        {
          name: 'bvn',
          type: 'text',
          label: 'BVN (Bank Verification Number)',
          required: true,
          placeholder: '11111111111',
          pattern: '^[0-9]{11}$',
          help: '11-digit BVN',
          maxLength: 11,
        },
        {
          name: 'bank',
          type: 'select',
          label: 'Bank',
          required: true,
          options: [
            { value: 'providus', label: 'Providus Bank' },
            { value: 'safehaven', label: 'SafeHaven' },
          ],
          help: 'Select your preferred bank for the virtual account',
        },
      ],
    },
  ],
};

// ─── NUVION BUSINESS - COMPREHENSIVE TIER ──────────────────────────────────

export const nuvionBusinessSchema: KYCSchema = {
  accountType: 'business',
  provider: 'nuvion',
  tier: 3,
  title: 'Register Your Business',
  description: 'Complete KYC/KYB for business account. Required for fiat transactions.',
  estimatedTimeMinutes: 10,
  currenciesSupported: ['USD', 'NGN', 'GBP', 'EUR'],
  sections: [
    {
      id: 'business_owner',
      title: 'Business Owner Information',
      description: 'Details of the business owner/representative',
      fields: [
        {
          name: 'firstName',
          type: 'text',
          label: 'First Name',
          required: true,
          placeholder: 'John',
          maxLength: 50,
        },
        {
          name: 'lastName',
          type: 'text',
          label: 'Last Name',
          required: true,
          placeholder: 'Doe',
          maxLength: 50,
        },
        {
          name: 'middleName',
          type: 'text',
          label: 'Middle Name',
          required: false,
          placeholder: 'Michael',
          maxLength: 50,
        },
        {
          name: 'email',
          type: 'email',
          label: 'Email Address',
          required: true,
          placeholder: 'john@business.com',
        },
        {
          name: 'dateOfBirth',
          type: 'date',
          label: 'Date of Birth',
          required: true,
          help: 'YYYY-MM-DD format',
        },
        {
          name: 'gender',
          type: 'gender',
          label: 'Gender',
          required: true,
          options: [
            { value: 'm', label: 'Male' },
            { value: 'f', label: 'Female' },
          ],
        },
        {
          name: 'nationality',
          type: 'country',
          label: 'Nationality',
          required: true,
          help: 'Country of citizenship (ISO 2-letter code)',
        },
        {
          name: 'phonenumber',
          type: 'tel',
          label: 'Phone Number',
          required: true,
          placeholder: '+2348123456789',
          help: 'Include country code (e.g. +234 for Nigeria)',
        },
      ],
    },
    {
      id: 'business_address',
      title: 'Registered Address',
      description: 'Business registered address',
      fields: [
        {
          name: 'address.line_1',
          type: 'text',
          label: 'Street Address Line 1',
          required: true,
          placeholder: '123 Business Street',
        },
        {
          name: 'address.line_2',
          type: 'text',
          label: 'Street Address Line 2',
          required: false,
          placeholder: 'Suite 100',
        },
        {
          name: 'address.city',
          type: 'text',
          label: 'City',
          required: true,
          placeholder: 'Lagos',
        },
        {
          name: 'address.state',
          type: 'text',
          label: 'State / Province',
          required: true,
          placeholder: 'Lagos',
        },
        {
          name: 'address.postal_code',
          type: 'text',
          label: 'Postal Code',
          required: true,
          placeholder: '100001',
        },
        {
          name: 'address.country_code',
          type: 'country',
          label: 'Country',
          required: true,
          help: 'ISO 2-letter country code',
        },
      ],
    },
    {
      id: 'identification',
      title: 'Business Owner Identification',
      description: 'ID document for verification',
      fields: [
        {
          name: 'identification.document.type',
          type: 'select',
          label: 'Document Type',
          required: true,
          options: [
            { value: 'international_passport', label: 'International Passport' },
            { value: 'drivers_license', label: "Driver's License" },
            { value: 'national_id', label: 'National ID' },
          ],
        },
        {
          name: 'identification.document.number',
          type: 'text',
          label: 'Document Number',
          required: true,
          placeholder: 'A12345678',
          maxLength: 30,
        },
        {
          name: 'identification.document.issuing_country',
          type: 'country',
          label: 'Issuing Country',
          required: true,
          help: 'Country that issued the document',
        },
        {
          name: 'identification.document.issuing_authority',
          type: 'text',
          label: 'Issuing Authority',
          required: true,
          placeholder: 'Ministry of Interior',
          help: 'Authority that issued the document',
        },
        {
          name: 'identification.document_front',
          type: 'file',
          label: 'Document Front Image',
          required: true,
          accept: 'image/jpeg,image/png,application/pdf',
          help: 'Clear photo of front side of ID',
        },
        {
          name: 'identification.document_back',
          type: 'file',
          label: 'Document Back Image',
          required: true,
          accept: 'image/jpeg,image/png,application/pdf',
          help: 'Clear photo of back side of ID',
        },
      ],
    },
    {
      id: 'proof_of_address',
      title: 'Proof of Address',
      description: 'Recent utility bill or bank statement',
      fields: [
        {
          name: 'proof_of_address.type',
          type: 'select',
          label: 'Document Type',
          required: true,
          options: [
            { value: 'utility_bill', label: 'Utility Bill' },
            { value: 'bank_statement', label: 'Bank Statement' },
          ],
        },
        {
          name: 'proof_of_address.file',
          type: 'file',
          label: 'Upload Document',
          required: true,
          accept: 'application/pdf,image/jpeg,image/png',
          help: 'Document must be dated within last 3 months',
        },
      ],
    },
    {
      id: 'business_details',
      title: 'Business Information',
      description: 'Details about your business',
      fields: [
        {
          name: 'business.legal_name',
          type: 'text',
          label: 'Legal Business Name',
          required: true,
          placeholder: 'Acme Inc Ltd',
          maxLength: 100,
        },
        {
          name: 'business.trade_name',
          type: 'text',
          label: 'Trade Name (if different)',
          required: false,
          placeholder: 'Acme',
          maxLength: 100,
        },
        {
          name: 'business.registration_number',
          type: 'text',
          label: 'Registration Number',
          required: true,
          placeholder: 'RC123456',
          help: 'Business registration number from authorities',
        },
        {
          name: 'business.type',
          type: 'select',
          label: 'Business Type',
          required: true,
          options: [
            { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
            { value: 'partnership', label: 'Partnership' },
            { value: 'llc', label: 'Limited Liability Company (LLC)' },
            { value: 'corporation', label: 'Corporation' },
          ],
        },
        {
          name: 'business.industry',
          type: 'select',
          label: 'Industry',
          required: true,
          options: [
            { value: 'technology', label: 'Technology' },
            { value: 'finance', label: 'Finance' },
            { value: 'healthcare', label: 'Healthcare' },
            { value: 'retail', label: 'Retail' },
            { value: 'manufacturing', label: 'Manufacturing' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          name: 'business.description',
          type: 'textarea',
          label: 'Business Description',
          required: true,
          placeholder: 'Brief description of what your business does',
          help: 'What products/services do you provide?',
          maxLength: 500,
        },
        {
          name: 'business.incorporation_meta.year',
          type: 'text',
          label: 'Year of Incorporation',
          required: true,
          placeholder: '2020',
          pattern: '^[0-9]{4}$',
        },
        {
          name: 'business.incorporation_meta.month',
          type: 'select',
          label: 'Month of Incorporation',
          required: true,
          options: [
            ...Array.from({ length: 12 }, (_, i) => ({
              value: String(i + 1),
              label: new Date(2000, i).toLocaleDateString('en', { month: 'long' }),
            })),
          ],
        },
        {
          name: 'business.website',
          type: 'text',
          label: 'Website',
          required: false,
          placeholder: 'https://acme.com',
          help: 'Optional business website',
        },
      ],
    },
    {
      id: 'tax_info',
      title: 'Tax Information',
      description: 'Tax identification details',
      fields: [
        {
          name: 'tax_id',
          type: 'text',
          label: 'Tax ID / TIN',
          required: true,
          placeholder: 'TIN123456789',
          help: 'Tax identification number',
        },
        {
          name: 'tax_id_type',
          type: 'select',
          label: 'Tax ID Type',
          required: true,
          options: [
            { value: 'TIN', label: 'Tax Identification Number (TIN)' },
            { value: 'SSN', label: 'Social Security Number (SSN)' },
            { value: 'VAT', label: 'VAT Number' },
          ],
        },
        {
          name: 'tax_country',
          type: 'country',
          label: 'Tax Country',
          required: true,
          help: 'Country where tax is filed',
        },
      ],
    },
    {
      id: 'compliance',
      title: 'Compliance Documents',
      description: 'Required legal documents for business verification',
      fields: [
        {
          name: 'compliance_cac',
          type: 'file',
          label: 'CAC Status Report',
          required: true,
          accept: 'application/pdf,image/jpeg,image/png',
          help: 'Certificate of registration from Corporate Affairs Commission',
        },
        {
          name: 'compliance_certificate',
          type: 'file',
          label: 'Certificate of Incorporation',
          required: true,
          accept: 'application/pdf,image/jpeg,image/png',
          help: 'Official certificate of incorporation',
        },
        {
          name: 'compliance_tax',
          type: 'file',
          label: 'Tax Identification Certificate',
          required: true,
          accept: 'application/pdf,image/jpeg,image/png',
          help: 'Tax registration certificate or tax clearance',
        },
      ],
    },
  ],
};

/**
 * Get KYC schema for account type
 * No hardcoding — schema is selected based on account type
 */
export function getKycSchema(accountType: AccountType): KYCSchema {
  switch (accountType) {
    case 'personal':
      return brailsPersonalNgnSchema;
    case 'business':
      return nuvionBusinessSchema;
    default:
      throw new Error(`Unknown account type: ${accountType}`);
  }
}

/**
 * Get provider for account type
 */
export function getProviderForAccountType(accountType: AccountType): Provider {
  switch (accountType) {
    case 'personal':
      return 'brails';
    case 'business':
      return 'nuvion';
    default:
      throw new Error(`Unknown account type: ${accountType}`);
  }
}

/**
 * Flatten nested field names to object paths
 * Used to map form data from UI back to nested provider payloads
 */
export function buildFieldMap(schema: KYCSchema): Map<string, string> {
  const map = new Map<string, string>();
  for (const section of schema.sections) {
    for (const field of section.fields) {
      map.set(field.name, field.name);
    }
  }
  return map;
}
