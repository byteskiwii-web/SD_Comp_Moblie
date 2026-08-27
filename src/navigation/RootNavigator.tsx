import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthStack } from './AuthStack';
import { HomeScreen } from '../screens/home/HomeScreen';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/tokens';

export function RootNavigator() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.brand[700]} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {token ? <HomeScreen /> : <AuthStack />}
    </NavigationContainer>
  );
}
