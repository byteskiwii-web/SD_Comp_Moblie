import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHealthDeps, getKycStatus } from '../../api/verification.api';
import { getMyDocuments, type DocType, type EmployeeDocument } from '../../api/documents.api';
import { getPolicies } from '../../api/policies.api';
import { LANGUAGES, usePreferencesStore } from '../../stores/preferencesStore';
import { useAuthStore } from '../../stores/authStore';

/**
 * What each Profile menu row says beside its chevron.
 *
 * The hub shows a one-word state per topic — Pending, 2 to upload, 1 to
 * read — and nothing else, so that moving the topics off the page does not
 * also move their problems out of sight. The rules here decide the word;
 * the row decides the colour from `tone`.
 *
 * Same query keys as the section screens (`profile-kyc-status`,
 * `my-documents`, `policies-library`), so React Query serves both from one
 * cache entry: opening a section costs nothing the hub has not already paid,
 * and a change made inside a section (an upload, an acknowledgement) is
 * reflected on the hub the moment the person comes back.
 */
export type SummaryTone = 'success' | 'warning' | 'danger' | 'slate';
export type Summary = { tone: SummaryTone; count?: number; state: string };

/**
 * The documents a person is expected to have. `other` is a catch-all and
 * never counts as missing; the bank proof is one OR the other. Mirrors what
 * HR chases first — the same three plus a bank proof — rather than every
 * type the picker offers.
 */
const CORE: DocType[] = ['aadhaar', 'pan', 'photo', 'address_proof'];

function latestByType(docs: EmployeeDocument[] | undefined) {
  const byType = new Map<DocType, EmployeeDocument>();
  for (const d of docs ?? []) {
    const held = byType.get(d.docType);
    if (!held || d.uploadedAt > held.uploadedAt) byType.set(d.docType, d);
  }
  return byType;
}

export function useProfileSummary() {
  const employee = useAuthStore((s) => s.employee);
  const profile = useAuthStore((s) => s.profile);
  const language = usePreferencesStore((s) => s.language);
  const worksAtSite = Boolean(employee?.store_code);

  const kyc = useQuery({
    queryKey: ['profile-kyc-status', employee?.id],
    queryFn: getKycStatus,
    enabled: worksAtSite,
    retry: false,
  });
  const deps = useQuery({ queryKey: ['health-deps'], queryFn: getHealthDeps, retry: false });
  const docsEnabled = deps.data?.dependencies?.documents === 'enabled';
  const docs = useQuery({ queryKey: ['my-documents'], queryFn: getMyDocuments, enabled: docsEnabled, retry: false });
  const policies = useQuery({ queryKey: ['policies-library'], queryFn: () => getPolicies(50) });

  return useMemo(() => {
    // Identity: any check not yet verified is the headline, failed beats pending.
    let identity: Summary | null = null;
    const k = kyc.data?.kyc;
    if (worksAtSite && k) {
      const statuses = [k.pan.status, k.aadhaar.status, k.bank.status];
      if (statuses.some((s) => s === 'failed')) identity = { tone: 'danger', state: 'failed' };
      else if (statuses.some((s) => s !== 'verified')) identity = { tone: 'warning', state: 'pending' };
      else identity = { tone: 'success', state: 'verified' };
    }

    // Documents: a rejection needs a person; a gap needs a file; otherwise it is HR's turn.
    let documents: Summary | null = null;
    if (docsEnabled && docs.data) {
      const latest = latestByType(docs.data);
      const rejected = [...latest.values()].filter((d) => d.status === 'rejected').length;
      const hasBankProof = latest.has('bank_passbook') || latest.has('cancelled_cheque');
      const missing = CORE.filter((t) => !latest.has(t)).length + (hasBankProof ? 0 : 1);
      const inReview = [...latest.values()].some((d) => d.status === 'uploaded');
      if (rejected > 0) documents = { tone: 'danger', count: rejected, state: 'rejected' };
      else if (missing > 0) documents = { tone: 'warning', count: missing, state: 'missing' };
      else if (inReview) documents = { tone: 'warning', state: 'inReview' };
      else documents = { tone: 'success', state: 'complete' };
    }

    // Policies: how many still need reading.
    let policy: Summary | null = null;
    const items = policies.data?.items ?? [];
    if (items.length > 0) {
      const unread = items.filter((p) => !p.acknowledgedByMe).length;
      policy = unread > 0 ? { tone: 'warning', count: unread, state: 'toRead' } : { tone: 'success', state: 'allRead' };
    }

    // Kit: the size is the employee's answer; the rest is HR's.
    let kit: Summary | null = null;
    if (profile) {
      if (!profile.shirtSize) kit = { tone: 'warning', state: 'chooseSize' };
      else if (profile.welcomeKitIssued) kit = { tone: 'success', state: 'issued' };
      else kit = { tone: 'slate', state: 'submitted' };
    }

    const languageLabel = LANGUAGES.find((l) => l.code === language)?.native ?? language;

    /** Everything that needs the person, for the strip at the top. */
    const attention =
      (identity && identity.tone !== 'success' ? 1 : 0) +
      (documents && documents.tone !== 'success' && documents.state !== 'inReview' ? 1 : 0) +
      (policy && policy.tone !== 'success' ? 1 : 0) +
      (kit && kit.state === 'chooseSize' ? 1 : 0);

    return { worksAtSite, identity, documents, policy, kit, languageLabel, attention, shirtSize: profile?.shirtSize ?? null };
  }, [worksAtSite, kyc.data, docsEnabled, docs.data, policies.data, profile, language]);
}
