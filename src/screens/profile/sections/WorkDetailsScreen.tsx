import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { storeLabel } from '../../../utils/store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../../../components/ui';
import { DeptManagerCard } from '../DeptManagerCard';
import { ReportingCard } from '../ReportingCard';
import { SectionScreen } from '../SectionScreen';
import { formatDate, formatShift } from '../../../utils/datetime';
import { ColorScheme } from '../../../theme/tokens';
import { useThemeStore } from '../../../stores/themeStore';
import { useAuthStore } from '../../../stores/authStore';
import { useT } from '../../../i18n';

/**
 * Where and when somebody works, and for whom.
 *
 * The contact-and-assignment rows that opened the old Profile page, followed
 * by the two manager cards — one screen, because they answer one question
 * ("what is my posting") and reading them together is what makes the
 * difference between department and reporting manager obvious.
 */
export function WorkDetailsScreen() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const profile = useAuthStore((s) => s.profile);
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  return (
    <SectionScreen title={t('profile.menu.work')}>
      <Card>
        <Text style={styles.cardTitle}>{t('profile.contact')}</Text>
        <Row icon="call-outline" label={t('common.phone')} value={employee?.phone ?? '—'} />
        <Row icon="mail-outline" label={t('common.email')} value={employee?.email ?? '—'} />
        <Row icon="business-outline" label={t('profile.assignedSite')} value={storeLabel(store)} />
        <Row icon="pricetag-outline" label={t('profile.siteCode')} value={store?.store_code ?? employee?.store_code ?? '—'} />
        <Row
          icon="navigate-outline"
          label={t('profile.geofence')}
          value={store?.geofence_radius_m ? t('profile.geofenceRadius', { metres: store.geofence_radius_m }) : '—'}
        />
        {/* The rostered shift, named. '10:00 - 19:00' alone does not say
            which shift somebody is on. Break allowance lives on the
            Attendance screen, next to where a break is actually taken. */}
        <Row
          icon="albums-outline"
          label={t('profile.shift')}
          value={formatShift(profile?.shift?.name, profile?.shiftStart, profile?.shiftEnd, t('shift.noRoster'))}
        />
        <Row
          icon="calendar-outline"
          label={t('profile.joined')}
          value={profile?.dateOfJoining ? formatDate(profile.dateOfJoining) : '—'}
          last
        />
      </Card>

      <DeptManagerCard />
      <ReportingCard />
    </SectionScreen>
  );
}

function Row({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Ionicons name={icon} size={15} color={colors.slate400} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    cardTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: colors.slate500, marginBottom: 4 },
    row: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: colors.slate100,
    },
    rowLast: { borderBottomWidth: 0 },
    rowIcon: { marginRight: 8 },
    rowLabel: { flex: 1, fontSize: 11, fontWeight: '600', color: colors.slate500 },
    rowValue: { fontSize: 11.5, fontWeight: '700', color: colors.textLight, flexShrink: 1, marginLeft: 8 },
  });
}
