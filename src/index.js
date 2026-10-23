require("./bot");

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊 WhatsApp Bot service is running.");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    bot: "𝐅❼ℜᴇˣ ᵂᴇᴬｖᴱᖇ📊"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Web service is running on port " + PORT);
});
