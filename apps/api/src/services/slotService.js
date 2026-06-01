const SLOT_DURATION = 60; // all appointments are 1 hour
const BUFFER = 15;        // minutes required between appointments
const INCREMENT = 15;     // slot start-time step

const TOD_BOUNDS = {
  morning:   [0,        12 * 60],
  afternoon: [12 * 60,  17 * 60],
  evening:   [17 * 60,  24 * 60],
};

export function timeToMinutes(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function scheduledAtToMinutes(scheduledAt) {
  const d = new Date(scheduledAt);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/**
 * Build available slots for a given set of availability rows and existing appointments.
 *
 * availability: [{ therapist_id, first_name, last_name, start_time, end_time }]
 * appointments: [{ therapist_id, scheduled_at, duration_minutes }]
 * Returns sorted [{ startTime, endTime, availableTherapists: [{id, firstName, lastName}] }]
 */
export function generateSlots(availability, appointments, { timeOfDay } = {}) {
  const todBounds = timeOfDay ? TOD_BOUNDS[timeOfDay] : null;

  const apptsByTherapist = {};
  for (const a of appointments) {
    if (!apptsByTherapist[a.therapist_id]) apptsByTherapist[a.therapist_id] = [];
    const startMin = scheduledAtToMinutes(a.scheduled_at);
    apptsByTherapist[a.therapist_id].push({ startMin, endMin: startMin + a.duration_minutes });
  }

  const slotMap = {};

  for (const avail of availability) {
    const tid = avail.therapist_id;
    const existing = apptsByTherapist[tid] ?? [];
    const availStart = timeToMinutes(avail.start_time);
    const availEnd = timeToMinutes(avail.end_time);
    const lastStart = availEnd - SLOT_DURATION;

    for (let t = availStart; t <= lastStart; t += INCREMENT) {
      if (todBounds && (t < todBounds[0] || t >= todBounds[1])) continue;

      const slotEnd = t + SLOT_DURATION;
      // Slot is blocked if [t, slotEnd] and any existing [a.startMin, a.endMin]
      // overlap when each is padded by BUFFER.
      const blocked = existing.some(a => t < a.endMin + BUFFER && slotEnd > a.startMin - BUFFER);

      if (!blocked) {
        const key = minutesToTime(t);
        if (!slotMap[key]) {
          slotMap[key] = { startTime: key, endTime: minutesToTime(slotEnd), availableTherapists: [] };
        }
        slotMap[key].availableTherapists.push({
          id: tid,
          firstName: avail.first_name,
          lastName: avail.last_name,
        });
      }
    }
  }

  return Object.values(slotMap).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Returns the sorted list of calendar dates (YYYY-MM-DD) that have at least one slot.
 * availByDate / apptsByDate are objects keyed by date string.
 */
export function availableDaysForMonth(availByDate, apptsByDate, options) {
  return Object.keys(availByDate)
    .filter(ds => generateSlots(availByDate[ds], apptsByDate[ds] ?? [], options).length > 0)
    .sort();
}
