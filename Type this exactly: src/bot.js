const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊 WhatsApp Bot service is running.");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", whatsapp: "starting" });
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Forex Weaver", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) console.log("WhatsApp QR code available in the server logs.");
    if (connection === "open") console.log("WhatsApp connected.");
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) startBot();
      else console.log("WhatsApp logged out. Pair again to reconnect.");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const chat = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (text.trim() === "!ping") {
      await sock.sendMessage(chat, { text: "Pong! 🏓 Forex Weaver is online." });
    }

    if (text.trim() === "!menu") {
      await sock.sendMessage(chat, {
        text: `𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊\n\nAvailable commands:\n!menu - Show commands\n!ping - Check bot status`
      });
    }
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web service listening on port ${PORT}`);
  startBot().catch(err => console.error("Bot startup error:", err));
});
