# 🎧 RydeSync

![RydeSync Banner](https://aerovistaassets.s3.amazonaws.com/rydesync-banner.png)

A stylish, lightweight, and secure P2P voice communication platform built for real-time audio sharing and music synchronization.

**[Live Demo](https://rydesync.aerovista.us)** | **[Plugin Gallery](https://rydesync.aerovista.us/plugins)**

## 🚀 Features

- **Peer-to-Peer Voice Chat**: Real-time voice communication using WebRTC (via PeerJS)
- **Music Synchronization**: Share and sync music playback across all room participants
- **Enhanced Drift Correction**: Advanced algorithms to keep music perfectly in sync
- **Room System**: Create or join rooms with a simple name-based system
- **Connection Management**: Auto-reconnect with exponential backoff and connection status UI
- **Peer Activity Visualization**: See who's active in the room with status indicators
- **Plugin System**: Customize rooms with themes, playlists, and features
- **Plugin Gallery**: Browse and preview available plugins
- **Mobile-Ready UI**: Responsive design with touch support and gesture controls
- **No Account Required**: Just enter a room name and start communicating

## 📦 Tech Stack

- **PeerJS**: WebRTC wrapper for peer-to-peer connections
- **Express**: Node.js server for signaling and static hosting
- **Firebase (Optional)**: For music synchronization
- **Vanilla JavaScript**: No heavy frameworks, just plain JS, HTML, and CSS

## 🛠️ Development Setup

### Prerequisites

- Node.js (v14 or newer)
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/aerovista/rydesync.git
   cd rydesync
   ```

2. Create a `.env` file in the project root with your Firebase configuration:

```
# Firebase Configuration
VITE_FIREBASE_API_KEY=YOUR_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_APP_ID

# Environment
NODE_ENV=development
```

3. Install dependencies
   ```bash
   npm install
   ```

4. Start the development server
   ```bash
   npm run dev
   ```

6. Access the application at `http://localhost:9000`

## 🔌 Plugin System

RydeSync supports plugins to customize rooms with themes, playlists, and special features.

### Creating a Plugin

1. Create a new JS file in the `plugins/` directory (e.g., `plugins/myplugin.js`)
2. Export a plugin configuration object:

```javascript
// plugins/myplugin.js
export default {
  theme: 'myplugin',
  title: 'My Custom Room',
  styles: '/themes/myplugin.css',
  musicLoop: true,
  allowMic: true,
  playlist: [
    { title: 'Track 1', url: 'https://example.com/music/track1.mp3' },
    { title: 'Track 2', url: 'https://example.com/music/track2.mp3' },
  ],
  components: ['custom-feature-1', 'custom-feature-2']
};
```

3. Add your plugin to the main index file:

```javascript
// plugins/index.js
import myplugin from './myplugin.js';

export const roomPlugins = {
  // Add your plugin with its room key
  myplugin,
  // Other plugins...
};
```

4. Create a CSS file for your theme in `public/themes/` if needed

### Using a Plugin

Plugins are automatically activated when a user joins a room with the same name as the plugin key. For example, joining a room named "myplugin" will activate the "myplugin" plugin.

## 🔊 Room System

### Joining a Room

1. Enter a room name in the input field
2. Click "Join Room"
3. If the room exists, you'll connect to existing participants
4. If the room doesn't exist, a new room will be created

### Music Synchronization

When a music track is played in a room:

1. The track information is shared with all participants
2. All clients play the track at the same position
3. Drift correction ensures synchronization is maintained
4. Play/pause state is synchronized across all clients

### Network Resilience

- Auto-reconnect with exponential backoff when connection is lost
- Status indicators show connection state
- Peer activity visualization shows active participants

## 🔐 Security & Privacy

- No voice data is stored
- No user accounts required
- Peer-to-peer connections for direct communication
- HTTPS recommended for production deployments

## 📱 Mobile Usage

- Responsive design works on mobile devices
- Touch gestures for music player control
- Audio continues in background on supported browsers
- Haptic feedback on interactions when available

## 🧰 Advanced Usage

### Custom STUN/TURN Servers

For improved NAT traversal, you can configure custom STUN/TURN servers in `public/app.js`:

```javascript
const peer = new Peer(undefined, {
  // ... other options
  config: {
    iceServers: [
      { urls: 'stun:your-stun-server.com:3478' },
      {
        urls: 'turn:your-turn-server.com:3478',
        username: 'username',
        credential: 'password'
      }
    ]
  }
});
```

### Room Capacity

The peer-to-peer architecture works best with small to medium groups:

- **Recommended**: 2-5 users for optimal performance
- **Maximum**: 8-10 users, depending on connection quality
- For larger groups, consider using a selective forwarding unit (SFU)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

- [PeerJS](https://peerjs.com/) for WebRTC simplification
- [Firebase](https://firebase.google.com/) for real-time synchronization
- [AeroVista LLC](https://aerovista.us) for project development and design

---

Built with ❤️ by AeroVista LLC – Where Vision Takes Flight 

## Important Notes

- Scripts must be loaded as ES modules (with `type="module"` attribute)
- Environment variables must be set for Firebase configuration
- Firebase security rules should be properly configured for production use

## Troubleshooting

### Module Loading Issues

If you see `Uncaught SyntaxError: Cannot use import statement outside a module`, make sure all scripts are loaded with `type="module"` in your HTML:

```html
<script type="module" src="app.js"></script>
<script type="module" src="musicPlayer.js"></script>
<script type="module" src="musicSync.js"></script>
```

### Firebase Configuration

If Firebase fails to initialize, check your `.env` file and ensure all required environment variables are set correctly.

## License

MIT – use it, remix it, Ryde with it. 