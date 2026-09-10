import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import type { Colleague } from '../../api/auth.api';
import { t as tr, useT } from '../../i18n';

/**
 * The reporting line, in both directions.
 *
 * NOT the same card as the department manager, and the difference is worth
 * keeping visible: that one is a contact card for somebody who often has no
 * account here, this one is a link to a real employee record. They routinely
 * name different people, and collapsing them would quietly assert they are the
 * same person.
 *
 * READ-ONLY, unlike the department manager. That card is editable because it
 * carries no authority; this one does — an employee who could set their own
 * reporting manager would be choosing who signs off their work. HR writes it
 * through the assignment endpoint.
 *
 * The card hides itself when there is nothing on either side. An employee with
 * no manager recorded and nobody reporting to them learns nothing from an
 * empty card, and every screen that shows one anyway trains people to scroll
 * past it.
 */
export function ReportingCard() {
  const profile = useAuthStore((s) => s.profile);
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const manager = profile?.reportingManager ?? null;
  const reports = profile?.directReports ?? [];

  if (!manager && reports.length === 0) return null;

  return (
    <Card>
      <Text style={styles.title}>{t('reporting.title')}</Text>

      {manager ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t('reporting.reportsTo')}</Text>
          <Person person={manager} colors={colors} styles={styles} />
        </View>
      ) : null}

      {reports.length > 0 ? (
        <View style={[styles.block, manager ? styles.blockAfter : null]}>
          {/* Counted, because "my team" is a number somebody checks. */}
          <Text style={styles.label}>
            {t('reporting.directReports', { count: reports.length })}
          </Text>
          {reports.map((r) => (
            <Person key={r.id} person={r} colors={colors} styles={styles} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/**
 * One person, with their phone as the action.
 *
 * The reason a reporting line is stored at all is the moment somebody needs to
 * reach the person on it, so the number is a tap rather than a string to copy
 * out by hand. Without a number the row is inert rather than a button that
 * looks live and does nothing.
 */
function Person({
  person,
  colors,
  styles,
}: {
  person: Colleague;
  colors: ColorScheme;
  styles: ReturnType<typeof makeStyles>;
}) {
  const call = person.phone ? () => Linking.openURL('tel:' + person.phone) : undefined;

  const initials = person.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <Pressable
      onPress={call}
      disabled={!call}
      style={({ pressed }) => [styles.person, pressed && call ? styles.pressed : null]}
      accessibilityRole={call ? 'button' : 'text'}
      accessibilityLabel={call ? tr('reporting.call', { name: person.name }) : person.name}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials || '?'}</Text>
      </View>

      <View style={styles.personText}>
        <Text style={styles.personName} numberOfLines={1}>
          {person.name || person.id}
        </Text>
        <Text style={styles.personMeta} numberOfLines={1}>
          {[roleLabel(person.role), person.id].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {call ? <Ionicons name="call-outline" size={15} color={colors.brand[700]} /> : null}
    </Pressable>
  );
}

/**
 * `site-manager` is a database value, not something to show a person.
 *
 * Translated where the catalogue knows the role, and title-cased otherwise --
 * a role added on the server later still reads as words rather than as a
 * missing-key placeholder.
 */
function roleLabel(role: string | null): string | null {
  if (!role) return null;
  const key = ('role.' + role) as 'role.site-manager';
  const translated = tr(key);
  if (translated !== key) return translated;
  return role
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    title: {
      fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
      color: colors.slate500, marginBottom: 10,
    },
    label: {
      fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3,
      color: colors.slate400, marginBottom: 8,
    },
    block: { gap: 6 },
    blockAfter: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.slate100 },

    person: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 8, paddingHorizontal: 10,
      borderRadius: radii.sm, backgroundColor: colors.slate50,
    },
    pressed: { opacity: 0.7 },

    avatar: {
      width: 30, height: 30, borderRadius: 15,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.brand[50],
    },
    avatarText: { fontSize: 11, fontWeight: '800', color: colors.brand[700] },

    personText: { flex: 1 },
    personName: { fontSize: 12.5, fontWeight: '700', color: colors.textLight },
    personMeta: { fontSize: 10, fontWeight: '600', color: colors.slate400, marginTop: 1 },
  });
}
