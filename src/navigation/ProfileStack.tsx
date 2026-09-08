import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { BankVerifyScreen } from '../screens/kyc/BankVerifyScreen';
import type { ProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

/**
 * Profile, plus the screens reached from it.
 *
 * Bank verification lives here rather than in KycStack because KycStack only
 * exists while the KYC gate is up, and the gate is satisfied by PAN and
 * Aadhaar alone -- deliberately, since blocking somebody from clocking in over
 * a missing bank account would stop them working. So by the time anyone can
 * reach Profile, KycStack has unmounted and the bank screen would have had no
 * route in at all.
 */
export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="BankVerify" component={BankVerifyScreen} />
    </Stack.Navigator>
  );
}
