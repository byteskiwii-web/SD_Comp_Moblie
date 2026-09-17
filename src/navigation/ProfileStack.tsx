import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { WorkDetailsScreen } from '../screens/profile/sections/WorkDetailsScreen';
import { IdentityScreen } from '../screens/profile/sections/IdentityScreen';
import { DocumentsScreen } from '../screens/profile/sections/DocumentsScreen';
import { PersonalScreen } from '../screens/profile/sections/PersonalScreen';
import { KitScreen } from '../screens/profile/sections/KitScreen';
import { PoliciesScreen } from '../screens/profile/sections/PoliciesScreen';
import { PreferencesScreen } from '../screens/profile/sections/PreferencesScreen';
import { AccountScreen } from '../screens/profile/sections/AccountScreen';
import { BankVerifyScreen } from '../screens/kyc/BankVerifyScreen';
import { PanVerifyScreen } from '../screens/kyc/PanVerifyScreen';
import { AadhaarOtpRequestScreen } from '../screens/kyc/AadhaarOtpRequestScreen';
import { AadhaarOtpVerifyScreen } from '../screens/kyc/AadhaarOtpVerifyScreen';
import type { ProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

/**
 * Profile, plus the screens reached from it.
 *
 * The hub (ProfileHome) is a menu; the eight section screens under it are
 * the topics that used to be stacked on one page. Then the KYC screens,
 * which Identity opens.
 *
 * The verification screens are hosted here as well as in OnboardingStack:
 * that stack only exists until HR approves the employee, and a check that
 * later expires or fails has to be redoable from Profile.
 */
export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="WorkDetails" component={WorkDetailsScreen} />
      <Stack.Screen name="Identity" component={IdentityScreen} />
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="Personal" component={PersonalScreen} />
      <Stack.Screen name="Kit" component={KitScreen} />
      <Stack.Screen name="Policies" component={PoliciesScreen} />
      <Stack.Screen name="Preferences" component={PreferencesScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="BankVerify" component={BankVerifyScreen} />
      <Stack.Screen name="PanVerify" component={PanVerifyScreen} />
      <Stack.Screen name="AadhaarOtpRequest" component={AadhaarOtpRequestScreen} />
      <Stack.Screen name="AadhaarOtpVerify" component={AadhaarOtpVerifyScreen} />
    </Stack.Navigator>
  );
}
