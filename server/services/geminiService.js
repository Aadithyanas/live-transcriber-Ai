const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAHJp-QqTwCbwMse0ZpBNFtEEYj672e6Q8'; // Use environment variable

async function translateText(text, targetLang) {
  if (!text || !targetLang) {
    throw new Error('Both text and targetLang are required');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `Translate the following text to ${targetLang} without adding any explanations or notes: "${text}"`;

  const requestData = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  try {
    const response = await axios.post(url, requestData, {
      timeout: 10000 // 10-second timeout
    });

    if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response structure from Gemini API');
    }

    return response.data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error('Translation error:', error.message);
    throw new Error(`Translation failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

module.exports = { translateText };