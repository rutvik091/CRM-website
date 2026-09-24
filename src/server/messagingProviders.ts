import { db } from './db';
import { DeliveryStatus } from './types';

export interface DispatchResult {
  channel: 'WHATSAPP' | 'SMS';
  status: DeliveryStatus;
  messageId?: string;
  errorMessage?: string;
  notes: string;
}

export class WhatsAppProvider {
  public static isConfigured(): boolean {
    return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  }

  public static async sendTemplateMessage(
    mobile: string,
    messageText: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'WhatsApp integration is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in environment variables.'
      };
    }

    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const cleanNumber = mobile.replace(/\D/g, '');
    const formattedRecipient = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;

    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedRecipient,
          type: 'text',
          text: { body: messageText }
        })
      });

      const data = await response.json();
      if (response.ok && data.messages?.[0]?.id) {
        return { success: true, messageId: data.messages[0].id };
      }
      return { success: false, error: data.error?.message || 'Meta API delivery failed' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export class SMSProvider {
  public static isConfigured(): boolean {
    return !!(process.env.SMS_API_KEY || process.env.FAST2SMS_API_KEY || process.env.TWILIO_ACCOUNT_SID);
  }

  public static async sendSMS(
    mobile: string,
    messageText: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'SMS integration is not configured. Please set SMS_API_KEY or provider credentials in environment variables.'
      };
    }

    // Example with Fast2SMS route
    const apiKey = process.env.SMS_API_KEY || process.env.FAST2SMS_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            route: 'v3',
            sender_id: 'TXTIND',
            message: messageText,
            language: 'english',
            flash: 0,
            numbers: mobile.replace(/\D/g, '').slice(-10)
          })
        });
        const data = await response.json();
        if (data.return) {
          return { success: true, messageId: data.request_id };
        }
        return { success: false, error: data.message || 'SMS delivery failed' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Configured SMS provider not recognized' };
  }
}

export class MessagingService {
  /**
   * Dispatches reminder notification through WhatsApp or SMS
   * CRITICAL: Sensitive cover amounts and premium figures are strictly omitted from client messages
   */
  public static async dispatchReminder(
    reminderId: string,
    channel: 'WHATSAPP' | 'SMS',
    mobile: string,
    messageText: string
  ): Promise<DispatchResult> {
    const id = `deliv_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if (channel === 'WHATSAPP') {
      if (!WhatsAppProvider.isConfigured()) {
        await db.query(
          `INSERT INTO reminder_deliveries (id, reminder_id, channel, recipient_mobile, message_content, status, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, reminderId, 'WHATSAPP', mobile, messageText, 'NOT_CONFIGURED', 'WhatsApp provider credentials not set']
        );
        return {
          channel: 'WHATSAPP',
          status: 'NOT_CONFIGURED',
          notes: 'WhatsApp integration is not configured in environment variables.'
        };
      }

      const res = await WhatsAppProvider.sendTemplateMessage(mobile, messageText);
      const status: DeliveryStatus = res.success ? 'SENT' : 'FAILED';
      await db.query(
        `INSERT INTO reminder_deliveries (id, reminder_id, channel, recipient_mobile, message_content, status, provider_message_id, error_message, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, reminderId, 'WHATSAPP', mobile, messageText, status, res.messageId || null, res.error || null, res.success ? new Date().toISOString() : null]
      );

      return {
        channel: 'WHATSAPP',
        status,
        messageId: res.messageId,
        errorMessage: res.error,
        notes: res.success ? 'WhatsApp message dispatched to provider' : `WhatsApp failed: ${res.error}`
      };
    } else {
      if (!SMSProvider.isConfigured()) {
        await db.query(
          `INSERT INTO reminder_deliveries (id, reminder_id, channel, recipient_mobile, message_content, status, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, reminderId, 'SMS', mobile, messageText, 'NOT_CONFIGURED', 'SMS provider credentials not set']
        );
        return {
          channel: 'SMS',
          status: 'NOT_CONFIGURED',
          notes: 'SMS integration is not configured in environment variables.'
        };
      }

      const res = await SMSProvider.sendSMS(mobile, messageText);
      const status: DeliveryStatus = res.success ? 'SENT' : 'FAILED';
      await db.query(
        `INSERT INTO reminder_deliveries (id, reminder_id, channel, recipient_mobile, message_content, status, provider_message_id, error_message, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, reminderId, 'SMS', mobile, messageText, status, res.messageId || null, res.error || null, res.success ? new Date().toISOString() : null]
      );

      return {
        channel: 'SMS',
        status,
        messageId: res.messageId,
        errorMessage: res.error,
        notes: res.success ? 'SMS message dispatched to provider' : `SMS failed: ${res.error}`
      };
    }
  }
}
