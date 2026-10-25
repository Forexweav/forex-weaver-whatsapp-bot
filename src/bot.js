
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");

let reconnectTimer = null;
let starting = false;
let currentSocket = null;

async function startBot() {
  if (starting) return;
  starting = true;

  try {
    const { state, saveCreds } =
      await useMultiFileAuthState("auth_info");

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      browser: ["Ubuntu", "Chrome", "22.04.4"],
      printQRInTerminal: false
    });

    currentSocket = sock;
    let pairingRequested = false;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !state.creds.registered && !pairingRequested) {
        const phone = (process.env.BOT_PHONE_NUMBER || "")
          .replace(/\D/g, "");

        if (!phone) {
          console.error("BOT_PHONE_NUMBER is missing.");
          return;
        }

        pairingRequested = true;

        try {
          console.log("Requesting WhatsApp pairing code...");
          const code = await sock.requestPairingCode(phone);
          console.log("WhatsApp pairing code:", code);
          console.log(
            "On your phone, open WhatsApp Business > Linked devices > Link a device > Link with phone number instead."
          );
        } catch (error) {
          pairingRequested = false;
          console.error("Pairing request failed:", error.message);
        }
      }

      if (connection === "open") {
        console.log("WhatsApp connected successfully!");
      }

      if (connection === "close") {
        const code = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message;

        console.log("WhatsApp disconnected.");
        console.log("Disconnect code:", code ?? "unknown");
        console.log("Disconnect reason:", reason ?? "not provided");

        currentSocket = null;

        if (code === DisconnectReason.loggedOut) {
          console.error(
            "WhatsApp logged out. Check the session before pairing again."
          );
          return;
        }

        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          startBot().catch(console.error);
        }, 10000);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      for (const msg of messages) {
        if (!msg?.message || msg.key.fromMe) continue;

        const chat = msg.key.remoteJid;
        const message = msg.message;

        const text =
          message.conversation ||
          message.extendedTextMessage?.text ||
          message.imageMessage?.caption ||
          message.videoMessage?.caption ||
          "";

        const command = text.trim().toLowerCase();

        try {
          if (command === "!ping") {
            await sock.sendMessage(chat, {
              text: "Pong! 🏓 𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊 is responding."
            });
          } else if (command === "!menu") {
            await sock.sendMessage(chat, {
              text:
                "𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊 WhatsApp Bot\n\n" +
                "!menu - Show commands\n" +
                "!ping - Check bot response\n\n" +
                "Other planned features are not yet implemented."
            });
          }
        } catch (error) {
          console.error("Failed to process message:", error.message);
        }
      }
    });
  } catch (error) {
    console.error("Bot startup error:", error.message);

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      startBot().catch(console.error);
    }, 10000);
  } finally {
    starting = false;
  }
}

startBot().catch(console.error);
