import React from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ProfilePhoto } from './ProfilePhoto';
import { TourScrollView, TourTarget } from '../../components/tour/TourTarget';
import { storeLabel } from '../../utils/store';
import { useTourStore } from '../../stores/tourStore';
import { useShiftStore } from '../../stores/shiftStore';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { useT, type TKey } from '../../i18n';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { GreetingHeader } from '../../components/GreetingHeader';
import { BuildStamp } from '../../components/BuildStamp';
import { useProfileSummary, type SetupTask, type Summary } from './useProfileSummary';
import type { ProfileStackParamList } from '../../navigation/types';

const ROLE_LABEL: Record<string, string> = {
  'field-employee': 'role.field-employee',
  'team-lead': 'role.team-lead',
  'site-manager': 'role.site-manager',
  'cluster-manager': 'role.cluster-manager',
  'hr-manager': 'role.hr-manager',
  'super-admin': 'role.super-admin',
};

type Route = keyof ProfileStackParamList;

/**
 * Profile: the hub.
 *
 * This used to be one page with twelve cards on it — contact rows, policies,
 * nine language tiles, gender, two managers, three KYC checks, eight document
 * uploads, the shirt size, the tour, sign out, legal, deletion — and its own
 * comments record cards being "moved up because nobody scrolled far enough
 * to see it". Now it is who you are, then a settings-style list: one row per
 * topic, each opening a screen that holds the same card it always did.
 *
 * WHAT THE ROWS SAY. Moving a topic off the page must not move its problem
 * out of sight, so each row carries the one word that matters — Pending,
 * 2 to upload, 1 to read — from useProfileSummary, and a strip above the
 * list counts what needs the person. The list itself needs only the counts;
 * the heavy reads happen when a section opens, and they share cache keys
 * with the hub so nothing is fetched twice.
 *
 * The tour's `profile-top` target stays on the hero, unchanged.
 */
export function ProfileScreen() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const isClockedIn = useShiftStore((s) => s.isClockedIn);
  const startTour = useTourStore((s) => s.start);
  const navigation = useNavigation<any>();
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const summary = useProfileSummary();
  const [refreshing, setRefreshing] = React.useState(false);

  /**
   * Always asks, in the app's own dialog rather than the operating system's.
   *
   * Signing back in is not cheap here: this app binds an account to a single
   * device, so signing out on a shared store phone can leave somebody unable
   * to get back in without HR. The clocked-in case gets the stronger wording,
   * because that one also abandons an open shift — clock-in is held on the
   * device until the matching clock-out is filed, and the employee would find
   * out on payday rather than here.
   */
  const [signOutOpen, setSignOutOpen] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  }, [refreshProfile]);

  const go = (route: Route) => navigation.navigate(route);

  /** What each open set-up task says on the strip. */
  const taskLine = (task: SetupTask): string => {
    switch (task.key) {
      case 'identity': return t('profile.task.identity');
      case 'documents': return summary.documents?.count
        ? t('profile.task.documents', { count: summary.documents.count })
        : t('profile.task.documentsFix');
      case 'policies': return t('profile.task.policies', { count: summary.policy?.count ?? 0 });
      case 'kit': return t('profile.task.kit');
      default: return '';
    }
  };
  const openTasks = summary.tasks.filter((task) => !task.done);
  const doneCount = summary.tasks.length - openTasks.length;

  const roleLabel = employee?.role
    ? ROLE_LABEL[employee.role] ? t(ROLE_LABEL[employee.role] as TKey) : employee.role
    : '—';
  const posting = [storeLabel(store, ''), profile?.shift?.name].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {/* At the screen root, never inside the ScrollView -- a Modal nested in
          a scroll container renders as a black screen on Android. */}
      <ConfirmDialog
        visible={signOutOpen}
        tone="danger"
        title={t(isClockedIn ? 'profile.signOutShiftTitle' : 'profile.signOutTitle')}
        body={t(isClockedIn ? 'profile.signOutShiftBody' : 'profile.signOutBody')}
        confirmLabel={t('common.signOut')}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => { setSignOutOpen(false); void signOut(); }}
      />

      <GreetingHeader />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
      </View>
      <TourScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[700]} />}
      >
        <TourTarget id="profile-top" style={styles.heroCard}>
          <ProfilePhoto />
          <Text style={styles.name}>
            {employee?.first_name} {employee?.last_name}
          </Text>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{employee?.id}</Text>
            </View>
            <View style={[styles.pill, styles.pillBrand]}>
              <Text style={[styles.pillText, styles.pillTextBrand]}>{roleLabel}</Text>
            </View>
          </View>
          {posting ? (
            <Text style={styles.posting} numberOfLines={1}>{posting}</Text>
          ) : null}
        </TourTarget>

        {/* THE SET-UP CHECKLIST. Only while something is open -- a strip that
            is always there is wallpaper by the second day. It names each
            task and takes the person straight to it, and the count is over
            a fixed list, so finishing one visibly moves it: "1 of 4 done",
            then "2 of 4". It used to say "3 things need your attention" and
            open one page, which read as being sent somewhere at random. */}
        {openTasks.length > 0 ? (
          <View style={styles.attention}>
            <View style={styles.attentionHead}>
              <Ionicons name="alert-circle" size={18} color={colors.warningText} />
              <Text style={styles.attentionTitle}>{t('profile.setupTitle')}</Text>
              <Text style={styles.attentionCount}>
                {t('profile.setupProgress', { done: doneCount, total: summary.tasks.length })}
              </Text>
            </View>
            {openTasks.map((task) => (
              <Pressable
                key={task.key}
                onPress={() => go(task.route)}
                style={({ pressed }) => [styles.attentionRow, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <View style={styles.attentionDot} />
                <Text style={styles.attentionText} numberOfLines={1}>{taskLine(task)}</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.warningText} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <Group title={t('profile.group.work')}>
          <MenuRow icon="business-outline" label={t('profile.menu.work')} hint={t('profile.menu.workHint')} onPress={() => go('WorkDetails')} last />
        </Group>

        <Group title={t('profile.group.identity')}>
          {summary.worksAtSite ? (
            <MenuRow
              icon="shield-checkmark-outline"
              label={t('kyc.title')}
              status={summary.identity}
              statusText={summaryText(summary.identity, t)}
              onPress={() => go('Identity')}
            />
          ) : null}
          <MenuRow
            icon="folder-open-outline"
            label={t('docs.statusTitle')}
            status={summary.documents}
            statusText={summaryText(summary.documents, t)}
            onPress={() => go('Documents')}
            last
          />
        </Group>

        <Group title={t('profile.group.about')}>
          <MenuRow icon="person-outline" label={t('personal.title')} onPress={() => go('Personal')} />
          <MenuRow
            icon="shirt-outline"
            label={t('kit.title')}
            status={summary.kit}
            statusText={summaryText(summary.kit, t, summary.shirtSize)}
            onPress={() => go('Kit')}
            last
          />
        </Group>

        <Group title={t('profile.group.company')}>
          <MenuRow
            icon="document-text-outline"
            label={t('profile.policies')}
            status={summary.policy}
            statusText={summaryText(summary.policy, t)}
            onPress={() => go('Policies')}
            last
          />
        </Group>

        <Group title={t('profile.group.app')}>
          <MenuRow icon="language-outline" label={t('profile.menu.prefs')} value={summary.languageLabel} onPress={() => go('Preferences')} />
          <MenuRow icon="sparkles-outline" label={t('home.replayTour')} onPress={startTour} last />
        </Group>

        <Group title={t('profile.group.account')}>
          <MenuRow icon="lock-closed-outline" label={t('profile.menu.account')} hint={t('profile.menu.accountHint')} onPress={() => go('Account')} />
          <MenuRow icon="log-out-outline" label={t('common.signOut')} danger onPress={() => setSignOutOpen(true)} last />
        </Group>

        {/* Which code this phone is running, and on an installed app a way
            to pull the latest now. See BuildStamp. */}
        <BuildStamp />
      </TourScrollView>
    </SafeAreaView>
  );
}

/** The word a row shows, from the summary's state. Null summary, no word. */
function summaryText(s: Summary | null, t: ReturnType<typeof useT>, shirtSize?: string | null): string | null {
  if (!s) return null;
  switch (s.state) {
    case 'verified': return t('status.verified');
    case 'pending': return t('status.pending');
    case 'failed': return t('status.failed');
    case 'rejected': return t('profile.badge.rejected', { count: s.count ?? 0 });
    case 'missing': return t('profile.badge.toUpload', { count: s.count ?? 0 });
    case 'inReview': return t('status.inReview');
    case 'complete': return t('profile.badge.complete');
    case 'toRead': return t('profile.badge.toRead', { count: s.count ?? 0 });
    case 'allRead': return t('profile.badge.allRead');
    case 'chooseSize': return t('profile.badge.chooseSize');
    case 'submitted': return shirtSize ? `${shirtSize} · ${t('kit.submitted')}` : t('kit.submitted');
    case 'issued': return shirtSize ? `${shirtSize} · ${t('kit.issued')}` : t('kit.issued');
    default: return null;
  }
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  return (
    <View>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

/**
 * One line of the menu: icon, name, then either a value (the current
 * language), a status chip (Pending), or a hint under the name — and a
 * chevron, unless the row is an action rather than a place.
 */
function MenuRow({
  icon,
  label,
  hint,
  value,
  status,
  statusText,
  danger,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  value?: string;
  status?: Summary | null;
  statusText?: string | null;
  danger?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const chip = status && statusText ? chipTone(status.tone, colors) : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={statusText ? `${label}, ${statusText}` : label}
      style={({ pressed }) => [styles.menuRow, last && styles.menuRowLast, pressed && styles.pressed]}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Ionicons name={icon} size={17} color={danger ? colors.dangerText : colors.brand[700]} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]} numberOfLines={1}>{label}</Text>
        {hint ? <Text style={styles.menuHint} numberOfLines={1}>{hint}</Text> : null}
      </View>
      {chip ? (
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          <Text style={[styles.chipText, { color: chip.fg }]} numberOfLines={1}>{statusText}</Text>
        </View>
      ) : value ? (
        <Text style={styles.menuValue} numberOfLines={1}>{value}</Text>
      ) : null}
      {danger ? null : <Ionicons name="chevron-forward" size={16} color={colors.slate300} style={styles.chevron} />}
    </Pressable>
  );
}

function chipTone(tone: Summary['tone'], colors: ColorScheme) {
  switch (tone) {
    case 'success': return { bg: colors.successBg, fg: colors.successText };
    case 'warning': return { bg: colors.warningBg, fg: colors.warningText };
    case 'danger': return { bg: colors.dangerBg, fg: colors.dangerText };
    default: return { bg: colors.slate100, fg: colors.slate600 };
  }
}

function makeStyles(colors: ColorScheme) {
  const cardShadow = colors.scheme === 'dark'
    ? { shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: colors.slate200 }
    : { shadowOpacity: 0.06, elevation: 2, borderWidth: 0 };
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bgLight },
    header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
    headerTitle: { fontSize: 21, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3 },
    content: { padding: 20, paddingTop: 12, gap: 18, paddingBottom: 32 },
    pressed: { opacity: 0.6 },

    heroCard: { alignItems: 'center', paddingVertical: 8 },
    name: { fontSize: 16.5, fontWeight: '800', color: colors.textLight },
    pillRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    pill: { backgroundColor: colors.slate100, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radii.pill },
    pillBrand: { backgroundColor: colors.brand[50] },
    pillText: { fontSize: 11, fontWeight: '700', color: colors.slate600 },
    pillTextBrand: { color: colors.brand[700] },
    posting: { marginTop: 10, fontSize: 11.5, fontWeight: '600', color: colors.slate500 },

    attention: { backgroundColor: colors.warningBg, borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 10 },
    attentionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    attentionTitle: { flex: 1, fontSize: 12.5, fontWeight: '800', color: colors.warningText },
    attentionCount: { fontSize: 11.5, fontWeight: '800', color: colors.warningText, opacity: 0.85 },
    attentionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 4 },
    attentionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warningText },
    attentionText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: colors.textLight },

    groupTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: colors.slate500, marginBottom: 8, marginLeft: 4 },
    group: {
      backgroundColor: colors.surface, borderRadius: radii.lg, paddingHorizontal: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, ...cardShadow,
    },
    menuRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13,
      borderBottomWidth: 1, borderBottomColor: colors.slate100,
    },
    menuRowLast: { borderBottomWidth: 0 },
    menuIcon: {
      width: 32, height: 32, borderRadius: radii.md, backgroundColor: colors.brand[50],
      alignItems: 'center', justifyContent: 'center',
    },
    menuIconDanger: { backgroundColor: colors.dangerBg },
    menuText: { flex: 1, minWidth: 0 },
    menuLabel: { fontSize: 13.5, fontWeight: '700', color: colors.textLight },
    menuLabelDanger: { color: colors.dangerText },
    menuHint: { fontSize: 11, fontWeight: '600', color: colors.slate400, marginTop: 2 },
    menuValue: { fontSize: 12, fontWeight: '600', color: colors.slate500, maxWidth: '40%' },
    chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill, maxWidth: '45%' },
    chipText: { fontSize: 11, fontWeight: '800' },
    chevron: { marginLeft: -4 },
  });
}
