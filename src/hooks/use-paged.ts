"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import type { Page } from "@/lib/types";

export const POLL_MS = 2000; // o doc do backend sugere 2s: suficiente para um número só

/**
 * Padrão usado na lista e no histórico:
 *  - a PRIMEIRA página é refeita a cada 2s (polling via SWR);
 *  - páginas antigas (scroll/botão "carregar mais") ficam em estado local e
 *    nunca são jogadas fora;
 *  - tudo é juntado pelo `id`, a versão mais nova da primeira página vence.
 */
export function usePaged<T extends { id: string }>({
  key,
  fetchPage,
  sort,
}: {
  key: string | null;
  fetchPage: (cursor: string | null) => Promise<Page<T>>;
  sort: (a: T, b: T) => number;
}) {
  const {
    data: first,
    error,
    isLoading,
    mutate,
  } = useSWR(key, () => fetchPage(null), {
    refreshInterval: POLL_MS,
    keepPreviousData: false,
  });

  const [older, setOlder] = useState<T[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null | undefined>(
    undefined, // undefined = ainda não paginou, usa o cursor da primeira página
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<Error | null>(null);

  const cursor = olderCursor === undefined ? (first?.nextCursor ?? null) : olderCursor;

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await fetchPage(cursor);
      setOlder((prev) => [...prev, ...page.items]);
      setOlderCursor(page.nextCursor);
    } catch (e) {
      setMoreError(e as Error);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, fetchPage]);

  const items = useMemo(() => {
    const byId = new Map<string, T>();
    for (const item of older) byId.set(item.id, item);
    for (const item of first?.items ?? []) byId.set(item.id, item);
    return [...byId.values()].sort(sort);
  }, [older, first, sort]);

  return {
    items,
    isLoading,
    error: (error as Error | undefined) ?? undefined,
    hasMore: Boolean(cursor),
    loadMore,
    loadingMore,
    moreError,
    mutateFirst: mutate,
  };
}
