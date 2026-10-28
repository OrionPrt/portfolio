"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { MediaOption } from "@/features/media/types";

const MediaOptionsContext = createContext<readonly MediaOption[]>([]);

interface MediaOptionsProviderProps {
  readonly options: readonly MediaOption[];
  readonly children: ReactNode;
}

/** The library, for the Markdown editors of a form: they insert from it. */
export function MediaOptionsProvider({
  options,
  children,
}: MediaOptionsProviderProps) {
  return <MediaOptionsContext value={options}>{children}</MediaOptionsContext>;
}

/** The library's images; none outside a form that offers them. */
export function useMediaOptions(): readonly MediaOption[] {
  return useContext(MediaOptionsContext);
}
