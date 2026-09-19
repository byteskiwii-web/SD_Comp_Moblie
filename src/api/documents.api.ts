import { API_V1 } from '../constants/config';
import { File, Paths } from 'expo-file-system';
import { apiClient } from './client';

/**
 * Document upload.
 *
 * The whole router is mounted only when Drive storage is configured on the
 * server, so every path here can legitimately 404 on a healthy deployment.
 * `/health/deps` reports `documents: enabled | disabled`, and the UI checks it
 * before offering an upload — a 404 with no explanation reads as a broken app
 * rather than as a feature nobody has switched on.
 */

export type DocType =
  | 'aadhaar'
  | 'pan'
  | 'bank_passbook'
  | 'cancelled_cheque'
  | 'photo'
  | 'address_proof'
  | 'other';

/** Catalogue keys, not text -- a module constant would freeze the language. */
export const DOC_TYPE_KEY = {
  aadhaar: 'docType.aadhaar',
  pan: 'docType.pan',
  bank_passbook: 'docType.bank_passbook',
  cancelled_cheque: 'docType.cancelled_cheque',
  photo: 'docType.photo',
  address_proof: 'docType.address_proof',
  other: 'docType.other',
} as const;

/**
 * Server-side vocabulary, not a prettier local one. A freshly uploaded
 * document is `uploaded` — it is awaiting review, but the column has never
 * held the word `pending`, and translating the name here is how the two
 * drifted apart in the first place.
 */
export type DocumentStatus = 'uploaded' | 'verified' | 'rejected';

/** Field-for-field what `toPublicDocument` on the server returns. */
export type EmployeeDocument = {
  id: string;
  employeeId?: string;
  docType: DocType;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  /** Masked at rest — the raw identifier is never persisted. */
  maskedNumber: string | null;
  status: DocumentStatus;
  uploadedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

/** What a picker hands back, whichever picker it was. */


/**
 * One's own documents. A reviewer's queue is a different endpoint.
 *
 * The list endpoint answers `data: { employeeId, documents }`, not a bare
 * array — the employee id matters to a reviewer fetching somebody else's
 * list. Reading `data` as the array itself handed the caller an object, and
 * iterating an object throws rather than reading as empty, which took the
 * whole Profile screen down the day Drive storage was first switched on. The
 * array form is still accepted so a future envelope change cannot repeat it.
 */
/** A file the employee chose, in the shape the photo upload wants. */
export type PickedFile = { uri: string; name: string; mimeType: string };

export async function getMyDocuments(): Promise<EmployeeDocument[]> {
  const res = await apiClient.get<{
    success: true;
    data: { employeeId: string; documents: EmployeeDocument[] } | EmployeeDocument[];
  }>('/documents');
  const data = res.data?.data;
  if (Array.isArray(data)) return data;
  const documents = data?.documents;
  return Array.isArray(documents) ? documents : [];
}

/**
 * Where the stored file can be read.
 *
 * Proxied through the API, exactly like the profile photo: the bytes live in
 * Drive, but every read goes through the session so the same authority check
 * applies. That also means the URL is useless on its own -- whatever renders
 * it has to send the bearer token with it.
 */
export function documentViewUrl(id: string): string {
  return `${API_V1}/documents/${encodeURIComponent(id)}/view`;
}

/**
 * The same file, but on disk.
 *
 * An <Image> can carry an Authorization header, so a picture needs no copy.
 * A PDF cannot be drawn by this app at all -- there is no PDF renderer in the
 * Expo Go runtime -- so it has to be handed to something that can, and the
 * OS will only open a file it can reach. Hence: fetch it with the session,
 * write it to the cache, return the path.
 *
 * Cache, not documents: this is a convenience copy of something the server
 * already holds, and the OS is free to reclaim it.
 */
export async function downloadDocumentToCache(
  id: string,
  fileName: string,
  token: string
): Promise<string> {
  // File.downloadFileAsync takes the headers itself, so the bytes go straight
  // from the socket to the disk. The alternative -- pulling an ArrayBuffer
  // through axios and encoding it by hand -- needs Buffer or btoa, and this
  // runtime is not guaranteed to have either.
  const safe = fileName.replace(/[^\w.\-]/g, '_') || `document_${id}`;
  const file = await File.downloadFileAsync(
    documentViewUrl(id),
    new File(Paths.cache, safe),
    { headers: { Authorization: `Bearer ${token}` }, idempotent: true }
  );
  return file.uri;
}
