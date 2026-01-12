# Split Focus - Game Mechanics & Features

## 1. Game Overview
**Split Focus** is a reflex-based survival game where the player controls two independent entities simultaneously. The screen is divided into two halves (Left and Right), each containing two vertical lanes. The objective is to survive as long as possible by dodging falling obstacles on both sides.

## 2. Core Mechanics

### Dual-System Control
- The game world is split vertically into two distinct zones:
  - **Left Zone**: Blue/Cyan theme. Contains 2 lanes.
  - **Right Zone**: Pink/Red theme. Contains 2 lanes.
- Each zone has a player avatar that can occupy one of its two lanes at a time.
- **Toggling**: Input actions "toggle" the player's position between the two lanes (Lane 0 <-> Lane 1). There is no continuous movement; it is an instant switch.

### Obstacles & Spawning
- **Obstacles**: Rectangular blocks fall from the top of the screen towards the bottom.
- **Spawning Logic**:
  - Obstacles spawn at intervals that decrease as the game progresses.
  - **Safety Algorithm**: The game employs a `pickLaneSafe` algorithm to prevent "impossible scenarios" (e.g., walls of obstacles across both lanes with no vertical gap).
  - **Self-Test**: On initialization, the game runs a simulation (`runSelfTests`) to verify that the random generation logic does not create unavoidable walls.

### Difficulty Progression
The game becomes harder over time based on the score (survival time):
- **Speed Multiplier**: Increases linearly with time. `speedMultiplier = 1 + (timeSeconds * 0.12)`.
- **Spawn Interval**: Decreases as speed increases, capping at a minimum of 250ms. `spawnInterval = 900 - (timeSeconds * 50)`.

### Collision & Game Over
- **Hitbox**: Simple AABB (Axis-Aligned Bounding Box) collision detection.
- **Condition**: If either the Left Player or Right Player overlaps with an obstacle, the game ends immediately.

## 3. Controls

The game supports multiple input methods for cross-platform compatibility.

### Desktop (Keyboard)
- **`A` Key**: Toggles the **Left** player's lane.
- **`L` Key**: Toggles the **Right** player's lane.
- **`P` Key**: Toggles **Pause/Resume**.

### Desktop (Mouse)
- **Click Left Side**: Toggles **Left** player.
- **Click Right Side**: Toggles **Right** player.

### Mobile (Touch)
- **Tap Left Side**: Toggles **Left** player.
- **Tap Right Side**: Toggles **Right** player.
- **Multi-touch**: Supported via `changedTouches`. Players can tap both sides simultaneously or hold one side while tapping the other without interference.

## 4. Scoring & Persistence

### Scoring System
- Score is calculated based on **delta time** and the current **speed multiplier**.
- You earn points simply by surviving. Faster game speed = faster score accumulation.

### Data Persistence (`localStorage`)
The game saves user data locally to the browser:
- **Best Score**: The highest score ever achieved.
- **History**: A list of the last 5 attempts is stored and displayed in the UI.

## 5. User Interface (UI)

### Heads-Up Display (HUD)
- **Score**: Real-time current score.
- **Best**: High score display.
- **Controls/Status**: Pause button and Restart button.

### Feedback
- **Start Screen**: Instructions overlay ("Tap left/right to start").
- **Pause Screen**: "Paused" overlay with instructions to resume.
- **Game Over**: Displays "Game Over" or "New High Score!" messages.
- **History Chips**: Visual list of recent scores at the bottom of the UI.

### Responsiveness & Accessibility
- **Viewport Handling**: Calculates `1vh` dynamically to handle mobile address bars (CSS variable `--vh`).
- **Orientation Hint**: On mobile devices, if the screen height is too cramped (< 520px) and in landscape mode, a prompt appears suggesting portrait mode.
- **High DPI Support**: Canvas resolution scales with `window.devicePixelRatio` for crisp rendering on Retina/mobile screens.

## 6. Visuals
- **Theme**: Dark, neon cyber-aesthetic.
- **Rendering**: HTML5 Canvas (`2d` context).
- **Styling**: 
  - Rounded rectangles for players and obstacles.
  - Radial gradient background.
  - Subtle transparency and borders for a "glassy" UI look.
