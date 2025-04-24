// === /plugins/foxecho.js ===
export default {
  theme: 'foxecho',
  title: 'Fox Echo Meditation Chamber',
  styles: '/themes/foxecho.css',
  musicLoop: true,
  allowMic: false,
  playlist: [
    { title: 'Autumn Breeze', url: 'https://example.com/music/autumn-breeze.mp3' },
    { title: 'Still Waters', url: 'https://example.com/music/still-waters.mp3' },
  ],
  components: ['forest-ambience', 'seasonal-guide', 'reflection-timer']
};