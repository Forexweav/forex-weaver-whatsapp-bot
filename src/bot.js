
const {
  default: makeWASocket,
  DisconnectReason,
  initAuthCreds,
  BufferJSON
} = require("@whiskeysockets/baileys");

const { createClient } = require("@supabase/supabase-js");
const pino = require("pino");

const BOT_NAME = "𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊";
const BUCKET = "whatsapp-session";
const SESSION_FILE = "auth.json";

let reconnectTimer = null;
let starting = false;
let currentSocket = null;
let saveQueue = Promise.resolve();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getStorageClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Render Environment."
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

async function createPersistentAuth(storage) {
  let saved;

  const { data, error } = await storage.storage
    .from(BUCKET)
    .download(SESSION_FILE);

  if (error) {
    const notFound =
      String(error.statusCode) === "404" ||
      /not found|object not found/i.test(error.message || "");

    if (!notFound) {
      throw new Error(
        "Could not read the saved WhatsApp session: " + error.message
      );
    }
  } else {
    try {
      saved = JSON.parse(
        await data.text(),
        BufferJSON.reviver
      );
    } catch {
      throw new Error(
        "The saved session file is invalid. It was not overwritten."
      );
    }
  }

  const creds = saved?.creds || initAuthCreds();
  const keys = saved?.keys || {};

  async function persist() {
    const contents = JSON.stringify(
      { creds, keys },
      BufferJSON.replacer,
      2
    );

    const { error } = await storage.storage
      .from(BUCKET)
      .upload(
        SESSION_FILE,
        Buffer.from(contents, "utf8"),
        {
          contentType: "application/json",
          upsert: true
        }
      );

    if (error) {
      throw new Error(
        "Could not save the WhatsApp session: " + error.message
      );
    }
  }

  function queueSave() {
    saveQueue = saveQueue
      .then(persist)
      .catch((error) => {
        console.error("Session storage error:", error.message);
      });

    return saveQueue;
  }

  const keyStore = {
    async get(type, ids) {
      const result = {};

      for (const id of ids) {
        result[id] = keys[type]?.[id] ?? null;
      }

      return result;
    },

    async set(data) {
      for (const [type, entries] of Object.entries(data)) {
        keys[type] ||= {};

        for (const [id, value] of Object.entries(entries)) {
          if (value == null) {
            delete keys[type][id];
          } else {
            keys[type][id] = value;
          }
        }

        if (Object.keys(keys[type]).length === 0) {
          delete keys[type];
        }
      }

      await queueSave();
    }
  };

  return {
    state: { creds, keys: keyStore },
    saveCreds: queueSave
  };
}

async function startBot() {
  if (starting) return;
  starting = true;

  try {
    const storage = getStorageClient();
    const { state, saveCreds } =
      await createPersistentAuth(storage);

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

      if (
        qr &&
        !state.creds.registered &&
        !pairingRequested
      ) {
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
            "Open WhatsApp Business > Linked devices > Link a device > Link with phone number instead."
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
          startBot().catch((error) =>
            console.error("Reconnect error:", error.message)
          );
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
              text: `Pong! 🏓 ${BOT_NAME} is responding.`
            });
          } else if (command === "!menu") {
            await sock.sendMessage(chat, {
              text:
                `${BOT_NAME} WhatsApp Bot\n\n` +
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

    // Do not repeatedly restart when configuration or storage is broken.
    if (
      /Missing SUPABASE_|Could not read the saved WhatsApp session|saved session file is invalid/i
        .test(error.message)
    ) {
      console.error("Fix the configuration or storage issue before restarting.");
      return;
    }

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      startBot().catch((err) =>
        console.error("Startup retry error:", err.message)
      );
    }, 10000);
  } finally {
    starting = false;
  }
}

startBot().catch((error) =>
  console.error("Fatal bot startup error:", error.message)
);
