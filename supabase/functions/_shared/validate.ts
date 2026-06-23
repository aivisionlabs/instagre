export function normalizeMobile(mobile: string): string {
  return mobile.replace(/\D/g, '');
}

export function isValidMobile(mobile: string): boolean {
  return /^[0-9]{6,15}$/.test(mobile);
}

export function isValidDob(dob: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dob) && !Number.isNaN(Date.parse(dob));
}

export interface UserProfilePayload {
  fullName: string;
  dob: string;
  mobile: string;
  createdAt: string;
}

export interface AppUserProfileRow {
  mobile: string;
  full_name: string;
  dob: string;
  created_at: string;
}

export function rowToProfile(row: AppUserProfileRow): UserProfilePayload {
  return {
    fullName: row.full_name,
    dob: row.dob,
    mobile: row.mobile,
    createdAt: row.created_at,
  };
}
