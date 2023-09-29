import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LessonScreen from './src/LessonScreen'; // Import the LessonScreen component
import { Text, View } from 'react-native';
import AboutScreen from './src/AboutScreen';

const Stack = createStackNavigator();

const LessonDetailScreen = ({ route }) => {
  const { lessonId } = route.params;

  // Fetch lesson details based on lessonId

  return (
    <View>
      <Text>Lesson Detail Screen for Lesson {lessonId}</Text>
    </View>
  );
};

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Lessons"
        screenOptions={{
          headerStyle: {
            backgroundColor: 'black', // Set the header background color to black
          },
          headerTintColor: 'white', // Set the header text color to white
          headerTransparent: true, // Make the header transparent
        }}
      >
        <Stack.Screen name="Lessons" component={LessonScreen} options={{ headerShown: false }}  />
        <Stack.Screen name="LessonDetail" component={LessonDetailScreen} />
        <Stack.Screen name="AboutScreen" component={AboutScreen} options={{ headerTitle: '' }}/>
      </Stack.Navigator>
      <StatusBar style="light" />
      <StatusBar style="light" androidNavigationBarStyle="light-content" />
    </NavigationContainer>
  );
}
