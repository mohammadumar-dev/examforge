"use client";

interface Props {
  iso: string;
}

// suppressHydrationWarning is required: toLocaleString() produces the server
// timezone on SSR but the user's local timezone on the client, causing a
// deliberate text mismatch that React should not treat as an error.
export function LocalTime({ iso }: Props) {
  return <span suppressHydrationWarning>{new Date(iso).toLocaleString()}</span>;
}
