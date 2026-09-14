// react-native-alarmageddon's native scheduleAlarm expects "datetimeISO" in the pattern
// yyyy-MM-dd'T'HH:mm:ss, parsed with SimpleDateFormat and no timezone set — meaning it's
// interpreted as the device's LOCAL wall-clock time, despite the "ISO" name.
// Date.prototype.toISOString() always converts to UTC, which silently shifted every alarm
// (real sessions, custom alarms, the debug test alarm) by the device's full UTC offset — on
// an IST device that's 5:30 early, firing almost immediately instead of at the intended time
// whenever the alarm was set less than 5:30 ahead. This formats the LOCAL fields directly
// instead, exactly matching what the native side actually parses.
export function toAlarmDatetime(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
