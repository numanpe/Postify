// Builds a Sun-Sat week grid spanning a set of scheduled dates — the
// grid always starts on the Sunday on/before the earliest date and
// ends on the Saturday on/after the latest, so every item's week is
// shown in full even if the campaign doesn't start on a Sunday.
//
// Uses UTC date methods throughout, not local-time ones (getDay,
// setDate). Dates from <input type="date"> parse as UTC midnight, but
// getDay()/setDate() read/write in the *server's local* timezone — on
// a host running outside UTC that silently shifts which weekday a date
// lands on and misaligns the grid. Staying in UTC end-to-end (matching
// how scheduledDate is constructed in the createCampaign action) keeps
// this consistent regardless of server timezone.
export function buildCalendarWeeks(dates: Date[]): Date[][] {
  if (dates.length === 0) return [];

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const gridStart = new Date(sorted[0]);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());

  const gridEnd = new Date(sorted[sorted.length - 1]);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const weeks: Date[][] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDayNumber(date: Date): number {
  return date.getUTCDate();
}
