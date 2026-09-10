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

export type DocumentStatus = 'pending' | 'verified' | 'rejected';

export type EmployeeDocument = {
  id: string;
  docType: DocType;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Masked at rest — the raw identifier is never persisted. */
  numberMasked: string | null;
  status: DocumentStatus;
  uploadedAt: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
};

/** What a picker hands back, whichever picker it was. */
export type PickedFile = { uri: string; name: string; mimeType: string };

/**
 * Upload one file.
 *
 * multipart/form-data, built by hand rather than through a helper: React
 * Native's FormData takes `{ uri, name, type }` for a file part, which is not
 * the web shape and does not survive being passed through a generic
 * serialiser.
 *
 * Content-Type is deliberately NOT set. The runtime has to append its own
 * multipart boundary, and setting the header manually strips it — the request
 * then arrives as an unparseable body and the server rejects it as having no
 * file at all.
 */
export async function uploadDocument(input: {
  file: PickedFile;
  docType: DocType;
  number?: string;
}): Promise<EmployeeDocument> {
  const form = new FormData();
  form.append('file', {
    uri: input.file.uri,
    name: input.file.name,
    type: input.file.mimeType,
  } as unknown as Blob);
  form.append('doc_type', input.docType);
  // The server treats consent as a precondition: without it the file never
  // reaches storage. The screen only calls this once its own consent line has
  // been shown and accepted.
  form.append('consent', 'y');
  if (input.number) form.append('number', input.number);

  const res = await apiClient.post<{ success: true; data: EmployeeDocument }>('/documents', form);
  return res.data.data;
}

/** One's own documents. A reviewer's queue is a different endpoint. */
export async function getMyDocuments(): Promise<EmployeeDocument[]> {
  const res = await apiClient.get<{ success: true; data: EmployeeDocument[] }>('/documents');
  return res.data.data ?? [];
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`);
}
