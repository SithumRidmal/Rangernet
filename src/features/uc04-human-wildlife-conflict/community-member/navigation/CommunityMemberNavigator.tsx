import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClipboardListIcon, HouseIcon, MenuIcon, PawPrintIcon } from 'lucide-react-native';
import { RoleTabBar, type TabIconMap } from '@shared/navigation/TabBar';
import { SyncCenterScreen } from '@shared/sync/SyncCenterScreen';
import { ProfileScreen } from '@shared/profile/ProfileScreen';
import { ReportDraftProvider } from '../context/ReportDraftProvider';
import { HomeScreen } from '../screens/HomeScreen';
import { ReportHubScreen } from '../screens/ReportHubScreen';
import { MyReportsScreen } from '../screens/MyReportsScreen';
import { MoreTabScreen } from '../screens/MoreTabScreen';
import { NotificationsRoute } from '../screens/NotificationsRoute';
import { ReportDetailScreen } from '../screens/ReportDetailScreen';
import { SmsReportScreen } from '../screens/SmsReportScreen';
import { ReportTypeScreen } from '../screens/report/ReportTypeScreen';
import { ReportLocationScreen } from '../screens/report/ReportLocationScreen';
import { ReportDetailsScreen } from '../screens/report/ReportDetailsScreen';
import { ReportReviewScreen } from '../screens/report/ReportReviewScreen';
import { ReportSuccessScreen } from '../screens/report/ReportSuccessScreen';
import type { CommunityStackParamList, CommunityTabParamList } from './types';

const Stack = createNativeStackNavigator<CommunityStackParamList>();
const Tab = createBottomTabNavigator<CommunityTabParamList>();

const TAB_ICONS: TabIconMap = {
  Home: { label: 'Home', icon: HouseIcon },
  Report: { label: 'Report', icon: PawPrintIcon },
  MyReports: { label: 'My Reports', icon: ClipboardListIcon },
  More: { label: 'More', icon: MenuIcon },
};

function CommunityTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <RoleTabBar {...props} icons={TAB_ICONS} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Report" component={ReportHubScreen} />
      <Tab.Screen name="MyReports" component={MyReportsScreen} />
      <Tab.Screen name="More" component={MoreTabScreen} />
    </Tab.Navigator>
  );
}

export function CommunityMemberNavigator() {
  return (
    <ReportDraftProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={CommunityTabs} />
        <Stack.Screen name="ReportType" component={ReportTypeScreen} />
        <Stack.Screen name="ReportLocation" component={ReportLocationScreen} />
        <Stack.Screen name="ReportDetails" component={ReportDetailsScreen} />
        <Stack.Screen name="ReportReview" component={ReportReviewScreen} />
        <Stack.Screen name="ReportSuccess" component={ReportSuccessScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="SmsReport" component={SmsReportScreen} />
        <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
        <Stack.Screen name="SyncCenter" component={SyncCenterScreen} />
        <Stack.Screen name="Notifications" component={NotificationsRoute} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </ReportDraftProvider>
  );
}
