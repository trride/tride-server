require("now-env").config();
const axios = require("axios");
const { send, json } = require("micro");
const { router, get, post, del } = require("microrouter");

const notFound = (req, res) =>
  send(res, 404, {
    error: {
      message:
        "Hello from Tride! Subscribe to us for news updates! https://producthunt.com/upcoming/tride",
      team: [
        "Muhammad Mustadi",
        "Rahmat Hidayat",
        "Renata Clara Kumala",
        "Patrick Benz",
        "Tama Bawazier"
      ]
    }
  });

module.exports = router(get("/*", notFound));
