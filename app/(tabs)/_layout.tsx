import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/theme/ThemeContext';
import { fonts } from '@/src/theme/colors';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          // The capture pill on the home screen floats above the tab bar, so
          // we add a touch of vertical padding here for breathing room.
          paddingBottom: 8,
          paddingTop: 8,
          height: 68,
          // Soft elevation in lieu of a hard border line.
          shadowColor: colors.shadow,
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.sans,
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.4,
        },
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: {
          color: colors.text,
          fontFamily: fonts.serif,
          fontSize: 18,
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Library',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="tags"
        options={{
          title: 'Tags',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pricetag-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
