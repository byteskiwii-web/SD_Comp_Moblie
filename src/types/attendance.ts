export type MarkType = 'clock-in' | 'clock-out' | '2hr-check' | 'break-start' | 'break-end';
export type ApprovalStatus = 'auto-approved' | 'pending-approval' | 'approved' | 'rejected';

export type AttendanceMark = {
  id: number;
  employee_id: string;
  store_code: string;
  mark_date: string;
  mark_type: MarkType;
  timestamp: string;
  client_timestamp: string | null;
  latitude: string | null;
  longitude: string | null;
  inside_geofence: boolean | null;
  distance_from_site_m: number | null;
  photo_url: string | null;
  photo_thumbnail_url: string | null;
  approval_status: ApprovalStatus;
  store_name?: string;
  store_city?: string;
};

export type GeofenceResult = {
  insideFence: boolean | null;
  distanceMetres: number | null;
  radiusMetres: number;
  storeName?: string;
};

export type PunchResult = {
  attendance: AttendanceMark;
  geofence: GeofenceResult;
};

export type LocationCheckResult = {
  insideFence: boolean;
  distanceMetres: number;
  radiusMetres: number;
  storeName: string;
  checkedAt: string;
};

export type MonthlySummary = {
  month: string; // "YYYY-MM"
  workingDays: number;
  presentDays: number;
  absentDays: number;
  sundaysExcluded: number;
};

export type RegularisationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type RegularisationRequestType = 'adjust' | 'other';

// This table alone uses a UUID primary key (pre-existing schema decision by
// another contributor) -- every other id in this app's types is a number or
// an employee/store code string.
export type Regularisation = {
  id: string;
  org_id: string;
  employee_id: string;
  store_code: string;
  mark_date: string;
  request_type: RegularisationRequestType;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  reason: string;
  status: RegularisationStatus;
  created_at: string;
  created_by: string | null;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
};
