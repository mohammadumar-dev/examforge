"use client";

interface Props {
  iso: string;
}

export function LocalTime({ iso }: Props) {
  return <>{new Date(iso).toLocaleString()}</>;
}
