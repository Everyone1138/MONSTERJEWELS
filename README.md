# Monster Duel — Elemental Arena (v2)

A mobile-first, two-player match-3 monster battler. Ten original vector monsters, elemental gem targeting, charge meters, and animated attacks. The art is scalable SVG (not Xbox-grade 3D). No copyrighted Plato assets are included.

## Play locally

Open `index.html` and press **Play demo**. Choose a monster first. Match three or more gems by tapping adjacent tiles. **Only gems matching your monster's element fill your attack meter.** Every 9 matching gems triggers a 22-HP attack (29 HP for matches of 4+). Other colors clear the board but do not charge your attack. The CPU plays the other side.

## Publish online with GitHub Pages + Firebase

1. Create a Firebase project at https://console.firebase.google.com/ .
2. In Authentication > Sign-in method, enable **Anonymous**.
3. Create a **Realtime Database** (not Firestore). In its Rules tab, paste `database.rules.json` and publish. The included rules are for a friendly prototype, not a cheating-resistant competitive game.
4. Project settings > Your apps > Add Web app. Copy the web config into `config.js`, including your Realtime Database URL. Firebase web configuration is public by design; never paste admin service account secrets here.
5. Upload `index.html`, `game.js`, `monsters.js`, `config.js`, `database.rules.json`, and this README to a GitHub repository. In Settings > Pages choose Deploy from a branch, main, /(root).
6. Open the GitHub Pages link on two phones. Player one chooses a monster and creates a room; player two picks their monster and joins using the code/link. Maximum two players per room. Different rooms can play concurrently.

## Technical limitations

- GitHub Pages hosts the static client; Firebase handles multiplayer synchronization.
- Room writes are authenticated but game moves are not independently verified server-side. For public competitive play use authoritative server validation, tighter database rules, presence/disconnect cleanup, and abuse controls.
- SVG monsters are original stylized 2D art with motion. Xbox-quality 3D graphics would require a separate pipeline of modeled, rigged, textured and animated GLB characters, lighting, and a WebGL renderer such as Three.js/Babylon.js. Mobile performance and download sizes must be considered.
- The room is not automatically deleted on exit. Room code expires for new joins after 24 hours.

## V3 visual upgrade
Monster artwork now features layered gradients, glowing eyes, scales/armor, detailed horns and claws, stronger shadows, and a cinematic arena. The artwork remains lightweight SVG so it runs on mobile and GitHub Pages without external assets. These are enhanced 2D illustrations, **not** Xbox-quality 3D models. Genuine console-quality visuals require individually authored and optimized 3D assets (GLB), rigs, textures, animation clips, and a WebGL renderer.

## V4 — procedural Three.js 3D creatures
The battle arena now renders original colorful 3D monsters using Three.js, physically modeled from primitives, with glossy eyes, species-specific ears/horns/wings/tails, soft lighting, idle motion and attack/hit animations. All 10 selectable monsters are supported. The game logic and Firebase multiplayer remain unchanged. This is a first 3D prototype, **not** console-quality rigged/texture-painted art. A later art-production pass should replace procedural models with optimized artist-authored GLB assets and skeletal animation.

**Important:** Three.js is loaded as an ES module from jsDelivr, so internet access is needed even for local demo mode. GitHub Pages works without a build step. For local testing, serve the folder with `python -m http.server 8000` and open `http://localhost:8000` (or publish to GitHub Pages for mobile testing). WebGL-capable mobile browsers are required.
