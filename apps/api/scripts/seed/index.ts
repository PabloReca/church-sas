#!/usr/bin/env bun
import { spawn } from "child_process";

const seedScripts = [
  "scripts/seed/keys.ts",
  "scripts/seed/plans.ts",
  "scripts/seed/admin.ts",
];

async function runScript(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ Running ${script}...`);
    const proc = spawn("bun", [script], {
      cwd: process.cwd(),
      stdio: "inherit",
    });

    proc.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script ${script} failed with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

async function init() {
  console.log("Starting database seeding...\n");

  try {
    for (const script of seedScripts) {
      await runScript(script);
    }
    console.log("\nDatabase seeding completed successfully!\n");
    process.exit(0);
  } catch (err) {
    console.error("\nSeeding failed:", err);
    process.exit(1);
  }
}

init();
