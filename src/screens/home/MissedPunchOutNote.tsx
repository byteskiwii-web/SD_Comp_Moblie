import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui';
import { useMissedPunchOut } from '../../hooks/useMissedPunchOut';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { formatDate } from '../../utils/datetime';
import { useT } from '../../i18n';

/**
 * Yesterday's shift was never punched out. Said on the first screen, because
 * otherwise somebody only finds out if they happen to press Punch Out, and most
 * people who forgot won't. Stays until a correction is raised.
 */
export function MissedPunchOutNote() {
  const date = useMissedPunchOut();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const t = useT();

  if (!date) return null;

  return (
    <View style={styles.note} accessibilityRole="alert">
      <Text style={styles.title}>{t('clock.missedOutTitle', { date: formatDate(`${date}T12:00:00`) })}</Text>
      <Text style={styles.body}>{t('clock.missedOutNote')}</Text>
      <Button
        title={t('clock.raiseCorrection')}
        onPress={() => navigation.navigate('Attendance', { screen: 'AttendanceHome', params: { tab: 'regularise', date } })}
      />
    </View>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    note: { backgroundColor: colors.warningBg, borderRadius: radii.lg, padding: 16, gap: 6 },
    title: { fontSize: 14, fontWeight: '800', color: colors.warningText },
    body: { fontSize: 12.5, lineHeight: 18, color: colors.warningText, marginBottom: 6 },
  });
}
