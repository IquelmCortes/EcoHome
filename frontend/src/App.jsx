import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : 'http://localhost:3000');

function decodeUserFromToken(jwtToken) {
  try {
    const payload = JSON.parse(atob(jwtToken.split('.')[1]));
    const now = Date.now() / 1000;
    if (payload.exp && payload.exp < now) {
      return null;
    }
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
  const [editingProduct, setEditingProduct] = useState(null);
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

    const decoded = decodeUserFromToken(token);
    if (!decoded) {
      handleLogout();
      setStatus('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
      return;
    }

    async function loadProductsAndStats() {
      try {
        const [productsResponse, statsResponse] = await Promise.all([
          fetch(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/auth/users/me/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (productsResponse.status === 401 || statsResponse.status === 401) {
          handleLogout();
          setStatus('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
          return;
        }

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

      if (productsResponse.status === 401 || statsResponse.status === 401) {
        handleLogout();
        setStatus('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        return;
      }

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

  async function handleCreateOrUpdateProduct(event) {
    event.preventDefault();
    if (!token) return;

    try {
      const isEditing = Boolean(editingProduct);
      const url = isEditing ? `${API_URL}/products/${editingProduct.id}` : `${API_URL}/products`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: productName, price: Number(productPrice) }),
      });

      if (response.status === 401) {
        handleLogout();
        setStatus('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `No se pudo ${isEditing ? 'actualizar' : 'crear'} el producto`);
      }

      setStatus(`Producto ${isEditing ? 'actualizado' : 'creado'}: ${data.name}`);
      setProductName('');
      setProductPrice('');
      setEditingProduct(null);
      setView('home');
      await refreshProductsAndStats();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleDeleteProduct(id) {
    if (!token) return;
    if (!window.confirm('¿Seguro que deseas eliminar este producto?')) return;

    try {
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        handleLogout();
        setStatus('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo eliminar el producto');
      }

      setStatus(`Producto eliminado con éxito`);
      await refreshProductsAndStats();
    } catch (error) {
      setStatus(error.message);
    }
  }

  function startEdit(product) {
    setEditingProduct(product);
    setProductName(product.name);
    setProductPrice(product.price);
    setView('create');
  }

  function handleLogout() {
    localStorage.removeItem('ecohome-token');
    setToken('');
    setUser(null);
    setMessages([]);
    setStatus('Sesión cerrada');
    if (socket) socket.disconnect();
  }

  const usernameDisplay = user?.name || user?.username || user?.email || 'Usuario';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">EcoHome</p>
          <h1>Gestión y chat en tiempo real</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          {token && (
            <div className="user-badge" style={{ fontWeight: 700, color: '#334155', background: '#e2e8f0', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
              👤 {usernameDisplay} ({stats.productCount})
            </div>
          )}
          <div className="status-pill">{connected ? 'Online' : 'Offline'}</div>
        </div>
      </header>

      {!token ? (
        <form className="card" onSubmit={handleLogin}>
          <h2>Iniciar sesión</h2>
          {status && status !== 'Listo para iniciar sesión' && status !== 'Sesión cerrada' && (
            <p style={{ color: '#ef4444', marginBottom: '1rem', fontWeight: 'bold' }}>{status}</p>
          )}
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
                setEditingProduct(null);
                setProductName('');
                setProductPrice('');
                setView('home');
                refreshProductsAndStats();
              }}>Catálogo</button>
              <button type="button" onClick={() => {
                setEditingProduct(null);
                setProductName('');
                setProductPrice('');
                setView('create');
              }}>Crear producto</button>
              <button type="button" onClick={handleLogout}>Salir</button>
            </div>
          </div>

          <div className="card user-summary">
            <div>
              <h3>Usuario Autenticado</h3>
              <p className="user-display-tag" style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#4f46e5' }}>
                {usernameDisplay} ({stats.productCount})
              </p>
            </div>
            <span className="status-pill">{stats.productCount} productos creados</span>
          </div>

          {view === 'create' ? (
            <form className="card" onSubmit={handleCreateOrUpdateProduct}>
              <h3>{editingProduct ? 'Editar producto' : 'Crear producto'}</h3>
              <label>
                Nombre
                <input value={productName} onChange={(event) => setProductName(event.target.value)} required />
              </label>
              <label>
                Precio
                <input type="number" step="0.01" value={productPrice} onChange={(event) => setProductPrice(event.target.value)} required />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit">{editingProduct ? 'Actualizar producto' : 'Guardar producto'}</button>
                {editingProduct && (
                  <button type="button" style={{ background: '#64748b' }} onClick={() => {
                    setEditingProduct(null);
                    setProductName('');
                    setProductPrice('');
                    setView('home');
                  }}>Cancelar</button>
                )}
              </div>
            </form>
          ) : (
            <div className="catalog-layout">
              <section className="card catalog-panel">
                <div className="panel-header">
                  <div>
                    <h2>Catálogo de Productos</h2>
                    <p>Productos con creador (trazabilidad) y acciones CRUD.</p>
                  </div>
                  <span className="status-pill">{products.length} totales</span>
                </div>

                <div className="product-list">
                  {products.length === 0 ? (
                    <p className="muted">No hay productos todavía</p>
                  ) : (
                    products.map((product) => (
                      <article key={product.id} className="product-card">
                        <div className="product-card__info">
                          <strong>{product.name}</strong>
                          <span className="muted" style={{ fontSize: '0.85rem' }}>
                            Creador: <strong>{product.creator_username || product.creator_name || 'Sin creador'}</strong>
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                          <div className="product-card__price">{Number(product.price).toFixed(2)} €</div>
                          {user?.role === 'admin' && (
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button type="button" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: '#3b82f6' }} onClick={() => startEdit(product)}>
                                ✏️ Edit
                              </button>
                              <button type="button" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: '#ef4444' }} onClick={() => handleDeleteProduct(product.id)}>
                                🗑️ Del
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <section className="card chat-panel">
                <div className="chat-header">
                  <div>
                    <h2>Chat en Tiempo Real</h2>
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
