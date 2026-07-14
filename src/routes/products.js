const express = require('express');
const pool = require('../config/db');
const { authJWT, authorizeRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

router.post('/', authJWT, authorizeRole('admin'), async (req, res) => {
  try {
    const { name, price } = req.body;

    if (!name || typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: 'name y price deben ser válidos (price > 0)' });
    }

    const result = await pool.query(
      `INSERT INTO products (name, price, created_at, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [name, price]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

router.put('/:id', authJWT, authorizeRole('admin'), async (req, res) => {
  try {
    const { name, price } = req.body;

    if (!name || typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: 'name y price deben ser válidos (price > 0)' });
    }

    const result = await pool.query(
      `UPDATE products
       SET name = $1, price = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [name, price, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

router.patch('/:id', authJWT, authorizeRole('admin'), async (req, res) => {
  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (req.body.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(req.body.name);
    }

    if (req.body.price !== undefined) {
      if (typeof req.body.price !== 'number' || req.body.price <= 0) {
        return res.status(400).json({ error: 'price debe ser numérico y mayor a 0' });
      }
      fields.push(`price = $${idx++}`);
      values.push(req.body.price);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE products
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${idx}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

router.delete('/:id', authJWT, authorizeRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ message: 'Producto eliminado', product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

module.exports = router;
