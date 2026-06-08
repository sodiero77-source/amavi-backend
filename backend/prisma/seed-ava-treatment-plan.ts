import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

type ResidentRow = {
  id: string;
  facilityId: string;
  firstName: string;
  lastName: string;
};

type UserRow = {
  id: string;
};

type TreatmentPlanRow = {
  id: string;
};

type ProblemRow = {
  id: string;
};

type GoalRow = {
  id: string;
};

type ObjectiveRow = {
  id: string;
  description: string;
};

const RESIDENT_FIRST_NAME = 'Ava';
const RESIDENT_LAST_NAME = 'Rivera';

const PROBLEM_DESCRIPTION =
  'Generalized anxiety disorder with insomnia impacting daily functioning.';
const GOAL_DESCRIPTION =
  'Ava will reduce anxiety symptoms and improve sleep hygiene consistency.';
const OBJECTIVE_DESCRIPTIONS = [
  'Identify 3 coping skills for anxiety.',
  'Improve sleep hygiene consistency.',
];

async function findAvaRivera(client: Client): Promise<ResidentRow> {
  const result = await client.query<ResidentRow>(
    `
    SELECT id, "facilityId", "firstName", "lastName"
    FROM "Resident"
    WHERE "firstName" = $1
      AND "lastName" = $2
      AND status = 'ACTIVE'
    ORDER BY "createdAt" ASC
    `,
    [RESIDENT_FIRST_NAME, RESIDENT_LAST_NAME],
  );

  if (result.rows.length === 0) {
    throw new Error('Active resident Ava Rivera was not found.');
  }

  if (result.rows.length > 1) {
    const ids = result.rows.map((resident) => resident.id).join(', ');
    throw new Error(
      `Found multiple active Ava Rivera residents. Refusing to guess. Resident IDs: ${ids}`,
    );
  }

  return result.rows[0];
}

async function findPlanCreator(
  client: Client,
  facilityId: string,
): Promise<UserRow> {
  const result = await client.query<UserRow>(
    `
    SELECT id
    FROM "User"
    WHERE "facilityId" = $1
      AND role IN ('ADMIN', 'SUPERVISOR', 'CLINICIAN')
    ORDER BY
      CASE role
        WHEN 'ADMIN' THEN 1
        WHEN 'SUPERVISOR' THEN 2
        WHEN 'CLINICIAN' THEN 3
        ELSE 4
      END,
      "createdAt" ASC
    LIMIT 1
    `,
    [facilityId],
  );

  const user = result.rows[0];
  if (!user) {
    throw new Error(
      `No ADMIN, SUPERVISOR, or CLINICIAN user found for facility ${facilityId}.`,
    );
  }

  return user;
}

async function ensureActiveTreatmentPlan(
  client: Client,
  resident: ResidentRow,
  createdById: string,
): Promise<TreatmentPlanRow> {
  const existing = await client.query<TreatmentPlanRow>(
    `
    SELECT id
    FROM "TreatmentPlanV2"
    WHERE "facilityId" = $1
      AND "residentId" = $2
      AND status = 'ACTIVE'
    ORDER BY "createdAt" ASC
    LIMIT 1
    `,
    [resident.facilityId, resident.id],
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const inserted = await client.query<TreatmentPlanRow>(
    `
    INSERT INTO "TreatmentPlanV2" (
      id,
      "facilityId",
      "residentId",
      status,
      "createdById",
      "createdAt",
      "updatedAt"
    )
    VALUES ($1, $2, $3, 'ACTIVE', $4, NOW(), NOW())
    RETURNING id
    `,
    [randomUUID(), resident.facilityId, resident.id, createdById],
  );

  const plan = inserted.rows[0];
  if (!plan) {
    throw new Error('Failed to create active treatment plan.');
  }

  return plan;
}

async function ensureProblem(
  client: Client,
  treatmentPlanId: string,
): Promise<ProblemRow> {
  const existing = await client.query<ProblemRow>(
    `
    SELECT id
    FROM "TreatmentPlanProblem"
    WHERE "treatmentPlanId" = $1
      AND description = $2
    ORDER BY "createdAt" ASC
    LIMIT 1
    `,
    [treatmentPlanId, PROBLEM_DESCRIPTION],
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const inserted = await client.query<ProblemRow>(
    `
    INSERT INTO "TreatmentPlanProblem" (
      id,
      "treatmentPlanId",
      description,
      "createdAt"
    )
    VALUES ($1, $2, $3, NOW())
    RETURNING id
    `,
    [randomUUID(), treatmentPlanId, PROBLEM_DESCRIPTION],
  );

  const problem = inserted.rows[0];
  if (!problem) {
    throw new Error('Failed to create treatment plan problem.');
  }

  return problem;
}

async function ensureGoal(client: Client, problemId: string): Promise<GoalRow> {
  const existing = await client.query<GoalRow>(
    `
    SELECT id
    FROM "TreatmentPlanGoal"
    WHERE "problemId" = $1
      AND description = $2
    ORDER BY "createdAt" ASC
    LIMIT 1
    `,
    [problemId, GOAL_DESCRIPTION],
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const inserted = await client.query<GoalRow>(
    `
    INSERT INTO "TreatmentPlanGoal" (
      id,
      "problemId",
      description,
      "createdAt"
    )
    VALUES ($1, $2, $3, NOW())
    RETURNING id
    `,
    [randomUUID(), problemId, GOAL_DESCRIPTION],
  );

  const goal = inserted.rows[0];
  if (!goal) {
    throw new Error('Failed to create treatment plan goal.');
  }

  return goal;
}

async function ensureObjectives(
  client: Client,
  goalId: string,
): Promise<ObjectiveRow[]> {
  const objectives: ObjectiveRow[] = [];

  for (const description of OBJECTIVE_DESCRIPTIONS) {
    const existing = await client.query<ObjectiveRow>(
      `
      SELECT id, description
      FROM "TreatmentPlanObjective"
      WHERE "goalId" = $1
        AND description = $2
      ORDER BY "createdAt" ASC
      LIMIT 1
      `,
      [goalId, description],
    );

    if (existing.rows[0]) {
      objectives.push(existing.rows[0]);
      continue;
    }

    const inserted = await client.query<ObjectiveRow>(
      `
      INSERT INTO "TreatmentPlanObjective" (
        id,
        "goalId",
        description,
        status,
        "targetDate",
        "createdAt"
      )
      VALUES ($1, $2, $3, 'NOT_STARTED', NULL, NOW())
      RETURNING id, description
      `,
      [randomUUID(), goalId, description],
    );

    const objective = inserted.rows[0];
    if (!objective) {
      throw new Error(`Failed to create objective: ${description}`);
    }

    objectives.push(objective);
  }

  return objectives;
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

    const resident = await findAvaRivera(client);
    const creator = await findPlanCreator(client, resident.facilityId);
    const treatmentPlan = await ensureActiveTreatmentPlan(
      client,
      resident,
      creator.id,
    );
    const problem = await ensureProblem(client, treatmentPlan.id);
    const goal = await ensureGoal(client, problem.id);
    const objectives = await ensureObjectives(client, goal.id);

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          treatmentPlanId: treatmentPlan.id,
          problemId: problem.id,
          goalId: goal.id,
          objectiveIds: objectives.map((objective) => objective.id),
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
