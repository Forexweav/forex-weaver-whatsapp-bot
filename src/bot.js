
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const qrcode = require("qrcode-terminal");

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Forex Weaver", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Scan this QR code using WhatsApp Linked Devices:");
      qrcode.generate(qr, { small: true });
    }

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
    for (const msg of messages) {
      if (!msg?.message || msg.key.fromMe) continue;

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
          text:
            "𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊\n\n" +
            "!menu — Show commands\n" +
            "!ping — Check bot response"
        });
      }
    }
  });
}

startBot().catch(console.error);
