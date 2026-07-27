const path = require('path');
const dns = require('dns');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

dns.setDefaultResultOrder('ipv6first');

const connectionString = process.env.DATABASE_URL;
const isSupabase = Boolean(connectionString && connectionString.includes('supabase')) || Boolean(process.env.DB_HOST && process.env.DB_HOST.includes('supabase'));

const useSSL = process.env.DB_SSL === 'true' || isSupabase || Boolean(connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1'));

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

module.exports = pool;
