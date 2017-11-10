require("now-env").config();
const { send, json } = require("micro");
const { router, get, post, del } = require("microrouter");
const rateLimit = require("micro-ratelimit");
const compress = require("micro-compress");

const ms = require("ms");
const LRU = require("lru-cache");
const lruOptions = {
  max: 500,
  maxAge: ms("1 hour")
};

const pointsCache = LRU(lruOptions);
const coordsCache = LRU(lruOptions);

const db = require("./db");
const shortid = require("shortid");

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
  access_token: process.env.uber_token,
  sandbox: true
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
  const uberPrice = uber
    .getEstimate(payload.start, payload.end)
    .then(data => ({ ...data, service: "uber" }))
    .catch(err => {
      return err.response.data;
    });
  const allPrices = await Promise.all([gojekPrice, grabPrice, uberPrice]);

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
  const cached = pointsCache.get(name);
  if (!!cached) {
    send(res, 200, cached);
  } else {
    const { poi } = (await gojek.stringToPOI(name, { lat, long })) || [];
    const data = { points: poi };
    pointsCache.set(name, data);
    send(res, 200, data);
  }
};

const getCoords = async (req, res) => {
  const { placeid } = req.query;
  const cached = coordsCache.get(placeid);
  if (!!cached) {
    return send(res, 200, cached);
  } else {
    const coords = await gojek.poiToCoord(placeid);
    const data = { coords };
    coordsCache.set(data);
    send(res, 200, data);
  }
};

const createRideByService = async (req, res) => {
  const { service } = req.params;
  const { requestKey: { key }, itinerary: { start, end } } = await json(req);
  const lowercaseService = service.toLowerCase();

  try {
    let response;

    if (lowercaseService === "gojek")
      response = await gojek.requestRide(key, start, end);
    else if (lowercaseService === "grab")
      response = await grab.requestRide(key, start, end);
    else if (lowercaseService === "uber")
      response = await uber.requestRide(key, start, end);

    const field = "rides";
    const trideId = shortid.generate();

    db
      .ref()
      .child(field)
      .child(trideId)
      .set(response); //rides/trideId
    send(res, 200, { ...response, trideId });

    const interval = setInterval(() => {
      const { requestId } = response;
      const servicesGetStatusMethod = {
        // gojek: gojek.rideStatus,
        // grab: grab.rideStatus,
        uber: uber.rideStatus
      };
      const rideRequest = servicesGetStatusMethod[lowercaseService];

      rideRequest(requestId)
        .then(status => {
          db
            .ref()
            .child(field)
            .child(trideId)
            .set(status);

          if (status.status == "completed" || status.status == "canceled")
            clearInterval(interval);
        })
        .catch(console.log);
    }, 2000);
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
    } else if (lowercaseService === "uber") {
      const { cancelled } = await uber.cancelRide(requestId);
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

const reverseGeo = async (req, res) => {
  const { latitude, longitude } = req.params;
  try {
    const data = await gojek.reverseGeocode({ latitude, longitude });
    return send(res, 200, data);
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: { message: "Network Error." } });
  }
};

const notFound = (req, res) => send(res, 404, "Route not found.");

module.exports = rateLimit(
  compress(
    router(
      get("/estimate", getPrices),
      get("/estimates", getPrices),
      get("/points", getPoints),
      get("/coords", getCoords),
      post("/rides/:service", createRideByService),
      del("/rides/:service/:requestId", cancelRideById),
      get("/*", notFound)
    )
  )
);
