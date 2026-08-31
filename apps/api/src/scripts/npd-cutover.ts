import { PrismaClient } from "@course/db";
import { stderr, stdout } from "node:process";

type NpdConnection = {
  status: "ACTIVE" | "DISABLED" | "REAUTH_REQUIRED";
  fiscalizationStartedAt: Date | null;
};

type NpdConnectionStore = {
  findUnique(args: { where: { id: string }; select: { status: true; fiscalizationStartedAt: true } }): Promise<NpdConnection | null>;
  updateMany(args: { where: { id: string; status: "ACTIVE"; fiscalizationStartedAt: null }; data: { fiscalizationStartedAt: Date } }): Promise<{ count: number }>;
};

/** Sets the irreversible lower time boundary for automatic NPD fiscalization. */
export async function setNpdCutover(connection: NpdConnectionStore, now = new Date()) {
  const current = await connection.findUnique({ where: { id: "default" }, select: { status: true, fiscalizationStartedAt: true } });
  if (!current) throw new Error("NPD connection is not configured; run npd:bootstrap first");
  if (current.status !== "ACTIVE") throw new Error("NPD connection is not active; authorize it again before cutover");
  if (current.fiscalizationStartedAt) throw new Error(`NPD fiscalization already started at ${current.fiscalizationStartedAt.toISOString()}`);

  const result = await connection.updateMany({
    where: { id: "default", status: "ACTIVE", fiscalizationStartedAt: null },
    data: { fiscalizationStartedAt: now }
  });
  if (result.count !== 1) throw new Error("NPD connection changed while setting the cutover; inspect its state and retry only if fiscalization is still disabled");
  return now;
}

async function main() {
  if (!process.argv.slice(2).includes("--confirm")) {
    throw new Error("Refusing to start fiscalization without --confirm");
  }

  const prisma = new PrismaClient();
  try {
    const startedAt = await setNpdCutover(prisma.npdConnection);
    stdout.write(`NPD cutover set: ${startedAt.toISOString()}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "NPD cutover failed";
    stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
