# Repo Planets

Transform any GitHub user's repositories into an interactive **3D solar system**. Each repo becomes a planet — its size, color, and orbit reveal its story at a glance.

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r161-black?logo=threedotjs&logoColor=white)
![React Three Fiber](https://img.shields.io/badge/R3F-8.15-orange)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)

---

## How It Works

Enter a GitHub username (or full profile URL) and watch their public repositories materialize as orbiting planets around a central sun.

| Property | Maps To |
|----------|---------|
| **Planet size** | Stars — logarithmic scale so every repo is visible |
| **Planet color** | Primary language — matches GitHub's linguist palette |
| **Orbit radius** | Position index + forks influence |
| **Orbit speed** | Inner planets orbit faster (like real physics) |
| **Rotation** | Each planet spins at a unique rate |
| **Hover** | Glow ring + tooltip with stars, forks, language |
| **Click** | Opens the repository on GitHub |

## Features

- **Procedural planet textures** — generated via Canvas with craters, highlights, and atmosphere glow per language color
- **Central sun** — pulsing golden star with dynamic point lights
- **3,000-star background** — slowly rotating starfield for depth
- **Bloom post-processing** — cinematic space glow via `@react-three/postprocessing`
- **Orbit rings** — subtle translucent paths for each planet
- **Language legend** — bottom-left panel showing all languages in the system
- **User badge** — avatar and planet count, bottom-right
- **Smart input** — accepts `username` or `https://github.com/username` URLs
- **Error handling** — user not found, rate limits, empty repos
- **Responsive** — adapts camera distance to the outermost orbit

## Quick Start

```bash
# Clone
git clone https://github.com/davila7/repo-planets.git
cd repo-planets

# Install
npm install

# Run
npm run dev
```

Open `http://localhost:5173` and type a GitHub username to explore.

## Project Structure

```
src/
├── App.jsx                      # State management & layout
├── main.jsx                     # Entry point
├── index.css                    # Styling (Space Grotesk + Space Mono)
├── components/
│   ├── SolarSystem.jsx          # R3F Canvas, camera, lights, bloom
│   ├── Sun.jsx                  # Central star with pulsing glow
│   ├── Planet.jsx               # Repo planet — texture, orbit, hover
│   ├── OrbitRing.jsx            # Translucent orbit path
│   ├── Starfield.jsx            # Background star particles
│   ├── SearchBar.jsx            # GitHub username/URL input
│   ├── Tooltip.jsx              # Hover info card
│   ├── Legend.jsx               # Language color legend
│   └── UserBadge.jsx            # User avatar badge
└── services/
    ├── github.js                # GitHub API + repo→planet mapping
    └── languageColors.js        # 35+ language colors
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 |
| 3D Engine | Three.js r161 |
| React binding | React Three Fiber 8 |
| 3D helpers | Drei (OrbitControls, Html) |
| Post-processing | @react-three/postprocessing (Bloom) |
| Bundler | Vite 5 |
| Fonts | Space Grotesk + Space Mono |
| API | GitHub REST API v3 (no auth required) |

## API Limits

This project uses the **unauthenticated** GitHub API, which allows **60 requests/hour** per IP. Each search is 1 request. For higher limits, you can add a personal access token to the fetch headers in `src/services/github.js`.

---

## Built with Claude Code Templates

This project was generated using the **3D Web Experience** skill from [Claude Code Templates](https://www.aitmpl.com):

```bash
npx claude-code-templates@latest --skill=creative-design/3d-web-experience --yes
```

The [3D Web Experience](https://www.aitmpl.com/component/skill/3d-web-experience) skill is a specialized Claude Code skill that acts as a **3D Web Experience Architect** — expert in Three.js, React Three Fiber, Spline, WebGL, and interactive 3D scenes. It provides patterns for stack selection, model pipelines, scroll-driven 3D, and performance optimization.

### What are Claude Code Skills?

Skills are pre-built configurations that give Claude Code domain expertise. They live in `.claude/skills/` and activate automatically when relevant. Install any skill with:

```bash
npx claude-code-templates@latest --skill=<category>/<skill-name> --yes
```

Browse all available skills and components at **[aitmpl.com](https://www.aitmpl.com)** | Docs at **[docs.aitmpl.com](https://docs.aitmpl.com)**

---

## License

MIT
