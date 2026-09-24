export type UserRole = 'ADMIN' | 'EMPLOYEE';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type NavTab =
  | 'dashboard'
  | 'customers'
  | 'reminders'
  | 'calendar'
  | 'employees'
  | 'reports'
  | 'import_export'
  | 'settings'
  | 'profile';

export interface User {
  id: string;
  email: string;
  fullName: string;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  profilePhoto?: string;
  employeeId?: string;
}

export interface Customer {
  id: string;
  customerId: string; // MIM-0001
  fullName: string;
  profilePhoto?: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  pan: string; // Masked for Employee
  aadhaar: string; // Masked for Employee
  bankName: string;
  accountHolderName: string;
  accountNumber: string; // Masked for Employee
  ifscCode: string;
  accountType: 'Savings' | 'Current' | 'Other';
  status: 'Active' | 'Archived';
  assignedEmployeeId: string;
  assignedEmployeeName?: string;
  assignedEmployeeMobile?: string;
  isDeleted: boolean;
  sipsCount?: number;
  medicalCount?: number;
  lifeCount?: number;
  pendingRemindersCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SIP {
  id: string;
  customerId: string;
  amcName: string;
  schemeName: string;
  folioNumber: string;
  sipAmount: number;
  frequency: 'Monthly' | 'Quarterly' | 'Yearly';
  sipDebitDate: number; // 1-31
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Pending' | 'Paused' | 'Cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicalFamilyMember {
  id: string;
  medicalInsuranceId: string;
  name: string;
  relation: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  mobile?: string;
  isCovered: boolean;
}

export interface MedicalInsurance {
  id: string;
  customerId: string;
  companyName: string;
  policyNumber: string;
  policyType: string;
  premiumAmount: number;
  coverAmount: number;
  startDate: string;
  renewalDate: string;
  status: 'Active' | 'Pending' | 'Expired' | 'Matured' | 'Cancelled';
  notes?: string;
  familyMembers?: MedicalFamilyMember[];
  createdAt: string;
  updatedAt: string;
}

export interface LifeInsurance {
  id: string;
  customerId: string;
  companyName: string;
  policyNumber: string;
  policyType: string;
  premiumAmount: number;
  coverAmount: number;
  startDate: string;
  renewalDate: string;
  maturityDate: string;
  status: 'Active' | 'Pending' | 'Expired' | 'Matured' | 'Cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  customerId: string;
  customerName?: string;
  customerMobile?: string;
  customerIdString?: string;
  policyOrFolio?: string;
  companyName?: string;
  productId: string;
  productType: 'SIP' | 'MEDICAL_INSURANCE' | 'LIFE_INSURANCE';
  reminderType: 'SIP_DEBIT' | 'RENEWAL' | 'MATURITY';
  escalationStage: 10 | 5 | 2;
  targetDate: string;
  reminderDate: string;
  status: 'Upcoming' | 'Due' | 'Completed' | 'Overdue' | 'Cancelled';
  completedAt?: string;
  completedMethod?: 'CALL' | 'WHATSAPP';
  completionNotes?: string;
}

export interface CustomerDocument {
  id: string;
  customerId: string;
  title: string;
  category: 'KYC' | 'SIP Documents' | 'Life Insurance' | 'Medical Insurance' | 'Other';
  fileType: 'pdf' | 'jpg' | 'jpeg' | 'png';
  fileSize: number;
  version: number;
  createdAt: string;
  canDownload?: boolean;
  canDelete?: boolean;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  text: string;
  authorUserId: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: string;
}

export interface EmployeeSummary {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  status: UserStatus;
  profilePhoto?: string;
  employeeId: string;
  joiningDate: string;
  designation: string;
  assignedCustomersCount: number;
  pendingRemindersCount: number;
}
