import os from "os";
import { serve } from "@hono/node-server";
import qrcode from "qrcode-terminal";
import { openDb } from "../db/connection.js";
import { initSchema } from "../db/schema.js";
import { createKysely } from "../db/kysely.js";
import { getDeviceId } from "../device.js";
import { TaskService } from "../main.js";
import { createApp } from "./routes.js";

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

function printQr(url: string): void {
  qrcode.generate(url, { small: true }, (code) => {
    console.log(code);
  });
}

const port = parseInt(process.env.AO_PORT ?? "2358", 10);
const db = openDb();
initSchema(db);

const ky = createKysely(db);
const deviceId = getDeviceId(db);
const service = new TaskService(ky, deviceId);
const app = createApp(service);

let tunnelStop: (() => void) | undefined;

const server = serve({ fetch: app.fetch, port }, async (info) => {
  const localIp = getLocalIp();
  const localUrl = `http://${localIp}:${info.port}`;
  console.log(`ao server listening on ${localUrl}`);

  if (process.env.AO_TUNNEL === "1") {
    try {
      const { Tunnel } = await import("cloudflared");
      const tunnel = Tunnel.quick(`http://localhost:${info.port}`);
      tunnelStop = () => tunnel.stop();
      tunnel.once("url", (tunnelUrl: string) => {
        console.log(`Tunnel: ${tunnelUrl}`);
        printQr(tunnelUrl);
      });
    } catch (err) {
      console.error("Failed to start tunnel:", err);
    }
  } else {
    printQr(localUrl);
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
