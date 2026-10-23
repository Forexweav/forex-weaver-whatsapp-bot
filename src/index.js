
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send(`
    <h1>𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊</h1>
    <p>WhatsApp Bot service is running.</p>
    <p>Mode: ${process.env.BOT_MODE || "demo"}</p>
    <p>This is the service health page, not a live WhatsApp connection.</p>
  `);
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    bot: "𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊",
    mode: process.env.BOT_MODE || "demo"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Forex Weaver service listening on port ${PORT}`);
});

