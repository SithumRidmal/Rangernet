import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ChartNoAxesCombinedIcon, EllipsisIcon, FileTextIcon, HouseIcon } from 'lucide-react-native';
import { RoleTabBar, type TabIconMap } from '@shared/navigation/TabBar';
import { SyncCenterScreen } from '@shared/sync/SyncCenterScreen';
import { ProfileScreen } from '@shared/profile/ProfileScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { AnalysisOptionsScreen } from '../screens/AnalysisOptionsScreen';
import { AnalysisFiltersScreen } from '../screens/AnalysisFiltersScreen';
import { AnalyzingScreen } from '../screens/AnalyzingScreen';
import { AnalysisResultsScreen } from '../screens/AnalysisResultsScreen';
import { ReportGenerateScreen } from '../screens/ReportGenerateScreen';
import { ReportsLibraryScreen } from '../screens/ReportsLibraryScreen';
import { ReportDetailScreen } from '../screens/ReportDetailScreen';
import { MoreTabScreen } from '../screens/MoreTabScreen';
import { NotificationsRoute } from '../screens/NotificationsRoute';
import type { ParkManagerStackParamList, ParkManagerTabParamList } from './types';

const Stack = createNativeStackNavigator<ParkManagerStackParamList>();
const Tab = createBottomTabNavigator<ParkManagerTabParamList>();

const TAB_ICONS: TabIconMap = {
  Home: { label: 'Home', icon: HouseIcon },
  Analysis: { label: 'Analysis', icon: ChartNoAxesCombinedIcon },
  Reports: { label: 'Reports', icon: FileTextIcon },
  More: { label: 'More', icon: EllipsisIcon },
};

function ParkManagerTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <RoleTabBar {...props} icons={TAB_ICONS} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Analysis" component={AnalysisOptionsScreen} />
      <Tab.Screen name="Reports" component={ReportsLibraryScreen} />
      <Tab.Screen name="More" component={MoreTabScreen} />
    </Tab.Navigator>
  );
}

export function ParkManagerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={ParkManagerTabs} />
      <Stack.Screen name="AnalysisFilters" component={AnalysisFiltersScreen} />
      <Stack.Screen name="Analyzing" component={AnalyzingScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="AnalysisResults" component={AnalysisResultsScreen} />
      <Stack.Screen name="ReportGenerate" component={ReportGenerateScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
      <Stack.Screen name="SyncCenter" component={SyncCenterScreen} />
      <Stack.Screen name="Notifications" component={NotificationsRoute} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
