import React, { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SkeletonRows } from '../../components/Skeleton';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { getApiErrorMessage } from '../../api/client';
import { toLocalDateKey } from '../../utils/datetime';
import { festivalIcon } from '../../utils/festivalIcon';
import { getHolidays, HOLIDAY_KIND_LABEL, type Holiday } from '../../api/holidays.api';

/**
 * The year's festivals, grouped by month.
 *
 * A flat list of 54 dates is a wall; months are how people navigate a
 * calendar, so SectionList with sticky month headers gives the year a shape
 * you can thumb through.
 *
 * It opens scrolled to the current month rather than at January. By September
 * two thirds of the list is history, and the useful part is what is coming.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function FestivalsScreen() {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const today = toLocalDateKey();

  const { data, isLoading, error } = useQuery({
    queryKey: ['holidays-year'],
    queryFn: () => getHolidays(),
    staleTime: 60 * 60 * 1000,
  });

  const sections = useMemo(() => {
    const byMonth = new Map<string, Holiday[]>();
    for (const h of data ?? []) {
      const key = String(h.date).slice(0, 7);
      const list = byMonth.get(key) ?? [];
      list.push(h);
      byMonth.set(key, list);
    }
    return [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, items]) => ({
        key,
        title: MONTHS[Number(key.slice(5, 7)) - 1],
        data: items,
      }));
  }, [data]);

  /**
   * Land on the current month rather than January.
   *
   * By September two thirds of the year is history and the useful part is
   * what is coming. Done with scrollToLocation after the sections resolve
   * instead of initialScrollIndex, which needs getItemLayout — and these rows
   * are variable height, so any offset table would be a guess.
   *
   * Wrapped because scrollToLocation throws if the list has not measured the
   * target yet; failing to scroll is a list that opens at the top, which is
   * the old behaviour and not worth a crash.
   */
  const listRef = React.useRef<SectionList<Holiday, { key: string; title: string; data: Holiday[] }>>(null);

  React.useEffect(() => {
    if (sections.length === 0) return;
    const index = sections.findIndex((sec) => sec.key >= today.slice(0, 7));
    if (index <= 0) return;

    const t = setTimeout(() => {
      try {
        listRef.current?.scrollToLocation({
          sectionIndex: index,
          itemIndex: 0,
          animated: false,
          viewOffset: 0,
        });
      } catch {
        // Opens at the top instead. Not worth a crash.
      }
    }, 60);
    return () => clearTimeout(t);
  }, [sections, today]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader title="Festivals" subtitle={today.slice(0, 4)} />

      {isLoading ? (
        <View style={styles.pad}><SkeletonRows count={8} /></View>
      ) : error ? (
        <View style={styles.pad}><Text style={styles.error}>{getApiErrorMessage(error)}</Text></View>
      ) : sections.length === 0 ? (
        <View style={styles.pad}>
          <Text style={styles.empty}>
            No festivals on the calendar yet. Your HR team loads these; check back shortly.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(h) => h.id}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.list}
          ref={listRef}
          renderSectionHeader={({ section }) => (
            <View style={styles.monthBar}>
              <Text style={styles.monthText}>{section.title}</Text>
              <Text style={styles.monthCount}>
                {section.data.length} {section.data.length === 1 ? 'day' : 'days'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => <Row holiday={item} today={today} styles={styles} colors={colors} />}
        />
      )}
    </SafeAreaView>
  );
}

function Row({
  holiday,
  today,
  styles,
  colors,
}: {
  holiday: Holiday;
  today: string;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorScheme;
}) {
  const d = new Date(`${String(holiday.date).slice(0, 10)}T00:00:00`);
  const isToday = String(holiday.date).slice(0, 10) === today;
  const isPast = String(holiday.date).slice(0, 10) < today;

  const glyph = festivalIcon(holiday.name);

  return (
    <View style={[styles.row, isToday && styles.rowToday, isPast && styles.rowPast]}>
      <View style={styles.dateBlock}>
        <Text style={[styles.day, isToday && styles.todayText]}>{d.getDate()}</Text>
        <Text style={styles.weekday}>{WEEKDAYS[d.getDay()]}</Text>
      </View>

      {/* The festival's own tint, not the theme's. Ionicons is monochrome, so
          without it forty festivals are forty identical grey outlines. */}
      <View style={[styles.badge, { backgroundColor: glyph.tint + '1F' }]}>
        <Ionicons name={glyph.name} size={17} color={glyph.tint} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.name, isToday && styles.todayText]} numberOfLines={2}>
          {holiday.name}
        </Text>
        <View style={styles.meta}>
          {/* Only worth saying when it is not the ordinary case. */}
          {holiday.kind !== 'festival' && (
            <Text style={styles.kind}>{HOLIDAY_KIND_LABEL[holiday.kind]}</Text>
          )}
          {holiday.region ? <Text style={styles.kind}>{holiday.region}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bgLight },
    pad: { padding: 20 },
    list: { paddingBottom: 32 },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
    empty: { color: colors.slate400, fontSize: 13, lineHeight: 19 },

    monthBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 9,
      backgroundColor: colors.bgLight,
      borderBottomWidth: 1, borderBottomColor: colors.slate200,
    },
    monthText: {
      fontSize: 11, fontWeight: '800', textTransform: 'uppercase',
      letterSpacing: 0.5, color: colors.slate500,
    },
    monthCount: { fontSize: 10.5, fontWeight: '700', color: colors.slate400 },

    row: {
      flexDirection: 'row', alignItems: 'center', gap: 11,
      paddingHorizontal: 18, paddingVertical: 11,
      backgroundColor: colors.surface,
      borderBottomWidth: 1, borderBottomColor: colors.slate100,
    },
    rowToday: { backgroundColor: colors.brand[50] },
    // Dimmed rather than hidden: a passed festival is still a fact about the
    // year, and removing it would make the list look wrong in December.
    rowPast: { opacity: 0.5 },

    dateBlock: { width: 30, alignItems: 'center' },
    badge: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    day: { fontSize: 17, fontWeight: '800', color: colors.textLight, letterSpacing: -0.4 },
    weekday: {
      fontSize: 9.5, fontWeight: '800', color: colors.slate400,
      textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 1,
    },
    todayText: { color: colors.brand[700] },

    body: { flex: 1 },
    name: { fontSize: 13.5, fontWeight: '700', color: colors.textLight },
    meta: { flexDirection: 'row', gap: 8, marginTop: 2 },
    kind: {
      fontSize: 10, fontWeight: '700', color: colors.slate500,
      backgroundColor: colors.slate100, borderRadius: radii.sm,
      paddingHorizontal: 6, paddingVertical: 2,
      overflow: 'hidden',
    },
  });
