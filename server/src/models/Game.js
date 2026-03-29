const mongoose = require('mongoose');

const gamePlayerSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    position: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['waiting', 'playing', 'finished'],
      default: 'waiting',
    },
    maxPlayers: {
      type: Number,
      default: 4,
    },
    createdBy: {
      type: String,
      required: true,
    },
    winnerId: {
      type: String,
      default: null,
    },
    players: {
      type: [gamePlayerSchema],
      default: [],
    },
    finishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
  }
);

module.exports = mongoose.model('Game', gameSchema);
