// test/index.js

// Dependancies
const lolex = require('lolex');
const chai = require('chai');
const expect = chai.expect;
const RateLimiter = require('..');

const req = { headers: {}, connection: { remoteAddress: '127.0.0.1' }, path: '/', method: 'POST' };

const res = {
  _status: 0,
  _message: '',
  _headers: {},
  status: function(status) {
    this._status = status;
  },
  send: function(data) {
    this._message = data;
  },
  set: function(key, value) {
    if (!this._headers) {
      this._headers = {};
    }
    this._headers[key] = value;
  }
};

describe('RateLimiter', () => {
  let clock;
  let rateLimiter;
  before(() => {
    rateLimiter = new RateLimiter('test', { count: 1, expire: 10 });
    clock = lolex.install();
  });

  it('constructor', () => {
    expect(rateLimiter).to.be.instanceof(RateLimiter);
  });

  it('calcLookups', () => {
    const looks = rateLimiter.calcLookups(req, res);
    expect(looks).to.have.string(req.connection.remoteAddress);
  });

  it('calcLookups (noip)', () => {
    rateLimiter.config.noip = true;
    const looks = rateLimiter.calcLookups(req, res);
    expect(looks).to.not.have.string(req.connection.remoteAddress);
    rateLimiter.config.noip = false;
  });

  it('checkWhitelist (function) default', () => {
    const test = rateLimiter.checkWhitelist(req);
    expect(test).to.be.equal(false);
  });

  it('checkWhitelist (function) good', () => {
    rateLimiter.config.whitelist = (_req) => {
      return _req.connection.remoteAddress === '127.0.0.1';
    };
    const test = rateLimiter.checkWhitelist(req);
    expect(test).to.be.equal(true);
  });

  it('checkWhitelist (array) good', () => {
    rateLimiter.config.whitelist = ['127.0.0.1'];
    const test = rateLimiter.checkWhitelist(req);
    expect(test).to.be.equal(true);
  });

  it('checkWhitelist (array) bad', () => {
    rateLimiter.config.whitelist = [];
    const test = rateLimiter.checkWhitelist(req);
    expect(test).to.be.equal(false);
  });

  it('checkWhitelist (other)', () => {
    rateLimiter.config.whitelist = 12345;
    const test = rateLimiter.checkWhitelist(req);
    expect(test).to.be.equal(false);
  });

  it('limit (no limit reached)', (done) => {
    rateLimiter.limit(req, res, () => {
      const val = JSON.parse(rateLimiter.cache.cache.cache.test.value['ratelimit:/:post:127.0.0.1']);
      expect(val.remaining).to.be.equal(0);
      done();
    });
  });

  it('limit after ratelimit reached', (done) => {
    rateLimiter.config.onRateLimited = (req, req, () => {
      const val = JSON.parse(rateLimiter.cache.cache.cache.test.value['ratelimit:/:post:127.0.0.1']);
      expect(val.remaining).to.be.equal(-1);
      done();
    });
    rateLimiter.limit(req, res, () => {});
  });

  it('limit after expire', (done) => {
    clock.tick(10000);
    rateLimiter.limit(req, res, () => {
      const val = JSON.parse(rateLimiter.cache.cache.cache.test.value['ratelimit:/:post:127.0.0.1']);
      expect(val.remaining).to.be.equal(0);
      done();
    });
  });
});
