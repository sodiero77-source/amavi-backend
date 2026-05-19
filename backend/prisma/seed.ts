import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const ADMIN_EMAIL = 'admin@amavi.com';
const ADMIN_PASSWORD = 'Amavi2026!';
const FACILITY_NAME = 'Mon Ami - Facility 1';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run the seed script.');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query('BEGIN');

    const existingFacility = await client.query<{ id: string }>(
      'SELECT id FROM "Facility" WHERE name = $1 ORDER BY "createdAt" ASC LIMIT 1',
      [FACILITY_NAME],
    );

    const facilityId = existingFacility.rows[0]?.id ?? randomUUID();

    if (!existingFacility.rows[0]) {
      await client.query(
        'INSERT INTO "Facility" (id, name, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW())',
        [facilityId, FACILITY_NAME],
      );
    }

    const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const existingUser = await client.query<{ id: string }>(
      'SELECT id FROM "User" WHERE email = $1 LIMIT 1',
      [ADMIN_EMAIL],
    );

    if (existingUser.rows[0]) {
      await client.query(
        'UPDATE "User" SET "facilityId" = $1, password = $2, role = $3, "fullName" = $4, "updatedAt" = NOW() WHERE email = $5',
        [facilityId, password, 'ADMIN', 'Admin User', ADMIN_EMAIL],
      );
    } else {
      await client.query(
        'INSERT INTO "User" (id, "facilityId", email, password, "fullName", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
        [randomUUID(), facilityId, ADMIN_EMAIL, password, 'Admin User', 'ADMIN'],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main()
  .then(() => {
    console.log('Seed completed: admin@amavi.com linked to Mon Ami - Facility 1.');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
