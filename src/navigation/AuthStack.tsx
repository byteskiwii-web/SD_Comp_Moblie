import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ForgotPasswordRequestScreen } from '../screens/auth/ForgotPasswordRequestScreen';
import { ForgotPasswordVerifyScreen } from '../screens/auth/ForgotPasswordVerifyScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPasswordRequest" component={ForgotPasswordRequestScreen} />
      <Stack.Screen name="ForgotPasswordVerify" component={ForgotPasswordVerifyScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}
