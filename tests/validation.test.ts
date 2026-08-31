import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { businessToday, dayOfWeekForDate, isAppointmentStatus, isValidDateOnly, normalizeNfeKeys } from '../src/server/validation';

describe('server validation', () => {
  it('accepts only real YYYY-MM-DD dates', () => {
    assert.equal(isValidDateOnly('2026-08-31'), true);
    assert.equal(isValidDateOnly('2026-02-30'), false);
    assert.equal(isValidDateOnly('31/08/2026'), false);
  });

  it('calculates date-only weekdays independently of server timezone', () => {
    assert.equal(dayOfWeekForDate('2026-08-31'), 1);
  });

  it('accepts only known appointment statuses', () => {
    assert.equal(isAppointmentStatus('PENDENTE'), true);
    assert.equal(isAppointmentStatus('DELIVERED_BY_CLIENT'), false);
  });

  it('keeps exactly 44 digits for NF-e access keys', () => {
    assert.deepEqual(normalizeNfeKeys(['35260800000000000000550010000000111000000000', '123']), ['35260800000000000000550010000000111000000000']);
  });

  it('returns a business date string', () => {
    assert.match(businessToday(), /^\d{4}-\d{2}-\d{2}$/);
  });
});
