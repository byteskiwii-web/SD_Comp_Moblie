import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { SkeletonRows } from '../../components/Skeleton';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { getApiErrorMessage } from '../../api/client';
import { getHealthDeps } from '../../api/verification.api';
import {
  DOC_TYPE_KEY,
  documentViewUrl,
  downloadDocumentToCache,
  getMyDocuments,
  type DocType,
  type DocumentStatus,
  type EmployeeDocument,
} from '../../api/documents.api';
import { formatDate } from '../../utils/datetime';
import { t as tr, useT, type TKey } from '../../i18n';
import { useAuthStore } from '../../stores/authStore';
import { useAuthedImage } from '../../hooks/useAuthedImage';

/**
 * Where each of your documents has got to. READ ONLY.
 *
 * Uploading moved to the web page HR sends with the joining credentials, and
 * this app no longer collects identity documents at all -- a deliberate
 * narrowing, so the Play Store listing does not have to justify collecting
 * PAN and Aadhaar images on a phone.
 *
 * What stays is the answer to the question the phone is actually good for:
 * did it arrive, was it accepted, and if not, why. An employee who learns
 * their Aadhaar was rejected needs the reason here, then goes to the same web
 * page to send a better photograph. Viewing what was already sent stays too
 * -- it is a read, and it is how somebody checks they sent the right side of
 * a passbook.
 *
 * The documents router is mounted only where Drive storage is configured, so
 * this asks `/health/deps` first and says plainly when the feature is off.
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

const HINT_KEY: Partial<Record<DocType, TKey>> = {
  cancelled_cheque: 'docs.cheque',
  bank_passbook: 'docs.aadhaar',
};

function statusTone(colors: ColorScheme): Record<DocumentStatus, { bg: string; fg: string; key: TKey }> {
  return {
    uploaded: { bg: colors.warningBg, fg: colors.warningText, key: 'status.inReview' },
    verified: { bg: colors.successBg, fg: colors.successText, key: 'status.verified' },
    rejected: { bg: colors.dangerBg, fg: colors.dangerText, key: 'status.rejected' },
  };
}

export function DocumentsCard() {
  const [error, setError] = useState<string | null>(null);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const STATUS_TONE = useMemo(() => statusTone(colors), [colors]);

  const deps = useQuery({ queryKey: ['health-deps'], queryFn: getHealthDeps, retry: false });
  const enabled = deps.data?.dependencies?.documents === 'enabled';

  const docsQuery = useQuery({
    queryKey: ['my-documents'],
    queryFn: getMyDocuments,
    enabled,
    retry: false,
  });

  /*
   * VIEWING WHAT YOU SENT.
   *
   * The card listed a file name and offered to replace or delete it, and gave
   * no way to look at it -- so the only way to check you had uploaded the
   * right side of a passbook was to upload it again.
   *
   * Two paths, because the runtime has one renderer and not the other. An
   * image is drawn in place, with the session on the request exactly as the
   * profile photo is. A PDF cannot be drawn by this app at all, so it is
   * fetched to the cache and handed to whatever the phone uses for PDFs.
   */
  const token = useAuthStore((st) => st.token);
  const [viewing, setViewing] = useState<EmployeeDocument | null>(null);
  /* Fetched with the bearer into the cache and drawn from there: Android's
     image loader does not reliably send the header itself. */
  const { uri: viewingUri } = useAuthedImage(
    viewing ? documentViewUrl(viewing.id) : null,
    viewing ? `document-${viewing.id}-${viewing.uploadedAt}.img` : null
  );
  const [opening, setOpening] = useState<string | null>(null);

  const openDocument = async (doc: EmployeeDocument) => {
    setError(null);
    if ((doc.contentType ?? '').startsWith('image/')) {
      setViewing(doc);
      return;
    }
    if (!token) return;
    setOpening(doc.id);
    try {
      const uri = await downloadDocumentToCache(doc.id, doc.fileName ?? `document_${doc.id}`, token);
      if (!(await Sharing.isAvailableAsync())) {
        setError(tr('docs.cannotOpen'));
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: doc.contentType ?? 'application/pdf',
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setOpening(null);
    }
  };

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

  /* Missing or turned down -- the two states the employee can still do
     something about, and the only reason to point them at the web page. */
  const outstanding = OFFERED.some((type) => {
    const doc = latest.get(type);
    return !doc || doc.status === 'rejected';
  });

  if (deps.isLoading) {
    return (
      <Card>
        <Text style={styles.cardTitle}>{t('docs.statusTitle')}</Text>
        <SkeletonRows count={3} />
      </Card>
    );
  }

  if (!enabled) {
    return (
      <Card>
        <Text style={styles.cardTitle}>{t('docs.statusTitle')}</Text>
        <Text style={styles.off}>
          {t('docs.disabled')}
        </Text>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <Text style={styles.cardTitle}>{t('docs.statusTitle')}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {docsQuery.isLoading ? (
        <SkeletonRows count={4} />
      ) : (
        OFFERED.map((type, i) => {
          const doc = latest.get(type);
          // A status this build has no tone for is shown without a chip rather
          // than read off the end of the map: an unknown value added server-side
          // must not be able to blank the screen.
          const tone = doc ? STATUS_TONE[doc.status] ?? null : null;

          return (
            <View key={type} style={[styles.row, i === OFFERED.length - 1 && styles.rowLast]}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{t(DOC_TYPE_KEY[type])}</Text>
                {doc ? (
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {doc.fileName ?? t('docs.attached')} · {formatDate(doc.uploadedAt)}
                  </Text>
                ) : HINT_KEY[type] ? (
                  <Text style={styles.rowHint} numberOfLines={2}>
                    {t(HINT_KEY[type] as TKey)}
                  </Text>
                ) : null}
                {doc?.status === 'rejected' && doc.rejectionReason ? (
                  <Text style={styles.rejected}>{doc.rejectionReason}</Text>
                ) : null}
              </View>

              {tone ? (
                <View style={[styles.chip, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.chipText, { color: tone.fg }]}>{t(tone.key)}</Text>
                </View>
              ) : null}

              {/* Viewing is allowed in every state, verified included: a
                  document HR has accepted is still the employee's to look at,
                  and that is the one they are most likely to want to check. */}
              {doc ? (
                <Pressable
                  onPress={() => void openDocument(doc)}
                  disabled={opening === doc.id}
                  hitSlop={6}
                  style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('docs.viewLabel', { name: t(DOC_TYPE_KEY[type]) })}
                >
                  {opening === doc.id ? (
                    <ActivityIndicator size="small" color={colors.brand[700]} />
                  ) : (
                    <Ionicons name="eye-outline" size={17} color={colors.brand[700]} />
                  )}
                  <Text style={styles.actionText}>{t('docs.view')}</Text>
                </Pressable>
              ) : null}

              {/* Nothing here uploads any more. A document that is missing or
                  was turned down is fixed on the web page HR sent with the
                  joining credentials -- said once at the foot of the card
                  rather than as a dead button on every row. */}
            </View>
          );
        })
      )}

      {/* The one instruction this screen still needs to carry: where the
          uploading happens now. Shown whenever anything is outstanding, so a
          complete set is not nagged at. */}
      {outstanding ? <Text style={styles.consent}>{t('docs.uploadOnWeb')}</Text> : null}

    </Card>

      {/* Full screen, dark, dismissed by a tap anywhere: an identity document
          is read by zooming into a corner of it, not by admiring it in a card.
          The URL is proxied through the API and carries no session of its
          own, so the bytes come via useAuthedImage. */}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewing(null)}>
          {viewing && viewingUri ? (
            <Image
              source={{ uri: viewingUri }}
              style={styles.viewerImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : null}
          <Text style={styles.viewerHint}>{tr('common.close')}</Text>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    viewerBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.92)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      gap: 14,
    },
    viewerImage: { width: '100%', height: '82%' },
    viewerHint: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', opacity: 0.75 },
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
