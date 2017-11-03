require("now-env").config();
const { send, json } = require("micro");
const { router, get, post, del } = require("microrouter");

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
    .catch(err => {
      return err.response.data;
    })
    .then(data => ({ ...data, service: "gojek" }));
  const grabPrice = grab
    .getEstimate(payload.start, payload.end)
    .catch(err => {
      return typeof err === "string"
        ? { errors: [{ error: { message: err } }] }
        : { errors: [err] };
    })
    .then(data => ({ ...data, service: "grab" }));
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

  allPrices.sort((a, b) => a.price - b.price);
  if (typeof allPrices[0].price === "number") {
    allPrices[0].cheapest = true;
  }
  send(res, 200, {
    estimates: allPrices
  });
};

const getPoints = async (req, res) => {
  const { lat, long, name } = req.query;
  if (!name) {
    return send(res, 400, { error: "gimme names" });
  }
  const { poi } = (await gojek.stringToPOI(name, { lat, long })) || [];
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

  try {
    if (lowercaseService === "gojek") {
      const { requestId } = await gojek.requestRide(key, start, end);
      return send(res, 200, { requestId });
    } else if (lowercaseService === "grab") {
      const { requestId } = await grab.requestRide(key, start, end);
      return send(res, 200, { requestId });
    }
  } catch (err) {
    return send(res, 500, {
      service: lowercaseService,
      error: err.response.data
    });
  }

  send(res, 404, {
    error: {
      message: `Service ${lowercaseService} not found`
    }
  });
};

const cancelRideById = async (req, res) => {
  const { service, requestId } = req.params;
  const lowercaseService = service.toLowerCase();
  try {
    if (lowercaseService === "gojek") {
      const { cancelled } = await gojek.cancelRide(requestId);
      return send(res, 200, { cancelled });
    } else if (lowercaseService === "grab") {
      const { cancelled } = await grab.cancelRide(requestId);
      return send(res, 200, { cancelled });
    }
  } catch (err) {
    return send(res, 500, {
      service: lowercaseService,
      error: err.response.data
    });
  }
  send(res, 404, {
    error: {
      message: `Service ${lowercaseService} not found`
    }
  });
};

const notFound = (req, res) => send(res, 404, "Route not found.");

module.exports = router(
  get("/estimate", getPrices),
  get("/points", getPoints),
  get("/coords", getCoords),
  post("/rides/:service", createRideByService),
  del("/rides/:service/:requestId", cancelRideById),
  get("/*", notFound)
);
