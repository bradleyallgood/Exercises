// Stands in for a real wearable provider, for local testing.
//
//   npm run wearable -- link you@example.com     link your account to the mock athlete
//   npm run wearable -- send                     send a new activity
//   npm run wearable -- send act_123             send one again, to see a retry update it

import { createHmac } from "node:crypto";
import pg from "pg";

const PROVIDER = "pulse";
const ATHLETE_ID = "ath_demo";
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "http://localhost:3000/api/webhooks/wearable";

async function link(email) {
  if (!email) throw new Error("Usage: npm run wearable -- link you@example.com");

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query('select id from "user" where email = $1', [email]);
    if (!rows[0]) throw new Error(`No account for ${email}. Sign up first.`);

    await client.query(
      `insert into wearable_connections (provider, athlete_id, user_id) values ($1, $2, $3)
       on conflict (provider, athlete_id) do update set user_id = excluded.user_id`,
      [PROVIDER, ATHLETE_ID, rows[0].id],
    );
    console.log(`Linked ${ATHLETE_ID} to ${email}`);
  } finally {
    await client.end();
  }
}

async function send(activityId = `act_${Date.now()}`) {
  const secret = process.env.WEARABLE_WEBHOOK_SECRET;
  if (!secret) throw new Error("WEARABLE_WEBHOOK_SECRET is not set in .env.local");

  const body = JSON.stringify({
    id: `evt_${Date.now()}`,
    type: "activity.created",
    data: {
      activity_id: activityId,
      athlete_id: ATHLETE_ID,
      sport_type: "running",
      start_date: new Date().toISOString(),
      elapsed_seconds: 1834,
      distance_meters: 5210,
      average_heart_rate: 151,
    },
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pulse-signature": `t=${timestamp},v1=${digest}` },
    body,
  });
  console.log(`${activityId}: ${response.status} ${await response.text()}`);
}

const [command, argument] = process.argv.slice(2);
const commands = { link, send };

if (!commands[command]) {
  console.error("Usage: npm run wearable -- <link email | send [activityId]>");
  process.exit(1);
}
await commands[command](argument);
