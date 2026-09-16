import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { Skeleton } from '../../components/Skeleton';
import { getTeamLeave, type LeaveRequest } from '../../api/leave.api';
import { toLocalDateKey } from '../../utils/datetime';
import { t as tr, useT, type TKey } from '../../i18n';

/**
 * Who on the team is off, on the home screen.
 *
 * A lead opens Home, not the Team tab -- so the fact that two of their four
 * people are away today was a tab and two taps from the first thing they see,
 * which is the wrong distance for the one thing that changes how the day has
 * to be run.
 *
 * TODAY FIRST, THEN WHAT IS COMING. Those answer different questions. Today
 * explains the gap on the floor right now; upcoming is what the roster has to
 * absorb. A single merged list would bury the urgent one under whatever
 * happens to be sooner alphabetically.
 *
 * Team leads only, matching the Team tab -- an employee has no team, and a
 * card listing their colleagues' absences is not theirs to read.
 */
const MAX_ROWS = 3;

export function TeamLeaveCard() {
  const navigation = useNavigation<any>();
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const role = useAuthStore((s) => s.employee?.role);
  const isTeamLead = role === 'team-lead';

  // A short window: Home answers "now and soon". The Team tab keeps the long
  // view, including the past, and this card links straight to it.
  const { from, to } = React.useMemo(() => {
    const day = 86400000;
    const now = Date.now();
    return { from: toLocalDateKey(new Date(now)), to: toLocalDateKey(new Date(now + 30 * day)) };
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['home-team-leave', from, to],
    queryFn: () => getTeamLeave(from, to),
    enabled: isTeamLead,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const today = toLocalDateKey();

  const { now, upcoming } = React.useMemo(() => {
    const rows = (data ?? []).filter((l) => l.status === 'approved' || l.status === 'pending');
    const onNow: LeaveRequest[] = [];
    const later: LeaveRequest[] = [];
    for (const l of rows) {
      // YYYY-MM-DD compares correctly as a string, and avoids a date-only
      // value being read as UTC midnight -- which puts IST a day out on
      // exactly the boundary this is testing.
      if (l.startDate <= today && l.endDate >= today) onNow.push(l);
      else if (l.startDate > today) later.push(l);
    }
    onNow.sort((a, b) => a.endDate.localeCompare(b.endDate));
    later.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return { now: onNow, upcoming: later };
  }, [data, today]);

  if (!isTeamLead) return null;

  if (isLoading) {
    return (
      <View style={styles.card}>
        <Skeleton width="40%" height={10} />
        <Skeleton width="70%" height={15} style={{ marginTop: 12 }} />
        <Skeleton width="45%" height={11} style={{ marginTop: 8 }} />
      </View>
    );
  }

  // A failed read is not worth a home-screen error nobody can act on; the
  // Team tab is still there and will report it properly.
  if (isError) return null;

  const total = now.length + upcoming.length;

  const open = () => navigation.navigate('Team');

  if (total === 0) {
    return (
      <Pressable
        onPress={open}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('home.teamLeave')}
      >
        <Text style={styles.eyebrow}>{t('home.teamLeave')}</Text>
        <Text style={styles.empty}>{t('team.noLeave')}</Text>
      </Pressable>
    );
  }

  const row = (l: LeaveRequest, key: string, tone: 'now' | 'later') => (
    <View key={key} style={styles.row}>
      <View style={[styles.dot, tone === 'now' ? styles.dotNow : styles.dotLater]} />
      <Text style={styles.name} numberOfLines={1}>
        {l.employeeName ?? l.employeeId}
      </Text>
      <Text style={styles.when} numberOfLines={1}>
        {l.startDate === l.endDate ? shortDate(l.startDate) : `${shortDate(l.startDate)} – ${shortDate(l.endDate)}`}
      </Text>
    </View>
  );

  // Today's absences are never truncated away: they are the reason to look.
  const upcomingRoom = Math.max(0, MAX_ROWS - now.length);
  const shownUpcoming = upcoming.slice(0, upcomingRoom);

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.card, now.length > 0 && styles.cardActive, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('home.teamLeave')}
    >
      <Text style={styles.eyebrow}>{t('home.teamLeave')}</Text>

      {now.length > 0 && (
        <>
          <Text style={styles.section}>{t('team.onLeaveNow')}</Text>
          {now.map((l) => row(l, l.id, 'now'))}
        </>
      )}

      {shownUpcoming.length > 0 && (
        <>
          <Text style={[styles.section, now.length > 0 && styles.sectionSpaced]}>
            {t('team.leaveUpcoming')}
          </Text>
          {shownUpcoming.map((l) => row(l, l.id, 'later'))}
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.viewAll}>{t('home.teamLeaveAll')}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.brand[700]} />
      </View>
    </Pressable>
  );
}

const monthShort = (m: number) => tr(('monthShort.' + (m + 1)) as TKey);
const shortDate = (key: string) => {
  const d = new Date(`${String(key).slice(0, 10)}T00:00:00`);
  return `${d.getDate()} ${monthShort(d.getMonth())}`;
};

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    card: {
      borderRadius: radii.xl,
      padding: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.slate100,
    },
    // Somebody is away right now, which is the state worth noticing.
    cardActive: { borderColor: colors.warningBg },
    pressed: { opacity: 0.9 },
    eyebrow: {
      fontSize: 10.5, fontWeight: '900', letterSpacing: 0.6,
      textTransform: 'uppercase', color: colors.slate500,
    },
    section: {
      fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase',
      color: colors.slate400, marginTop: 12, marginBottom: 6,
    },
    sectionSpaced: { marginTop: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
    dot: { width: 7, height: 7, borderRadius: 3.5 },
    dotNow: { backgroundColor: colors.warning },
    dotLater: { backgroundColor: colors.slate300 },
    name: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.textLight },
    when: { fontSize: 11.5, fontWeight: '700', color: colors.slate500, fontVariant: ['tabular-nums'] },
    empty: { fontSize: 12, color: colors.slate400, fontWeight: '600', marginTop: 10 },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 14 },
    viewAll: { fontSize: 12, fontWeight: '800', color: colors.brand[700] },
  });
