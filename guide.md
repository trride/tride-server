# Tride Guideline 
## Service Handler
- ### Class constructor
    ```
    constructor(config)
    ```
    **Parameters**

    `config`:Object (e.g. `{access_token: 'xxx', sandbox_mode: true}`, may different depending on the service)

- ### Methods
    - ### getEstimate 
        get estimated `price` from start point to end point and `requestKey` to order a ride
        ```
        getEstimate(start, end)
        ```
        **Parameters**
        
        `start`:Object
        ```js
        {
            lat: // latitude:Number
            long: // longitude:Number
        }
        ```
        `end`:Object 
        ```js
        {
            lat: // latitude:Number
            long: // longitude:Number
        }
        ```
        **Return**
        ```js
        {
            service: // String (service name)
            price: // Number in IDR 
            requestKey: {
                key: // String (token)
                expiresAt: // Unix_timestamp, requestKey expired date (create manual if service API not provided)
            }
        }
        ```
    - ### requestRide
        request a ride based on previous `getEstimate`
        ```
        requestRide(requestKey, start, end)
        ```
        **Parameters**

        `requestKey`:String (obtained from `getEstimate`)

        `start`:Object
        ```js
        {
            lat: // latitude:Number
            long: // longitude:Number
        }
        ```
        `end`:Object 
        ```js
        {
            lat: // latitude:Number
            long: // longitude:Number
        }
        ```
        **Return**
        ```js
        {
            service: // String (service name)
            requestId: // requestId
        }
        ```
    - ### rideStatus
        get ride status
        ```
        rideStatus(requestId)
        ```
        **Parameters**

        `requestId`:String (*optional for uber*)

        **Return**
        ```
        {
            status: // String
            service: // String (service name)
            requestId: // requestId
            driver: { // null when 'processing', 'not_found', 'canceled' and 'completed'
                name: // driver name
                rating: // driver rating (e.g. 4.8)
                pictureUrl: // driver's portrait url
                phoneNumber: // String driver's phone number
                vehicle: {
                    plate: // vehicle license plate (e.g. B 1234 AA)
                    name: // vehicle name (e.g. Honda Vario)
                }
            }
        }
        ```
        **Statuses**

        Status | Description
        ------ | -----------
        `processing` | searching driver
        `not_found` | no driver found
        `accepted` | got a driver
        `canceled` | ride canceled by rider or driver
        `on_the_way` | ride in progress
        `completed` | ride complete
    - ### cancelRide
        cancel requested ride
        ```
        cancelRide(requestId)
        ```
        **Parameters**

        `requestId`:String (*optional for uber*)

        **Return**
        ```
        {
            service: // String (service name)
            success: // Boolean
        }
        ```
---
## Server

- ### Get Estimate
    GET `/estimate`
    
    **Headers** 
    ```
    {
        'Authorization': // String (authorization token)
    }
    ```
    **Queries**

    `start_latitude`:Number\
    `start_longitude`:Number\
    `end_latitude`:Number\
    `end_longitude`:Number

    **Response**

    ```
    {
        "estimates": [
            {
                "service": "gojek"
                "price": // Number in IDR
                "cheapest": // Boolean
                "requestKey": {
                    "key": // String (token)
                    "expiresAt": // Unix_timestamp
                }
            },
            {
                "service": "grab"
                ...
    ```

- ### Request Ride by Service
    POST `/rides/:service`
    
    **Headers**
    ```
    {
        'Authorization': // String (authorization token),
        'Content-Type': 'application/json'
    }
    ```
    **Params**
    
    `service`: `'gojek'` | `'grab'` | `'uber'`

    **Body**

    ```
    {
        "requestKey": {
            "key": // String (token)
            "expiresAt": // Unix_timestamp
        },
        "itinerary": {
            "start": {
                "lat": // latitude:Number
                "long": // longitude:Number
            },
            "end": {
                "lat": // latitude:Number
                "long": // longitude:Number
            }
        }
    }
    ```
    **Response**
    ```
    {
        "service": "gojek|grab|uber",
        "requestId": // String,
    } 
    ```

- ### Request Fastest
    POST `/rides/fastest`

    **Headers**
    ```
    {
        'Authorization': // String (authorization token),
        'Content-Type': 'application/json'
    }
    ```
    **Body**
    ```
    {
        "services": [
            {
                "service": "gojek"
                "requestKey": {
                    "key": // String (token)
                    "expiresAt": // Unix_timestamp
                }
            },
            {
                "service": "grab"
                "requestKey": {
                    "key": // String (token)
                    "expiresAt": // Unix_timestamp
                }
            },
            {
                "service": "uber"
                "requestKey": {
                    "key": // String (token)
                    "expiresAt": // Unix_timestamp
                }
            },
        ],
        "itinerary": {
            "start": {
                "lat": // latitude:Number
                "long": // longitude:Number
            },
            "end": {
                "lat": // latitude:Number
                "long": // longitude:Number
            }
        }
    }
    ```
    **Response**
    ```
    {
        "service": "gojek|grab|uber",
        "requestId": // String,
    } 
    ```