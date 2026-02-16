import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openDb } from "../db/connection.js";
import { initSchema } from "../db/schema.js";
import { createKysely } from "../db/kysely.js";
import { getDeviceId } from "../device.js";
import { TaskService } from "../main.js";
import { createMcpServer } from "./server.js";

const db = openDb();
initSchema(db);
const kysely = createKysely(db);
const deviceId = getDeviceId(db);
const service = new TaskService(kysely, deviceId);

const server = createMcpServer(service);
const transport = new StdioServerTransport();
await server.connect(transport);
