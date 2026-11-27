"use client";

import { useSyncExternalStore } from "react";

// O token do operador fica só no navegador (localStorage), nunca no código.
// useSyncExternalStore deixa vários componentes lerem o mesmo valor e
// reagirem quando ele muda (login / logout / 401).

const KEY = "atendente:token";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  localStorage.setItem(KEY, token);
  emit();
}

export function clearToken() {
  localStorage.removeItem(KEY);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** `undefined` = ainda não sabemos (servidor/hidratação), `null` = sem token. */
export function useToken(): string | null | undefined {
  return useSyncExternalStore(subscribe, getToken, () => undefined);
}
