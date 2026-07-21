const express = require('express');
const pool = require('../config/db');
const { authJWT } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const result = await pool.query(
      `SELECT id, user_id, username, text, created_at
       FROM (
         SELECT id, user_id, username, text, created_at
         FROM messages
         ORDER BY created_at DESC
         LIMIT $1
       ) recent
       ORDER BY created_at ASC`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

router.post('/', authJWT, async (req, res) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

    if (!text) {
      return res.status(400).json({ error: 'El texto del mensaje es obligatorio' });
    }

    const result = await pool.query(
      `INSERT INTO messages (user_id, username, text, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       RETURNING id, user_id, username, text, created_at`,
      [req.user?.id || null, req.user?.username || req.user?.email?.split('@')[0] || 'usuario', text]
    );

    const savedMessage = result.rows[0];
    const io = req.app.get('io');
    if (io) {
      io.emit('message-received', savedMessage);
    }

    res.status(201).json(savedMessage);
  } catch (error) {
    console.error('[messages] Error al crear mensaje:', error.message);
    res.status(500).json({ error: 'No se pudo guardar el mensaje' });
  }
});

module.exports = router;
