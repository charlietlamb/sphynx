import { notFound } from "@tanstack/react-router";

export function devOnly() {
  if (!import.meta.env.DEV) {
    throw notFound();
  }
}
