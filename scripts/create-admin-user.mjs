import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const connectionInfo = new URL(DATABASE_URL);
const db = await mysql.createConnection({
  host: connectionInfo.hostname,
  port: Number(connectionInfo.port || 3306),
  user: connectionInfo.username,
  password: connectionInfo.password,
  database: connectionInfo.pathname.replace(/^\//, ''),
  multipleStatements: true,
});

const email = 'admin@hotelflow.local';
const password = 'admin';
const fullName = 'ADmin';
const role = 'ADMIN';

try {
  const [rows] = await db.execute('SHOW TABLES LIKE "hotels"');
  if (!rows || (Array.isArray(rows) && rows.length === 0)) {
    console.error('No hotels table found. Run the Prisma migrations first.');
    process.exit(1);
  }

  const hotelId = await ensureHotel(db);
  const existing = await findUserByEmail(db, email);

  if (existing) {
    console.log(`Admin user already exists: ${existing.email}`);
    await db.execute('UPDATE users SET full_name = ?, password_hash = ?, role = ?, is_active = true WHERE email = ?', [fullName, await bcrypt.hash(password, 12), role, email]);
    console.log('Updated admin user credentials and role.');
    process.exit(0);
  }

  await db.execute(
    'INSERT INTO users (id, hotel_id, full_name, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, true, NOW(), NOW())',
    [randomUUID(), hotelId, fullName, email, await bcrypt.hash(password, 12), role]
  );

  console.log('Created admin user:');
  console.log('Email:', email);
  console.log('Password:', password);
  console.log('Role:', role);
  console.log('Full name:', fullName);
} catch (error) {
  console.error('Failed to create admin user:', error);
  process.exit(1);
} finally {
  await db.end();
}

async function ensureHotel(connection) {
  const [rows] = await connection.execute('SELECT id FROM hotels ORDER BY created_at LIMIT 1');
  if (Array.isArray(rows) && rows.length > 0) {
    return rows[0].id;
  }

  const hotelId = randomUUID();
  await connection.execute(
    'INSERT INTO hotels (id, name, timezone, currency, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
    [hotelId, 'HotelFlow Default', 'UTC', 'USD']
  );

  return hotelId;
}

async function findUserByEmail(connection, emailAddress) {
  const [rows] = await connection.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [emailAddress]);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}
