import { describe, it, expect } from 'vitest';
import { datesInLine, findDate, repairDates } from '@/lib/editorial-dates';

describe('the editorial dates', () => {
  it('reads a date however it is written', () => {
    expect(findDate('06-10-2025')).toBe('06-10-2025');
    expect(findDate('6/10/2025')).toBe('06-10-2025');
    expect(findDate('2025-10-06')).toBe('06-10-2025');
    expect(findDate('6 tháng 10 năm 2025')).toBe('06-10-2025');
    expect(findDate('October 6, 2025')).toBe('06-10-2025');
    expect(findDate('6 Oct 2025')).toBe('06-10-2025');
    expect(findDate('31/02/2025')).toBeNull();
    expect(findDate('không có')).toBeNull();
  });

  it('splits a line that holds all the labelled dates', () => {
    expect(datesInLine('Ngày nhận bài: 06-10-2025Ngày chỉnh sửa: 02-10-2026Ngày chấp nhận: 14-07-2026')).toEqual({
      received: '06-10-2025',
      revised: '02-10-2026',
      accepted: '14-07-2026',
    });
    expect(datesInLine('Received: 6 Oct 2025; Revised: 2 Nov 2025; Accepted: 14 Jan 2026')).toEqual({ received: '06-10-2025', revised: '02-11-2025', accepted: '14-01-2026' });
    expect(datesInLine('Ngày chấp nhận: 14/07/2026')).toEqual({ accepted: '14/07/2026'.replace(/\//g, '-') });
  });

  it('mends a field that took them all, and puts each date where it belongs', () => {
    const fixed = repairDates({ received: '06-10-2025Ngày chỉnh sửa: 02-10-2026Ngày chấp nhận: 14-07-2026', revised: '', accepted: '' });
    expect(fixed).toEqual({ received: '06-10-2025', revised: '02-10-2026', accepted: '14-07-2026' });
  });

  it('leaves good dates alone and puts another way of writing into dd-mm-yyyy', () => {
    const good = { received: '06/10/2025', revised: '', accepted: '' };
    expect(repairDates(good)).toBe(good);
    expect(repairDates({ received: '2025-10-06', revised: '', accepted: '' })?.received).toBe('06-10-2025');
  });
});
