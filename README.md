# express-rate-limiter

[![NPM](https://nodei.co/npm/@mediaxpost/express-rate-limiter.png?downloads=true)](https://nodei.co/npm/@mediaxpost/express-rate-limiter/)

![Version](http://img.shields.io/npm/v/@mediaxpost/express-rate-limiter.svg)
![Downloads](http://img.shields.io/npm/dt/@mediaxpost/express-rate-limiter.svg)
[![Build Status](https://travis-ci.org/MediaXPost/express-rate-limiter.svg)](https://travis-ci.org/MediaXPost/express-rate-limiter)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/f0f5c9174338455788204b439d52fbc4)](https://www.codacy.com/app/chronosis/express-rate-limiter?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=MediaXPost/express-rate-limiter&amp;utm_campaign=Badge_Grade)
[![Codacy Coverage  Badge](https://api.codacy.com/project/badge/Coverage/f0f5c9174338455788204b439d52fbc4)](https://www.codacy.com/app/chronosis/express-rate-limiter?utm_source=github.com&utm_medium=referral&utm_content=MediaXPost/express-rate-limiter&utm_campaign=Badge_Coverage)
[![Dependencies](https://david-dm.org/MediaXPost/express-rate-limiter/status.svg)](https://david-dm.org/MediaXPost/express-rate-limiter)

`express-rate-limit` is a cache-based, request reate limiter for use with [`expressJS`](https://www.npmjs.com/package/express). It is designed for use with [`request-utils`](https://www.npmjs.com/package/@mediaxpost/request-utils) but can be used without. It caches a store of IP address, Method, and Request tuples used to make any request and then temporarily blocks requests from those sources once a limit for those requests have been exceeded.

By default, the rate-limiter uses 250 attempts in a refreshing, 5-minute window. This means that if 250 bad requests are made, then 4 minutes and 59 seconds elapse, and then a 251st bad request is made, then the expiration of the rate limit will start at the moment of the 251st bad request.

If there are any unexpected errors during the cache retrieval process, then the process fails silently and the request is handled as normal.

All request will have the HTTP Response Headers `X-RateLimit-Limit`, `X-RateLimit-Reset`, and `X-RateLimit-Remaining` set to total count of requests that can be made, the number of second before the window resets, and the number of request remaining that can be made before rate limiting occurs. respectively. If the `skipHeaders` flag is set true, than these headers are not sent.

By default, any rate limited ip / path, method tuple will be sent an empty 429000 error through `request-utils`; however this behavior can be overridden by setting a function for `onRateLimited`.

# [Installation](#installation)
<a name="installation"></a>

```shell
npm install @mediaxpost/express-rate-limiter
```

# [Usage](#usage)
<a name="usage"></a>

```js
const RateLimiter = require('@mediaxpost/express-rate-limiter');
rateLimiter = new RateLimiter('rateLimit');

// Later in expressJS
app.use(rateLimiter.limit);

```

<a name="api"></a>
# [API Reference](#api)

## constructor(cacheNamespace [, config] [, cache] [, log])
Create a new Rate Limiter client with the passed `cacheNamespace`, [`config`](#config-object), [`cache`](#cache-object), and [`log`](#logging-object).  A `cacheNamespace` is required to scope the Rate Limiter from other values which may be in use within the cache.

## limit(req, res, next)
An express handler to check the current request against the rate limiter and which should be attached early in the Express stack.

```js
  app.use(rateLimiter.limit);
```

<a name="appendix"></a>
# [Appendix](#appendix)

<a name="config-object"></a>
## [Configuration Object](#config-object)

The configuration parameter expects and object that contains the following (with defaults provided below):
```js
{
  lookup: [],
  count: 250, // 250 request
  expire: 300000 // every 5 minute window (in mSec)
  whitelist: () => {
    return false;
  },
  onRateLimited: null,
  skipHeaders: false,
  noip: false
}
```

|parameter|type|description|
|---------|----|-----------|
|**`lookup`**|Function(req) ⇒ Array or Array|A function which accepts a HTTPRequest parameter and returns an array, or an array. The array is used to provide additional scoping criteria to the rate-limiting. For example, if you wanted Rate Limit based on an API Key and IP Address pair, you would create a function that return an array with the API Key from the request object. The IP Address is always included in the scope criteria unless `noip` is set to `true`.|
|**`count`**|Integer|The number of request allowed scoped by the lookup criteria before rate limiting occurs.|
|**`expire`**|Integer|Number of milliseconds for the refreshing rate limit time period. When an additional attempt is made during this period, the timer is reset and client must wait the entire duration again.|
|**`whitelist`**|Function(req) ⇒ Boolean or Array|A function which accepts a HTTPRequest parameter and returns a boolean value or an Array of IP Addresses. When a function is set, it should return a boolean value to indicate whether the request is whitelisted. When an array is set, then the current IP address of the request is compared against all values in the array and is whitelisted if the array includes the current IP. **Note**: The `x-forwarded-for` Header is used instead of the physical IP address when it is included in the request.|
|**`onBlacklist`**|Function(req, res, next) or `null`|A function accepting a HTTPRequest, a HTTPResponse, and a closure(`next`) parameter. When a request test true for being blacklisted, then this function is called blacklisting occurs. If the function is unset, then the IP Blacklist sends an HTTPResponse with a 403 Status Code, an empty body, and the `Retry-After` HTTP Header with the number of seconds that the client must wait before trying again. |
|**`skipHeaders`**|Boolean|Indicates that the
|**`noip`**|Boolean|Indicates that the IP Address from the HTTP Request should not be automatically added to the lookup scope. Without additional `lookup` criteria, this will act as a global ratelimit for every request, ensure that the value is sufficiently high if used in this way.|

<a name="cache-object"></a>
## [Cache Object](#cache-object)
The Cache object can be a active and [promisified Redis](https://www.npmjs.com/package/redis#promises) connect, or an active [Memory Cache](https://www.npmjs.com/package/@mediaxpost/memory-cache) connection, or an active [Object Key Cache](https://www.npmjs.com/package/@mediaxpost/object-key-cache). If no value is set, then IP Blacklist will create an internal Object Key Cache and use it.

<a name="logging-object"></a>
## [Logging Object](#logging-object)
The Logging object is an instance of any logging library, such as [Winston](https://www.npmjs.com/package/winston) or [Bunyan](https://www.npmjs.com/package/bunyan), which support the `.error(...)`, `.info(...)`, `.debug(...)`, and `.log(...)` methods. If this is not provided, then any debug or error messages are sent to `/dev/null` through the use of [`LogStub`](https://www.npmjs.com/package/logstub).
