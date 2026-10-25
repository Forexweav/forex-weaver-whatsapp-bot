
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");

let reconnectTimer;
let pairingRequested = false;

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Forex Weaver", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (
      qr &&
      !state.creds.registered &&
      process.env.BOT_PHONE_NUMBER &&
      !pairingRequested
    ) {
      pairingRequested = true;

      try {
        const phone = process.env.BOT_PHONE_NUMBER.replace(/\D/g, "");
        const code = await sock.requestPairingCode(phone);
        console.log("WhatsApp pairing code:", code);
        console.log(
          "On your phone, open WhatsApp Business > Linked devices > Link a device > Link with phone number."
        );
      } catch (error) {
        pairingRequested = false;
        console.error("Could not generate pairing code:", error.message);
      }
    }

    if (connection === "open") {
      console.log("WhatsApp connected successfully!");
      pairingRequested = false;
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;

      if (code !== DisconnectReason.loggedOut) {
        pairingRequested = false;
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(startBot, 5000);
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
