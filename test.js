require("dotenv").config();

// gojek
const { GojekHandler } = require("gojek-handler");
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

const payload = {
  start: {
    lat: -6.2268115,
    long: 106.8070965
  },
  end: {
    lat: -6.2759909,
    long: 106.8189589
  }
};

const test = async () => {
  const gojekPrice = gojek.getMotorBikePrice(payload.start, payload.end);
  const grabPrice = grab.getMotorBikePrice(payload.start, payload.end);
  const uberPrice = uber.getMotorBikePrice(payload.start, payload.end);
  const allPrices = await Promise.all([gojekPrice, grabPrice, uberPrice]);

  return {
    prices: {
      gojek: {
        ...allPrices[0].price
      },
      grab: {
        ...allPrices[1].price
      },
      uber: {
        ...allPrices[2].price
      }
    }
  };
};

test().then(console.log);
