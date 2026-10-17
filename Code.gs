/**
 * Alwiti Urenregistratie — opslag in deze Google Sheet.
 *
 * Tabbladen:
 *  - Monteurs : Naam | Pincode | Rol | ID | Vergrendeld   (hier beheer je wie mag inloggen)
 *               Na 5 foute pincodes komt er in Vergrendeld een datum te staan: het account is dan op slot.
 *               Vrijgeven: in de app (tabblad Monteurs) of hier de cel Vergrendeld leegmaken.
 *               Rol = monteur, kantoor of eigenaar (eigenaar = kantoor + mag de administratie leegmaken)
 *  - Uren     : leesbaar overzicht van alle urenregels (wordt automatisch ververst)
 *  - Werken   : leesbaar overzicht van alle projecten (wordt automatisch ververst)
 *  - Bonnen   : leesbaar overzicht van alle bonnetjes (wordt automatisch ververst)
 *  - Data     : de opslag van de app zelf. Niet handmatig aanpassen.
 *  - Fotos    : foto's van bonnetjes. Niet handmatig aanpassen.
 *
 * Eenmalig: kies hierboven de functie "installeer" en klik op Uitvoeren.
 * Daarna: Implementeren > Nieuwe implementatie > Web-app,
 *         Uitvoeren als: Ik, Toegang: Iedereen.
 * Bijwerken: plak deze code, Opslaan, dan Implementeren > Implementaties beheren >
 *            potloodje > Versie: Nieuwe versie > Implementeren. De link blijft gelijk.
 */

var SH_DATA = 'Data', SH_MON = 'Monteurs', SH_UREN = 'Uren', SH_WERK = 'Werken', SH_BON = 'Bonnen', SH_FOTO = 'Fotos';
var SEG = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
var MAX_FOUT = 5;
var DEEL = 45000;            // tekens per cel (Google Sheets: max 50.000)
var MAX_DOC = 400000;        // maximale grootte van één document
var MAX_FOTO = 3000000;      // maximale grootte van één foto (base64)

/* ------------------------------------------------------------------ web */

function doGet() {
  return out_({ ok: true, app: 'Alwiti Urenregistratie', versie: 2, tijd: new Date().toISOString() });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'Ongeldig verzoek.' }); }
  try {
    switch (body.action) {
      case 'namen':            return out_({ ok: true, namen: namen_() });
      case 'login':            return out_(login_(body));
      case 'sync':             return out_(sync_(body));
      case 'write':            return out_(write_(body));
      case 'setPin':           return out_(setPin_(body));
      case 'verwijderMonteur': return out_(verwijderMonteur_(body));
      case 'vrijgeven':        return out_(vrijgeven_(body));
      case 'fotoUp':           return out_(fotoUp_(body));
      case 'foto':             return out_(foto_(body));
      case 'fotoDel':          return out_(fotoDel_(body));
      default:                 return out_({ ok: false, error: 'Onbekende actie.' });
    }
  } catch (err) {
    return out_({ ok: false, code: err.code || 'fout', error: err.message || String(err) });
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function fout_(msg, code) { var e = new Error(msg); e.code = code || 'fout'; return e; }

/* ------------------------------------------------------------ monteurs */

function sheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }

function slug_(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'onbekend';
}

function pinStr_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return String(Math.round(v));
  return String(v).trim();
}

function rolVan_(v) {
  var r = String(v || '').trim().toLowerCase();
  return r === 'eigenaar' ? 'eigenaar' : r === 'kantoor' ? 'kantoor' : 'monteur';
}

/** Leest het tabblad Monteurs; vult ontbrekende ID's aan. */
function monteurs_() {
  var sh = sheet_(SH_MON);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 5).getValues();
  var lijst = [], gebruikt = {}, gewijzigd = false;
  vals.forEach(function (r) { if (r[3]) gebruikt[String(r[3]).trim()] = true; });
  vals.forEach(function (r, i) {
    var naam = String(r[0] || '').trim();
    if (!naam) return;
    var id = String(r[3] || '').trim();
    if (!id) {
      var basis = 'm-' + slug_(naam), kand = basis, n = 2;
      while (gebruikt[kand]) kand = basis + '-' + (n++);
      id = kand; gebruikt[id] = true; r[3] = id; gewijzigd = true;
    }
    var rol = rolVan_(r[2]);
    lijst.push({ rij: i + 2, naam: naam, pin: pinStr_(r[1]), rol: rol === 'monteur' ? 'monteur' : 'kantoor', eigenaar: rol === 'eigenaar', id: id, slot: r[4] !== '' && r[4] !== null });
  });
  if (gewijzigd) sh.getRange(2, 4, vals.length, 1).setValues(vals.map(function (r) { return [r[3]]; }));
  return lijst;
}

function namen_() {
  return monteurs_().filter(function (m) { return m.pin; })
    .map(function (m) { return { id: m.id, naam: m.naam }; })
    .sort(function (a, b) { return a.naam.localeCompare(b.naam, 'nl'); });
}

function auth_(body) {
  var id = String(body.id || ''), pin = pinStr_(body.pin);
  if (!id || !pin) throw fout_('Kies je naam en vul je pincode in.', 'auth');
  var m = monteurs_().filter(function (x) { return x.id === id; })[0];
  if (m && m.slot) throw fout_('Je account is vergrendeld na ' + MAX_FOUT + ' foute pincodes. Vraag kantoor om het vrij te geven.', 'slot');
  var props = PropertiesService.getScriptProperties(), key = 'fout:' + id;
  // Een getal-cel verliest voorloopnullen (0123 -> 123); daarom ook numeriek vergelijken bij gelijke inhoud.
  var ok = m && m.pin && (m.pin === pin || (/^\d+$/.test(m.pin) && /^\d+$/.test(pin) && Number(m.pin) === Number(pin)));
  if (!ok) {
    if (!m) throw fout_('Naam of pincode klopt niet.', 'auth');
    var fouten = Number(props.getProperty(key) || 0) + 1;
    if (fouten >= MAX_FOUT) {
      props.deleteProperty(key);
      sheet_(SH_MON).getRange(m.rij, 5).setValue(new Date());
      throw fout_('Te vaak een verkeerde pincode. Je account is vergrendeld; vraag kantoor om het vrij te geven.', 'slot');
    }
    props.setProperty(key, String(fouten));
    var rest = MAX_FOUT - fouten;
    throw fout_('Pincode klopt niet. Nog ' + rest + (rest === 1 ? ' poging' : ' pogingen') + ', daarna wordt je account vergrendeld.', 'auth');
  }
  if (props.getProperty(key)) props.deleteProperty(key);
  return { id: m.id, naam: m.naam, rol: m.rol, eigenaar: m.eigenaar };
}

function kantoor_(me) { return me.rol === 'kantoor'; }

/** Geblokkeerde monteurs (instelling in de app) kunnen niet meer inloggen of opslaan. */
function checkBlok_(me, docs) {
  if (kantoor_(me)) return;
  var c = docs['kantoor/config'] && docs['kantoor/config'].d;
  if (c && Array.isArray(c.geblokkeerd) && c.geblokkeerd.indexOf(me.id) >= 0)
    throw fout_('Je account is geblokkeerd. Neem contact op met kantoor.', 'auth');
}

function login_(body) {
  var me = auth_(body);
  checkBlok_(me, leesData_().docs);
  return { ok: true, me: me };
}

function setPin_(body) {
  var me = auth_(body);
  if (!kantoor_(me)) throw fout_('Alleen kantoor kan pincodes instellen.', 'denied');
  var mid = String(body.mid || '').trim(), naam = String(body.naam || '').trim();
  var pin = pinStr_(body.nieuwePin), rol = body.rol === 'kantoor' ? 'kantoor' : null;
  if (!mid || !SEG.test(mid)) throw fout_('Onbekende monteur.');
  if (pin && !/^\d{4,6}$/.test(pin)) throw fout_('Een pincode is 4 tot 6 cijfers.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = sheet_(SH_MON);
    var m = monteurs_().filter(function (x) { return x.id === mid; })[0];
    if (m) {
      sh.getRange(m.rij, 2).setNumberFormat('@').setValue(pin);
      if (pin) { sh.getRange(m.rij, 5).setValue(''); PropertiesService.getScriptProperties().deleteProperty('fout:' + mid); }
      if (naam) sh.getRange(m.rij, 1).setValue(naam);
      if (rol && !m.eigenaar) sh.getRange(m.rij, 3).setValue(rol);
    } else {
      sh.appendRow([naam || mid, '', rol || 'monteur', mid]);
      sh.getRange(sh.getLastRow(), 2).setNumberFormat('@').setValue(pin);
    }
    zorgMonteurDocs_();
  } finally { lock.releaseLock(); }
  return { ok: true, monteurs: monteurLijst_() };
}

/** Haalt een monteur uit het tabblad Monteurs (kan daarna niet meer inloggen). */
function verwijderMonteur_(body) {
  var me = auth_(body);
  if (!kantoor_(me)) throw fout_('Alleen kantoor kan monteurs verwijderen.', 'denied');
  var mid = String(body.mid || '').trim();
  if (mid === me.id) throw fout_('Je kunt jezelf niet verwijderen.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var m = monteurs_().filter(function (x) { return x.id === mid; })[0];
    if (m) {
      if (m.eigenaar) throw fout_('De eigenaar kan alleen in de Google Sheet worden verwijderd.');
      sheet_(SH_MON).deleteRow(m.rij);
    }
  } finally { lock.releaseLock(); }
  return { ok: true, monteurs: monteurLijst_() };
}

/** Geeft een vergrendeld account weer vrij (na 5 foute pincodes). */
function vrijgeven_(body) {
  var me = auth_(body);
  if (!kantoor_(me)) throw fout_('Alleen kantoor kan een account vrijgeven.', 'denied');
  var mid = String(body.mid || '').trim();
  var m = monteurs_().filter(function (x) { return x.id === mid; })[0];
  if (m) sheet_(SH_MON).getRange(m.rij, 5).setValue('');
  PropertiesService.getScriptProperties().deleteProperty('fout:' + mid);
  return { ok: true, monteurs: monteurLijst_() };
}

function monteurLijst_() {
  return monteurs_().map(function (m) { return { id: m.id, naam: m.naam, rol: m.rol, eigenaar: m.eigenaar, heeftPin: !!m.pin, vergrendeld: m.slot }; });
}

/* ---------------------------------------------------------------- data */
/* Elk document staat op één rij: pad | json | ts | (vervolg json) | ...  */

function leesData_() {
  var sh = sheet_(SH_DATA), last = sh.getLastRow(), breed = Math.max(3, sh.getLastColumn());
  var rijen = last < 2 ? [] : sh.getRange(2, 1, last - 1, breed).getValues();
  var index = {}, docs = {};
  rijen.forEach(function (r, i) {
    var p = String(r[0]);
    if (!p) return;
    index[p] = i + 2;
    var json = String(r[1] === null ? '' : r[1]);
    for (var k = 3; k < r.length && r[k] !== '' && r[k] !== null; k++) json += String(r[k]);
    var d = null;
    if (json !== '') { try { d = JSON.parse(json); } catch (e) { d = null; } }
    docs[p] = { d: d, ts: Number(r[2]) || 0 };
  });
  return { sh: sh, index: index, docs: docs, breed: breed };
}

/** Zet een document om naar een rij van de gegeven breedte. */
function rij_(p, json, ts, breed) {
  var delen = [];
  for (var i = 0; i < json.length; i += DEEL) delen.push(json.slice(i, i + DEEL));
  if (!delen.length) delen.push('');
  var r = [p, delen[0], ts].concat(delen.slice(1));
  while (r.length < breed) r.push('');
  return r;
}

function magLezen_(me, p) {
  if (kantoor_(me)) return true;
  var u = me.id, s = p.split('/');
  if (p === 'kantoor/config') return true;
  if (/^kantoor\/config\/werken\/[^\/]+$/.test(p)) return true;
  if (s.length === 4 && s[0] === 'kantoor' && s[2] === 'bonstatus') return s[3].indexOf(u + '__') === 0;
  if (p === 'uren/' + u || p === 'goedgekeurd/' + u) return true;
  if (s.length === 4 && s[1] === u && ((s[0] === 'uren' && (s[2] === 'items' || s[2] === 'bonnen')) || (s[0] === 'goedgekeurd' && s[2] === 'items'))) return true;
  return false;
}

function magSchrijven_(me, op, huidig, docs) {
  if (kantoor_(me)) return true;
  var u = me.id, p = op.p, s = p.split('/');
  if (p === 'uren/' + u) return op.op !== 'delete';
  if (s.length === 4 && s[0] === 'uren' && s[1] === u && s[2] === 'items') {
    if (huidig && huidig.status === 'ok') return false;               // goedgekeurd: niet meer wijzigen
    if (op.d && op.d.status === 'ok') return false;                   // zelf goedkeuren mag niet
    if (op.op !== 'delete' && op.d && op.d.uid && op.d.uid !== u) return false;
    return true;
  }
  if (s.length === 4 && s[0] === 'uren' && s[1] === u && s[2] === 'bonnen') {
    var st = docs['kantoor/config/bonstatus/' + u + '__' + s[3]];
    if (st && st.d && st.d.status && st.d.status !== 'ingediend') return false; // beoordeeld: niet meer wijzigen
    if (op.op !== 'delete' && op.d && op.d.uid && op.d.uid !== u) return false;
    return true;
  }
  return false;
}

function geldigPad_(p) {
  if (typeof p !== 'string' || p.length > 1000) return false;
  var s = p.split('/');
  if (s.length % 2 !== 0) return false;
  for (var i = 0; i < s.length; i++) if (!SEG.test(s[i]) || s[i] === '.' || s[i] === '..') return false;
  return true;
}

function sync_(body) {
  var me = auth_(body);
  var since = Number(body.since) || 0;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var res;
  try {
    if (kantoor_(me) && !since) zorgMonteurDocs_();
    var data = leesData_(), docs = [], max = since;
    checkBlok_(me, data.docs);
    Object.keys(data.docs).forEach(function (p) {
      var x = data.docs[p];
      if (x.ts > max) max = x.ts;
      if (x.ts > since && magLezen_(me, p)) docs.push({ p: p, d: x.d });
    });
    res = { ok: true, me: me, now: Math.max(max, Number(PropertiesService.getScriptProperties().getProperty('lastTs')) || 0), docs: docs };
  } finally { lock.releaseLock(); }
  if (kantoor_(me)) res.monteurs = monteurLijst_();
  return res;
}

function write_(body) {
  var me = auth_(body);
  var ops = Array.isArray(body.ops) ? body.ops : [];
  if (!ops.length) return { ok: true, geweigerd: [] };
  if (ops.length > 200) throw fout_('Te veel wijzigingen in één keer.');
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  var geweigerd = [], overzicht = false, werken = false, bonnen = false;
  try {
    var data = leesData_(), props = PropertiesService.getScriptProperties();
    checkBlok_(me, data.docs);
    var ts = Math.max(Number(props.getProperty('lastTs')) || 0, Date.now());
    var bestaand = [], nieuw = [], breed = data.breed;
    ops.forEach(function (op, i) {
      if (!op || ['set', 'update', 'delete'].indexOf(op.op) < 0 || !geldigPad_(op.p)) { geweigerd.push(i); return; }
      if (op.d !== undefined && (typeof op.d !== 'object' || op.d === null || Array.isArray(op.d))) { geweigerd.push(i); return; }
      var huidig = data.docs[op.p] ? data.docs[op.p].d : null;
      if (!magSchrijven_(me, op, huidig, data.docs)) { geweigerd.push(i); return; }
      var d;
      if (op.op === 'delete') d = null;
      else if (op.op === 'update') { d = huidig ? JSON.parse(JSON.stringify(huidig)) : {}; Object.keys(op.d || {}).forEach(function (k) { d[k] = op.d[k]; }); }
      else d = op.d || {};
      var json = d === null ? '' : JSON.stringify(d);
      if (json.length > MAX_DOC) { geweigerd.push(i); return; }
      breed = Math.max(breed, 2 + Math.ceil(Math.max(1, json.length) / DEEL));
      ts += 1;
      if (data.index[op.p] > 0) bestaand.push({ rij: data.index[op.p], p: op.p, json: json, ts: ts });
      else if (data.index[op.p] === -1) { nieuw.forEach(function (n) { if (n.p === op.p) { n.json = json; n.ts = ts; } }); }
      else { nieuw.push({ p: op.p, json: json, ts: ts }); data.index[op.p] = -1; }
      data.docs[op.p] = { d: d, ts: ts };
      if (/^(uren|goedgekeurd)\/[^\/]+\/items\//.test(op.p) || /^(uren|goedgekeurd)\/[^\/]+$/.test(op.p)) overzicht = true;
      if (/^kantoor\/config\/werken\//.test(op.p)) { werken = true; overzicht = true; }
      if (/^uren\/[^\/]+\/bonnen\//.test(op.p) || /^kantoor\/config\/bonstatus\//.test(op.p)) bonnen = true;
    });
    if (breed > data.sh.getMaxColumns()) data.sh.insertColumnsAfter(data.sh.getMaxColumns(), breed - data.sh.getMaxColumns());
    bestaand.forEach(function (x) { data.sh.getRange(x.rij, 1, 1, breed).setValues([rij_(x.p, x.json, x.ts, breed)]); });
    if (nieuw.length) data.sh.getRange(data.sh.getLastRow() + 1, 1, nieuw.length, breed)
      .setValues(nieuw.map(function (x) { return rij_(x.p, x.json, x.ts, breed); }));
    props.setProperty('lastTs', String(ts));
    if (werken) bouwWerken_(data.docs);
    if (overzicht) bouwUren_(data.docs);
    if (bonnen) bouwBonnen_(data.docs);
  } finally { lock.releaseLock(); }
  return { ok: true, geweigerd: geweigerd };
}

/** Zorgt dat elke monteur uit het tabblad Monteurs ook in de app bestaat. */
function zorgMonteurDocs_() {
  var data = leesData_(), nieuw = [], props = PropertiesService.getScriptProperties();
  var ts = Math.max(Number(props.getProperty('lastTs')) || 0, Date.now());
  monteurs_().forEach(function (m) {
    var p = 'uren/' + m.id;
    if (!SEG.test(m.id)) return;
    if (data.docs[p] && data.docs[p].d) return;
    ts += 1;
    var json = JSON.stringify({ monteur: m.naam, bijgewerkt: new Date().toISOString() });
    if (data.index[p]) data.sh.getRange(data.index[p], 1, 1, data.breed).setValues([rij_(p, json, ts, data.breed)]);
    else nieuw.push(rij_(p, json, ts, data.breed));
  });
  if (nieuw.length) data.sh.getRange(data.sh.getLastRow() + 1, 1, nieuw.length, data.breed).setValues(nieuw);
  props.setProperty('lastTs', String(ts));
}

/* ------------------------------------------------------------- foto's */
/* Tabblad Fotos: id | monteur-id | deel | data | aangemaakt */

function fotoSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SH_FOTO);
  if (!sh) { sh = ss.insertSheet(SH_FOTO); sh.getRange(1, 1, 1, 5).setValues([['id', 'monteur', 'deel', 'data', 'aangemaakt']]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}

function fotoRijen_(sh, fid) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var ids = sh.getRange(2, 1, last - 1, 2).getValues(), uit = [];
  ids.forEach(function (r, i) { if (String(r[0]) === fid) uit.push({ rij: i + 2, uid: String(r[1]) }); });
  return uit;
}

function fotoUp_(body) {
  var me = auth_(body);
  var data = String(body.data || '');
  if (!/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(data)) throw fout_('Dit is geen geldige foto.');
  if (data.length > MAX_FOTO) throw fout_('De foto is te groot.');
  var fid = 'f' + Utilities.getUuid().replace(/-/g, '');
  var nu = new Date().toISOString(), rijen = [];
  for (var i = 0, n = 0; i < data.length; i += DEEL, n++) rijen.push([fid, me.id, n, data.slice(i, i + DEEL), nu]);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = fotoSheet_();
    sh.getRange(sh.getLastRow() + 1, 1, rijen.length, 5).setValues(rijen);
  } finally { lock.releaseLock(); }
  return { ok: true, id: fid };
}

function foto_(body) {
  var me = auth_(body), fid = String(body.fid || '');
  var sh = fotoSheet_(), rijen = fotoRijen_(sh, fid);
  if (!rijen.length) throw fout_('Foto niet gevonden.', 'notfound');
  if (!kantoor_(me) && rijen[0].uid !== me.id) throw fout_('Geen toegang tot deze foto.', 'denied');
  var delen = rijen.map(function (r) { return sh.getRange(r.rij, 3, 1, 2).getValues()[0]; })
    .sort(function (a, b) { return Number(a[0]) - Number(b[0]); });
  return { ok: true, data: delen.map(function (d) { return String(d[1]); }).join('') };
}

function fotoDel_(body) {
  var me = auth_(body), fid = String(body.fid || '');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = fotoSheet_(), rijen = fotoRijen_(sh, fid);
    if (!rijen.length) return { ok: true };
    if (!kantoor_(me) && rijen[0].uid !== me.id) throw fout_('Geen toegang tot deze foto.', 'denied');
    rijen.map(function (r) { return r.rij; }).sort(function (a, b) { return b - a; })
      .forEach(function (r) { sh.deleteRow(r); });
  } finally { lock.releaseLock(); }
  return { ok: true };
}

/* --------------------------------------------------- leesbare overzichten */

var TYPES = { normaal: 'Normaal', overwerk: 'Overwerk', meerwerk: 'Meerwerk', service: 'Service', ziek: 'Ziek', vrij: 'Vrij', dokter: 'Dokter', tandarts: 'Tandarts' };
var SOORT = { buiten: 'Buiten', binnen: 'Werkplaats', kantoor: 'Kantoor' };

function bouwUren_(docs) {
  var werken = {};
  Object.keys(docs).forEach(function (p) {
    var m = p.match(/^kantoor\/config\/werken\/([^\/]+)$/);
    if (m && docs[p].d) werken[m[1]] = docs[p].d;
  });
  var rijen = [];
  Object.keys(docs).forEach(function (p) {
    var m = p.match(/^(uren|goedgekeurd)\/[^\/]+\/items\/[^\/]+$/), r = docs[p].d;
    if (!m || !r) return;
    var w = r.werkId && werken[r.werkId] ? werken[r.werkId] : null;
    var ok = m[1] === 'goedgekeurd' || r.status === 'ok';
    rijen.push([
      r.datum || '', r.week || '', r.monteur || '',
      w ? (w.nr || '') : (r.werkNr || ''), w ? (w.naam || '') : (r.werkNaam || r.werkVrij || ''),
      SOORT[r.soort] || '',
      TYPES[r.type || 'normaal'] || r.type || '', Number(r.uren) || 0, Number(r.reis) || 0,
      r.omschrijving || '', r.opmerking || '', ok ? 'Goedgekeurd' : 'Te controleren', r.bron || 'app', r.aangemaakt || ''
    ]);
  });
  rijen.sort(function (a, b) { return String(b[0]).localeCompare(String(a[0])) || String(a[2]).localeCompare(String(b[2]), 'nl'); });
  schrijfTab_(SH_UREN, ['Datum', 'Week', 'Monteur', 'Projectnummer', 'Project', 'Locatie', 'Type', 'Uren', 'Reis', 'Omschrijving', 'Opmerking', 'Status', 'Bron', 'Ingevoerd op'], rijen);
}

function bouwWerken_(docs) {
  var rijen = [];
  Object.keys(docs).forEach(function (p) {
    if (!/^kantoor\/config\/werken\/[^\/]+$/.test(p) || !docs[p].d) return;
    var w = docs[p].d;
    rijen.push([w.nr || '', w.naam || '', w.plaats || '', w.adres || '', Number(w.budget) || 0, w.actief === false ? 'Nee' : 'Ja']);
  });
  rijen.sort(function (a, b) { return String(b[0]).localeCompare(String(a[0]), 'nl', { numeric: true }); });
  schrijfTab_(SH_WERK, ['Projectnummer', 'Naam', 'Plaats', 'Adres', 'Urenbudget', 'Actief'], rijen);
}

function bouwBonnen_(docs) {
  var rijen = [];
  Object.keys(docs).forEach(function (p) {
    var m = p.match(/^uren\/([^\/]+)\/bonnen\/([^\/]+)$/), b = docs[p].d;
    if (!m || !b) return;
    var st = docs['kantoor/config/bonstatus/' + m[1] + '__' + m[2]];
    var status = st && st.d && st.d.status || 'ingediend';
    rijen.push([b.datum || '', b.monteur || '', b.soort || '', Number(b.bedrag) || 0, b.kenteken || '', Number(b.kmStand) || '',
      [b.projectNr, b.projectNaam].filter(Boolean).join(' '), b.omschrijving || '', status.charAt(0).toUpperCase() + status.slice(1)]);
  });
  rijen.sort(function (a, b) { return String(b[0]).localeCompare(String(a[0])); });
  schrijfTab_(SH_BON, ['Datum', 'Monteur', 'Soort', 'Bedrag', 'Kenteken', 'Km-stand', 'Project', 'Omschrijving', 'Status'], rijen);
}

function schrijfTab_(naam, kop, rijen) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(naam) || ss.insertSheet(naam);
  sh.clearContents();
  sh.getRange(1, 1, 1, kop.length).setValues([kop]).setFontWeight('bold');
  if (rijen.length) sh.getRange(2, 1, rijen.length, kop.length).setValues(rijen);
  sh.setFrozenRows(1);
}

/** Menu: Alwiti > Overzichten verversen */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Alwiti').addItem('Overzichten verversen', 'ververs').addToUi();
}

function ververs() {
  var d = leesData_().docs;
  bouwWerken_(d); bouwUren_(d); bouwBonnen_(d);
}

/* ------------------------------------------------------------ installatie */

function installeer() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  function tab(naam, kop) {
    var sh = ss.getSheetByName(naam) || ss.insertSheet(naam);
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, kop.length).setValues([kop]).setFontWeight('bold');
    sh.setFrozenRows(1);
    return sh;
  }
  var mon = tab(SH_MON, ['Naam', 'Pincode', 'Rol', 'ID']);
  if (mon.getRange(1, 5).getValue() === '') mon.getRange(1, 5).setValue('Vergrendeld').setFontWeight('bold');
  mon.getRange('B:B').setNumberFormat('@');
  var data = tab(SH_DATA, ['pad', 'json', 'ts']);
  tab(SH_UREN, ['Datum']); tab(SH_WERK, ['Projectnummer']); tab(SH_BON, ['Datum']);
  fotoSheet_();

  // Bestaande gegevens uit de oude app overnemen (eenmalig)
  if (typeof MIGRATIE !== 'undefined' && data.getLastRow() < 2) {
    var ts = Date.now(), rijen = [];
    Object.keys(MIGRATIE.docs).forEach(function (p) { rijen.push([p, JSON.stringify(MIGRATIE.docs[p]), ++ts]); });
    if (rijen.length) data.getRange(2, 1, rijen.length, 3).setValues(rijen);
    PropertiesService.getScriptProperties().setProperty('lastTs', String(ts));
    if (mon.getLastRow() < 2 && MIGRATIE.monteurs.length) {
      mon.getRange(2, 1, MIGRATIE.monteurs.length, 4).setValues(MIGRATIE.monteurs.map(function (m) { return [m.naam, '', m.rol, m.id]; }));
    }
  }
  var bl = ss.getSheetByName('Blad1') || ss.getSheetByName('Sheet1');
  if (bl && bl.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(bl);
  ss.setActiveSheet(mon);
  ververs();
  var tekst = 'Klaar. Vul in het tabblad Monteurs bij jezelf een pincode in (Rol = eigenaar). ' +
    'Daarna: Implementeren > Nieuwe implementatie > Web-app (Uitvoeren als: Ik, Toegang: Iedereen).';
  try { SpreadsheetApp.getUi().alert(tekst); } catch (e) { Logger.log(tekst); }
}
