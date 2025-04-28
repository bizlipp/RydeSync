// === /plugins/timbrhq.js ===
export default {
  theme: 'timbrhq',
  title: 'TimbrHQ Control Center',
  styles: '/themes/timbrhq.css',
  musicLoop: false,
  allowMic: true,
  playlist: [
    { title: 'Command Line', url: 'https://example.com/music/command-line.mp3' },
    { title: 'Ops Uplink', url: 'https://example.com/music/ops-uplink.mp3' },
  ],
  components: ['dashboard-overlay', 'live-status', 'command-bot']
};