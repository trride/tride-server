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
            requestId: //requestId
        }
        ```
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
    POST `/request/:service`
    
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
    POST `/request/fastest`

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