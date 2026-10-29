// Writes .env.local for the local Supabase stack.
// Usage: npm run env:local        (add -- --force to overwrite configured values)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const force = process.argv.includes("--force");
const target = resolve(process.cwd(), ".env.local");

function readStatus() {
  try {
    return execFileSync("supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    console.error(
      "Could not read Supabase status. Start the local stack first:\n\n  supabase start\n",
    );
    process.exit(1);
  }
}

function parseStatus(output) {
  const values = {};

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator);
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

if (existsSync(target) && !force) {
  const current = readFileSync(target, "utf8");
  const url = current.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim();
  const key = current.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)$/m)?.[1]?.trim();

  if (url && key) {
    console.log(
      ".env.local already has Supabase credentials; leaving it untouched.\n" +
        "Use `npm run env:local -- --force` to replace them with the local stack values.",
    );
    process.exit(0);
  }
}

const status = parseStatus(readStatus());
const url = status.API_URL;
const anonKey = status.ANON_KEY;

if (!url || !anonKey) {
  console.error("Supabase status did not include API_URL and ANON_KEY. Run `supabase start`.");
  process.exit(1);
}

writeFileSync(
  target,
  [
    "# Generated for local development by `npm run env:local`.",
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
    "",
  ].join("\n"),
  "utf8",
);

console.log(`Wrote ${target} with the local Supabase URL and anon key.`);
console.log("Restart the Next.js server if it is already running.");
