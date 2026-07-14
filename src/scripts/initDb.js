const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

async function initDb() {
  const schemaPath = path.join(__dirname, '..', '..', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const adminConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: 'postgres',
  };

  const targetDb = process.env.DB_NAME || 'ecohome_db';

  const adminClient = new Client(adminConfig);

  try {
    await adminClient.connect();

    const dbExists = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [targetDb]
    );

    if (dbExists.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`Base de datos creada: ${targetDb}`);
    } else {
      console.log(`La base de datos ya existe: ${targetDb}`);
    }

    await adminClient.end();

    const pool = require('../config/db');
    await pool.query(schema);
    console.log('Tablas creadas correctamente.');
  } catch (error) {
    console.error('Error al crear las tablas:', error.message);
    process.exit(1);
  }
}

initDb();
