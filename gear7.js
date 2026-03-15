/* ============================================
   ♾️ INFINITY BOT V7 — SOLO WARRIOR
   Clean build: NC + Namelock + Spam only
   Pair code login (no QR)
   ============================================ */

import readline from "readline";
import fs from "fs";
import os from "os";

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, "infinity_logo.png");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@whiskeysockets/baileys");

/* ============ CONFIG ============ */
let PREFIX = "/";
const DOMAIN_EXPANSION_IMAGE = "https://i.imgur.com/6Gq9V1P.jpeg";

/* ============ TEXT POOLS ============ */
const RAID_TEXTS = [
  "Infinity ⃟♥️","Infinity ⃟💔","Infinity ⃟❣️","Infinity ⃟💕",
  "Infinity ⃟💞","Infinity ⃟💓","Infinity ⃟💗","Infinity ⃟💖",
  "Infinity ⃟💘","Infinity ⃟💌","Infinity ⃟🩶","Infinity ⃟🩷",
  "Infinity ⃟🩵","Infinity ⃟❤️‍🔥","Infinity ⃟❤️‍🩹","Infinity ❤️‍🔥"
];
const INFINITY_TEXTS = [
  "🎀","💝","🔱","💘","💞","💢","❤️‍🔥","🌈","🪐","☄️",
  "⚡","🦚","🦈","🕸️","🍬","🧃","🗽","🪅","🎏","🎸",
  "📿","🏳️‍🌈","🌸","🎶","🎵","☃️","❄️","🕊️","🍷","🥂"
];
const NCEMO_EMOJIS = [
  "💘","🪷","🎐","🫧","💥","💢","❤️‍🔥","☘️","🪐","☄️",
  "🪽","🦚","🦈","🕸️","🍬","🧃","🗽","🪅","🎏","🎸",
  "📿","🏳️‍🌈","🌸","🎶","🎵","☃️","❄️","🕊️","🍷","🥂"
];

/* ============ DATA ============ */
const DATA_DIR          = "./data";
const SUDO_FILE         = `${DATA_DIR}/sudo.json`;
const SETTINGS_FILE     = `${DATA_DIR}/settings.json`;
const OWNER_FILE        = `${DATA_DIR}/owner.json`;
const CONFIG_FILE       = `${DATA_DIR}/config.json`;
const INFINITESUDO_FILE = `${DATA_DIR}/infinitesudo.json`;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function loadJSON(file, def) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : def; }
  catch { return def; }
}
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch {}
}

let SUDO_USERS         = new Set(loadJSON(SUDO_FILE, []));
let INFINITESUDO_USERS = new Set(loadJSON(INFINITESUDO_FILE, []));
let OWNER_JID          = loadJSON(OWNER_FILE, null);
const settings         = loadJSON(SETTINGS_FILE, { prefix: "/" });
PREFIX = settings.prefix || "/";

function saveOwner()        { saveJSON(OWNER_FILE, OWNER_JID); }
function saveSudo()         { saveJSON(SUDO_FILE, [...SUDO_USERS]); }
function saveInfiniteSudo() { saveJSON(INFINITESUDO_FILE, [...INFINITESUDO_USERS]); }
function saveSettings()     { saveJSON(SETTINGS_FILE, { prefix: PREFIX }); }
function saveBotCount(n)    { const c = loadJSON(CONFIG_FILE, {}); c.botCount = n; saveJSON(CONFIG_FILE, c); }

/* ============ HELPERS ============ */
const log   = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const bare  = jid => jid?.split(":")[0];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const START_TIME = Date.now();
const formatUptime = ms => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
};

const isOwner = jid => {
  if (!OWNER_JID) return false;
  return bare(jid) === bare(OWNER_JID) || jid === OWNER_JID;
};
const isInfiniteSudo = jid => {
  const b = bare(jid);
  return isOwner(jid) || INFINITESUDO_USERS.has(b) || INFINITESUDO_USERS.has(jid);
};
const isSudo = jid => {
  const b = bare(jid);
  return isOwner(jid) || isInfiniteSudo(jid) || SUDO_USERS.has(b) || SUDO_USERS.has(jid);
};
const isCmd  = (text, cmd) => text === `${PREFIX}${cmd}` || text.startsWith(`${PREFIX}${cmd} `);
const getArg = text => text.slice(PREFIX.length).trim().split(" ").slice(1).join(" ");

/* ================================================================
   ♾️ SOLO WARRIOR ENGINE
   Adaptive rate + zero-waste pipeline + namelock defender
   ================================================================ */

class AdaptiveRateController {
  constructor(startDelay = 25) {
    this.delay  = startDelay;
    this.min    = 10;
    this.max    = 200;
    this.wins   = 0;
    this.losses = 0;
  }
  onSuccess() {
    this.wins++;
    this.losses = 0;
    if (this.wins >= 3) { this.delay = Math.max(this.min, this.delay - 8); this.wins = 0; }
  }
  onError() {
    this.losses++;
    this.wins = 0;
    this.delay = Math.min(this.max, this.delay + 10);
  }
  get()         { return this.delay; }
  reset(d = 25) { this.delay = d; this.wins = 0; this.losses = 0; }
}

/* LockedMaxController — errors pe bhi speed slow nahi hoti */
class LockedMaxController {
  constructor() { this.delay = 1; this.min = 1; this.max = 1; }
  onSuccess() {}          // kuch nahi karta
  onError()   {}          // speed nahi ghataata — locked!
  get()       { return 1; }
  reset()     { this.delay = 1; }
}

class NCPipeline {
  constructor(sock, chatId, pool, base, ctrl) {
    this.sock     = sock;
    this.chatId   = chatId;
    this.pool     = pool;
    this.base     = base;
    this.ctrl     = ctrl;
    this.idx      = 0;
    this.alive    = true;
    this.lastSent = null;
    this._run();
  }
  _next() {
    let title, tries = 0;
    do {
      title = `${this.base} ${this.pool[this.idx % this.pool.length]}`;
      this.idx++;
    } while (title === this.lastSent && ++tries < this.pool.length);
    return (this.lastSent = title);
  }
  async _run() {
    while (this.alive) {
      try {
        await this.sock.groupUpdateSubject(this.chatId, this._next());
        this.ctrl.onSuccess();
      } catch { this.ctrl.onError(); }
      await sleep(this.ctrl.get());
    }
  }
  stop() { this.alive = false; }
}

class NameLockDefender {
  constructor(sock, chatId, base, pool) {
    this.sock      = sock;
    this.chatId    = chatId;
    this.base      = base;
    this.pool      = pool;
    this.alive     = true;
    this.attacking = false;
    this.idx       = 0;
    this.ctrl      = new AdaptiveRateController(20);
    this._loop();
  }
  _next() {
    const title = `${this.base} ${this.pool[this.idx % this.pool.length]}`;
    this.idx++;
    return title;
  }
  async _loop() {
    while (this.alive) {
      if (!this.attacking) {
        const title = this._next();
        try { await this.sock.groupUpdateSubject(this.chatId, title); this.ctrl.onSuccess(); }
        catch { this.ctrl.onError(); }
      }
      await sleep(this.ctrl.get());
    }
  }
  async onChanged(newName) {
    if (!this.alive || newName.startsWith(this.base)) return;
    this.attacking = true;
    try {
      for (let i = 0; i < 3; i++) {
        await this.sock.groupUpdateSubject(this.chatId, this._next()).catch(() => {});
        await sleep(5);
      }
    } finally { this.attacking = false; }
  }
  stop() { this.alive = false; }
}

/* ── GLOBAL STOPALL ── */
const STOPALL_FLAG = "./data/stopall.flag";
function writeStopAllFlag(chatId) {
  try { fs.writeFileSync(STOPALL_FLAG, chatId); } catch {}
}
function checkStopAllFlag() {
  try {
    if (fs.existsSync(STOPALL_FLAG)) {
      const chatId = fs.readFileSync(STOPALL_FLAG, "utf-8").trim();
      fs.unlinkSync(STOPALL_FLAG);
      return chatId;
    }
  } catch {}
  return null;
}
// Poll every 500ms for stopall flag from other gears
setInterval(() => {
  const chatId = checkStopAllFlag();
  if (chatId) stopAll(chatId);
}, 500);

/* ── SESSION STORE ── */
const _ncPipes     = new Map();
const _ncLocks     = new Map();
const _ncCtrl      = new Map();
const spam_tasks   = new Map();
const domain_tasks = new Map();

function _getCtrl(chatId, d = 80) {
  if (!_ncCtrl.has(chatId)) _ncCtrl.set(chatId, new AdaptiveRateController(d));
  return _ncCtrl.get(chatId);
}
function _stopNC(chatId) {
  if (_ncPipes.has(chatId)) { _ncPipes.get(chatId).stop(); _ncPipes.delete(chatId); return true; }
  return false;
}
function stopNameLock(chatId) {
  if (_ncLocks.has(chatId)) { _ncLocks.get(chatId).stop(); _ncLocks.delete(chatId); return true; }
  return false;
}
function stopSpam(chatId) {
  if (spam_tasks.has(chatId)) { spam_tasks.get(chatId).cancel(); spam_tasks.delete(chatId); return true; }
  return false;
}
function stopDomain(chatId) {
  if (domain_tasks.has(chatId)) {
    const t = domain_tasks.get(chatId);
    if (Array.isArray(t)) t.forEach(x => x?.cancel?.());
    domain_tasks.delete(chatId); return true;
  }
  return false;
}
function stopAll(chatId) { _stopNC(chatId); stopNameLock(chatId); stopSpam(chatId); stopDomain(chatId); }
function onGroupNameChanged(chatId, newName) {
  if (_ncLocks.has(chatId)) _ncLocks.get(chatId).onChanged(newName);
}

/* ── NC STARTERS ── */
function startGCNC(sock, chatId, base) {
  _stopNC(chatId); const c = _getCtrl(chatId); c.reset(25);
  _ncPipes.set(chatId, new NCPipeline(sock, chatId, RAID_TEXTS, base, c));
}
function startNCEMO(sock, chatId, base) {
  _stopNC(chatId); const c = _getCtrl(chatId); c.reset(25);
  _ncPipes.set(chatId, new NCPipeline(sock, chatId, NCEMO_EMOJIS, base, c));
}
function startNCBAAP(sock, chatId, base) {
  _stopNC(chatId); const c = _getCtrl(chatId); c.reset(10);
  _ncPipes.set(chatId, new NCPipeline(sock, chatId, RAID_TEXTS, base, c));
}
function startInfinity(sock, chatId, base) {
  _stopNC(chatId); const c = _getCtrl(chatId); c.reset(25);
  _ncPipes.set(chatId, new NCPipeline(sock, chatId, INFINITY_TEXTS, base, c));
}
function startInfinityFast(sock, chatId, base) {
  _stopNC(chatId); const c = _getCtrl(chatId); c.reset(10);
  _ncPipes.set(chatId, new NCPipeline(sock, chatId, INFINITY_TEXTS, base, c));
}
function startInfinityGodspeed(sock, chatId, base) {
  _stopNC(chatId); const c = _getCtrl(chatId); c.reset(10); c.min = 10;
  _ncPipes.set(chatId, new NCPipeline(sock, chatId, INFINITY_TEXTS, base, c));
}
function startNameLock(sock, chatId, base, pool) {
  stopNameLock(chatId);
  _ncLocks.set(chatId, new NameLockDefender(sock, chatId, base, pool));
}
function startSpam(sock, chatId, spamText) {
  stopSpam(chatId);
  let alive = true;
  (async () => { while (alive) { try { await sock.sendMessage(chatId, { text: spamText }); } catch {} await sleep(30); } })();
  spam_tasks.set(chatId, { cancel: () => { alive = false; } });
}
function startDomainExpansion(sock, chatId, base, mode) {
  stopDomain(chatId);
  const pool = mode === "ncemo" ? NCEMO_EMOJIS : mode === "infinity" ? INFINITY_TEXTS : RAID_TEXTS;
  const pipes = Array.from({ length: 3 }, (_, w) => {
    const ctrl = new AdaptiveRateController(10 + w * 5);
    let idx = w * Math.floor(pool.length / 3), lastSent = null, alive = true;
    (async () => {
      while (alive) {
        let title, tries = 0;
        do { title = `${base} ${pool[idx % pool.length]}`; idx++; }
        while (title === lastSent && ++tries < pool.length);
        lastSent = title;
        try { await sock.groupUpdateSubject(chatId, title); ctrl.onSuccess(); }
        catch { ctrl.onError(); }
        await sleep(ctrl.get());
      }
    })();
    return { cancel: () => { alive = false; } };
  });
  let watching = true;
  (async () => {
    while (watching) {
      await sleep(100);
      try {
        const meta = await sock.groupMetadata(chatId).catch(() => null);
        if (meta?.subject && !meta.subject.toLowerCase().startsWith(base.toLowerCase())) {
          await sock.groupUpdateSubject(chatId, `${base} 😈♾️`).catch(() => {});
          await sleep(5);
          await sock.groupUpdateSubject(chatId, `${base} 😈♾️`).catch(() => {});
        }
      } catch {}
    }
  })();
  domain_tasks.set(chatId, [...pipes, { cancel: () => { watching = false; } }]);
}

/* ============ HELP ============ */
function getHelp() {
  const base =
`♾️ *INFINITY BOT V7 — SOLO WARRIOR*
━━━━━━━━━━━━━━━━━━━━━━━
`;

  const raid =
`

━━━━━━━━━━━━━━━━━━━━━━━
💀 *NAME CHANGER*
> ${PREFIX}ncemo7 <text>
> ${PREFIX}ncbaap7 <text>
> ${PREFIX}stopnc7
> ${PREFIX}ncmaximum7 <text>

━━━━━━━━━━━━━━━━━━━━━━━
🔒 *NAME LOCK*
> ${PREFIX}namelock7 <text>
> ${PREFIX}stopnamelock7

━━━━━━━━━━━━━━━━━━━━━━━
> ${PREFIX}stopall7`;

  return base + raid + `\n\n♾️ _Solo Warrior V7_`;
}

/* ============ BOT ============ */
let _reconnectDelay = 3000;
let _reconnectTimer = null;

function scheduleReconnect() {
  if (_reconnectTimer) return;
  log(`🔄 Reconnecting in ${_reconnectDelay/1000}s...`);
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    startBot();
  }, _reconnectDelay);
  _reconnectDelay = Math.min(_reconnectDelay * 2, 30000);
}

let _pairCodeRequested = false; // 🔧 FIX: global so reconnects don't reset it
let _currentSock = null;

async function startBot() {
  _reconnectDelay = 3000;
  const { state, saveCreds } = await useMultiFileAuthState(`./auth_bot_7`);
  const { version } = await fetchLatestBaileysVersion();
  _currentSock = null;
  const sock = makeWASocket({ auth: state, version, printQRInTerminal: false, logger: (await import("pino")).default({ level: "silent" }) });
  sock.ev.on("creds.update", saveCreds);
  _currentSock = sock;

  sock.ev.on("groups.update", updates => {
    for (const upd of updates)
      if (upd.subject !== undefined) onGroupNameChanged(upd.id, upd.subject);
  });

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (!_pairCodeRequested && !sock.authState.creds.registered && connection === "connecting") {
      _pairCodeRequested = true;
      const autoPhone = process.env.BOT_PHONE || "";
      const doLogin = async (phone) => {
        phone = phone.replace(/[^0-9]/g, "");
        try {
          await sleep(1500);
          const code = await sock.requestPairingCode(phone);
          const fmt = code.match(/.{1,4}/g).join("-");
          console.log(`\n╔══════════════════════════════╗`);
          console.log(`║  🔑  INFINITY V7 PAIR CODE       ║`);
          console.log(`╠══════════════════════════════╣`);
          console.log(`║        ${fmt}          ║`);
          console.log(`╚══════════════════════════════╝`);
          console.log(`\n👉 WhatsApp → Linked Devices → Link with Phone Number\n`);
        } catch (err) { console.error(`❌ Pair error:`, err.message || err); }
      };
      if (autoPhone) {
        await doLogin(autoPhone);
      } else {
        const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl2.question(`\n📱 WhatsApp number (e.g. 919876543210): `, async phone => {
          rl2.close();
          await doLogin(phone);
        });
      }
    }
    if (connection === "open") {
      log(`✅ GEAR 1 ONLINE`);
      try { fs.writeFileSync("./data/gear7_online.flag", "1"); } catch {}
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut || code === 401) {
        // ── BANNED ──
        // Delete ALL gears auth + data
        try {
          for (let g = 1; g <= 4; g++) {
            const authDir = `./auth_bot_${g}`;
            if (fs.existsSync(authDir)) {
              fs.rmSync(authDir, { recursive: true, force: true });
              console.log(`🗑  Gear ${g} auth deleted`);
            }
          }
          if (fs.existsSync("./data")) {
            for (const file of fs.readdirSync("./data")) {
              fs.rmSync(`./data/${file}`, { force: true });
            }
            console.log(`🗑  Data deleted`);
          }
        } catch (e) {}
        // Wait for enter then exit
        const rl3 = (await import("readline")).createInterface({ input: process.stdin, output: process.stdout });
        rl3.question(`\n⛔ Your number has been BANNED 🚫\n   Press ENTER to exit...`, () => {
          rl3.close();
          process.exit(0);
        });
      } else {
        scheduleReconnect();
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        const chatId = msg.key.remoteJid;
        if (!chatId) continue;
        const isGroup = chatId.endsWith("@g.us");
        const sender  = isGroup ? (msg.key.participant || msg.participant) : msg.key.remoteJid;
        if (!sender) continue;
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

        // /owner claim
        if (text.trim() === "/owner" && !isGroup) {
          if (OWNER_JID) {
            await sock.sendMessage(chatId, { text: "👑 Owner already claimed." }, { quoted: msg });
          } else {
            OWNER_JID = bare(sender); saveOwner();
            SUDO_USERS.add(bare(sender)); saveSudo();
            await sock.sendMessage(chatId, {
              text:
                "╔══════════════════════╗\n" +
                "║  👑  OWNER CLAIMED ✅  ║\n" +
                "╚══════════════════════╝\n\n" +
                `♾️ *INFINITY BOT V7*\n` +
                `Send ${PREFIX}help1 to see commands.`
            }, { quoted: msg });
            log(`👑 Owner: ${sender}`);
          }
          continue;
        }

        if (!text.startsWith(PREFIX)) continue;
        if (!isSudo(sender)) {
          // Non-sudo: silent ignore
          continue;
        }

        const cmdName = text.slice(PREFIX.length).trim().split(/\s+/)[0].toLowerCase();

        // HELP
        if (["help7","start7","menu7"].includes(cmdName)) {
          if (fs.existsSync(LOGO_PATH)) {
            await sock.sendMessage(chatId, { image: fs.readFileSync(LOGO_PATH), caption: getHelp() }, { quoted: msg });
          } else {
            await sock.sendMessage(chatId, { text: getHelp() }, { quoted: msg });
          }
          continue;
        }

        // PING
        if (isCmd(text, "ping7")) {
          const t = Date.now();
          const s = await sock.sendMessage(chatId, { text: "🏓 Pinging..." }, { quoted: msg });
          await sock.sendMessage(chatId, { text: `🏓 Pong! *${Date.now() - t}ms*` }, { quoted: s }); continue;
        }

        // STATUS
        if (isCmd(text, "status7")) {
          const tot = os.totalmem(), fr = os.freemem();
          const ctrl = _ncCtrl.get(chatId);
          await sock.sendMessage(chatId, {
            text:
              `📊 *INFINITY V7*\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `> 💀 NC          : ${_ncPipes.has(chatId) ? "✅ ON" : "❌ Off"}\n` +
              `> 🔒 Name Lock   : ${_ncLocks.has(chatId) ? "✅ ON" : "❌ Off"}\n` +
              `> 💥 Spam        : ${spam_tasks.has(chatId) ? "✅ ON" : "❌ Off"}\n` +
              `> 😈 Domain Exp. : ${domain_tasks.has(chatId) ? "✅ ON" : "❌ Off"}\n` +
              `> ⚡ NC Speed    : ${ctrl ? ctrl.get() + "ms" : "—"}\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `> 💾 RAM  : ${((tot - fr) / 1024 / 1024).toFixed(0)}MB/${(tot / 1024 / 1024).toFixed(0)}MB\n` +
              `> ⏳ Up   : ${formatUptime(Date.now() - START_TIME)}\n` +
              `> 👑 Sudo : ${SUDO_USERS.size}`
          }, { quoted: msg }); continue;
        }

        // PREFIX
        if (isCmd(text, "prefix7")) {
          const np = getArg(text).trim();
          if (!np) { await sock.sendMessage(chatId, { text: `⚠️ ${PREFIX}prefix7 <new>` }, { quoted: msg }); continue; }
          PREFIX = np; saveSettings();
          await sock.sendMessage(chatId, { text: `✅ Prefix: *${PREFIX}*` }, { quoted: msg }); continue;
        }

        // SUDO MANAGEMENT
        if (isCmd(text, "addsudo7")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId, { text: "❌ Only Owner." }, { quoted: msg }); continue; }
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId, { text: "⚠️ Reply to a user." }, { quoted: msg }); continue; }
          const uid = bare(ctx.participant); SUDO_USERS.add(uid); saveSudo();
          await sock.sendMessage(chatId, { text: `✅ Sudo: @${uid.split("@")[0]}` }, { quoted: msg, mentions: [ctx.participant] }); continue;
        }
        if (isCmd(text, "delsudo7")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId, { text: "❌ Only Owner." }, { quoted: msg }); continue; }
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId, { text: "⚠️ Reply to a user." }, { quoted: msg }); continue; }
          const uid = bare(ctx.participant); SUDO_USERS.delete(uid); saveSudo();
          await sock.sendMessage(chatId, { text: `🗑 Removed: @${uid.split("@")[0]}` }, { quoted: msg, mentions: [ctx.participant] }); continue;
        }
        if (isCmd(text, "listsudo7")) {
          await sock.sendMessage(chatId, {
            text: `👑 *Sudo:*\n> ${[...SUDO_USERS].map(u => `@${u.split("@")[0]}`).join("\n> ") || "None"}`
          }, { quoted: msg }); continue;
        }
        if (isCmd(text, "addinfinitesudo7")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId, { text: "❌ Only Owner." }, { quoted: msg }); continue; }
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId, { text: "⚠️ Reply to a user." }, { quoted: msg }); continue; }
          const uid = bare(ctx.participant); INFINITESUDO_USERS.add(uid); saveInfiniteSudo();
          await sock.sendMessage(chatId, { text: `♾️ InfiniteSudo: @${uid.split("@")[0]}` }, { quoted: msg, mentions: [ctx.participant] }); continue;
        }
        if (isCmd(text, "delinfinitesudo7")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId, { text: "❌ Only Owner." }, { quoted: msg }); continue; }
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId, { text: "⚠️ Reply to a user." }, { quoted: msg }); continue; }
          const uid = bare(ctx.participant); INFINITESUDO_USERS.delete(uid); saveInfiniteSudo();
          await sock.sendMessage(chatId, { text: `🗑 Removed: @${uid.split("@")[0]}` }, { quoted: msg, mentions: [ctx.participant] }); continue;
        }



        // CONTROL
        if (isCmd(text, "control")) {
          const nc   = _ncPipes.has(chatId) ? "✅ ON" : "❌ Off";
          const lock = _ncLocks.has(chatId) ? "✅ ON" : "❌ Off";
          const ctrl = _ncCtrl.get(chatId);
          await sock.sendMessage(chatId, {
            text:
              `♾️ *INFINITY CONTROL PANEL — GEAR 7*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `⚙️ *BOT*\n` +
              `> ${PREFIX}ping / ${PREFIX}status\n` +
              `> ${PREFIX}prefix <new>\n` +
              `> ${PREFIX}addsudo / ${PREFIX}delsudo / ${PREFIX}listsudo (reply)\n` +
              `> ${PREFIX}addinfinitesudo / ${PREFIX}delinfinitesudo (reply)\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `💀 NC    : ${nc}\n` +
              `🔒 Lock  : ${lock}\n` +
              `⚡ Speed : ${ctrl ? ctrl.get() + "ms" : "—"}\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━`
          }, { quoted: msg }); continue;
        }

        // ── NAME CHANGERS ──
        if (isCmd(text, "ncemo7")) {
          const base = getArg(text);
          if (!base) { await sock.sendMessage(chatId, { text: `⚠️ ${PREFIX}ncemo7 <text>` }, { quoted: msg }); continue; }
          startNCEMO(sock, chatId, base);
          await sock.sendMessage(chatId, { text: `ncemo7 started ✅` }, { quoted: msg }); continue;
        }
        if (isCmd(text, "ncbaap7")) {
          const base = getArg(text);
          if (!base) { await sock.sendMessage(chatId, { text: `⚠️ ${PREFIX}ncbaap7 <text>` }, { quoted: msg }); continue; }
          startNCBAAP(sock, chatId, base);
          await sock.sendMessage(chatId, { text: `ncbaap7 started ✅` }, { quoted: msg }); continue;
        }
        if (isCmd(text, "stopnc7")) {
          const ok = _stopNC(chatId);
          await sock.sendMessage(chatId, { text: ok ? "stopnc7 done ✅" : "❌ No active NC" }, { quoted: msg }); continue;
        }
        if (isCmd(text, "ncmaximum7")) {
          const base = getArg(text);
          if (!base) { await sock.sendMessage(chatId, { text: `⚠️ ${PREFIX}ncmaximum7 <text>` }, { quoted: msg }); continue; }
          const lockedCtrl = new LockedMaxController();
          _stopNC(chatId);
          _ncCtrl.set(chatId, lockedCtrl);
          _ncPipes.set(chatId, new NCPipeline(sock, chatId, NCEMO_EMOJIS, base, lockedCtrl));
          await sock.sendMessage(chatId, { text: `⚡ *NC MAXIMUM SPEED LOCKED!*\n> Speed: 1ms\n> Errors pe bhi slow nahi hoga 💀` }, { quoted: msg }); continue;
        }

        // ── NAME LOCK ──
        if (isCmd(text, "namelock7")) {
          const base = getArg(text).trim();
          if (!base) { await sock.sendMessage(chatId, { text: `⚠️ ${PREFIX}namelock7 <text>` }, { quoted: msg }); continue; }
          startNameLock(sock, chatId, base, INFINITY_TEXTS);
          await sock.sendMessage(chatId, { text: `namelock7 started ✅` }, { quoted: msg }); continue;
        }
        if (isCmd(text, "stopnamelock7")) {
          const ok = stopNameLock(chatId);
          await sock.sendMessage(chatId, { text: ok ? "stopnamelock7 done ✅" : "❌ No active Name Lock" }, { quoted: msg }); continue;
        }

        // STOP ALL
        if (isCmd(text, "stopall7")) {
          stopAll(chatId);
          writeStopAllFlag(chatId);
          await sock.sendMessage(chatId, { text: "stopall7 done ✅" }, { quoted: msg }); continue;
        }

      } catch (err) { log(`❌`, err?.message || err); }
    }
  });
}

/* ============ START ============ */
console.log(`\n╔══════════════════════════════════╗`);
console.log(`║   ♾️  INFINITY BOT V7           ║`);
console.log(`║      SOLO WARRIOR ENGINE         ║`);
console.log(`╚══════════════════════════════════╝\n`);
saveBotCount(1);
/* ── TELEGRAM COMMAND RECEIVER ── */
setInterval(() => {
  const cmdFile = `./data/tg_cmd_gear7.json`;
  if (!fs.existsSync(cmdFile)) return;
  try {
    const d = JSON.parse(fs.readFileSync(cmdFile, "utf-8"));
    fs.unlinkSync(cmdFile);
    const { cmd, chatId, extra } = d;
    const sock = _currentSock;
    if (!sock || !chatId) return;

    if (cmd === "stopnc")       _stopNC(chatId);
    if (cmd === "stopnamelock") stopNameLock(chatId);
    if (cmd === "stopall")      stopAll(chatId);

    if ((cmd === "ncemo" || cmd === "ncbaap" || cmd === "namelock") && extra) {
      const { groupId, base } = JSON.parse(extra);
      if (cmd === "ncemo")     startNCEMO(sock, groupId, base);
      if (cmd === "ncbaap")    startNCBAAP(sock, groupId, base);
      if (cmd === "namelock")  startNameLock(sock, groupId, base, INFINITY_TEXTS);
    }

    if (cmd === "status") {
      const ctrl = _ncCtrl.get(chatId);
      const statusData = {
        nc:    _ncPipes.has(chatId)  ? "✅ ON" : "❌ Off",
        lock:  _ncLocks.has(chatId) ? "✅ ON" : "❌ Off",
        speed: ctrl ? ctrl.get() + "ms" : "—"
      };
      fs.writeFileSync(`./data/tg_status_gear7.json`, JSON.stringify(statusData));
    }

    // ── /allgc HANDLER: run NC command in ALL groups this gear is in ──
    if (cmd === "allgc" && extra) {
      const sock = _currentSock;
      if (!sock) return;
      (async () => {
        try {
          const { ncCmd, base } = JSON.parse(extra);
          const groups = await sock.groupFetchAllParticipating();
          const groupIds = Object.keys(groups);
          let count = 0;
          for (const groupId of groupIds) {
            if (ncCmd === "ncemo")    startNCEMO(sock, groupId, base);
            else if (ncCmd === "gcnc")     startGCNC(sock, groupId, base);
            else if (ncCmd === "ncbaap")   startNCBAAP(sock, groupId, base);
            else if (ncCmd === "namelock") startNameLock(sock, groupId, base, INFINITY_TEXTS);
            else if (ncCmd === "infinity") startInfinity(sock, groupId, base);
            else if (ncCmd === "infinityfast") startInfinityFast(sock, groupId, base);
            else if (ncCmd === "infinitygodspeed") startInfinityGodspeed(sock, groupId, base);
            count++;
          }
          // Report back how many groups started
          const resultFile = `./data/tg_allgc_result_gear7.json`;
          fs.writeFileSync(resultFile, JSON.stringify({ gear: 7, count, ncCmd, base }));
        } catch(e) {
          fs.writeFileSync(`./data/tg_allgc_result_gear7.json`, JSON.stringify({ gear: 7, count: 0, error: String(e) }));
        }
      })();
    }
  } catch (e) {}
}, 300);


// Global crash guard — never stop
process.on("uncaughtException", err => {
  log(`⚠️ Uncaught: ${err.message}`);
  scheduleReconnect();
});
process.on("unhandledRejection", err => {
  log(`⚠️ Unhandled: ${err}`);
  scheduleReconnect();
});

startBot();
