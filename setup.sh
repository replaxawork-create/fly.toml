#!/bin/bash
# ♾️ INFINITY BOT — Multi Gear Setup
# Run: bash setup.sh

set -e

echo ""
echo "╔══════════════════════════════════╗"
echo "║   ♾️  INFINITY BOT SETUP        ║"
echo "║      MULTI GEAR ENGINE          ║"
echo "╚══════════════════════════════════╝"
echo ""

# ── 1. Check Node.js ──
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "✅ Node.js $(node -v) found"
fi

# ── 2. Write package.json ──
cat > package.json << 'EOF'
{
  "name": "infinity-bot",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "start": "node start.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.9"
  }
}
EOF
echo "✅ package.json created"

# ── 3. Install Baileys ──
echo ""
echo "📦 Installing @whiskeysockets/baileys..."
npm install @whiskeysockets/baileys
echo "✅ Baileys installed"

# ── 4. Install PM2 ──
echo ""
echo "📦 Installing PM2..."
npm install -g pm2
echo "✅ PM2 installed"

# ── 5. Create data folder ──
mkdir -p data
echo "✅ data/ folder ready"

echo ""
echo "╔══════════════════════════════════╗"
echo "║   ✅  SETUP COMPLETE!           ║"
echo "╚══════════════════════════════════╝"
echo ""
echo "▶  Start the bot:"
echo "   node start.js"
echo ""
echo "📱 Enter gears (1-4) when asked"
echo "🔑 Enter pair codes in WhatsApp → Linked Devices"
echo ""
