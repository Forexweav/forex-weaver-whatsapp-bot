
const { createClient } = require("@supabase/supabase-js");
const {
  BufferJSON,
  initAuthCreds,
  proto,
} = require("@whiskeysockets/baileys");

const BUCKET = "whatsapp-session";

function createSupabaseAuthState() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  function encode(data) {
    return JSON.stringify(data, BufferJSON.replacer);
  }

  function decode(text) {
    return JSON.parse(text, BufferJSON.reviver);
  }

  async function readJson(path) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(path);

    if (error) {
      const message = String(error.message || "").toLowerCase();

      if (
        message.includes("not found") ||
        message.includes("missing")
      ) {
        return null;
      }

      throw new Error(`Supabase download failed: ${error.message}`);
    }

    return decode(await data.text());
  }

  async function writeJson(path, value) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, new Blob([encode(value)], {
        type: "application/json",
      }), {
        upsert: true,
        contentType: "application/json",
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }
  }

  async function deleteFile(path) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([path]);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }
  }

  const keyPath = (type, id) =>
    `keys/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;

  async function init() {
    const creds = (await readJson("creds.json")) || initAuthCreds();

    const state = {
      creds,
      keys: {
        get: async (type, ids) => {
          const result = {};

          await Promise.all(ids.map(async (id) => {
            const value = await readJson(keyPath(type, id));

            if (value !== null) {
              result[id] =
                type === "app-state-sync-key"
                  ? proto.Message.AppStateSyncKeyData.fromObject(value)
                  : value;
            }
          }));

          return result;
        },

        set: async (data) => {
          for (const [type, entries] of Object.entries(data)) {
            await Promise.all(
              Object.entries(entries).map(async ([id, value]) => {
                const path = keyPath(type, id);

                if (value == null) {
                  await deleteFile(path);
                } else {
                  await writeJson(path, value);
                }
              })
            );
          }
        },
      },
    };

    return {
      state,
      saveCreds: () => writeJson("creds.json", state.creds),
    };
  }

  return init();
}

module.exports = { createSupabaseAuthState };
