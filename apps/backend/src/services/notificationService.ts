import { createDbClient, eq } from '@payit/db';
import { users, entities } from '@payit/db/schema';
import { SenviokClient } from '@payit/integrations';
import { env } from '../env.js';

const db = createDbClient(env.DATABASE_URL);
const senviok = new SenviokClient(env.SENVIOK_API_KEY, { BASE: env.SENVIOK_BASE_URL });

export interface TransactionNotificationContext {
  userId?: string;
  entityId?: string;
  amount: number | string;
  currency: string;
  reference?: string;
  timestamp?: Date;
}

export interface DepositNotificationParams extends TransactionNotificationContext {
  sourceDescription?: string;
  isCrypto?: boolean;
}

export interface WithdrawalNotificationParams extends TransactionNotificationContext {
  recipientDetails: string;
  bankName?: string;
}

export interface SavingsDepositParams extends TransactionNotificationContext {
  vaultName?: string;
  apy?: string;
}

export interface SavingsWithdrawalParams extends TransactionNotificationContext {
  vaultName?: string;
}

interface UserContactInfo {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  whatsappEnabled: boolean;
}

function formatMoney(amount: number | string, currency: string): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || '0');
  const symbol = currency.toUpperCase() === 'NGN' ? '₦' : currency.toUpperCase() === 'EUR' ? '€' : currency.toUpperCase() === 'GBP' ? '£' : '$';
  return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildEmailHtml(title: string, greetingName: string, messageBody: string, details: Array<{ label: string; value: string }>): string {
  const detailRows = details
    .map(
      (d) => `
      <tr>
        <td style="padding: 10px 0; color: #8E9BAE; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.06);">${d.label}</td>
        <td style="padding: 10px 0; color: #F7F8F4; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.06);">${d.value}</td>
      </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #060B14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F7F8F4;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; margin: 0 auto; background-color: #0B1320; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden;">
    <tr>
      <td style="padding: 28px 32px; border-bottom: 1px solid rgba(255,255,255,0.06);">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #35D9D0;">Proxim</span>
            </td>
            <td style="text-align: right;">
              <span style="display: inline-block; padding: 4px 10px; border-radius: 999px; background: rgba(53, 217, 208, 0.12); color: #35D9D0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Account Notice</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #F7F8F4; letter-spacing: -0.5px;">${title}</h2>
        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #B0BCCB;">
          Hello ${greetingName || 'there'},<br><br>
          ${messageBody}
        </p>

        <div style="background-color: #080D16; border-radius: 12px; padding: 18px 20px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 28px;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            ${detailRows}
          </table>
        </div>

        <p style="margin: 0; font-size: 13px; color: #64748B; line-height: 1.5;">
          You can view your real-time balance and transaction receipts anytime in your Proxim dashboard.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 32px; background-color: #070D18; border-top: 1px solid rgba(255,255,255,0.04); text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #526071;">
          © ${new Date().getFullYear()} Proxim Payments Inc. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export class NotificationService {
  /**
   * Resolve user contact and preferences from userId or entityId
   */
  private static async resolveUser(userId?: string, entityId?: string): Promise<UserContactInfo | null> {
    try {
      let resolvedUserId = userId;

      if (!resolvedUserId && entityId) {
        const entityRows = await db.select({ userId: entities.userId }).from(entities).where(eq(entities.id, entityId)).limit(1);
        if (entityRows.length > 0) {
          resolvedUserId = entityRows[0].userId;
        }
      }

      if (!resolvedUserId) return null;

      const userRows = await db.select().from(users).where(eq(users.id, resolvedUserId)).limit(1);
      if (userRows.length === 0) return null;

      const u = userRows[0];
      return {
        id: u.id,
        fullName: u.fullName || 'User',
        email: u.email,
        phone: u.phone || null,
        whatsappEnabled: !!u.whatsappNotificationsEnabled,
      };
    } catch (err: any) {
      console.error('[NotificationService] Error resolving user:', err.message);
      return null;
    }
  }

  /**
   * Send dual Email (default) and WhatsApp (opt-in) notifications
   */
  private static async dispatch(user: UserContactInfo, emailPayload: { subject: string; html: string; text: string }, whatsappText: string) {
    const promises: Promise<any>[] = [];

    // 1. Email (Default for all users)
    if (user.email) {
      promises.push(
        senviok.emails
          .send({
            from: env.SENVIOK_FROM_EMAIL || 'onboarding@senviok.live',
            fromName: 'Proxim',
            to: user.email,
            subject: emailPayload.subject,
            html: emailPayload.html,
            text: emailPayload.text,
          })
          .then((res: { id?: string }) => console.log(`[NotificationService] Email dispatched to ${user.email}: ${res.id}`))
          .catch((err: { message?: string }) => console.error(`[NotificationService] Email delivery failed for ${user.email}:`, err.message))
      );
    }

    // 2. WhatsApp (Opt-in only)
    if (user.whatsappEnabled && user.phone) {
      promises.push(
        senviok.whatsapp
          .send({
            from: env.SENVIOK_WHATSAPP_FROM || undefined,
            to: user.phone,
            text: whatsappText,
          })
          .then((res: { id?: string }) => console.log(`[NotificationService] WhatsApp dispatched to ${user.phone}: ${res.id}`))
          .catch((err: { message?: string }) => console.error(`[NotificationService] WhatsApp delivery failed for ${user.phone}:`, err.message))
      );
    }

    await Promise.allSettled(promises);
  }

  /**
   * 1. Deposit Confirmation (On-chain & Off-chain)
   */
  public static async notifyDepositConfirmed(params: DepositNotificationParams) {
    const user = await this.resolveUser(params.userId, params.entityId);
    if (!user) return;

    const formattedAmount = formatMoney(params.amount, params.currency);
    const source = params.sourceDescription || (params.isCrypto ? 'Direct deposit' : 'Bank transfer');
    const ref = params.reference || `DEP-${Date.now().toString().slice(-6)}`;
    const dateStr = (params.timestamp || new Date()).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    const subject = `Payment received (${formattedAmount})`;
    const messageBody = `We've confirmed your deposit of <strong>${formattedAmount}</strong>. The funds are now available in your balance.`;
    const details = [
      { label: 'Amount Credited', value: formattedAmount },
      { label: 'Payment Method', value: source },
      { label: 'Status', value: 'Completed' },
      { label: 'Reference', value: ref },
      { label: 'Date & Time', value: dateStr },
    ];

    const html = buildEmailHtml('Payment received.', user.fullName, messageBody, details);
    const text = `Payment received.\n\nHello ${user.fullName},\n\nWe've confirmed your deposit of ${formattedAmount}. The funds are now available in your balance.\n\nAmount: ${formattedAmount}\nSource: ${source}\nReference: ${ref}\nDate: ${dateStr}\n\n— Proxim`;
    const whatsapp = `*Payment received.*\n\nHello ${user.fullName}, we have confirmed your deposit of *${formattedAmount}* via ${source}. Your available balance has been updated.\n\nReference: ${ref}`;

    await this.dispatch(user, { subject, html, text }, whatsapp);
  }

  /**
   * 2. Withdrawal Confirmation
   */
  public static async notifyWithdrawalCompleted(params: WithdrawalNotificationParams) {
    const user = await this.resolveUser(params.userId, params.entityId);
    if (!user) return;

    const formattedAmount = formatMoney(params.amount, params.currency);
    const ref = params.reference || `WD-${Date.now().toString().slice(-6)}`;
    const dateStr = (params.timestamp || new Date()).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    const subject = `Money sent (${formattedAmount})`;
    const messageBody = `Your withdrawal of <strong>${formattedAmount}</strong> to <strong>${params.recipientDetails}</strong> has been completed.`;
    const details = [
      { label: 'Amount Sent', value: formattedAmount },
      { label: 'Recipient', value: params.recipientDetails },
      ...(params.bankName ? [{ label: 'Destination Bank', value: params.bankName }] : []),
      { label: 'Status', value: 'Completed' },
      { label: 'Reference', value: ref },
      { label: 'Date & Time', value: dateStr },
    ];

    const html = buildEmailHtml('Money sent.', user.fullName, messageBody, details);
    const text = `Money sent.\n\nHello ${user.fullName},\n\nYour withdrawal of ${formattedAmount} to ${params.recipientDetails} has been completed.\n\nAmount: ${formattedAmount}\nRecipient: ${params.recipientDetails}\nReference: ${ref}\nDate: ${dateStr}\n\n— Proxim`;
    const whatsapp = `*Money sent.*\n\nHello ${user.fullName}, your withdrawal of *${formattedAmount}* to *${params.recipientDetails}* has been sent.\n\nReference: ${ref}`;

    await this.dispatch(user, { subject, html, text }, whatsapp);
  }

  /**
   * 3. Savings Deposit Confirmation
   */
  public static async notifySavingsDeposited(params: SavingsDepositParams) {
    const user = await this.resolveUser(params.userId, params.entityId);
    if (!user) return;

    const formattedAmount = formatMoney(params.amount, params.currency);
    const vault = params.vaultName || 'Proxim Reserve';
    const apyStr = params.apy || '7.8% p.a.';
    const ref = params.reference || `SAV-${Date.now().toString().slice(-6)}`;
    const dateStr = (params.timestamp || new Date()).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    const subject = `Savings updated (+${formattedAmount})`;
    const messageBody = `You've added <strong>${formattedAmount}</strong> to your <strong>${vault}</strong>. Your savings are now earning daily yield at <strong>${apyStr}</strong>.`;
    const details = [
      { label: 'Amount Added', value: formattedAmount },
      { label: 'Savings Vault', value: vault },
      { label: 'Annual Yield', value: apyStr },
      { label: 'Status', value: 'Active & Earning' },
      { label: 'Reference', value: ref },
      { label: 'Date', value: dateStr },
    ];

    const html = buildEmailHtml('Savings updated.', user.fullName, messageBody, details);
    const text = `Savings updated.\n\nHello ${user.fullName},\n\nYou've added ${formattedAmount} to your ${vault}. Your savings are now earning daily yield at ${apyStr}.\n\nAmount: ${formattedAmount}\nVault: ${vault}\nYield: ${apyStr}\nReference: ${ref}\n\n— Proxim`;
    const whatsapp = `*Savings updated.*\n\nHello ${user.fullName}, you have added *${formattedAmount}* to your *${vault}*. Your position is earning *${apyStr}* annual yield.\n\nReference: ${ref}`;

    await this.dispatch(user, { subject, html, text }, whatsapp);
  }

  /**
   * 4. Savings Withdrawal Confirmation
   */
  public static async notifySavingsWithdrawn(params: SavingsWithdrawalParams) {
    const user = await this.resolveUser(params.userId, params.entityId);
    if (!user) return;

    const formattedAmount = formatMoney(params.amount, params.currency);
    const vault = params.vaultName || 'Proxim Reserve';
    const ref = params.reference || `SWD-${Date.now().toString().slice(-6)}`;
    const dateStr = (params.timestamp || new Date()).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    const subject = `Savings withdrawn (${formattedAmount})`;
    const messageBody = `You've withdrawn <strong>${formattedAmount}</strong> from your <strong>${vault}</strong>. The funds have been returned to your available balance.`;
    const details = [
      { label: 'Amount Withdrawn', value: formattedAmount },
      { label: 'From Vault', value: vault },
      { label: 'Status', value: 'Returned to Balance' },
      { label: 'Reference', value: ref },
      { label: 'Date', value: dateStr },
    ];

    const html = buildEmailHtml('Savings withdrawn.', user.fullName, messageBody, details);
    const text = `Savings withdrawn.\n\nHello ${user.fullName},\n\nYou've withdrawn ${formattedAmount} from your ${vault}. The funds have been returned to your available balance.\n\nAmount: ${formattedAmount}\nVault: ${vault}\nReference: ${ref}\n\n— Proxim`;
    const whatsapp = `*Savings withdrawn.*\n\nHello ${user.fullName}, *${formattedAmount}* has been withdrawn from your *${vault}* and returned to your available balance.\n\nReference: ${ref}`;

    await this.dispatch(user, { subject, html, text }, whatsapp);
  }
}
