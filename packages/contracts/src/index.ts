import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  fullName: z.string(),
  createdAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const EntityKindSchema = z.enum(['PERSONAL', 'BUSINESS']);
export type EntityKind = z.infer<typeof EntityKindSchema>;

export const EntitySchema = z.object({
  id: z.string(),
  userId: z.string(),
  kind: EntityKindSchema,
  legalName: z.string(),
  username: z.string().optional(),
  businessTag: z.string().optional(),
  nuvionTier: z.number().int(),
  nuvionStatus: z.enum(['incomplete', 'pending', 'approved', 'rejected']),
  nuvionEntityId: z.string().optional(),
  xpub: z.string().optional(),
  createdAt: z.string(),
});
export type Entity = z.infer<typeof EntitySchema>;

export const AccountSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  nuvionAccountId: z.string(),
  accountNumber: z.string(),
  bankName: z.string(),
  accountHolderName: z.string(),
  currency: z.string(),
  status: z.string(),
  createdAt: z.string(),
});
export type Account = z.infer<typeof AccountSchema>;

export const CardSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  accountId: z.string(),
  nuvionCardId: z.string(),
  last4: z.string().length(4),
  brand: z.string(),
  status: z.string(),
  createdAt: z.string(),
});
export type Card = z.infer<typeof CardSchema>;

export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  accountNumber: z.string(),
  bankName: z.string(),
});
export type Customer = z.infer<typeof CustomerSchema>;

// Audit Inoculation Matrix B.4: Customer Payload Shape must be an array
export const CustomerListSchema = z.array(CustomerSchema);
export type CustomerList = z.infer<typeof CustomerListSchema>;

export const InvoiceItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  amount: z.number().positive(),
});

export const InvoiceSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  tag: z.string(), // e.g. ACME-014
  clientName: z.string(),
  clientEmail: z.string().email(),
  totalAmount: z.number().positive(),
  currency: z.string(),
  dueDate: z.string(),
  hdIndex: z.number().int(),
  hdReceivingAddress: z.string(),
  settlementType: z.enum(['fiat', 'stablecoin']),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']),
  items: z.array(InvoiceItemSchema),
  createdAt: z.string(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

export const PayrollItemSchema = z.object({
  id: z.string().optional(),
  recipientName: z.string(),
  recipientAccountOrTag: z.string(),
  amount: z.number().positive(),
  status: z.enum(['pending', 'success', 'failed']).default('pending'),
  errorMessage: z.string().optional(),
});
export type PayrollItem = z.infer<typeof PayrollItemSchema>;

export const PayrollRunSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  title: z.string(),
  totalAmount: z.number().positive(),
  status: z.enum(['draft', 'reviewing', 'processing', 'completed', 'failed']),
  items: z.array(PayrollItemSchema),
  createdAt: z.string(),
});
export type PayrollRun = z.infer<typeof PayrollRunSchema>;

export const TransferRequestSchema = z.object({
  entityId: z.string(),
  recipientTagOrAccount: z.string(),
  amount: z.number().positive(),
  currency: z.string(),
  narration: z.string().optional(),
  isInterEntityTransfer: z.boolean().default(false),
});
export type TransferRequest = z.infer<typeof TransferRequestSchema>;

// DTO Sanitizer to prevent raw private key leaks (Audit Inoculation Matrix C.3)
export function omitPrivateKey<T extends Record<string, any>>(obj: T): Omit<T, 'privateKey' | 'secretKey' | 'seedPhrase'> {
  const { privateKey, secretKey, seedPhrase, ...rest } = obj;
  return rest;
}

// Smart Contract Token Address Constants parameterized via environment variables (Issue 5)
export const USDC_CONTRACT_ADDRESS =
  process.env.USDC_CONTRACT_ADDRESS || '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

export const USDT_CONTRACT_ADDRESS =
  process.env.USDT_CONTRACT_ADDRESS || '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';
