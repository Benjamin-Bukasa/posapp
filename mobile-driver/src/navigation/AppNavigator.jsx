import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  House,
  MapPinned,
  Package,
  UserRound,
} from "lucide-react-native";
import LoginScreen from "../screens/auth/LoginScreen";
import AssignmentsScreen from "../screens/home/AssignmentsScreen";
import HomeScreen from "../screens/home/HomeScreen";
import LiveMapScreen from "../screens/home/LiveMapScreen";
import SettingsScreen from "../screens/home/SettingsScreen";
import useAuthStore from "../stores/authStore";
import { useThemePalette } from "../theme/useThemePalette";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const DriverTabs = () => {
  const palette = useThemePalette();
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom + 12, 28);

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.tabBarActive,
        tabBarInactiveTintColor: palette.tabBarInactive,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: 2,
        },
        tabBarStyle: {
          position: "relative",
          left: "5%",
          right: "5%",
          bottom: bottomOffset,
          backgroundColor: palette.tabBar,
          borderTopColor: palette.border,
          borderWidth: 0,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
          borderRadius: 22,
          elevation: 15,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.2,
          shadowRadius: 24,
        },
        tabBarItemStyle: {
          borderRadius: 10,
          marginHorizontal: 0,
        },
        sceneStyle: {
          backgroundColor: palette.background,
        },
      }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => <House size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Assignments"
        component={AssignmentsScreen}
        options={{
          title: "Envois",
          tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Map"
        component={LiveMapScreen}
        options={{
          title: "Tracking",
          tabBarIcon: ({ color, size }) => <MapPinned size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={SettingsScreen}
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <UserRound size={size} color={color} />,
        }}
      />
    </Tabs.Navigator>
  );
};

const AppNavigator = () => {
  const palette = useThemePalette();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: palette.background,
          card: palette.surface,
          border: palette.border,
          primary: palette.secondaryValue,
          text: palette.textPrimary,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="DriverTabs" component={DriverTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
