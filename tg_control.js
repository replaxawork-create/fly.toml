#!/usr/bin/env node
/* ============================================
   ♾️ INFINITY — TELEGRAM CONTROL BOT
   Only: Gear start, pair, status, delete
   WhatsApp commands work as normal
   ============================================ */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TG_TOKEN = process.env.TG_TOKEN || "8759282028:AAG7-dlQk0KIyBOlYSl-tTcTrJwi3K2HT7s";
const TG_OWNER = String(process.env.TG_OWNER || "8494250384");
const DATA_DIR  = "./data";
const MAX_GEARS = 12;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

/* ── STATE ── */
const gearProcs  = new Map(); // v -> child
const gearStatus = new Map(); // v -> offline|starting|online|banned
const waitingPhone = new Map(); // chatId -> gear number

for (let i = 1; i <= MAX_GEARS; i++) gearStatus.set(i, "offline");

/* ── TELEGRAM ── */
const TG = async (method, body) => {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return r.json();
  } catch { return {}; }
};

const send  = (chatId, text, extra = {}) =>
  TG("sendMessage", { chat_id: chatId, text, parse_mode: "Markdown", ...extra });

const edit  = (chatId, msgId, text, extra = {}) =>
  TG("editMessageText", { chat_id: chatId, message_id: msgId, text, parse_mode: "Markdown", ...extra });

const answer = (id, text = "") =>
  TG("answerCallbackQuery", { callback_query_id: id, text, show_alert: false });

/* ── KEYBOARDS ── */
function statusEmoji(v) {
  const s = gearStatus.get(v);
  if (s === "online")   return "🟢";
  if (s === "starting") return "🟡";
  if (s === "banned")   return "🔴";
  return "⚫";
}

function mainKeyboard() {
  const rows = [];
  for (let i = 1; i <= MAX_GEARS; i += 2) {
    const row = [{ text: `${statusEmoji(i)} Gear ${i}`, callback_data: `g_${i}` }];
    if (i + 1 <= MAX_GEARS)
      row.push({ text: `${statusEmoji(i+1)} Gear ${i+1}`, callback_data: `g_${i+1}` });
    rows.push(row);
  }
  rows.push([{ text: "🔄 Refresh", callback_data: "refresh" }]);
  return { inline_keyboard: rows };
}

function gearKeyboard(v) {
  const st = gearStatus.get(v);
  const rows = [];
  if (st === "offline" || st === "banned") {
    rows.push([{ text: "🚀 Start & Pair", callback_data: `start_${v}` }]);
  } else {
    rows.push([{ text: "📊 Status", callback_data: `status_${v}` }]);
    rows.push([{ text: "🗑 Delete / Logout", callback_data: `logout_${v}` }]);
  }
  rows.push([{ text: "⬅️ Back", callback_data: "main" }]);
  return { inline_keyboard: rows };
}

function mainText() {
  let text = `♾️ *INFINITY CONTROL PANEL*\n━━━━━━━━━━━━━━━━━━━━\n`;
  for (let i = 1; i <= MAX_GEARS; i++) {
    const s = gearStatus.get(i);
    const e = statusEmoji(i);
    text += `${e} Gear ${i} — ${s}\n`;
  }
  text += `━━━━━━━━━━━━━━━━━━━━`;
  return text;
}

/* ── GEAR FUNCTIONS ── */
function startGear(v, phone, chatId) {
  if (gearProcs.has(v)) return;
  gearStatus.set(v, "starting");

  const botFile = path.join(__dirname, `gear${v}.js`);
  if (!fs.existsSync(botFile)) {
    send(chatId, `❌ gear${v}.js not found!`);
    return;
  }

  const child = spawn("node", [botFile], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, BOT_PHONE: phone, BOT_GEAR: String(v) }
  });

  child.stdin.write(phone + "\n");
  gearProcs.set(v, child);

  // Watch for pair code in stdout
  let buf = "";
  child.stdout.on("data", d => {
    buf += d.toString();
    const match = buf.match(/([A-Z0-9]{4}-[A-Z0-9]{4})/);
    if (match) {
      send(chatId,
        `🔑 *GEAR ${v} PAIR CODE*\n\n` +
        `┌─────────────┐\n` +
        `│  \`${match[1]}\`  │\n` +
        `└─────────────┘\n\n` +
        `👉 WhatsApp → Linked Devices\n→ Link with Phone Number`
      );
      buf = ""; // reset so we don't re-send
    }
    // Watch for banned
    if (buf.includes("BANNED")) {
      gearStatus.set(v, "banned");
      send(chatId, `🚫 *Gear ${v} number BANNED!*\nAuth deleted.`);
    }
    // Watch for online
    if (buf.includes(`GEAR ${v} ONLINE`)) {
      gearStatus.set(v, "online");
      send(chatId, `✅ *Gear ${v} ONLINE!*\n\nWhatsApp commands ready:\n/ncemo${v} /ncbaap${v} /namelock${v}`, { reply_markup: gearKeyboard(v) });
    }
  });

  child.stderr.on("data", () => {}); // silent

  child.on("exit", () => {
    gearProcs.delete(v);
    if (gearStatus.get(v) !== "banned") gearStatus.set(v, "offline");
  });
}

function deleteGear(v) {
  const child = gearProcs.get(v);
  if (child) { try { child.kill("SIGTERM"); } catch {} gearProcs.delete(v); }
  const authDir = `./auth_bot_${v}`;
  if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
  gearStatus.set(v, "offline");
}


/* ── ALLGC: broadcast NC command to all groups of a gear ── */
function sendAllGCCommand(gearNum, ncCmd, base) {
  const cmdFile = `./data/tg_cmd_gear${gearNum}.json`;
  try {
    fs.writeFileSync(cmdFile, JSON.stringify({
      cmd: "allgc",
      chatId: null,
      extra: JSON.stringify({ ncCmd, base })
    }));
  } catch(e) {}
}

// Poll allgc results and report back to Telegram owner
const _allgcPending = new Map(); // gearNum -> { tgChatId, ncCmd, base, time }

setInterval(() => {
  for (const [gearNum, info] of _allgcPending) {
    const resultFile = `./data/tg_allgc_result_gear${gearNum}.json`;
    if (!fs.existsSync(resultFile)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(resultFile, "utf-8"));
      fs.unlinkSync(resultFile);
      _allgcPending.delete(gearNum);
      if (data.error) {
        send(info.tgChatId, `❌ *Gear ${gearNum} allgc error:* ${data.error}`);
      } else {
        send(info.tgChatId,
          `✅ *Gear ${gearNum} — /allgc done!*\n` +
          `📋 Command: \`${data.ncCmd}\`\n` +
          `📝 Text: \`${data.base}\`\n` +
          `🏘 Groups started: *${data.count}*`
        );
      }
    } catch(e) {}
  }
}, 400);

/* ── POLLING ── */
let offset = 0;
async function poll() {
  try {
    const res = await TG("getUpdates", { offset, timeout: 25, allowed_updates: ["message","callback_query"] });
    if (res.ok) {
      for (const upd of (res.result || [])) {
        offset = upd.update_id + 1;
        handle(upd).catch(() => {});
      }
    }
  } catch {}
  setTimeout(poll, 200);
}

/* ── HANDLER ── */
async function handle(upd) {
  // ── Callback query ──
  if (upd.callback_query) {
    const q      = upd.callback_query;
    const chatId = q.message.chat.id;
    const msgId  = q.message.message_id;
    const data   = q.data;

    if (String(chatId) !== TG_OWNER) { await answer(q.id, "❌ Access Denied"); return; }
    await answer(q.id);

    if (data === "main" || data === "refresh") {
      await edit(chatId, msgId, mainText(), { reply_markup: mainKeyboard() }); return;
    }

    if (data.startsWith("g_")) {
      const v = parseInt(data.slice(2));
      const st = gearStatus.get(v);
      const e  = statusEmoji(v);
      await edit(chatId, msgId,
        `${e} *GEAR ${v}*\n━━━━━━━━━━━━━━━━━━━━\nStatus: *${st}*`,
        { reply_markup: gearKeyboard(v) }
      );
      return;
    }

    if (data.startsWith("start_")) {
      const v = parseInt(data.slice(6));
      waitingPhone.set(chatId, v);
      await edit(chatId, msgId,
        `📱 *GEAR ${v} — Number bhejo*\n\nFormat: \`919876543210\``,
        { reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: `g_${v}` }]] } }
      );
      return;
    }

    if (data.startsWith("status_")) {
      const v   = parseInt(data.slice(7));
      const st  = gearStatus.get(v);
      await edit(chatId, msgId,
        `📊 *GEAR ${v} STATUS*\n━━━━━━━━━━━━━━━━━━━━\n` +
        `Status : *${st}*\n` +
        `Process: *${gearProcs.has(v) ? "Running ✅" : "Stopped ❌"}*`,
        { reply_markup: gearKeyboard(v) }
      );
      return;
    }

    if (data.startsWith("logout_")) {
      const v = parseInt(data.slice(7));
      deleteGear(v);
      await edit(chatId, msgId,
        `🗑 *Gear ${v} deleted!*\nAuth cleared. Gear is offline now.`,
        { reply_markup: gearKeyboard(v) }
      );
      return;
    }
  }

  // ── Text message ──
  if (upd.message?.text) {
    const chatId = String(upd.message.chat.id);
    const text   = upd.message.text.trim();

    if (chatId !== TG_OWNER) return;

    // /start
    if (text === "/start" || text === "/menu") {
      await send(chatId, mainText(), { reply_markup: mainKeyboard() });
      return;
    }

    // /allgc /ncemoN <text>  OR  /allgc /ncbaapN <text>  etc.
    // Usage: /allgc /ncemo1 Hello World
    if (text.startsWith("/allgc ")) {
      const rest = text.slice(7).trim(); // e.g. "/ncemo1 Hello World"
      // Parse the inner command: must start with /
      if (!rest.startsWith("/")) {
        await send(chatId,
          "⚠️ *Usage:* `/allgc /ncemo1 <text>`\n" +
          "Supported: ncemo, ncbaap, gcnc, namelock, infinity, infinityfast, infinitygodspeed"
        );
        return;
      }
      // Extract command name (e.g. ncemo1) and text
      const parts = rest.slice(1).split(" "); // ["ncemo1", "Hello", "World"]
      const innerCmd = parts[0].toLowerCase();  // "ncemo1"
      const base = parts.slice(1).join(" ");    // "Hello World"

      if (!base) {
        await send(chatId, "⚠️ Text bhi likho!\nExample: `/allgc /ncemo1 Hello World`");
        return;
      }

      // Parse gear number from suffix (ncemo1 -> gear=1, cmd=ncemo)
      const match = innerCmd.match(/^([a-z]+)(\d+)$/);
      if (!match) {
        await send(chatId, "❌ Gear number nahi mila!\nExample: `/allgc /ncemo1 Hello`");
        return;
      }
      const ncCmd = match[1];   // e.g. "ncemo"
      const gearNum = parseInt(match[2]); // e.g. 1

      const VALID_CMDS = ["ncemo","gcnc","ncbaap","namelock","infinity","infinityfast","infinitygodspeed"];
      if (!VALID_CMDS.includes(ncCmd)) {
        await send(chatId, `❌ Unknown command: \`${ncCmd}\`\nSupported: ${VALID_CMDS.join(", ")}`);
        return;
      }

      if (gearStatus.get(gearNum) !== "online") {
        await send(chatId, `❌ Gear ${gearNum} online nahi hai! (${gearStatus.get(gearNum)})`);
        return;
      }

      sendAllGCCommand(gearNum, ncCmd, base);
      _allgcPending.set(gearNum, { tgChatId: Number(chatId), ncCmd, base });

      await send(chatId,
        `⚙️ *Gear ${gearNum} — /allgc bheja!*\n` +
        `📋 Command: \`${ncCmd}\`\n` +
        `📝 Text: \`${base}\`\n` +
        `⏳ Groups fetch ho rahe hain...`
      );
      return;
    }

    // Waiting for phone number
    if (waitingPhone.has(Number(chatId))) {
      const v     = waitingPhone.get(Number(chatId));
      const phone = text.replace(/[^0-9]/g, "");
      waitingPhone.delete(Number(chatId));

      if (!phone.match(/^\d{10,15}$/)) {
        await send(chatId, "❌ Sahi number likho!\nDobara gear select karo.", { reply_markup: mainKeyboard() });
        return;
      }

      await send(chatId, `⚙️ *Gear ${v} start ho raha hai...*\nPair code aayega...`);
      startGear(v, phone, Number(chatId));
      return;
    }
  }
}

/* ── START ── */
console.log(`
╔══════════════════════════════════╗
║  ♾️  INFINITY TG CONTROL BOT   ║
╚══════════════════════════════════╝
`);

if (TG_TOKEN === "YOUR_TOKEN_HERE") {
  console.log("❌ Token set karo:\n   TG_TOKEN=xxx TG_OWNER=yyy node tg_control.js");
  process.exit(1);
}

console.log(`✅ TG Bot running!\nTelegram pe /start bhejo\n`);
poll();
