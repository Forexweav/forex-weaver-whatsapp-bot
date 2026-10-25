
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");

let reconnectTimer = null;
let pairingRequested = false;
let starting = false;

async function startBot() {
  if (starting) return;
  starting = true;

  try {
    const { state, saveCreds } =
      await useMultiFileAuthState("auth_info");

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      browser: ["Forex Weaver", "Chrome", "1.0.0"],
      printQRInTerminal: false
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
          const phone =
            process.env.BOT_PHONE_NUMBER.replace(/\D/g, "");

          const code = await sock.requestPairingCode(phone);

          console.log("WhatsApp pairing code:", code);
          console.log(
            "On WhatsApp Business, open Linked devices, " +
            "choose Link a device, then Link with phone number."
          );
        } catch (error) {
          pairingRequested = false;
          console.error(
            "Pairing code error:",
            error.message
          );
        }
      }

      if (connection === "open") {
        console.log("WhatsApp connected successfully!");
        pairingRequested = false;
      }

      if (connection === "close") {
        const code =
          lastDisconnect?.error?.output?.statusCode;
        const reason =
          lastDisconnect?.error?.message;

        console.log("WhatsApp disconnected.");
        console.log("Disconnect code:", code ?? "unknown");
        console.log(
          "Disconnect reason:",
          reason ?? "not provided"
        );

        starting = false;

        if (code !== DisconnectReason.loggedOut) {
          pairingRequested = false;
          clearTimeout(reconnectTimer);

          reconnectTimer = setTimeout(() => {
            startBot().catch((error) => {
              console.error("Restart error:", error.message);
            });
          }, 5000);
        } else {
          console.log(
            "WhatsApp logged out. Check the disconnect details."
          );
        }
      }

      if (connection === "open") {
        starting = false;
      }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      for (const msg of messages) {
        if (!msg?.message || msg.key.fromMe) continue;

        const chat = msg.key.remoteJid;

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          "";

        const command = text.trim().toLowerCase();

        if (command === "!ping") {
          await sock.sendMessage(chat, {
            text: "Pong! 🏓 𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊 is responding."
          });
        }

        if (command === "!menu") {
          await sock.sendMessage(chat, {
            text:
              "𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊 WhatsApp Bot\n\n" +
              "BASIC COMMANDS\n" +
              "!menu - Show commands\n" +
              "!ping - Check bot response\n\n" +
              "More planned features must be implemented " +
              "and tested before they will work."
          });
        }
      }
    });
  } catch (error) {
    starting = false;
    console.error("Bot startup error:", error.message);

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      startBot().catch(console.error);
    }, 10000);
  }
}

startBot().catch(console.error);
