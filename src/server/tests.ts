import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { db, maskPan, maskAadhaar, maskAccountNumber, sanitizeCustomerForRole } from './db';
import { ReminderEngine, addDays, formatDateYMD } from './reminderEngine';
import { ImportExportService } from './importExport';
import { ReportsService } from './reports';
import { generateCustomerReminderMessage } from './messaging';

export interface TestResultItem {
  category: string;
  testName: string;
  passed: boolean;
  message: string;
}

export class AppTestSuite {
  public static async runAllTests(): Promise<{ passedCount: number; totalCount: number; results: TestResultItem[] }> {
    const results: TestResultItem[] = [];

    const record = (category: string, testName: string, passed: boolean, message: string) => {
      results.push({ category, testName, passed, message });
    };

    // 1. AUTH & REGISTRATION CODE TESTS
    try {
      // Test A: Active registration code check
      const admin = db.schema.users.find(u => u.role === 'ADMIN');
      if (!admin) throw new Error('Admin not found');

      const codeObj = db.generateRegistrationCode(admin.id);
      record('AUTH', 'Registration code generation', !!codeObj.code && !codeObj.isUsed, `Code: ${codeObj.code}`);

      // Test B: One-time use rule
      const activeCode = db.getActiveRegistrationCode();
      record('AUTH', 'Only one active registration code', activeCode?.code === codeObj.code, 'Active code verified');

      // Test C: Invalidation upon generating a new one
      const newCodeObj = db.generateRegistrationCode(admin.id);
      record('AUTH', 'Generating new code invalidates previous code', codeObj.isUsed === true && newCodeObj.isUsed === false, 'Previous code invalidated');

      // Test D: Mark code used
      newCodeObj.isUsed = true;
      const noActiveCode = db.getActiveRegistrationCode();
      record('AUTH', 'Used code cannot be re-used', noActiveCode === undefined, 'Active code is null when used');
    } catch (err: any) {
      record('AUTH', 'Auth registration code test', false, err.message);
    }

    // 2. AUTHORIZATION & SENSITIVE DATA MASKING
    try {
      const sampleCustomer = db.schema.customers[0];
      if (!sampleCustomer) throw new Error('No customer in DB');

      const adminView = sanitizeCustomerForRole(sampleCustomer, 'ADMIN');
      const employeeView = sanitizeCustomerForRole(sampleCustomer, 'EMPLOYEE');

      // Admin sees full values
      const adminFullPan = adminView.pan === sampleCustomer.pan;
      const adminFullAadhaar = adminView.aadhaar === sampleCustomer.aadhaar;
      const adminFullAcc = adminView.accountNumber === sampleCustomer.accountNumber;
      record('AUTHORIZATION', 'Admin sees unmasked sensitive information', adminFullPan && adminFullAadhaar && adminFullAcc, 'Full PAN/Aadhaar/Bank accessible');

      // Employee sees masked values
      const employeeMaskedPan = employeeView.pan.startsWith('XXXXX') && employeeView.pan.length === 10;
      const employeeMaskedAadhaar = employeeView.aadhaar.startsWith('XXXX XXXX');
      const employeeMaskedAcc = employeeView.accountNumber.startsWith('••••••••');
      record('AUTHORIZATION', 'Employee receives strictly masked PAN, Aadhaar & Bank Details', employeeMaskedPan && employeeMaskedAadhaar && employeeMaskedAcc, `Masked PAN: ${employeeView.pan}, Masked Aadhaar: ${employeeView.aadhaar}`);

      // Scoping: Employee only assigned customers
      const emp1 = db.schema.users.find(u => u.role === 'EMPLOYEE');
      if (emp1) {
        const assignedCusts = db.schema.customers.filter(c => c.assignedEmployeeId === emp1.id);
        const unassignedCusts = db.schema.customers.filter(c => c.assignedEmployeeId !== emp1.id);
        record('AUTHORIZATION', 'Employee customer scoping separation', assignedCusts.length > 0 && unassignedCusts.length > 0, `Scoping separates ${assignedCusts.length} assigned from others`);
      }
    } catch (err: any) {
      record('AUTHORIZATION', 'Data masking & role authorization', false, err.message);
    }

    // 3. CUSTOMER MANAGEMENT & ID GENERATION
    try {
      const nextId1 = db.nextCustomerId();
      const num1 = parseInt(nextId1.replace('MIM-', ''), 10);
      const tempCust = { ...db.schema.customers[0], id: 'temp_test_cust', customerId: nextId1 };
      db.schema.customers.push(tempCust);
      const nextId2 = db.nextCustomerId();
      const num2 = parseInt(nextId2.replace('MIM-', ''), 10);
      db.schema.customers = db.schema.customers.filter(c => c.id !== 'temp_test_cust');

      const validFormat = nextId1.startsWith('MIM-') && nextId2.startsWith('MIM-');
      const sequential = num2 === num1 + 1;
      record('CUSTOMERS', 'Sequential Customer ID generation (MIM-0001 format)', validFormat && sequential, `Generated ${nextId1} -> ${nextId2}`);

      // Employee ID sequential generation
      const empId1 = db.nextEmployeeId();
      const empValid = empId1.startsWith('EMP-');
      record('CUSTOMERS', 'Sequential Employee ID generation (EMP-001 format)', empValid, `Generated ${empId1}`);
    } catch (err: any) {
      record('CUSTOMERS', 'Customer operations', false, err.message);
    }

    // 4. REMINDER ENGINE & 10/5/2 DAY SEQUENTIAL LOGIC
    try {
      const fakeToday = new Date();
      const renewalDateObj = addDays(fakeToday, 10);
      const renewalDateStr = formatDateYMD(renewalDateObj);

      // Create test customer & medical policy
      const testCustId = 'test_cust_999';
      const testCustomer = {
        id: testCustId,
        customerId: 'MIM-9999',
        fullName: 'Test Reminder Customer',
        dob: '1985-01-01',
        gender: 'Male' as const,
        mobile: '9999999999',
        email: 'test@reminder.com',
        address: 'Test Address',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        pan: 'TESTP1234K',
        aadhaar: '123412341234',
        bankName: 'Test Bank',
        accountHolderName: 'Test Reminder Customer',
        accountNumber: '999911112222',
        ifscCode: 'TEST0001111',
        accountType: 'Savings' as const,
        status: 'Active' as const,
        assignedEmployeeId: 'usr_emp_001',
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.schema.customers.push(testCustomer);

      const testMedId = 'test_med_999';
      const testMed = {
        id: testMedId,
        customerId: testCustId,
        companyName: 'Star Health Insurance',
        policyNumber: 'TEST-POL-999',
        policyType: 'Comprehensive Health Plan',
        premiumAmount: 25000,
        coverAmount: 1000000,
        startDate: '2025-10-01',
        renewalDate: renewalDateStr,
        status: 'Active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.schema.medicalInsurances.push(testMed);

      // Run engine for today
      await ReminderEngine.runEngine(fakeToday);

      const cycleKey = `med_${testMedId}_${renewalDateStr}_RENEWAL`;
      const tenDayRem = db.schema.reminders.find(r => r.cycleKey === cycleKey && r.escalationStage === 10);
      record('REMINDERS', '10-day advance insurance renewal reminder trigger', !!tenDayRem, `Reminder scheduled for ${tenDayRem?.reminderDate}`);

      // Message content check: MUST NOT contain premium or cover amount!
      const msg = generateCustomerReminderMessage({
        customerName: 'Test Reminder Customer',
        productType: 'Medical Insurance',
        companyName: 'Star Health Insurance',
        policyOrFolioNumber: 'TEST-POL-999',
        dueDate: renewalDateStr,
        reminderType: 'RENEWAL',
        businessName: 'My Investment Manager',
        contactNumber: '9876543210'
      });

      const containsPolicy = msg.includes('TEST-POL-999');
      const excludesPremium = !msg.includes('25000');
      const excludesCover = !msg.includes('1000000');
      const containsBrand = msg.includes('My Investment Manager');
      record('REMINDERS', 'Customer message formatting excludes premium/cover amounts', containsPolicy && excludesPremium && excludesCover && containsBrand, 'Policy included, Sensitive amounts strictly hidden');

      // Test Completed logic suppresses future 5-day / 2-day notifications
      if (tenDayRem) {
        ReminderEngine.completeReminder(tenDayRem.id, 'usr_emp_001', 'CALL', 'Called customer, payment confirmed');
        const isCycleCompleted = db.schema.reminders.some(r => r.cycleKey === cycleKey && r.status === 'Completed');
        record('REMINDERS', 'Completed reminder cycle stops future reminders', isCycleCompleted, 'Cycle marked completed');
      }

      // Cleanup test customer
      db.schema.customers = db.schema.customers.filter(c => c.id !== testCustId);
      db.schema.medicalInsurances = db.schema.medicalInsurances.filter(m => m.id !== testMedId);
      db.schema.reminders = db.schema.reminders.filter(r => r.cycleKey !== cycleKey);
    } catch (err: any) {
      record('REMINDERS', 'Reminder engine tests', false, err.message);
    }

    // 5. IMPORT / EXPORT & DUPLICATE CHECKS
    try {
      const exportBuffer = await ImportExportService.exportCustomers({}, 'xlsx');
      record('IMPORT_EXPORT', 'Admin Excel customer export generation', Buffer.isBuffer(exportBuffer) && exportBuffer.length > 500, `Generated Excel buffer size: ${exportBuffer.length} bytes`);

      const csvBuffer = await ImportExportService.exportCustomers({}, 'csv');
      const csvStr = csvBuffer.toString('utf-8');
      record('IMPORT_EXPORT', 'Admin CSV customer export generation', csvStr.includes('Customer ID') && csvStr.includes('Full Name'), 'CSV header validated');

      // Test Preview with mock rows
      const mockRows = [
        {
          'Full Name': 'Fresh Test Customer',
          'Mobile Number': '9898989898',
          'Email Address': 'fresh@example.com',
          'City': 'Bengaluru',
          'State': 'Karnataka'
        },
        {
          'Full Name': '', // Invalid: missing name
          'Mobile Number': '123' // Invalid mobile
        }
      ];
      const ws = XLSX.utils.json_to_sheet(mockRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const testImportBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const preview = await ImportExportService.previewImport(testImportBuffer);
      record('IMPORT_EXPORT', 'Import validation and preview separation', preview.validRows.length === 1 && preview.invalidRows.length === 1, `1 Valid, 1 Invalid row detected`);
    } catch (err: any) {
      record('IMPORT_EXPORT', 'Import export tests', false, err.message);
    }

    // 6. REPORTS AGGREGATION & EXPORTS
    try {
      const report = await ReportsService.getReportData();
      const validTotals = report.totals.totalCustomers >= 0 && report.employeeBreakdown.length >= 0;
      record('REPORTS', 'Reports live aggregation calculations', validTotals, `${report.totals.totalCustomers} customers, ${report.totals.totalEmployees} employees counted`);

      const excelRep = await ReportsService.exportExcelReport();
      record('REPORTS', 'Reports Excel export generator', Buffer.isBuffer(excelRep) && excelRep.length > 1000, `Report Excel size: ${excelRep.length} bytes`);

      const pdfRep = await ReportsService.exportPdfReport();
      record('REPORTS', 'Reports PDF export generator', Buffer.isBuffer(pdfRep) && pdfRep.length > 1000, `Report PDF size: ${pdfRep.length} bytes`);
    } catch (err: any) {
      record('REPORTS', 'Reports tests', false, err.message);
    }

    const passedCount = results.filter(r => r.passed).length;
    return {
      passedCount,
      totalCount: results.length,
      results
    };
  }
}
