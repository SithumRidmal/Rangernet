import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { SignInScreen } from './screens/SignInScreen';
import { RegisterScreen, RegisterSuccessScreen } from './screens/RegisterScreen';
import {
  ForgotPasswordScreen,
  OtpScreen,
  PasswordUpdatedScreen,
  ResetPasswordScreen,
} from './screens/PasswordRecoveryScreens';

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  Register: undefined;
  RegisterSuccess: { email: string };
  ForgotPassword: undefined;
  Otp: { email: string };
  ResetPassword: undefined;
  PasswordUpdated: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator({ initialRoute = 'Welcome' }: { initialRoute?: keyof AuthStackParamList }) {
  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="RegisterSuccess" component={RegisterSuccessScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="PasswordUpdated" component={PasswordUpdatedScreen} />
    </Stack.Navigator>
  );
}
