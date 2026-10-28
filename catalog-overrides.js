/*
  Correcciones de idioma y colección visibles en todos los dispositivos.
  Google Sheets sigue intacto. La edición compartida es pública.
*/
(function () {
  "use strict";
  const URL_BASE = "https://cnivcnexsqobipvqxero.supabase.co";
  const KEY = "sb_publishable_6UjwLuM-op0-OBKWlbusTw_qmLNZVfU";
  const TABLE = "pokemon_card_overrides";
  let overrides = new Map();
  let lastLoaded = 0;
  let lastError = "";
  const subscribers = new Set();

  function emit() {
    for (const cb of subscribers) {
      try { cb(); } catch (_) {}
    }
  }
  function listen(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }
  async function fetchOverrides(force = false) {
    if (!force && Date.now() - lastLoaded < 20000) return overrides;
    const response = await fetch(URL_BASE + "/rest/v1/" + TABLE + "?select=card_id,set_name,language,validation_note", {
      headers: { apikey: KEY, Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) {
      lastError = "Error de lectura de las correcciones (HTTP " + response.status + ")";
      emit();
      return overrides;
    }
    const data = await response.json();
    overrides = new Map(data.map(row => [Number(row.card_id), row]));
    lastLoaded = Date.now();
    lastError = "";
    emit();
    return overrides;
  }
  function apply(records) {
    return records.map(record => {
      const current = overrides.get(Number(record.id));
      return current ? {
        ...record,
        set: current.set_name || record.set,
        language: current.language || record.language,
        adminNote: current.validation_note || "",
        manuallyReviewed: true
      } : {...record};
    });
  }
  function get(card) {
    return overrides.get(Number(card.id)) || null;
  }
  async function save(card, values) {
    const set = String(values.set || "").trim();
    const lang = String(values.language || "").trim();
    const note = String(values.validation_note || "").trim();
    if (!set && !lang) throw Error("Indica al menos la colección o el idioma.");
    if (set.length > 140 || note.length > 500) throw Error("El texto supera el límite permitido.");
    const payload = {
      card_id: Number(card.id),
      set_name: set || null,
      language: lang || null,
      validation_note: note || null,
      updated_at: new Date().toISOString(),
      updated_by: null
    };
    const response = await fetch(URL_BASE + "/rest/v1/" + TABLE + "?on_conflict=card_id", {
      method: "POST",
      headers: {
        apikey: KEY,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      throw Error(json.message || "No se pudo guardar la corrección.");
    }
    overrides.set(Number(card.id), payload);
    emit();
    return payload;
  }
  async function remove(card) {
    const response = await fetch(URL_BASE + "/rest/v1/" + TABLE + "?card_id=eq." + encodeURIComponent(String(card.id)), {
      method: "DELETE",
      headers: { apikey: KEY }
    });
    if (!response.ok) throw Error("No se pudo restaurar la ficha del inventario.");
    overrides.delete(Number(card.id));
    emit();
  }
  window.CatalogOverrides = { fetchOverrides, apply, get, save, remove, listen, getError: () => lastError };
})();
