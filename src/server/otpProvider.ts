import crypto from 'crypto';
import { db } from './db';

export interface SendOtpResult {
  success: boolean;
  message: string;
  cooldownSeconds: number;
  provider: string;
  debugOtp?: string; // Only returned in non-production or when OTP_PROVIDER=mock
}

export interface VerifyOtpResult {
  valid: boolean;
  message?: string;
}

export interface IOTPProvider {
  name: string;
  sendSMS(mobile: string, otp: string, purpose: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// 1. Fast2SMS Provider (Common Indian SMS Gateway for transactional OTPs)
class Fast2SMSProvider implements IOTPProvider {
  name = 'FAST2SMS';
  async sendSMS(mobile: string, otp: string, purpose: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const apiKey = process.env.FAST2SMS_API_KEY || process.env.OTP_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'FAST2SMS_API_KEY not configured' };
    }

    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: otp,
          numbers: mobile.replace(/\D/g, '').slice(-10)
        })
      });
      const data = await response.json();
      if (data.return) {
        return { success: true, messageId: data.request_id };
      }
      return { success: false, error: data.message || 'Fast2SMS dispatch failed' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

// 2. Twilio SMS Provider
class TwilioProvider implements IOTPProvider {
  name = 'TWILIO';
  async sendSMS(mobile: string, otp: string, purpose: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return { success: false, error: 'Twilio credentials not configured' };
    }

    try {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const formattedNumber = mobile.startsWith('+') ? mobile : `+91${mobile.replace(/\D/g, '').slice(-10)}`;
      const messageBody = `Your My Investment Manager verification code is ${otp}. Valid for 5 minutes. Do not share.`;

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: formattedNumber,
          Body: messageBody
        })
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, messageId: data.sid };
      }
      return { success: false, error: data.message || 'Twilio SMS failed' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

// 3. Development / Mock Provider (ONLY when explicitly enabled or in development mode)
class MockDevelopmentOTPProvider implements IOTPProvider {
  name = 'MOCK_DEV';
  async sendSMS(mobile: string, otp: string, purpose: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (process.env.NODE_ENV === 'production' && process.env.OTP_PROVIDER !== 'mock') {
      return { success: false, error: 'Mock OTP provider is strictly prohibited in production mode' };
    }
    console.log(`\n======================================================`);
    console.log(`[DEVELOPMENT ONLY] OTP generated for +91 ${mobile}: ${otp} (Purpose: ${purpose})`);
    console.log(`======================================================\n`);
    return { success: true, messageId: `mock_${Date.now()}` };
  }
}

export class OTPService {
  private static getActiveProvider(): IOTPProvider {
    const configuredProvider = (process.env.OTP_PROVIDER || '').toUpperCase();

    if (configuredProvider === 'FAST2SMS') return new Fast2SMSProvider();
    if (configuredProvider === 'TWILIO') return new TwilioProvider();

    // Default to mock provider for local development with clear log
    return new MockDevelopmentOTPProvider();
  }

  private static hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Generates, stores, and dispatches a 6-digit cryptographic OTP
   */
  public static async requestOTP(
    identifier: string,
    purpose: 'LOGIN' | 'ADMIN_SETUP' | 'PASSWORD_RESET'
  ): Promise<SendOtpResult> {
    const cleanMobile = identifier.replace(/\D/g, '').slice(-10);
    if (!cleanMobile || cleanMobile.length < 10) {
      throw new Error('Valid 10-digit mobile number required');
    }

    // Rate limiting: Check for existing unexpired OTP created in the last 60 seconds (cooldown)
    const sixtySecsAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const recentRes = await db.query(
      `SELECT created_at FROM otp_records 
       WHERE identifier = $1 AND purpose = $2 AND created_at > $3
       ORDER BY created_at DESC LIMIT 1`,
      [cleanMobile, purpose, sixtySecsAgo]
    );

    if (recentRes.rows.length > 0) {
      return {
        success: false,
        message: 'Please wait 60 seconds before requesting a new OTP.',
        cooldownSeconds: 60,
        provider: 'COOLDOWN'
      };
    }

    // Invalidate previous unverified OTPs for this identifier and purpose
    await db.query(
      `UPDATE otp_records SET verified = TRUE 
       WHERE identifier = $1 AND purpose = $2 AND verified = FALSE`,
      [cleanMobile, purpose]
    );

    // Generate 6-digit cryptographically secure numeric OTP
    const rawOtp = String(crypto.randomInt(100000, 999999));
    const otpHash = this.hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes expiry
    const id = `otp_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;

    // Store secure hash in PostgreSQL
    await db.query(
      `INSERT INTO otp_records (id, identifier, otp_hash, purpose, expires_at, verified, attempts)
       VALUES ($1, $2, $3, $4, $5, FALSE, 0)`,
      [id, cleanMobile, otpHash, purpose, expiresAt]
    );

    const provider = this.getActiveProvider();
    const dispatchResult = await provider.sendSMS(cleanMobile, rawOtp, purpose);

    const isDev = process.env.NODE_ENV !== 'production' || process.env.OTP_PROVIDER === 'mock';

    return {
      success: dispatchResult.success,
      message: dispatchResult.success
        ? `Verification code dispatched to +91 ${cleanMobile.slice(0, 2)}******${cleanMobile.slice(-2)}`
        : `Failed dispatching SMS (${dispatchResult.error || 'Provider error'}).`,
      cooldownSeconds: 60,
      provider: provider.name,
      debugOtp: isDev ? rawOtp : undefined
    };
  }

  /**
   * Verifies an OTP against PostgreSQL hash with attempt counting and expiration
   */
  public static async verifyOTP(
    identifier: string,
    rawOtp: string,
    purpose: 'LOGIN' | 'ADMIN_SETUP' | 'PASSWORD_RESET'
  ): Promise<VerifyOtpResult> {
    const cleanMobile = identifier.replace(/\D/g, '').slice(-10);
    const inputHash = this.hashOtp(rawOtp.trim());

    const res = await db.query(
      `SELECT * FROM otp_records 
       WHERE identifier = $1 AND purpose = $2 AND verified = FALSE 
       ORDER BY created_at DESC LIMIT 1`,
      [cleanMobile, purpose]
    );

    if (res.rows.length === 0) {
      return { valid: false, message: 'No active OTP request found. Please request a new OTP.' };
    }

    const record = res.rows[0];

    // Check expiration
    if (new Date(record.expires_at).getTime() < Date.now()) {
      await db.query(`UPDATE otp_records SET verified = TRUE WHERE id = $1`, [record.id]);
      return { valid: false, message: 'OTP has expired. Please request a new OTP.' };
    }

    // Check max attempts (3 maximum)
    if (record.attempts >= 3) {
      await db.query(`UPDATE otp_records SET verified = TRUE WHERE id = $1`, [record.id]);
      return { valid: false, message: 'Too many failed attempts. This OTP has been invalidated.' };
    }

    // Increment attempts
    await db.query(`UPDATE otp_records SET attempts = attempts + 1 WHERE id = $1`, [record.id]);

    if (record.otp_hash !== inputHash) {
      const remaining = 2 - record.attempts;
      return {
        valid: false,
        message: remaining > 0
          ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Invalid OTP. No attempts remaining. Please request a new OTP.'
      };
    }

    // Mark verified
    await db.query(`UPDATE otp_records SET verified = TRUE WHERE id = $1`, [record.id]);
    return { valid: true };
  }
}
