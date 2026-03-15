#!/usr/bin/env node
/* ============================================
   ♾️ INFINITY MASTER LAUNCHER — 10 GEARS
   ============================================ */

import readline from "readline";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ask = q => new Promise(res => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, ans => { rl.close(); res(ans.trim()); });
});

const runningGears = new Map();

async function startGear(v) {
  let phone = "";
  while (!phone.match(/^\d{10,15}$/)) {
    const input = await ask(`📱 GEAR ${v} — WhatsApp number: `);
    phone = input.replace(/[^0-9]/g, "");
    if (!phone.match(/^\d{10,15}$/)) console.log("❌ Sahi number likho!\n");
  }

  console.log(`\n⚙️  Starting GEAR ${v}...\n`);

  const botFile = path.join(__dirname, `gear${v}.js`);
  const child = spawn("node", [botFile], {
    stdio: ["pipe", "inherit", "inherit"],
    env: { ...process.env, BOT_PHONE: phone, BOT_GEAR: String(v) }
  });

  child.stdin.write(phone + "\n");
  runningGears.set(v, child);

  const flagFile = `./data/gear${v}_online.flag`;
  await new Promise(res2 => {
    const timer = setInterval(() => {
      if (fs.existsSync(flagFile)) {
        try { fs.unlinkSync(flagFile); } catch {}
        clearInterval(timer);
        res2();
      }
    }, 1000);
    child.on("exit", () => { clearInterval(timer); res2(); });
  });

  console.log(`✅ GEAR ${v} ONLINE\n`);
}

function showMenu() {
  console.log(`
  1  → Gear 1     2  → Gear 2
  3  → Gear 3     4  → Gear 4
  5  → Gear 5     6  → Gear 6
  7  → Gear 7     8  → Gear 8
  9  → Gear 9     10 → Gear 10
  11 → Gear 11    12 → Gear 12
`);
}

console.log(`
╔══════════════════════════════════╗
║   ♾️   INFINITY BOT LAUNCHER    ║
║        12 GEAR ENGINE           ║
╚══════════════════════════════════╝`);

showMenu();

while (true) {
  const input = await ask("⚙️  Gear number (1-12) ya 'exit': ");

  if (input === "exit") {
    console.log("\n👋 Bye!\n");
    process.exit(0);
  }

  const v = parseInt(input);
  if (isNaN(v) || v < 1 || v > 12) {
    console.log("❌ Sirf 1 se 12!\n");
    continue;
  }

  if (runningGears.has(v)) {
    console.log(`⚠️  GEAR ${v} already running!\n`);
    continue;
  }

  await startGear(v);
  showMenu();
}
