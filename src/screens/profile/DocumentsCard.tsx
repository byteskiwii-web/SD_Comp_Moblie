import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { SkeletonRows } from '../../components/Skeleton';
import { FilePickerSheet } from '../../components/FilePickerSheet';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { getApiErrorMessage } from '../../api/client';
import { getHealthDeps } from '../../api/verification.api';
import {
  DOC_TYPE_LABEL,
  deleteDocument,
  getMyDocuments,
  uploadDocument,
  type DocType,
  type DocumentStatus,
  type EmployeeDocument,
  type PickedFile,
} from '../../api/documents.api';
import { formatDate } from '../../utils/datetime';

/**
 * Supporting documents.
 *
 * Every type the server accepts, so nothing an employee is asked for has to
 * be emailed instead. The four KYC ones lead; `photo`, `address_proof` and
 * `other` follow, which is roughly the order they get requested in.
 *
 * The whole documents router is mounted only where Drive storage is
 * configured, so this asks `/health/deps` first and says plainly when the
 * feature is off. Offering an upload button that 404s would read as a broken
 * app rather than as something nobody has switched on yet.
 */

const OFFERED: DocType[] = [
  'aadhaar',
  'pan',
  'bank_passbook',
  'cancelled_cheque',
  'photo',
  'address_proof',
  'other',
];

const HINT: Partial<Record<DocType, string>> = {
  cancelled_cheque: 'Shows your account number and IFSC as the bank prints them',
  bank_passbook: 'The page with your name and account number',
};

function statusTone(colors: ColorScheme): Record<DocumentStatus, { bg: string; fg: string; label: string }> {
  return {
    pending: { bg: colors.warningBg, fg: colors.warningText, label: 'In review' },
    verified: { bg: colors.successBg, fg: colors.successText, label: 'Verified' },
    rejected: { bg: colors.dangerBg, fg: colors.dangerText, label: 'Rejected' },
  };
}

export function DocumentsCard() {
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState<DocType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const STATUS_TONE = useMemo(() => statusTone(colors), [colors]);

  const deps = useQuery({ queryKey: ['health-deps'], queryFn: getHealthDeps, retry: false });
  const enabled = deps.data?.dependencies?.documents === 'enabled';

  const docsQuery = useQuery({
    queryKey: ['my-documents'],
    queryFn: getMyDocuments,
    enabled,
    retry: false,
  });

  const upload = useMutation({
    mutationFn: (input: { file: PickedFile; docType: DocType }) =>
      uploadDocument({ file: input.file, docType: input.docType }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['my-documents'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-documents'] }),
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  // Newest per type. Re-uploading after a rejection should show the new file,
  // not the one that was turned down.
  const latest = useMemo(() => {
    const byType = new Map<DocType, EmployeeDocument>();
    for (const d of docsQuery.data ?? []) {
      const held = byType.get(d.docType);
      if (!held || d.uploadedAt > held.uploadedAt) byType.set(d.docType, d);
    }
    return byType;
  }, [docsQuery.data]);

  if (deps.isLoading) {
    return (
      <Card>
        <Text style={styles.cardTitle}>Documents</Text>
        <SkeletonRows count={3} />
      </Card>
    );
  }

  if (!enabled) {
    return (
      <Card>
        <Text style={styles.cardTitle}>Documents</Text>
        <Text style={styles.off}>
          Document upload isn't switched on yet. Your HR team will ask for these directly for now.
        </Text>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.cardTitle}>Documents</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {docsQuery.isLoading ? (
        <SkeletonRows count={4} />
      ) : (
        OFFERED.map((type, i) => {
          const doc = latest.get(type);
          const tone = doc ? STATUS_TONE[doc.status] : null;
          const busy = upload.isPending && picking === type;

          return (
            <View key={type} style={[styles.row, i === OFFERED.length - 1 && styles.rowLast]}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{DOC_TYPE_LABEL[type]}</Text>
                {doc ? (
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {doc.fileName ?? 'Attached'} · {formatDate(doc.uploadedAt)}
                  </Text>
                ) : HINT[type] ? (
                  <Text style={styles.rowHint} numberOfLines={2}>
                    {HINT[type]}
                  </Text>
                ) : null}
                {doc?.status === 'rejected' && doc.rejectionReason ? (
                  <Text style={styles.rejected}>{doc.rejectionReason}</Text>
                ) : null}
              </View>

              {tone ? (
                <View style={[styles.chip, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.chipText, { color: tone.fg }]}>{tone.label}</Text>
                </View>
              ) : null}

              {/* A verified document is HR's record now -- replacing it is a
                  conversation, not a button. Everything else can be redone. */}
              {doc?.status === 'verified' ? null : (
                <Pressable
                  onPress={() => {
                    setError(null);
                    setPicking(type);
                  }}
                  disabled={busy}
                  style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${doc ? 'Replace' : 'Upload'} ${DOC_TYPE_LABEL[type]}`}
                >
                  <Ionicons
                    name={busy ? 'cloud-upload-outline' : doc ? 'refresh-outline' : 'add-circle-outline'}
                    size={17}
                    color={colors.brand[700]}
                  />
                  <Text style={styles.actionText}>{busy ? 'Sending…' : doc ? 'Replace' : 'Upload'}</Text>
                </Pressable>
              )}

              {doc && doc.status !== 'verified' ? (
                <Pressable
                  onPress={() => remove.mutate(doc.id)}
                  hitSlop={8}
                  style={styles.removeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${DOC_TYPE_LABEL[type]}`}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.slate400} />
                </Pressable>
              ) : null}
            </View>
          );
        })
      )}

      <Text style={styles.consent}>
        Uploading shares the document with your HR team for verification. The number on it is masked before
        it is stored.
      </Text>

      <FilePickerSheet
        visible={picking !== null}
        title={picking ? `Attach ${DOC_TYPE_LABEL[picking].toLowerCase()}` : 'Attach a document'}
        onClose={() => setPicking(null)}
        onPicked={(file) => {
          const type = picking;
          setPicking(null);
          if (type) upload.mutate({ file, docType: type });
        }}
      />
    </Card>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    cardTitle: {
      fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
      color: colors.slate500, marginBottom: 10,
    },
    off: { fontSize: 11.5, color: colors.slate400, lineHeight: 17 },
    error: { fontSize: 11.5, color: colors.dangerText, fontWeight: '600', marginBottom: 8 },

    row: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.slate100,
    },
    rowLast: { borderBottomWidth: 0 },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 12.5, fontWeight: '700', color: colors.textLight },
    rowMeta: { fontSize: 10.5, color: colors.slate400, marginTop: 2 },
    rowHint: { fontSize: 10.5, color: colors.slate400, marginTop: 2, lineHeight: 14 },
    rejected: { fontSize: 10.5, color: colors.dangerText, marginTop: 3, fontWeight: '600' },

    chip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.sm },
    chipText: { fontSize: 9.5, fontWeight: '800' },

    action: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    actionPressed: { opacity: 0.6 },
    actionText: { fontSize: 11, fontWeight: '800', color: colors.brand[700] },
    removeBtn: { paddingLeft: 2 },

    consent: { fontSize: 10.5, color: colors.slate400, marginTop: 12, lineHeight: 15 },
  });
}
