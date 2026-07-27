const express = require('express');
const pool = require('../config/db');
const { authJWT } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const userResult = await pool.query(
      `SELECT id, name, username, email, role FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = userResult.rows[0];
    const statsResult = await pool.query(
      `SELECT COUNT(*)::int AS product_count FROM products WHERE created_by = $1`,
      [userId]
    );

    const productCount = statsResult.rows[0]?.product_count ?? 0;

    res.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      stats: {
        productCount,
      },
      productCount,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener datos del usuario' });
  }
});

router.get('/me/stats', authJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const statsResult = await pool.query(
      `SELECT COUNT(*)::int AS product_count FROM products WHERE created_by = $1`,
      [userId]
    );

    const productCount = statsResult.rows[0]?.product_count ?? 0;

    res.json({
      productCount,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas del usuario' });
  }
});

module.exports = router;
