import http2 from "node:http2";
import { SignJWT, importPKCS8 } from "jose";
import { prisma } from "@/lib/prisma";

// APNs sender using a token-based (.p8) key over HTTP/2. Fully no-ops unless
// the APNs environment is configured, so it never breaks a request when push
// isn't set up yet. Configure in the environment:
//   APNS_KEY_ID       – the 10-char Key ID for your APNs Auth Key
//   APNS_TEAM_ID      – your Apple Developer Team ID
//   APNS_BUNDLE_ID    – the app bundle id (com.crescent.pulse)
//   APNS_KEY_P8       – the .p8 private key contents (with BEGIN/END lines)
//   APNS_PRODUCTION   – "true" for the production APNs host (TestFlight/App Store)

type PushPayload = { title: string; body: string; data?: Record<string, string> };

function apnsConfig() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const p8 = process.env.APNS_KEY_P8;
  if (!keyId || !teamId || !bundleId || !p8) return null;
  const host = process.env.APNS_PRODUCTION === "true" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  return { keyId, teamId, bundleId, p8, host };
}

let cachedJwt: { token: string; at: number } | null = null;

async function providerToken(cfg: NonNullable<ReturnType<typeof apnsConfig>>) {
  // APNs provider tokens are valid up to 60 min; refresh every ~50.
  if (cachedJwt && Date.now() - cachedJwt.at < 50 * 60 * 1000) return cachedJwt.token;
  const key = await importPKCS8(cfg.p8.replace(/\\n/g, "\n"), "ES256");
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: cfg.keyId })
    .setIssuer(cfg.teamId)
    .setIssuedAt()
    .sign(key);
  cachedJwt = { token, at: Date.now() };
  return token;
}

async function sendOne(cfg: NonNullable<ReturnType<typeof apnsConfig>>, jwt: string, deviceToken: string, payload: PushPayload) {
  return new Promise<{ ok: boolean; status: number; gone: boolean }>((resolve) => {
    const client = http2.connect(`https://${cfg.host}`);
    const body = JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
      ...(payload.data ?? {}),
    });
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      "authorization": `bearer ${jwt}`,
      "apns-topic": cfg.bundleId,
      "apns-push-type": "alert",
      "content-type": "application/json",
    });
    let status = 0;
    req.on("response", (h) => (status = Number(h[":status"]) || 0));
    req.on("end", () => {
      client.close();
      resolve({ ok: status === 200, status, gone: status === 410 });
    });
    req.on("error", () => {
      client.close();
      resolve({ ok: false, status: 0, gone: false });
    });
    req.write(body);
    req.end();
  });
}

// Send a push to every registered device for the given user ids (or everyone).
export async function sendPush(payload: PushPayload, opts?: { userIds?: string[] }) {
  const cfg = apnsConfig();
  if (!cfg) return; // push not configured — silently skip
  try {
    const devices = await prisma.deviceToken.findMany({
      where: { platform: "ios", ...(opts?.userIds ? { userId: { in: opts.userIds } } : {}) },
      select: { token: true },
    });
    if (devices.length === 0) return;
    const jwt = await providerToken(cfg);
    const dead: string[] = [];
    await Promise.all(
      devices.map(async (d) => {
        const r = await sendOne(cfg, jwt, d.token, payload);
        if (r.gone) dead.push(d.token);
      }),
    );
    if (dead.length) await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
  } catch {
    // never let a notification failure break the calling action
  }
}
