const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const {
  createGameState, canPlay, applyPlay,
  advanceTurn, forcePick, checkWin, declareNikoKadi, fine,
} = require('../utils/gameEngine');
const pool = require('../config/db');

// In-memory game rooms: { [roomId]: { players, state, maxPlayers } }
const rooms = {};

function gameSocket(io) {
  // Authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username}`);

    // ── Create room ──────────────────────────────────────────────
    socket.on('create_room', ({ maxPlayers = 4 }) => {
      const roomId = uuidv4().slice(0, 6).toUpperCase();
      rooms[roomId] = {
        roomId,
        maxPlayers: Math.min(Math.max(maxPlayers, 2), 8),
        players: [],
        state: null,
        started: false,
      };
      socket.emit('room_created', { roomId });
    });

    // ── Join room ────────────────────────────────────────────────
    socket.on('join_room', ({ roomId }) => {
      const room = rooms[roomId];
      if (!room) return socket.emit('error', { message: 'Room not found' });
      if (room.started) return socket.emit('error', { message: 'Game already started' });
      if (room.players.length >= room.maxPlayers)
        return socket.emit('error', { message: 'Room is full' });
      if (room.players.find(p => p.id === socket.user.id))
        return socket.emit('error', { message: 'Already in room' });

      room.players.push({ id: socket.user.id, username: socket.user.username, socketId: socket.id });
      socket.join(roomId);
      socket.roomId = roomId;

      io.to(roomId).emit('room_update', {
        roomId,
        players: room.players.map(p => ({ id: p.id, username: p.username })),
        maxPlayers: room.maxPlayers,
      });
    });

    // ── Start game ───────────────────────────────────────────────
    socket.on('start_game', async () => {
      const room = rooms[socket.roomId];
      if (!room) return socket.emit('error', { message: 'Not in a room' });
      if (room.players[0].id !== socket.user.id)
        return socket.emit('error', { message: 'Only the host can start' });
      if (room.players.length < 2)
        return socket.emit('error', { message: 'Need at least 2 players' });

      room.state = createGameState(room.players);
      room.started = true;

      // Record game start in DB
      try {
        const result = await pool.query(
          `INSERT INTO games (status, max_players, created_by) VALUES ('playing', $1, $2) RETURNING id`,
          [room.maxPlayers, room.players[0].id]
        );
        room.gameId = result.rows[0].id;
        for (let i = 0; i < room.players.length; i++) {
          await pool.query(
            `INSERT INTO game_players (game_id, user_id, position) VALUES ($1, $2, $3)`,
            [room.gameId, room.players[i].id, i]
          );
        }
      } catch (err) {
        console.error('Failed to record game start:', err.message);
      }

      io.to(socket.roomId).emit('game_start');
      setTimeout(() => broadcastGameState(io, room), 500);
    });

    // ── Play cards ───────────────────────────────────────────────
    socket.on('play_cards', ({ cards, chosenSuit, calledCard }) => {
      const room = rooms[socket.roomId];
      if (!room || !room.state) return socket.emit('error', { message: 'No active game' });

      const state = room.state;
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (currentPlayer.id !== socket.user.id)
        return socket.emit('error', { message: 'Not your turn' });

      // Close NIKO KADI window for any player who missed it (next player is now acting)
      if (state.nikoKadiWindow && state.nikoKadiWindow !== socket.user.id) {
        const missedId = state.nikoKadiWindow;
        if (!state.nikokadi[missedId]) {
          // Fine the player who missed declaring — manually add card without advancing turn
          const fineState = JSON.parse(JSON.stringify(state));
          if (fineState.deck.length === 0 && fineState.discardPile.length > 1) {
            const top = fineState.discardPile[fineState.discardPile.length - 1];
            fineState.deck = fineState.discardPile.slice(0, -1).sort(() => Math.random() - 0.5);
            fineState.discardPile = [top];
          }
          if (fineState.deck.length > 0) {
            fineState.hands[missedId].push(fineState.deck.shift());
          }
          fineState.nikoKadiWindow = null;
          room.state = fineState;
          io.to(socket.roomId).emit('niko_kadi_missed', {
            playerId: missedId,
            username: room.players.find(p => p.id === missedId)?.username,
          });
        } else {
          room.state.nikoKadiWindow = null;
        }
      }

      const { valid, reason, code } = canPlay(cards, room.state, socket.user.id);
      if (!valid) {
        if (code === 'WRONG_SUIT') {
          // Fine player 1 card for wrong suit
          const { newState } = forcePick(room.state, socket.user.id, 1);
          room.state = newState;
          socket.emit('fined', { message: `Wrong suit! You picked 1 card as fine. Active suit: ${state.activeSuit}` });
          broadcastGameState(io, room);
        } else {
          socket.emit('error', { message: reason });
        }
        return;
      }

      room.state = applyPlay(cards, room.state, socket.user.id, { chosenSuit, calledCard });

      // Check win
      if (checkWin(room.state, socket.user.id)) {
        room.state.gameOver = true;
        room.state.winnerId = socket.user.id;
        io.to(socket.roomId).emit('game_over', { winnerId: socket.user.id, username: socket.user.username });
        recordGameResult(room, socket.user.id);
        return;
      }

      broadcastGameState(io, room);
    });

    // ── Pick answer card (when no answer in hand after question) ──
    socket.on('pick_answer', () => {
      const room = rooms[socket.roomId];
      if (!room || !room.state) return;

      const state = room.state;
      if (!state.awaitingAnswer)
        return socket.emit('error', { message: 'No question awaiting an answer' });

      const currentPlayer = state.players[state.currentPlayerIndex];
      if (currentPlayer.id !== socket.user.id)
        return socket.emit('error', { message: 'Not your turn' });

      const newState = JSON.parse(JSON.stringify(state));
      if (newState.deck.length === 0) {
        const top = newState.discardPile[newState.discardPile.length - 1];
        const reshuffled = newState.discardPile.slice(0, -1).sort(() => Math.random() - 0.5);
        newState.discardPile = [top];
        newState.deck = reshuffled;
      }

      if (newState.deck.length > 0) {
        const pickedCard = newState.deck.shift();
        // Picked card joins hand — turn advances normally
        newState.hands[socket.user.id] = newState.hands[socket.user.id] || [];
        newState.hands[socket.user.id].push(pickedCard);
      }

      newState.awaitingAnswer = null;

      // Check hand limit after picking
      if ((newState.hands[socket.user.id] || []).length >= 15) {
        const p = newState.players.find(p => p.id === socket.user.id);
        if (p) p.eliminated = true;
        io.to(socket.roomId).emit('player_eliminated', { playerId: socket.user.id, username: socket.user.username });
      }

      advanceTurn(newState);

      room.state = newState;
      broadcastGameState(io, room);
    });

    // ── Pick cards (when feeding) ────────────────────────────────
    socket.on('pick_cards', () => {
      const room = rooms[socket.roomId];
      if (!room || !room.state) return;

      const state = room.state;
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (currentPlayer.id !== socket.user.id)
        return socket.emit('error', { message: 'Not your turn' });

      const count = state.activeFeed ? state.feedStack : 1;
      const { newState, picks } = forcePick(state, socket.user.id, count);
      room.state = newState;

      socket.emit('cards_picked', { picks, count });

      // Check elimination
      const player = newState.players.find(p => p.id === socket.user.id);
      if (player.eliminated) {
        io.to(socket.roomId).emit('player_eliminated', { playerId: socket.user.id, username: socket.user.username });
      }

      // Check if only one player left
      const active = newState.players.filter(p => !p.eliminated);
      if (active.length === 1) {
        newState.gameOver = true;
        newState.winnerId = active[0].id;
        io.to(socket.roomId).emit('game_over', { winnerId: active[0].id, username: active[0].username });
        recordGameResult(room, active[0].id);
        return;
      }

      broadcastGameState(io, room);
    });

    // ── Niko Kadi declaration ────────────────────────────────────
    socket.on('niko_kadi', () => {
      const room = rooms[socket.roomId];
      if (!room || !room.state) return;

      const state = room.state;

      // Only valid if this player is in the NIKO KADI window
      if (state.nikoKadiWindow !== socket.user.id) {
        return socket.emit('error', { message: 'You can only say NIKO KADI immediately after playing your second-to-last card!' });
      }

      room.state = declareNikoKadi(room.state, socket.user.id);
      io.to(socket.roomId).emit('niko_kadi_declared', { playerId: socket.user.id, username: socket.user.username });
      broadcastGameState(io, room);
    });

    // ── Rejoin game (reconnect or page reload) ───────────────────
    socket.on('rejoin_game', ({ roomId }) => {
      const room = rooms[roomId];
      if (!room || !room.started || room.state?.gameOver) return;

      const player = room.players.find(p => p.id === socket.user.id);
      if (!player) return socket.emit('error', { message: 'You are not in this game' });

      player.socketId = socket.id;
      socket.join(roomId);
      socket.roomId = roomId;

      const { state } = room;
      socket.emit('game_state', {
        discardPile: state.discardPile.slice(-1),
        activeSuit: state.activeSuit,
        activeColour: state.activeColour,
        feedStack: state.feedStack,
        activeFeed: state.activeFeed,
        awaitingAnswer: state.awaitingAnswer,
        nikoKadiWindow: state.nikoKadiWindow,
        specialAceCall: state.specialAceCall,
        direction: state.direction,
        currentPlayerId: state.players[state.currentPlayerIndex].id,
        players: state.players.map(p => ({
          id: p.id,
          username: p.username,
          cardCount: state.hands[p.id]?.length ?? 0,
          eliminated: p.eliminated,
        })),
        myHand: state.hands[player.id] || [],
        nikokadi: state.nikokadi,
      });

      io.to(roomId).emit('player_reconnected', { playerId: socket.user.id, username: socket.user.username });
    });

    // ── Disconnect ───────────────────────────────────────────────
    socket.on('disconnect', () => {
      const room = rooms[socket.roomId];
      if (!room) return console.log(`User disconnected: ${socket.user.username}`);

      if (!room.started) {
        room.players = room.players.filter(p => p.id !== socket.user.id);
        io.to(socket.roomId).emit('room_update', {
          roomId: socket.roomId,
          players: room.players.map(p => ({ id: p.id, username: p.username })),
          maxPlayers: room.maxPlayers,
        });
      } else {
        const player = room.players.find(p => p.id === socket.user.id);
        if (player) player.socketId = null;
        io.to(socket.roomId).emit('player_disconnected', { playerId: socket.user.id, username: socket.user.username });
      }

      console.log(`User disconnected: ${socket.user.username}`);
    });
  });
}

// ─── Send each player only their own hand ────────────────────────────────────
function broadcastGameState(io, room) {
  const { state, players } = room;
  for (const player of players) {
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (!playerSocket) continue;

    playerSocket.emit('game_state', {
      discardPile: state.discardPile.slice(-1), // only top card
      activeSuit: state.activeSuit,
      activeColour: state.activeColour,
      feedStack: state.feedStack,
      activeFeed: state.activeFeed,
      awaitingAnswer: state.awaitingAnswer,
      nikoKadiWindow: state.nikoKadiWindow,
      specialAceCall: state.specialAceCall,
      direction: state.direction,
      currentPlayerId: state.players[state.currentPlayerIndex].id,
      players: state.players.map(p => ({
        id: p.id,
        username: p.username,
        cardCount: state.hands[p.id]?.length ?? 0,
        eliminated: p.eliminated,
      })),
      myHand: state.hands[player.id] || [],
      nikokadi: state.nikokadi,
    });
  }
}

// ─── Persist game result to DB ────────────────────────────────────────────────
async function recordGameResult(room, winnerId) {
  const playerIds = room.players.map(p => p.id);
  const loserIds = playerIds.filter(id => id !== winnerId);
  try {
    await pool.query('UPDATE users SET wins = wins + 1 WHERE id = $1', [winnerId]);
    if (loserIds.length > 0) {
      await pool.query('UPDATE users SET losses = losses + 1 WHERE id = ANY($1)', [loserIds]);
    }
    if (room.gameId) {
      await pool.query(
        `UPDATE games SET status = 'finished', winner_id = $1, finished_at = NOW() WHERE id = $2`,
        [winnerId, room.gameId]
      );
    }
  } catch (err) {
    console.error('Failed to record game result:', err.message);
  }
}

module.exports = gameSocket;
