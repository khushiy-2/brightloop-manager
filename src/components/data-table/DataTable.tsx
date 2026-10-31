"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
};

export type DataTablePage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

type DataTableProps<T extends { id: string }> = {
  endpoint: string;
  columns: DataTableColumn<T>[];
  searchPlaceholder: string;
  initialPage: number;
  initialQuery: string;
  refreshKey?: number;
  rowActions?: (row: T, refresh: () => void) => ReactNode;
  renderExpanded?: (row: T, refresh: () => void) => ReactNode;
  filters?: Record<string, string>;
};

export function DataTable<T extends { id: string }>({
  endpoint,
  columns,
  searchPlaceholder,
  initialPage,
  initialQuery,
  refreshKey = 0,
  rowActions,
  renderExpanded,
  filters = {},
}: DataTableProps<T>) {
  const [page, setPage] = useState(initialPage);
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery);
  const [data, setData] = useState<DataTablePage<T> | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const filtersKey = JSON.stringify(filters);
  const previousFiltersKey = useRef(filtersKey);

  const refresh = useCallback(() => {
    setError("");
    setReload((value) => value + 1);
  }, []);

  const setLocation = useCallback((nextPage: number, nextQuery: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(nextPage));
    if (nextQuery) url.searchParams.set("q", nextQuery);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
    setError("");
    setPage(nextPage);
    setQuery(nextQuery);
  }, []);

  useEffect(() => {
    if (previousFiltersKey.current === filtersKey) return;
    previousFiltersKey.current = filtersKey;
    setLocation(1, query);
  }, [filtersKey, query, setLocation]);

  useEffect(() => {
    if (search === query) return;
    const timeout = window.setTimeout(() => {
      const nextQuery = search.trim();
      setSearch(nextQuery);
      setLocation(1, nextQuery);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [query, search, setLocation]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    for (const [key, value] of Object.entries(JSON.parse(filtersKey) as Record<string, string>)) {
      if (value) params.set(key, value);
    }
    void fetch(`${endpoint}?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as DataTablePage<T> & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load records.");
        setError("");
        setData(result);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Unable to load records.");
      });
    return () => controller.abort();
  }, [endpoint, page, query, refreshKey, reload, filtersKey]);

  return (
    <section className="admin-table-panel">
      <div className="data-table-toolbar">
        <label className="search-field">
          <span className="sr-only">Search records</span>
          <input
            type="search"
            value={search}
            placeholder={searchPlaceholder}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </label>
        <span className="record-count">{data?.total ?? 0} total</span>
      </div>
      {error && <p className="form-message form-error" role="alert">{error}</p>}
      <div className="admin-table-scroll">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => <TableHead key={column.key}>{column.header}</TableHead>)}
              {(rowActions || renderExpanded) && <TableHead className="actions-heading">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.map((row) => (
              <Fragment key={row.id}>
                <TableRow key={row.id}>
                  {columns.map((column) => <TableCell key={column.key}>{column.render(row)}</TableCell>)}
                  {(rowActions || renderExpanded) && (
                    <TableCell className="table-actions">
                      {rowActions?.(row, refresh)}
                      {renderExpanded && (
                        <button
                          className="quiet-button"
                          type="button"
                          aria-expanded={expandedId === row.id}
                          onClick={() => setExpandedId((current) => current === row.id ? null : row.id)}
                        >
                          {expandedId === row.id ? "Hide variants" : "Variants"}
                        </button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
                {expandedId === row.id && renderExpanded && (
                  <TableRow key={`${row.id}-expanded`}>
                    <TableCell colSpan={columns.length + 1} className="expanded-cell">
                      {renderExpanded(row, refresh)}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {data?.items.length === 0 && (
              <TableRow><TableCell colSpan={columns.length + (rowActions || renderExpanded ? 1 : 0)} className="table-empty">No records found.</TableCell></TableRow>
            )}
            {!data && !error && (
              <TableRow><TableCell colSpan={columns.length + (rowActions || renderExpanded ? 1 : 0)} className="table-empty">Loading…</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="pagination-bar">
        <span>Page {data?.page ?? page} of {data?.pageCount ?? 1}</span>
        <div>
          <button
            className="quiet-button"
            type="button"
            disabled={page <= 1 || !data}
            onClick={() => setLocation(page - 1, query)}
          >
            Previous
          </button>
          <button
            className="quiet-button"
            type="button"
            disabled={!data || page >= data.pageCount}
            onClick={() => setLocation(page + 1, query)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
