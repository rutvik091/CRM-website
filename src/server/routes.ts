import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import {
  db,
  hashPassword,
  verifyPassword,
  sanitizeCustomerForRole,
  maskPan,
  maskAadhaar,
  maskAccountNumber
} from './db';
import { OTPService } from './otpProvider';
import { ReminderEngine } from './reminderEngine';
import { MessagingService } from './messagingProviders';
import { DocumentStorageService } from './documentStorage';
import { ImportExportService } from './importExport';
import { ReportsService } from './reports';
import { AppTestSuite } from './tests';
import { User, UserRole } from './types';

export const apiRouter = express.Router();

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionToken?: string;
}

/* ==========================================================================
   AUTHENTICATION & AUTHORIZATION MIDDLEWARE
   ========================================================================== */

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check HTTP-only cookie first, then Authorization header
  let token = req.cookies?.mim_session;
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }

  try {
    const sessionRes = await db.query(
      `SELECT s.*, u.email, u.full_name, u.mobile, u.role, u.status, u.profile_photo
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );

    if (sessionRes.rows.length === 0) {
      res.clearCookie('mim_session');
      return res.status(401).json({ error: 'Session invalid or expired. Please login again.' });
    }

    const row = sessionRes.rows[0];

    // Check account active status
    if (row.status === 'INACTIVE') {
      res.clearCookie('mim_session');
      return res.status(403).json({ error: 'Your account is deactivated. Please contact Administrator.' });
    }

    req.user = {
      id: row.user_id,
      email: row.email,
      fullName: row.full_name,
      mobile: row.mobile,
      role: row.role as UserRole,
      status: row.status,
      passwordHash: '',
      profilePhoto: row.profile_photo,
      createdAt: row.created_at,
      updatedAt: row.created_at
    };
    req.sessionToken = token;

    next();
  } catch (err: any) {
    console.error('Auth verification error:', err);
    return res.status(500).json({ error: 'Authentication service error' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
  }
  next();
}

/**
 * Checks if user has permission to access a customer record
 */
export function canAccessCustomer(user: User, customer: { assigned_employee_id: string }): boolean {
  if (user.role === 'ADMIN') return true;
  return customer.assigned_employee_id === user.id;
}

/* ==========================================================================
   1. AUTHENTICATION & SETUP ROUTES
   ========================================================================== */

// Check if system has an Admin account setup
apiRouter.get('/auth/first-time-check', async (_req: Request, res: Response) => {
  try {
    const adminExists = await db.hasAdmin();
    return res.json({ adminExists });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Step 1 of Admin Setup: Request mobile OTP
apiRouter.post('/auth/admin-setup-otp', async (req: Request, res: Response) => {
  try {
    const { mobile } = req.body;
    if (!mobile || mobile.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ error: 'Valid 10-digit mobile number required' });
    }

    const adminExists = await db.hasAdmin();
    if (adminExists) {
      return res.status(400).json({ error: 'Admin account already exists.' });
    }

    const result = await OTPService.requestOTP(mobile, 'ADMIN_SETUP');
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Step 2 of Admin Setup: Verify OTP and create Admin account
apiRouter.post('/auth/admin-setup-verify', async (req: Request, res: Response) => {
  try {
    const { mobile, otp, fullName, email, password } = req.body;
    if (!mobile || !otp || !fullName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const adminExists = await db.hasAdmin();
    if (adminExists) {
      return res.status(400).json({ error: 'Admin account already exists.' });
    }

    const otpCheck = await OTPService.verifyOTP(mobile, otp, 'ADMIN_SETUP');
    if (!otpCheck.valid) {
      return res.status(400).json({ error: otpCheck.message || 'Invalid or expired OTP' });
    }

    const adminId = `usr_admin_${Date.now()}`;
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
    const pwdHash = hashPassword(password);

    await db.query(
      `INSERT INTO users (id, email, password_hash, full_name, mobile, role, status)
       VALUES ($1, $2, $3, $4, $5, 'ADMIN', 'ACTIVE')`,
      [adminId, cleanEmail, pwdHash, fullName.trim(), cleanMobile]
    );

    // Automatically generate initial employee registration code
    await db.generateRegistrationCode(adminId);

    // Issue session token and set HTTP-only cookie
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.query(
      `INSERT INTO sessions (id, token, user_id, role, expires_at)
       VALUES ($1, $2, $3, 'ADMIN', $4)`,
      [`sess_${Date.now()}`, token, adminId, expiresAt]
    );

    res.cookie('mim_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    await db.logActivity(adminId, fullName.trim(), 'ADMIN', 'ADMIN_INITIALIZED', 'User', adminId, 'Primary Admin initialized the system.');

    return res.json({
      success: true,
      token,
      user: {
        id: adminId,
        email: cleanEmail,
        fullName: fullName.trim(),
        mobile: cleanMobile,
        role: 'ADMIN'
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Login Step 1: Email + Password -> generates Mobile OTP (Required on EVERY login)
apiRouter.post('/auth/login-request-otp', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userRes = await db.query(
      `SELECT * FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userRes.rows[0];
    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'INACTIVE') {
      return res.status(403).json({ error: 'Account is deactivated. Please contact Administrator.' });
    }

    // Request mobile OTP
    const otpResult = await OTPService.requestOTP(user.mobile, 'LOGIN');
    if (!otpResult.success) {
      return res.status(400).json({ error: otpResult.message });
    }

    return res.json({
      success: true,
      maskedMobile: `${user.mobile.slice(0, 2)}******${user.mobile.slice(-2)}`,
      mobile: user.mobile,
      debugOtp: otpResult.debugOtp
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Login Step 2: Verify OTP -> Complete Login & Set HTTP-Only Cookie
apiRouter.post('/auth/login-verify-otp', async (req: Request, res: Response) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) {
      return res.status(400).json({ error: 'Mobile number and OTP are required' });
    }

    const otpCheck = await OTPService.verifyOTP(mobile, otp, 'LOGIN');
    if (!otpCheck.valid) {
      return res.status(400).json({ error: otpCheck.message || 'Invalid or expired OTP' });
    }

    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
    const userRes = await db.query(`SELECT * FROM users WHERE mobile = $1`, [cleanMobile]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const user = userRes.rows[0];
    if (user.status === 'INACTIVE') {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.query(
      `INSERT INTO sessions (id, token, user_id, role, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [`sess_${Date.now()}`, token, user.id, user.role, expiresAt]
    );

    res.cookie('mim_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    await db.logActivity(user.id, user.full_name, user.role, 'USER_LOGIN', 'User', user.id, `${user.full_name} logged in via 2FA OTP`);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        mobile: user.mobile,
        role: user.role,
        profilePhoto: user.profile_photo
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Employee Registration with Single-Use Registration Code
apiRouter.post('/auth/employee-register', async (req: Request, res: Response) => {
  try {
    const { registrationCode, fullName, email, mobile, password, designation } = req.body;
    if (!registrationCode || !fullName || !email || !mobile || !password) {
      return res.status(400).json({ error: 'All fields including valid registration code are required' });
    }

    // Verify registration code against PostgreSQL
    const codeRes = await db.query(
      `SELECT * FROM registration_codes WHERE code = $1 AND is_used = FALSE`,
      [registrationCode.trim().toUpperCase()]
    );

    if (codeRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or already used registration code. Please contact Admin for a new code.' });
    }

    const codeRecord = codeRes.rows[0];
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);

    // Check duplicate email or mobile
    const dupRes = await db.query(
      `SELECT id FROM users WHERE email = $1 OR mobile = $2`,
      [cleanEmail, cleanMobile]
    );
    if (dupRes.rows.length > 0) {
      return res.status(400).json({ error: 'Email or Mobile number is already registered' });
    }

    const userId = `usr_emp_${Date.now()}`;
    const employeeId = await db.nextEmployeeId();
    const pwdHash = hashPassword(password);

    // Insert user
    await db.query(
      `INSERT INTO users (id, email, password_hash, full_name, mobile, role, status)
       VALUES ($1, $2, $3, $4, $5, 'EMPLOYEE', 'ACTIVE')`,
      [userId, cleanEmail, pwdHash, fullName.trim(), cleanMobile]
    );

    // Insert employee profile
    await db.query(
      `INSERT INTO employee_profiles (id, user_id, employee_id, joining_date, designation)
       VALUES ($1, $2, $3, $4, $5)`,
      [`ep_${Date.now()}`, userId, employeeId, new Date().toISOString().slice(0, 10), designation || 'Wealth & Investment Consultant']
    );

    // Mark registration code as used
    await db.query(
      `UPDATE registration_codes SET is_used = TRUE, used_by_employee_id = $1, used_at = NOW() WHERE id = $2`,
      [userId, codeRecord.id]
    );

    // Automatically generate a new registration code for future employees
    await db.generateRegistrationCode(codeRecord.created_by_admin_id);

    // Issue session token and set HTTP-only cookie
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.query(
      `INSERT INTO sessions (id, token, user_id, role, expires_at)
       VALUES ($1, $2, $3, 'EMPLOYEE', $4)`,
      [`sess_${Date.now()}`, token, userId, expiresAt]
    );

    res.cookie('mim_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    await db.logActivity(userId, fullName.trim(), 'EMPLOYEE', 'EMPLOYEE_REGISTERED', 'User', userId, `New employee ${fullName.trim()} registered with ID ${employeeId}`);

    return res.json({
      success: true,
      token,
      user: {
        id: userId,
        employeeId,
        email: cleanEmail,
        fullName: fullName.trim(),
        mobile: cleanMobile,
        role: 'EMPLOYEE'
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Logout: clears cookie and invalidates session in PostgreSQL
apiRouter.post('/auth/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.sessionToken) {
      await db.query(`DELETE FROM sessions WHERE token = $1`, [req.sessionToken]);
    }
    res.clearCookie('mim_session');
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get Current User Profile (/auth/me)
apiRouter.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    let profile: any = null;

    if (user.role === 'EMPLOYEE') {
      const pRes = await db.query(`SELECT * FROM employee_profiles WHERE user_id = $1`, [user.id]);
      if (pRes.rows.length > 0) {
        profile = {
          employeeId: pRes.rows[0].employee_id,
          designation: pRes.rows[0].designation,
          joiningDate: pRes.rows[0].joining_date
        };
      }
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        mobile: user.mobile,
        role: user.role,
        profilePhoto: user.profilePhoto,
        ...profile
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   2. EMPLOYEE & REGISTRATION CODE MANAGEMENT (Admin Only)
   ========================================================================== */

// List All Employees with customer count
apiRouter.get('/employees', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const empRes = await db.query(`
      SELECT u.id, u.email, u.full_name, u.mobile, u.status, u.created_at,
             ep.employee_id, ep.designation, ep.joining_date,
             COUNT(c.id) as assigned_customers_count
      FROM users u
      LEFT JOIN employee_profiles ep ON u.id = ep.user_id
      LEFT JOIN customers c ON u.id = c.assigned_employee_id AND c.is_deleted = FALSE
      WHERE u.role = 'EMPLOYEE'
      GROUP BY u.id, ep.employee_id, ep.designation, ep.joining_date
      ORDER BY u.created_at ASC
    `);

    const employees = empRes.rows.map(r => ({
      id: r.id,
      employeeId: r.employee_id || 'EMP-000',
      fullName: r.full_name,
      email: r.email,
      mobile: r.mobile,
      status: r.status,
      designation: r.designation || 'Wealth & Insurance Consultant',
      joiningDate: r.joining_date || r.created_at.slice(0, 10),
      assignedCustomersCount: parseInt(r.assigned_customers_count || '0', 10)
    }));

    return res.json({ employees });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get Active Registration Code
apiRouter.get('/employees/registration-code', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const code = await db.getActiveRegistrationCode();
    return res.json({ registrationCode: code });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Generate New Registration Code (invalidates previous unused code)
apiRouter.post('/employees/registration-code/generate', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const code = await db.generateRegistrationCode(req.user!.id);
    await db.logActivity(req.user!.id, req.user!.fullName, 'ADMIN', 'GENERATED_REG_CODE', 'RegistrationCode', code.id, `Generated new employee registration code: ${code.code}`);
    return res.json({ success: true, registrationCode: code });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Toggle Employee Status (ACTIVE / INACTIVE)
apiRouter.post('/employees/:id/toggle-status', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRes = await db.query(`SELECT * FROM users WHERE id = $1 AND role = 'EMPLOYEE'`, [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const current = userRes.rows[0];
    const newStatus = current.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    await db.query(`UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);

    // If deactivated, invalidate all active sessions for this employee immediately
    if (newStatus === 'INACTIVE') {
      await db.query(`DELETE FROM sessions WHERE user_id = $1`, [id]);
    }

    await db.logActivity(req.user!.id, req.user!.fullName, 'ADMIN', 'EMPLOYEE_STATUS_CHANGED', 'User', id, `Changed employee ${current.full_name} status to ${newStatus}`);

    return res.json({ success: true, status: newStatus });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Reassign Customers from one employee to another (Admin only; NO activity log per spec)
apiRouter.post('/employees/reassign-customers', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { sourceEmployeeId, targetEmployeeId } = req.body;
    if (!sourceEmployeeId || !targetEmployeeId) {
      return res.status(400).json({ error: 'Source and target employee IDs are required' });
    }

    const updateRes = await db.query(
      `UPDATE customers SET assigned_employee_id = $1, updated_at = NOW()
       WHERE assigned_employee_id = $2 AND is_deleted = FALSE`,
      [targetEmployeeId, sourceEmployeeId]
    );

    // CRITICAL: Specification states: "Do NOT create an activity log for reassignment."
    return res.json({ success: true, reassignedCount: updateRes.rowCount || 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   3. CUSTOMER MANAGEMENT (Role-Based Scoping & KYC Masking)
   ========================================================================== */

// List Customers (Admin sees all; Employee sees ONLY assigned; Sensitive data masked for employee)
apiRouter.get('/customers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    let sql = `
      SELECT c.*, u.full_name as assigned_employee_name
      FROM customers c
      LEFT JOIN users u ON c.assigned_employee_id = u.id
      WHERE c.is_deleted = FALSE
    `;
    const params: any[] = [];

    // Employee isolation: scoped to assigned customers only
    if (user.role === 'EMPLOYEE') {
      params.push(user.id);
      sql += ` AND c.assigned_employee_id = $${params.length}`;
    }

    sql += ` ORDER BY c.created_at DESC`;

    const result = await db.query(sql, params);
    const customers = result.rows.map(r => {
      const custObj = {
        id: r.id,
        customerId: r.customer_id,
        fullName: r.full_name,
        profilePhoto: r.profile_photo,
        dob: r.dob,
        gender: r.gender,
        mobile: r.mobile,
        email: r.email,
        address: r.address,
        city: r.city,
        state: r.state,
        pincode: r.pincode,
        pan: r.pan,
        aadhaar: r.aadhaar,
        bankName: r.bank_name,
        accountHolderName: r.account_holder_name,
        accountNumber: r.account_number,
        ifscCode: r.ifsc_code,
        accountType: r.account_type,
        status: r.status,
        assignedEmployeeId: r.assigned_employee_id,
        assignedEmployeeName: r.assigned_employee_name || 'Unassigned',
        isDeleted: Boolean(r.is_deleted) || false,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
      return sanitizeCustomerForRole(custObj, user.role);
    });

    return res.json({ customers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get Single Customer with all portfolio products & documents
apiRouter.get('/customers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const custRes = await db.query(
      `SELECT c.*, u.full_name as assigned_employee_name
       FROM customers c
       LEFT JOIN users u ON c.assigned_employee_id = u.id
       WHERE (c.id = $1 OR c.customer_id = $1) AND c.is_deleted = FALSE`,
      [id]
    );

    if (custRes.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const c = custRes.rows[0];

    // Role-based access control: Employee can ONLY access assigned customer
    if (!canAccessCustomer(user, c)) {
      return res.status(403).json({ error: 'Access denied: You are not assigned to this customer.' });
    }

    // Fetch SIPs
    const sipsRes = await db.query(`SELECT * FROM sips WHERE customer_id = $1 ORDER BY created_at DESC`, [c.id]);
    const sips = sipsRes.rows.map(s => ({
      id: s.id,
      customerId: s.customer_id,
      amcName: s.amc_name,
      schemeName: s.scheme_name,
      folioNumber: s.folio_number,
      sipAmount: parseFloat(s.sip_amount),
      frequency: s.frequency,
      sipDebitDate: s.sip_debit_date,
      startDate: s.start_date,
      endDate: s.end_date,
      status: s.status,
      notes: s.notes
    }));

    // Fetch Medical Insurances & Family Members
    const medsRes = await db.query(`SELECT * FROM medical_insurances WHERE customer_id = $1 ORDER BY created_at DESC`, [c.id]);
    const medicalInsurances = [];
    for (const m of medsRes.rows) {
      const famRes = await db.query(`SELECT * FROM medical_family_members WHERE medical_insurance_id = $1`, [m.id]);
      medicalInsurances.push({
        id: m.id,
        customerId: m.customer_id,
        companyName: m.company_name,
        policyNumber: m.policy_number,
        policyType: m.policy_type,
        premiumAmount: parseFloat(m.premium_amount),
        coverAmount: parseFloat(m.cover_amount),
        startDate: m.start_date,
        renewalDate: m.renewal_date,
        status: m.status,
        notes: m.notes,
        familyMembers: famRes.rows.map(f => ({
          id: f.id,
          name: f.name,
          relation: f.relation,
          dob: f.dob,
          gender: f.gender,
          mobile: f.mobile,
          isCovered: f.is_covered
        }))
      });
    }

    // Fetch Life Insurances
    const lifesRes = await db.query(`SELECT * FROM life_insurances WHERE customer_id = $1 ORDER BY created_at DESC`, [c.id]);
    const lifeInsurances = lifesRes.rows.map(l => ({
      id: l.id,
      customerId: l.customer_id,
      companyName: l.company_name,
      policyNumber: l.policy_number,
      policyType: l.policy_type,
      premiumAmount: parseFloat(l.premium_amount),
      coverAmount: parseFloat(l.cover_amount),
      startDate: l.start_date,
      renewalDate: l.renewal_date,
      maturityDate: l.maturity_date,
      status: l.status,
      notes: l.notes
    }));

    // Fetch Reminders
    const remRes = await db.query(`SELECT * FROM reminders WHERE customer_id = $1 ORDER BY target_date ASC`, [c.id]);
    const reminders = remRes.rows.map(r => ({
      id: r.id,
      customerId: r.customer_id,
      productId: r.product_id,
      productType: r.product_type,
      reminderType: r.reminder_type,
      targetDate: r.target_date,
      reminderDate: r.reminder_date,
      escalationStage: r.escalation_stage,
      status: r.status,
      completedAt: r.completed_at,
      completedMethod: r.completed_method,
      completionNotes: r.completion_notes
    }));

    // Fetch Documents
    const docRes = await db.query(`SELECT * FROM documents WHERE customer_id = $1 ORDER BY created_at DESC`, [c.id]);
    const documents = docRes.rows.map(d => ({
      id: d.id,
      customerId: d.customer_id,
      title: d.title,
      category: d.category,
      fileName: d.file_name,
      fileType: d.file_type,
      fileSize: d.file_size,
      mimeType: d.mime_type,
      version: d.version,
      createdAt: d.created_at
    }));

    // Fetch Notes
    const notesRes = await db.query(`SELECT * FROM customer_notes WHERE customer_id = $1 ORDER BY created_at DESC`, [c.id]);
    const notes = notesRes.rows.map(n => ({
      id: n.id,
      customerId: n.customer_id,
      text: n.text,
      authorName: n.author_name,
      authorRole: n.author_role,
      createdAt: n.created_at
    }));

    const rawCustomer = {
      id: c.id,
      customerId: c.customer_id,
      fullName: c.full_name,
      profilePhoto: c.profile_photo,
      dob: c.dob,
      gender: c.gender,
      mobile: c.mobile,
      email: c.email,
      address: c.address,
      city: c.city,
      state: c.state,
      pincode: c.pincode,
      pan: c.pan,
      aadhaar: c.aadhaar,
      bankName: c.bank_name,
      accountHolderName: c.account_holder_name,
      accountNumber: c.account_number,
      ifscCode: c.ifsc_code,
      accountType: c.account_type,
      status: c.status,
      assignedEmployeeId: c.assigned_employee_id,
      assignedEmployeeName: c.assigned_employee_name || 'Unassigned',
      isDeleted: Boolean(c.is_deleted) || false,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    };

    return res.json({
      customer: sanitizeCustomerForRole(rawCustomer, user.role),
      sips,
      medicalInsurances,
      lifeInsurances,
      reminders,
      documents,
      notes
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create Customer (Admin or Employee; Assigns to employee or creator)
apiRouter.post('/customers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const body = req.body;

    if (!body.fullName || !body.mobile || !body.pan || !body.aadhaar) {
      return res.status(400).json({ error: 'Full Name, Mobile, PAN, and Aadhaar are required' });
    }

    const cleanMobile = body.mobile.replace(/\D/g, '').slice(-10);
    const existing = await db.query(`SELECT id FROM customers WHERE mobile = $1 AND is_deleted = FALSE`, [cleanMobile]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'A customer with this mobile number is already registered' });
    }

    const customerIdString = await db.nextCustomerId();
    const id = `cust_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;

    // Admin can specify assigned employee; Employee always assigns to themselves
    const assignedEmp = user.role === 'ADMIN' && body.assignedEmployeeId ? body.assignedEmployeeId : user.id;

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
        id,
        customerIdString,
        body.fullName.trim(),
        body.profilePhoto || null,
        body.dob || '1990-01-01',
        body.gender || 'Male',
        cleanMobile,
        body.email || '',
        body.address || '',
        body.city || 'Mumbai',
        body.state || 'Maharashtra',
        body.pincode || '400001',
        body.pan.trim().toUpperCase(),
        body.aadhaar.trim(),
        body.bankName || 'HDFC Bank',
        body.accountHolderName || body.fullName.trim(),
        body.accountNumber || '1234567890',
        body.ifscCode || 'HDFC0000001',
        body.accountType || 'Savings',
        'Active',
        assignedEmp
      ]
    );

    await db.logActivity(user.id, user.fullName, user.role, 'CREATED_CUSTOMER', 'Customer', id, `Created new customer record ${customerIdString} - ${body.fullName}`);

    return res.json({
      success: true,
      customer: {
        id,
        customerId: customerIdString,
        fullName: body.fullName.trim()
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update Customer
apiRouter.put('/customers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const body = req.body;

    const custRes = await db.query(`SELECT * FROM customers WHERE id = $1 AND is_deleted = FALSE`, [id]);
    if (custRes.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

    const c = custRes.rows[0];
    if (!canAccessCustomer(user, c)) {
      return res.status(403).json({ error: 'Access denied: Customer assigned to another employee' });
    }

    // Employees cannot reassign customer
    const assignedEmp = user.role === 'ADMIN' && body.assignedEmployeeId ? body.assignedEmployeeId : c.assigned_employee_id;

    await db.query(
      `UPDATE customers SET 
         full_name = COALESCE($1, full_name),
         dob = COALESCE($2, dob),
         gender = COALESCE($3, gender),
         email = COALESCE($4, email),
         address = COALESCE($5, address),
         city = COALESCE($6, city),
         state = COALESCE($7, state),
         pincode = COALESCE($8, pincode),
         pan = CASE WHEN $9 = 'ADMIN' AND $10::text IS NOT NULL THEN $10 ELSE pan END,
         aadhaar = CASE WHEN $9 = 'ADMIN' AND $11::text IS NOT NULL THEN $11 ELSE aadhaar END,
         bank_name = COALESCE($12, bank_name),
         account_holder_name = COALESCE($13, account_holder_name),
         account_number = CASE WHEN $9 = 'ADMIN' AND $14::text IS NOT NULL THEN $14 ELSE account_number END,
         ifsc_code = COALESCE($15, ifsc_code),
         account_type = COALESCE($16, account_type),
         assigned_employee_id = $17,
         updated_at = NOW()
       WHERE id = $18`,
      [
        body.fullName || null,
        body.dob || null,
        body.gender || null,
        body.email || null,
        body.address || null,
        body.city || null,
        body.state || null,
        body.pincode || null,
        user.role,
        body.pan || null,
        body.aadhaar || null,
        body.bankName || null,
        body.accountHolderName || null,
        body.accountNumber || null,
        body.ifscCode || null,
        body.accountType || null,
        assignedEmp,
        id
      ]
    );

    await db.logActivity(user.id, user.fullName, user.role, 'UPDATED_CUSTOMER', 'Customer', id, `Updated profile for customer ${c.customer_id}`);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Archive Customer
apiRouter.post('/customers/:id/archive', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.query(`UPDATE customers SET status = 'Archived', updated_at = NOW() WHERE id = $1`, [id]);
    await db.logActivity(req.user!.id, req.user!.fullName, 'ADMIN', 'ARCHIVED_CUSTOMER', 'Customer', id, 'Archived customer');
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Restore Customer
apiRouter.post('/customers/:id/restore', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.query(`UPDATE customers SET status = 'Active', updated_at = NOW() WHERE id = $1`, [id]);
    await db.logActivity(req.user!.id, req.user!.fullName, 'ADMIN', 'RESTORED_CUSTOMER', 'Customer', id, 'Restored customer');
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Permanent Delete (Admin Only)
apiRouter.delete('/customers/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM customers WHERE id = $1`, [id]);
    await db.logActivity(req.user!.id, req.user!.fullName, 'ADMIN', 'PERMANENT_DELETE_CUSTOMER', 'Customer', id, 'Permanently deleted customer');
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   4. PORTFOLIO PRODUCTS: SIP, MEDICAL, LIFE
   ========================================================================== */

// Add SIP
apiRouter.post('/customers/:id/sips', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const body = req.body;

    const custRes = await db.query(`SELECT * FROM customers WHERE id = $1`, [id]);
    if (custRes.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    if (!canAccessCustomer(user, custRes.rows[0])) return res.status(403).json({ error: 'Unauthorized' });

    const sipId = `sip_${Date.now()}`;
    await db.query(
      `INSERT INTO sips (id, customer_id, amc_name, scheme_name, folio_number, sip_amount, frequency, sip_debit_date, start_date, end_date, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        sipId,
        id,
        body.amcName,
        body.schemeName,
        body.folioNumber,
        body.sipAmount,
        body.frequency || 'Monthly',
        body.sipDebitDate || 5,
        body.startDate || new Date().toISOString().slice(0, 10),
        body.endDate || null,
        body.status || 'Active',
        body.notes || null
      ]
    );

    await ReminderEngine.evaluateReminders();
    await db.logActivity(user.id, user.fullName, user.role, 'ADDED_SIP', 'SIP', sipId, `Added SIP in ${body.schemeName} for customer ${custRes.rows[0].customer_id}`);

    return res.json({ success: true, sipId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Add Medical Insurance
apiRouter.post('/customers/:id/medical-insurance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const body = req.body;

    const custRes = await db.query(`SELECT * FROM customers WHERE id = $1`, [id]);
    if (custRes.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    if (!canAccessCustomer(user, custRes.rows[0])) return res.status(403).json({ error: 'Unauthorized' });

    const medId = `med_${Date.now()}`;
    await db.query(
      `INSERT INTO medical_insurances (id, customer_id, company_name, policy_number, policy_type, premium_amount, cover_amount, start_date, renewal_date, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        medId,
        id,
        body.companyName,
        body.policyNumber,
        body.policyType || 'Comprehensive Health',
        body.premiumAmount,
        body.coverAmount,
        body.startDate,
        body.renewalDate,
        body.status || 'Active',
        body.notes || null
      ]
    );

    // Add Family Members if provided
    if (Array.isArray(body.familyMembers)) {
      for (const f of body.familyMembers) {
        if (!f.name) continue;
        await db.query(
          `INSERT INTO medical_family_members (id, medical_insurance_id, name, relation, dob, gender, mobile, is_covered)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            `fam_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            medId,
            f.name,
            f.relation || 'Spouse',
            f.dob || '1990-01-01',
            f.gender || 'Female',
            f.mobile || null,
            f.isCovered ?? true
          ]
        );
      }
    }

    await ReminderEngine.evaluateReminders();
    await db.logActivity(user.id, user.fullName, user.role, 'ADDED_MEDICAL_INSURANCE', 'MedicalInsurance', medId, `Added Health Policy ${body.policyNumber}`);

    return res.json({ success: true, medicalId: medId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Add Life Insurance
apiRouter.post('/customers/:id/life-insurance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const body = req.body;

    const custRes = await db.query(`SELECT * FROM customers WHERE id = $1`, [id]);
    if (custRes.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    if (!canAccessCustomer(user, custRes.rows[0])) return res.status(403).json({ error: 'Unauthorized' });

    const lifeId = `life_${Date.now()}`;
    await db.query(
      `INSERT INTO life_insurances (id, customer_id, company_name, policy_number, policy_type, premium_amount, cover_amount, start_date, renewal_date, maturity_date, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        lifeId,
        id,
        body.companyName,
        body.policyNumber,
        body.policyType || 'Term Life',
        body.premiumAmount,
        body.coverAmount,
        body.startDate,
        body.renewalDate,
        body.maturityDate,
        body.status || 'Active',
        body.notes || null
      ]
    );

    await ReminderEngine.evaluateReminders();
    await db.logActivity(user.id, user.fullName, user.role, 'ADDED_LIFE_INSURANCE', 'LifeInsurance', lifeId, `Added Life Policy ${body.policyNumber}`);

    return res.json({ success: true, lifeId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   5. REMINDERS & MESSAGING
   ========================================================================== */

// List Reminders (Role-scoped)
apiRouter.get('/reminders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    let sql = `
      SELECT r.*, c.full_name as customer_name, c.mobile as customer_mobile, c.customer_id as customer_id_string
      FROM reminders r
      JOIN customers c ON r.customer_id = c.id
      WHERE c.is_deleted = FALSE
    `;
    const params: any[] = [];

    if (user.role === 'EMPLOYEE') {
      params.push(user.id);
      sql += ` AND c.assigned_employee_id = $${params.length}`;
    }

    sql += ` ORDER BY r.target_date ASC`;

    const resDb = await db.query(sql, params);
    const reminders = resDb.rows.map(r => ({
      id: r.id,
      customerId: r.customer_id,
      customerName: r.customer_name,
      customerMobile: r.customer_mobile,
      customerIdString: r.customer_id_string,
      productId: r.product_id,
      productType: r.product_type,
      reminderType: r.reminder_type,
      targetDate: r.target_date,
      reminderDate: r.reminder_date,
      escalationStage: r.escalation_stage,
      status: r.status,
      completedAt: r.completed_at,
      completedMethod: r.completed_method,
      completionNotes: r.completion_notes
    }));

    return res.json({ reminders });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Trigger Reminder Evaluation Engine manually
apiRouter.post('/reminders/evaluate', requireAuth, async (_req: Request, res: Response) => {
  try {
    const result = await ReminderEngine.evaluateReminders();
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Mark Reminder Completed
apiRouter.post('/reminders/:id/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { method = 'CALL', notes = '' } = req.body;

    await db.query(
      `UPDATE reminders SET 
         status = 'Completed',
         completed_at = NOW(),
         completed_method = $1,
         completion_notes = $2
       WHERE id = $3`,
      [method, notes, id]
    );

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Dispatch WhatsApp or SMS notification for a reminder
apiRouter.post('/reminders/:id/send-message', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { channel = 'WHATSAPP' } = req.body;

    const remRes = await db.query(
      `SELECT r.*, c.full_name as customer_name, c.mobile as customer_mobile
       FROM reminders r
       JOIN customers c ON r.customer_id = c.id
       WHERE r.id = $1`,
      [id]
    );

    if (remRes.rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });
    const rem = remRes.rows[0];

    // Format compliant text omitting sensitive premium/cover figures
    const msgText = ReminderEngine.formatClientMessage(
      rem.customer_name,
      rem.product_type,
      rem.reminder_type,
      rem.product_id,
      rem.target_date,
      rem.escalation_stage
    );

    const dispatchResult = await MessagingService.dispatchReminder(
      id,
      channel,
      rem.customer_mobile,
      msgText
    );

    return res.json(dispatchResult);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   6. REAL DOCUMENT STORAGE (Upload, View, Download, Delete)
   ========================================================================== */

// Upload Document (Admin or Assigned Employee)
apiRouter.post('/customers/:id/documents', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { title, category = 'KYC', fileName, mimeType, fileData } = req.body;

    if (!title || !fileName || !fileData) {
      return res.status(400).json({ error: 'Document title, filename, and file data are required' });
    }

    const custRes = await db.query(`SELECT * FROM customers WHERE id = $1`, [id]);
    if (custRes.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    if (!canAccessCustomer(user, custRes.rows[0])) return res.status(403).json({ error: 'Unauthorized' });

    const base64Clean = fileData.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    const doc = await DocumentStorageService.uploadDocument(
      id,
      title.trim(),
      category,
      fileName.trim(),
      mimeType || 'application/pdf',
      buffer,
      user.id
    );

    await db.logActivity(user.id, user.fullName, user.role, 'UPLOADED_DOCUMENT', 'Document', doc.id, `Uploaded ${doc.title} (${doc.fileName}) for customer ${custRes.rows[0].customer_id}`);

    return res.json({ success: true, document: doc });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// View Document Inline (Authorized Employee or Admin)
apiRouter.get('/documents/:id/view', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const doc = await DocumentStorageService.getDocument(id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const custRes = await db.query(`SELECT * FROM customers WHERE id = $1`, [doc.customerId]);
    if (custRes.rows.length === 0) return res.status(404).json({ error: 'Customer record missing' });
    if (!canAccessCustomer(user, custRes.rows[0])) return res.status(403).json({ error: 'Unauthorized' });

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
    return res.sendFile(doc.filePath);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Download Document (Admin ONLY; Employee gets HTTP 403 Forbidden)
apiRouter.get('/documents/:id/download', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await DocumentStorageService.getDocument(id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
    return res.sendFile(doc.filePath);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete Document (Admin ONLY; Employee gets HTTP 403 Forbidden)
apiRouter.delete('/documents/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const success = await DocumentStorageService.deleteDocument(id);
    if (!success) return res.status(404).json({ error: 'Document not found' });

    await db.logActivity(req.user!.id, req.user!.fullName, 'ADMIN', 'DELETED_DOCUMENT', 'Document', id, 'Deleted customer document');
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   7. CUSTOMER NOTES
   ========================================================================== */

apiRouter.post('/customers/:id/notes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) return res.status(400).json({ error: 'Note text cannot be empty' });

    const custRes = await db.query(`SELECT * FROM customers WHERE id = $1`, [id]);
    if (custRes.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    if (!canAccessCustomer(user, custRes.rows[0])) return res.status(403).json({ error: 'Unauthorized' });

    const noteId = `note_${Date.now()}`;
    await db.query(
      `INSERT INTO customer_notes (id, customer_id, text, author_user_id, author_name, author_role)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [noteId, id, text.trim(), user.id, user.fullName, user.role]
    );

    return res.json({
      success: true,
      note: {
        id: noteId,
        customerId: id,
        text: text.trim(),
        authorName: user.fullName,
        authorRole: user.role,
        createdAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   8. IMPORT & EXPORT (Admin Only)
   ========================================================================== */

// Customer Export (ADMIN ONLY; Employees receive 403 Forbidden)
const exportCustomersHandler = async (req: Request, res: Response) => {
  try {
    const { format = 'xlsx', productType, employeeId, status } = req.query as Record<string, string>;
    const fmt = format === 'csv' ? 'csv' : 'xlsx';

    const buffer = await ImportExportService.exportCustomers({
      productType: productType as any,
      employeeId,
      status
    }, fmt);

    const filename = `MIM_Customers_${new Date().toISOString().slice(0, 10)}.${fmt}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', fmt === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
apiRouter.get('/export/customers', requireAuth, requireAdmin, exportCustomersHandler);
apiRouter.get('/import-export/export', requireAuth, requireAdmin, exportCustomersHandler);

// Import Template
apiRouter.get('/import-export/template', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const { format = 'xlsx' } = req.query as { format?: string };
  const fmt = format === 'csv' ? 'csv' : 'xlsx';
  const buffer = ImportExportService.generateTemplate(fmt);
  const filename = `MIM_Customer_Import_Template.${fmt}`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', fmt === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(buffer);
});

// Import Preview & Duplicate Validation
const validateImportHandler = async (req: Request, res: Response) => {
  try {
    const { fileData } = req.body;
    let buffer: Buffer;
    if (fileData) {
      const base64Clean = fileData.replace(/^data:.*?;base64,/, '');
      buffer = Buffer.from(base64Clean, 'base64');
    } else {
      buffer = ImportExportService.generateTemplate('xlsx');
    }

    const preview = await ImportExportService.previewImport(buffer);
    return res.json({ success: true, ...preview, duplicateMobilesCount: preview.duplicatesCount });
  } catch (err: any) {
    return res.status(400).json({ error: 'Failed parsing file: ' + err.message });
  }
};
apiRouter.post('/import/preview', requireAuth, requireAdmin, validateImportHandler);
apiRouter.post('/import-export/validate', requireAuth, requireAdmin, validateImportHandler);

// Commit Import
const commitImportHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rows, validRows, duplicateStrategy = 'skip', duplicateHandling, defaultEmployeeId, assignedEmployeeId } = req.body;
    const targetRows = rows || validRows;
    const strategy = duplicateHandling || duplicateStrategy || 'skip';
    const empId = assignedEmployeeId || defaultEmployeeId;

    if (!Array.isArray(targetRows) || targetRows.length === 0) {
      return res.status(400).json({ error: 'Valid rows array required' });
    }

    const result = await ImportExportService.commitImport(targetRows, strategy, req.user!.id, empId);
    await db.logActivity(req.user!.id, req.user!.fullName, 'ADMIN', 'IMPORTED_CUSTOMERS', 'Customer', 'BATCH', `Imported ${result.imported} new, updated ${result.updated}, skipped ${result.skipped}`);

    return res.json({ success: true, ...result, importedCount: result.imported });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
apiRouter.post('/import/commit', requireAuth, requireAdmin, commitImportHandler);
apiRouter.post('/import-export/commit', requireAuth, requireAdmin, commitImportHandler);

/* ==========================================================================
   9. DASHBOARD & REPORTS (Real Database Queries)
   ========================================================================== */

apiRouter.get('/dashboard', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const customersRes = await db.query(`SELECT * FROM customers WHERE is_deleted = FALSE`);
    const customers = customersRes.rows;
    const remindersRes = await db.query(`SELECT * FROM reminders`);
    const reminders = remindersRes.rows;

    if (user.role === 'ADMIN') {
      const sipsRes = await db.query(`SELECT * FROM sips WHERE status = 'Active'`);
      const medsRes = await db.query(`SELECT * FROM medical_insurances WHERE status = 'Active'`);
      const lifesRes = await db.query(`SELECT * FROM life_insurances WHERE status = 'Active'`);
      const empRes = await db.query(`SELECT * FROM users WHERE role = 'EMPLOYEE'`);

      const employeeBreakdown = empRes.rows.map(emp => {
        const assigned = customers.filter(c => c.assigned_employee_id === emp.id);
        const custIds = new Set(assigned.map(c => c.id));
        const pendingRem = reminders.filter(r => custIds.has(r.customer_id) && r.status === 'Due').length;
        return {
          id: emp.id,
          name: emp.full_name,
          mobile: emp.mobile,
          customersCount: assigned.length,
          pendingReminders: pendingRem
        };
      });

      const productDistribution = [
        { name: 'SIP Investments', count: sipsRes.rows.length },
        { name: 'Medical Insurance', count: medsRes.rows.length },
        { name: 'Life Insurance', count: lifesRes.rows.length }
      ];

      const upcomingOverviews = [
        { category: 'SIP Debits (Next 30 Days)', count: reminders.filter(r => r.product_type === 'SIP' && r.status !== 'Completed').length },
        { category: 'Health Renewals', count: reminders.filter(r => r.product_type === 'MEDICAL_INSURANCE' && r.reminder_type === 'RENEWAL' && r.status !== 'Completed').length },
        { category: 'Life Renewals', count: reminders.filter(r => r.product_type === 'LIFE_INSURANCE' && r.reminder_type === 'RENEWAL' && r.status !== 'Completed').length },
        { category: 'Life Maturities', count: reminders.filter(r => r.product_type === 'LIFE_INSURANCE' && r.reminder_type === 'MATURITY' && r.status !== 'Completed').length }
      ];

      return res.json({
        role: 'ADMIN',
        stats: {
          totalCustomers: customers.length,
          totalEmployees: empRes.rows.length,
          sipCustomersCount: new Set(sipsRes.rows.map(s => s.customer_id)).size,
          medicalCustomersCount: new Set(medsRes.rows.map(m => m.customer_id)).size,
          lifeCustomersCount: new Set(lifesRes.rows.map(l => l.customer_id)).size,
          upcomingRemindersCount: reminders.filter(r => r.status === 'Upcoming').length,
          pendingRemindersCount: reminders.filter(r => r.status === 'Due').length
        },
        productDistribution,
        upcomingOverviews,
        employeeBreakdown
      });
    }

    // Employee Dashboard: Scoped to assigned records, NO financial charts
    const myCustomers = customers.filter(c => c.assigned_employee_id === user.id);
    const myCustIds = new Set(myCustomers.map(c => c.id));
    const myReminders = reminders.filter(r => myCustIds.has(r.customer_id));

    const todaysReminders = myReminders.filter(r => r.status === 'Due');
    const upcomingReminders = myReminders.filter(r => r.status === 'Upcoming');

    return res.json({
      role: 'EMPLOYEE',
      stats: {
        myCustomersCount: myCustomers.length,
        todaysRemindersCount: todaysReminders.length,
        upcomingRemindersCount: upcomingReminders.length,
        pendingFollowupsCount: todaysReminders.length
      },
      todaysReminders: todaysReminders.slice(0, 10).map(r => {
        const c = myCustomers.find(cust => cust.id === r.customer_id);
        return {
          id: r.id,
          customerName: c?.full_name || 'Customer',
          customerMobile: c?.mobile || '',
          customerIdString: c?.customer_id || '',
          productType: r.product_type,
          reminderType: r.reminder_type,
          targetDate: r.target_date,
          status: r.status
        };
      }),
      recentCustomers: myCustomers.slice(0, 8).map(c => sanitizeCustomerForRole(c, 'EMPLOYEE'))
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Reports Data
apiRouter.get('/reports/data', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getReportData(req.query as any);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Reports Excel Export
apiRouter.get('/reports/export/excel', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const buffer = await ReportsService.generateExcelReport(req.query as any);
    const filename = `MIM_Intelligence_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Reports PDF Export
apiRouter.get('/reports/export/pdf', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const buffer = await ReportsService.generatePdfReport(req.query as any);
    const filename = `MIM_Intelligence_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   10. BUSINESS SETTINGS & BACKUPS (Admin Only)
   ========================================================================== */

apiRouter.get('/settings', requireAuth, async (_req: Request, res: Response) => {
  try {
    const sRes = await db.query(`SELECT * FROM business_settings LIMIT 1`);
    return res.json({ settings: sRes.rows[0] || {} });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/settings', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body;
    await db.query(
      `UPDATE business_settings SET 
         business_name = COALESCE($1, business_name),
         tagline = COALESCE($2, tagline),
         contact_email = COALESCE($3, contact_email),
         contact_phone = COALESCE($4, contact_phone),
         whatsapp_number = COALESCE($5, whatsapp_number),
         address = COALESCE($6, address)`,
      [body.businessName, body.tagline, body.contactEmail, body.contactPhone, body.whatsappNumber, body.address]
    );

    await db.logActivity(req.user!.id, req.user!.fullName, 'ADMIN', 'UPDATED_SETTINGS', 'Settings', 'DEFAULT', 'Updated firm business details');
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Backups
const listBackupsHandler = (_req: Request, res: Response) => {
  const backups = db.listBackups();
  return res.json({ backups });
};
apiRouter.get('/backups', requireAuth, requireAdmin, listBackupsHandler);
apiRouter.get('/settings/backups', requireAuth, requireAdmin, listBackupsHandler);

const createBackupHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filename = await db.createBackupSnapshot('manual');
    await db.logActivity(req.user!.id, req.user!.fullName, 'ADMIN', 'CREATED_BACKUP', 'Backup', filename, `Created database snapshot ${filename}`);
    return res.json({ success: true, filename });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
apiRouter.post('/backups/create', requireAuth, requireAdmin, createBackupHandler);
apiRouter.post('/settings/backups/create', requireAuth, requireAdmin, createBackupHandler);

/* ==========================================================================
   11. AUTOMATED TEST SUITE RUNNER
   ========================================================================== */

const runTestsHandler = async (_req: Request, res: Response) => {
  try {
    const results = await AppTestSuite.runAllTests();
    return res.json(results);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
apiRouter.get('/tests/run', requireAuth, requireAdmin, runTestsHandler);
apiRouter.post('/tests/run', requireAuth, requireAdmin, runTestsHandler);
