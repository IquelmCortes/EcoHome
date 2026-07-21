import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : 'http://localhost:3000');

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
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [view, setView] = useState('home');
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({ productCount: 0 });
  const [connected, setConnected] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!token) return;

    async function loadProductsAndStats() {
      try {
        const [productsResponse, statsResponse] = await Promise.all([
          fetch(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/auth/users/me/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          setProducts(productsData);
        }

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error(error);
      }
    }

    loadProductsAndStats();

    const client = io(API_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
    });

    client.on('connect', () => {
      setConnected(true);
      setStatus('Conectado al chat');
    });

    client.on('disconnect', () => {
      setConnected(false);
      setStatus('Desconectado del chat');
    });

    client.on('connect_error', (error) => {
      setConnected(false);
      setStatus(`Error de conexión: ${error.message}`);
    });

    client.on('messages', (history) => {
      setMessages(history.slice(-10));
    });

    client.on('message-received', (message) => {
      setMessages((prev) => {
        if (message?.id && prev.some((m) => String(m.id) === String(message.id))) {
          return prev;
        }
        return [...prev.slice(-9), message];
      });
    });

    client.on('message-error', (payload) => {
      setStatus(payload?.error || 'No se pudo enviar el mensaje');
    });

    setSocket(client);

    return () => {
      client.disconnect();
    };
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
      setStats(data.stats || { productCount: 0 });
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

  async function refreshProductsAndStats() {
    if (!token) return;

    try {
      const [productsResponse, statsResponse] = await Promise.all([
        fetch(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/auth/users/me/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        setProducts(productsData);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCreateProduct(event) {
    event.preventDefault();
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: productName, price: Number(productPrice) }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo crear el producto');
      }

      setStatus(`Producto creado: ${data.name}`);
      setProductName('');
      setProductPrice('');
      setView('home');
      await refreshProductsAndStats();
    } catch (error) {
      setStatus(error.message);
    }
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
          <h1>Gestión y chat en tiempo real</h1>
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
          <button type="submit">Entrar</button>
        </form>
      ) : (
        <>
          <div className="hero-card">
            <div>
              <h2>Bienvenido a EcoHome</h2>
              <p>{status}</p>
            </div>
            <div className="hero-actions">
              <button type="button" onClick={() => {
                setView('home');
                refreshProductsAndStats();
              }}>Catálogo</button>
              <button type="button" onClick={() => {
                setView('create');
              }}>Crear producto</button>
              <button type="button" onClick={handleLogout}>Salir</button>
            </div>
          </div>

          <div className="card user-summary">
            <div>
              <h3>{user?.name || user?.email || 'Usuario'}</h3>
              <p>{`${user?.name || user?.email || 'Usuario'} (${stats.productCount})`}</p>
            </div>
            <span className="status-pill">{stats.productCount} productos</span>
          </div>

          {view === 'create' ? (
            <form className="card" onSubmit={handleCreateProduct}>
              <h3>Crear producto</h3>
              <label>
                Nombre
                <input value={productName} onChange={(event) => setProductName(event.target.value)} required />
              </label>
              <label>
                Precio
                <input type="number" value={productPrice} onChange={(event) => setProductPrice(event.target.value)} required />
              </label>
              <button type="submit">Guardar producto</button>
            </form>
          ) : (
            <div className="catalog-layout">
              <section className="card catalog-panel">
                <div className="panel-header">
                  <div>
                    <h2>Catálogo</h2>
                    <p>Productos del backend con creador y estado actual.</p>
                  </div>
                  <span className="status-pill">{stats.productCount} productos</span>
                </div>

                <div className="product-list">
                  {products.length === 0 ? (
                    <p className="muted">No hay productos todavía</p>
                  ) : (
                    products.map((product) => (
                      <article key={product.id} className="product-card">
                        <div className="product-card__info">
                          <strong>{product.name}</strong>
                          <span>{product.creator_name || product.creator_username || 'Sin creador'}</span>
                        </div>
                        <div className="product-card__price">{Number(product.price).toFixed(2)} €</div>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <section className="card chat-panel">
                <div className="chat-header">
                  <div>
                    <h2>Mensajes</h2>
                    <p>{status}</p>
                  </div>
                </div>

                <div className="messages-list">
                  {messages.map((message) => (
                    <article key={message.id || `${message.username}-${message.created_at}`} className="message-item">
                      <strong>{message.username || 'Sistema'}</strong>
                      <p>{message.text}</p>
                      <small>{new Date(message.created_at).toLocaleString()}</small>
                    </article>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <form className="composer" onSubmit={handleSend}>
                  <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribe un mensaje" />
                  <button type="submit">Enviar</button>
                </form>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
