
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");

let reconnectTimer = null;
let starting = false;
let pairingRequested = false;

async function startBot() {
  if (starting) return;
  starting = true;

  let sock;

  try {
    const { state, saveCreds } =
      await useMultiFileAuthState("auth_info");

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      browser: ["Forex Weaver", "Chrome", "1.0.0"],
      printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        console.log("WhatsApp connected successfully!");
        pairingRequested = false;
        starting = false;
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
          clearTimeout(reconnectTimer);
          pairingRequested = false;

          reconnectTimer = setTimeout(() => {
            startBot().catch(console.error);
          }, 10000);
        } else {
          console.log(
            "WhatsApp logged out. Check the session before pairing again."
          );
        }
      }
    });

    if (!state.creds.registered) {
      const phone = (process.env.BOT_PHONE_NUMBER || "")
        .replace(/\D/g, "");

      if (!phone) {
        console.error(
          "BOT_PHONE_NUMBER is missing. Check Render Environment."
        );
      } else {
        setTimeout(async () => {
          if (pairingRequested) return;
          pairingRequested = true;

          try {
            const code = await sock.requestPairingCode(phone);
            console.log("NEW WhatsApp pairing code:", code);
            console.log(
              "Enter this code promptly in WhatsApp Business > Linked devices > Link a device > Link with phone number instead."
            );
          } catch (error) {
            pairingRequested = false;
            console.error(
              "Pairing code request failed:",
              error.message
            );
          }
        }, 2000);
      }
    }

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

        if (command === "!ping") {
          await sock.sendMessage(chat, {
            text: "Pong! 🏓 𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊 is responding."
          });
        }

        if (command === "!menu") {
          await sock.sendMessage(chat, {
            text:
              "𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊 WhatsApp Bot\n\n" +
              "!menu - Show commands\n" +
              "!ping - Check bot response\n\n" +
              "Other planned features are not yet implemented."
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
