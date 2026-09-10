import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { Skeleton } from '../../components/Skeleton';
import { getTodayHolidays } from '../../api/holidays.api';

/**
 * Today's festival on the home screen.
 *
 * Two states rather than one, because a card that only appears on festival
 * days is invisible for about 310 days a year and nobody discovers the
 * Festivals screen behind it. When there is nothing today it shows what is
 * coming next instead — quieter, but still a way in.
 *
 * `today` is a LIST. Pongal and Makar Sankranti fall together on 14 January,
 * and rendering only the first would be wrong twice a year.
 *
 * The card is skipped entirely when the calendar is empty — a deployment that
 * has never run the import should show nothing rather than a broken shell.
 */
export function FestivalCard() {
  const navigation = useNavigation<any>();
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['holidays-today'],
    queryFn: getTodayHolidays,
    // The calendar changes once a day at most; refetching it on every focus
    // would spend a request to learn nothing.
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <View style={styles.card}>
        <Skeleton width="40%" height={10} />
        <Skeleton width="70%" height={15} style={{ marginTop: 8 }} />
      </View>
    );
  }

  // Nothing imported, or the call failed: stay out of the way rather than
  // occupying the home screen with an error nobody can act on.
  if (isError || !data) return null;

  const todays = data.today ?? [];
  const isToday = todays.length > 0;
  const next = data.next;
  if (!isToday && !next) return null;

  const open = () => navigation.navigate('Festivals');

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.card, isToday && styles.cardToday, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={
        isToday ? `Today: ${todays.map((h) => h.name).join(', ')}. View all festivals.` : 'View all festivals'
      }
    >
      <View style={styles.head}>
        <Ionicons
          name={isToday ? 'sparkles' : 'calendar-outline'}
          size={15}
          color={isToday ? colors.brand[700] : colors.slate400}
        />
        <Text style={[styles.eyebrow, isToday && styles.eyebrowToday]}>
          {isToday ? 'Today' : 'Coming up'}
        </Text>
        <Text style={styles.viewAll}>View all</Text>
        <Ionicons name="chevron-forward" size={13} color={colors.brand[700]} />
      </View>

      {isToday ? (
        // Joined rather than truncated: on a shared date both names are the
        // answer, and showing one implies the other is not happening.
        <Text style={styles.name}>{todays.map((h) => h.name).join(' · ')}</Text>
      ) : (
        <Text style={styles.name}>
          {next!.name} <Text style={styles.when}>· {friendly(next!.date)}</Text>
        </Text>
      )}
    </Pressable>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "in 4 days" is more useful than a date somebody has to subtract from today. */
function friendly(date: string): string {
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);

  if (days === 1) return 'tomorrow';
  if (days > 1 && days <= 14) return `in ${days} days`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.slate200,
      padding: 14,
    },
    cardToday: { borderColor: colors.brand[700], backgroundColor: colors.brand[50] },
    pressed: { opacity: 0.75 },

    head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    eyebrow: {
      flex: 1,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: colors.slate500,
    },
    eyebrowToday: { color: colors.brand[700] },
    viewAll: { fontSize: 11, fontWeight: '800', color: colors.brand[700] },

    name: { fontSize: 15, fontWeight: '800', color: colors.textLight, marginTop: 7, letterSpacing: -0.2 },
    when: { fontSize: 12.5, fontWeight: '600', color: colors.slate500 },
  });
