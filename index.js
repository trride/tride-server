require("now-env").config();
const { send } = require("micro");
const { router, get } = require("microrouter");

// gojek
// const GojekHandler = require("@tride/gojek-handler");
const GojekHandler = require("@tride/gojek-handler");
const gojek = new GojekHandler({
  authorization: process.env.gojek_token
});

// grab
const GrabHandler = require("@tride/grab-handler");
const grab = new GrabHandler(process.env.grab_token);

// uber
const UberHandler = require("uber-handler");
const uber = new UberHandler({
  token: process.env.uber_token
});

const getPrices = async (req, res) => {
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
    .getEstimate(payload.start, payload.end)
    .then(data => ({ ...data, service: "gojek" }))
    .catch(err => {
      console.log("[GOJEK ERROR]");
      console.log(err);
      return err.response.data;
    });
  const grabPrice = grab
    .getEstimate(payload.start, payload.end)
    .then(data => ({ ...data, service: "grab" }))
    .catch(err => {
      console.log("[GRAB ERROR]");
      console.log(err);
      return err.response.data;
    });
  // const uberPrice = uber
  //   .getMotorBikePrice(payload.start, payload.end)
  //   .then(data => ({ ...data, service: "uber" }))
  //   // .then(({ price }) => price)
  //   .catch(err => {
  //     console.log("[UBER ERROR]");
  //     console.log(err);
  //     return err.response.data;
  //   });
  const allPrices = await Promise.all([
    gojekPrice,
    grabPrice
    // uberPrice
  ]);

  allPrices.sort((a, b) => a.price - b.price)[0].cheapest = true;
  send(res, 200, {
    estimates: allPrices
  });
};

const getPoints = async (req, res) => {
  const { lat, long, name } = req.query;
  const { poi } = await gojek.stringToPOI(name, { lat, long });
  send(res, 200, { points: poi });
};

const getCoords = async (req, res) => {
  const { placeid } = req.query;
  const coords = await gojek.poiToCoord(placeid);
  send(res, 200, { coords });
};

const createRideByService = async (req, res) => {
  const { service } = req.params;
  const { requestKey: { key }, itinerary: { start, end } } = await json(req);
  const lowercaseService = service.toLowerCase();

  if (lowercaseService === "gojek") {
    const { requestId } = await gojek.requestRide(key, start, end);
    send(res, 200, { requestId });
  } else if (lowercaseService === "grab") {
    const { requestId } = await grab.requestRide(key, start, end);
    send(res, 200, { requestId });
  }

  send(res, 404, {
    error: {
      message: "Service not found"
    }
  });
};

const notFound = (req, res) => send(res, 404, "Route not found.");

module.exports = router(
  get("/estimate", getPrices),
  get("/points", getPoints),
  get("/coords", getCoords),
  post("/rides/:service", createRideByService),
  get("/*", notFound)
);
