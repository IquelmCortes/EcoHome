const path = require('path');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const pool = require('./config/db');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const messageRoutes = require('./routes/messages');

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.json({ message: 'EcoHome Store API beta-ready' });
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'chat.html'));
});

app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/messages', messageRoutes);

io.use((socket, next) => {
  const authHeader = socket.handshake.headers.authorization;
  const tokenFromAuth = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = tokenFromAuth || socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    return next(new Error('Unauthorized'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      username: decoded.username || decoded.email?.split('@')[0] || 'usuario',
    };
    next();
  } catch (error) {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', async (socket) => {
  console.log(`[socket] Usuario conectado: ${socket.id} (${socket.user?.username || 'sin usuario'})`);

  try {
    const historyResult = await pool.query(
      `SELECT id, user_id, username, text, created_at
       FROM (
         SELECT id, user_id, username, text, created_at
         FROM messages
         ORDER BY created_at DESC
         LIMIT 10
       ) recent
       ORDER BY created_at ASC`
    );
    socket.emit('messages', historyResult.rows);
  } catch (error) {
    console.error('[socket] Error al obtener historial:', error.message);
  }

  socket.on('new-message', async (payload) => {
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';

    if (!text) {
      return;
    }

    try {
      const result = await pool.query(
        `INSERT INTO messages (user_id, username, text, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING id, user_id, username, text, created_at`,
        [socket.user?.id || null, socket.user?.username || 'usuario', text]
      );

      const savedMessage = result.rows[0];
      console.log(`[socket] Mensaje guardado: ${savedMessage.text}`);
      io.emit('message-received', savedMessage);
    } catch (error) {
      console.error('[socket] Error al guardar el mensaje:', error.message);
      socket.emit('message-error', { error: 'No se pudo guardar el mensaje' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[socket] Usuario desconectado: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
  console.log('Prueba de chat en http://localhost:3000/chat');
});
