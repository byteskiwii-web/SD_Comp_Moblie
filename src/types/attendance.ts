export type MarkType = 'clock-in' | 'clock-out' | '2hr-check' | 'break-start' | 'break-end';
export type ApprovalStatus = 'auto-approved' | 'pending-approval' | 'approved' | 'rejected';

export type AttendanceMark = {
  /**
   * A STRING, not a number. Since backend migration 048 this column is
   * `bigint`, and the driver returns bigint as a JSON string because a
   * JavaScript number silently loses precision above 2^53. Treat it as
   * opaque: compare as a string, never do arithmetic on it, and send it
   * back exactly as it arrived.
   */
  id: string;
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
  /** Clock-in only: minutes past the shift start beyond the grace; 0 when on time. */
  lateByMinutes?: number;
  /** Clock-out only: minutes past the rostered end; 0 within the shift. */
  pastEndMinutes?: number;
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
//
// The API shapes every response to camelCase (regularisation.service.js's
// `shape()`) even though the request body stays snake_case -- see
// submitRegularisation/getMyRegularisations in attendance.api.ts.
// employeeName/storeName are present on list/get (joined in for a reviewer's
// queue) and absent (undefined) on submit/decide's response, which returns
// the bare row.
export type Regularisation = {
  id: string;
  employeeId: string;
  employeeName?: string;
  storeCode: string;
  storeName?: string;
  markDate: string;
  requestType: RegularisationRequestType;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  reason: string;
  status: RegularisationStatus;
  createdAt: string;
  createdBy: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
};
