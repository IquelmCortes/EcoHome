import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:socket_io_client/socket_io_client.dart' as io;

String getApiBaseUrl() {
  if (kIsWeb) {
    return 'http://localhost:3000';
  }

  if (defaultTargetPlatform == TargetPlatform.android) {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
}

void main() {
  runApp(const EcoHomeApp());
}

class EcoHomeApp extends StatelessWidget {
  const EcoHomeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EcoHome Mobile',
      theme: ThemeData(primarySwatch: Colors.green),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _loading = true;
  String? _token;

  @override
  void initState() {
    super.initState();
    _loadToken();
  }

  Future<void> _loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() => _token = prefs.getString('ecohome_token'));
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return _token == null ? const LoginScreen() : const HomeScreen();
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController(text: 'admin@ecohome.com');
  final _passwordController = TextEditingController(text: '123456');
  bool _loading = false;
  String? _error;

  Future<void> _login() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final uri = Uri.parse('${getApiBaseUrl()}/auth/login');
      final response = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': _emailController.text.trim(), 'password': _passwordController.text.trim()}),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode != 200) {
        throw Exception(data['error'] ?? 'Error al iniciar sesión');
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('ecohome_token', data['token']);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomeScreen()));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('EcoHome Login')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(controller: _emailController, decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 12),
            TextField(controller: _passwordController, obscureText: true, decoration: const InputDecoration(labelText: 'Contraseña')),
            const SizedBox(height: 20),
            if (_error != null) ...[
              Text(_error!, style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 12),
            ],
            ElevatedButton(onPressed: _loading ? null : _login, child: _loading ? const CircularProgressIndicator() : const Text('Entrar')),
          ],
        ),
      ),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<dynamic> _products = [];
  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  String _status = 'Listo';
  int _selectedIndex = 0;
  int _productCount = 0;
  String _displayName = 'Usuario';
  final TextEditingController _messageController = TextEditingController();
  final TextEditingController _productNameController = TextEditingController();
  final TextEditingController _productPriceController = TextEditingController();
  final ScrollController _chatScrollController = ScrollController();
  io.Socket? _socket;

  @override
  void initState() {
    super.initState();
    _loadProducts();
    _loadMessages();
    _connectSocket();
  }

  @override
  void dispose() {
    _socket?.disconnect();
    _messageController.dispose();
    _productNameController.dispose();
    _productPriceController.dispose();
    _chatScrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_chatScrollController.hasClients) {
        _chatScrollController.animateTo(
          _chatScrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('ecohome_token');
  }

  Future<void> _loadMessages() async {
    try {
      final response = await http.get(Uri.parse('${getApiBaseUrl()}/messages?limit=50'));
      if (response.statusCode == 200) {
        final body = response.body.trim();
        if (body.isEmpty) {
          setState(() => _messages = []);
          return;
        }

        final data = jsonDecode(body);
        setState(() => _messages = List<Map<String, dynamic>>.from(data.map((item) => Map<String, dynamic>.from(item))));
        _scrollToBottom();
      }
    } catch (e) {
      debugPrint('Error cargando mensajes: $e');
      setState(() => _status = 'No se pudo cargar el historial');
    }
  }

  Future<void> _loadProducts() async {
    final token = await _getToken();
    setState(() => _loading = true);
    try {
      final response = await http.get(Uri.parse('${getApiBaseUrl()}/products'), headers: {'Authorization': 'Bearer $token'});
      if (response.statusCode == 200) {
        setState(() => _products = jsonDecode(response.body));
      } else {
        setState(() => _status = 'No se pudieron cargar los productos');
      }

      final statsResponse = await http.get(Uri.parse('${getApiBaseUrl()}/auth/users/me/stats'), headers: {'Authorization': 'Bearer $token'});
      if (statsResponse.statusCode == 200) {
        final stats = jsonDecode(statsResponse.body);
        setState(() => _productCount = stats['productCount'] ?? 0);
      }

      final profileResponse = await http.get(Uri.parse('${getApiBaseUrl()}/auth/me'), headers: {'Authorization': 'Bearer $token'});
      if (profileResponse.statusCode == 200) {
        final profile = jsonDecode(profileResponse.body);
        setState(() {
          _displayName = profile['user']?['name'] ?? profile['user']?['username'] ?? 'Usuario';
        });
      }
    } catch (e) {
      setState(() => _status = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  void _connectSocket() async {
    final token = await _getToken();
    _socket = io.io(
      getApiBaseUrl(),
      io.OptionBuilder()
        .setTransports(['websocket', 'polling'])
        .enableAutoConnect()
        .enableReconnection()
        .setAuth({'token': token})
        .build(),
    );

    _socket!.onConnect((_) {
      _loadMessages();
      setState(() => _status = 'Conectado al chat');
    });

    _socket!.onConnectError((error) {
      setState(() => _status = 'No se pudo conectar al chat: $error');
    });

    _socket!.onDisconnect((_) {
      setState(() => _status = 'Chat desconectado');
    });

    _socket!.on('messages', (data) {
      if (data is List) {
        setState(() {
          _messages = List<Map<String, dynamic>>.from(
            data.map((item) => Map<String, dynamic>.from(item as Map))
          );
        });
        _scrollToBottom();
      }
    });

    _socket!.on('message-received', (data) {
      Map<String, dynamic>? newMsg;
      if (data is Map) {
        newMsg = Map<String, dynamic>.from(data);
      } else if (data is String) {
        try {
          newMsg = Map<String, dynamic>.from(jsonDecode(data));
        } catch (_) {}
      }

      if (newMsg != null) {
        final msg = newMsg;
        setState(() {
          final exists = _messages.any((m) => m['id']?.toString() == msg['id']?.toString());
          if (!exists) {
            _messages = [..._messages, msg];
          }
        });
        _scrollToBottom();
      }
    });
  }

  Future<void> _createProduct() async {
    final token = await _getToken();
    final name = _productNameController.text.trim();
    final price = double.tryParse(_productPriceController.text.trim());

    if (name.isEmpty || price == null || price <= 0) {
      setState(() => _status = 'Introduce un nombre y precio válidos');
      return;
    }

    try {
      final response = await http.post(
        Uri.parse('${getApiBaseUrl()}/products'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
        body: jsonEncode({'name': name, 'price': price}),
      );

      if (response.statusCode == 201) {
        final created = jsonDecode(response.body);
        setState(() {
          _products = [created, ..._products];
          _productCount += 1;
          _status = 'Producto creado';
        });
        await _loadProducts();
        _productNameController.clear();
        _productPriceController.clear();
      } else {
        final body = jsonDecode(response.body);
        setState(() => _status = body['error'] ?? 'No se pudo crear el producto');
      }
    } catch (e) {
      setState(() => _status = e.toString());
    }
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    if (_socket != null && _socket!.connected) {
      _socket!.emit('new-message', {'text': text});
      _messageController.clear();
      setState(() => _status = 'Mensaje enviado');
      return;
    }

    final token = await _getToken();
    try {
      final response = await http.post(
        Uri.parse('${getApiBaseUrl()}/messages'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'text': text}),
      );

      if (response.statusCode == 201) {
        final body = response.body.trim();
        if (body.isEmpty) {
          setState(() => _status = 'Mensaje enviado');
        } else {
          final createdMessage = Map<String, dynamic>.from(jsonDecode(body));
          setState(() {
            if (!_messages.any((m) => m['id'] == createdMessage['id'])) {
              _messages.add(createdMessage);
            }
            _status = 'Mensaje enviado';
          });
        }
        _messageController.clear();
      } else {
        final body = response.body.trim();
        if (body.isEmpty) {
          setState(() => _status = 'No se pudo enviar el mensaje');
        } else {
          final parsed = jsonDecode(body);
          setState(() => _status = parsed['error'] ?? 'No se pudo enviar el mensaje');
        }
      }
    } catch (e) {
      setState(() => _status = e.toString());
    }
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('ecohome_token');
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const LoginScreen()), (route) => false);
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      _buildProductsView(),
      _buildChatView(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('EcoHome Mobile'),
        actions: [
          IconButton(onPressed: _logout, icon: const Icon(Icons.logout)),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Expanded(child: Text(_status, style: const TextStyle(fontWeight: FontWeight.bold))),
                  Chip(label: Text(_selectedIndex == 0 ? 'Catálogo' : 'Chat')),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Expanded(child: pages[_selectedIndex]),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) {
          setState(() => _selectedIndex = index);
          if (index == 1) {
            _scrollToBottom();
          }
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.storefront), label: 'Catálogo'),
          NavigationDestination(icon: Icon(Icons.chat_bubble), label: 'Chat'),
        ],
      ),
    );
  }

  Widget _buildProductsView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Productos disponibles', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Text('$_displayName (${_productCount})', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text('Explora el catálogo y revisa los productos desde el backend.', style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 12),
        TextField(controller: _productNameController, decoration: const InputDecoration(labelText: 'Nombre del producto')),
        const SizedBox(height: 8),
        TextField(controller: _productPriceController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Precio')),
        const SizedBox(height: 8),
        Align(alignment: Alignment.centerRight, child: FilledButton(onPressed: _createProduct, child: const Text('Crear producto'))),
        const SizedBox(height: 12),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  itemCount: _products.length,
                  itemBuilder: (context, index) {
                    final product = _products[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        leading: const CircleAvatar(backgroundColor: Colors.green, child: Icon(Icons.eco, color: Colors.white)),
                        title: Text(product['name'] ?? 'Producto'),
                        subtitle: Text('Precio: ${product['price']} € • Creador: ${product['creator_username'] ?? product['creator_name'] ?? 'Sin creador'}'),
                        trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  String _formatDate(String value) {
    try {
      final date = DateTime.parse(value).toLocal();
      return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return value;
    }
  }

  Widget _buildChatView() {
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            controller: _chatScrollController,
            itemCount: _messages.length,
            itemBuilder: (context, index) {
              final message = _messages[index];
              final createdAt = message['created_at'];
              final formattedDate = createdAt != null ? _formatDate(createdAt) : 'Sin fecha';
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text(message['username'] ?? 'Usuario', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(message['text'] ?? ''),
                      const SizedBox(height: 4),
                      Text(formattedDate, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _messageController,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _sendMessage(),
                decoration: const InputDecoration(hintText: 'Escribe un mensaje'),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _sendMessage, child: const Icon(Icons.send)),
          ],
        ),
      ],
    );
  }
}
