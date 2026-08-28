/**
 * Error Escalator Service
 * 
 * Centralized error handling with severity-based escalation
 * Logs errors to database and sends alerts for critical issues
 */

import { createDbClient, eq } from '@payit/db';
import { errorLogs } from '@payit/db/schema';
import { ulid } from 'ulid';

const db = createDbClient();

export interface ErrorLog {
  id: string;
  type: string;
  message: string;
  context: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

export class ErrorEscalator {
  private static readonly SEVERITY_LEVELS = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  } as const;

  /**
   * Escalate an error with context and severity
   */
  static async escalate(error: {
    type: string;
    message: string;
    context: Record<string, any>;
    severity: keyof typeof ErrorEscalator.SEVERITY_LEVELS;
  }) {
    try {
      // Log to database for audit trail
      await db.insert(errorLogs).values({
        id: ulid(),
        type: error.type,
        message: error.message,
        context: JSON.stringify(error.context),
        severity: this.SEVERITY_LEVELS[error.severity],
        timestamp: new Date(),
      });

      console.error(`[Error Escalator] ${error.severity.toUpperCase()}: ${error.type} - ${error.message}`);

      // Send alerts based on severity
      if (error.severity === 'CRITICAL' || error.severity === 'HIGH') {
        await this.sendAlert(error);
      }
    } catch (logError: any) {
      console.error('[Error Escalator] Failed to log error:', logError.message);
    }
  }

  /**
   * Send alert to configured channels (Slack, Discord, PagerDuty, etc.)
   */
  private static async sendAlert(error: any) {
    try {
      // Slack webhook integration
      if (process.env.SLACK_WEBHOOK_URL) {
        await this.sendSlackAlert(error);
      }

      // Discord webhook integration
      if (process.env.DISCORD_WEBHOOK_URL) {
        await this.sendDiscordAlert(error);
      }

      // PagerDuty integration (for critical only)
      if (error.severity === 'CRITICAL' && process.env.PAGERDUTY_API_KEY) {
        await this.sendPagerDutyAlert(error);
      }
    } catch (alertError: any) {
      console.error('[Error Escalator] Failed to send alert:', alertError.message);
    }
  }

  /**
   * Send alert to Slack
   */
  private static async sendSlackAlert(error: any) {
    const colorMap: Record<string, string> = {
      low: '#36a64f',
      medium: '#ff9900',
      high: '#ff0000',
      critical: '#ff0000',
    };

    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [
          {
            color: colorMap[error.severity] || '#ff0000',
            title: `🚨 ${error.severity.toUpperCase()}: ${error.type}`,
            text: error.message,
            fields: [
              {
                title: 'Context',
                value: '```json\n' + JSON.stringify(error.context, null, 2) + '\n```',
                short: false,
              },
              {
                title: 'Timestamp',
                value: new Date().toISOString(),
                short: true,
              },
            ],
          },
        ],
      }),
    });
  }

  /**
   * Send alert to Discord
   */
  private static async sendDiscordAlert(error: any) {
    const colorMap: Record<string, number> = {
      low: 5763719,
      medium: 16776960,
      high: 16711680,
      critical: 16711680,
    };

    await fetch(process.env.DISCORD_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `🚨 ${error.severity.toUpperCase()}: ${error.type}`,
            description: error.message,
            color: colorMap[error.severity] || 16711680,
            fields: [
              {
                name: 'Context',
                value: '```json\n' + JSON.stringify(error.context, null, 2) + '\n```',
              },
              {
                name: 'Timestamp',
                value: new Date().toISOString(),
              },
            ],
          },
        ],
      }),
    });
  }

  /**
   * Send alert to PagerDuty (critical only)
   */
  private static async sendPagerDutyAlert(error: any) {
    await fetch(`https://events.pagerduty.com/v2/enqueue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token token=${process.env.PAGERDUTY_API_KEY}`,
      },
      body: JSON.stringify({
        routing_key: process.env.PAGERDUTY_ROUTING_KEY,
        event_action: 'trigger',
        payload: {
          summary: `${error.type}: ${error.message}`,
          severity: 'critical',
          source: 'payit-backend',
          custom_details: error.context,
        },
      }),
    });
  }

  /**
   * Query recent errors by severity
   */
  static async getRecentErrors(severity?: string, limit: number = 50) {
    try {
      if (severity) {
        return await db.select().from(errorLogs)
          .where(eq(errorLogs.severity, severity as 'low' | 'medium' | 'high' | 'critical'))
          .orderBy((errorLogs: any) => errorLogs.timestamp)
          .limit(limit);
      }
      
      return await db.select().from(errorLogs)
        .orderBy((errorLogs: any) => errorLogs.timestamp)
        .limit(limit);
    } catch (error: any) {
      console.error('[Error Escalator] Failed to query errors:', error.message);
      return [];
    }
  }
}
