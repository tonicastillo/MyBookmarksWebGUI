// App shell — sidebar, search, tag panel, content sections

const { useState, useMemo, useEffect, useRef, useCallback } = window.React ? React : {};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "density": "regular",
  "showTags": true,
  "showRating": true,
  "showFavorites": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState("just now");

  // Apply theme
  useEffect(() => {
    document.documentElement.dataset.theme = t.dark ? "dark" : "light";
    document.documentElement.dataset.density = t.density;
  }, [t.dark, t.density]);

  // ── Resolve mega cards: group children under parent ──
  const { parents, childrenByParent, freeBookmarks } = useMemo(() => {
    const parents = {};
    const childrenByParent = {};
    BOOKMARKS.forEach(b => {
      if (b.isParent) parents[b.id] = b;
    });
    const free = [];
    BOOKMARKS.forEach(b => {
      if (b.isParent) return;
      if (b.group && parents[b.group]) {
        (childrenByParent[b.group] = childrenByParent[b.group] || []).push(b);
      } else {
        free.push(b);
      }
    });
    return { parents, childrenByParent, freeBookmarks: free };
  }, []);

  // ── Search & filter logic ──
  // A bookmark matches search if title/subtitle/url/tags match
  // For mega card: parent matches if it OR any of its children match
  const matchesSearch = useCallback((b, q) => {
    if (!q) return true;
    const ql = q.toLowerCase();
    const hay = [b.title, b.subtitle, b.url, ...(b.tags || [])]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(ql);
  }, []);

  const matchesTags = useCallback((b, tags) => {
    if (!tags.length) return true;
    return tags.every(t => (b.tags || []).includes(t));
  }, []);

  // Flatten all bookmarks (parents AND children AND free) for search/tag context
  const allItems = BOOKMARKS;

  const isFiltering = query.trim().length > 0 || selectedTags.length > 0;

  // ── Tag counts ──
  // When tags are selected, count = bookmarks that have ALL selected tags + this one
  // When no tags selected, count = bookmarks that have this tag
  // Search also narrows the universe
  const tagCounts = useMemo(() => {
    const universe = allItems.filter(b => matchesSearch(b, query));
    const counts = {};
    universe.forEach(b => {
      (b.tags || []).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; });
    });
    // If tags are selected, recompute counts as intersection-based
    if (selectedTags.length > 0) {
      const intersected = universe.filter(b => matchesTags(b, selectedTags));
      const interCounts = {};
      const allTagsUniverse = new Set();
      universe.forEach(b => (b.tags || []).forEach(t => allTagsUniverse.add(t)));
      allTagsUniverse.forEach(tag => {
        if (selectedTags.includes(tag)) {
          // count = items matching all OTHER selected tags
          const others = selectedTags.filter(t => t !== tag);
          interCounts[tag] = universe.filter(b => matchesTags(b, [...others, tag])).length;
        } else {
          interCounts[tag] = universe.filter(b => matchesTags(b, [...selectedTags, tag])).length;
        }
      });
      return interCounts;
    }
    return counts;
  }, [allItems, query, selectedTags, matchesSearch, matchesTags]);

  const allTags = useMemo(() => {
    const set = new Set();
    allItems.forEach(b => (b.tags || []).forEach(t => set.add(t)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allItems]);

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(x => x !== tag) : [...prev, tag]);
  };

  const clearFilters = () => { setQuery(""); setSelectedTags([]); };

  // ── Refresh ──
  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setLastSync("just now");
    }, 700);
  };

  // ── Build the rendered structure ──
  // Filtering mode: flat grid, no categories. Show parents whose self/children match,
  // plus free bookmarks that match.
  // Browsing mode: grouped by category with mega cards.
  const filteredFlat = useMemo(() => {
    if (!isFiltering) return null;
    const out = [];
    // Parents that match (self or any child)
    Object.values(parents).forEach(p => {
      const kids = (childrenByParent[p.id] || []);
      const parentSelfMatch = matchesSearch(p, query) && matchesTags(p, selectedTags);
      const matchingKids = kids.filter(k => matchesSearch(k, query) && matchesTags(k, selectedTags));
      if (parentSelfMatch || matchingKids.length > 0) {
        out.push({ kind: "mega", parent: p, kids: matchingKids.length > 0 ? matchingKids : kids });
      }
    });
    // Free bookmarks
    freeBookmarks.forEach(b => {
      if (matchesSearch(b, query) && matchesTags(b, selectedTags)) {
        out.push({ kind: "single", bm: b });
      }
    });
    return out;
  }, [isFiltering, parents, childrenByParent, freeBookmarks, query, selectedTags, matchesSearch, matchesTags]);

  // Category grouping for browsing mode
  const grouped = useMemo(() => {
    if (isFiltering) return null;
    const byCat = {};
    Object.values(parents).forEach(p => {
      const kids = childrenByParent[p.id] || [];
      (byCat[p.category] = byCat[p.category] || []).push({ kind: "mega", parent: p, kids });
    });
    freeBookmarks.forEach(b => {
      (byCat[b.category] = byCat[b.category] || []).push({ kind: "single", bm: b });
    });
    return byCat;
  }, [isFiltering, parents, childrenByParent, freeBookmarks]);

  const totalResults = isFiltering ? filteredFlat.length : null;

  // ── Scroll spy for active category ──
  const sectionsRef = useRef({});
  useEffect(() => {
    if (isFiltering) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible.length) setActiveCat(visible[0].target.dataset.cat);
    }, { rootMargin: "-80px 0px -60% 0px", threshold: [0, 0.25, 0.5] });
    Object.values(sectionsRef.current).forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, [isFiltering, grouped]);

  const scrollToCat = (catId) => {
    const el = sectionsRef.current[catId];
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 60;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  // Counts per category
  const catCounts = useMemo(() => {
    const counts = {};
    CATEGORIES.forEach(c => {
      const items = (grouped && grouped[c.id]) || [];
      counts[c.id] = items.reduce((acc, x) => acc + (x.kind === "mega" ? 1 + x.kids.length : 1), 0);
    });
    return counts;
  }, [grouped]);

  const catColor = (hue) => `oklch(0.55 0.15 ${hue})`;
  const catTint = (hue) => `oklch(0.92 0.07 ${hue})`;

  return (
    <div className="app">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">M</div>
          <span>MyBookmarks</span>
        </div>

        <div className="sidebar-section">Categories</div>
        {CATEGORIES.map(c => {
          if (!catCounts[c.id]) return null;
          return (
            <div key={c.id}
                 className={"cat-link" + (activeCat === c.id && !isFiltering ? " active" : "")}
                 onClick={() => scrollToCat(c.id)}
                 style={{ "--cat-color": catColor(c.hue), "--cat-tint": catTint(c.hue) }}>
              <span className="cat-dot"></span>
              <span>{c.name}</span>
              <span className="cat-count">{catCounts[c.id]}</span>
            </div>
          );
        })}

        <div style={{ flex: 1 }} />

        <div className="sidebar-section">View</div>
        <div className="cat-link" onClick={() => setTweak("dark", !t.dark)}>
          <span className="cat-icon">{Icon.moon(11)}</span>
          <span>{t.dark ? "Light mode" : "Dark mode"}</span>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────── */}
      <main className="main">
        {/* Topbar */}
        <div className="topbar">
          <div className="search">
            <span className="search-icon">{Icon.search(16)}</span>
            <input
              type="text"
              placeholder="Search bookmarks — title, URL, tags…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <span className="kbd"><span>⌘</span><span>K</span></span>
          </div>
          <button className={"btn" + (tagsOpen ? " active" : "") + (selectedTags.length ? " active" : "")}
                  onClick={() => setTagsOpen(o => !o)}>
            {Icon.tag(13)} Tags
            {selectedTags.length > 0 && <span className="badge">{selectedTags.length}</span>}
          </button>
          <button className={"btn btn-icon btn-spin" + (refreshing ? " spinning" : "")}
                  onClick={refresh} title="Sync from Notion" aria-label="Sync">
            {Icon.refresh(15)}
          </button>
          <span className="last-sync">Synced {lastSync}</span>
        </div>

        {/* Tags panel */}
        {tagsOpen && (
          <div className="tags-panel">
            <div className="tags-header">
              <h3>Tags · {allTags.length}</h3>
              {selectedTags.length > 0 && (
                <button onClick={() => setSelectedTags([])}>Clear ({selectedTags.length})</button>
              )}
            </div>
            <div className="tags-grid">
              {/* Compute tag levels by count quantiles */}
              {(() => {
                const counts = allTags.map(t => tagCounts[t] || 0).filter(n => n > 0);
                const max = Math.max(1, ...counts);
                const levelFor = (n) => {
                  if (n === 0) return 1;
                  const r = n / max;
                  if (r > 0.8) return 5;
                  if (r > 0.55) return 4;
                  if (r > 0.30) return 3;
                  if (r > 0.12) return 2;
                  return 1;
                };
                return allTags.map(tag => {
                  const count = tagCounts[tag] || 0;
                  const selected = selectedTags.includes(tag);
                  const disabled = count === 0 && !selected;
                  const lvl = levelFor(count);
                  return (
                    <button key={tag}
                            className={`tag lvl-${lvl}` + (selected ? " selected" : "") + (disabled ? " disabled" : "")}
                            onClick={() => toggleTag(tag)}
                            disabled={disabled}>
                      <span>{tag}</span>
                      <span className="tag-count">{count}</span>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Filtering result strip */}
        {isFiltering && (
          <div className="result-strip">
            <strong>{totalResults}</strong> result{totalResults !== 1 ? "s" : ""}
            {query && <span>for "<strong style={{ color: "var(--fg)" }}>{query}</strong>"</span>}
            {selectedTags.length > 0 && (
              <span>filtered by {selectedTags.map((t, i) => (
                <span key={t}>
                  <strong style={{ color: "var(--fg)" }}>{t}</strong>
                  {i < selectedTags.length - 1 && " + "}
                </span>
              ))}</span>
            )}
            <button className="clear" onClick={clearFilters}>Clear all</button>
          </div>
        )}

        {/* ── Filtering mode: flat grid ── */}
        {isFiltering && (
          <>
            {filteredFlat.length === 0 ? (
              <div className="empty">
                <h3>No matches</h3>
                <p>Try a different search term or remove some tags.</p>
              </div>
            ) : (
              <div className="cards">
                {filteredFlat.map((item, i) => item.kind === "mega" ? (
                  <MegaCard key={item.parent.id} parent={item.parent} children={item.kids} showTags={t.showTags} />
                ) : (
                  <BookmarkCard key={item.bm.id} bm={item.bm} showTags={t.showTags} showRating={t.showRating} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Browsing mode: grouped by category ── */}
        {!isFiltering && CATEGORIES.map(c => {
          const items = grouped[c.id];
          if (!items || !items.length) return null;
          const count = items.reduce((acc, x) => acc + (x.kind === "mega" ? 1 + x.kids.length : 1), 0);
          return (
            <section key={c.id}
                     className="cat-section"
                     data-screen-label={c.name}
                     data-cat={c.id}
                     ref={(el) => sectionsRef.current[c.id] = el}>
              <div className="cat-header" style={{ "--cat-color": catColor(c.hue) }}>
                <span className="cat-dot"></span>
                <h2>{c.name}</h2>
                <span className="count">{count}</span>
                <hr />
              </div>
              <div className="cards">
                {items.map(item => item.kind === "mega" ? (
                  <MegaCard key={item.parent.id} parent={item.parent} children={item.kids} showTags={t.showTags} />
                ) : (
                  <BookmarkCard key={item.bm.id} bm={item.bm} showTags={t.showTags} showRating={t.showRating} />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* Tweaks */}
      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density}
                    options={["compact", "regular", "comfy"]}
                    onChange={(v) => setTweak("density", v)} />
        <TweakSection label="Card details" />
        <TweakToggle label="Show tags" value={t.showTags} onChange={(v) => setTweak("showTags", v)} />
        <TweakToggle label="Show ratings" value={t.showRating} onChange={(v) => setTweak("showRating", v)} />
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
