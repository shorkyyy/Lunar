import React, { useRef, useState, useEffect } from 'react';
import { View, FlatList, Text, StyleSheet, Dimensions, TouchableOpacity, ImageBackground, ScrollView, SafeAreaView, Animated, TouchableWithoutFeedback, ActivityIndicator, StatusBar, Share, LayoutAnimation, UIManager } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { createClient } from 'pexels';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { Audio } from 'expo-av';
import * as SplashScreen from 'expo-splash-screen';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';


const tabs = ['For You', 'Liked']; // Customize your tabs
const client = createClient('XoJwUYOzKMoDE3chOvLGeDqEoSdDtUNseGnCEnIQB4n2V3Te2lMlQLHS');
SplashScreen.preventAutoHideAsync();

const LessonScreen = ({ navigation }) => {
      
    const flatListRef = useRef(null);
    const [expandedItem, setExpandedItem] = useState(null);
    const [imageLoaded, setImageLoaded] = useState({});
    const [imageUrls, setImageUrls] = useState({});
    const [activeTab, setActiveTab] = useState(0);
    const  activeTabIndexRef = useRef(0);
    const scrollViewRef = useRef(null);
    const [vocabularyData, setVocabularyData] = useState([]);
    const [loadingMore, setLoadingMore] = useState(false);
    const [overflowingItems, setOverflowingItems] = useState({});
    const [likedItemsFromStorage, setLikedItemsFromStorage] = useState([]);
    UIManager.setLayoutAnimationEnabledExperimental && UIManager.setLayoutAnimationEnabledExperimental(true);


  
    const fetchRandomWordsAndImages = async () => {
      try {
        const numberOfWords = 8;
    
        // Load your JSON file
        const vocabData = require('./lib/vocab.json');
    
        // Extract all words from the JSON file
        const allWords = Object.values(vocabData).flat();
    
        // Shuffle the array to randomize the order of words
        const shuffledWords = shuffleArray(allWords);
    
        // Take the first 5 unique words from the shuffled array
        const wordsToFetch = [];
    
        const isDuplicate = (word) => wordsToFetch.some((item) => item === word);
    
        for (const word of shuffledWords) {
          if (wordsToFetch.length >= numberOfWords) {
            break; // Exit the loop if we already have enough words
          }
    
          if (!isDuplicate(word)) {
            wordsToFetch.push(word);
          }
        }
    
        const combinedFetchPromises = wordsToFetch.map(async (word) => {
          try {
            const response = await axios.get(`https://wordsapiv1.p.rapidapi.com/words/${word}`, {
              headers: {
                'X-RapidAPI-Host': 'wordsapiv1.p.rapidapi.com',
                'X-RapidAPI-Key': 'a35d25fb98mshd2eb21dfb3d12aep16da25jsnb9e7d92258d1',
              },
            });
    
            const { word: apiWord, results, pronunciation } = response.data;
            await SplashScreen.hideAsync();
    
            if (Array.isArray(results) && results.length > 0) {
              setLoadingMore(true);
              const firstDefinition = capitalizeFirstLetter(results[0].definition);
              const firstPartOfSpeech = formatPartOfSpeech(results[0].partOfSpeech);
              const capitalizedWord = capitalizeFirstLetter(apiWord);
              const wordPronunciation = pronunciation
                ? pronunciation.all
                  ? `/${pronunciation.all}/`
                  : `/${pronunciation}/`
                : 'Unavailable';
    
              // Fetch image for the current word
              const imageUrl = await fetchImage(word);
    
              // Fetch audio URL for the current word
              const audioUrl = await fetchAudio(word);
    
              return {
                id: word,
                word: capitalizedWord,
                partOfSpeech: firstPartOfSpeech,
                meaning: firstDefinition,
                pronunciation: wordPronunciation,
                imageUrl: imageUrl,
                audioUrl: audioUrl,
              };
            } else {
              console.error(`No results found for word: ${word}`);
              return null; // Skip this word
            }
          } catch (error) {
            console.error(`Error fetching word '${word}': ${error.message}`);
            return null; // Skip this word
          }
        });
    
        const combinedResponses = await Promise.all(combinedFetchPromises);
        const validResponses = combinedResponses.filter((response) => response !== null);
    
        // Extract word details and image URLs
        const newVocabulary = validResponses.map((item) => {
          return {
            id: item.id,
            word: item.word,
            meaning: item.meaning,
            partOfSpeech: item.partOfSpeech,
            pronunciation: item.pronunciation,
            audioUrl: item.audioUrl,
          };
        });
    
        // Append the new words to the existing vocabulary data
        setVocabularyData((prevVocabularyData) => [...prevVocabularyData, ...newVocabulary]);
    
        const imageURLs = validResponses.reduce((acc, curr) => {
          acc[curr.id] = curr.imageUrl;
          return acc;
        }, {});
    
        setImageUrls((prevImageUrls) => ({ ...prevImageUrls, ...imageURLs }));
      } catch (error) {
        console.error('Error fetching random words and images:', error);
        await SplashScreen.hideAsync();
      }
    };       
    
    const fetchAudio = async (word) => {
      try {
          const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
          const phonetics = response.data[0]?.phonetics;
  
          if (phonetics && phonetics.length > 0 && phonetics[0].audio) {
              const audioUrl = phonetics[0].audio;
  
              // Preload the audio
              try {
                  const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
                  // You can store the sound instance somewhere for later use
              } catch (error) {
                  console.error('Error preloading audio:', error);
              }
  
              return audioUrl;
          } else {
              console.log('Pronunciation audio not available.');
          }
      } catch (error) {
          console.error('Error fetching pronunciation:', error);
      }
      return null;
  };
  
  const placeholderWords = [
    'landscape', 'city', 'sea', 'mountain', 'sky', 'Vintage product', 'japan shrine', 'mountain'
  ];
  
  const fetchedImages = new Set();
  
  const fetchImage = async (word) => {
    try {
      const response = await client.photos.search({ query: word, per_page: 2 });
      const photos = response.photos;
  
      if (photos.length > 0) {
        // Filter out images that have already been fetched
        const availableImages = photos.filter((photo) => !fetchedImages.has(photo.src.large));
  
        if (availableImages.length > 0) {
          let randomIndex = Math.floor(Math.random() * availableImages.length);
          let imageUrl = availableImages[randomIndex].src.large;
          fetchedImages.add(imageUrl);
          return imageUrl;
        }
      }
  
      // If no photos were found or all were duplicates, try placeholder images
      const shuffledPlaceholderWords = shuffleArray(placeholderWords.slice());
      for (const placeholderWord of shuffledPlaceholderWords) {
        const placeholderResponse = await client.photos.search({ query: placeholderWord, per_page: 3 });
        const placeholderPhotos = placeholderResponse.photos;
  
        if (placeholderPhotos.length > 0) {
          // Filter out placeholder images that have already been fetched
          const availablePlaceholderImages = placeholderPhotos.filter((photo) => !fetchedImages.has(photo.src.large));
  
          if (availablePlaceholderImages.length > 0) {
            let randomIndex = Math.floor(Math.random() * availablePlaceholderImages.length);
            let imageUrl = availablePlaceholderImages[randomIndex].src.large;
            fetchedImages.add(imageUrl);
            return imageUrl;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching image:', error);
    }
    return 'https://example.com/placeholder-image.jpg';
  };  
  
      // Function to capitalize the first letter of a string
      const capitalizeFirstLetter = (string) => {
          return string.charAt(0).toUpperCase() + string.slice(1);
      };      

      const formatPartOfSpeech = (string) => {
        if(string === 'noun') {
          return 'n';
        } else if (string === 'adjective') {
          return 'adj';
        } else if (string === 'adverb'){
          return 'adv';
        } else {
          return 'v';
        }
      }
        
      // Function to shuffle an array
      const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      };
      
      const renderTab = (tab, index) => (
        <TouchableWithoutFeedback
          key={tab}
          onPress={() => {
            if (vocabularyData.length > 0) {
              scrollViewRef.current.scrollTo({
                x: index * Dimensions.get('window').width,
                animated: true,
              });
              activeTabIndexRef.current = index; // Update the activeTabIndexRef
              setActiveTab(index); // Update the state to trigger re-render
            }
          }}
        >
          <View style={[styles.tab, activeTabIndexRef.current === index && styles.activeTab]}>
            <Text style={[styles.tabText, activeTabIndexRef.current === index && styles.activeTabText]}>
              {tab}
            </Text>
            {activeTabIndexRef.current === index && (
              <View style={styles.tabIndicator} />
            )}
          </View>
        </TouchableWithoutFeedback>
      );
      
    const [likedItems, setLikedItems] = useState([]);
    const [lastTapTime, setLastTapTime] = useState(0);
    const [heartScale] = useState(new Animated.Value(0));
    const [heartOpacity] = useState(new Animated.Value(0));
    const [heartPosition, setHeartPosition] = useState({ x: 0, y: 0 });
    const [currentLikedItem, setCurrentLikedItem] = useState(null);
    const [heartAnimationActive, setHeartAnimationActive] = useState(false);

    const handleDoubleTap = async (item, event) => {
      const currentTime = Date.now();
      const isLiked = likedItems.includes(item.id);
      const doubleTapThreshold = 600; // Set your desired double-tap threshold in milliseconds
      const heartSize = 30; // Update this with your heart icon size
      const heartSizeFactor = heartSize / 2;
    
      if (!heartAnimationActive && currentTime - lastTapTime < doubleTapThreshold) {
        const { locationX, locationY } = event.nativeEvent;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
        // Check if tap coordinates are within a reasonable range
        const tapPositionIsValid =
          locationX >= heartSizeFactor &&
          locationY >= heartSizeFactor &&
          locationX <= Dimensions.get('window').width - heartSizeFactor &&
          locationY <= Dimensions.get('window').height - heartSizeFactor;
    
        if (tapPositionIsValid) {
          setCurrentLikedItem(item);
          setHeartAnimationActive(true); // Set animation active
          startHeartBeatAnimation();
    
          const index = vocabularyData.findIndex((data) => data.id === item.id);
          if (index !== -1) {
            const initialHeartPosition = {
              x: locationX - heartSizeFactor,
              y: locationY - heartSizeFactor,
            };
    
            setHeartPosition(initialHeartPosition);
            heartScale.setValue(4);
            heartOpacity.setValue(1);
    
            setTimeout(() => {
              Animated.parallel([
                Animated.timing(heartScale, {
                  toValue: 9,
                  duration: 300,
                  useNativeDriver: true,
                }),
                Animated.timing(heartOpacity, {
                  toValue: 0,
                  duration: 300,
                  useNativeDriver: true,
                }),
              ]).start(() => {
                heartScale.setValue(0);
                heartOpacity.setValue(1);
                setCurrentLikedItem(null);
                setHeartAnimationActive(false); // Reset animation active
              });
            }, 400);
    
            // Check if the item is already liked
            if (!isLiked) {
              setLikedItems([...likedItems, item.id]);
    
              // Save the item to AsyncStorage
              try {
                const storedLikedItems = await AsyncStorage.getItem('likedItems');
                const parsedLikedItems = storedLikedItems ? JSON.parse(storedLikedItems) : [];
        
                // Add imageUrl to the item before saving
                const itemWithImageUrl = {
                    ...item,
                    imageUrl: imageUrls[item.id],   // Assign the imageUrl for the current item
                };
        
                const updatedStoredLikedItems = [...parsedLikedItems, itemWithImageUrl];
                await AsyncStorage.setItem(
                    'likedItems',
                    JSON.stringify(updatedStoredLikedItems)
                );
                // testSavedData();
              } catch (error) {
                console.error('Error saving liked item to AsyncStorage:', error);
              }
            }
          }
        }
      }
    
      setLastTapTime(currentTime);
    };    
   
  const heartBeatValue = useState(new Animated.Value(1))[0];

  const startHeartBeatAnimation = () => {
    Animated.sequence([
      Animated.timing(heartBeatValue, {
        toValue: 1.3, // Increase the value to make it slightly bigger
        duration: 150, // Duration of the first pulse
        useNativeDriver: true,
      }),
      Animated.timing(heartBeatValue, {
        toValue: 1, // Return to the original size
        duration: 150, // Duration of the second pulse
        useNativeDriver: true,
      }),
    ]).start();
  };

  // const testSavedData = async () => {
  //   try {
  //     const savedData = await AsyncStorage.getItem('likedItems');
  //     if (savedData) {
  //       console.log('Saved Data:', JSON.parse(savedData));
  //     } else {
  //       console.log('No data saved in AsyncStorage.');
  //     }
  //   } catch (error) {
  //     console.error('Error retrieving saved data from AsyncStorage:', error);
  //   }
  // };
  

    const toggleLike = async (item) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const isLiked = likedItems.includes(item.id);
    
      if (isLiked) {
        // Remove the item from the likedItems array
        const updatedLikedItems = likedItems.filter((id) => id !== item.id);
        setLikedItems(updatedLikedItems);
    
        // Remove the item from AsyncStorage
        try {
          const storedLikedItems = await AsyncStorage.getItem('likedItems');
          if (storedLikedItems) {
            const parsedLikedItems = JSON.parse(storedLikedItems);
            const updatedStoredLikedItems = parsedLikedItems.filter(
              (storedItem) => storedItem.id !== item.id
            );
            await AsyncStorage.setItem(
              'likedItems',
              JSON.stringify(updatedStoredLikedItems)
            );
    
            // // Test if data is saved
            // testSavedData();
          }
        } catch (error) {
          console.error('Error removing liked item from AsyncStorage:', error);
        }
      } else {
        startHeartBeatAnimation();
        setLikedItems([...likedItems, item.id]);
    
        // Save the item to AsyncStorage with imageUrl
        try {
          const storedLikedItems = await AsyncStorage.getItem('likedItems');
          const parsedLikedItems = storedLikedItems ? JSON.parse(storedLikedItems) : [];
    
          // Add imageUrl to the item before saving
          const itemWithImageUrl = {
            ...item,
            imageUrl: imageUrls[item.id],
          };
    
          const updatedStoredLikedItems = [...parsedLikedItems, itemWithImageUrl];
          await AsyncStorage.setItem(
            'likedItems',
            JSON.stringify(updatedStoredLikedItems)
          );
    
          // Test if data is saved
          // testSavedData();
        } catch (error) {
          console.error('Error saving liked item to AsyncStorage:', error);
        }
      }
    };
  
  
    const shareWord = (word, pronunciation, meaning, partOfSpeech) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      Share.share({
        message: `${word} ${pronunciation} (${partOfSpeech}): ${meaning}`,
      })
      .then(result => {
        if (result.action === Share.sharedAction) {
          if (result.activityType) {
            // Shared successfully
          } else {
            // Shared successfully
          }
        } else if (result.action === Share.dismissedAction) {
          // Dismissed sharing
        }
      })
      .catch(error => {
        console.error('Error sharing:', error);
      });
    };    
    const playPronunciation = async (audioUrl) => {
      try {
          // Play the preloaded audio
          const sound = new Audio.Sound();
          await sound.loadAsync({ uri: audioUrl });
          await sound.playAsync();
      } catch (error) {
          console.error('Error playing pronunciation audio:', error);
      }
  };
  const handleTextLayout = (event, index) => {
    const { lines } = event.nativeEvent;
 
    const isOverflowing = lines.length > 2;
  
    // Store the overflow state for the current item
    setOverflowingItems((prevOverflowingItems) => ({
      ...prevOverflowingItems,
      [index]: isOverflowing,
    }));
  };

  // Create a function to fetch and update liked items from AsyncStorage
  const fetchLikedItems = async () => {
    try {
      const storedLikedItems = await AsyncStorage.getItem('likedItems');
      if (storedLikedItems) {
        const parsedLikedItems = JSON.parse(storedLikedItems);
        setLikedItemsFromStorage(parsedLikedItems);
        setLikedItems(parsedLikedItems.map((item) => item.id)); // Initialize likedItems state
      }
    } catch (error) {
      console.error('Error retrieving liked items from AsyncStorage:', error);
    }
  };

  // Call the fetchLikedItems function whenever you switch to the "Liked" tab or in componentDidMount
  useEffect(() => {
    fetchLikedItems();
  }, [activeTab]); // activeTab is a state variable that changes when you switch tabs

  const customAnimationConfig = {
    duration: 200, // Adjust the duration (in milliseconds) as needed
    create: {
      type: LayoutAnimation.Types.linear,
      property: LayoutAnimation.Properties.opacity,
    },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
  };
  
  const toggleExpansion = (index) => {
    // Use your custom animation configuration
    LayoutAnimation.configureNext(customAnimationConfig);
    setExpandedItem(index === expandedItem ? null : index);
  };
  
  
  
    const renderItem = ({ item, index }) => {
        const isExpanded = index === expandedItem;
        const isLiked = likedItems.includes(item.id);
        const isImageLoaded = imageLoaded[item.id];
        const isOverflowing = overflowingItems[index];
        const shouldShowMoreButton = isOverflowing && !isExpanded;
        const isForYouTab = activeTab === 0; // Assuming 0 represents the "For You" tab
        const imageSource = isForYouTab ? imageUrls[item.id] : item.imageUrl;
        
        
    return (
      <View style={styles.cardContainer}>
        <TouchableWithoutFeedback
            onPress={(event) => handleDoubleTap(item, event)}
        >
        <ImageBackground
          source={{ uri: imageSource }}
          onLoad={() => setImageLoaded((prevLoaded) => ({ ...prevLoaded, [item.id]: true }))}
          style={styles.card}
          imageStyle={styles.card}
          resizeMode="cover"
        >
        <LinearGradient
            colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.6)','rgba(0, 0, 0, 0.9)']} // Adjust the gradient colors as needed
            style={styles.gradientContainer}>   
        </LinearGradient>  
          <View style={styles.contentContainer}>
            <View style={styles.wordContainer}>
                <Text style={styles.word}>{item.word}</Text>
                <Text style={styles.partOfSpeech}>({item.partOfSpeech})</Text>
                    {item.audioUrl ? (
                        <TouchableOpacity onPress={() => playPronunciation(item.audioUrl)}>
                            <Icon name="volume-up" size={25} color="#fff" style={styles.speakerIcon} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.disabledSpeakerIcon}>
                            <Icon name="volume-up" size={25} color="#999" style={styles.speakerIcon} />
                        </View>
                    )}
            </View>
            <Text style={styles.pronunciation}>{item.pronunciation}</Text>
          </View>
          <View style={styles.meaningContainer}>
          <Text
            numberOfLines={isExpanded ? 6 : 2}
            style={styles.meaning}
            onTextLayout={(event) => handleTextLayout(event, index)}
          >
            {item.meaning}
          </Text>
          {isOverflowing && !isExpanded && (
            <TouchableOpacity
              style={styles.seeMoreButton}
              onPress={() => toggleExpansion(index)}
            >
              <Text style={styles.seeMoreLink}>more</Text>
            </TouchableOpacity>
          )}
          {isExpanded && (
            <TouchableOpacity
              style={styles.seeMoreButton}
              onPress={() => toggleExpansion(index)}
            >
              <Text style={styles.seeMoreLink}>less</Text>
            </TouchableOpacity>
          )}
        </View>

          <View style={styles.sideButtonContainer}>
            <TouchableOpacity
            style={styles.likeButton}
            onPress={() => toggleLike (item)}
            >
                <View style={styles.iconTextContainer}>
                <Animated.View
                  style={{
                    transform: [{ scale: isLiked ? heartBeatValue : 1 }],
                  }}
                >
                  <Icon
                    name="heart"
                    size={30}
                    color={isLiked ? '#FF6B6B' : '#fff'}
                  />
                </Animated.View>
                <Text style={styles.buttonText}>Like</Text>
                </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => shareWord(item.word, item.pronunciation, item.meaning, item.partOfSpeech)}
            >
              <View style={styles.iconTextContainer}>
                <Icon name="share" size={30} color="#fff" />
                <Text style={styles.buttonText}>Share</Text>
              </View>
            </TouchableOpacity>
            </View>
            {currentLikedItem && currentLikedItem.id === item.id && (
                     <Animated.View
                         style={{
                            position: 'absolute',
                                top: heartPosition.y,
                                left: heartPosition.x,
                                transform: [
                                    { scale: heartScale },
                                ],
                                opacity: heartOpacity,
                            }}
                    >
                    <Icon name="heart" size={30} color="#FF6B6B" />
                </Animated.View>
            )}
        </ImageBackground>
        </TouchableWithoutFeedback>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        ref={scrollViewRef}
        // decelerationRate={1} 
        pagingEnabled
        onScroll={(event) => {
          const pageIndex = Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width);
          activeTabIndexRef.current = pageIndex;
          setActiveTab(pageIndex);
        }}
      >
      {vocabularyData.length === 0 && loadingMore ? ( // Check if data is loading and no items are available
        <View style={styles.activityIndicatorContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : (
          <FlatList
          
          on
          ref={flatListRef}
          data={vocabularyData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          pagingEnabled={true}
          // snapToAlignment="start"
          decelerationRate={'fast'} 
          onEndReached={fetchRandomWordsAndImages}
          onEndReachedThreshold={3} // Adjust this value based on your preference 
          ListFooterComponent={() => (
            <View style={{ marginTop: 5 }}>
              {loadingMore && vocabularyData.length > 0 ? (
                <ActivityIndicator size={30} color="#fff" />
              ) : null}
            </View>
          )}
         />
         
    )}  
      {vocabularyData.length > 0 && loadingMore ? (
        <View style={styles.cardContainer}>
          <View style={styles.likedContainer}>
            {likedItemsFromStorage.length > 0 ? (
              <FlatList
                data={likedItemsFromStorage}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                pagingEnabled={true}
                // likedItems={likedItems}
                // snapToAlignment="start"
                decelerationRate={'fast'}
              />
            ) : (
              <Text style={styles.noLikedText}>Oops! Nothing here yet</Text>
            )}
          </View>
        </View>
      ) : null}

          
      </ScrollView>
      <SafeAreaView style={styles.tabBar}>
        {tabs.map((tab, index) => renderTab(tab, index))}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',     // Center vertically
    position: 'absolute',
    top: StatusBar.currentHeight,
    left: 0,
    right: 0,
  },
  tab: {
    paddingHorizontal: 15,
  },
  tabText: {
    fontWeight: 'bold',
    fontSize: 18,
    color: 'rgba(204, 204, 204, 0.6)', // Adjust the alpha value (0.7 in this example)
  },
  activeTab: {
  },
  activeTabText: {
    fontWeight: 'bold',
    color: '#fff',
    fontSize: 18,
  },
  tabIndicator: {
    position: 'absolute',
    marginTop: 30,
    borderRadius: 2,
    borderBottomWidth: 3, // Adjust the thickness of the line as needed
    borderBottomColor: '#fff', // Change the color of the line as needed
    width: 35,
    alignSelf: 'center', // Center the line horizontally
  },
  
  activityIndicatorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: Dimensions.get('window').height + StatusBar.currentHeight, // Screen height
    width: Dimensions.get('window').width,
  },
  cardContainer: {
    flex: 1,
    height: Dimensions.get('window').height + StatusBar.currentHeight, // Screen height
    width: Dimensions.get('window').width,
  },
   card: {
    flex: 1,
    borderRadius: 20,
    },  

  cardImage: {
    borderRadius: 20,
    backgroundColor:'#000',
  },
  likedContainer: {
    flex: 1,
    backgroundColor: '#00000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  heartContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  gradientContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'column', // Arrange items vertically
    justifyContent: 'flex-end', // Align items to the bottom
    alignItems: 'flex-start', // Align items to the start (left)
    bottom: 80,
    left: 20,
  },
  word: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
  },
  partOfSpeech: {
    marginLeft: 5,
    fontSize: 25,
    fontWeight: 'bold',
    color: '#fff',
  },
  wordContainer: {
    flexDirection: 'row', // Arrange items horizontally
    alignItems: 'center', // Center items vertically
  },
  speakerIcon: {
    marginLeft: 10,
  },
    
  pronunciation: {
    fontSize: 18,
    color: '#ccc',

  },
  meaningContainer:{
    flexDirection: 'row', // Arrange items vertically
    bottom: 50,
    left: 20,
    // alignSelf: 'flex-start',
    // marginRight: 5,
    width: 250,
  },
  meaning: {
    flex: 1,
    fontSize: 18,
    color: '#ccc',
    // marginRight: 14,
  },
  sideButtonContainer: {
    position: 'absolute',
    bottom: 50,
    right: 20,
    flexDirection: 'column',
    alignItems: 'flex-end',
    alignContent: 'flex-end',
  },
  iconTextContainer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  
  likeButton: {
    marginBottom: 35,
  },
  shareButton: {
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 5,
  },
  seeMoreLink: {
    position: 'absolute',
    bottom: 0,
    // left: 5,
    paddingHorizontal: 5,
    // alignSelf: 'flex-end',
    color: '#ccc',
    fontSize: 18,
    opacity: 0.6,
    
  },
  noLikedText: {
    color: '#fff',
    fontSize: 18,
  }
});

export default LessonScreen;
