# 🖥️ Ludo Neo – Client (Frontend)

The frontend of **Ludo Neo** is a React-based Single Page Application (SPA) designed for high responsiveness, smooth animations, and real-time multiplayer synchronization.

---

## 📂 Project Structure

```
frontend/
├── public/
│   ├── ChampLogo.png
│   └── defaultProfile.png
├── src/
│   ├── api/                 # Axios & Socket.io configurations
│   │   ├── axiosConfig.js
│   │   └── socket.js
│   ├── assets/              # Game sound effects
│   ├── components/
│   │   ├── customComponents/
│   │   ├── offlineBoard/
│   │   ├── onlineBoard/
│   │   └── sharedBoardComponents/
│   ├── contexts/            # React Contexts
│   ├── derivedFuncs/        # Utility helpers
│   ├── pages/               # Route-level components
│   ├── store/               # Zustand state management
│   │   ├── gameLogic.js
│   │   ├── onlineGameLogic.js
│   │   ├── useGameStore.js
│   │   ├── userActions.js
│   │   └── userStore.js
│   ├── styles/              # Modular CSS
│   ├── App.jsx              # Root layout & routing
│   ├── ErrorBoundary.jsx    # Global error handling
│   ├── main.jsx             # Entry point
│   └── main.css             # Global styles
├── eslint.config.js
├── index.html
├── package.json
└── vite.config.js
```

---

## 🛠️ Tech Stack

- React & React Router  
- Zustand (state management)  
- Socket.io-client (real-time communication)  
- Axios (API requests)  
- GSAP & Framer Motion (animations)  
- Tailwind CSS (styling)  
- Lucide Icons  
- React Toastify  
- React Image Crop  

---

## 🧠 Core Mechanisms

### ⚡ Optimistic UI Updates
Game pieces animate instantly before server confirmation, masking latency and ensuring smooth gameplay.

### ⏱️ Dynamic Turn Timers
Client-side timers are synchronized with the server timestamp to eliminate drift across players.

### 🔄 State Reconciliation
Detects desynchronization using server ticks and performs forced state sync when necessary.

### 🧩 Delta Patching
Uses modular Zustand actions to update only necessary parts of the state without full re-renders.

---

## ⚙️ Environment Variables

Create a `.env` file in `/frontend`:

| Variable | Description |
|----------|------------|
| VITE_MODE | dev / production |
| VITE_BACKEND_URL | Backend API endpoint |

---

## 🚀 Installation & Development

### 1. Install dependencies
```
cd frontend
npm install
```

### 2. Run development server
```
npm run dev
```

---

## 📦 Production Build

```
npm run build
```

The optimized build will be generated in the `/dist` directory and can be deployed using any static hosting service.

---

## 📡 Client Behavior

- Renders real-time multiplayer board  
- Synchronizes state via WebSockets  
- Handles animations and UI transitions  
- Maintains responsive and reactive gameplay  
