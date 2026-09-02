import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { KycStackParamList } from './types';
import { KycGateScreen } from '../screens/kyc/KycGateScreen';
import { PanVerifyScreen } from '../screens/kyc/PanVerifyScreen';
import { AadhaarOtpRequestScreen } from '../screens/kyc/AadhaarOtpRequestScreen';
import { AadhaarOtpVerifyScreen } from '../screens/kyc/AadhaarOtpVerifyScreen';

const Stack = createNativeStackNavigator<KycStackParamList>();

export function KycStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="KycGate" component={KycGateScreen} />
      <Stack.Screen name="PanVerify" component={PanVerifyScreen} />
      <Stack.Screen name="AadhaarOtpRequest" component={AadhaarOtpRequestScreen} />
      <Stack.Screen name="AadhaarOtpVerify" component={AadhaarOtpVerifyScreen} />
    </Stack.Navigator>
  );
}
