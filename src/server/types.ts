export type UserRole = 'ADMIN' | 'EMPLOYEE';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type Gender = 'Male' | 'Female' | 'Other';
export type AccountType = 'Savings' | 'Current' | 'Other';
export type ProductType = 'SIP' | 'MEDICAL_INSURANCE' | 'LIFE_INSURANCE';
export type ReminderType = 'SIP_DEBIT' | 'RENEWAL' | 'MATURITY';
export type ReminderStatus = 'Upcoming' | 'Due' | 'Completed' | 'Overdue' | 'Cancelled';
export type DeliveryChannel = 'WHATSAPP' | 'SMS' | 'CALL';
export type DeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'NOT_CONFIGURED';
export type DocumentCategory = 'KYC' | 'SIP Documents' | 'Life Insurance' | 'Medical Insurance' | 'Other';
export type DocumentFileType = 'pdf' | 'jpg' | 'jpeg' | 'png';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  profilePhoto?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProfile {
  id?: string;
  userId: string;
}

export interface EmployeeProfile {
  id: string;
  userId: string;
  employeeId: string; // EMP-001
  joiningDate: string;
  designation: string;
}

export interface RegistrationCode {
  id: string;
  code: string;
  isUsed: boolean;
  createdByAdminId: string;
  usedByEmployeeId?: string;
  createdAt: string;
  usedAt?: string;
}

export interface Session {
  id: string;
  token: string;
  userId: string;
  role: UserRole;
  expiresAt: string;
  createdAt: string;
}

export interface OtpRecord {
  id: string;
  identifier: string;
  otpHash: string;
  purpose: 'LOGIN' | 'ADMIN_SETUP' | 'PASSWORD_RESET';
  expiresAt: string;
  verified: boolean;
  attempts: number;
  createdAt: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  customerId: string; // MIM-0001
  fullName: string;
  profilePhoto?: string;
  dob: string;
  gender: Gender;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  pan: string;
  aadhaar: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: AccountType;
  status: 'Active' | 'Archived';
  assignedEmployeeId: string;
  isDeleted: boolean;
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
  gender: Gender;
  mobile?: string;
  isCovered: boolean;
  createdAt: string;
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
  productId: string;
  productType: ProductType;
  reminderType: ReminderType;
  targetDate: string;
  reminderDate: string;
  escalationStage: number; // 10, 5, 2
  idempotencyKey: string;
  cycleKey?: string;
  status: ReminderStatus;
  completedAt?: string;
  completedMethod?: 'CALL' | 'WHATSAPP';
  completionNotes?: string;
  createdAt: string;
}

export interface ReminderDelivery {
  id: string;
  reminderId: string;
  channel: DeliveryChannel;
  recipientMobile: string;
  messageContent: string;
  status: DeliveryStatus;
  providerResponse?: string;
  providerMessageId?: string;
  sentAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface CustomerDocument {
  id: string;
  customerId: string;
  title: string;
  category: DocumentCategory;
  filePath: string;
  fileName: string;
  fileType: DocumentFileType;
  fileSize: number;
  mimeType: string;
  version: number;
  uploadedByUserId: string;
  createdAt: string;
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

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entity?: string;
  entityType?: string;
  entityId: string;
  details?: string;
  createdAt: string;
  timestamp?: string;
}

export interface MessagingProviderSettings {
  providerName: string;
  apiKey: string;
  senderId?: string;
  phoneNumberId?: string;
  enabled: boolean;
}

export interface BusinessSettings {
  id?: string;
  businessName: string;
  tagline?: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsappNumber?: string;
  address?: string;
  lastBackupAt?: string;
  businessContactNumber?: string;
  businessEmail?: string;
  senderName?: string;
  timezone?: string;
  reminderTime?: string;
  backupFrequency?: string;
  smsProvider?: MessagingProviderSettings;
  whatsappProvider?: MessagingProviderSettings;
}

export interface ReminderDelivery {
  id: string;
  reminderId: string;
  channel: DeliveryChannel;
  recipientMobile: string;
  messageContent: string;
  status: DeliveryStatus;
  providerResponse?: string;
  providerMessageId?: string;
  sentAt?: string;
  errorMessage?: string;
  errorDetails?: string;
  createdAt: string;
}
