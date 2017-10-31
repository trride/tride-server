require("dotenv").config();
const { send } = require("micro");
const { router, get } = require("microrouter");

// gojek
const GojekHandler = require("@tride/gojek-handler");
const gojek = new GojekHandler({
  authorization: process.env.gojek_token
});

// grab
const GrabHandler = require("tride-grab-handler");
const grab = new GrabHandler(process.env.grab_token);

// uber
const UberHandler = require("uber-handler");
const uber = new UberHandler({
  token: process.env.uber_token
});

const tride = async (req, res) => {
  const payload = {
    start: {
      lat: +req.query.start_lat || 0,
      long: +req.query.start_long || 0
    },
    end: {
      lat: +req.query.end_lat || 0,
      long: +req.query.end_long || 0
    }
  };

  const gojekPrice = gojek
    .getMotorBikePrice(payload.start, payload.end)
    .then(({ price }) => price)
    .catch(err => {
      console.log("[GOJEK ERROR]");
      console.log(err);
      return err.response.data;
    });
  const grabPrice = grab
    .getMotorBikePrice(payload.start, payload.end)
    .then(({ price }) => price)
    .catch(err => {
      console.log("[GRAB ERROR]");
      console.log(err);
      return err.response.data;
    });
  const uberPrice = uber
    .getMotorBikePrice(payload.start, payload.end)
    .then(({ price }) => price)
    .catch(err => {
      console.log("[UBER ERROR]");
      console.log(err);
      return err.response.data;
    });
  const allPrices = await Promise.all([gojekPrice, grabPrice, uberPrice]);

  send(res, 200, {
    prices: {
      gojek: {
        ...allPrices[0]
      },
      grab: {
        ...allPrices[1]
      },
      uber: {
        ...allPrices[2]
      }
    }
  });
};

const notFound = (req, res) => send(res, 404, "Route not found.");

module.exports = router(get("/", tride), get("/*", notFound));
