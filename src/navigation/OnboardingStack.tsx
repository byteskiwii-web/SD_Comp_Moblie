import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from './types';
import { OnboardingChecklistScreen } from '../screens/onboarding/OnboardingChecklistScreen';
import { CompleteProfileScreen } from '../screens/onboarding/CompleteProfileScreen';
import { PanVerifyScreen } from '../screens/kyc/PanVerifyScreen';
import { AadhaarOtpRequestScreen } from '../screens/kyc/AadhaarOtpRequestScreen';
import { AadhaarOtpVerifyScreen } from '../screens/kyc/AadhaarOtpVerifyScreen';
import { BankVerifyScreen } from '../screens/kyc/BankVerifyScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * Everything a new employee can do before HR approves them, behind one
 * checklist. The verification screens are the same ones Profile hosts
 * later, under the same route names, so each one's "done, go back" lands
 * on the checklist here and on the Profile hub afterwards.
 */
export function OnboardingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingChecklist" component={OnboardingChecklistScreen} />
      <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
      <Stack.Screen name="PanVerify" component={PanVerifyScreen} />
      <Stack.Screen name="AadhaarOtpRequest" component={AadhaarOtpRequestScreen} />
      <Stack.Screen name="AadhaarOtpVerify" component={AadhaarOtpVerifyScreen} />
      <Stack.Screen name="BankVerify" component={BankVerifyScreen} />
    </Stack.Navigator>
  );
}
