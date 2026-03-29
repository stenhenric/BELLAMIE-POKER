const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function mapUserResponse(userDoc) {
  return {
    id: userDoc._id.toString(),
    username: userDoc.username,
    email: userDoc.email,
    wins: userDoc.wins,
    losses: userDoc.losses,
  };
}

async function register(req, res) {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: 'All fields required' });

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedUsername = String(username).trim();
    const exists = await User.exists({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });
    if (exists)
      return res.status(409).json({ message: 'Username or email already taken' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashed,
    });
    const token = jwt.sign({ id: user._id.toString(), username: user.username }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
    res.status(201).json({ token, user: mapUserResponse(user) });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'Username or email already taken' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password required' });

  try {
    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user)
      return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id.toString(), username: user.username }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
    res.json({ token, user: mapUserResponse(user) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.id).select('username email wins losses');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(mapUserResponse(user));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { register, login, getMe };
