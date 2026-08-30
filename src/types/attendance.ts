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
