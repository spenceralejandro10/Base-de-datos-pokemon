/* Shared pricing rules. No inventory, storage, network or DOM mutations. */
(function (root) {
  "use strict";
  const DAY = 86400000;
  const groups = Object.freeze({
    "30th celebration": [3,24722], "30th celebration classic collection": [3,24837],
    "journey together": [3,24073], "prismatic evolutions": [3,23821],
    "fusion strike": [3,2906], "brilliant stars": [3,2948],
    "brilliant stars trainer gallery": [3,3020], "stellar crown": [3,23537],
    "twilight masquerade": [3,23473], "temporal forces": [3,23381],
    "paldean fates": [3,23353], "paradox rift": [3,23286], "151": [3,23237],
    "obsidian flames": [3,23228], "paldea evolved": [3,23120],
    "scarlet violet promo": [3,22872], "scarlet violet": [3,22873],
    "crown zenith": [3,17688], "lost origin": [3,3118],
    "astral radiance": [3,3040], "astral radiance trainer gallery": [3,3068],
    "sword shield promo": [3,2545], "celebrations classic collection": [3,2931],
    "evolving skies": [3,2848], "pokemon card 151": [85,23599],
    "scarlet ex": [85,23605], "violet ex": [85,23606], "crimson haze": [85,23602],
    "shiny treasure ex": [85,23601], "future flash": [85,23611],
    "ruler of the black flame": [85,23609], "special deck set ex svg": [85,23812]
  });
  const names = Object.freeze({
    "energia fuego basica": "basic fire energy", "arbol colosal": "grand tree",
    "ondulagua ex": "walking wake ex", "estudiante de paldea": "paldean student",
    "cloe": "raifort", "aroa": "lacey", "e nigma": "iono",
    "ferrocuello": "iron jugulis", "furioseta": "brute bonnet",
    "recinto del festival": "festival grounds", "tambores del despertar": "awakening drum",
    "colmilargo ex": "great tusk ex", "cinturon colosal": "maximum belt",
    "vasija terrestre": "earthen vessel", "capturador contraataque": "counter catcher",
    "ferropaladin ex": "iron valiant ex", "doble energia turbo": "double turbo energy",
    "calyrex jinete espectral vmax": "shadow rider calyrex vmax",
    "calyrex jinete glacial vmax": "ice rider calyrex vmax"
  });
  // Explicit owner prices stay separate from market quotations.
  const ownerPrices = Object.freeze([
    {id:274,name:"Boltund VMAX",number:"267/264",set:"Fusion Strike",usd:8},
    {id:294,name:"Alcremie",number:"TG08/TG30",set:"Brilliant Stars Trainer Gallery",usd:5},
    {id:55,name:"Estudiante de Paldea",number:"065/165",set:"Paldean Fates",usd:4}
  ]);
  // Referencias TCGplayer facilitadas por el propietario.
  // Este registro independiente sobrevive a la regeneración diaria de market-snapshot.json.
  const linkedTCGPrices = Object.freeze({
    455: {name:"Glimmora ex",number:"213/197",
      set:"Obsidian Flames",tcgId:509962,usd:0.81,
      updatedAt:"2026-11-13T20:03:03.000Z",group:"3-23228"},
    408: {name:"Zapdos ex",number:"145/165",
      set:"Pokémon Card 151",tcgId:516708,usd:1.31,
      updatedAt:"2026-11-13T00:00:00.000Z",group:"3-23237"},
    409: {name:"Arbok ex",number:"024/165",
      set:"Pokémon Card 151",tcgId:515956,usd:1.68,
      updatedAt:"2026-11-13T00:00:00.000Z",group:"3-23237"},
    412: {name:"Golem ex",number:"076/165",
      set:"Pokémon Card 151",tcgId:516574,usd:0.86,
      updatedAt:"2026-11-13T00:00:00.000Z",group:"3-23237"},
    413: {name:"Kangaskhan ex",number:"115/165",
      set:"Pokémon Card 151",tcgId:516581,usd:1.18,
      updatedAt:"2026-11-13T00:00:00.000Z",group:"3-23237"},
    414: {name:"Ninetales ex",number:"038/165",
      set:"Pokémon Card 151",tcgId:516072,usd:1.92,
      updatedAt:"2026-11-13T00:00:00.000Z",group:"3-23237"},
    421: {name:"Bill's Transfer",number:"194/165",
      set:"Pokémon Card 151",tcgId:517041,usd:1.85,
      updatedAt:"2026-11-13T00:00:00.000Z",group:"3-23237"},
    422: {name:"Mew ex",number:"205/165",
      set:"Pokémon Card 151",tcgId:517051,usd:23.53,
      updatedAt:"2026-11-13T00:00:00.000Z",group:"3-23237"},
    428: {name:"Wigglytuff ex",number:"040/165",
      set:"Pokémon Card 151",tcgId:516145,usd:1.11,
      updatedAt:"2026-11-13T00:00:00.000Z",group:"3-23237"},
    431: {name:"Wigglytuff ex",number:"040/165",
      set:"Pokémon Card 151",tcgId:516145,usd:1.11,
      updatedAt:"2026-11-13T00:00:00.000Z",group:"3-23237"},
    384: {name:"Blastoise ex",number:"009/165",
      set:"Pokémon Card 151",tcgId:502551,usd:2.32,
      updatedAt:"2026-11-12T00:00:00.000Z",group:"3-23237"},
    385: {name:"Venusaur ex",number:"003/165",
      set:"Pokémon Card 151",tcgId:502554,usd:0.97,
      updatedAt:"2026-11-12T00:00:00.000Z",group:"3-23237"},
    388: {name:"Charizard ex",number:"006/165",
      set:"Pokémon Card 151",tcgId:502558,usd:8.66,
      updatedAt:"2026-11-12T00:00:00.000Z",group:"3-23237"},
    389: {name:"Basic Psychic Energy",number:"207/165",
      set:"Pokémon Card 151",tcgId:517053,usd:3.98,
      updatedAt:"2026-11-13T00:00:00.000Z",group:"3-23237"},
    392: {name:"Ninetales ex",number:"186/165",
      set:"Pokémon Card 151",tcgId:517030,usd:12.29,
      updatedAt:"2026-11-12T00:00:00.000Z",group:"3-23237"},
    393: {name:"Alakazam ex",number:"065/165",
      set:"Pokémon Card 151",tcgId:516381,usd:1.85,
      updatedAt:"2026-11-12T00:00:00.000Z",group:"3-23237"},
    396: {name:"Venusaur ex",number:"198/165",
      set:"Pokémon Card 151",tcgId:517044,usd:88.53,
      updatedAt:"2026-11-13T00:00:00.000Z",group:"3-23237"},
    401: {name:"Scream Tail ex",number:"094/167",
      set:"Twilight Masquerade",tcgId:550138,usd:0.60,
      updatedAt:"2026-11-12T00:00:00.000Z",group:"3-23473"},
    402: {name:"Pidgey",number:"118/108",
      set:"Ruler of the Black Flame",tcgId:567072,usd:4.93,
      updatedAt:"2026-11-13T20:02:40.000Z",group:"85-23609"},
    405: {name:"Cleffa",number:"113/108",
      set:"Ruler of the Black Flame",tcgId:567067,usd:14.10,
      updatedAt:"2026-11-13T20:02:40.000Z",group:"85-23609"},
    323: {name:"Lechonk",number:"209/197",
      set:"Obsidian Flames",tcgId:509957,usd:10.23,
      updatedAt:"2026-11-13T00:00:00.000Z",group:"3-23228"},
    268: {name:"Skeledirge ex",number:"081",
      set:"Scarlet & Violet Promo",tcgId:537975,usd:4.05,
      updatedAt:"2026-11-07T00:00:00.000Z",group:"3-22872"},
    47: {name:"Mewtwo",number:"052",
      set:"Scarlet & Violet Promo",tcgId:518872,usd:37.07,
      updatedAt:"2026-11-12T20:03:14.000Z",group:"3-22872"},
    219: {name:"Maushold ex",number:"155/182",
      set:"Paradox Rift",tcgId:523836,usd:1.63,
      updatedAt:"2026-11-12T00:00:00.000Z",group:"3-23286"},
    299: {name:"Ferropaladín ex",number:"089/182",
      set:"Paradox Rift",tcgId:565469,usd:1.72,
      updatedAt:"2026-11-12T00:00:00.000Z",group:"3-22880",
      edition:"Prize Pack Series Cards (inglés)"},
    321: {name:"Darkrai & Cresselia LEGEND (Bottom)",number:"100/102",
      set:"30th Celebration - Classic Collection",tcgId:716200,usd:14.85,
      updatedAt:"2026-11-12T20:06:19.000Z",group:"3-24837"},
    324: {name:"Iron Hands ex",number:"070/182",
      set:"Paradox Rift",tcgId:523706,usd:0.66,
      updatedAt:"2026-11-12T20:06:19.000Z",group:"3-23286"},
    329: {name:"Squirtle",number:"170/165",
      set:"Pokémon Card 151",tcgId:502549,usd:76.35,
      updatedAt:"2026-11-12T20:06:19.000Z",group:"3-23237"}
  });
  const norm = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const number = s => String(s ?? "").toUpperCase().replace(/\s/g, "").split("/")
    .map(v => v.replace(/(^|[A-Z])0+(?=\d)/g, "$1")).join("/");
  const positive = n => typeof n === "number" && Number.isFinite(n) && n > 0;
  function bogotaDay(now = Date.now()) {
    return new Intl.DateTimeFormat("en-CA", {timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  }
  function recent(stamp, now = Date.now(), age = 2 * DAY) {
    const t = Date.parse(stamp);
    return Number.isFinite(t) && t <= now + 300000 && now - t <= age;
  }
  function validFX(fx, now = Date.now()) {
    if (!positive(fx?.cop)) return false;
    if (fx.source === "TRM") {
      const day = bogotaDay(now);
      return /^\d{4}-\d{2}-\d{2}$/.test(fx.validFrom) && /^\d{4}-\d{2}-\d{2}$/.test(fx.validTo) &&
        fx.validFrom <= day && day <= fx.validTo;
    }
    return fx.source === "ExchangeRate-API" && recent(fx.updatedAt, now, 2 * DAY);
  }
  function toCOP(usd, rate) {
    if (!positive(usd) || !positive(rate)) return null;
    // Round each displayed unit to a whole peso using fixed-point arithmetic.
    const cents = BigInt(Math.round(usd * 100)), micros = BigInt(Math.round(rate * 1000000));
    const cop = Number((cents * micros + 50000000n) / 100000000n);
    return Number.isSafeInteger(cop) ? cop : null;
  }
  function groupFor(card) {
    const key = norm(card.set), lang = norm(card.language);
    let group = groups[key];
    const mix=card.languageQuantities && Object.entries(card.languageQuantities);
    const westernMix=lang === "ingles espanol" && Array.isArray(mix) && mix.length===2 &&
      mix.every(([language,qty])=>["ingles","espanol"].includes(norm(language)) && Number.isSafeInteger(qty) && qty>0);
    if (["japones", "japanese", "jp", "ja"].includes(lang)) {
      if (key === "151") group = groups["pokemon card 151"];
      if (group?.[0] !== 85) return null;
    } else if ((!westernMix && !["ingles","english","en","espanol","spanish","es"].includes(lang)) || group?.[0] === 85) return null;
    if (key === "astral radiance" && /^TG/i.test(card.number)) group = [3,3068];
    return group ? group.join("-") : null;
  }
  function baseName(s) {
    return norm(String(s).replace(/\s*[-–]\s*[A-Z]*\d+(?:\s*\/\s*[A-Z]*\d+)?/i, ""));
  }
  function match(card, data) {
    const wanted = number(card.number), name = names[norm(card.name)] || norm(card.name);
    if (!wanted || !name) return [];
    const candidates = (data?.products || []).filter(p => {
      const candidate = number(p.number), n = baseName(p.name);
      const sameNumber = candidate === wanted || (!wanted.includes("/") && candidate.split("/")[0] === wanted);
      return sameNumber && (n === name || n.startsWith(name + " ")) &&
        !/\b(metal|jumbo|oversized|stamped|world championship)\b/.test(n);
    });
    const exact = candidates.filter(p => baseName(p.name) === name);
    return exact.length ? exact : candidates;
  }
  function searchUrl(card) {
    return "https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=" +
      encodeURIComponent([card.name,card.number,card.set].filter(Boolean).join(" ")) + "&view=grid";
  }
  function collectrSearchUrl(card) {
    return "https://app.getcollectr.com/?query=" +
      encodeURIComponent([card.name,card.number,card.set,card.language].filter(Boolean).join(" "));
  }
  function verifiedCollectr(card, data, now) {
    const row = data?.cards?.[String(card.id)];
    if (!row || !positive(row.usd) || row.currency !== "USD" || row.condition !== "ungraded" ||
      !["name","number","set","language"].every(key => (key === "number" ? number(row[key]) === number(card[key]) : norm(row[key]) === norm(card[key]))) ||
      !recent(row.updatedAt, now) || !/^https:\/\/app\.getcollectr\.com\/explore\/product\/\d+(?:[/?#]|$)/.test(row.url || "")) return null;
    return row;
  }
  function quote(card, snapshot, fx = snapshot?.fx, now = Date.now()) {
    const owner = ownerPrices.find(p => Number(card.id) === p.id && norm(p.name) === norm(card.name) &&
      number(p.number) === number(card.number) && norm(p.set) === norm(card.set));
    const rate = validFX(fx, now) ? fx.cop : null;
    const make = data => ({...data, status:data.stale ? "stale" : "ready", fx,
      copMin:rate ? toCOP(data.min,rate) : null, copMax:rate ? toCOP(data.max,rate) : null,
      usable:!data.stale && rate !== null});
    if (owner) return make({source:"owner",manual:true,min:owner.usd,max:owner.usd,
      stale:false,reference:false,url:searchUrl(card),updatedAt:null,
      variants:[{usd:owner.usd,finish:"Precio fijado por propietario"}]});
    const linked = linkedTCGPrices[Number(card.id)];
    if (linked && norm(linked.name) === norm(card.name) &&
      number(linked.number) === number(card.number) && norm(linked.set) === norm(card.set)) {
      // Si la publicación diaria trae la ficha exacta, preferir su precio más reciente.
      // Si no aparece en TCGCSV, preservar el precio manual, nunca volver a «Sin precio verificado».
      const groupData = snapshot?.groups?.[linked.group];
      const refreshedProduct = groupData?.products?.find(p =>
        p.id === linked.tcgId && number(p.number) === number(linked.number));
      const prices = (refreshedProduct?.prices || []).filter(p => positive(p.usd));
      const selected = prices.find(p => norm(p.finish) === "holofoil") || prices[0];
      const fresh = selected && recent(groupData.updatedAt,now) &&
        Date.parse(groupData.updatedAt) >= Date.parse(linked.updatedAt);
      const usd = fresh ? selected.usd : linked.usd;
      const updatedAt = fresh ? groupData.updatedAt : linked.updatedAt;
      return make({source:"tcgplayer",linked:true,min:usd,max:usd,stale:false,
        variants:[{usd,finish:"Holofoil"}],updatedAt,
        reference:norm(card.language) !== "ingles",url:"https://www.tcgplayer.com/product/" + linked.tcgId});
    }
    const group = groupFor(card), data = snapshot?.groups?.[group], matches = match(card,data);
    let tcg = null;
    if (group && matches.length === 1) {
      const product = matches[0];
      let variants = (product.prices || []).filter(v => positive(v.usd) && typeof v.finish === "string");
      if (card.finish) variants = variants.filter(v => norm(v.finish) === norm(card.finish));
      if (Number.isSafeInteger(product.id) && product.id > 0 && variants.length) {
        // One unit price: exact requested finish, otherwise the standard printing.
        // This never averages different printings or uses a seller's listing price.
        const priority = finish => ({"holofoil":0,"normal":1,"reverse holofoil":2}[norm(finish)] ?? 3);
        const selected = variants.slice().sort((a,b)=>priority(a.finish)-priority(b.finish) ||
          a.finish.localeCompare(b.finish,"en"))[0];
        tcg = make({source:"tcgplayer",min:selected.usd,max:selected.usd,variants:[selected],
          stale:!recent(data.updatedAt,now),updatedAt:data.updatedAt,
          reference:["espanol","spanish","es","ingles espanol"].includes(norm(card.language)),
          url:"https://www.tcgplayer.com/product/" + product.id});
        if (!tcg.stale) return tcg;
      }
    }
    const collectr = verifiedCollectr(card,snapshot?.collectr,now);
    if (collectr) return make({source:"collectr",min:collectr.usd,max:collectr.usd,
      variants:[{usd:collectr.usd,finish:"Sin gradar"}],stale:false,reference:false,
      updatedAt:collectr.updatedAt,url:collectr.url});
    if (tcg) return tcg;
    return {status:"unavailable",usable:false,source:"collectr-search",reason:"Sin precio verificado",
      min:null,max:null,copMin:null,copMax:null,url:collectrSearchUrl(card),fx};
  }
  function inventoryTotal(cards, availabilityFor, quoteFor) {
    let total=0n,refs=0,units=0,unpriced=0,unpricedUnits=0;
    for (const card of cards) {
      const current=availabilityFor(card);
      if (!current.available || current.quantity===0) continue;
      const quantity=current.quantity;
      if (!Number.isSafeInteger(quantity) || quantity<0) throw new RangeError("Cantidad no válida");
      refs++;units+=quantity;
      const q=quoteFor(card);
      if (!q?.usable || !Number.isSafeInteger(q.copMin) || q.copMin<0) {
        unpriced++;unpricedUnits+=quantity;continue;
      }
      // Exact sum of the same whole-peso unit amounts shown on the cards.
      total+=BigInt(q.copMin)*BigInt(quantity);
    }
    if (total>BigInt(Number.MAX_SAFE_INTEGER) || !Number.isSafeInteger(units)) throw new RangeError("Total fuera del rango exacto");
    return {total:Number(total),units,refs,unpriced,unpricedUnits,complete:unpriced===0};
  }
  root.BovedaPricingCore = Object.freeze({DAY,groups,norm,number,positive,bogotaDay,recent,validFX,
    toCOP,groupFor,match,searchUrl,collectrSearchUrl,quote,inventoryTotal});
})(globalThis);
