import { Tabs } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#007AFF',
      tabBarInactiveTintColor: '#8E8E93',
      tabBarStyle: {
        borderTopWidth: 1,
        borderTopColor: '#E5E5EA',
      },
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="compass" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="quest-log"
        options={{
          title: 'Quest Log',
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="scroll" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="user" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
