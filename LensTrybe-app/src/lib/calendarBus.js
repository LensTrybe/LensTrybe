const listeners = new Set()

export function onCalendarChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emitCalendarChange() {
  listeners.forEach((fn) => fn())
}
