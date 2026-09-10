import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';

/**
 * The rules of a screen, said once, quietly, at the bottom.
 *
 * A bold lead sentence and then the detail, because the lead is what somebody
 * gets from a glance and the rest is there for the one time they need it. Set
 * below the actions on purpose: a person who already knows how the screen
 * works should meet the controls first, and instructions above the buttons
 * become furniture people learn to scroll past.
 *
 * Muted, not tinted. This is reference, not a warning -- colouring it would
 * borrow urgency from the banners above, which need it.
 */
export function InfoNote({ lead, body }: { lead: string; body: string }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <Ionicons name="information-circle-outline" size={15} color={colors.slate400} style={styles.icon} />
      <Text style={styles.text}>
        <Text style={styles.lead}>{lead} </Text>
        {body}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      gap: 9,
      padding: 13,
      borderRadius: radii.md,
      backgroundColor: colors.slate50,
      borderWidth: 1,
      borderColor: colors.slate100,
    },
    // Nudged to sit on the first line's cap height rather than its centre.
    icon: { marginTop: 1 },
    text: { flex: 1, fontSize: 11, lineHeight: 17, color: colors.slate500 },
    lead: { fontWeight: '800', color: colors.slate700 },
  });
