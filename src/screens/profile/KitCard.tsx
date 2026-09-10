import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { getApiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { SHIRT_SIZES, updateMyProfile, type ShirtSize } from '../../api/auth.api';
import { formatDate } from '../../utils/datetime';

/**
 * Joining kit.
 *
 * Two facts with different owners, shown together because that is how they are
 * used — HR needs the size to pack the kit, then records sending it.
 *
 * The size is the employee's to set ONCE, so it is a live control until it has
 * been answered. It drives a purchase order, and a shirt already bought does
 * not change because the record did — so after the first submission the control
 * is replaced by the answer and a route to HR, who can still correct it.
 *
 * The server enforces that independently. This screen is not the boundary; it
 * exists so the employee reads a reason rather than meeting a refusal.
 *
 * Issuance is HR's record of what they did, so it is read-only here: an
 * employee tapping "yes I got it" would be a different fact, and inventing it
 * would make the roster of outstanding kits wrong.
 */
export function KitCard() {
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [error, setError] = useState<string | null>(null);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const save = useMutation({
    mutationFn: (size: ShirtSize) => updateMyProfile({ shirt_size: size }),
    onSuccess: async () => {
      setError(null);
      // Re-read rather than assume: the server is the record, and a size HR
      // corrected in the meantime should win over what this screen just sent.
      await refreshProfile();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const current = profile?.shirtSize ?? null;
  const locked = profile?.shirtSizeLocked ?? false;

  /**
   * Confirm before the first submission, because it is the LAST one.
   *
   * A one-time choice made by a single tap is a trap: the tap that picks the
   * wrong size is the same gesture as the tap that picks the right one, and
   * there is no undo behind it. The alert is the undo.
   */
  const choose = (size: ShirtSize) => {
    Alert.alert(
      'Confirm shirt size ' + size,
      'You can only choose your shirt size once. After this, HR has to make any change.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm ' + size, onPress: () => save.mutate(size) },
      ]
    );
  };

  return (
    <Card>
      <Text style={styles.title}>Welcome kit</Text>

      <Text style={styles.label}>Shirt size</Text>

      {locked ? (
        /* Answered. The size is shown as a fact rather than as a control that
           would look tappable and then be refused. */
        <View>
          <View style={styles.lockedRow}>
            <View style={[styles.size, styles.sizeOn]}>
              <Text style={[styles.sizeText, styles.sizeTextOn]}>{current}</Text>
            </View>
            <View style={styles.lockedBadge}>
              <Ionicons name="lock-closed" size={11} color={colors.slate500} />
              <Text style={styles.lockedBadgeText}>Submitted</Text>
            </View>
          </View>
          <Text style={styles.hint}>
            Your shirt size has already been submitted. Contact HR if it needs to change.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.sizes}>
            {SHIRT_SIZES.map((size) => {
              const selected = current === size;
              return (
                <Pressable
                  key={size}
                  onPress={() => choose(size)}
                  disabled={save.isPending}
                  style={({ pressed }) => [
                    styles.size,
                    selected && styles.sizeOn,
                    pressed && styles.sizePressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.sizeText, selected && styles.sizeTextOn]}>{size}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            Pick your size so HR can prepare your kit. You can only choose once.
          </Text>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.statusRow}>
        <Ionicons
          name={profile?.welcomeKitIssued ? 'checkmark-circle' : 'time-outline'}
          size={17}
          color={profile?.welcomeKitIssued ? colors.successText : colors.slate400}
        />
        <Text style={styles.statusText}>
          {profile?.welcomeKitIssued
            ? `Kit issued${profile.welcomeKitIssuedAt ? ' on ' + formatDate(profile.welcomeKitIssuedAt) : ''}`
            : 'Kit not issued yet'}
        </Text>
      </View>
    </Card>
  );
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
    sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    size: {
      minWidth: 46, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radii.sm,
      borderWidth: 1.5, borderColor: colors.slate200, backgroundColor: colors.surface,
      alignItems: 'center',
    },
    sizeOn: { borderColor: colors.brand[700], backgroundColor: colors.brand[50] },
    sizePressed: { opacity: 0.75 },
    sizeText: { fontSize: 11.5, fontWeight: '800', color: colors.slate600 },
    sizeTextOn: { color: colors.brand[700] },
    hint: { fontSize: 10.5, color: colors.slate400, marginTop: 8, fontWeight: '600' },

    lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    lockedBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: radii.sm, backgroundColor: colors.slate100,
    },
    lockedBadgeText: {
      fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3,
      color: colors.slate500,
    },
    error: { fontSize: 11, color: colors.dangerText, fontWeight: '600', marginTop: 8 },

    statusRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
      paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.slate100,
    },
    statusText: { fontSize: 11.5, color: colors.slate600, fontWeight: '600' },
  });
}
