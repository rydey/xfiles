/**
 * Time utility functions for Maldives timezone (UTC+5)
 */

/**
 * Converts a UTC timestamp to Maldives time (UTC+5)
 * @param timestamp - UTC timestamp string or Date object
 * @returns Date object in Maldives timezone
 */
export function toMaldivesTime(timestamp: string | Date): Date {
  const date = new Date(timestamp);
  return new Date(date.getTime() + (5 * 60 * 60 * 1000));
}

/**
 * Formats time for display in Maldives timezone
 * @param timestamp - UTC timestamp string or Date object
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatMaldivesTime(timestamp: string | Date): string {
  const maldivesTime = toMaldivesTime(timestamp);
  return maldivesTime.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
}

/**
 * Formats date for display in Maldives timezone
 * @param timestamp - UTC timestamp string or Date object
 * @returns Formatted date string
 */
export function formatMaldivesDate(timestamp: string | Date): string {
  const maldivesTime = toMaldivesTime(timestamp);
  const now = new Date();
  const nowMaldives = toMaldivesTime(now);
  
  const isToday = maldivesTime.toDateString() === nowMaldives.toDateString();
  const isYesterday = new Date(nowMaldives.getTime() - 24 * 60 * 60 * 1000).toDateString() === maldivesTime.toDateString();
  
  if (isToday) {
    return 'Today';
  } else if (isYesterday) {
    return 'Yesterday';
  } else {
    return maldivesTime.toLocaleDateString([], { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
}

/**
 * Gets the current time in Maldives timezone
 * @returns Date object in Maldives timezone
 */
export function getCurrentMaldivesTime(): Date {
  return toMaldivesTime(new Date());
}
