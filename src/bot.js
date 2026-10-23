const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Forex Weaver", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("WhatsApp connected successfully!");
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;

      if (code !== DisconnectReason.loggedOut) {
        setTimeout(startBot, 3000);
      } else {
        console.log("WhatsApp logged out. Pair again to reconnect.");
      }
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
      await sock.sendMessage(chat, {
        text: "Pong! 🏓 Forex Weaver is online."
      });
    }

    if (text.trim() === "!menu") {
      await sock.sendMessage(chat, {
        text: "𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊\n\n!menu — Show commands\n!ping — Check bot response"
      });
    }
  });
}

startBot().catch(console.error);
