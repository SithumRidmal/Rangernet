import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { EllipsisIcon, FileTextIcon, LayoutDashboardIcon, SirenIcon } from 'lucide-react-native';
import { RoleTabBar, type TabIconMap } from '@shared/navigation/TabBar';
import { SyncCenterScreen } from '@shared/sync/SyncCenterScreen';
import { ProfileScreen } from '@shared/profile/ProfileScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { ResponsesScreen } from '../screens/ResponsesScreen';
import { CloMoreScreen } from '../screens/CloMoreScreen';
import { ReportReviewScreen } from '../screens/ReportReviewScreen';
import { AssignRangerScreen } from '../screens/AssignRangerScreen';
import { ResponseCoordinatedScreen } from '../screens/ResponseCoordinatedScreen';
import { ResponseTrackingScreen } from '../screens/ResponseTrackingScreen';
import { CloNotificationsScreen } from '../screens/CloNotificationsScreen';
import type { CloStackParamList, CloTabParamList } from './types';

const Stack = createNativeStackNavigator<CloStackParamList>();
const Tab = createBottomTabNavigator<CloTabParamList>();

const TAB_ICONS: TabIconMap = {
  Dashboard: { label: 'Dashboard', icon: LayoutDashboardIcon },
  Reports: { label: 'Reports', icon: FileTextIcon },
  Responses: { label: 'Responses', icon: SirenIcon },
  More: { label: 'More', icon: EllipsisIcon },
};

function CloTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <RoleTabBar {...props} icons={TAB_ICONS} />}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Responses" component={ResponsesScreen} />
      <Tab.Screen name="More" component={CloMoreScreen} />
    </Tab.Navigator>
  );
}

export function CloNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={CloTabs} />
      <Stack.Screen name="ReportReview" component={ReportReviewScreen} />
      <Stack.Screen name="AssignRanger" component={AssignRangerScreen} />
      <Stack.Screen name="ResponseCoordinated" component={ResponseCoordinatedScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="ResponseTracking" component={ResponseTrackingScreen} />
      <Stack.Screen name="SyncCenter" component={SyncCenterScreen} />
      <Stack.Screen name="Notifications" component={CloNotificationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
