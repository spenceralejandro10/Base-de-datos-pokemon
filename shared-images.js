/*
  Galería Pokémon: imágenes compartidas y acceso del editor.
  Supabase publishable key es público por diseño; la autorización real vive
  en las políticas RLS de la base de datos, nunca en el navegador.
*/
(function () {
  "use strict";
  const URL_BASE = "https://cnivcnexsqobipvqxero.supabase.co";
  const KEY = "sb_publishable_6UjwLuM-op0-OBKWlbusTw_qmLNZVfU";
  const TABLE = "pokemon_image_overrides";
  const BUCKET = "pokemon-gallery-overrides";
  const SESSION_NAME = "pokemon-gallery-owner-session-v1";
  let session = null;
  let rows = new Map();
  let imagesById = new Map();
  let lastError = "";
  let lastLoaded = 0;
  const watchers = new Set();
  const authHeaders = () => ({ apikey: KEY, "Content-Type": "application/json" });
  function imageKey(card) {
    const clean = text => String(text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    // La imagen mantiene su identidad aunque el administrador cambie idioma o colección.
    const original = (window.CARDS || []).find(item => Number(item.id) === Number(card.id)) || card;
    return [original.id, clean(original.name), clean(original.number), clean(original.set), clean(original.language)].join("|");
  }
  function updateWatchers() {
    for (const callback of watchers) {
      try { callback(); } catch (_) {}
    }
  }
  async function loadShared(force = false) {
    if (!force && Date.now() - lastLoaded < 25000) return rows;
    const response = await fetch(URL_BASE + "/rest/v1/" + TABLE + "?select=card_key,image_url,updated_at&order=updated_at.desc", {
      headers: { apikey: KEY, Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) {
      lastError = "No se puede consultar el catálogo compartido (HTTP " + response.status + ").";
      updateWatchers();
      return rows;
    }
    const json = await response.json();
    const valid = json.filter(x => x.card_key && x.image_url);
    rows = new Map(valid.map(x => [x.card_key, x.image_url]));
    // También identificar la foto por ID inmutable: una corrección del Excel
    // (colección, nombre o idioma) nunca debe hacer desaparecer la imagen manual.
    imagesById = new Map();
    for (const item of valid) {
      const cardId = Number(String(item.card_key).split("|")[0]);
      if (Number.isInteger(cardId) && !imagesById.has(cardId)) {
        imagesById.set(cardId, item.image_url);
      }
    }
    lastLoaded = Date.now();
    lastError = "";
    updateWatchers();
    return rows;
  }
  function getShared(card) {
    return rows.get(imageKey(card)) || imagesById.get(Number(card.id)) || null;
  }
  // Catálogo central: lectura pública en Supabase; cards.js sigue como respaldo sin conexión.
  async function loadCatalog() {
    const url = URL_BASE + "/rest/v1/pokemon_catalog?select=id,ordinal,name,card_number,set_name,release_year,language,quantity&order=id.asc";
    const response = await fetch(url, {
      headers: { apikey: KEY, Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw Error("No se pudo consultar la base de datos del catálogo.");
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) throw Error("El catálogo central no tiene registros.");
    const cards = data.map(row => ({
      id: Number(row.id),
      ordinal: String(row.ordinal ?? ""),
      name: String(row.name ?? ""),
      number: String(row.card_number ?? ""),
      set: String(row.set_name ?? ""),
      year: String(row.release_year ?? ""),
      language: String(row.language ?? ""),
      quantity: Number(row.quantity)
    }));
    if (cards.some(c => !Number.isInteger(c.id) || c.id < 1 || !c.name ||
      !Number.isInteger(c.quantity) || c.quantity < 0) ||
      new Set(cards.map(c => c.id)).size !== cards.length) {
      throw Error("El catálogo central contiene registros no válidos.");
    }
    return cards;
  }
  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_NAME) || "null"); }
    catch (_) { return null; }
  }
  function saveSession(value) {
    session = value;
    if (value) localStorage.setItem(SESSION_NAME, JSON.stringify(value));
    else localStorage.removeItem(SESSION_NAME);
    updateWatchers();
  }
  function getSession() {
    return session;
  }
  function isLoggedIn() {
    return !!(session && session.access_token && session.user?.id);
  }
  async function refreshSession() {
    if (!session?.refresh_token) return false;
    const response = await fetch(URL_BASE + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    if (!response.ok) {
      saveSession(null);
      return false;
    }
    const updated = await response.json();
    saveSession(updated);
    return true;
  }
  async function accessToken() {
    if (!session) throw Error("Debes iniciar sesión para guardar cambios.");
    if (session.expires_at && Date.now() / 1000 > session.expires_at - 100) {
      if (!await refreshSession()) throw Error("Tu sesión caducó; entra de nuevo.");
    }
    return session.access_token;
  }
  async function init() {
    session = readSession();
    const params = new URLSearchParams(location.hash.startsWith("#") ? location.hash.slice(1) : "");
    if (params.get("access_token") && params.get("refresh_token")) {
      const token = {
        access_token: params.get("access_token"),
        refresh_token: params.get("refresh_token"),
        token_type: params.get("token_type") || "bearer",
        expires_at: Number(params.get("expires_at") || (Date.now() / 1000 + Number(params.get("expires_in") || 3600)))
      };
      const who = await fetch(URL_BASE + "/auth/v1/user", { headers: { apikey: KEY, Authorization: "Bearer " + token.access_token } });
      if (who.ok) {
        token.user = await who.json();
        saveSession(token);
      }
      history.replaceState(null, "", location.pathname + location.search);
    }
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("token_hash") && searchParams.get("type")) {
      try {
        const verified = await verifyOneTime({ token_hash: searchParams.get("token_hash"), type: searchParams.get("type") });
        if (verified?.access_token) saveSession(verified);
      } finally {
        history.replaceState(null, "", location.pathname + "?admin=1");
      }
    }
    if (session?.access_token && !session.user) {
      const who = await fetch(URL_BASE + "/auth/v1/user", { headers: { apikey: KEY, Authorization: "Bearer " + session.access_token } });
      if (who.ok) { session.user = await who.json(); saveSession(session); }
    }
    await loadShared(true);
  }

  const ADMIN_ALIAS = "custodio";
  const ADMIN_EMAIL = "spenceralejandro10@gmail.com";
  function ownerEmail(username) {
    if (String(username || "").trim().toLowerCase() !== ADMIN_ALIAS) {
      throw Error("Usuario o contraseña incorrectos.");
    }
    return ADMIN_EMAIL;
  }
  async function passwordLogin(username, password) {
    const email = ownerEmail(username);
    if (!password || typeof password !== "string") throw Error("Introduce tu contraseña.");
    const response = await fetch(URL_BASE + "/auth/v1/token?grant_type=password", {
      method:"POST",headers:authHeaders(),
      body:JSON.stringify({email,password})
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok || !data.access_token) throw Error("Usuario o contraseña incorrectos.");
    if (String(data.user?.email||"").toLowerCase() !== ADMIN_EMAIL) throw Error("Cuenta no autorizada.");
    saveSession(data);
    return true;
  }
  async function setPassword(nextPassword) {
    if (!session?.access_token) throw Error("Primero verifica tu identidad mediante el correo.");
    if (typeof nextPassword !== "string" || nextPassword.length < 12 || nextPassword.length > 128) {
      throw Error("La contraseña debe tener entre 12 y 128 caracteres.");
    }
    const token = await accessToken();
    const res = await fetch(URL_BASE + "/auth/v1/user",{
      method:"PUT",
      headers:{...authHeaders(),Authorization:"Bearer "+token},
      body:JSON.stringify({password:nextPassword})
    });
    if(!res.ok){
      const result=await res.json().catch(()=>({}));
      throw Error(result.msg||result.message||result.error_description||"No se pudo establecer la contraseña.");
    }
    return true;
  }

  async function requestLogin(email) {
    const addr = ownerEmail(email);
    // Al volver del enlace de verificación, abrir directamente el panel privado.
    const redirect = location.origin + location.pathname + "?admin=1";
    const response = await fetch(URL_BASE + "/auth/v1/otp?redirect_to=" + encodeURIComponent(redirect), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email: addr, create_user: true })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw Error(data.msg || data.message || data.error_description || "No se pudo enviar el enlace de acceso.");
    }
    return true;
  }
  async function verifyOneTime(payload) {
    const response = await fetch(URL_BASE + "/auth/v1/verify", {
      method: "POST", headers: authHeaders(), body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.msg || data.message || data.error_description || "Código de acceso incorrecto.");
    return data;
  }
  async function verifyCode(email, token) {
    const data = await verifyOneTime({ email: ownerEmail(email), token: String(token || "").trim(), type: "email" });
    saveSession(data);
    return true;
  }
  async function logout() {
    if (session?.access_token) {
      await fetch(URL_BASE + "/auth/v1/logout", {
        method: "POST", headers: { ...authHeaders(), Authorization: "Bearer " + session.access_token }
      }).catch(() => {});
    }
    saveSession(null);
  }
  async function updateImage(card, imageUrl) {
    const url = String(imageUrl || "").trim();
    if (!url || url.length > 2048) throw Error("Ingresa una URL HTTPS válida.");
    let parsed;
    try { parsed = new URL(url); } catch (_) { throw Error("La URL no es válida."); }
    if (parsed.protocol !== "https:") throw Error("Las imágenes deben usar HTTPS.");
    const token = await accessToken();
    const payload = {
      card_key: imageKey(card), image_url: url, image_source: "manual",
      updated_by: session.user.id, updated_at: new Date().toISOString()
    };
    const response = await fetch(URL_BASE + "/rest/v1/" + TABLE + "?on_conflict=card_key", {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + token, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw Error(response.status === 403 || response.status === 401
        ? "Solo el propietario verificado puede asignar imágenes. Inicia sesión con su correo."
        : (data.message || "No se pudo guardar la imagen en la base de datos."));
    }
    rows.set(imageKey(card), url);
    updateWatchers();
    return url;
  }
  async function removeImage(card) {
    const token = await accessToken();
    const response = await fetch(URL_BASE + "/rest/v1/" + TABLE + "?card_key=eq." + encodeURIComponent(imageKey(card)), {
      method: "DELETE", headers: { apikey: KEY, Authorization: "Bearer " + token }
    });
    if (!response.ok) throw Error("No se pudo quitar la imagen compartida.");
    rows.delete(imageKey(card));
    updateWatchers();
  }
  async function uploadImage(card, file) {
    if (!file || !["image/png","image/jpeg","image/webp"].includes(file.type)) throw Error("Selecciona una imagen JPG, PNG o WebP.");
    if (file.size > 6291456) throw Error("Tamaño máximo: 6 MB.");
    const token = await accessToken();
    const name = crypto.randomUUID() + "." + (file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg");
    const path = "cards/" + name;
    const res = await fetch(URL_BASE + "/storage/v1/object/" + BUCKET + "/" + path, {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + token, "Content-Type": file.type, "cache-control": "3600", "x-upsert": "false" },
      body: file
    });
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      throw Error(result.message || "La fotografía no se pudo subir.");
    }
    const address = URL_BASE + "/storage/v1/object/public/" + BUCKET + "/" + path;
    try {
      await updateImage(card, address);
    } catch (error) {
      throw Error("Se subió el archivo, pero no se pudo asociar con la carta: " + error.message);
    }
    return address;
  }
  function subscribe(callback) {
    watchers.add(callback);
    return () => watchers.delete(callback);
  }
  window.SharedImages = {
    init, loadShared, loadCatalog, getShared, imageKey,
    isLoggedIn, getSession, accessToken, requestLogin, verifyCode, passwordLogin, setPassword,
    logout, updateImage, removeImage, uploadImage,
    subscribe, getError: () => lastError
  };
})();
