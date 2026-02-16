import crypto from "crypto";
import os from "os";
import { serve } from "@hono/node-server";
import qrcode from "qrcode";
import { openDb } from "../db/connection.js";
import { initSchema } from "../db/schema.js";
import { createKysely } from "../db/kysely.js";
import { getDeviceId } from "../device.js";
import { TaskService } from "../main.js";
import { createApp } from "./routes.js";
import { orange } from "../format/colors.js";

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const addrs of Object.values(interfaces)) {
    if (!addrs) {
      continue;
    }
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  return "127.0.0.1";
}

async function printQr(data: string): Promise<void> {
  const code = await qrcode.toString(data, { type: "terminal", small: true });
  console.log(code);
}

const port = parseInt(process.env.ORU_PORT ?? "2358", 10);
const db = openDb();
initSchema(db);

const ky = createKysely(db);
const deviceId = getDeviceId(db);
const service = new TaskService(ky, deviceId);
const token = process.env.ORU_AUTH_TOKEN ?? crypto.randomBytes(32).toString("base64url");
const pairingCode = process.env.ORU_PAIRING_CODE ?? crypto.randomBytes(16).toString("base64url");
const app = createApp(service, token, pairingCode);

let tunnelStop: (() => void) | undefined;

const server = serve({ fetch: app.fetch, port }, async (info) => {
  const localIp = getLocalIp();
  const localUrl = `http://${localIp}:${info.port}`;
  console.log(`${orange("oru")} server listening on ${localUrl}`);
  console.log(`Token: ${token}`);

  if (process.env.ORU_TUNNEL === "1") {
    try {
      const { Tunnel } = await import("cloudflared");
      const tunnel = Tunnel.quick(`http://localhost:${info.port}`);
      tunnelStop = () => tunnel.stop();
      tunnel.once("url", async (tunnelUrl: string) => {
        console.log(`Tunnel: ${tunnelUrl}`);
        await printQr(`${tunnelUrl}/pair?code=${pairingCode}`);
      });
    } catch (err) {
      console.error("Failed to start tunnel:", err);
    }
  } else {
    await printQr(`${localUrl}/pair?code=${pairingCode}`);
  }
});

function shutdown() {
  console.log("Shutting down...");
  if (tunnelStop) {
    tunnelStop();
  }
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
