const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

async function initDb() {
  const schemaPath = path.join(__dirname, '..', '..', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  try {
    const pool = require('../config/db');
    await pool.query(schema);
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE SET NULL`);
    console.log('Tablas creadas correctamente.');
  } catch (error) {
    console.error('Error al crear las tablas:', error.message);
    process.exit(1);
  }
}

initDb();
