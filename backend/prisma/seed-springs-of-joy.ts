import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

type CreatedUser = {
  id: string;
  email: string;
  role: string;
  facilityId: string;
};

type CreatedResident = {
  id: string;
  facilityId: string;
};

type CreatedOrder = {
  id: string;
  residentId: string;
};

const FACILITY_NAME = 'Springs of Joy';

const FACILITY_SETTINGS = {
  companyName: 'Springs of Joy',
  providerNpiOrTaxNumber: 'NPI 1234567890',
  email: 'ops@springsofjoy.com',
  logoUrl: null as string | null,
  programType: 'Residential Behavioral Health',
  addressLine1: '100 Joy Lane',
  addressLine2: null as string | null,
  city: 'Phoenix',
  state: 'AZ',
  postalCode: '85001',
  timeZone: 'America/Phoenix',
  shifts: ['Day', 'Evening', 'Overnight'],
  servicesProvided: [
    'Medication management',
    'Behavioral health support',
    'Care coordination',
  ],
  levelsOfFunctioning: ['Independent', 'Supervised', 'Assisted'],
  urgentNotificationEmails: ['ops@springsofjoy.com', 'oncall@springsofjoy.com'],
  residentAttendanceOptions: ['Present', 'Absent', 'Excused', 'On pass'],
  clientLabel: 'Client',
  residentReportLabel: 'Resident Report',
  governingBodyLabel: 'Governing Body',
  residentIdLabel: 'Resident ID',
  secondaryResidentIdLabel: null as string | null,
  serviceCoordinatorLabel: 'Service Coordinator',
  evaluatorLeadLabel: 'Evaluator Lead',
  goalsLabel: 'Goals',
};

const USERS = [
  {
    email: 'admin@springsofjoy.com',
    password: 'SpringsofJoy2026!Admin',
    role: 'ADMIN',
    fullName: 'Springs of Joy Admin',
  },
  {
    email: 'medtech@springsofjoy.com',
    password: 'SpringsofJoy2026!MedTech',
    role: 'MEDTECH',
    fullName: 'Springs of Joy Med Tech',
  },
] as const;

const RESIDENT = {
  firstName: 'Ava',
  lastName: 'Rivera',
  dateOfBirth: new Date('1994-04-18T00:00:00.000Z'),
  admissionDate: new Date('2026-05-01T00:00:00.000Z'),
  primaryDiagnosis: 'Generalized anxiety disorder',
  secondaryDiagnoses: ['Insomnia'],
  levelOfCare: 'Residential',
  serviceFrequency: 'Daily',
};

const MEDICATION_ORDERS = [
  {
    medicationName: 'Sertraline',
    dose: '50 mg',
    route: 'PO',
    frequency: 'Daily',
    status: 'ACTIVE',
    schedule: {
      type: 'SCHEDULED',
      scheduledTime: '08:00',
      scheduledDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      instructions: 'Take with food.',
      isActive: true,
    },
  },
  {
    medicationName: 'Hydroxyzine',
    dose: '25 mg',
    route: 'PO',
    frequency: 'PRN anxiety',
    status: 'ACTIVE',
    schedule: {
      type: 'PRN',
      scheduledTime: null,
      scheduledDays: [],
      instructions: 'Use as needed for anxiety.',
      isActive: true,
    },
  },
] as const;

async function ensureFacility(client: Client): Promise<string> {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM "Facility" WHERE name = $1 ORDER BY "createdAt" ASC LIMIT 1',
    [FACILITY_NAME],
  );

  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

  const facilityId = randomUUID();
  await client.query(
    'INSERT INTO "Facility" (id, name, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW())',
    [facilityId, FACILITY_NAME],
  );
  return facilityId;
}

async function upsertFacilitySettings(client: Client, facilityId: string): Promise<void> {
  await client.query(
    `
    INSERT INTO "FacilitySettings" (
      id,
      "facilityId",
      "companyName",
      "providerNpiOrTaxNumber",
      email,
      "logoUrl",
      "programType",
      "addressLine1",
      "addressLine2",
      city,
      state,
      "postalCode",
      "timeZone",
      shifts,
      "servicesProvided",
      "levelsOfFunctioning",
      "urgentNotificationEmails",
      "residentAttendanceOptions",
      "clientLabel",
      "residentReportLabel",
      "governingBodyLabel",
      "residentIdLabel",
      "secondaryResidentIdLabel",
      "serviceCoordinatorLabel",
      "evaluatorLeadLabel",
      "goalsLabel",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, NOW(), NOW()
    )
    ON CONFLICT ("facilityId") DO UPDATE SET
      "companyName" = EXCLUDED."companyName",
      "providerNpiOrTaxNumber" = EXCLUDED."providerNpiOrTaxNumber",
      email = EXCLUDED.email,
      "logoUrl" = EXCLUDED."logoUrl",
      "programType" = EXCLUDED."programType",
      "addressLine1" = EXCLUDED."addressLine1",
      "addressLine2" = EXCLUDED."addressLine2",
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      "postalCode" = EXCLUDED."postalCode",
      "timeZone" = EXCLUDED."timeZone",
      shifts = EXCLUDED.shifts,
      "servicesProvided" = EXCLUDED."servicesProvided",
      "levelsOfFunctioning" = EXCLUDED."levelsOfFunctioning",
      "urgentNotificationEmails" = EXCLUDED."urgentNotificationEmails",
      "residentAttendanceOptions" = EXCLUDED."residentAttendanceOptions",
      "clientLabel" = EXCLUDED."clientLabel",
      "residentReportLabel" = EXCLUDED."residentReportLabel",
      "governingBodyLabel" = EXCLUDED."governingBodyLabel",
      "residentIdLabel" = EXCLUDED."residentIdLabel",
      "secondaryResidentIdLabel" = EXCLUDED."secondaryResidentIdLabel",
      "serviceCoordinatorLabel" = EXCLUDED."serviceCoordinatorLabel",
      "evaluatorLeadLabel" = EXCLUDED."evaluatorLeadLabel",
      "goalsLabel" = EXCLUDED."goalsLabel",
      "updatedAt" = NOW()
    `,
    [
      randomUUID(),
      facilityId,
      FACILITY_SETTINGS.companyName,
      FACILITY_SETTINGS.providerNpiOrTaxNumber,
      FACILITY_SETTINGS.email,
      FACILITY_SETTINGS.logoUrl,
      FACILITY_SETTINGS.programType,
      FACILITY_SETTINGS.addressLine1,
      FACILITY_SETTINGS.addressLine2,
      FACILITY_SETTINGS.city,
      FACILITY_SETTINGS.state,
      FACILITY_SETTINGS.postalCode,
      FACILITY_SETTINGS.timeZone,
      FACILITY_SETTINGS.shifts,
      FACILITY_SETTINGS.servicesProvided,
      FACILITY_SETTINGS.levelsOfFunctioning,
      FACILITY_SETTINGS.urgentNotificationEmails,
      FACILITY_SETTINGS.residentAttendanceOptions,
      FACILITY_SETTINGS.clientLabel,
      FACILITY_SETTINGS.residentReportLabel,
      FACILITY_SETTINGS.governingBodyLabel,
      FACILITY_SETTINGS.residentIdLabel,
      FACILITY_SETTINGS.secondaryResidentIdLabel,
      FACILITY_SETTINGS.serviceCoordinatorLabel,
      FACILITY_SETTINGS.evaluatorLeadLabel,
      FACILITY_SETTINGS.goalsLabel,
    ],
  );
}

async function upsertUser(
  client: Client,
  facilityId: string,
  email: string,
  password: string,
  role: string,
  fullName: string,
): Promise<CreatedUser> {
  const existingUserResult = await client.query<CreatedUser>(
    'SELECT id, email, role, "facilityId" FROM "User" WHERE email = $1 LIMIT 1',
    [email],
  );

  const existingUser = existingUserResult.rows[0];
  if (existingUser && existingUser.facilityId !== facilityId) {
    throw new Error(
      `Refusing to overwrite existing user ${email} from facility ${existingUser.facilityId}.`,
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await client.query<CreatedUser>(
    `
    INSERT INTO "User" (
      id,
      "facilityId",
      email,
      password,
      "fullName",
      role,
      "createdAt",
      "updatedAt"
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET
      "facilityId" = EXCLUDED."facilityId",
      password = EXCLUDED.password,
      "fullName" = EXCLUDED."fullName",
      role = EXCLUDED.role,
      "updatedAt" = NOW()
    RETURNING id, email, role, "facilityId"
    `,
    [randomUUID(), facilityId, email, passwordHash, fullName, role],
  );

  const user = result.rows[0];
  if (!user) {
    throw new Error(`Failed to upsert user ${email}`);
  }
  return user;
}

async function upsertResident(
  client: Client,
  facilityId: string,
): Promise<CreatedResident> {
  const existing = await client.query<CreatedResident>(
    `
    SELECT id, "facilityId"
    FROM "Resident"
    WHERE "facilityId" = $1
      AND "firstName" = $2
      AND "lastName" = $3
      AND "dateOfBirth" = $4
      AND "admissionDate" = $5
    ORDER BY "createdAt" ASC
    LIMIT 1
    `,
    [
      facilityId,
      RESIDENT.firstName,
      RESIDENT.lastName,
      RESIDENT.dateOfBirth,
      RESIDENT.admissionDate,
    ],
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const inserted = await client.query<CreatedResident>(
    `
    INSERT INTO "Resident" (
      id,
      "facilityId",
      "firstName",
      "lastName",
      "dateOfBirth",
      "admissionDate",
      "primaryDiagnosis",
      "secondaryDiagnoses",
      "levelOfCare",
      "serviceFrequency",
      status,
      "createdAt",
      "updatedAt"
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
    )
    RETURNING id, "facilityId"
    `,
    [
      randomUUID(),
      facilityId,
      RESIDENT.firstName,
      RESIDENT.lastName,
      RESIDENT.dateOfBirth,
      RESIDENT.admissionDate,
      RESIDENT.primaryDiagnosis,
      RESIDENT.secondaryDiagnoses,
      RESIDENT.levelOfCare,
      RESIDENT.serviceFrequency,
      'ACTIVE',
    ],
  );

  const resident = inserted.rows[0];
  if (!resident) {
    throw new Error('Failed to create resident');
  }
  return resident;
}

async function upsertMedicationOrder(
  client: Client,
  facilityId: string,
  residentId: string,
  createdById: string,
  definition: (typeof MEDICATION_ORDERS)[number],
): Promise<CreatedOrder> {
  const existing = await client.query<CreatedOrder>(
    `
    SELECT id, "residentId"
    FROM "MedicationOrder"
    WHERE "facilityId" = $1
      AND "residentId" = $2
      AND "medicationName" = $3
      AND "dose" = $4
      AND "route" = $5
      AND "frequency" = $6
    ORDER BY "createdAt" ASC
    LIMIT 1
    `,
    [facilityId, residentId, definition.medicationName, definition.dose, definition.route, definition.frequency],
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const inserted = await client.query<CreatedOrder>(
    `
    INSERT INTO "MedicationOrder" (
      id,
      "facilityId",
      "residentId",
      "medicationName",
      "dose",
      "route",
      "frequency",
      status,
      "createdById",
      "createdAt",
      "updatedAt"
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    RETURNING id, "residentId"
    `,
    [
      randomUUID(),
      facilityId,
      residentId,
      definition.medicationName,
      definition.dose,
      definition.route,
      definition.frequency,
      definition.status,
      createdById,
    ],
  );

  const order = inserted.rows[0];
  if (!order) {
    throw new Error(`Failed to create medication order ${definition.medicationName}`);
  }
  return order;
}

async function upsertMedicationSchedule(
  client: Client,
  facilityId: string,
  residentId: string,
  medicationOrderId: string,
  createdById: string,
  schedule: (typeof MEDICATION_ORDERS)[number]['schedule'],
): Promise<void> {
  const existing = await client.query(
    `
    SELECT id
    FROM "MedicationSchedule"
    WHERE "facilityId" = $1
      AND "residentId" = $2
      AND "medicationOrderId" = $3
      AND type = $4
      AND COALESCE("scheduledTime", '') = COALESCE($5, '')
    ORDER BY "createdAt" ASC
    LIMIT 1
    `,
    [facilityId, residentId, medicationOrderId, schedule.type, schedule.scheduledTime],
  );

  if (existing.rows[0]) {
    return;
  }

  await client.query(
    `
    INSERT INTO "MedicationSchedule" (
      id,
      "facilityId",
      "residentId",
      "medicationOrderId",
      type,
      "scheduledTime",
      "scheduledDays",
      "startDate",
      "endDate",
      instructions,
      "isActive",
      "createdById",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, NULL, NULL, $8, $9, $10, NOW(), NOW()
    )
    `,
    [
      randomUUID(),
      facilityId,
      residentId,
      medicationOrderId,
      schedule.type,
      schedule.scheduledTime,
      schedule.scheduledDays,
      schedule.instructions,
      schedule.isActive,
      createdById,
    ],
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run this seed script.');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query('BEGIN');

    const facilityId = await ensureFacility(client);
    await upsertFacilitySettings(client, facilityId);

    const adminUser = await upsertUser(
      client,
      facilityId,
      USERS[0].email,
      USERS[0].password,
      USERS[0].role,
      USERS[0].fullName,
    );
    const medtechUser = await upsertUser(
      client,
      facilityId,
      USERS[1].email,
      USERS[1].password,
      USERS[1].role,
      USERS[1].fullName,
    );

    const resident = await upsertResident(client, facilityId);

    const medicationOrders: CreatedOrder[] = [];
    for (const definition of MEDICATION_ORDERS) {
      const order = await upsertMedicationOrder(
        client,
        facilityId,
        resident.id,
        adminUser.id,
        definition,
      );
      medicationOrders.push(order);
      await upsertMedicationSchedule(
        client,
        facilityId,
        resident.id,
        order.id,
        adminUser.id,
        definition.schedule,
      );
    }

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          facilityId,
          adminUserId: adminUser.id,
          medtechUserId: medtechUser.id,
          residentId: resident.id,
          medicationOrderIds: medicationOrders.map((order) => order.id),
          loginEmails: USERS.map((user) => user.email),
          loginEndpoint: '/api/auth/login',
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
