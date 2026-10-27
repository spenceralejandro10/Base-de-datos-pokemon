(function () {
  "use strict";
  const cards = window.CARDS || [];
  const byId = id => document.getElementById(id);
  const q = byId("q"), setFilter = byId("set"), langFilter = byId("lang");
  const view = byId("view"), results = byId("results");
  const statTotal = byId("total"), statCopies = byId("copies"), statShown = byId("shown");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let generation = 0;
  statTotal.textContent = cards.length;
  statCopies.textContent = cards.reduce((n, c) => n + (Number(c.quantity) || 0), 0).toLocaleString("es-CO");

  for (const [control, field] of [[setFilter, "set"], [langFilter, "language"]]) {
    [...new Set(cards.map(c => c[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")).forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      control.append(option);
    });
  }

  function searchUrl(card) {
    const query = ["pokemon tcg", card.name, card.number, card.set, card.language].filter(Boolean).join(" ");
    return "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(query);
  }

  function makeImageButton(card) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "image-button";
    button.textContent = "Asignar imagen";
    button.title = "Guardar una imagen para esta carta únicamente en este navegador";
    button.addEventListener("click", () => {
      const url = prompt("Pega la dirección HTTPS de la imagen exacta de " + card.name + " (" + card.number + "). Se guardará solo en este navegador.\nDeja el campo vacío para quitar una imagen asignada.", "");
      if (url === null) return;
      try {
        window.CardImages.setManual(card, url);
        render();
      } catch (error) {
        alert(error.message || "Dirección no válida");
      }
    });
    return button;
  }

  function loadImage(url) {
    return new Promise(resolve => {
      const photo = new Image();
      photo.onload = () => resolve(true);
      photo.onerror = () => resolve(false);
      photo.src = url;
    });
  }

  async function placeImage(card, img, placeholder, status, small, token) {
    try {
      const result = await window.CardImages.resolve(card);
      if (token !== generation || !img.isConnected) return;
      if (result.images && result.images.length) {
        for (const url of result.images) {
          if (!url) continue;
          if (await loadImage(url)) {
            if (token !== generation || !img.isConnected) return;
            img.src = url;
            img.alt = "Carta Pokémon " + card.name + ", número " + card.number;
            img.hidden = false;
            if (placeholder) placeholder.hidden = true;
            if (status) {
              status.textContent = result.status === "manual" ? "Imagen personalizada" : (card.language === "Español" && result.reason.includes("inglés") ? "Referencia en inglés" : "Imagen identificada");
              status.classList.add("found");
            }
            return;
          }
        }
      }
      if (status) {
        status.textContent = result.images?.length ? "Imagen no disponible en el servidor" : result.reason;
        status.title = result.reason || "";
      }
      if (placeholder) placeholder.innerHTML = '<span class="empty-symbol">◈</span><span>Imagen pendiente</span>';
    } catch (_) {
      if (status) status.textContent = "No se pudo cargar la imagen";
    }
  }

  function galleryCard(card, token) {
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = '<div class="art"><div class="placeholder"><span class="loader"></span><span>Buscando carta…</span></div><img hidden loading="lazy"><span class="pill">×' + esc(card.quantity) + '</span></div><div class="details"><h3>' + esc(card.name) + '</h3><div class="num">' + esc(card.number) + '</div><div class="meta">' + esc(card.set || "Colección no indicada") + ' · ' + esc(card.language || "Sin idioma") + '<br>' + esc(card.year || "Año no indicado") + '</div><div class="image-status">Buscando en catálogos…</div><div class="links"><a target="_blank" rel="noopener noreferrer" href="' + searchUrl(card) + '">Buscar carta</a></div></div>';
    item.querySelector(".links").append(makeImageButton(card));
    const art = item.querySelector(".art");
    placeImage(card, art.querySelector("img"), art.querySelector(".placeholder"), item.querySelector(".image-status"), false, token);
    return item;
  }

  function tableView(filtered, token) {
    const host = document.createElement("div");
    host.className = "table-scroll";
    const table = document.createElement("table");
    table.className = "data-table";
    table.innerHTML = "<thead><tr>" + ["Imagen", "#", "Nombre", "Número", "Colección", "Año", "Idioma", "Cantidad"].map(x => "<th>" + x + "</th>").join("") + "</tr></thead>";
    const tbody = document.createElement("tbody");
    for (const c of filtered) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td class="thumbnail"><div class="mini-art"><img hidden loading="lazy"><span>—</span></div></td>' + [c.ordinal, c.name, c.number, c.set, c.year, c.language, c.quantity].map((x, i) => '<td' + (i === 2 ? ' class="num-col"' : "") + '>' + esc(x) + '</td>').join("");
      const mini = tr.querySelector(".mini-art");
      placeImage(c, mini.querySelector("img"), mini.querySelector("span"), null, true, token);
      tbody.append(tr);
    }
    table.append(tbody);
    host.append(table);
    return host;
  }

  function getFiltered() {
    const query = q.value.toLocaleLowerCase().trim();
    return cards.filter(c =>
      (!setFilter.value || c.set === setFilter.value) &&
      (!langFilter.value || c.language === langFilter.value) &&
      [c.name, c.number, c.set, c.language, c.year, c.ordinal].join(" ").toLocaleLowerCase().includes(query));
  }

  function render() {
    generation++;
    const token = generation;
    const filtered = getFiltered();
    statShown.textContent = filtered.length;
    results.innerHTML = "";
    results.className = view.value === "table" ? "table-container" : "grid";
    if (!filtered.length) {
      results.innerHTML = '<div class="no-results">No hay cartas que coincidan con la búsqueda.</div>';
      return;
    }
    if (view.value === "table") {
      results.append(tableView(filtered, token));
    } else {
      const fragment = document.createDocumentFragment();
      filtered.forEach(card => fragment.append(galleryCard(card, token)));
      results.append(fragment);
    }
  }

  [q, setFilter, langFilter, view].forEach(control => control.addEventListener("input", render));
  render();
})();