import { db } from './db';
import { Reminder, ProductType, ReminderType } from './types';

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function formatDateYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class ReminderEngine {
  /**
   * Helper to format date in YYYY-MM-DD in Asia/Kolkata timezone
   */
  public static getISTDate(date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  }

  /**
   * Calculates difference in calendar days
   */
  public static diffInDays(targetDateStr: string, currentDateStr: string): number {
    const target = new Date(`${targetDateStr}T00:00:00Z`).getTime();
    const current = new Date(`${currentDateStr}T00:00:00Z`).getTime();
    return Math.round((target - current) / (1000 * 60 * 60 * 24));
  }

  /**
   * Computes the next monthly SIP target date for a given day of month (1-31)
   */
  public static getNextSipDebitDate(debitDay: number, fromDate: Date = new Date()): string {
    const year = fromDate.getFullYear();
    const month = fromDate.getMonth();
    const currentDay = fromDate.getDate();

    let targetMonth = month;
    let targetYear = year;

    if (currentDay > debitDay) {
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }

    // Days in target month
    const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
    const safeDay = Math.min(debitDay, maxDays);

    const mStr = String(targetMonth + 1).padStart(2, '0');
    const dStr = String(safeDay).padStart(2, '0');
    return `${targetYear}-${mStr}-${dStr}`;
  }

  /**
   * Formats compliant client reminder notification message
   * CRITICAL: Excludes premium or cover amounts
   */
  public static formatClientMessage(
    customerName: string,
    productType: ProductType,
    reminderType: ReminderType,
    identifier: string,
    targetDate: string,
    stage: number
  ): string {
    const formattedDate = new Date(targetDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    if (productType === 'SIP') {
      return `Dear ${customerName}, this is a gentle reminder that your monthly SIP for ${identifier} is scheduled for debit on ${formattedDate}. Please ensure sufficient bank account balance. Warm regards, My Investment Manager.`;
    }

    if (reminderType === 'MATURITY') {
      return `Dear ${customerName}, your Life Insurance Policy (No: ${identifier}) is maturing on ${formattedDate}. Our service team will contact you regarding the maturity processing. Best regards, My Investment Manager.`;
    }

    // Insurance Renewal (10, 5, 2 days)
    const urgency = stage === 2 ? 'URGENT: ' : stage === 5 ? 'Reminder: ' : '';
    const prodName = productType === 'MEDICAL_INSURANCE' ? 'Health Insurance Policy' : 'Life Insurance Policy';
    return `${urgency}Dear ${customerName}, your ${prodName} (No: ${identifier}) is due for annual renewal on ${formattedDate}. Kindly renew on time to ensure uninterrupted coverage. Contact your relationship manager for assistance. My Investment Manager.`;
  }

  /**
   * Main daily evaluation run
   * Evaluates all active SIPs, Medical Insurances, and Life Insurances against Asia/Kolkata date
   */
  public static async runEngine(date: Date = new Date()): Promise<{ created: number; skipped: number }> {
    const today = this.getISTDate(date);
    const todayDate = new Date(date);
    let created = 0;
    let skipped = 0;

    const medsRes = await db.query("SELECT * FROM medical_insurances WHERE status = 'Active'");
    for (const med of medsRes.rows) {
      if (!med.renewal_date) continue;
      const daysUntil = this.diffInDays(med.renewal_date, today);
      for (const stage of [10, 5, 2]) {
        if (daysUntil === stage || (daysUntil < stage && daysUntil >= 0 && stage === 2)) {
          const cycleKey = `${med.customer_id}_${med.id}_RENEWAL_${med.renewal_date}_${stage}`;
          const existsRes = await db.query("SELECT id FROM reminders WHERE idempotency_key = $1", [cycleKey]);
          if (existsRes.rows.length > 0) { skipped++; continue; }
          const reminderId = `rem_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          await db.query(
            `INSERT INTO reminders (id, customer_id, product_id, product_type, reminder_type, target_date, reminder_date, escalation_stage, idempotency_key, status, cycle_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [reminderId, med.customer_id, med.id, 'MEDICAL_INSURANCE', 'RENEWAL', med.renewal_date, today, stage, cycleKey, daysUntil <= 0 ? 'Due' : 'Upcoming', cycleKey]
          );
          created++;
        }
      }
    }

    return { created, skipped };
  }

  public static async completeReminder(reminderId: string, userId: string, method: 'CALL' | 'WHATSAPP', notes: string): Promise<void> {
    await db.query(
      `UPDATE reminders SET status = 'Completed', completed_at = $1, completed_method = $2, completion_notes = $3 WHERE id = $4`,
      [new Date().toISOString(), method, notes, reminderId]
    );
  }

  public static async evaluateReminders(): Promise<{ created: number; skipped: number }> {
    const todayIST = this.getISTDate();
    let created = 0;
    let skipped = 0;

    // 1. Evaluate Medical Insurance Renewals (10, 5, 2 days before renewal_date)
    const medsRes = await db.query("SELECT * FROM medical_insurances WHERE status = 'Active'");
    for (const med of medsRes.rows) {
      if (!med.renewal_date) continue;
      const daysUntil = this.diffInDays(med.renewal_date, todayIST);

      const stages = [10, 5, 2];
      for (const stage of stages) {
        if (daysUntil === stage || (daysUntil < stage && daysUntil >= 0 && stage === 2)) {
          const idempotencyKey = `${med.customer_id}_${med.id}_RENEWAL_${med.renewal_date}_${stage}`;

          // Check if already created or completed
          const existsRes = await db.query(
            "SELECT id, status FROM reminders WHERE idempotency_key = $1",
            [idempotencyKey]
          );

          if (existsRes.rows.length > 0) {
            skipped++;
            continue;
          }

          // Check if any prior reminder for this renewal cycle was completed
          const completedRes = await db.query(
            `SELECT id FROM reminders 
             WHERE customer_id = $1 AND product_id = $2 AND reminder_type = 'RENEWAL' 
               AND target_date = $3 AND status = 'Completed'`,
            [med.customer_id, med.id, med.renewal_date]
          );

          if (completedRes.rows.length > 0) {
            skipped++;
            continue;
          }

          const reminderId = `rem_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          await db.query(
            `INSERT INTO reminders (id, customer_id, product_id, product_type, reminder_type, target_date, reminder_date, escalation_stage, idempotency_key, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              reminderId,
              med.customer_id,
              med.id,
              'MEDICAL_INSURANCE',
              'RENEWAL',
              med.renewal_date,
              todayIST,
              stage,
              idempotencyKey,
              daysUntil <= 0 ? 'Due' : 'Upcoming'
            ]
          );
          created++;
        }
      }
    }

    // 2. Evaluate Life Insurance (Renewals & Maturities: 10, 5, 2 days)
    const lifesRes = await db.query("SELECT * FROM life_insurances WHERE status = 'Active'");
    for (const life of lifesRes.rows) {
      // Renewals
      if (life.renewal_date) {
        const daysUntil = this.diffInDays(life.renewal_date, todayIST);
        for (const stage of [10, 5, 2]) {
          if (daysUntil === stage) {
            const idempotencyKey = `${life.customer_id}_${life.id}_RENEWAL_${life.renewal_date}_${stage}`;
            const existsRes = await db.query("SELECT id FROM reminders WHERE idempotency_key = $1", [idempotencyKey]);
            if (existsRes.rows.length > 0) {
              skipped++;
              continue;
            }

            const completedRes = await db.query(
              `SELECT id FROM reminders 
               WHERE customer_id = $1 AND product_id = $2 AND reminder_type = 'RENEWAL' 
                 AND target_date = $3 AND status = 'Completed'`,
              [life.customer_id, life.id, life.renewal_date]
            );
            if (completedRes.rows.length > 0) {
              skipped++;
              continue;
            }

            const reminderId = `rem_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            await db.query(
              `INSERT INTO reminders (id, customer_id, product_id, product_type, reminder_type, target_date, reminder_date, escalation_stage, idempotency_key, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [reminderId, life.customer_id, life.id, 'LIFE_INSURANCE', 'RENEWAL', life.renewal_date, todayIST, stage, 'Upcoming']
            );
            created++;
          }
        }
      }

      // Maturities
      if (life.maturity_date) {
        const daysUntil = this.diffInDays(life.maturity_date, todayIST);
        for (const stage of [10, 5, 2]) {
          if (daysUntil === stage) {
            const idempotencyKey = `${life.customer_id}_${life.id}_MATURITY_${life.maturity_date}_${stage}`;
            const existsRes = await db.query("SELECT id FROM reminders WHERE idempotency_key = $1", [idempotencyKey]);
            if (existsRes.rows.length > 0) {
              skipped++;
              continue;
            }

            const reminderId = `rem_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            await db.query(
              `INSERT INTO reminders (id, customer_id, product_id, product_type, reminder_type, target_date, reminder_date, escalation_stage, idempotency_key, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [reminderId, life.customer_id, life.id, 'LIFE_INSURANCE', 'MATURITY', life.maturity_date, todayIST, stage, 'Upcoming']
            );
            created++;
          }
        }
      }
    }

    // 3. Evaluate Monthly SIP Debits (10 days before debit date)
    const sipsRes = await db.query("SELECT * FROM sips WHERE status = 'Active'");
    for (const sip of sipsRes.rows) {
      const nextDebitDate = this.getNextSipDebitDate(sip.sip_debit_date, new Date());
      const daysUntil = this.diffInDays(nextDebitDate, todayIST);

      if (daysUntil === 10) {
        const idempotencyKey = `${sip.customer_id}_${sip.id}_SIP_DEBIT_${nextDebitDate}_10`;
        const existsRes = await db.query("SELECT id FROM reminders WHERE idempotency_key = $1", [idempotencyKey]);
        if (existsRes.rows.length > 0) {
          skipped++;
          continue;
        }

        const reminderId = `rem_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        await db.query(
          `INSERT INTO reminders (id, customer_id, product_id, product_type, reminder_type, target_date, reminder_date, escalation_stage, idempotency_key, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [reminderId, sip.customer_id, sip.id, 'SIP', 'SIP_DEBIT', nextDebitDate, todayIST, 10, 'Upcoming']
        );
        created++;
      }
    }

    // Update statuses for reminders where target_date is today or passed
    await db.query(
      `UPDATE reminders SET status = 'Due' 
       WHERE status = 'Upcoming' AND target_date <= $1`,
      [todayIST]
    );

    return { created, skipped };
  }
}
