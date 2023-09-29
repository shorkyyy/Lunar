import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const AboutScreen = () => {
  return (
    <View style={styles.container}>
      <Image style={styles.logo} source={require('./img/logo.png')}></Image>
      <Text style={styles.title}>Apollo</Text>
      <Text style={styles.description}>
        Made by The Orange Team with love
      </Text>
      <Text style={styles.version}>Your version is up to date</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text style={styles.version}>Version: 2.0.1</Text>
      <Icon name="check-circle" size={16} color="#9BBFE7" style={styles.checkIcon}/>
      </View>
    
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212', // Dark background color
  },
  logo: {
    width: 300, // Adjust the width to make the logo smaller
    height: 300, // Adjust the height to make the logo smaller
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 0, // Add margin-top to create space between the logo and title
    marginBottom: 10,
    color: '#fff', // White text color for dark mode
  },
  description: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    color: 'rgba(255, 255, 255, 0.8)', // Light text color for dark mode
  },
  version: {
    fontSize: 16,
    color: 'gray',
  },
  checkIcon: {
    marginLeft: 6,
  },
});

export default AboutScreen;
