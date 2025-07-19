# Zombie Shooter Game 🧟‍♂️

A fast-paced 2D zombie shooter game built with Phaser 3, TypeScript, and Vite. Fight off waves of zombies using multiple weapon types in this action-packed browser game!

## Features

- **Multiple Weapon Types**: 5 different weapons with unique characteristics
- **Fullscreen Gameplay**: Responsive design that adapts to your screen
- **8-Direction Movement**: Smooth directional controls with diagonal movement
- **Piercing Bullets**: Bullets go through multiple enemies
- **Progressive Difficulty**: Zombies spawn continuously and chase you
- **Score System**: Track your zombie-slaying progress

## Weapons Arsenal

1. **Normal (Key 1)** - Standard yellow bullets with balanced fire rate
2. **Spread (Key 2)** - Orange shotgun-style spread shots
3. **Thick (Key 3)** - Large cyan bullets with high impact
4. **Ring (Key 4)** - Magenta bullets firing in all directions
5. **Solid Ring (Key 5)** - Expanding green ring for close combat

## Prerequisites

### Installing NVM (Node Version Manager)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

### Installing Node.js 22

After installing NVM, restart your terminal and run:

```bash
# Install Node.js 22
nvm install 22

# Use Node.js 22
nvm use 22

# Verify installation
node --version
npm --version
```

## Getting Started

### 1. Clone the Repository

```bash
git clone git@github.com:maafk/zombie-overhead-shooter.git
cd zombie-overhead-shooter
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

The game will be available at `http://localhost:5173` (or the port shown in your terminal).

## Game Controls

### Movement & Aiming

- **Arrow Keys**: Move your character and change facing direction
- **Mouse**: Not used (keyboard-only controls)

### Combat

- **Spacebar**: Shoot in the direction you're facing
- **Number Keys 1-5**: Switch between weapon types

### Weapon Selection

- **1**: Normal bullets
- **2**: Spread shot
- **3**: Thick bullets
- **4**: Ring burst
- **5**: Solid ring

## Game Mechanics

- **Zombies**: Red circles that spawn from screen edges and chase you
- **Player**: Green circle with white direction indicator
- **Bullets**: Color-coded projectiles that pierce through enemies
- **Scoring**: Earn 10 points per zombie killed
- **Game Over**: Touch a zombie to restart

## Development

### Project Structure

```
src/
├── main.ts          # Game initialization and configuration
├── scenes/
│   └── PlayScene.ts # Main game scene with all logic
├── style.css        # Fullscreen styling
└── vite-env.d.ts    # TypeScript definitions
```

### Technologies Used

- **Phaser 3**: Game framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast development server and build tool
- **HTML5 Canvas**: Rendering engine

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Tips for Survival

1. **Keep Moving**: Zombies are always chasing you
2. **Use Weapon Variety**: Different situations call for different weapons
3. **Master Diagonals**: Use diagonal movement for better positioning
4. **Solid Ring Emergency**: Use weapon 5 when completely surrounded
5. **Line Up Shots**: Bullets pierce, so align zombies for multi-kills

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the [MIT License](LICENSE).

---

**Have fun surviving the zombie apocalypse!** 🎮

