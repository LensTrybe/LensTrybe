// When LensTrybe opens to the public.
//
// This used to be written out twice, in App.jsx and in ComingSoon.jsx. Move one and
// forget the other and the countdown hits zero while the gate stays up, or the gate
// lifts while the page still counts down. One constant, imported by both.
//
// +10:00 is deliberate and is not a daylight saving oversight. Queensland does not
// observe it, so AEST is AEST all year, and the southern states do not start theirs
// until 4 October 2026. Every visitor sees the site open at the same instant: 10pm on
// 30 September in Perth, midnight in Brisbane, and midnight in Sydney too, because
// NSW is still on AEST that night.
//
// There is a third copy that cannot import this one: supabase/functions/waitlist-signup
// picks its email copy from the same date, and Edge Functions deploy separately from
// the app. If this date moves, move that one as well.
export const LAUNCH_DATE = new Date('2026-10-01T00:00:00+10:00')

// The gate reads the visitor's device clock, so it is a release mechanism and not a
// security boundary. Anything that must stay private after launch needs its own check.
export function hasLaunched(now = new Date()) {
  return now >= LAUNCH_DATE
}
