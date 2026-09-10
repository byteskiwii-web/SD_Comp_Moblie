import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { Skeleton } from '../../components/Skeleton';
import { festivalIcon } from '../../utils/festivalIcon';
import { getTodayHolidays, type Holiday } from '../../api/holidays.api';

/**
 * Today's festival on the home screen.
 *
 * Two states rather than one, because a card that only appears on festival
 * days is invisible for about 310 days a year and nobody discovers the
 * Festivals screen behind it. With nothing on today it shows what is coming
 * next instead — quieter, but still a way in.
 *
 * `today` is a LIST. Pongal and Makar Sankranti fall together on 14 January,
 * and showing one implies the other is not happening. Each gets its own row
 * with its own icon rather than being joined into a string, so the second
 * festival is as legible as the first.
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
    // The calendar changes once a day at most; refetching on every focus
    // would spend a request to learn nothing.
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <View style={styles.card}>
        <Skeleton width="35%" height={10} />
        <View style={styles.skelRow}>
          <Skeleton width={46} height={46} radius={14} />
          <View style={styles.skelText}>
            <Skeleton width="70%" height={16} />
            <Skeleton width="40%" height={11} style={{ marginTop: 8 }} />
          </View>
        </View>
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

  const shown: Holiday[] = isToday ? todays : [next!];

  return (
    <Pressable
      onPress={() => navigation.navigate('Festivals')}
      style={({ pressed }) => [styles.card, isToday && styles.cardToday, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={
        isToday
          ? `Today: ${todays.map((h) => h.name).join(', ')}. View all festivals.`
          : `Coming up: ${next!.name}. View all festivals.`
      }
    >
      <Text style={[styles.eyebrow, isToday && styles.eyebrowToday]}>
        {isToday ? 'Festival today' : 'Coming up'}
      </Text>

      {shown.map((h, i) => {
        const glyph = festivalIcon(h.name);
        return (
          <View key={h.id} style={[styles.row, i > 0 && styles.rowExtra]}>
            {/* The tint is the festival's, not the theme's — it is what makes
                Diwali and Holi tell apart at a glance in a monochrome set. */}
            <View style={[styles.badge, { backgroundColor: glyph.tint + '1F' }]}>
              <Ionicons name={glyph.name} size={24} color={glyph.tint} />
            </View>
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={2}>{h.name}</Text>
              <Text style={styles.when}>{isToday ? longDate(h.date) : friendly(h.date)}</Text>
            </View>
          </View>
        );
      })}

      <View style={styles.footer}>
        <Text style={styles.viewAll}>View all festivals</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.brand[700]} />
      </View>
    </Pressable>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const parse = (date: string) => new Date(`${String(date).slice(0, 10)}T00:00:00`);

const longDate = (date: string) => {
  const d = parse(date);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** "in 4 days" beats a date the reader has to subtract from today. */
function friendly(date: string): string {
  const d = parse(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);

  if (days === 1) return 'Tomorrow';
  if (days > 1 && days <= 14) return `In ${days} days · ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return `${DAYS[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.slate200,
      padding: 16,
    },
    cardToday: { borderColor: colors.brand[700], borderWidth: 1.5 },
    pressed: { opacity: 0.8 },

    eyebrow: {
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: colors.slate500,
      marginBottom: 12,
    },
    eyebrowToday: { color: colors.brand[700] },

    row: { flexDirection: 'row', alignItems: 'center', gap: 13 },
    // A second festival on the same date gets a rule above it, so two rows
    // read as two events rather than as one wrapped line.
    rowExtra: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.slate100,
    },
    badge: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1 },
    name: { fontSize: 17, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3 },
    when: { fontSize: 12, fontWeight: '600', color: colors.slate500, marginTop: 3 },

    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.slate100,
    },
    viewAll: { fontSize: 12, fontWeight: '800', color: colors.brand[700] },

    skelRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 12 },
    skelText: { flex: 1 },
  });
