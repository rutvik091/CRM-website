import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  User,
  AdminProfile,
  EmployeeProfile,
  RegistrationCode,
  Customer,
  SIP,
  MedicalInsurance,
  MedicalFamilyMember,
  LifeInsurance,
  Reminder,
  ReminderDelivery,
  CustomerDocument,
  CustomerNote,
  ActivityLog,
  BusinessSettings,
  Session,
  OtpRecord,
  PasswordResetToken,
  UserRole
} from './types';

// Data storage paths
const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUPS_DIR = path.resolve(DATA_DIR, 'backups');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_FILE = path.resolve(DATA_DIR, 'mim_db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export interface DatabaseSchema {
  users: User[];
  adminProfiles: AdminProfile[];
  employeeProfiles: EmployeeProfile[];
  registrationCodes: RegistrationCode[];
  customers: Customer[];
  sips: SIP[];
  medicalInsurances: MedicalInsurance[];
  medicalFamilyMembers: MedicalFamilyMember[];
  lifeInsurances: LifeInsurance[];
  reminders: Reminder[];
  reminderDeliveries: ReminderDelivery[];
  documents: CustomerDocument[];
  customerNotes: CustomerNote[];
  notes: CustomerNote[];
  activityLogs: ActivityLog[];
  businessSettings: BusinessSettings;
  settings: BusinessSettings;
  sessions: Session[];
  otpRecords: OtpRecord[];
  otps: OtpRecord[];
  passwordResetTokens: PasswordResetToken[];
}

// Masking Utilities for KYC & Financial Information
export function maskPan(pan: string): string {
  if (!pan) return 'XXXXX1234X';
  const clean = pan.trim().toUpperCase();
  if (clean.length === 10) {
    return `XXXXX${clean.slice(5)}`;
  }
  const lastFour = clean.length >= 4 ? clean.slice(-4) : '1234';
  return `XXXXX${lastFour}`;
}

export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar) return 'XXXX XXXX 1234';
  const digits = aadhaar.replace(/\D/g, '');
  const lastFour = digits.length >= 4 ? digits.slice(-4) : '1234';
  return `XXXX XXXX ${lastFour}`;
}

export function maskAccountNumber(acc: string): string {
  if (!acc) return '••••••••1234';
  const clean = acc.replace(/\s+/g, '');
  if (clean.length <= 4) return '••••' + clean;
  const lastFour = clean.slice(-4);
  return '••••••••' + lastFour;
}

export function sanitizeCustomerForRole(customer: Customer, role: UserRole): Customer {
  if (role === 'ADMIN') return customer;
  return {
    ...customer,
    pan: maskPan(customer.pan),
    aadhaar: maskAadhaar(customer.aadhaar),
    accountNumber: maskAccountNumber(customer.accountNumber)
  };
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    if (hash.includes(':')) {
      const [salt, key] = hash.split(':');
      const testKey = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      return key === testKey;
    }
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

class Database {
  private data: DatabaseSchema;
  private isSaving: boolean = false;

  constructor() {
    this.data = this.loadOrInitialize();
  }

  public async init(): Promise<void> {
    return Promise.resolve();
  }

  public async query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const normalized = sql.trim();
    const lower = normalized.toLowerCase();

    if (lower.startsWith('select ')) {
      const tableMatch = normalized.match(/from\s+([a-z_]+)/i);
      const tableName = tableMatch ? tableMatch[1].toLowerCase() : '';
      let rows = (this.data as any)[tableName] || [];

      if (lower.includes('where')) {
        const whereClause = normalized.replace(/^.*?where\s+/i, '');
        const conditions = whereClause.split(/\s+and\s+/i);
        rows = rows.filter((row: Record<string, any>) => {
          return conditions.every((condition) => {
            const match = condition.match(/([a-z_]+)\s*=\s*\$?(\d+)?/i);
            if (!match) return true;
            const key = match[1].toLowerCase();
            const value = params[Number(match[2] || 0) - 1] ?? params[0];
            return String(row[key] ?? row[key.replace(/_/g, '')]) === String(value);
          });
        });
      }

      if (lower.includes('order by')) {
        const orderMatch = normalized.match(/order by\s+([a-z_]+)/i);
        const orderKey = orderMatch ? orderMatch[1].toLowerCase() : 'id';
        rows = [...rows].sort((a: any, b: any) => String(a[orderKey] ?? '').localeCompare(String(b[orderKey] ?? '')));
      }

      const limitMatch = normalized.match(/limit\s+(\d+)/i);
      if (limitMatch) {
        const limit = Number(limitMatch[1]);
        rows = rows.slice(0, limit);
      }

      return { rows, rowCount: rows.length };
    }

    if (lower.startsWith('insert into')) {
      const tableMatch = normalized.match(/into\s+([a-z_]+)/i);
      const table = tableMatch ? tableMatch[1].toLowerCase() : '';
      const columnsMatch = normalized.match(/\(([^)]+)\)/g);
      const columns = columnsMatch && columnsMatch[1]
        ? columnsMatch[1].split(',').map(c => c.trim().replace(/['"]/g, '').replace(/`/g, ''))
        : [];
      const valuesMatch = normalized.match(/values\s*\(([^)]*)\)/i);
      const inputValues = valuesMatch ? valuesMatch[1].split(',').map(v => v.trim()) : [];
      const row: Record<string, any> = {};
      columns.forEach((column, idx) => {
        const raw = inputValues[idx];
        let value: any = raw;
        if (raw && raw.startsWith('$')) {
          const index = Number(raw.replace(/\D/g, '')) - 1;
          value = params[index];
        }
        row[column] = value;
      });
      if (table && Array.isArray((this.data as any)[table])) {
        (this.data as any)[table].push(row);
        this.save();
      }
      return { rows: [row], rowCount: 1 };
    }

    if (lower.startsWith('update ')) {
      const tableMatch = normalized.match(/update\s+([a-z_]+)/i);
      const table = tableMatch ? tableMatch[1].toLowerCase() : '';
      const setMatch = normalized.match(/set\s+(.+?)\s+where/i);
      const whereMatch = normalized.match(/where\s+(.+)$/i);
      const rows = (this.data as any)[table] || [];
      const items = setMatch ? setMatch[1] : '';
      const assignments = items.split(',').map(item => item.trim());

      for (const row of rows) {
        if (whereMatch && !this.matchesCondition(row, whereMatch[1], params)) continue;
        for (const assignment of assignments) {
          const fieldMatch = assignment.match(/([a-z_]+)\s*=\s*(\$?\d+|'.*?'|".*?"|\w+)/i);
          if (!fieldMatch) continue;
          const field = fieldMatch[1];
          const valueRaw = fieldMatch[2];
          let value: any = valueRaw;
          if (valueRaw.startsWith('$')) {
            const index = Number(valueRaw.replace(/\D/g, '')) - 1;
            value = params[index];
          }
          row[field] = value;
        }
      }
      this.save();
      return { rows, rowCount: rows.length };
    }

    if (lower.startsWith('delete from')) {
      const tableMatch = normalized.match(/from\s+([a-z_]+)/i);
      const table = tableMatch ? tableMatch[1].toLowerCase() : '';
      const whereMatch = normalized.match(/where\s+(.+)$/i);
      const rows = (this.data as any)[table] || [];
      const filtered = whereMatch ? rows.filter((row: any) => !this.matchesCondition(row, whereMatch[1], params)) : [];
      (this.data as any)[table] = filtered;
      this.save();
      return { rows: filtered, rowCount: filtered.length };
    }

    return { rows: [], rowCount: 0 };
  }

  private matchesCondition(row: Record<string, any>, clause: string, params: any[]): boolean {
    const eqMatch = clause.match(/([a-z_]+)\s*=\s*\$?(\d+)/i);
    if (eqMatch) {
      const key = eqMatch[1];
      const idx = Number(eqMatch[2]) - 1;
      return String(row[key] ?? row[key.replace(/_/g, '')]) === String(params[idx]);
    }
    return true;
  }

  private loadOrInitialize(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return this.normalizeSchema(parsed);
      } catch (err) {
        console.error('[DB] Error loading DB file, creating backup and re-initializing:', err);
      }
    }
    return this.createInitialSchema();
  }

  private normalizeSchema(schema: any): DatabaseSchema {
    const initial = this.createInitialSchema();
    const normalized: DatabaseSchema = {
      users: schema.users || initial.users,
      adminProfiles: schema.adminProfiles || initial.adminProfiles,
      employeeProfiles: schema.employeeProfiles || initial.employeeProfiles,
      registrationCodes: schema.registrationCodes || initial.registrationCodes,
      customers: schema.customers || initial.customers,
      sips: schema.sips || initial.sips,
      medicalInsurances: schema.medicalInsurances || initial.medicalInsurances,
      medicalFamilyMembers: schema.medicalFamilyMembers || [],
      lifeInsurances: schema.lifeInsurances || initial.lifeInsurances,
      reminders: schema.reminders || initial.reminders,
      reminderDeliveries: schema.reminderDeliveries || initial.reminderDeliveries,
      documents: schema.documents || initial.documents,
      customerNotes: schema.customerNotes || schema.notes || initial.customerNotes,
      notes: schema.customerNotes || schema.notes || initial.customerNotes,
      activityLogs: schema.activityLogs || initial.activityLogs,
      businessSettings: schema.businessSettings || schema.settings || initial.businessSettings,
      settings: schema.businessSettings || schema.settings || initial.businessSettings,
      sessions: schema.sessions || [],
      otpRecords: schema.otpRecords || schema.otps || [],
      otps: schema.otpRecords || schema.otps || [],
      passwordResetTokens: schema.passwordResetTokens || []
    };

    // Keep aliases synced by reference
    normalized.notes = normalized.customerNotes;
    normalized.settings = normalized.businessSettings;
    normalized.otps = normalized.otpRecords;

    return normalized;
  }

  private createInitialSchema(): DatabaseSchema {
    const adminSalt = crypto.randomBytes(16).toString('hex');
    const adminHash = crypto.pbkdf2Sync('Admin@1234', adminSalt, 10000, 64, 'sha512').toString('hex');

    const empSalt = crypto.randomBytes(16).toString('hex');
    const empHash = crypto.pbkdf2Sync('Employee@1234', empSalt, 10000, 64, 'sha512').toString('hex');

    const businessSettings: BusinessSettings = {
      businessName: 'My Investment Manager',
      businessContactNumber: '+91 98765 43210',
      businessEmail: 'contact@myinvestmentmanager.com',
      whatsappNumber: '+91 98765 43210',
      senderName: 'MIM Wealth & Advisory',
      timezone: 'Asia/Kolkata',
      reminderTime: '10:00',
      smsProvider: {
        providerName: 'Fast2SMS Gateway',
        apiKey: '',
        senderId: 'MIMINV',
        enabled: false
      },
      whatsappProvider: {
        providerName: 'WhatsApp Cloud API',
        apiKey: '',
        phoneNumberId: '',
        enabled: false
      },
      backupFrequency: 'Daily'
    };

    const notesList: CustomerNote[] = [];
    const otpList: OtpRecord[] = [];

    return {
      users: [
        {
          id: 'usr_admin_001',
          email: 'admin@myinvestmentmanager.com',
          passwordHash: `${adminSalt}:${adminHash}`,
          fullName: 'Vikramaditya Sharma',
          mobile: '9876543210',
          role: 'ADMIN',
          status: 'ACTIVE',
          profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'usr_emp_001',
          email: 'priya.sharma@myinvestmentmanager.com',
          passwordHash: `${empSalt}:${empHash}`,
          fullName: 'Priya Sharma',
          mobile: '9823456781',
          role: 'EMPLOYEE',
          status: 'ACTIVE',
          profilePhoto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      adminProfiles: [
        { userId: 'usr_admin_001' }
      ],
      employeeProfiles: [
        {
          id: 'ep_usr_emp_001',
          userId: 'usr_emp_001',
          employeeId: 'EMP-001',
          joiningDate: '2026-01-15',
          designation: 'Senior Wealth Consultant'
        }
      ],
      registrationCodes: [
        {
          id: 'reg_init_001',
          code: 'REG-9876',
          isUsed: false,
          createdAt: new Date().toISOString(),
          createdByAdminId: 'usr_admin_001'
        }
      ],
      customers: [],
      sips: [],
      medicalInsurances: [],
      medicalFamilyMembers: [],
      lifeInsurances: [],
      reminders: [],
      reminderDeliveries: [],
      documents: [],
      customerNotes: notesList,
      notes: notesList,
      activityLogs: [],
      businessSettings,
      settings: businessSettings,
      sessions: [],
      otpRecords: otpList,
      otps: otpList,
      passwordResetTokens: []
    };
  }

  public get schema(): DatabaseSchema {
    return this.data;
  }

  public save(): void {
    if (this.isSaving) return;
    this.isSaving = true;
    try {
      // Keep aliases in sync before serialization
      this.data.customerNotes = this.data.notes || this.data.customerNotes;
      this.data.notes = this.data.customerNotes;
      this.data.businessSettings = this.data.settings || this.data.businessSettings;
      this.data.settings = this.data.businessSettings;
      this.data.otpRecords = this.data.otps || this.data.otpRecords;
      this.data.otps = this.data.otpRecords;

      const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('[DB] Failed saving database:', err);
    } finally {
      this.isSaving = false;
    }
  }

  public hasAdmin(): boolean {
    return this.data.users.some(u => u.role === 'ADMIN');
  }

  public nextCustomerId(): string {
    const customers = this.data.customers;
    if (customers.length === 0) return 'MIM-0001';

    let maxNum = 0;
    for (const c of customers) {
      const match = c.customerId.match(/MIM-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const nextNum = maxNum + 1;
    return `MIM-${String(nextNum).padStart(4, '0')}`;
  }

  public nextEmployeeId(): string {
    const emps = this.data.employeeProfiles;
    if (emps.length === 0) return 'EMP-001';

    let maxNum = 0;
    for (const e of emps) {
      const match = e.employeeId.match(/EMP-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const nextNum = maxNum + 1;
    return `EMP-${String(nextNum).padStart(3, '0')}`;
  }

  public getActiveRegistrationCode(): RegistrationCode | undefined {
    return this.data.registrationCodes.find(c => !c.isUsed);
  }

  public generateRegistrationCode(adminId: string): RegistrationCode {
    // Invalidate previously active codes
    for (const code of this.data.registrationCodes) {
      if (!code.isUsed) {
        code.isUsed = true;
      }
    }

    const code = 'REG-' + Math.floor(1000 + Math.random() * 9000);
    const newCode: RegistrationCode = {
      id: 'reg_' + Date.now(),
      code,
      isUsed: false,
      createdAt: new Date().toISOString(),
      createdByAdminId: adminId
    };

    this.data.registrationCodes.push(newCode);
    this.save();
    return newCode;
  }

  public logActivity(
    userId: string,
    userName: string,
    userRole: UserRole,
    action: string,
    entity: string,
    entityId: string,
    details?: string
  ): void {
    // Customer reassignment is NEVER logged per specification
    if (action === 'REASSIGNED_CUSTOMER' || action === 'REASSIGN_CUSTOMER') return;

    const log: ActivityLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userId,
      userName,
      userRole,
      action,
      entity,
      entityType: entity,
      entityId,
      details,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    this.data.activityLogs.unshift(log);

    // 1-year retention policy: discard logs older than 365 days
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    this.data.activityLogs = this.data.activityLogs.filter(
      l => new Date(l.timestamp).getTime() >= oneYearAgo
    );

    this.save();
  }

  public createBackup(tag: string = 'manual'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mim_backup_${tag}_${timestamp}.json`;
    const dest = path.resolve(BACKUPS_DIR, filename);

    fs.writeFileSync(dest, JSON.stringify(this.data, null, 2), 'utf-8');
    this.data.businessSettings.lastBackupAt = new Date().toISOString();
    this.save();
    return filename;
  }

  public async createBackupSnapshot(tag: string = 'manual'): Promise<string> {
    return this.createBackup(tag);
  }

  public restoreBackup(filename: string): boolean {
    const source = path.resolve(BACKUPS_DIR, filename);
    if (!fs.existsSync(source)) return false;

    try {
      const raw = fs.readFileSync(source, 'utf-8');
      const parsed = JSON.parse(raw);
      this.data = this.normalizeSchema(parsed);
      this.save();
      return true;
    } catch (err) {
      console.error('[DB] Restore error:', err);
      return false;
    }
  }

  public listBackups(): { filename: string; size: number; createdAt: string }[] {
    if (!fs.existsSync(BACKUPS_DIR)) return [];
    return fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const full = path.resolve(BACKUPS_DIR, f);
        const stat = fs.statSync(full);
        return {
          filename: f,
          size: stat.size,
          createdAt: stat.mtime.toISOString()
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export const db = new Database();
