const { send } = require("micro");
const { router, get } = require("microrouter");

const tride = async (req, res) => {
  await new Promise(r => setTimeout(r, 1000)); // example async/await
  send(res, 200, { message: "Hello from Tride API" });
};

const notFound = (req, res) => send(res, 404, "Route not found.");

module.exports = router(get("/", tride), get("/*", notFound));
