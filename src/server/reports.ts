import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from './db';

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  productType?: 'ALL' | 'SIP' | 'MEDICAL_INSURANCE' | 'LIFE_INSURANCE';
}

export class ReportsService {
  /**
   * Aggregates real operational metrics from PostgreSQL
   */
  public static async getReportData(filter: ReportFilter = {}): Promise<any> {
    // 1. Customers
    let custSql = `SELECT * FROM customers WHERE is_deleted = FALSE`;
    const custParams: any[] = [];
    if (filter.employeeId && filter.employeeId !== 'ALL') {
      custParams.push(filter.employeeId);
      custSql += ` AND assigned_employee_id = $${custParams.length}`;
    }
    const custRes = await db.query(custSql, custParams);
    const customers = custRes.rows;
    const customerIds = new Set(customers.map(c => c.id));

    // 2. SIPs
    const sipsRes = await db.query(`SELECT * FROM sips`);
    const sips = sipsRes.rows.filter(s => customerIds.has(s.customer_id));

    // 3. Medical Insurances
    const medsRes = await db.query(`SELECT * FROM medical_insurances`);
    const meds = medsRes.rows.filter(m => customerIds.has(m.customer_id));

    // 4. Life Insurances
    const lifesRes = await db.query(`SELECT * FROM life_insurances`);
    const lifes = lifesRes.rows.filter(l => customerIds.has(l.customer_id));

    // 5. Reminders
    const remRes = await db.query(`SELECT * FROM reminders`);
    const reminders = remRes.rows.filter(r => customerIds.has(r.customer_id));

    // 6. Employees
    const empRes = await db.query(`SELECT id, full_name, mobile, status FROM users WHERE role = 'EMPLOYEE'`);
    const employees = empRes.rows;

    const activeSips = sips.filter(s => s.status === 'Active');
    const totalMonthlySipAmount = activeSips.reduce((sum, s) => sum + parseFloat(s.sip_amount || '0'), 0);

    const activeMeds = meds.filter(m => m.status === 'Active');
    const totalMedicalSumInsured = activeMeds.reduce((sum, m) => sum + parseFloat(m.cover_amount || '0'), 0);
    const totalMedicalPremiums = activeMeds.reduce((sum, m) => sum + parseFloat(m.premium_amount || '0'), 0);

    const activeLifes = lifes.filter(l => l.status === 'Active');
    const totalLifeSumAssured = activeLifes.reduce((sum, l) => sum + parseFloat(l.cover_amount || '0'), 0);
    const totalLifePremiums = activeLifes.reduce((sum, l) => sum + parseFloat(l.premium_amount || '0'), 0);

    // AMC Breakdown
    const amcCountMap: Record<string, { count: number; volume: number }> = {};
    for (const s of activeSips) {
      const amc = s.amc_name || 'Other';
      if (!amcCountMap[amc]) amcCountMap[amc] = { count: 0, volume: 0 };
      amcCountMap[amc].count += 1;
      amcCountMap[amc].volume += parseFloat(s.sip_amount || '0');
    }
    const amcBreakdown = Object.entries(amcCountMap).map(([amc, val]) => ({
      amc,
      count: val.count,
      volume: val.volume
    })).sort((a, b) => b.volume - a.volume);

    // Employee Breakdown
    const employeeBreakdown = employees.map(emp => {
      const assignedCusts = customers.filter(c => c.assigned_employee_id === emp.id);
      const assignedIds = new Set(assignedCusts.map(c => c.id));
      const empSips = sips.filter(s => assignedIds.has(s.customer_id) && s.status === 'Active');
      const empMeds = meds.filter(m => assignedIds.has(m.customer_id) && m.status === 'Active');
      const empLifes = lifes.filter(l => assignedIds.has(l.customer_id) && l.status === 'Active');
      const empReminders = reminders.filter(r => assignedIds.has(r.customer_id));

      return {
        employeeId: emp.id,
        employeeName: emp.full_name,
        customersCount: assignedCusts.length,
        activeSipsCount: empSips.length,
        sipMonthlyVolume: empSips.reduce((sum, s) => sum + parseFloat(s.sip_amount || '0'), 0),
        medicalPoliciesCount: empMeds.length,
        lifePoliciesCount: empLifes.length,
        pendingRemindersCount: empReminders.filter(r => r.status === 'Due' || r.status === 'Upcoming').length,
        completedRemindersCount: empReminders.filter(r => r.status === 'Completed').length
      };
    });

    const totals = {
      totalCustomers: customers.length,
      activeCustomers: customers.filter(c => c.status === 'Active').length,
      archivedCustomers: customers.filter(c => c.status === 'Archived').length,
      activeSipsCount: activeSips.length,
      totalMonthlySipAmount,
      activeMedicalCount: activeMeds.length,
      totalMedicalSumInsured,
      totalMedicalPremiums,
      activeLifeCount: activeLifes.length,
      totalLifeSumAssured,
      totalLifePremiums,
      pendingRemindersCount: reminders.filter(r => r.status === 'Due' || r.status === 'Upcoming').length,
      completedRemindersCount: reminders.filter(r => r.status === 'Completed').length,
      totalEmployees: employees.length
    };

    return {
      summary: totals,
      totals,
      amcBreakdown,
      employeeBreakdown
    };
  }

  /**
   * Generates formatted Excel report buffer
   */
  public static async exportExcelReport(filter: ReportFilter = {}): Promise<Buffer> {
    return this.generateExcelReport(filter);
  }

  public static async exportPdfReport(filter: ReportFilter = {}): Promise<Buffer> {
    return this.generatePdfReport(filter);
  }

  public static async generateExcelReport(filter: ReportFilter = {}): Promise<Buffer> {
    const data = await this.getReportData(filter);
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryRows = [
      { Metric: 'Total Registered Customers', Value: data.summary.totalCustomers },
      { Metric: 'Active Customers', Value: data.summary.activeCustomers },
      { Metric: 'Active Monthly SIP Count', Value: data.summary.activeSipsCount },
      { Metric: 'Total Monthly SIP Volume (INR)', Value: `₹${data.summary.totalMonthlySipAmount.toLocaleString('en-IN')}` },
      { Metric: 'Active Health Policies', Value: data.summary.activeMedicalCount },
      { Metric: 'Total Health Cover (INR)', Value: `₹${data.summary.totalMedicalSumInsured.toLocaleString('en-IN')}` },
      { Metric: 'Annual Health Premiums (INR)', Value: `₹${data.summary.totalMedicalPremiums.toLocaleString('en-IN')}` },
      { Metric: 'Active Life Policies', Value: data.summary.activeLifeCount },
      { Metric: 'Total Life Sum Assured (INR)', Value: `₹${data.summary.totalLifeSumAssured.toLocaleString('en-IN')}` },
      { Metric: 'Annual Life Premiums (INR)', Value: `₹${data.summary.totalLifePremiums.toLocaleString('en-IN')}` },
      { Metric: 'Pending Reminders', Value: data.summary.pendingRemindersCount },
      { Metric: 'Completed Reminders', Value: data.summary.completedRemindersCount }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Business Overview');

    // Employee Breakdown Sheet
    const empRows = data.employeeBreakdown.map((e: any) => ({
      'Employee Name': e.employeeName,
      'Assigned Customers': e.customersCount,
      'Active SIPs': e.activeSipsCount,
      'Monthly SIP Volume (₹)': e.sipMonthlyVolume,
      'Health Policies': e.medicalPoliciesCount,
      'Life Policies': e.lifePoliciesCount,
      'Pending Reminders': e.pendingRemindersCount,
      'Completed Reminders': e.completedRemindersCount
    }));
    const wsEmp = XLSX.utils.json_to_sheet(empRows);
    XLSX.utils.book_append_sheet(wb, wsEmp, 'Employee Performance');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Generates formal PDF report using jsPDF
   */
  public static async generatePdfReport(filter: ReportFilter = {}): Promise<Buffer> {
    const data = await this.getReportData(filter);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header styling: White & Blue
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('MY INVESTMENT MANAGER', 14, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Business Intelligence & Portfolio Report', 130, 15);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 32);

    // Summary Table
    const summaryData = [
      ['Total Active Customers', `${data.summary.activeCustomers}`],
      ['Total Monthly SIP Volume', `INR ${data.summary.totalMonthlySipAmount.toLocaleString('en-IN')}`],
      ['Active Health Policies', `${data.summary.activeMedicalCount}`],
      ['Total Health Cover', `INR ${data.summary.totalMedicalSumInsured.toLocaleString('en-IN')}`],
      ['Active Life Policies', `${data.summary.activeLifeCount}`],
      ['Total Life Sum Assured', `INR ${data.summary.totalLifeSumAssured.toLocaleString('en-IN')}`],
      ['Actionable Pending Reminders', `${data.summary.pendingRemindersCount}`],
      ['Completed Client Reminders', `${data.summary.completedRemindersCount}`]
    ];

    autoTable(doc, {
      startY: 38,
      head: [['Key Performance Indicator', 'Aggregate Volume']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 100;

    // Employee table
    const empData = data.employeeBreakdown.map((e: any) => [
      e.employeeName,
      `${e.customersCount}`,
      `${e.activeSipsCount}`,
      `${e.medicalPoliciesCount}`,
      `${e.lifePoliciesCount}`,
      `${e.pendingRemindersCount}`,
      `${e.completedRemindersCount}`
    ]);

    autoTable(doc, {
      startY: finalY + 10,
      head: [['Employee Name', 'Customers', 'SIPs', 'Health', 'Life', 'Pending Rem.', 'Completed']],
      body: empData,
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 }
    });

    return Buffer.from(doc.output('arraybuffer'));
  }
}
