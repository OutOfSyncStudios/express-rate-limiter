declare module "@outofsync/express-rate-limiter";

import ObjectKeyCache from '@outofsync/object-key-cache';
import MemoryCache from '@outofsync/memory-cache';
import Redis from 'redis';

import {
  ClientRequest,
  ServerResponse,
} from 'http';

type ClosureFn = (...params: any) => void;
type RateLimiterLookupFn = (req: ClientRequest) => string[];
type RateLimiterWhiteListFn = (req: ClientRequest) => string[] | boolean;
type RateLimiterOnRateLimitedtFn = (req: ClientRequest, res: ServerResponse, next: ClosureFn) => any;
type Cache = typeof ObjectKeyCache | typeof MemoryCache | typeof Redis;

interface RateLimiterOptions {
  lookup: RateLimiterLookupFn | string[];
  count: number;
  expire: number;
  whitelist: RateLimiterWhiteListFn;
  onRateLimited: RateLimiterOnRateLimitedtFn | null;
  skipHeaders: boolean
  noip: boolean;
}

declare class RateLimiter {
  constructor(namespace: string, config?: RateLimiterOptions, cache?: Cache, log?: any);
  checkWhitelist(req: ClientRequest);
  limit(req: ClientRequest, res: ServerResponse, next: ClosureFn);
}

declare const obj: RateLimiter;
export default obj;