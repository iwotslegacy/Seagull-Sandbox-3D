const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_PLAYERS = 12;

const rooms = new Map();
const clients = new Map();

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json"
};

function makePlayerId() {
  return crypto.randomBytes(6).toString("hex");
}

function makeSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const len = 6 + Math.floor(Math.random() * 3);
  let code = "";

  for (let i = 0; i < len; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

function makeUniqueRoomCode() {
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();
  return code;
}

function sanitizeRoomCode(code) {
  return String(code || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function makeRoom() {
  const code = makeUniqueRoomCode();
  const room = {
    code,
    seed: makeSeed(),
    createdAt: Date.now(),
    players: new Map(),
    itemStates: new Map()
  };
  rooms.set(code, room);
  return room;
}

function send(socket, data) {
  if (!socket || socket.destroyed) return;

  const json = JSON.stringify(data);
  const payload = Buffer.from(json);
  let header;

  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }

  socket.write(Buffer.concat([header, payload]));
}

function broadcast(room, data, exceptSocket = null) {
  for (const player of room.players.values()) {
    if (player.socket !== exceptSocket) {
      send(player.socket, data);
    }
  }
}

function roomSnapshot(room) {
  purgeExpiredPoops(room);

  return {
    code: room.code,
    seed: room.seed,
    playerCount: room.players.size,
    maxPlayers: MAX_PLAYERS,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      color: p.color,
      name: p.name,
      customization: p.customization,
      state: p.state
    })),
    itemStates: [...room.itemStates.values()]
  };
}

function purgeExpiredPoops(room) {
  const now = Date.now();

  for (const [id, item] of room.itemStates.entries()) {
    if (item.type === "poop" && item.createdAt && now - item.createdAt > 45_000) {
      room.itemStates.delete(id);
    }
  }
}

function leaveRoom(socket) {
  const client = clients.get(socket);
  if (!client || !client.roomCode) return;

  const room = rooms.get(client.roomCode);
  if (!room) return;

  room.players.delete(client.id);
  broadcast(room, {
    type: "peerLeft",
    id: client.id,
    playerCount: room.players.size
  });

  client.roomCode = null;

  if (room.players.size === 0) {
    rooms.delete(room.code);
  }
}

function joinRoom(socket, room, preferredName = "", customization = {}) {
  const client = clients.get(socket);
  if (!client) return;

  if (room.players.size >= MAX_PLAYERS) {
    send(socket, {
      type: "roomFull",
      message: "That room is full. Max 12 seagulls."
    });
    return;
  }

  leaveRoom(socket);

  const colors = [
    "#ffffff", "#ffd166", "#ef476f", "#06d6a0",
    "#118ab2", "#cdb4db", "#ffafcc", "#bde0fe",
    "#a7c957", "#f77f00", "#90be6d", "#f2cc8f"
  ];

  const index = room.players.size;
  const safeCustomization = {
    color: /^#[0-9a-f]{6}$/i.test(String(customization.color || "")) ? String(customization.color) : colors[index % colors.length],
    style: String(customization.style || "classic").replace(/[^a-z0-9_-]/gi, "").slice(0, 20) || "classic"
  };

  const player = {
    id: client.id,
    socket,
    color: safeCustomization.color,
    name: preferredName ? String(preferredName).slice(0, 18) : `Gull ${index + 1}`,
    customization: safeCustomization,
    state: null
  };

  client.roomCode = room.code;
  room.players.set(client.id, player);

  send(socket, {
    type: "joined",
    playerId: client.id,
    room: roomSnapshot(room)
  });

  broadcast(room, {
    type: "peerJoined",
    player: {
      id: player.id,
      color: player.color,
      name: player.name,
      customization: player.customization,
      state: player.state
    },
    playerCount: room.players.size
  }, socket);
}

function handleMessage(socket, message) {
  let data;

  try {
    data = JSON.parse(message);
  } catch {
    send(socket, { type: "error", message: "Bad JSON." });
    return;
  }

  const client = clients.get(socket);
  if (!client) return;

  if (data.type === "create") {
    const room = makeRoom();
    joinRoom(socket, room, data.name, data.customization || {});
    send(socket, {
      type: "created",
      playerId: client.id,
      room: roomSnapshot(room)
    });
    return;
  }

  if (data.type === "join") {
    const code = sanitizeRoomCode(data.code);
    const room = rooms.get(code);

    if (!room) {
      send(socket, {
        type: "roomMissing",
        message: "Room not found."
      });
      return;
    }

    joinRoom(socket, room, data.name, data.customization || {});
    return;
  }

  if (data.type === "leave") {
    leaveRoom(socket);
    send(socket, { type: "left" });
    return;
  }

  const room = client.roomCode ? rooms.get(client.roomCode) : null;
  if (!room) return;

  if (data.type === "state") {
    const player = room.players.get(client.id);
    if (!player) return;

    player.state = data.state || null;
    broadcast(room, {
      type: "peerState",
      id: client.id,
      state: player.state
    }, socket);
    return;
  }

  if (data.type === "playerCustomize") {
    const player = room.players.get(client.id);
    if (!player) return;

    const customization = data.customization || {};
    const safeCustomization = {
      color: /^#[0-9a-f]{6}$/i.test(String(customization.color || "")) ? String(customization.color) : player.color,
      style: String(customization.style || player.customization?.style || "classic").replace(/[^a-z0-9_-]/gi, "").slice(0, 20) || "classic"
    };

    player.name = data.name ? String(data.name).slice(0, 18) : player.name;
    player.customization = safeCustomization;
    player.color = safeCustomization.color;

    broadcast(room, {
      type: "peerCustomize",
      id: player.id,
      color: player.color,
      name: player.name,
      customization: player.customization
    }, socket);
    return;
  }

  if (data.type === "itemUpdate") {
    const item = data.item;
    if (!item || typeof item.id !== "string") return;

    if (item.exists === false) {
      room.itemStates.set(item.id, {
        id: item.id,
        type: item.type || "unknown",
        exists: false,
        updatedAt: Date.now()
      });
    } else {
      const safeItem = {
        id: item.id,
        type: String(item.type || "unknown").slice(0, 24),
        exists: item.exists !== false,
        x: Number(item.x || 0),
        y: Number(item.y || 0),
        z: Number(item.z || 0),
        rx: Number(item.rx || 0),
        ry: Number(item.ry || 0),
        rz: Number(item.rz || 0),
        carriedBy: item.carriedBy || null,
        splatted: Boolean(item.splatted),
        explosive: Boolean(item.explosive),
        createdAt: item.createdAt || Date.now(),
        updatedAt: Date.now()
      };
      room.itemStates.set(safeItem.id, safeItem);
    }

    broadcast(room, {
      type: "itemUpdate",
      item: room.itemStates.get(item.id)
    }, socket);
    return;
  }

  if (data.type === "newMap") {
    room.seed = makeSeed();
    room.itemStates.clear();

    broadcast(room, {
      type: "newMap",
      seed: room.seed
    });

    return;
  }
}

function parseFrames(socket, chunk) {
  socket._wsBuffer = socket._wsBuffer ? Buffer.concat([socket._wsBuffer, chunk]) : chunk;

  while (socket._wsBuffer.length >= 2) {
    const buffer = socket._wsBuffer;
    const first = buffer[0];
    const second = buffer[1];

    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (buffer.length < offset + 2) return;
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (buffer.length < offset + 8) return;
      const big = buffer.readBigUInt64BE(offset);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
        socket.destroy();
        return;
      }
      length = Number(big);
      offset += 8;
    }

    let mask;

    if (masked) {
      if (buffer.length < offset + 4) return;
      mask = buffer.slice(offset, offset + 4);
      offset += 4;
    }

    if (buffer.length < offset + length) return;

    const payload = buffer.slice(offset, offset + length);
    socket._wsBuffer = buffer.slice(offset + length);

    if (opcode === 0x8) {
      socket.end();
      return;
    }

    if (opcode === 0x9) {
      // Ping. Send pong.
      socket.write(Buffer.from([0x8a, 0x00]));
      continue;
    }

    if (opcode !== 0x1) continue;

    let data = payload;

    if (masked && mask) {
      data = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i++) {
        data[i] = payload[i] ^ mask[i % 4];
      }
    }

    handleMessage(socket, data.toString("utf8"));
  }
}

function serveStatic(req, res) {
  let reqPath = decodeURIComponent(req.url.split("?")[0]);

  if (reqPath === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, name: "Seagull Sandbox 3D V3.2" }));
    return;
  }

  if (reqPath === "/") reqPath = "/index.html";
  if (reqPath === "/play") reqPath = "/play.html";

  const filePath = path.normalize(path.join(PUBLIC_DIR, reqPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

const server = http.createServer(serveStatic);

server.on("upgrade", (req, socket) => {
  if (!req.url.startsWith("/ws")) {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${accept}\r\n` +
    "\r\n"
  );

  const id = makePlayerId();
  clients.set(socket, {
    id,
    roomCode: null
  });

  send(socket, {
    type: "hello",
    playerId: id,
    maxPlayers: MAX_PLAYERS
  });

  socket.on("data", (chunk) => parseFrames(socket, chunk));
  socket.on("close", () => {
    leaveRoom(socket);
    clients.delete(socket);
  });
  socket.on("error", () => {
    leaveRoom(socket);
    clients.delete(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Seagull Sandbox 3D V3.2.2 Old Style Layout Fix running at http://localhost:${PORT}`);
  console.log("Open the same URL on another device on your network to join a room.");
});
