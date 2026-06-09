import {
  generateSlots,
  availableDaysForMonth,
  timeToMinutes,
  minutesToTime,
} from '../services/slotService.js';

const T1 = { therapist_id: 't1', first_name: 'Alice', last_name: 'Smith' };
const T2 = { therapist_id: 't2', first_name: 'Bob', last_name: 'Jones' };

function avail(therapist, startTime, endTime, specific_date = '2030-01-10') {
  return { ...therapist, start_time: startTime, end_time: endTime, specific_date };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

describe('timeToMinutes', () => {
  it('converts 00:00 to 0', () => expect(timeToMinutes('00:00')).toBe(0));
  it('converts 09:00 to 540', () => expect(timeToMinutes('09:00')).toBe(540));
  it('converts 17:30 to 1050', () => expect(timeToMinutes('17:30')).toBe(1050));
  it('converts 23:59 to 1439', () => expect(timeToMinutes('23:59')).toBe(1439));
});

describe('minutesToTime', () => {
  it('converts 0 to 00:00', () => expect(minutesToTime(0)).toBe('00:00'));
  it('converts 540 to 09:00', () => expect(minutesToTime(540)).toBe('09:00'));
  it('converts 1050 to 17:30', () => expect(minutesToTime(1050)).toBe('17:30'));
  it('pads single-digit hours and minutes', () => expect(minutesToTime(65)).toBe('01:05'));
});

// ── generateSlots ─────────────────────────────────────────────────────────────

describe('generateSlots', () => {
  it('returns empty array when availability is empty', () => {
    expect(generateSlots([], [])).toEqual([]);
  });

  it('generates slots every 15 minutes within the window', () => {
    const slots = generateSlots([avail(T1, '09:00', '11:00')], []);
    // 9:00, 9:15, 9:30, 9:45, 10:00 → last start is 10:00 (window = 60 min)
    expect(slots.map(s => s.startTime)).toEqual(['09:00', '09:15', '09:30', '09:45', '10:00']);
  });

  it('sets endTime to startTime + 60 minutes', () => {
    const [slot] = generateSlots([avail(T1, '09:00', '10:00')], []);
    expect(slot.startTime).toBe('09:00');
    expect(slot.endTime).toBe('10:00');
  });

  it('includes availableTherapists array for each slot', () => {
    const [slot] = generateSlots([avail(T1, '09:00', '10:00')], []);
    expect(slot.availableTherapists).toEqual([{ id: 't1', firstName: 'Alice', lastName: 'Smith' }]);
  });

  it('blocks a slot that overlaps an existing appointment', () => {
    const availability = [avail(T1, '09:00', '12:00')];
    // Appointment at 09:00 for 60 min blocks 08:45–10:15 (60 min slot + 15 min buffer each side)
    const appointments = [{ therapist_id: 't1', scheduled_at: '2030-01-10T09:00:00Z', duration_minutes: 60 }];
    const slots = generateSlots(availability, appointments);
    // Slots starting before 10:15 are blocked: 9:00, 9:15, 9:30, 9:45, 10:00
    const times = slots.map(s => s.startTime);
    expect(times).not.toContain('09:00');
    expect(times).not.toContain('09:30');
    expect(times).not.toContain('10:00');
    expect(times).toContain('10:15'); // first slot after buffer
  });

  it('does not block slots for a different therapist', () => {
    const availability = [avail(T1, '09:00', '12:00'), avail(T2, '09:00', '12:00')];
    const appointments = [{ therapist_id: 't1', scheduled_at: '2030-01-10T09:00:00Z', duration_minutes: 60 }];
    const slots = generateSlots(availability, appointments);
    const slot9 = slots.find(s => s.startTime === '09:00');
    // T1 is blocked but T2 is still available at 9:00
    expect(slot9).toBeDefined();
    expect(slot9.availableTherapists.map(t => t.id)).toEqual(['t2']);
  });

  it('merges multiple therapists into the same slot key', () => {
    const availability = [avail(T1, '09:00', '10:00'), avail(T2, '09:00', '10:00')];
    const slots = generateSlots(availability, []);
    expect(slots[0].availableTherapists).toHaveLength(2);
  });

  it('returns slots sorted by startTime', () => {
    const availability = [avail(T1, '10:00', '12:00'), avail(T2, '08:00', '10:00')];
    const slots = generateSlots(availability, []);
    const times = slots.map(s => s.startTime);
    expect(times).toEqual([...times].sort());
  });

  it('filters morning slots (< 12:00) when timeOfDay=morning', () => {
    const slots = generateSlots([avail(T1, '08:00', '17:00')], [], { timeOfDay: 'morning' });
    expect(slots.every(s => timeToMinutes(s.startTime) < 12 * 60)).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
  });

  it('filters afternoon slots (12:00–17:00) when timeOfDay=afternoon', () => {
    const slots = generateSlots([avail(T1, '08:00', '20:00')], [], { timeOfDay: 'afternoon' });
    const mins = slots.map(s => timeToMinutes(s.startTime));
    expect(mins.every(m => m >= 12 * 60 && m < 17 * 60)).toBe(true);
  });

  it('filters evening slots (>= 17:00) when timeOfDay=evening', () => {
    const slots = generateSlots([avail(T1, '08:00', '23:00')], [], { timeOfDay: 'evening' });
    expect(slots.every(s => timeToMinutes(s.startTime) >= 17 * 60)).toBe(true);
  });

  it('excludes slots before notBefore when availability has a specific_date', () => {
    const notBefore = new Date('2030-01-10T11:00:00Z');
    const slots = generateSlots([avail(T1, '09:00', '13:00')], [], { notBefore });
    expect(slots.every(s => {
      const dt = new Date(`2030-01-10T${s.startTime}:00Z`);
      return dt >= notBefore;
    })).toBe(true);
  });

  it('blocks a slot when all active beds are occupied (bed_id present)', () => {
    const bedAppt = { therapist_id: 't2', bed_id: 'bed-1', scheduled_at: '2030-01-10T09:00:00Z', duration_minutes: 60 };
    // T1 is available at 09:00, but the single bed is occupied by T2's appointment.
    // Availability must extend past 10:15 so that slot is reachable (lastStart = availEnd - 60).
    const slots = generateSlots([avail(T1, '09:00', '12:00')], [bedAppt], { activeBedCount: 1 });
    const times = slots.map(s => s.startTime);
    // 09:00–10:00 slots conflict with the bed-occupying appointment + 15-min buffer
    expect(times).not.toContain('09:00');
    expect(times).toContain('10:15'); // first slot after the bed is free
  });

  it('does not block a slot when the conflicting appointment has no bed_id', () => {
    // Appointment without bed_id does not count against bed capacity
    const unassignedAppt = { therapist_id: 't2', bed_id: null, scheduled_at: '2030-01-10T09:00:00Z', duration_minutes: 60 };
    const slots = generateSlots([avail(T1, '09:00', '10:00')], [unassignedAppt], { activeBedCount: 1 });
    expect(slots.map(s => s.startTime)).toContain('09:00');
  });

  it('allows a slot when activeBedCount is 0 (no bed constraint)', () => {
    const bedAppt = { therapist_id: 't2', bed_id: 'bed-1', scheduled_at: '2030-01-10T09:00:00Z', duration_minutes: 60 };
    const slots = generateSlots([avail(T1, '09:00', '10:00')], [bedAppt], { activeBedCount: 0 });
    expect(slots.map(s => s.startTime)).toContain('09:00');
  });
});

// ── availableDaysForMonth ─────────────────────────────────────────────────────

describe('availableDaysForMonth', () => {
  it('returns sorted list of days that have at least one slot', () => {
    const availByDate = {
      '2030-01-10': [avail(T1, '09:00', '10:00', '2030-01-10')],
      '2030-01-11': [avail(T1, '09:00', '10:00', '2030-01-11')],
    };
    const days = availableDaysForMonth(availByDate, {});
    expect(days).toEqual(['2030-01-10', '2030-01-11']);
  });

  it('excludes days with no slots (all blocked)', () => {
    const appt = { therapist_id: 't1', scheduled_at: '2030-01-10T09:00:00Z', duration_minutes: 60 };
    const availByDate = { '2030-01-10': [avail(T1, '09:00', '10:00', '2030-01-10')] };
    // Single slot blocked by the appointment
    const days = availableDaysForMonth(availByDate, { '2030-01-10': [appt] });
    expect(days).toHaveLength(0);
  });

  it('returns empty array when availByDate is empty', () => {
    expect(availableDaysForMonth({}, {})).toEqual([]);
  });
});
