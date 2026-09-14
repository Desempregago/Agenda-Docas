import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRateLimit,
  clearRateLimit,
  clientIpFromRequest,
  RATE_LIMIT_CONFIG,
  rateLimitSnapshot,
  recordRateLimitFailure,
  resetRateLimits,
} from '../src/server/rateLimit';

describe('auth rate limiting', () => {
  beforeEach(() => resetRateLimits());

  it('allows the first attempts and records failures', () => {
    assert.equal(checkRateLimit('staff:1.2.3.4'), null);
    for (let i = 0; i < RATE_LIMIT_CONFIG.MAX_FAILURES - 1; i++) {
      recordRateLimitFailure('staff:1.2.3.4');
    }
    assert.equal(checkRateLimit('staff:1.2.3.4'), null);
    assert.equal(rateLimitSnapshot('staff:1.2.3.4').failures, RATE_LIMIT_CONFIG.MAX_FAILURES - 1);
  });

  it('blocks after MAX_FAILURES within the window and reports retry time', () => {
    const base = Date.now();
    for (let i = 0; i < RATE_LIMIT_CONFIG.MAX_FAILURES; i++) {
      recordRateLimitFailure('staff:1.2.3.4', base + i);
    }
    const blocked = checkRateLimit('staff:1.2.3.4', base + 1000);
    assert.equal(typeof blocked, 'string');
    assert.match(blocked as string, /Muitas tentativas/);
    const snap = rateLimitSnapshot('staff:1.2.3.4', base + 1000);
    assert.equal(snap.blockedForSeconds > 0, true);
  });

  it('unblocks after the block duration and resets the sliding window', () => {
    const base = Date.now();
    for (let i = 0; i < RATE_LIMIT_CONFIG.MAX_FAILURES; i++) {
      recordRateLimitFailure('staff:1.2.3.4', base + i);
    }
    assert.notEqual(checkRateLimit('staff:1.2.3.4', base + 1000), null);
    const after = base + RATE_LIMIT_CONFIG.BLOCK_DURATION_MS + 1000;
    assert.equal(checkRateLimit('staff:1.2.3.4', after), null);
    // Janela reiniciada: novas falhas contam do zero
    recordRateLimitFailure('staff:1.2.3.4', after + 1);
    assert.equal(rateLimitSnapshot('staff:1.2.3.4', after + 2).failures, 1);
  });

  it('drops failures older than the sliding window', () => {
    const base = Date.now();
    for (let i = 0; i < RATE_LIMIT_CONFIG.MAX_FAILURES - 1; i++) {
      recordRateLimitFailure('staff:1.2.3.4', base);
    }
    // Falhas antigas expiraram: continua permitido
    const later = base + RATE_LIMIT_CONFIG.FAILURE_WINDOW_MS + 1;
    recordRateLimitFailure('staff:1.2.3.4', later);
    assert.equal(checkRateLimit('staff:1.2.3.4', later + 1), null);
  });

  it('clears on successful login and isolates by key', () => {
    recordRateLimitFailure('staff:1.2.3.4');
    clearRateLimit('staff:1.2.3.4');
    assert.equal(checkRateLimit('staff:1.2.3.4'), null);
    recordRateLimitFailure('supplier:5.6.7.8');
    assert.equal(rateLimitSnapshot('staff:9.9.9.9').failures, 0);
  });

  it('prefers the first X-Forwarded-For entry and falls back to socket', () => {
    assert.equal(
      clientIpFromRequest({ headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' } }),
      '10.0.0.1'
    );
    assert.equal(
      clientIpFromRequest({ headers: {}, socket: { remoteAddress: '127.0.0.1' } }),
      '127.0.0.1'
    );
  });
});
