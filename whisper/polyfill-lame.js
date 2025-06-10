// src/polyfill-lame.js
import lamejs from "lamejs";

window.Lame = lamejs;
window.Presets = {
  // Default presets used by mic-recorder-to-mp3
  default: {
    channels: 1,
    sampleRate: 44100,
    bitRate: 128,
  },
};
