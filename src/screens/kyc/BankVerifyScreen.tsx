import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, TextField } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import {
  lookupIfsc,
  verifyBankAccount,
  type BankVerifyMode,
  type BankVerifyResult,
  type IfscLookupResult,
} from '../../api/verification.api';
import { getApiErrorMessage } from '../../api/client';
import { kycGateQueryKey } from '../../hooks/useKycGate';
import { bankVerifySchema } from '../../schemas/kyc.schema';

/**
 * Bank account verification.
 *
 * The last KYC check, and the only one that can move money, which shapes the
 * whole screen:
 *
 *   - The IFSC is looked up FIRST, and it is free. A typo becomes "no such
 *     code" here instead of a failed billable check — or, in penny-drop mode,
 *     a rupee sent somewhere nobody intended.
 *
 *   - The account number is typed twice. A mistyped account number is not a
 *     validation error; it is a valid number belonging to a stranger, and no
 *     pattern can catch that.
 *
 *   - Penny drop asks for confirmation naming the amount, and the button
 *     disables on the first press. The server marks that operation
 *     non-replayable and never auto-retries it, because a retry deposits a
 *     second rupee; the client must not undo that guarantee with a double tap.
 *
 * `verified` here means usable for payroll, not "the account exists" — the
 * provider says an account exists while also saying it is blocked, or an NRE
 * account. Neither can receive a salary.
 */

const PENNY_DROP_AMOUNT = '₹1';

export function BankVerifyScreen() {
  const navigation = useNavigation<any>();
  const employee = useAuthStore((s) => s.employee);
  const queryClient = useQueryClient();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [ifsc, setIfsc] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [mode, setMode] = useState<BankVerifyMode>('penniless');
  const [branch, setBranch] = useState<IfscLookupResult | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BankVerifyResult | null>(null);

  const branchLookup = useMutation({
    mutationFn: () => lookupIfsc(ifsc.trim().toUpperCase()),
    onSuccess: (data) => {
      setBranch(data);
      setError('');
    },
    onError: (err) => {
      setBranch(null);
      setError(getApiErrorMessage(err));
    },
  });

  const verify = useMutation({
    mutationFn: () =>
      verifyBankAccount({
        account_number: accountNumber.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        name: name.trim() || undefined,
        mobile: mobile.trim() || undefined,
        mode,
      }),
    onSuccess: (data) => {
      setResult(data);
      setError('');
      // The Profile badge and the gate both read this.
      queryClient.invalidateQueries({ queryKey: kycGateQueryKey(employee?.id) });
      queryClient.invalidateQueries({ queryKey: ['kyc-status'] });
    },
    onError: (err) => {
      setResult(null);
      setError(getApiErrorMessage(err));
    },
  });

  const run = () => {
    setError('');
    setResult(null);

    const parsed = bankVerifySchema.safeParse({
      ifsc,
      account_number: accountNumber,
      confirm_account_number: confirmAccount,
      name,
      mobile,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details and try again.');
      return;
    }

    if (mode === 'pennydrop') {
      // Named amount, named destination. A confirmation that says only "are
      // you sure" is one people learn to tap through.
      Alert.alert(
        'Send a test deposit?',
        `${PENNY_DROP_AMOUNT} will be deposited into account ending ${accountNumber.trim().slice(-4)} at ` +
          `${branch?.bank ?? ifsc.trim().toUpperCase()} to prove it can receive money. ` +
          'This cannot be undone and must not be repeated.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: `Send ${PENNY_DROP_AMOUNT}`, style: 'default', onPress: () => verify.mutate() },
        ]
      );
      return;
    }

    verify.mutate();
  };

  const busy = verify.isPending;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader title="Bank account" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>
            This is the account your salary is paid into. It must be in your own name.
          </Text>

          <TextField
            label="IFSC"
            value={ifsc}
            onChangeText={(t) => {
              setIfsc(t.toUpperCase());
              setBranch(null);
              setError('');
            }}
            autoCapitalize="characters"
            maxLength={11}
            placeholder="HDFC0001234"
          />

          <View style={styles.lookupRow}>
            <Button
              title={branchLookup.isPending ? 'Checking…' : 'Find branch'}
              variant="outline"
              onPress={() => branchLookup.mutate()}
              disabled={ifsc.trim().length !== 11 || branchLookup.isPending}
            />
          </View>

          {branch && (
            <View style={styles.branchCard}>
              <Ionicons name="business-outline" size={16} color={colors.brand[700]} />
              <View style={styles.branchText}>
                <Text style={styles.branchBank}>{branch.bank ?? '—'}</Text>
                <Text style={styles.branchBranch}>
                  {[branch.branch, branch.city].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
            </View>
          )}

          <TextField
            label="Account number"
            value={accountNumber}
            onChangeText={(t) => {
              setAccountNumber(t.replace(/\D/g, ''));
              setError('');
            }}
            keyboardType="number-pad"
            maxLength={18}
            placeholder="6 to 18 digits"
          />

          <TextField
            label="Confirm account number"
            value={confirmAccount}
            onChangeText={(t) => {
              setConfirmAccount(t.replace(/\D/g, ''));
              setError('');
            }}
            keyboardType="number-pad"
            maxLength={18}
            placeholder="Type it again"
          />

          <TextField
            label="Name as per bank (optional)"
            value={name}
            onChangeText={setName}
            placeholder="Helps the bank match the account"
          />

          <TextField
            label="Mobile registered with the bank (optional)"
            value={mobile}
            onChangeText={(t) => setMobile(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="10 digits"
          />

          <Text style={styles.fieldLabel}>How to verify</Text>
          <View style={styles.modes}>
            <ModeOption
              selected={mode === 'penniless'}
              onPress={() => setMode('penniless')}
              title="Standard check"
              detail="Confirms the account without moving any money. Recommended."
            />
            <ModeOption
              selected={mode === 'pennydrop'}
              onPress={() => setMode('pennydrop')}
              title={`Test deposit (${PENNY_DROP_AMOUNT})`}
              detail={`Deposits ${PENNY_DROP_AMOUNT} to prove the account can actually receive money. Cannot be undone.`}
              warn
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {result && (
            <View style={[styles.result, result.verified ? styles.resultOk : styles.resultBad]}>
              <Text style={[styles.resultTitle, result.verified ? styles.resultTitleOk : styles.resultTitleBad]}>
                {result.verified ? 'Account verified' : 'Not usable for salary'}
              </Text>
              <Text style={styles.resultLine}>{result.message}</Text>
              {result.account.nameAtBank ? (
                <Text style={styles.resultLine}>Name at bank: {result.account.nameAtBank}</Text>
              ) : null}
              {/* Proof, on the one mode that produces any. */}
              {result.transfer?.utr ? (
                <Text style={styles.resultLine}>
                  Deposited ₹{result.transfer.amountDeposited ?? 1} · UTR {result.transfer.utr}
                </Text>
              ) : null}
              {!result.verified && result.accountExists ? (
                <Text style={styles.resultNote}>
                  The account exists but cannot receive salary — it may be blocked, frozen or an NRE account.
                </Text>
              ) : null}
            </View>
          )}

          <View style={styles.buttonGap}>
            <Button
              title={mode === 'pennydrop' ? `Verify with ${PENNY_DROP_AMOUNT} deposit` : 'Verify account'}
              onPress={run}
              loading={busy}
              disabled={busy || result?.verified === true}
            />
          </View>
          <Button title={result?.verified ? 'Done' : 'Back'} variant="outline" onPress={() => navigation.goBack()} />

          <Text style={styles.ration}>
            You can change your bank details a limited number of times. After that an administrator has to
            update them for you.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ModeOption({
  selected,
  onPress,
  title,
  detail,
  warn,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  detail: string;
  warn?: boolean;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.mode, selected && (warn ? styles.modeOnWarn : styles.modeOn)]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={18}
        color={selected ? (warn ? colors.warningText : colors.brand[700]) : colors.slate400}
      />
      <View style={styles.modeText}>
        <Text style={[styles.modeTitle, selected && warn && styles.modeTitleWarn]}>{title}</Text>
        <Text style={styles.modeDetail}>{detail}</Text>
      </View>
    </Pressable>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bgLight },
    scroll: { flexGrow: 1, padding: 24, paddingBottom: 40 },
    title: { fontSize: 17.5, fontWeight: '800', color: colors.textLight, textAlign: 'center' },
    subtitle: {
      fontSize: 11, color: colors.slate500, textAlign: 'center',
      marginTop: 8, marginBottom: 20, lineHeight: 18,
    },

    lookupRow: { marginBottom: 12 },
    branchCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.brand[50], borderRadius: radii.md,
      padding: 12, marginBottom: 16,
    },
    branchText: { flex: 1 },
    branchBank: { fontSize: 12.5, fontWeight: '800', color: colors.brand[700] },
    branchBranch: { fontSize: 11, color: colors.slate600, marginTop: 2 },

    fieldLabel: {
      fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3,
      color: colors.slate400, marginTop: 8, marginBottom: 8,
    },
    modes: { gap: 10, marginBottom: 16 },
    mode: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      borderWidth: 1.5, borderColor: colors.slate200, borderRadius: radii.md, padding: 12,
    },
    modeOn: { borderColor: colors.brand[700], backgroundColor: colors.brand[50] },
    modeOnWarn: { borderColor: colors.warningText, backgroundColor: colors.warningBg },
    modeText: { flex: 1 },
    modeTitle: { fontSize: 12.5, fontWeight: '800', color: colors.textLight },
    modeTitleWarn: { color: colors.warningText },
    modeDetail: { fontSize: 11, color: colors.slate500, marginTop: 3, lineHeight: 16 },

    errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },

    result: { borderRadius: radii.md, padding: 14, marginBottom: 16, gap: 4 },
    resultOk: { backgroundColor: colors.successBg },
    resultBad: { backgroundColor: colors.dangerBg },
    resultTitle: { fontSize: 13, fontWeight: '800' },
    resultTitleOk: { color: colors.successText },
    resultTitleBad: { color: colors.dangerText },
    resultLine: { fontSize: 11.5, color: colors.slate600, lineHeight: 16 },
    resultNote: { fontSize: 11, color: colors.slate500, marginTop: 4, lineHeight: 16 },

    buttonGap: { marginBottom: 12 },
    ration: { fontSize: 10.5, color: colors.slate400, textAlign: 'center', marginTop: 16, lineHeight: 15 },
  });
}
