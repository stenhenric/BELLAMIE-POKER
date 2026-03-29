const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const {
  createGameState, normalizeCardsForPlay, canPlay, applyPlay,
  advanceTurn, forcePick, checkWin, declareNikoKadi, syncNikoKadiStatus,
  reshuffleDeck,
} = require('../utils/gameEngine');
const User = require('../models/User');
const Game = require('../models/Game');

// In-memory game rooms: { [roomId]: { players, state, maxPlayers } }
const rooms = {};

function emitAppError(socket, message) {
  socket.emit('app_error', { message });
}

function emitRoomUpdate(io, room) {
  io.to(room.roomId).emit('room_update', {
    roomId: room.roomId,
    players: room.players.map(player => ({ id: player.id, username: player.username })),
    maxPlayers: room.maxPlayers,
  });
}

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
      let roomId;
      do {
        roomId = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
      } while (rooms[roomId]);

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
      if (!room) return emitAppError(socket, 'Room not found');
      if (room.started) return emitAppError(socket, 'Game already started');

      const existingPlayer = room.players.find(player => player.id === socket.user.id);
      if (existingPlayer) {
        existingPlayer.socketId = socket.id;
        socket.join(roomId);
        socket.roomId = roomId;
        emitRoomUpdate(io, room);
        return;
      }

      if (room.players.length >= room.maxPlayers)
        return emitAppError(socket, 'Room is full');

      room.players.push({ id: socket.user.id, username: socket.user.username, socketId: socket.id });
      socket.join(roomId);
      socket.roomId = roomId;
      emitRoomUpdate(io, room);
    });

    // ── Start game ───────────────────────────────────────────────
    socket.on('start_game', async () => {
      const room = rooms[socket.roomId];
      if (!room) return emitAppError(socket, 'Not in a room');
      if (room.players[0].id !== socket.user.id)
        return emitAppError(socket, 'Only the host can start');
      if (room.players.length < 2)
        return emitAppError(socket, 'Need at least 2 players');

      room.state = createGameState(room.players);
      room.started = true;

      // Record game start in DB
      try {
        const game = await Game.create({
          status: 'playing',
          maxPlayers: room.maxPlayers,
          createdBy: room.players[0].id,
          players: room.players.map((player, index) => ({
            userId: player.id,
            position: index,
          })),
        });
        room.gameId = game._id.toString();
      } catch (err) {
        console.error('Failed to record game start:', err.message);
      }

      io.to(socket.roomId).emit('game_start');
      setTimeout(() => broadcastGameState(io, room), 500);
    });

    // ── Play cards ───────────────────────────────────────────────
    socket.on('play_cards', ({ cards, chosenSuit, calledCard }) => {
      const room = rooms[socket.roomId];
      if (!room || !room.state) return emitAppError(socket, 'No active game');

      const state = room.state;
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (currentPlayer.id !== socket.user.id)
        return emitAppError(socket, 'Not your turn');

      // Close NIKO KADI window for any player who missed it (next player is now acting)
      if (state.nikoKadiWindow && state.nikoKadiWindow !== socket.user.id) {
        const missedId = state.nikoKadiWindow;
        if (!state.nikokadi[missedId]) {
          const { newState } = forcePick(room.state, missedId, 1, {
            advanceTurnAfterPick: false,
            resetFeed: false,
          });
          newState.nikoKadiWindow = null;
          room.state = newState;
          io.to(socket.roomId).emit('niko_kadi_missed', {
            playerId: missedId,
            username: room.players.find(p => p.id === missedId)?.username,
          });
        } else {
          room.state.nikoKadiWindow = null;
        }
      }

      const normalizedCards = normalizeCardsForPlay(cards, room.state, socket.user.id);
      if (!normalizedCards.valid) {
        return emitAppError(socket, normalizedCards.reason);
      }

      const selectedCards = normalizedCards.cards;
      const { valid, reason, code } = canPlay(selectedCards, room.state, socket.user.id, {
        chosenSuit,
        calledCard,
      });
      if (!valid) {
        if (code === 'WRONG_SUIT') {
          // Fine player 1 card for wrong suit
          const { newState } = forcePick(room.state, socket.user.id, 1, {
            advanceTurnAfterPick: false,
            resetFeed: false,
          });
          room.state = newState;
          socket.emit('fined', { message: `Wrong suit! You picked 1 card as fine. Active suit: ${state.activeSuit}` });
          broadcastGameState(io, room);
        } else {
          emitAppError(socket, reason);
        }
        return;
      }

      room.state = applyPlay(selectedCards, room.state, socket.user.id, { chosenSuit, calledCard });

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
        return emitAppError(socket, 'No question awaiting an answer');

      const currentPlayer = state.players[state.currentPlayerIndex];
      if (currentPlayer.id !== socket.user.id)
        return emitAppError(socket, 'Not your turn');

      const newState = JSON.parse(JSON.stringify(state));
      if (newState.deck.length === 0) {
        reshuffleDeck(newState);
      }

      if (newState.deck.length > 0) {
        const pickedCard = newState.deck.shift();
        // Picked card joins hand — turn advances normally
        newState.hands[socket.user.id] = newState.hands[socket.user.id] || [];
        newState.hands[socket.user.id].push(pickedCard);
      }

      newState.awaitingAnswer = null;
      syncNikoKadiStatus(newState, socket.user.id);

      // Check hand limit after picking
      if ((newState.hands[socket.user.id] || []).length >= 15) {
        const p = newState.players.find(p => p.id === socket.user.id);
        if (p) p.eliminated = true;
        io.to(socket.roomId).emit('player_eliminated', { playerId: socket.user.id, username: socket.user.username });
      }

      const activePlayers = newState.players.filter(player => !player.eliminated);
      if (activePlayers.length === 1) {
        newState.gameOver = true;
        newState.winnerId = activePlayers[0].id;
        room.state = newState;
        io.to(socket.roomId).emit('game_over', { winnerId: activePlayers[0].id, username: activePlayers[0].username });
        recordGameResult(room, activePlayers[0].id);
        return;
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
        return emitAppError(socket, 'Not your turn');

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
        return emitAppError(socket, 'You can only say NIKO KADI immediately after playing your second-to-last card!');
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
      if (!player) return emitAppError(socket, 'You are not in this game');

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
        if (room.players.length === 0) {
          delete rooms[socket.roomId];
        } else {
          emitRoomUpdate(io, room);
        }
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
    await User.updateOne({ _id: winnerId }, { $inc: { wins: 1 } });
    if (loserIds.length > 0) {
      await User.updateMany({ _id: { $in: loserIds } }, { $inc: { losses: 1 } });
    }
    if (room.gameId) {
      await Game.updateOne(
        { _id: room.gameId },
        { $set: { status: 'finished', winnerId, finishedAt: new Date() } }
      );
    }
  } catch (err) {
    console.error('Failed to record game result:', err.message);
  }
}

module.exports = gameSocket;
