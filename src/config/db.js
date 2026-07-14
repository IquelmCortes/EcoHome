const path = require('path');
const dns = require('dns');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

dns.setDefaultResultOrder('ipv6first');

const connectionString = process.env.DATABASE_URL;
const isSupabase = Boolean(connectionString && connectionString.includes('supabase')) || Boolean(process.env.DB_HOST && process.env.DB_HOST.includes('supabase'));

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: isSupabase ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      ssl: isSupabase ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

module.exports = pool;
