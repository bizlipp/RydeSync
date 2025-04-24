// === /plugins/syntheticsouls.js ===
export default {
  theme: 'syntheticsouls',
  title: 'Synthetic Souls Listening Room',
  styles: '/themes/syntheticsouls.css',
  musicLoop: true,
  allowMic: false,
  playlist: [
    { title: 'Dark Pulse', url: 'https://example.com/music/dark-pulse.mp3' },
    { title: 'Cyber Dreams', url: 'https://example.com/music/cyber-dreams.mp3' },
  ],
  components: ['waveform', 'now-playing', 'room-lore']
};