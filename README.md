# ⛓️ Tied Together

A real-time multiplayer web-based game where players are physically connected by chains and must cooperate to navigate obstacles and complete levels together!

## 🎮 Game Features

- **Real-time Multiplayer**: Play with up to 4 players simultaneously using WebSocket technology
- **Physics-Based Chains**: Players are connected by dynamic chains with realistic physics
- **Cooperative Gameplay**: Coordinate movements to avoid stretching the chain and navigate obstacles
- **Progressive Levels**: Increasingly challenging platformer levels
- **Beautiful UI**: Modern, responsive design with smooth animations
- **Cross-Platform**: Play on any device with a modern web browser

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tied_together
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

### Development Mode

For development with auto-restart on file changes:
```bash
npm run dev
```

## 🎯 How to Play

### Controls

- **Move Left**: Arrow Left or A
- **Move Right**: Arrow Right or D
- **Jump**: Arrow Up, W, or Spacebar

### Objective

1. Work together with other players to navigate through the level
2. Stay connected - don't stretch the chain too far!
3. Avoid falling off platforms
4. Reach the goal area (golden flag on the right side)
5. Complete all levels as a team

### Game Mechanics

- **Chain Physics**: Players are connected by chains that can stretch but have a maximum length
- **Cooperative Movement**: If one player moves too far, they'll pull others along
- **Platforming**: Jump across platforms and obstacles
- **Level Progression**: Only advance when ALL players reach the goal

## 🏗️ Project Structure

```
tied_together/
├── server.js           # Node.js server with Socket.io for multiplayer
├── package.json        # Project dependencies and scripts
├── README.md          # This file
└── public/            # Client-side files
    ├── index.html     # Main HTML structure
    ├── style.css      # Beautiful styling and animations
    └── game.js        # Game engine, physics, and rendering
```

## 🛠️ Technology Stack

### Backend
- **Node.js**: JavaScript runtime
- **Express**: Web server framework
- **Socket.io**: Real-time bidirectional communication

### Frontend
- **HTML5 Canvas**: Game rendering
- **Vanilla JavaScript**: Game logic and physics
- **CSS3**: Modern styling with gradients and animations
- **Socket.io Client**: Real-time multiplayer synchronization

## 🎨 Features in Detail

### Multiplayer System
- Room-based matchmaking
- Custom room IDs for playing with friends
- Automatic player synchronization
- Handles disconnections gracefully

### Physics Engine
- Gravity and collision detection
- Chain constraint system with dynamic tension
- Smooth player movement
- Platform interactions

### Visual Design
- Gradient backgrounds
- Animated player characters with faces
- Dynamic chain rendering with tension indicators
- Goal area highlighting
- Responsive HUD

## 🔧 Configuration

You can modify game parameters in `public/game.js`:

```javascript
const CONFIG = {
    CANVAS_WIDTH: 1200,
    CANVAS_HEIGHT: 600,
    PLAYER_SIZE: 20,
    PLAYER_SPEED: 5,
    JUMP_FORCE: 12,
    GRAVITY: 0.5,
    MAX_CHAIN_LENGTH: 150,
    CHAIN_STIFFNESS: 0.3,
    GROUND_Y: 550
};
```

## 🌐 Deployment

### Local Network
To play on your local network, find your local IP address and use:
```
http://YOUR_LOCAL_IP:3000
```

### Cloud Deployment
The game can be deployed to any Node.js hosting service:
- Heroku
- DigitalOcean
- AWS
- Google Cloud
- Vercel (with serverless functions)

Make sure to set the `PORT` environment variable if required by your hosting provider.

## 🐛 Troubleshooting

**Players not connecting?**
- Check that the server is running on port 3000
- Ensure firewall allows connections
- Verify all players use the same room ID

**Game lagging?**
- Reduce number of simultaneous players
- Check network connection
- Lower the update rate in the code if needed

**Chain acting weird?**
- Adjust `MAX_CHAIN_LENGTH` and `CHAIN_STIFFNESS` in CONFIG
- Ensure all players have stable connections

## 🤝 Contributing

Contributions are welcome! Some ideas for improvements:
- Add more level designs
- Implement power-ups
- Add sound effects and music
- Create different game modes
- Add leaderboards
- Implement mobile touch controls

## 📝 License

This project is licensed under the MIT License.

## 🎉 Credits

Created as a cooperative multiplayer platformer inspired by games like "Chained Together" and "Tied Together".

Enjoy playing with your friends! 🎮⛓️