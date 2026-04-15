"use client";

import { useState } from "react";

export type SortOption = "newest" | "services" | "name";

interface SearchFilterProps {
  onSearch: (query: string) => void;
  onSort: (sort: SortOption) => void;
  activeSort: SortOption;
  resultCount: number;
  totalCount: number;
}

export default function SearchFilter({
  onSearch,
  onSort,
  activeSort,
  resultCount,
  totalCount,
}: SearchFilterProps) {
  const [query, setQuery] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onSearch(val);
  };

  return (
    <div className="search-filter-bar">
      <div className="search-input-wrapper">
        <span className="search-icon">⌕</span>
        <input
          id="agent-search"
          type="text"
          className="search-input"
          placeholder="Search agents, services, addresses…"
          value={query}
          onChange={handleChange}
          autoComplete="off"
        />
        {query && (
          <button
            className="search-clear"
            onClick={() => {
              setQuery("");
              onSearch("");
            }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <div className="search-meta">
        <div className="sort-group">
          <span className="sort-label">Sort:</span>
          {(["newest", "services", "name"] as SortOption[]).map((opt) => (
            <button
              key={opt}
              className={`sort-btn ${activeSort === opt ? "sort-btn-active" : ""}`}
              onClick={() => onSort(opt)}
            >
              {opt === "newest"
                ? "Newest"
                : opt === "services"
                  ? "Most Services"
                  : "A → Z"}
            </button>
          ))}
        </div>
        {query && (
          <span className="search-result-count">
            {resultCount} of {totalCount} agents
          </span>
        )}
      </div>
    </div>
  );
}
