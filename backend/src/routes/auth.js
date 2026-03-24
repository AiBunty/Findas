const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

function getAdminConfig() {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
    passwordPlain: process.env.ADMIN_PASSWORD || 'change_me'
  };
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const cfg = getAdminConfig();
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'username and password are required' });
  }

  if (username !== cfg.username) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }

  let isValid = false;
  if (cfg.passwordHash) {
    isValid = await bcrypt.compare(password, cfg.passwordHash);
  } else {
    isValid = password === cfg.passwordPlain;
  }

  if (!isValid) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { sub: cfg.username, role: 'admin' },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return res.json({ ok: true, token });
});

module.exports = router;
