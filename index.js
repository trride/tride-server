require("now-env").config();
const axios = require('axios')
const { send, json } = require("micro");
const { router, get, post, del } = require("microrouter");
// const rateLimit = require("micro-ratelimit");
// const compress = require("micro-compress");

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
  authorization: process.env.gojek_token,
  baseURL: 'htpp://localhost:4000/gojek'
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

const sms = (phoneNumber = process.env.defaultPhoneNumber, message) => {
  axios.post('https://api.mainapi.net/smsnotification/1.0.0/messages', {
    msisdn: phoneNumber,
    content: message
  }, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${process.env.mainAPI_ACCESS_TOKEN}`
    }
  })
  .then(({ data }) => {
    console.log(`message sent to ${phoneNumber}`)
  })
}

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
    .then(data => {
      return ({ ...data, service: "gojek" })
    });
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

    // .catch(err => {
    //   return err.response.data;
    // });
  const allPrices = await Promise.all([
    gojekPrice,
    grabPrice,
    uberPrice
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

// ========== helper functions
const cancelRide = async (service, requestId) => {
  service = service.toLowerCase()

  const functions = {
    gojek: gojek.cancelRide,
    grab: grab.cancelRide,
    uber: uber.cancelRide,
    null: () => Promise.resolve({
      error: {
        message: `Service ${service} not found`
      }
    })
  }

  try {
    const result = functions[service] || functions.null
    return await result(requestId)
  } catch (err) {
    return {
      service,
      error: err.response.data
    }
  }
}

const requestRide = async (service, key, start, end) => {
  const functions = {
    gojek: gojek.requestRide,
    grab: grab.requestRide,
    uber: uber.requestRide,
    null: () => Promise.resolve({
      error: {
        message: `Service ${service} not found`
      }
    })
  }

  try {
    const field = 'rides'
    const trideId = shortid.generate()
    const func = functions[service] || functions.null
    const result = await func(key, start, end)
    db.ref().child(field).child(trideId).set(result)
    return {
      ...result,
      trideId
    }
  } catch (err) {
    return {
      service,
      error: err
    }
  }
}

const rideStatus = async (service, requestId) => {
  const functions = {
    gojek: gojek.rideStatus,
    grab: grab.rideStatus,
    uber: uber.rideStatus,
    null: () => Promise.resolve({
      error: {
        message: `Service ${service} not found`
      }
    })
  }

  try {
    const result = functions[service] || functions.null
    return await result(requestId)
  } catch (err) {
    return {
      service,
      error: err
    }
  }
}

const statusInterval = (intervalId, service, requestId, trideId, callback) => {
  const field = 'rides'
  return new Promise(resolve => {
    intervalId = setInterval(() => {
      console.log('interval', service, requestId, trideId)
      rideStatus(service, requestId)
      .then(snapshot => {
        db.ref().child(field).child(trideId).set(JSON.parse(JSON.stringify(snapshot)))
  
        if (callback)
          callback(trideId, snapshot)

        if (snapshot.status == 'completed' || snapshot.status == 'canceled') {
          clearInterval(intervalId)
          resolve(true)
        }
      })
      .catch(console.log)
    }, 2000)
  })
}
// ==========/ helper functions

const createRideByService = async (req, res) => {
  const { service } = req.params;
  const { requestKey: { key }, itinerary: { start, end } } = await json(req);
  const lowercaseService = service.toLowerCase();

  const result = await requestRide(service, key, start, end)

  // create new  firebase
  // db.ref().child(field).child(trideId).set(result)

  // send SMS
  sms('Halo, saya Rahmat Hidayat, saya di Gedung Aquarius memakai baju warna biru. Hubungi saya di 081234567890')

  // response
  send(res, 200, {...result});

  // continuously update ride status
  let intervalId;
  statusInterval(intervalId, service, result.requestId, result.trideId)
}


const cancelRideById = async (req, res) => {
  const { service, requestId } = req.params;
  const lowercaseService = service.toLowerCase();
  const result = await cancelRide(service, requestId)

  if (result.error)
    send(res, 500, result)
  else
    send(res, 200, result)
}

const cancelRideByTrideId = async (req, res) => {
  const snapshot = await db.ref().child('rides').child(req.params.trideId).once('value')
  const { service, requestId } = snapshot.val()
  const result = await cancelRide(service, requestId)
  
  if (result.error)
    send(res, 500, result)
  else
    send(res, 200, result)
}

const getRideStatus = async (req, res) => {
  const { trideId } = req.params
  const snapshot = await db.ref().child('rides').child(trideId).once('value')
  send(res, 200, snapshot.val())
}

const getFastest = async (req, res) => {
  const f = req.params.f ? true : false
  let { services, itinerary: { start, end } } = await json(req)

  if (f)
    services = services.filter(item => item.service == 'uber')
  
  const field = 'rides'
  const fastestId = shortid.generate()
  const payload = {
    service: 'fastest',
    status: 'processing'
  }

  db.ref().child(field).child(fastestId).set({
    ...payload
  })
  send(res, 200, {
    ...payload,
    trideId: fastestId
  })

  let firstAccepted = null
  const data = {
    gojek: {
      intervalId: null,
      requestId: null,
      status: null,
      trideId: null
    },
    grab: {
      intervalId: null,
      requestId: null,
      status: null,
      trideId: null
    },
    uber: {
      intervalId: null,
      requestId: null,
      status: null,
      trideId: null
    }
  }

  const singleRequest = async (intervalId, service, key) => {
    return new Promise(async resolve => {
      const { requestId, trideId } = await requestRide(service, key, start, end)

      // update data global
      data[service].requestId = requestId
      data[service].trideId = trideId
      
      // continuously update ride status
      statusInterval(intervalId, service, requestId, trideId, (trideId, snapshot) => {
        data[service].status = snapshot.status

        if (snapshot.status == 'accepted') {
          // mark service as the first accepted
          if (!firstAccepted)
            firstAccepted = service
  
          // if you're the firstAccepted, you can cancel another services
          if (firstAccepted == service) {
            // cancel other services
            services.forEach(item => {
              if (item.service != service) {
  
                // clear service interval
                clearInterval(data[item.service].intervalId)

                // cancel exception status=not_found
                // if (data[item.service].status !== 'not_found')
                  cancelRide(item.service, data[item.service].requestId)

                  // delete database ride record
                  db.ref().child('rides').child(data[item.service].trideId).set(null)
              }
            })
          }

          // service accepted
          console.log(service, 'accepted')
          resolve({service, requestId, trideId})
        }
      })
    })
  }

  const requestAllRides = services
    .map(item => {
      const { service, requestKey: { key } } = item
      return singleRequest(data[service].intervalId, service, key)
    })

  const winner = await Promise.race(requestAllRides)

  const acceptedService = await db.ref().child(field).child(winner.trideId).once('value')
  db.ref().child(field).child(fastestId).set({
    ...acceptedService.val()
  })

  let acceptedInterval
  statusInterval(acceptedInterval, winner.service, winner.requestId, fastestId)
  
  // delete database service ride record, client keep listen to fastestId
  clearInterval(data[firstAccepted].intervalId)
  db.ref().child('rides').child(winner.trideId).set(null)

  // send(res, 200, {
  //   ...winner
  // })
}

const reverseGeo = async (req, res) => {
  const { latitude, longitude } = req.query;
  try {
    const data = await gojek.reverseGeocode({ latitude, longitude });
    return send(res, 200, data);
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: { message: "Network Error." } });
  }
};

const notFound = (req, res) => send(res, 404, "Route not found.");

module.exports = router(
  get("/estimate", getPrices),
  get("/points", getPoints),
  get("/coords", getCoords),
  post("/fastest", getFastest),
  post("/fastest/:f", getFastest),
  post("/rides/:service", createRideByService),
  get("/status/:trideId", getRideStatus),
  del("/rides/:trideId", cancelRideByTrideId),
  del("/rides/:service/:requestId", cancelRideById),
  get("/*", notFound)
);
