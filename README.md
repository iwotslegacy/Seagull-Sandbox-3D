# Seagull Sandbox 3D V3.2 — Public Flock

V3.2 adds character names, a seagull customizer, better procedural gull details, visual effects, and deployment-ready files so the game can run on a real public URL instead of only localhost.

## New in V3.2

- Character name saved in the browser
- Accent color picker
- Seagull styles:
  - Classic
  - Punk crest
  - Captain
  - Bandit
  - Fancy
- Name tags above multiplayer seagulls
- Custom look is sent when creating/joining a room
- Better procedural seagull details:
  - cheek color
  - accessories
  - cleaner custom accents
- Effects:
  - pickup sparkle
  - eat crumbs
  - takeoff feathers
  - poop/splat particles
  - bigger super-poop explosion burst
- Deployment files:
  - `render.yaml`
  - `Dockerfile`
  - `.gitignore`
  - Node engine metadata

## Run locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Play with friends without localhost

You need to deploy the Node/WebSocket server to a public host. This project is ready for hosts that support Node.js web services and WebSockets.

### Option A: Render

1. Create a GitHub repo.
2. Upload/push this project.
3. On Render, create a new Web Service from the repo.
4. Render should use:
   - Build command: `npm install`
   - Start command: `npm start`
5. Open the public URL Render gives you.

This repo includes `render.yaml`, so Render can also detect the service settings.

### Option B: Railway

1. Create a GitHub repo.
2. Upload/push this project.
3. Create a new Railway project from the GitHub repo.
4. Make sure it runs `npm start`.
5. Open the public Railway URL.

## Project structure

```text
package.json
server.js
render.yaml
Dockerfile
public/
  index.html
  play.html
  css/
    site.css
    game-ui.css
  js/
    site.js
    game.js
  assets/
    models/
```

## Optional real models

Put optional GLB files here:

```text
public/assets/models/
```

Supported names include:

```text
seagull.glb
chips.glb
fish.glb
hotdog.glb
bread.glb
phone.glb
poop.glb
fries.glb
burger.glb
donut.glb
soda.glb
pizza.glb
shell.glb
sunglasses.glb
bottle.glb
```
