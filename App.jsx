import { useEffect, useMemo, useState } from "react";

const API_KEY = import.meta.env.VITE_GIPHY_API_KEY;
const INITIAL_CATEGORIES = ["dragon ball", "valorant", "one punch"];

function getGifUrl(gif) {
  return gif?.images?.fixed_width?.url ||
    gif?.images?.downsized_medium?.url ||
    gif?.images?.original?.url || "";
}

function GifCard({ gif }) {
  const [copied, setCopied] = useState(false);
  const url = getGifUrl(gif);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(gif.url || url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      window.prompt("Copia el enlace del GIF:", gif.url || url);
    }
  }

  return (
    <article className="gif-card">
      <a href={gif.url || url} target="_blank" rel="noreferrer" title="Abrir GIF en GIPHY">
        <img src={url} alt={gif.title || "GIF animado"} loading="lazy" />
      </a>
      <div className="gif-card-footer">
        <span title={gif.title}>{gif.title || "GIF"}</span>
        <button onClick={copyLink} className="copy-button">
          {copied ? "¡Copiado!" : "Copiar enlace"}
        </button>
      </div>
    </article>
  );
}

function CategorySection({ title, gifs, loading, error, onRemove }) {
  return (
    <section className="category-section">
      <div className="section-heading">
        <h2>{title}</h2>
        <button className="remove-category" onClick={() => onRemove(title)} aria-label={`Eliminar ${title}`}>
          ×
        </button>
      </div>

      {loading && <p className="status">Cargando GIFs...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && gifs.length === 0 && <p className="status">No se encontraron GIFs.</p>}

      <div className="gif-grid">
        {gifs.map((gif) => <GifCard key={gif.id} gif={gif} />)}
      </div>
    </section>
  );
}

export default function App() {
  const [categories, setCategories] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("gif-categories"));
      return Array.isArray(saved) && saved.length ? saved : INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  });
  const [categoryData, setCategoryData] = useState({});
  const [searchText, setSearchText] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [adding, setAdding] = useState(false);
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    localStorage.setItem("gif-categories", JSON.stringify(categories));
  }, [categories]);

  async function loadGifs(term, signal) {
    if (!API_KEY || API_KEY === "PEGA_AQUI_TU_API_KEY") {
      throw new Error("Falta configurar la API Key de GIPHY. Revisa el archivo .env.example y sigue el README.");
    }
    const params = new URLSearchParams({
      api_key: API_KEY,
      q: term,
      limit: "5",
      rating: "g",
      lang: "es"
    });
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`, { signal });
    if (!response.ok) throw new Error(`GIPHY respondió con el error ${response.status}.`);
    const json = await response.json();
    return json.data || [];
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadAll() {
      setGlobalError("");
      setCategoryData((previous) => {
        const next = { ...previous };
        categories.forEach((category) => {
          next[category] = { ...(next[category] || {}), loading: true, error: "" };
        });
        return next;
      });

      await Promise.all(categories.map(async (category) => {
        try {
          const gifs = await loadGifs(category, controller.signal);
          if (active) setCategoryData((previous) => ({
            ...previous,
            [category]: { gifs, loading: false, error: "" }
          }));
        } catch (error) {
          if (error.name === "AbortError") return;
          if (active) setCategoryData((previous) => ({
            ...previous,
            [category]: { gifs: [], loading: false, error: error.message }
          }));
        }
      }));
    }

    if (categories.length) loadAll();
    return () => {
      active = false;
      controller.abort();
    };
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((category) => category.toLowerCase().includes(query));
  }, [categories, searchText]);

  function addCategory(event) {
    event.preventDefault();
    const value = newCategory.trim().toLowerCase();
    if (!value) return;
    if (categories.some((item) => item.toLowerCase() === value)) {
      setGlobalError("Esa categoría ya existe.");
      return;
    }
    setGlobalError("");
    setCategories((previous) => [value, ...previous]);
    setNewCategory("");
    setAdding(false);
  }

  function removeCategory(category) {
    setCategories((previous) => previous.filter((item) => item !== category));
    setCategoryData((previous) => {
      const next = { ...previous };
      delete next[category];
      return next;
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">GIF</span>
          <div>
            <h1>App de GIFs</h1>
            <p>Encuentra y organiza tus GIFs favoritos</p>
          </div>
        </div>
        <button className="add-button" onClick={() => setAdding((value) => !value)}>
          <span>＋</span> Nueva categoría
        </button>
      </header>

      {adding && (
        <form className="add-form" onSubmit={addCategory}>
          <input
            autoFocus
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder="Ej.: gatos, fútbol, Naruto..."
            aria-label="Nombre de la nueva categoría"
          />
          <button type="submit">Agregar</button>
          <button type="button" className="cancel-button" onClick={() => setAdding(false)}>Cancelar</button>
        </form>
      )}

      <div className="search-area">
        <label htmlFor="search">Buscar categorías</label>
        <div className="search-box">
          <span>⌕</span>
          <input
            id="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Buscar una categoría..."
          />
          {searchText && <button onClick={() => setSearchText("")} aria-label="Limpiar búsqueda">×</button>}
        </div>
      </div>

      {globalError && <p className="error global-error">{globalError}</p>}

      {filteredCategories.length === 0 ? (
        <p className="empty-state">No hay categorías que coincidan con tu búsqueda.</p>
      ) : (
        filteredCategories.map((category) => (
          <CategorySection
            key={category}
            title={category}
            gifs={categoryData[category]?.gifs || []}
            loading={categoryData[category]?.loading ?? true}
            error={categoryData[category]?.error || ""}
            onRemove={removeCategory}
          />
        ))
      )}

      <footer>Proyecto educativo con React y la API de GIPHY.</footer>
    </main>
  );
}
