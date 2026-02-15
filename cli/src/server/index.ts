import { serve } from "@hono/node-server";
import { openDb } from "../db/connection.js";
import { initSchema } from "../db/schema.js";
import { createKysely } from "../db/kysely.js";
import { getDeviceId } from "../device.js";
import { TaskService } from "../main.js";
import { createApp } from "./routes.js";

const port = parseInt(process.env.AO_PORT ?? "2358", 10);
const db = openDb();
initSchema(db);

const ky = createKysely(db);
const deviceId = getDeviceId(db);
const service = new TaskService(ky, deviceId);
const app = createApp(service);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`ao server listening on http://localhost:${info.port}`);
});

function shutdown() {
  console.log("Shutting down...");
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
