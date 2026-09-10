import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { SkeletonList, SkeletonRows } from '../../components/Skeleton';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { getApiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { formatTime, newestFirst, toLocalDateKey } from '../../utils/datetime';
import { formatDuration } from '../../utils/attendanceDay';
import {
  getTeamLive,
  getTeamRegister,
  getTeamRegularisations,
  type RegisterRow,
} from '../../api/team.api';

/**
 * The team lead's panel. Read-only, and honestly so.
 *
 * Three questions, in the order a lead actually asks them: who is in right
 * now, how has the team been doing, and what has been sent for approval.
 *
 * There is no approve button anywhere here, and that is deliberate rather than
 * unfinished. The role is refused at every write path on the server by name,
 * so a button would be an offer the account cannot honour — the queue instead
 * says who decides, which is the thing a lead actually needs to know when
 * somebody asks them to chase it.
 *
 * Nothing is filtered on the phone. Every call is an existing scoped endpoint
 * and the server pins a site-scoped principal to their own store whatever is
 * asked for, so the view cannot be widened from here and a transfer needs no
 * app change.
 */

type Tab = 'today' | 'register' | 'requests';

const TAB_LABEL: Record<Tab, string> = {
  today: 'On shift',
  register: 'Register',
  requests: 'Requests',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (key: string) => {
  const d = new Date(`${String(key).slice(0, 10)}T00:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export function TeamScreen() {
  const store = useAuthStore((s) => s.store);
  const [tab, setTab] = useState<Tab>('today');
  const colors = useThemeStore((s) => s.colors);
  // Subscribed purely so a change to the 12/24-hour setting re-renders the
  // times on this screen; the formatters read the store outside React.
  usePreferencesStore((s) => s.clock);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Team</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {store?.name ?? 'Your site'}
          </Text>
        </View>
        <View style={styles.viewOnly}>
          <Ionicons name="eye-outline" size={12} color={colors.slate500} />
          <Text style={styles.viewOnlyText}>View only</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.segment}>
          {(['today', 'register', 'requests'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.segmentItem, tab === t && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                {TAB_LABEL[t]}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'today' ? <OnShift /> : tab === 'register' ? <Register /> : <Requests />}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Who is in, right now. */
function OnShift() {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, isLoading, error } = useQuery({
    queryKey: ['team-live'],
    queryFn: getTeamLive,
    refetchInterval: 60_000,
  });

  if (isLoading) return <Card><SkeletonRows count={4} /></Card>;
  if (error) return <Text style={styles.error}>{getApiErrorMessage(error)}</Text>;

  const people = data ?? [];
  const on = people.filter((p) => p.onShift);
  const off = people.filter((p) => !p.onShift);

  return (
    <>
      <Card>
        <View style={styles.tiles}>
          <View style={styles.tile}>
            <Text style={[styles.tileValue, styles.tileOk]}>{on.length}</Text>
            <Text style={styles.tileLabel}>On shift</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{off.length}</Text>
            <Text style={styles.tileLabel}>Not clocked in</Text>
          </View>
        </View>
      </Card>

      {people.length === 0 ? (
        <Card><Text style={styles.empty}>Nobody is assigned to this site yet.</Text></Card>
      ) : (
        <Card style={styles.listCard}>
          {[...on, ...off].map((p, i) => (
            <View key={p.employeeId} style={[styles.row, i === 0 && styles.rowFirst]}>
              <View style={[styles.dot, p.onShift ? styles.dotOn : styles.dotOff]} />
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {p.lastMarkAt
                    ? `${p.lastMarkType === 'clock-in' ? 'In' : 'Out'} at ${formatTime(p.lastMarkAt)}`
                    : 'No punch today'}
                </Text>
              </View>
              <Text style={[styles.rowState, p.onShift && styles.rowStateOn]}>
                {p.onShift ? 'IN' : '—'}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

/** The last 30 days, one row per employee per day. Absences included. */
function Register() {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const range = useMemo(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return { from: toLocalDateKey(from), to: toLocalDateKey(now) };
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['team-register', range.from, range.to],
    queryFn: () => getTeamRegister(range.from, range.to),
  });

  // Rolled up per person: a lead scanning a month wants "who is short", not
  // 30 rows each. The days behind each figure are still one tap from the
  // employee's own history if it comes to that.
  const perPerson = useMemo(() => {
    const by = new Map<string, { name: string; present: number; days: number; late: number; minutes: number }>();
    for (const r of (data ?? []) as RegisterRow[]) {
      const held = by.get(r.employeeId) ?? { name: r.name, present: 0, days: 0, late: 0, minutes: 0 };
      held.days += 1;
      if (r.present) held.present += 1;
      if (r.late) held.late += 1;
      held.minutes += r.workedMinutes ?? 0;
      by.set(r.employeeId, held);
    }
    return [...by.entries()]
      .map(([employeeId, v]) => ({ employeeId, ...v, rate: v.days ? v.present / v.days : 0 }))
      .sort((a, b) => a.rate - b.rate);
  }, [data]);

  if (isLoading) return <Card><SkeletonRows count={5} /></Card>;
  if (error) return <Text style={styles.error}>{getApiErrorMessage(error)}</Text>;
  if (perPerson.length === 0) {
    return <Card><Text style={styles.empty}>No attendance recorded in this period.</Text></Card>;
  }

  return (
    <>
      <Text style={styles.rangeLine}>
        {shortDate(range.from)} – {shortDate(range.to)} · lowest attendance first
      </Text>
      <Card style={styles.listCard}>
        {perPerson.map((p, i) => (
          <View key={p.employeeId} style={[styles.row, i === 0 && styles.rowFirst]}>
            <View style={styles.rowText}>
              <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.rowMeta}>
                {p.present}/{p.days} days
                {p.late > 0 ? ` · ${p.late} late` : ''}
                {p.minutes > 0 ? ` · ${formatDuration(p.minutes)}` : ''}
              </Text>
            </View>
            <Text
              style={[
                styles.rate,
                p.rate < 0.8 ? styles.rateBad : p.rate < 0.95 ? styles.rateMid : styles.rateOk,
              ]}
            >
              {Math.round(p.rate * 100)}%
            </Text>
          </View>
        ))}
      </Card>
    </>
  );
}

/** What the team has sent for approval, and who has to decide it. */
function Requests() {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, isLoading, error } = useQuery({
    queryKey: ['team-regularisations'],
    queryFn: () => getTeamRegularisations(),
  });

  const rows = useMemo(() => newestFirst(data ?? [], 'markDate', 'createdAt'), [data]);

  const TONE: Record<string, { bg: string; fg: string }> = useMemo(() => ({
    pending: { bg: colors.warningBg, fg: colors.warningText },
    approved: { bg: colors.successBg, fg: colors.successText },
    rejected: { bg: colors.dangerBg, fg: colors.dangerText },
    cancelled: { bg: colors.slate100, fg: colors.slate500 },
  }), [colors]);

  if (isLoading) return <SkeletonList count={3} lines={1} />;
  if (error) return <Text style={styles.error}>{getApiErrorMessage(error)}</Text>;
  if (rows.length === 0) {
    return <Card><Text style={styles.empty}>No correction requests from your team.</Text></Card>;
  }

  return (
    <>
      {rows.map((r) => {
        const tone = TONE[r.status] ?? TONE.cancelled;
        return (
          <Card key={r.id} style={styles.reqCard}>
            <View style={styles.reqHead}>
              <Text style={styles.reqName} numberOfLines={1}>
                {(r as { employeeName?: string }).employeeName ?? r.employeeId}
              </Text>
              <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                <Text style={[styles.badgeText, { color: tone.fg }]}>{r.status}</Text>
              </View>
            </View>
            <Text style={styles.reqMeta}>
              {shortDate(r.markDate)} · {r.requestType === 'adjust' ? 'Time correction' : 'On duty / WFH'}
            </Text>
            <Text style={styles.reqReason} numberOfLines={2}>{r.reason}</Text>
            {r.decisionNote ? <Text style={styles.reqNote}>“{r.decisionNote}”</Text> : null}
          </Card>
        );
      })}
      {/* Says who acts, since this panel cannot. A lead asked to chase a
          request needs to know where it is sitting. */}
      <Text style={styles.footnote}>
        Requests are approved by the site manager or HR. You can see them here but not decide them.
      </Text>
    </>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bgLight },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, gap: 10,
    },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 21, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3 },
    headerSub: { fontSize: 11, color: colors.slate400, fontWeight: '600', marginTop: 1 },
    viewOnly: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.slate100, borderRadius: radii.pill,
      paddingHorizontal: 9, paddingVertical: 5,
    },
    viewOnlyText: { fontSize: 10, fontWeight: '800', color: colors.slate500 },

    content: { padding: 20, paddingTop: 12, gap: 12, paddingBottom: 28 },
    segment: { flexDirection: 'row', backgroundColor: colors.slate100, borderRadius: radii.md, padding: 4 },
    segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radii.sm },
    segmentItemActive: {
      backgroundColor: colors.surface,
      shadowColor: colors.slate900, shadowOffset: { width: 0, height: 1 },
      shadowOpacity: colors.scheme === 'dark' ? 0 : 0.08, shadowRadius: 2, elevation: colors.scheme === 'dark' ? 0 : 1,
    },
    segmentText: { fontSize: 11, fontWeight: '700', color: colors.slate500 },
    segmentTextActive: { color: colors.brand[700] },

    tiles: { flexDirection: 'row', gap: 10 },
    tile: {
      flex: 1, borderWidth: 1, borderColor: colors.slate200, borderRadius: radii.md,
      paddingVertical: 12, paddingHorizontal: 12,
    },
    tileValue: { fontSize: 19, fontWeight: '800', color: colors.textLight, letterSpacing: -0.4 },
    tileOk: { color: colors.successText },
    tileLabel: { fontSize: 10.5, color: colors.slate500, fontWeight: '700', marginTop: 3 },

    listCard: { padding: 0, paddingHorizontal: 14 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.slate100,
    },
    rowFirst: { borderTopWidth: 0 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotOn: { backgroundColor: colors.success },
    dotOff: { backgroundColor: colors.slate300 },
    rowText: { flex: 1 },
    rowName: { fontSize: 12.5, fontWeight: '700', color: colors.textLight },
    rowMeta: { fontSize: 10.5, color: colors.slate400, marginTop: 2, fontWeight: '600' },
    rowState: { fontSize: 10.5, fontWeight: '800', color: colors.slate300 },
    rowStateOn: { color: colors.successText },

    rangeLine: { fontSize: 11, color: colors.slate400, fontWeight: '600', marginLeft: 2 },
    rate: { fontSize: 13, fontWeight: '800' },
    rateOk: { color: colors.successText },
    rateMid: { color: colors.warningText },
    rateBad: { color: colors.dangerText },

    reqCard: { padding: 14, gap: 6 },
    reqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    reqName: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.textLight },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.sm },
    badgeText: { fontSize: 9.5, fontWeight: '800', textTransform: 'capitalize' },
    reqMeta: { fontSize: 11, color: colors.slate500, fontWeight: '700' },
    reqReason: { fontSize: 11.5, color: colors.slate600, lineHeight: 16 },
    reqNote: { fontSize: 11, color: colors.slate500, fontStyle: 'italic' },

    empty: { fontSize: 12, color: colors.slate400, fontWeight: '600' },
    error: { color: colors.dangerText, fontSize: 12, fontWeight: '600', paddingVertical: 10 },
    footnote: { fontSize: 10.5, color: colors.slate400, lineHeight: 15, marginTop: 4, marginHorizontal: 2 },
  });
}
