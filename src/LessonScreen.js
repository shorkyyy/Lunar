import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { View, FlatList, Text, StyleSheet, Dimensions, TouchableOpacity, Image, ImageBackground, ScrollView, SafeAreaView, Animated, TouchableWithoutFeedback, ActivityIndicator, StatusBar, Share, LayoutAnimation, UIManager, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { createClient } from 'pexels';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { Audio } from 'expo-av';
import * as SplashScreen from 'expo-splash-screen';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TextTicker from 'react-native-text-ticker'
import { Modalize } from 'react-native-modalize';
import { FlashList } from "@shopify/flash-list";


const tabs = ['For You', 'Liked']; 
const client = createClient('XoJwUYOzKMoDE3chOvLGeDqEoSdDtUNseGnCEnIQB4n2V3Te2lMlQLHS');
SplashScreen.preventAutoHideAsync();
const iconsArray = ['heart', 'paw', 'star', 'bell', 'paw', 'coffee', 'leaf'];


const LessonScreen = ({ navigation }) => {      
    const flatListRef = useRef(null);
    const [expandedItem, setExpandedItem] = useState(null);
    const [expandedItemForYou, setExpandedItemForYou] = useState(null);
    const [expandedItemLiked, setExpandedItemLiked] = useState(null);
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
    const [maxCachedImages] = useState(50); 
    const [cachedImageUrls, setCachedImageUrls] = useState({}); 
    const modalizeRef = useRef(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const iconRef = useRef(null);
    const [translatedMeaning, setTranslatedMeaning] = useState({ id: null, text: null });
  
    const onOpen = (item) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedItem(item); // Set the selected item
      if (modalizeRef.current) {
        modalizeRef.current.open();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
      }
    };
    const closeModal = () => {
      modalizeRef.current?.close(); // Close the modal using its ref
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };
    const getRandomIcon = useCallback(() => {
      const randomIndex = Math.floor(Math.random() * iconsArray.length);
      return iconsArray[randomIndex];
    }, []);

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
        setLoadingMore(true);
    
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
            const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    
            if (response.data && response.data.length > 0) {
              const wordData = response.data[0];
              const { word: apiWord, phonetic, phonetics } = wordData;
              const audioUrl = phonetics && phonetics[0] && phonetics[0].audio
                ? `${phonetics[0].audio}`
                : null;
                const wordPronunciation = phonetics && phonetics[0] && phonetics[0].text
                ? phonetics[0].text
                : '/Unavailable/';
              const capitalizedWord = capitalizeFirstLetter(apiWord);
    
              const allDefinitions = [];
              const allExamples = [];
              const allPartOfSpeech = [];
    
              if (wordData.meanings) {
                wordData.meanings.forEach(meaning => {
                  const partOfSpeech = meaning.partOfSpeech;

                  if (meaning.definitions) {
                    meaning.definitions.forEach(def => {
                      allDefinitions.push(def.definition);
                      allExamples.push(def.example || null);
                      allPartOfSpeech.push(formatPartOfSpeech(partOfSpeech));
                    });
                  }
                });
              }
              
              const firstDefinition = allDefinitions[0] || 'Unavailable';
              const firstPartOfSpeech = wordData.meanings && wordData.meanings[0]
                ? formatPartOfSpeech(wordData.meanings[0].partOfSpeech)
                : 'Unavailable';
    
              const imageUrl = await fetchImage(word);
              await SplashScreen.hideAsync();    
              return {
                id: word,
                word: capitalizedWord,
                partOfSpeech: firstPartOfSpeech,
                meaning: firstDefinition,
                pronunciation: wordPronunciation,
                imageUrl: imageUrl,
                audioUrl: audioUrl,
                allDefinitions,
                allExamples,
                allPartOfSpeech
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
    
        setVocabularyData((prevVocabularyData) => [...prevVocabularyData, ...validResponses]);
    
        const imageURLs = validResponses.reduce((acc, curr) => {
          acc[curr.id] = curr.imageUrl;
          return acc;
        }, {});
    
        setImageUrls((prevImageUrls) => ({ ...prevImageUrls, ...imageURLs }));
    
        setLoadingMore(true);  // Set loadingMore back to false when data fetching is done
      } catch (error) {
        console.error('Error fetching random words and images:', error);
        setLoadingMore(true);  // Handle error and set loadingMore back to false
      }
    };

    const placeholderWords = shuffleArray([
      'sparkle', 'blossom', 'joyful', 'vibrant', 'harmony', 'radiant'
    ]);
    
    const fetchImage = useMemo(() => {
      const cachedImageUrls = {};
      const usedImageUrls = new Set(); // Keep track of used image URLs
    
      return async (word) => {
        try {
          // Check if the image URL is already cached
          if (cachedImageUrls[word]) {
            return cachedImageUrls[word];
          }
    
          // Search for images using the given word
          const response = await client.photos.search({ query: word, per_page: 2 });
          const photos = response.photos;
    
          // Shuffle the photos array to ensure randomness
          const shuffledPhotos = shuffleArray(photos);
    
          // Find the first available image that is not in usedImageUrls
          const availableImage = shuffledPhotos.find((photo) => {
            const imageUrl = photo.src.large;
            return !usedImageUrls.has(imageUrl);
          });
    
          if (availableImage) {
            const imageUrl = availableImage.src.large;
            usedImageUrls.add(imageUrl); // Mark the image URL as used
    
            // After successfully fetching the image URL, cache it
            cachedImageUrls[word] = imageUrl;
    
            return imageUrl;
          }    
          // If no image is found for the given word, use a placeholder word instead
          const placeholderWord = placeholderWords[Math.floor(Math.random() * placeholderWords.length)];
          const placeholderResponse = await client.photos.search({ query: placeholderWord, per_page: 5 });
          const placeholderPhotos = placeholderResponse.photos;
    
          // Find the first available image that is not in usedImageUrls
          const availablePlaceholderImage = placeholderPhotos.find((photo) => {
            const imageUrl = photo.src.large;
            return !usedImageUrls.has(imageUrl);
          });
    
          if (availablePlaceholderImage) {
            const imageUrl = availablePlaceholderImage.src.large;
            usedImageUrls.add(imageUrl); // Mark the image URL as used
    
            // After successfully fetching the image URL, cache it
            cachedImageUrls[word] = imageUrl;
    
            return imageUrl;
          }
        } catch (error) {
          console.error('Error fetching image:', error);
        }
    
        return 'https://example.com/placeholder-image.jpg'; // Default placeholder image URL
      };
    }, []);
    
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
    const capitalizeFirstLetter = (string) => {
      // Find the index of the first letter in the string
      const firstLetterIndex = string.search(/[a-zA-Z]/);
      
      // If there's no letter in the string, return the original string
      if (firstLetterIndex === -1) return string;
      
      // Capitalize the first letter and concatenate it with the rest of the string
      return string.slice(0, firstLetterIndex) + string.charAt(firstLetterIndex).toUpperCase() + string.slice(firstLetterIndex + 1);
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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }); 
            }, 600);
    
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
                  imageUrl: imageUrls[item.id],  
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
  async function toggleLike(item) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isLiked = likedItems.includes(item.id);
  
    let updatedLikedItems;
    if (isLiked) {
      updatedLikedItems = likedItems.filter((id) => id !== item.id);
    } else {
      startHeartBeatAnimation();
      updatedLikedItems = [...likedItems, item.id];
    }
  
    // Optimistically update state
    setLikedItems(updatedLikedItems);
  
    try {
      const storedLikedItems = await AsyncStorage.getItem('likedItems');
      const parsedLikedItems = storedLikedItems ? JSON.parse(storedLikedItems) : [];
      let updatedStoredLikedItems;
  
      if (isLiked) {
        updatedStoredLikedItems = parsedLikedItems.filter(
          (storedItem) => storedItem.id !== item.id
        );
        await AsyncStorage.setItem('newLikedItemsAdded', 'false');
        setNewLikedItemsAdded(false);
      } else {
        const itemWithImageUrl = {
          ...item,
          imageUrl: imageUrls[item.id],
        };
        updatedStoredLikedItems = [...parsedLikedItems, itemWithImageUrl];
        await AsyncStorage.setItem('newLikedItemsAdded', 'true');
        setNewLikedItemsAdded(true);
      }
  
      await AsyncStorage.setItem(
        'likedItems',
        JSON.stringify(updatedStoredLikedItems)
      );
    } catch (error) {
      console.error('Error updating AsyncStorage:', error);
      // Revert state if AsyncStorage operation fails
      setLikedItems(likedItems);
    }
  }
  
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const backgroundMusicWasPlaying = sound && isPlaying;
    
        if (backgroundMusicWasPlaying) {
          // If background music was playing, pause it
          await sound.pauseAsync();
          setIsPlaying(false);
        }
    
        const pronunciationSound = new Audio.Sound();
        await pronunciationSound.loadAsync({ uri: audioUrl });
        await pronunciationSound.playAsync();
    
        // Listen to when the pronunciation playback finishes
        pronunciationSound.setOnPlaybackStatusUpdate(async (status) => {
          if (status.didJustFinish) {
            // Playback of pronunciation audio finished
            if (backgroundMusicWasPlaying) {
              // If background music was playing, resume it
              await sound.playAsync();
              setIsPlaying(true);
            }
            pronunciationSound.setOnPlaybackStatusUpdate(null); // Remove the event listener
            await pronunciationSound.unloadAsync();
          }
        });
      } catch (error) {
        console.error('Error playing pronunciation audio:', error);
      }
    };
    
    const handleTextLayout = (event, index) => {
      const { lines } = event.nativeEvent;
      if (lines.length > 2) {
        setOverflowingItems(prev => {
          if (!prev[index]) {
            return { ...prev, [index]: true };
          }
          return prev;
        });
      } else {
        setOverflowingItems(prev => {
          if (prev[index]) {
            const newState = { ...prev };
            delete newState[index];
            return newState;
          }
          // If it's not marked as overflowing, keep the state as it is
          return prev;
        });
      }
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
  
  const toggleExpansion = (itemId) => {
    // Determine which state variable to update based on the active tab
    if (activeTab === 0) {
      // Update the For You tab's expansion state
      LayoutAnimation.configureNext(customAnimationConfig);
      setExpandedItemForYou((prev) => (prev === itemId ? null : itemId));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (activeTab === 1) {
      // Update the Liked tab's expansion state
      LayoutAnimation.configureNext(customAnimationConfig);
      setExpandedItemLiked((prev) => (prev === itemId ? null : itemId));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };
  
  const [sound, setSound] = useState(null);
  const [songName, setSongName] = useState('');
  const [albumArt, setAlbumArt] = useState('');
  
  const DEEZER_API_KEY = 'c9c958c48482781929746cd86bf8c907'; // Replace with your Deezer API key
  const artistName = 'Lofi Fruits Music';
  let playedSongs = []; // Keep track of played songs
  
  async function loadRandomMusicFromDeezer() {
    try {
      let track;
      do {
        const DEEZER_ENDPOINT = `https://api.deezer.com/search?q=artist:"${artistName}"&limit=50&output=json&key=${DEEZER_API_KEY}`;
        const response = await axios.get(DEEZER_ENDPOINT);
        if (response.data.data.length === 0) {
          console.error(`No songs found for artist: ${artistName}`);
          return;
        }
        track = response.data.data[Math.floor(Math.random() * response.data.data.length)];
      } while (playedSongs.includes(track.id)); // Generate a new song if the song has already been played
      playedSongs.push(track.id); // Add the song id to the list of played songs
      if (playedSongs.length > 50) {
        playedSongs.shift(); // Remove the oldest song when the list is full
      }

      if (track && track.preview) {
        const { sound } = await Audio.Sound.createAsync({ uri: track.preview });
        setSound(sound);
        await sound.playAsync();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsPlaying(true);

        // Get the song name, artist name, and album art
        const songName = track.title;
        const albumArtUrl = track.album.cover;

        // Update the songName and artistName state variables
        setSongName(songName);
        // setArtistName(artistName);
        setAlbumArt(albumArtUrl);

        // Add an event listener to detect when the current song ends
        sound.setOnPlaybackStatusUpdate(async (status) => {
          if (status.didJustFinish) {
            // If the song ended, load and play a new random song
            loadRandomMusicFromDeezer();
          }
        });
      } else {
        console.error('No audio track found in Deezer response. Retrying...');
      }
    } catch (error) {
      console.error('Error fetching track from Deezer:', error);
    }
  }

  
  async function pauseMusic() {
      if (sound) {
          if (isPlaying) {
              await sound.pauseAsync();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } else {
              await sound.playAsync();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    if (loadingMore) {
      loadRandomMusicFromDeezer();
    }
  }, [loadingMore]);

    const translate = (itemId, textToTranslate) => {
      const sourceLang = 'en';
      const targetLang = 'vi';

      try {
          // Replace semicolon with comma before encoding and translating
          const textToTranslateReplaced = textToTranslate.replace(/;/g, ',');
          const encodedText = encodeURIComponent(textToTranslateReplaced);
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodedText}`;

          axios.get(url)
          .then(response => {
              const translatedText = response.data[0][0][0];
              const decodedText = decodeURIComponent(translatedText);
              setTranslatedMeaning({ id: itemId, text: decodedText });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          })
          .catch(error => {
              console.error('Translation error:', error);
          });
      
      } catch (error) {
          console.error('Encoding error:', error);
      }
  };

    const renderItem = ({ item, index }) => {
        const isExpanded = activeTab === 0 ? item.id === expandedItemForYou : item.id === expandedItemLiked;
        const isLiked = likedItems.includes(item.id);
        const isOverflowing = overflowingItems[index];
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
            colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.9)']}
            style={[styles.gradientContainer, { height: expandedItem === index ? '55%' : "35%" }]}
          >
          </LinearGradient> 
          <View style={styles.contentContainer}>
            <View style={styles.wordContainer}>
                <Text style={styles.word}>{item.word}</Text>
                <Text style={styles.partOfSpeech}>({item.partOfSpeech})</Text>
                <Icon name="check-circle" size={18} color="#9BBFE7" style={styles.checkIcon}/>
                    {item.audioUrl ? (
                        <TouchableOpacity onPress={() => playPronunciation(item.audioUrl)}>
                            <Icon name="volume-up" size={22} color="#fff" style={styles.speakerIcon} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.disabledSpeakerIcon}>
                            <Icon name="volume-up" size={22} color="#999" style={styles.speakerIcon} />
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
              {item.id === translatedMeaning.id ? translatedMeaning.text : item.meaning}
          </Text>
          {isOverflowing && !isExpanded && (
            <TouchableOpacity
              style={styles.seeMoreButton}
              onPress={() => toggleExpansion(item.id)}
            >
              <Text style={styles.seeMoreLink}>more</Text>
            </TouchableOpacity>
          )}
          {isExpanded && (
            <TouchableOpacity
              style={styles.seeMoreButton}
              onPress={() => toggleExpansion(item.id)}
            >
              <Text style={styles.seeMoreLink}>less</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
            style={styles.translationContainer} 
            onPress={() => {
                if (item.id === translatedMeaning.id) {
                    setTranslatedMeaning({ id: null, text: null });  // Reset the translation if this item is already translated
                } else {
                    translate(item.id, item.meaning); // Translate this item's meaning
                }
            }}
        >
            <Text style={styles.Translation}>{item.id === translatedMeaning.id ? 'See original' : 'See translation'}</Text>
        </TouchableOpacity>


        <View style={styles.currentSongContainer}>
        <TouchableOpacity onPress={pauseMusic}>
          {isPlaying ? (
            <Icon name="pause" size={16} color="#ccc" style={styles.musicNoteIcon} />
          ) : (
            <Icon name="play" size={16} color="#ccc" style={styles.musicNoteIcon} />
          )}
        </TouchableOpacity>
            <TextTicker
              duration={12000} 
              loop
              marqueeDelay={1200}
              numberOfLines={1}
              repeatSpacer={250}
              style={styles.currentSongText}
            >
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
              style={styles.commentButton}
              onPress={() => onOpen(item)} 
            >
              <View style={styles.iconTextContainer}>
                <Icon name="comment" size={28} color="#fff" />
                <Text style={styles.buttonText}>About</Text>
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
              onPress={loadRandomMusicFromDeezer}
            >
              <Animated.View
                  style={{
                      ...styles.iconTextContainer,
                  }}
              >
                  <Image style={styles.discImage} source={require('./img/disc.png')}></Image>
                  <Image
                      style={styles.albumImage}
                      source={albumArt ? { uri: albumArt } : null}
                  />
                  <Icon name="forward" size={11} color="#fff" style={styles.skipSong} />
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
  const navigateToAboutScreen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('AboutScreen')
  }; 

  const handleScrollEnd = useCallback((event) => {
    const pageIndex = Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width);
    activeTabIndexRef.current = pageIndex;
    setActiveTab(pageIndex);
  
    if (pageIndex === 1) {
      setNewLikedItemsAdded(false);
      AsyncStorage.setItem('newLikedItemsAdded', 'false');
    }
    if (pageIndex === 0) {

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
        <View style={{ height: Dimensions.get('window').height + StatusBar.currentHeight, width: Dimensions.get("screen").width }}>
          <FlashList
          on
          ref={flatListRef}
          data={vocabularyData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          windowSize={5}
          removeClippedSubviews={true}
          extraData={[likedItems]}
          showsVerticalScrollIndicator={false}
          pagingEnabled={true}
          decelerationRate={'fast'} 
          onEndReached={fetchRandomWordsAndImages}
          onEndReachedThreshold={4} 
          estimatedItemSize={868}
          ListFooterComponent={() => (
            <View style={{ padding: 5 }}>
              {loadingMore && vocabularyData.length > 0 ? (
                <ActivityIndicator size={30} color="#fff" />
              ) : null}
            </View>
          )}
         />
         </View>
    )}  
      {vocabularyData.length > 0 && loadingMore ? (
        <View style={styles.cardContainer}>
          <View style={styles.likedContainer}>
            {likedItemsFromStorage.length > 0 ? (
                <View style={{ height: Dimensions.get('window').height + StatusBar.currentHeight, width: Dimensions.get("screen").width }}>
              <FlashList
                data={likedItemsFromStorage}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={true}
                pagingEnabled={true}
                windowSize={5}
                estimatedItemSize={868}
                decelerationRate={'fast'}
                extraData={[expandedItemLiked, translatedMeaning]}
              />
              </View>
            ) : (
              <Text style={styles.noLikedText}>Oops! Nothing here yet 🙁</Text>
            )}
          </View>
        </View>
      ) : null}
      </ScrollView>
      <Modalize
        ref={modalizeRef}
        modalStyle={{ backgroundColor: '#121212' }}
        modalHeight={Dimensions.get('window').height}
        handlePosition="inside"
        handleStyle={{ backgroundColor: '#666' }}
      >
        {selectedItem ? (
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalWordText}>{selectedItem.word}</Text>
              <Text style={styles.modalPronunciationText}>{selectedItem.pronunciation}</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Icon name="close" size={24} color="#ccc" />
              </TouchableOpacity>
            </View>
            <View style={styles.underline} />

            {selectedItem.allPartOfSpeech.map((partOfSpeech, index) => (
              <View key={index} style={styles.commentContainer}>
                <Icon name={getRandomIcon()} size={20} color="#fff" style={styles.commentIcon} />
                <View style={styles.commentTextContainer}>
                  <Text style={styles.modalPartOfSpeech}>Definition ({partOfSpeech})</Text>
                  <Text style={styles.modalMeaningText}>
                    {selectedItem.allDefinitions[index]}
                  </Text>
                  {selectedItem.allExamples[index] && (
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ borderLeftWidth: 2, borderColor: '#9BBFE7', paddingLeft: 5, marginTop: 5 }}>
                        <Text style={styles.modalExampleText}>
                          Example: {selectedItem.allExamples[index]}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.modalText}>No item selected</Text>
        )}
      </Modalize>

      {vocabularyData.length === 0 && loadingMore ? null : (
        <SafeAreaView style={styles.tabBar}>
          {tabs.map((tab, index) => renderTab(tab, index))}
          <TouchableOpacity  onPress={navigateToAboutScreen}>
            <Icon name='cog' size={20} style={styles.settingButton}></Icon>
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
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
    paddingHorizontal: 15,
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
    marginTop: 30,
    borderRadius: 5,
    borderBottomWidth: 4, 
    borderBottomColor: '#fff', 
    width: 20,
    alignSelf: 'center', 
  },
  settingButton: {
    color: 'white',
    padding: 20,
    position: 'absolute',
    left: 65,
    top: -32,      
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
    height: '33%',
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
    fontSize: 25,
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
    alignItems: 'baseline', 
  },
  speakerIcon: {
    marginLeft: 10,
  },
  checkIcon:{
    marginLeft: 10,
  },
  pronunciation: {
    marginTop: 5,
    fontSize: 16,
    color: '#fff',
  },
  meaningContainer:{
    marginTop: 5,
    flexDirection: 'row', 
    bottom: 40,
    left: 15,
    width: 280,
  },
  meaning: {
    flex: 1,
    fontSize: 18,
    color: '#ccc',
    opacity: 0.8,
  },
  translationContainer: {
    marginVertical: 15,
    bottom: 40,
    left: 15,
    width: 130,
  },
  Translation: {
    color: '#ccc',
    fontWeight:'bold',
    fontSize: 16,
    opacity: 0.6,
  },
  currentSongContainer: {
    marginTop: 5,
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'center',
    bottom: 40,
    left: 15,
    backgroundColor: "rgba(136, 136, 136, 0.5)",
    borderRadius: 20,
    width: 230,
    paddingVertical: 6,
    paddingHorizontal: 15,
  },
  musicNoteIcon: {
    padding: 5,
  },
  currentSongText: {
    fontSize: 16,
    color: '#ccc', 
    width: 180,
  },
  sideButtonContainer: {
    position: 'absolute',
    bottom: 40,
    right: 10,
    flexDirection: 'column',
    alignItems: 'center',
    alignContent: 'center',
  },
  iconTextContainer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  
  likeButton: {
  },
  commentButton: {
    marginTop: 30,
  },
  modalContent: {
    paddingVertical: 20,
    borderRadius: 10, // Adjust the border radius as needed
  },
  modalHeader: {
    marginTop: 10,
    flexDirection: 'column',
    alignContent: 'center',
  },
  modalWordText: {
    paddingHorizontal: 20,
    fontSize: 25,
    fontWeight: 'bold',
    color: '#9BBFE7',
  },
  
  modalPronunciationText: {
    fontSize: 16,
    color: '#fff',
    paddingHorizontal: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 20, // Adjust the right value to position it where you want
  },
  underline: {
    height: 1, 
    backgroundColor: '#666', 
    marginVertical: 15,
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20, 

  },
  commentIcon: {
    marginRight: 0,
    marginLeft: 20,
    marginTop: 15,
    backgroundColor: '#9BBFE7',
    padding: 10,
    borderRadius: 50,
    width: 40,
    height: 40,
  },
  commentTextContainer: {
    flex: 1, 
    paddingHorizontal: 15,
  },
  modalPartOfSpeech:{
    marginTop: 10,
    fontSize: 16,
    color: '#8E8E8E',
    marginBottom: 5,
  },
  modalMeaningText: {
    fontSize: 16,
    lineHeight: 20,
    color: '#ccc',
  },
  modalExampleText: {
    fontSize: 16,
    lineHeight: 20,
    color: '#ccc',
    padding: 5,
  },
  shareButton: {
    marginTop: 30,
  },
  discButton: {
    marginTop: 30,
  },
  discImage: {
    width: 50, 
    height: 50, 
  },
  albumImage: {
    position: 'absolute',
    top: 7,
    left: 7,
    width: 35, 
    height: 35, 
    borderRadius: 35,
  },
  skipSong: {
    position: 'absolute',
    top: 35,
    left: 15,
    backgroundColor: '#9BBFE7',
    borderRadius: 20,
    padding: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    marginTop: 5,
  },
  seeMoreLink: {
    padding: 10,
    fontWeight:'bold',
    position: 'absolute',
    bottom: -10,
    left: -6,
    color: '#999',
    fontSize: 16,
    opacity: 0.6,
  },
  noLikedText: {
    color: '#fff',
    fontSize: 16,
  }
});

export default React.memo(LessonScreen);
