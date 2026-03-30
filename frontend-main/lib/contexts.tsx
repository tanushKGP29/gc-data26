// @ts-nocheck
"use client";

import { createContext, useContext } from 'react';

// Dashboard context for cross-component state sharing
export const DashContext = createContext(null);
export function useDash() { return useContext(DashContext); }

// App UI context for panel state
export const AppUICtx = createContext(null);
export function useAppUI() { return useContext(AppUICtx); }
