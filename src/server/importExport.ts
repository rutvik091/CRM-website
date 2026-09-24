import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { db } from './db';
import { Customer, Gender, AccountType } from './types';

export interface CustomerExportFilter {
  productType?: 'ALL' | 'SIP' | 'MEDICAL_INSURANCE' | 'LIFE_INSURANCE';
  employeeId?: string;
  status?: string;
  customerIds?: string[];
}

export class ImportExportService {
  /**
   * Generates Excel workbook buffer or CSV string from real PostgreSQL data
   * NOTE: Admin only; export contains full unmasked details for business compliance
   */
  public static async exportCustomers(filter: CustomerExportFilter, format: 'xlsx' | 'csv'): Promise<Buffer> {
    let sql = `SELECT * FROM customers WHERE is_deleted = FALSE`;
    const params: any[] = [];

    if (filter.employeeId && filter.employeeId !== 'ALL') {
      params.push(filter.employeeId);
      sql += ` AND assigned_employee_id = $${params.length}`;
    }

    if (filter.status && filter.status !== 'ALL') {
      params.push(filter.status);
      sql += ` AND status = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC`;

    const res = await db.query(sql, params);
    let customers = res.rows;

    // Filter by product type if requested
    if (filter.productType && filter.productType !== 'ALL') {
      if (filter.productType === 'SIP') {
        const sipsRes = await db.query(`SELECT DISTINCT customer_id FROM sips WHERE status = 'Active'`);
        const set = new Set(sipsRes.rows.map(r => r.customer_id));
        customers = customers.filter(c => set.has(c.id));
      } else if (filter.productType === 'MEDICAL_INSURANCE') {
        const medsRes = await db.query(`SELECT DISTINCT customer_id FROM medical_insurances WHERE status = 'Active'`);
        const set = new Set(medsRes.rows.map(r => r.customer_id));
        customers = customers.filter(c => set.has(c.id));
      } else if (filter.productType === 'LIFE_INSURANCE') {
        const lifesRes = await db.query(`SELECT DISTINCT customer_id FROM life_insurances WHERE status = 'Active'`);
        const set = new Set(lifesRes.rows.map(r => r.customer_id));
        customers = customers.filter(c => set.has(c.id));
      }
    }

    const empRes = await db.query(`SELECT id, full_name FROM users WHERE role = 'EMPLOYEE'`);
    const empMap = new Map(empRes.rows.map(e => [e.id, e.full_name]));

    const rows = customers.map(c => {
      const empName = empMap.get(c.assigned_employee_id) || 'Unassigned';
      return {
        'Customer ID': c.customer_id,
        'Full Name': c.full_name,
        'Mobile Number': c.mobile,
        'Email Address': c.email || '',
        'Date of Birth': c.dob,
        'Gender': c.gender,
        'City': c.city,
        'State': c.state,
        'Pincode': c.pincode,
        'PAN': c.pan,
        'Aadhaar': c.aadhaar,
        'Bank Name': c.bank_name,
        'Account Number': c.account_number,
        'IFSC Code': c.ifsc_code,
        'Account Type': c.account_type,
        'Status': c.status,
        'Assigned Employee': empName,
        'Registered Date': new Date(c.created_at).toLocaleDateString('en-IN')
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

    if (format === 'csv') {
      const csvStr = XLSX.utils.sheet_to_csv(worksheet);
      return Buffer.from(csvStr, 'utf-8');
    }

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Generates a sample CSV/Excel import template
   */
  public static generateTemplate(format: 'xlsx' | 'csv'): Buffer {
    const sample = [
      {
        'Full Name': 'Suresh Kumar',
        'Mobile Number': '9876543210',
        'Email Address': 'suresh.kumar@example.com',
        'Date of Birth': '1985-05-15',
        'Gender': 'Male',
        'City': 'Mumbai',
        'State': 'Maharashtra',
        'Pincode': '400001',
        'PAN': 'ABCDE1234F',
        'Aadhaar': '123456789012',
        'Bank Name': 'HDFC Bank',
        'Account Number': '50100234567890',
        'IFSC Code': 'HDFC0000001',
        'Assigned Employee': 'Priya Sharma'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    if (format === 'csv') {
      return Buffer.from(XLSX.utils.sheet_to_csv(ws), 'utf-8');
    }
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Parses uploaded Excel/CSV file and evaluates rows and duplicates against PostgreSQL
   */
  public static async previewImport(fileBuffer: Buffer): Promise<{
    totalRows: number;
    validRows: any[];
    invalidRows: { rowNumber: number; data: any; errors: string[] }[];
    duplicatesCount: number;
  }> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    const validRows: any[] = [];
    const invalidRows: { rowNumber: number; data: any; errors: string[] }[] = [];
    let duplicatesCount = 0;

    const existingMobilesRes = await db.query(`SELECT mobile FROM customers WHERE is_deleted = FALSE`);
    const existingMobiles = new Set(existingMobilesRes.rows.map(r => r.mobile.replace(/\D/g, '').slice(-10)));

    rawData.forEach((row, idx) => {
      const rowNum = idx + 2;
      const errors: string[] = [];

      const fullName = (row['Full Name'] || row['Name'] || row['fullName'] || '').toString().trim();
      const rawMobile = (row['Mobile Number'] || row['Mobile'] || row['mobile'] || '').toString().trim();
      const email = (row['Email Address'] || row['Email'] || row['email'] || '').toString().trim();
      const dob = (row['Date of Birth'] || row['DOB'] || row['dob'] || '1990-01-01').toString().trim();
      const gender = (row['Gender'] || row['gender'] || 'Male').toString().trim();
      const city = (row['City'] || row['city'] || 'Mumbai').toString().trim();
      const state = (row['State'] || row['state'] || 'Maharashtra').toString().trim();
      const pincode = (row['Pincode'] || row['pincode'] || '400001').toString().trim();
      const pan = (row['PAN'] || row['pan'] || '').toString().trim().toUpperCase();
      const aadhaar = (row['Aadhaar'] || row['aadhaar'] || '').toString().trim();
      const bankName = (row['Bank Name'] || row['bankName'] || 'HDFC Bank').toString().trim();
      const accountNumber = (row['Account Number'] || row['accountNumber'] || '').toString().trim();
      const ifscCode = (row['IFSC Code'] || row['ifscCode'] || 'HDFC0000001').toString().trim().toUpperCase();
      const assignedEmployee = (row['Assigned Employee'] || row['Employee'] || '').toString().trim();

      if (!fullName) errors.push('Full Name is required');
      const cleanMobile = rawMobile.replace(/\D/g, '').slice(-10);
      if (!cleanMobile || cleanMobile.length < 10) {
        errors.push('Valid 10-digit mobile number is required');
      }
      if (email && !email.includes('@')) {
        errors.push('Invalid email format');
      }

      const isDuplicate = existingMobiles.has(cleanMobile);
      if (isDuplicate) duplicatesCount++;

      const parsedRow = {
        rowNumber: rowNum,
        fullName,
        mobile: cleanMobile,
        email,
        dob,
        gender: (['Male', 'Female', 'Other'].includes(gender) ? gender : 'Male') as Gender,
        city,
        state,
        pincode,
        pan: pan || 'ABCDE1234F',
        aadhaar: aadhaar || '123456789012',
        bankName,
        accountHolderName: fullName,
        accountNumber: accountNumber || '1234567890',
        ifscCode,
        accountType: 'Savings' as AccountType,
        assignedEmployee,
        isDuplicate
      };

      if (errors.length > 0) {
        invalidRows.push({ rowNumber: rowNum, data: row, errors });
      } else {
        validRows.push(parsedRow);
      }
    });

    return {
      totalRows: rawData.length,
      validRows,
      invalidRows,
      duplicatesCount
    };
  }

  /**
   * Commits validated import with chosen duplicate strategy into PostgreSQL
   */
  public static async commitImport(
    rows: any[],
    duplicateStrategy: 'skip' | 'update' | 'create_new',
    adminUserId: string,
    defaultEmployeeId?: string
  ): Promise<{ imported: number; updated: number; skipped: number }> {
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    const empRes = await db.query(`SELECT id, full_name FROM users WHERE role = 'EMPLOYEE' AND status = 'ACTIVE'`);
    const employees = empRes.rows;
    const fallbackEmpId = defaultEmployeeId || employees[0]?.id || adminUserId;

    for (const r of rows) {
      const cleanMobile = r.mobile.replace(/\D/g, '').slice(-10);
      const existingRes = await db.query(`SELECT * FROM customers WHERE mobile = $1 AND is_deleted = FALSE`, [cleanMobile]);
      const existing = existingRes.rows[0];

      if (existing) {
        if (duplicateStrategy === 'skip') {
          skipped++;
          continue;
        } else if (duplicateStrategy === 'update') {
          await db.query(
            `UPDATE customers SET 
               full_name = COALESCE($1, full_name),
               email = COALESCE($2, email),
               city = COALESCE($3, city),
               state = COALESCE($4, state),
               pincode = COALESCE($5, pincode),
               bank_name = COALESCE($6, bank_name),
               updated_at = NOW()
             WHERE id = $7`,
            [r.fullName || null, r.email || null, r.city || null, r.state || null, r.pincode || null, r.bankName || null, existing.id]
          );
          updated++;
          continue;
        }
      }

      let empId = fallbackEmpId;
      if (r.assignedEmployee) {
        const matched = employees.find(e => e.full_name.toLowerCase().includes(r.assignedEmployee.toLowerCase()));
        if (matched) empId = matched.id;
      }

      const newId = `cust_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const customerId = await db.nextCustomerId();

      await db.query(
        `INSERT INTO customers (
          id, customer_id, full_name, profile_photo, dob, gender, mobile, email,
          address, city, state, pincode, pan, aadhaar, bank_name, account_holder_name,
          account_number, ifsc_code, account_type, status, assigned_employee_id, is_deleted
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, FALSE
        )`,
        [
          newId,
          customerId,
          r.fullName,
          null,
          r.dob || '1990-01-01',
          r.gender || 'Male',
          cleanMobile,
          r.email || '',
          r.address || `${r.city || 'City'}, ${r.state || 'State'}`,
          r.city || 'Mumbai',
          r.state || 'Maharashtra',
          r.pincode || '400001',
          r.pan || 'ABCDE1234F',
          r.aadhaar || '123456789012',
          r.bankName || 'HDFC Bank',
          r.fullName,
          r.accountNumber || '1234567890',
          r.ifscCode || 'HDFC0000001',
          r.accountType || 'Savings',
          'Active',
          empId
        ]
      );
      imported++;
    }

    return { imported, updated, skipped };
  }
}
