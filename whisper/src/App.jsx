import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, Settings, Globe, Languages } from 'lucide-react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

function App() {
  const [liveText, setLiveText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [speakLang, setSpeakLang] = useState('en-US');
  const [translateLang, setTranslateLang] = useState('English');
  const [recognition, setRecognition] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const speechLanguages = [
    { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
    { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
    { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
    { code: 'ml-IN', name: 'Malayalam', flag: '🇮🇳' },
    { code: 'ta-IN', name: 'Tamil', flag: '🇮🇳' },
    { code: 'te-IN', name: 'Telugu', flag: '🇮🇳' },
    { code: 'bn-IN', name: 'Bengali', flag: '🇮🇳' },
    { code: 'gu-IN', name: 'Gujarati', flag: '🇮🇳' },
    { code: 'kn-IN', name: 'Kannada', flag: '🇮🇳' },
    { code: 'mr-IN', name: 'Marathi', flag: '🇮🇳' },
    { code: 'pa-IN', name: 'Punjabi', flag: '🇮🇳' },
    { code: 'ur-IN', name: 'Urdu', flag: '🇮🇳' },
    { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
    { code: 'de-DE', name: 'German', flag: '🇩🇪' },
    { code: 'it-IT', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt-PT', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru-RU', name: 'Russian', flag: '🇷🇺' },
    { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh-CN', name: 'Chinese (Mandarin)', flag: '🇨🇳' },
    { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' },
    { code: 'th-TH', name: 'Thai', flag: '🇹🇭' },
    { code: 'vi-VN', name: 'Vietnamese', flag: '🇻🇳' },
    { code: 'nl-NL', name: 'Dutch', flag: '🇳🇱' },
    { code: 'sv-SE', name: 'Swedish', flag: '🇸🇪' },
    { code: 'da-DK', name: 'Danish', flag: '🇩🇰' },
    { code: 'no-NO', name: 'Norwegian', flag: '🇳🇴' },
    { code: 'fi-FI', name: 'Finnish', flag: '🇫🇮' },
    { code: 'pl-PL', name: 'Polish', flag: '🇵🇱' },
    { code: 'tr-TR', name: 'Turkish', flag: '🇹🇷' },
  ];

  const translateLanguages = [
    'English', 'Hindi', 'Malayalam', 'Tamil', 'Telugu', 'Bengali', 'Gujarati',
    'Kannada', 'Marathi', 'Punjabi', 'Urdu', 'Spanish', 'French', 'German',
    'Italian', 'Portuguese', 'Russian', 'Japanese', 'Korean', 'Chinese',
    'Arabic', 'Thai', 'Vietnamese', 'Dutch', 'Swedish', 'Danish', 'Norwegian',
    'Finnish', 'Polish', 'Turkish', 'Greek', 'Hebrew', 'Romanian', 'Bulgarian',
    'Croatian', 'Czech', 'Hungarian', 'Slovak', 'Slovenian', 'Estonian',
    'Latvian', 'Lithuanian', 'Maltese', 'Irish', 'Welsh', 'Basque', 'Catalan'
  ];

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('translationResult', (data) => {
      setTranslatedText(data.translated);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('translationResult');
    };
  }, []);

  const startTranscription = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Your browser does not support Web Speech API');
      return;
    }

    const recog = new SpeechRecognition();
    recog.lang = speakLang;
    recog.interimResults = true;
    recog.continuous = true;

    recog.onstart = () => setIsListening(true);
    recog.onend = () => setIsListening(false);
    
    recog.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(result => result[0].transcript)
        .join('');
      setLiveText(transcript);

      if (transcript.trim().length > 0) {
        fetch('http://localhost:5000/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: transcript,
            targetLang: translateLang,
          }),
        });
      }
    };

    recog.start();
    setRecognition(recog);
  };

  const stopTranscription = () => {
    if (recognition) {
      recognition.stop();
      setRecognition(null);
      setIsListening(false);
    }
  };

  const clearText = () => {
    setLiveText('');
    setTranslatedText('');
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window && text) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = translateLang === 'English' ? 'en-US' : speakLang;
      speechSynthesis.speak(utterance);
    }
  };

  const selectedSpeechLang = speechLanguages.find(lang => lang.code === speakLang);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full">
              <Languages className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Live Speech Translator
            </h1>
          </div>
          <p className="text-gray-600 text-lg">Real-time speech transcription and translation</p>
          
          {/* Connection Status */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className={`text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isConnected ? 'Connected to server' : 'Disconnected from server'}
            </span>
          </div>
        </div>

        {/* Language Selection */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Mic className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-800">Speech Language</h3>
            </div>
            <select 
              value={speakLang} 
              onChange={(e) => setSpeakLang(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
            >
              {speechLanguages.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-gray-800">Translate To</h3>
            </div>
            <select 
              value={translateLang} 
              onChange={(e) => setTranslateLang(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-700"
            >
              {translateLanguages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center gap-4 mb-8">
          {!isListening ? (
            <button
              onClick={startTranscription}
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Mic className="w-5 h-5" />
              Start Listening
            </button>
          ) : (
            <button
              onClick={stopTranscription}
              className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <MicOff className="w-5 h-5" />
              Stop Listening
            </button>
          )}
          
          <button
            onClick={clearText}
            className="flex items-center gap-2 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Clear Text
          </button>
        </div>

        {/* Status Indicator */}
        {isListening && (
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-red-600 font-medium">
              Listening... ({selectedSpeechLang?.name})
            </span>
          </div>
        )}

        {/* Text Display Areas */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Live Speech Text */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Mic className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800">Live Speech</h2>
              </div>
              <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {selectedSpeechLang?.flag} {selectedSpeechLang?.name}
              </span>
            </div>
            <div className="min-h-32 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-dashed border-blue-200">
              <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">
                {liveText || (
                  <span className="text-gray-400 italic">
                    {isListening ? 'Listening for speech...' : 'Click "Start Listening" to begin'}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Translated Text */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Globe className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800">Translation</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {translateLang}
                </span>
                {translatedText && (
                  <button
                    onClick={() => speakText(translatedText)}
                    className="p-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors"
                    title="Speak translation"
                  >
                    <Volume2 className="w-4 h-4 text-purple-600" />
                  </button>
                )}
              </div>
            </div>
            <div className="min-h-32 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-dashed border-purple-200">
              <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">
                {translatedText || (
                  <span className="text-gray-400 italic">
                    Translation will appear here...
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Powered by Web Speech API and real-time translation</p>
        </div>
      </div>
    </div>
  );
}

export default App;