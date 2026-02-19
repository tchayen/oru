import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openDb } from "../db/connection";
import { initSchema } from "../db/schema";
import { createKysely } from "../db/kysely";
import { getDeviceId } from "../device";
import { TaskService } from "../main";
import { createMcpServer } from "./server";

const db = openDb();
initSchema(db);
const kysely = createKysely(db);
const deviceId = getDeviceId(db);
const service = new TaskService(kysely, deviceId);

const server = createMcpServer(service);
const transport = new StdioServerTransport();
await server.connect(transport);
