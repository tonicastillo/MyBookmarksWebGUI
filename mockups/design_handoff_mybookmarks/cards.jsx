// Components for MyBookmarks dashboard

const { useState, useMemo, useEffect, useRef, useCallback } = React;

// ── Icons ──────────────────────────────────────────────────
const Icon = {
  search: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
    </svg>
  ),
  edit: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/>
    </svg>
  ),
  refresh: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>
    </svg>
  ),
  tag: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/>
      <path d="M7 7h.01"/>
    </svg>
  ),
  star: (s = 12, fill = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01Z"/>
    </svg>
  ),
  arrow: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>
  ),
  moon: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>
    </svg>
  ),
};

// ── Card thumbnail ────────────────────────────────────────
function Thumb({ logo, color, mono, size }) {
  const cls = "card-thumb" + (mono ? " mono" : "");
  return (
    <div className={cls} style={{ "--c": color, ...(size ? { width: size, height: size, fontSize: size * 0.32 } : {}) }}>
      <span className="card-thumb-text">{logo}</span>
    </div>
  );
}

// ── Bookmark card ─────────────────────────────────────────
function BookmarkCard({ bm, showTags, showRating }) {
  const [q, setQ] = useState("");
  const onSearch = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!q.trim() || !bm.search) return;
    const url = bm.search.urlTemplate.replace("{q}", encodeURIComponent(q.trim()));
    window.open(url, "_blank", "noopener");
  };

  return (
    <a className={"card" + (bm.color == null ? " no-color" : "")} href={bm.url} target="_blank" rel="noopener noreferrer"
       style={{ "--c": bm.color ?? 0 }}>
      {bm.favorite && <span className="card-fav">{Icon.star(14, "oklch(0.75 0.13 75)")}</span>}
      <Thumb logo={bm.logo} color={bm.color} mono={bm.logoStyle === "mono"} />
      <div className="card-body">
        <div className="card-title">{bm.title}</div>
        {bm.subtitle && <div className="card-sub">{bm.subtitle}</div>}
        {showRating && bm.rating > 0 && (
          <div className="card-rating">
            {Array.from({ length: 5 }, (_, i) =>
              <span key={i}>{Icon.star(10, i < bm.rating ? "currentColor" : "transparent")}</span>
            )}
          </div>
        )}
        {showTags && bm.tags && bm.tags.length > 0 && (
          <div className="card-tags">
            {bm.tags.slice(0, 3).map(t => <span key={t} className="card-tag">{t}</span>)}
          </div>
        )}
        {bm.search && (
          <form className="card-search" onSubmit={onSearch} onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              placeholder={bm.search.placeholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            />
            <button type="submit" aria-label="Search">{Icon.search(12)}</button>
          </form>
        )}
      </div>
      <button className="card-edit" aria-label="Edit"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        {Icon.edit(13)}
      </button>
    </a>
  );
}

// ── Mega card (parent + children) ─────────────────────────
function MegaCard({ parent, children, showTags }) {
  const [q, setQ] = useState("");
  const onSearch = (e) => {
    e.preventDefault();
    if (!q.trim() || !parent.search) return;
    const url = parent.search.urlTemplate.replace("{q}", encodeURIComponent(q.trim()));
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="megacard" style={{ "--c": parent.color }}>
      <div className="megacard-head">
        <Thumb logo={parent.logo} color={parent.color} />
        <div className="megacard-title-block">
          <div className="megacard-title">{parent.title}</div>
          <div className="megacard-sub">{parent.subtitle}</div>
        </div>
        <span className="megacard-badge">{children.length} sites</span>
        <button className="card-edit" onClick={(e) => e.preventDefault()}>
          {Icon.edit(13)}
        </button>
      </div>

      {parent.search && (
        <form className="megacard-search" onSubmit={onSearch}>
          <input
            type="text"
            placeholder={parent.search.placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit">{Icon.search(12)} Search</button>
        </form>
      )}

      <div className="megacard-children">
        {children.map(c => <MiniCard key={c.id} bm={c} />)}
      </div>
    </div>
  );
}

function MiniCard({ bm }) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(false);
  const onSearch = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!q.trim() || !bm.search) return;
    const url = bm.search.urlTemplate.replace("{q}", encodeURIComponent(q.trim()));
    window.open(url, "_blank", "noopener");
  };

  if (bm.search) {
    return (
      <div className={"minicard has-search" + (expanded ? " expanded" : "") + (bm.color == null ? " no-color" : "")} style={{ "--c": bm.color ?? 0 }}>
        <a className="minicard-row" href={bm.url} target="_blank" rel="noopener noreferrer"
           style={{ textDecoration: "none", color: "inherit" }}>
          <div className="minicard-thumb" style={{ "--c": bm.color }}>{bm.logo}</div>
          <div className="minicard-body">
            <div className="minicard-title">{bm.title}</div>
            <div className="minicard-sub">{bm.subtitle}</div>
          </div>
          <button className="minicard-edit" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            {Icon.edit(11)}
          </button>
        </a>
        <form className="card-search" onSubmit={onSearch}>
          <input
            type="text"
            placeholder={bm.search.placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit" aria-label="Search">{Icon.search(11)}</button>
        </form>
      </div>
    );
  }

  return (
    <a className={"minicard" + (bm.color == null ? " no-color" : "")} href={bm.url} target="_blank" rel="noopener noreferrer"
       style={{ "--c": bm.color ?? 0 }}>
      <div className="minicard-thumb" style={{ "--c": bm.color }}>{bm.logo}</div>
      <div className="minicard-body">
        <div className="minicard-title">{bm.title}</div>
        <div className="minicard-sub">{bm.subtitle}</div>
      </div>
      <button className="minicard-edit"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        {Icon.edit(11)}
      </button>
    </a>
  );
}

Object.assign(window, { Icon, Thumb, BookmarkCard, MegaCard, MiniCard });
