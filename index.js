// index.js

// Dependencies
const __ = {
  assign: require('lodash.assign'),
  isNil: require('lodash.isnil'),
  join: require('lodash.join'),
  merge: require('lodash.merge'),
};
const ObjectKeyCache = require('@outofsync/object-key-cache');
const ReqUtils = require('@outofsync/request-utils');
const LogStub = require('logstub');

class RateLimiter {
  constructor(namespace, config, cache, log) {
    const defaults = {
      lookup: [],
      count: 250,
      // 250 request
      expire: 1000 * 60 * 5,
      // every 5 minute window
      whitelist: () => {
        return false;
      },
      onRateLimited: null,
      skipHeaders: false,
      noip: false
    };

    if (__.isNil(namespace)) {
      throw new Error('The RateLimiter cache namespace can not be omitted.');
    }
    this.namespace = namespace;

    this.cache = cache;
    // Default the cache to a memory cache if unset
    if (__.isNil(this.cache)) {
      this.cache = new ObjectKeyCache();
      this.cache.connect();
    }

    this.log = log || new LogStub();

    this.config = __.merge(__.assign(defaults), config);
  }

  calcLookups(req, res) {
    // check and set lookup
    let looks = [];
    if (typeof this.config.lookup === 'function') {
      looks = this.config.lookup(req, res);
    }

    // Make sure that the lookups are an array if unset
    if (!__.isNil(this.config.lookup)) {
      // Convert to Array if not already
      looks = Array.isArray(this.config.lookup) ? this.config.lookup.splice(0) : [this.config.lookup];
    }

    // Push the IP Address of the requestor into the array
    // This should always be done except when the `noip` flag is true
    if (!this.config.noip) {
      looks.push(req.headers['x-forwarded-for'] || req.connection.remoteAddress);
    }

    // merge lookup options
    return __.join(looks, ':');
  }

  checkWhitelist(req) {
    if (Array.isArray(this.config.whitelist)) {
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      return this.config.whitelist.includes(ip);
    }

    if (typeof this.config.whitelist === 'function') {
      return this.config.whitelist(req);
    }

    return false;
  }

  limit(req, res, next) {
    if (__.isNil(req.reqUtils)) {
      req.reqUtils = new ReqUtils(req);
    }
    const reqUtils = req.reqUtils;
    let parsedLimit;

    // Skip if already responded to request
    if (reqUtils.hasResponse()) {
      return next();
    }

    // Skip if this passes the whitelist
    if (this.checkWhitelist(req)) {
      this.log.debug('Whitelisted from ratelimit');
      return next();
    }

    const lookups = this.calcLookups(req, res);
    const path = this.config.path || req.path;
    const method = (this.config.method || req.method).toLowerCase();
    const key = `ratelimit:${path}:${method}:${lookups}`;
    const timestamp = Date.now();

    const defaultLimit = {
      total: this.config.count,
      remaining: this.config.count,
      reset: timestamp + this.config.expire
    };

    // Set onRateLimited function
    const onRateLimitedType = typeof this.config.onRateLimited;
    this.config.onRateLimited = onRateLimitedType === 'function' ? this.config.onRateLimited : (_req, _res, _next) => {
      reqUtils.setError(429000);
      _next('Rate limit exceeded.');
    };

    this.cache
      .hgetAsync(this.namespace, key)
      .then((limit) => {
        try {
          parsedLimit = JSON.parse(limit);
        } catch (err) {}
        parsedLimit = parsedLimit || defaultLimit;

        // Check if the rate limit cache has expired and reset if it has
        if (timestamp > parsedLimit.reset) {
          parsedLimit.reset = timestamp + this.config.expire;
          parsedLimit.remaining = this.config.count;
        }

        // do not allow negative remaining
        parsedLimit.remaining = Math.max(Number(parsedLimit.remaining) - 1, -1);
        return this.cache.hsetAsync(this.namespace, key, JSON.stringify(parsedLimit));
      })
      .then(() => {
        if (!this.config.skipHeaders) {
          res.set('X-RateLimit-Limit', parsedLimit.total);
          res.set('X-RateLimit-Reset', Math.ceil(parsedLimit.reset / 1000));
          // UTC epoch seconds
          res.set('X-RateLimit-Remaining', Math.max(parsedLimit.remaining, 0));
        }

        if (parsedLimit.remaining >= 0) {
          // Not rate limited
          next();
        } else {
          // Rate limited
          const after = (parsedLimit.reset - Date.now()) / 1000;
          if (!this.config.skipHeaders) {
            res.set('Retry-After', after);
          }
          this.config.onRateLimited(req, res, next);
          next();
        }
      })
      .catch((err) => {
        // There was som error trying to retrieve the rate limit cache data
        // Log the error and skip
        this.log.error(err.stack || err);
        next();
      });

    return undefined;
  }
}

module.exports = RateLimiter;
