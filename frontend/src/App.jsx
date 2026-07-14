import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:3000');

function decodeUserFromToken(jwtToken) {
  try {
    const payload = JSON.parse(atob(jwtToken.split('.')[1]));
    return {
      id: payload.id,
      email: payload.email,
      name: payload.username || payload.email?.split('@')[0],
      role: payload.role,
    };
  } catch {
    return null;
  }
}

function App() {
  const [email, setEmail] = useState('admin@ecohome.com');
  const [password, setPassword] = useState('123456');
  const [token, setToken] = useState(localStorage.getItem('ecohome-token') || '');
  const [user, setUser] = useState(() => {
    const savedToken = localStorage.getItem('ecohome-token');
    return savedToken ? decodeUserFromToken(savedToken) : null;
  });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('Listo para iniciar sesión');
  const [socket, setSocket] = useState(null);

  const connected = useMemo(() => Boolean(socket?.connected), [socket]);

  useEffect(() => {
    if (!token) return;

    const client = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    client.on('connect', () => {
      setStatus('Conectado al chat');
    });

    client.on('connect_error', (error) => {
      setStatus(`Error de conexión: ${error.message}`);
    });

    client.on('messages', (history) => {
      setMessages(history.slice(-10));
    });

    client.on('message-received', (message) => {
      setMessages((prev) => [...prev.slice(-9), message]);
    });

    client.on('message-error', (payload) => {
      setStatus(payload?.error || 'No se pudo enviar el mensaje');
    });

    setSocket(client);

    return () => client.disconnect();
  }, [token]);

  async function handleLogin(event) {
    event.preventDefault();
    setStatus('Iniciando sesión...');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

      localStorage.setItem('ecohome-token', data.token);
      setToken(data.token);
      setUser(data.user);
      setStatus(`Bienvenido ${data.user?.name || data.user?.email}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  function handleSend(event) {
    event.preventDefault();
    if (!draft.trim() || !socket?.connected) {
      setStatus('Escribe un mensaje y asegúrate de estar conectado');
      return;
    }

    socket.emit('new-message', { text: draft.trim() });
    setDraft('');
  }

  function handleLogout() {
    localStorage.removeItem('ecohome-token');
    setToken('');
    setUser(null);
    setMessages([]);
    setStatus('Sesión cerrada');
    if (socket) socket.disconnect();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">EcoHome</p>
          <h1>Chat interno en tiempo real</h1>
        </div>
        <div className="status-pill">{connected ? 'Online' : 'Offline'}</div>
      </header>

      {!token ? (
        <form className="card" onSubmit={handleLogin}>
          <h2>Iniciar sesión</h2>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit">Entrar al chat</button>
        </form>
      ) : (
        <div className="chat-layout">
          <section className="card chat-panel">
            <div className="chat-header">
              <div>
                <h2>Mensajes</h2>
                <p>{status}</p>
              </div>
              <button type="button" onClick={handleLogout}>Salir</button>
            </div>

            <div className="messages-list">
              {messages.map((message) => (
                <article key={message.id || `${message.username}-${message.created_at}`} className="message-item">
                  <strong>{message.username || 'Sistema'}</strong>
                  <p>{message.text}</p>
                  <small>{new Date(message.created_at).toLocaleString()}</small>
                </article>
              ))}
            </div>

            <form className="composer" onSubmit={handleSend}>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribe un mensaje" />
              <button type="submit">Enviar</button>
            </form>
          </section>

          <aside className="card sidebar">
            <h2>Usuario activo</h2>
            <p>{user?.name || user?.email || 'Sin usuario'}</p>
            <p className="muted">Token guardado en localStorage</p>
            <p className="muted">Últimos 10 mensajes cargados al conectar</p>
          </aside>
        </div>
      )}
    </div>
  );
}

export default App;
