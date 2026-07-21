const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

async function getProfileData(userId) {
  const userResult = await pool.query(
    `SELECT id, name, username, email, role FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    return null;
  }

  const user = userResult.rows[0];
  const statsResult = await pool.query(
    `SELECT COUNT(*)::int AS product_count FROM products WHERE created_by = $1`,
    [userId]
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    stats: {
      productCount: statsResult.rows[0]?.product_count ?? 0,
    },
  };
}

router.post('/signup', async (req, res) => {
  try {
    const { name, username, email, password, role = 'client' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email y password son obligatorios' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, username, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, username, email, role, created_at`,
      [name, username || null, email, passwordHash, role]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son obligatorios' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const profile = await getProfileData(user.id);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        username: user.username || user.name || user.email.split('@')[0],
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      user: profile?.user || { id: user.id, name: user.name, email: user.email, role: user.role },
      stats: profile?.stats || { productCount: 0 },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

router.get('/me', require('../middleware/auth').authJWT, async (req, res) => {
  try {
    const profile = await getProfileData(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el perfil' });
  }
});

router.get('/users/me/stats', require('../middleware/auth').authJWT, async (req, res) => {
  try {
    const profile = await getProfileData(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(profile.stats);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

module.exports = router;
