import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
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
 * The size is the employee's to set, so it is a live control. Issuance is HR's
 * record of what they did, so it is read-only here: an employee tapping "yes I
 * got it" would be a different fact, and inventing it would make the roster of
 * outstanding kits wrong.
 */
export function KitCard() {
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Card>
      <Text style={styles.title}>Welcome kit</Text>

      <Text style={styles.label}>Shirt size</Text>
      <View style={styles.sizes}>
        {SHIRT_SIZES.map((size) => {
          const selected = current === size;
          return (
            <Pressable
              key={size}
              onPress={() => save.mutate(size)}
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
        {current ? 'Tap another size to change it.' : 'Pick your size so HR can prepare your kit.'}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.statusRow}>
        <Ionicons
          name={profile?.welcomeKitIssued ? 'checkmark-circle' : 'time-outline'}
          size={17}
          color={profile?.welcomeKitIssued ? colors.success : colors.slate400}
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

const styles = StyleSheet.create({
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
    borderWidth: 1.5, borderColor: colors.slate200, backgroundColor: colors.white,
    alignItems: 'center',
  },
  sizeOn: { borderColor: colors.brand[700], backgroundColor: colors.brand[50] },
  sizePressed: { opacity: 0.75 },
  sizeText: { fontSize: 13, fontWeight: '800', color: colors.slate600 },
  sizeTextOn: { color: colors.brand[700] },
  hint: { fontSize: 11.5, color: colors.slate400, marginTop: 8, fontWeight: '600' },
  error: { fontSize: 12, color: colors.danger, fontWeight: '600', marginTop: 8 },

  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.slate100,
  },
  statusText: { fontSize: 13, color: colors.slate600, fontWeight: '600' },
});
