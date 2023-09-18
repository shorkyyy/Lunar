import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { View, FlatList, Text, StyleSheet, Dimensions, TouchableOpacity, Image, ImageBackground, ScrollView, SafeAreaView, Animated, TouchableWithoutFeedback, ActivityIndicator, StatusBar, Share, LayoutAnimation, UIManager, Easing } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { createClient } from 'pexels';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { Audio } from 'expo-av';
import * as SplashScreen from 'expo-splash-screen';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TextTicker from 'react-native-text-ticker'

const tabs = ['For You', 'Liked']; 
const client = createClient('XoJwUYOzKMoDE3chOvLGeDqEoSdDtUNseGnCEnIQB4n2V3Te2lMlQLHS');
SplashScreen.preventAutoHideAsync();

const LessonScreen = ({ navigation }) => {
      
    const flatListRef = useRef(null);
    const [expandedItem, setExpandedItem] = useState(null);
    const [imageLoaded, setImageLoaded] = useState({});
    const [imageUrls, setImageUrls] = useState({});
    const [activeTab, setActiveTab] = useState(0);
    const activeTabIndexRef = useRef(0);
    const scrollViewRef = useRef(null);
    const [vocabularyData, setVocabularyData] = useState([]);
    const [loadingMore, setLoadingMore] = useState(false);
    const [overflowingItems, setOverflowingItems] = useState({});
    const [likedItemsFromStorage, setLikedItemsFromStorage] = useState([]);
    const [newLikedItemsAdded, setNewLikedItemsAdded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [maxCachedImages] = useState(50); // Set your desired maximum cache limit
    const [cachedImageUrls, setCachedImageUrls] = useState({}); // Cache for image URLs
  
    const cacheImageUrl = (id, imageUrl) => {
      setCachedImageUrls((prevCache) => {
        const updatedCache = { ...prevCache, [id]: imageUrl };
        const keys = Object.keys(updatedCache);
        if (keys.length > maxCachedImages) {
          // Remove the oldest item to maintain the cache limit
          delete updatedCache[keys[0]];
        }
        return updatedCache;
      });
    };

    const onImageLoad = (id, imageUrl) => {
      cacheImageUrl(id, imageUrl);
      setImageLoaded((prevLoaded) => ({ ...prevLoaded, [id]: true }));
    };

    UIManager.setLayoutAnimationEnabledExperimental && UIManager.setLayoutAnimationEnabledExperimental(true);
  
    const fetchRandomWordsAndImages = async () => {
      try {
        const numberOfWords = 5;
    
        const vocabData = require('./lib/vocab.json');
        const allWords = Object.values(vocabData).flat();
        const shuffledWords = shuffleArray(allWords);
        const wordsToFetch = new Set();
        for (const word of shuffledWords) {
          if (wordsToFetch.size >= numberOfWords) {
            break; 
          }
          wordsToFetch.add(word);
        }
    
        const combinedFetchPromises = Array.from(wordsToFetch).map(async (word) => {
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
              return null; 
            }
          } catch (error) {
            return null;
          }
        });
    
        const combinedResponses = await Promise.all(combinedFetchPromises);
        const validResponses = combinedResponses.filter((response) => response !== null);
    
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
    
    const fetchAudio = useMemo(() => {
      return async (word) => {
        try {
          const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
          const phonetics = response.data[0]?.phonetics;
  
          if (phonetics && phonetics.length > 0 && phonetics[0].audio) {
            const audioUrl = phonetics[0].audio;
            try {
              const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
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
    }, []);
  
  const placeholderWords = [
    'serenity', 'elegance', 'innovation', 'blossom', 'grace', 'inspiration'
  ];  
  
  const fetchedImages = new Set();
  const usedQueries = new Set();
  
  const fetchImage = useMemo(() => {
    const cachedImageUrls = {};

    return async (word) => {
      try {
        // Check if the image URL is already cached
        if (cachedImageUrls[word]) {
          return cachedImageUrls[word];
        }

        // Search for images using the given word
        const response = await client.photos.search({ query: word, per_page: 4 });
        const photos = response.photos;

        // Find the first available image that is not in fetchedImages
        const availableImage = photos.find((photo) => !fetchedImages.has(photo.src.large));

        if (availableImage) {
          const imageUrl = availableImage.src.large;
          fetchedImages.add(imageUrl);

          // After successfully fetching the image URL, cache it
          cachedImageUrls[word] = imageUrl;

          return imageUrl;
        }

        // If no photos were found or all were duplicates, try placeholder images
        // Shuffle the placeholderWords array to avoid using the same word repeatedly
        const shuffledWords = shuffleArray(placeholderWords);

        for (const placeholderWord of shuffledWords) {
          // Reset usedQueries Set for each placeholder word
          usedQueries.clear();

          const placeholderResponse = await client.photos.search({ query: placeholderWord, per_page: 4 });
          const placeholderPhotos = placeholderResponse.photos;

          // Find the first available placeholder image that is not in fetchedImages
          const availablePlaceholderImage = placeholderPhotos.find((photo) => !fetchedImages.has(photo.src.large));

          if (availablePlaceholderImage) {
            const imageUrl = availablePlaceholderImage.src.large;
            fetchedImages.add(imageUrl);

            // After successfully fetching the image URL, cache it
            cachedImageUrls[word] = imageUrl;

            return imageUrl;
          }
        }
      } catch (error) {
        console.error('Error fetching image:', error);
      }

      return 'https://example.com/placeholder-image.jpg'; // Default placeholder image URL
    };
  }, [fetchedImages]);
  
  const shuffleArray = (array) => {
    let currentIndex = array.length, randomIndex;
  
    while (currentIndex != 0) {
  
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
  };  
  
      // Function to capitalize the first letter of a string
      const capitalizeFirstLetter = (string) => {
          return string.charAt(0).toUpperCase() + string.slice(1);
      };      

      const formatPartOfSpeech = (string) => {
        const partsOfSpeech = {
          noun: 'n',
          adjective: 'adj',
          adverb: 'adv'
        };
        return partsOfSpeech[string] || 'v';
      }      
      
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

              if (index === 1) {
                setNewLikedItemsAdded(false);
              }
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
            {index === 1 && newLikedItemsAdded && (
              <View style={styles.dot} />
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
    const spinValue = useRef(new Animated.Value(0)).current;

    const handleDoubleTap = useCallback(async (item, event) => {
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
          await AsyncStorage.setItem('newLikedItemsAdded', 'true');
          setNewLikedItemsAdded(true);
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
              } catch (error) {
                console.error('Error saving liked item to AsyncStorage:', error);
              }
            }
          }
        }
      }
    
      setLastTapTime(currentTime);
    }, [likedItems, heartAnimationActive, lastTapTime, vocabularyData, imageUrls]); 
      
   
  const heartBeatValue = useState(new Animated.Value(1))[0];

  const startHeartBeatAnimation = () => {
    Animated.sequence([
      Animated.timing(heartBeatValue, {
        toValue: 1.3, 
        duration: 150, 
        useNativeDriver: true,
      }),
      Animated.timing(heartBeatValue, {
        toValue: 1, 
        duration: 150, 
        useNativeDriver: true,
      }),
    ]).start();
  };
  const toggleLike = async (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isLiked = likedItems.includes(item.id);
  
    if (isLiked) {
      const updatedLikedItems = likedItems.filter((id) => id !== item.id);
      setLikedItems(updatedLikedItems);
  
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

          await AsyncStorage.setItem('newLikedItemsAdded', 'false');
          setNewLikedItemsAdded(false);
        }
      } catch (error) {
        console.error('Error removing liked item from AsyncStorage:', error);
      }
    } else {
      startHeartBeatAnimation();
      setLikedItems([...likedItems, item.id]);
      try {
        const storedLikedItems = await AsyncStorage.getItem('likedItems');
        const parsedLikedItems = storedLikedItems ? JSON.parse(storedLikedItems) : [];
        const itemWithImageUrl = {
          ...item,
          imageUrl: imageUrls[item.id],
        };
  
        const updatedStoredLikedItems = [...parsedLikedItems, itemWithImageUrl];
        await AsyncStorage.setItem(
          'likedItems',
          JSON.stringify(updatedStoredLikedItems)
        );
  
        // Set newLikedItemsAdded to true
        await AsyncStorage.setItem('newLikedItemsAdded', 'true');
        setNewLikedItemsAdded(true);
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
          } else {
          }
        } else if (result.action === Share.dismissedAction) {
        }
      })
      .catch(error => {
        console.error('Error sharing:', error);
      });
    };    
    const playPronunciation = async (audioUrl) => {
      try {
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
    
    setOverflowingItems((prevOverflowingItems) => ({
      ...prevOverflowingItems,
      [index]: isOverflowing,
    }));
  };
  
  const fetchLikedItems = async () => {
    try {
      const storedLikedItems = await AsyncStorage.getItem('likedItems');
      if (storedLikedItems) {
        const parsedLikedItems = JSON.parse(storedLikedItems);
        setLikedItemsFromStorage(parsedLikedItems);
        setLikedItems(parsedLikedItems.map((item) => item.id)); 
      }
    } catch (error) {
      console.error('Error retrieving liked items from AsyncStorage:', error);
    }
  };

  useEffect(() => {
    fetchLikedItems();
  }, [activeTab]); 
  
  
  useEffect(() => {
    async function fetchDotState() {
      try {
        const dotState = await AsyncStorage.getItem('newLikedItemsAdded');
        if (dotState !== null) {
          setNewLikedItemsAdded(dotState === 'true');
        }
      } catch (error) {
        console.error('Error fetching dot state from AsyncStorage:', error);
      }
    }

    fetchDotState();
  }, []);

  const customAnimationConfig = {
    duration: 200, 
    create: {
      type: LayoutAnimation.Types.linear,
      property: LayoutAnimation.Properties.opacity,
    },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
  };
  
  const toggleExpansion = (index) => {
    LayoutAnimation.configureNext(customAnimationConfig);
    setExpandedItem(index === expandedItem ? null : index);
  };
  
  const [sound, setSound] = useState(null);
  const [songName, setSongName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [albumArt, setAlbumArt] = useState('');

  const JAMENDO_API_KEY = 'aa92f003'; 
  const keyword = 'piano';
  const maxOffset = 5; 
  const playedSongs = []; 

  async function loadRandomMusicFromJamendo() {
    let track = null;

    while (!track) {
      try {
        const offset = Math.floor(Math.random() * maxOffset);

        const JAMENDO_ENDPOINT = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_API_KEY}&limit=1&format=jsonpretty&search=${keyword}&offset=${offset}`;

        const response = await axios.get(JAMENDO_ENDPOINT);
        if (response.data.results.length === 0) {
          console.error(`No songs found for keyword: ${keyword}`);
          break;
        }
        track = response.data.results[0];

        if (track && track.audio && !playedSongs.includes(track.id)) {
          playedSongs.push(track.id); // Add the song id to the playedSongs array
        
          const { sound } = await Audio.Sound.createAsync({ uri: track.audio });
          setSound(sound);
          await sound.playAsync();
        
          // Get the song name, artist name, and album art
          const songName = track.name;
          const artistName = track.artist_name;
          const albumArtUrl = track.image;
        
          // Update the songName and artistName state variables
          setSongName(songName);
          setArtistName(artistName);
          setAlbumArt(albumArtUrl);
        
          // Reset and start the animation
          // resetAndStartAnimation();
        
          // Add an event listener to detect when the current song ends
          sound.setOnPlaybackStatusUpdate(async (status) => {
            if (status.didJustFinish) {
              // If the song ended, load and play a new random song
              await loadRandomMusicFromJamendo();
            }
          });
        } else {
          console.error('No audio track found in Jamendo response or song already played. Retrying...');
        }
      } catch (error) {
        console.error('Error fetching track from Jamendo:', error);
      }
    }
  }

  // const startSpinAnimation = () => {
  //   Animated.loop(
  //     Animated.timing(spinValue, {
  //       toValue: 1,
  //       duration: 4000,  // 4 seconds for one complete rotation
  //       easing: Easing.linear,
  //       useNativeDriver: true,
  //     })
  //   ).start();
  // };
  
  // const stopSpinAnimation = () => {
  //   if (isPlaying && sound) {
    
  //     Animated.timing(spinValue, {
  //       toValue: 1,
  //       duration: 4000, 
  //       easing: Easing.out(Easing.exp),
  //       useNativeDriver: true,
  //     }).start(() => {
  //       spinValue.setValue(0);
  //     });
  //   }
  // };  
  
  // const spin = spinValue.interpolate({
  //     inputRange: [0, 1],
  //     outputRange: ['0deg', '360deg']  // spin from 0 to 360 degrees
  // });

  // const resetAndStartAnimation = () => {
  //   spinValue.setValue(0);
  //   startSpinAnimation();
  // };
  
  async function pauseMusic() {
      if (sound) {
          if (isPlaying) {
              await sound.pauseAsync();
              // stopSpinAnimation();
          } else {
              await sound.playAsync();
              // startSpinAnimation();
          }
          setIsPlaying(!isPlaying); // Toggle the state
      }
  }

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync(); 
        }
      : undefined;
  }, [sound]);

  useEffect(() => {
    loadRandomMusicFromJamendo();
  }, []);

    const renderItem = ({ item, index }) => {
        const isExpanded = index === expandedItem;
        const isLiked = likedItems.includes(item.id);
        const isImageLoaded = imageLoaded[item.id];
        const isOverflowing = overflowingItems[index];
        const shouldShowMoreButton = isOverflowing && !isExpanded;
        const isForYouTab = activeTab === 0; 
        const imageSource = isForYouTab ? imageUrls[item.id] : item.imageUrl;
        
    return (
      <View style={styles.cardContainer}>
        <TouchableWithoutFeedback
            onPress={(event) => handleDoubleTap(item, event)}
        >
        <ImageBackground
          source={{ uri: imageSource }}
          onLoad={() => onImageLoad(item.id, imageSource)} 
          style={styles.card}
          imageStyle={styles.card}
          resizeMode="cover"
        >
        <LinearGradient
            colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.5)','rgba(0, 0, 0, 0.8)']} // Adjust the gradient colors as needed
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
            numberOfLines={isExpanded ? 8 : 2}
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
        <View style={styles.currentSongContainer}>
            <Icon name="music" size={18} color="rgba(136, 136, 136, 0.8)" style={styles.musicNoteIcon} />
            <TextTicker duration={20500} numberOfLines={1} style={styles.currentSongText}>
              {`${songName} - ${artistName}`}
            </TextTicker>
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
                    size={28}
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
                <Icon name="paper-plane" size={28} color="#fff" />
                <Text style={styles.buttonText}>Share</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.discButton}
              onPress={pauseMusic}
            >
              <Animated.View
                  style={{
                      ...styles.iconTextContainer,
                      // transform: [{ rotate: spin }]
                  }}
              >
                  <Image style={styles.discImage} source={require('./img/disc.png')}></Image>
                  <Image
                      style={styles.albumImage}
                      source={albumArt ? { uri: albumArt } : null}
                  />
              </Animated.View>
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

  const handleScrollEnd = useCallback((event) => {
    const pageIndex = Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width);
    activeTabIndexRef.current = pageIndex;
    setActiveTab(pageIndex);
    if (pageIndex === 1) {
      setNewLikedItemsAdded(false);
      AsyncStorage.setItem('newLikedItemsAdded', 'false');
    }
  }, []);

  return (
    <View style={styles.container}>
    <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        ref={scrollViewRef}
        pagingEnabled
        onMomentumScrollEnd={handleScrollEnd}
      >
      {vocabularyData.length === 0 && loadingMore ? ( 
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
          initialNumToRender={5} 
          maxToRenderPerBatch={5} 
          windowSize={5}
          removeClippedSubviews={true}
          extraData={[likedItems]}
          showsVerticalScrollIndicator={false}
          pagingEnabled={true}
          decelerationRate={'fast'} 
          onEndReached={fetchRandomWordsAndImages}
          onEndReachedThreshold={4} 
          ListFooterComponent={() => (
            <View style={{ paddingTop: 10 }}>
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
                removeClippedSubviews={true}
                pagingEnabled={true}
                decelerationRate={'fast'}
              />
            ) : (
              <Text style={styles.noLikedText}>Oops! Nothing here yet 🙁</Text>
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
    alignItems: 'center',    
    position: 'absolute',
    top: StatusBar.currentHeight,
    left: 0,
    right: 0,
  },
  tab: {
    paddingHorizontal: 18,
  },
  tabText: {
    fontWeight: 'bold',
    fontSize: 18,
    color: 'rgba(204, 204, 204, 0.8)', 
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
    marginTop: 28,
    borderRadius: 2,
    borderBottomWidth: 4, 
    borderBottomColor: '#fff', 
    width: 35,
    alignSelf: 'center', 
  },
  dot: {
    position: 'absolute',
    borderRadius: 2,
    top: 0, 
    right: 6,
    width: 9,
    height: 9,
    backgroundColor: '#FF6B6B',
    borderRadius: 9,
  },
    
  activityIndicatorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: Dimensions.get('window').height + StatusBar.currentHeight, 
    width: Dimensions.get('window').width,
  },
  cardContainer: {
    flex: 1,
    height: Dimensions.get('window').height + StatusBar.currentHeight, 
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
    height: '32%',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'column', 
    justifyContent: 'flex-end', 
    alignItems: 'flex-start',
    bottom: 40,
    left: 15,
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
    flexDirection: 'row',
    alignItems: 'center', 
  },
  speakerIcon: {
    marginLeft: 10,
  },
    
  pronunciation: {
    fontSize: 18,
    color: '#fff',

  },
  meaningContainer:{
    marginTop: 20,
    flexDirection: 'row', 
    bottom: 40,
    left: 15,
    width: 273,
  },
  meaning: {
    flex: 1,
    fontSize: 18,
    color: '#ccc',
  },
  currentSongContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    bottom: 40,
    left: 15,
    marginTop: 5, 
    opacity: 0.8,
  },
  musicNoteIcon: {
    marginRight: 10,
  },
  currentSongText: {
    fontSize: 18,
    color: '#999', 
    width: 290,
    opacity: 0.8,
  },
  sideButtonContainer: {
    position: 'absolute',
    bottom: 40,
    right: 15,
    flexDirection: 'column',
    alignItems: 'flex-end',
    alignContent: 'flex-end',
  },
  iconTextContainer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  
  likeButton: {
  },
  shareButton: {
    marginTop: 32,
  },
  discButton: {
    marginTop: 32,
  },
  discImage: {
    width: 50, 
    height: 50, 
  },
  albumImage: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 25, 
    height: 25, 
    borderRadius: 35,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    marginTop: 5,
  },
  seeMoreLink: {
    padding: 5,
    position: 'absolute',
    bottom: -5,
    left: 0,
    color: '#999',
    fontSize: 16,
    opacity: 0.8,
  },
  noLikedText: {
    color: '#fff',
    fontSize: 16,
  }
});

export default React.memo(LessonScreen);
