import axios from 'axios';

const clientId = '73bd194759234f9fbf7ef8d03233134f';
const clientSecret = 'cafd9b075a6d48a8a7eda572da98cc84';

const authenticateSpotify = async () => {
  try {
    // Authenticate with Spotify API to obtain an access token
    const authResponse = await axios.post('https://accounts.spotify.com/api/token', null, {
      params: {
        grant_type: 'client_credentials',
      },
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
    });

    return authResponse.data.access_token;
  } catch (error) {
    console.error('Error authenticating with Spotify:', error);
    throw error;
  }
};

const searchAndPlayMusic = async (searchQuery) => {
  try {
    const accessToken = await authenticateSpotify();

    // Use the access token to search for tracks
    const searchResponse = await axios.get('https://api.spotify.com/v1/search', {
      params: {
        q: searchQuery,
        type: 'track',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Process the search results and return them
    return searchResponse.data.tracks.items;
  } catch (error) {
    console.error('Error searching and playing music:', error);
    throw error;
  }
};

export { searchAndPlayMusic };
