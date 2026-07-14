const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const result = await pool.query(
      `SELECT id, user_id, username, text, created_at
       FROM messages
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

module.exports = router;
