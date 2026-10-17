/**
 * Alwiti Urenregistratie — opslag in deze Google Sheet.
 *
 * Tabbladen:
 *  - Monteurs : Naam | Pincode | Rol | ID   (hier beheer je wie mag inloggen)
 *  - Uren     : leesbaar overzicht van alle urenregels (wordt automatisch ververst)
 *  - Werken   : leesbaar overzicht van alle werken (wordt automatisch ververst)
 *  - Data     : de opslag van de app zelf. Niet handmatig aanpassen.
 *
 * Eenmalig: kies hierboven de functie "installeer" en klik op Uitvoeren.
 * Daarna: Implementeren > Nieuwe implementatie > Web-app,
 *         Uitvoeren als: Ik, Toegang: Iedereen.
 */

var SH_DATA = 'Data', SH_MON = 'Monteurs', SH_UREN = 'Uren', SH_WERK = 'Werken';
var SEG = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
var MAX_FOUT = 5, BLOK_SEC = 600;

/* ------------------------------------------------------------------ web */

function doGet() {
  return out_({ ok: true, app: 'Alwiti Urenregistratie', tijd: new Date().toISOString() });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'Ongeldig verzoek.' }); }
  try {
    switch (body.action) {
      case 'namen':  return out_({ ok: true, namen: namen_() });
      case 'login':  return out_(login_(body));
      case 'sync':   return out_(sync_(body));
      case 'write':  return out_(write_(body));
      case 'setPin': return out_(setPin_(body));
      default:       return out_({ ok: false, error: 'Onbekende actie.' });
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

/** Leest het tabblad Monteurs; vult ontbrekende ID's aan. */
function monteurs_() {
  var sh = sheet_(SH_MON);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 4).getValues();
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
    var rol = String(r[2] || '').trim().toLowerCase() === 'kantoor' ? 'kantoor' : 'monteur';
    lijst.push({ rij: i + 2, naam: naam, pin: pinStr_(r[1]), rol: rol, id: id });
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
  var cache = CacheService.getScriptCache(), key = 'fout:' + id;
  var fouten = Number(cache.get(key) || 0);
  if (fouten >= MAX_FOUT) throw fout_('Te vaak een verkeerde pincode. Probeer het over 10 minuten opnieuw.', 'blok');
  var m = monteurs_().filter(function (x) { return x.id === id; })[0];
  // Een getal-cel verliest voorloopnullen (0123 -> 123); daarom ook numeriek vergelijken bij gelijke inhoud.
  var ok = m && m.pin && (m.pin === pin || (/^\d+$/.test(m.pin) && /^\d+$/.test(pin) && Number(m.pin) === Number(pin)));
  if (!ok) {
    cache.put(key, String(fouten + 1), BLOK_SEC);
    throw fout_('Naam of pincode klopt niet.', 'auth');
  }
  cache.remove(key);
  return { id: m.id, naam: m.naam, rol: m.rol };
}

function login_(body) {
  var me = auth_(body);
  return { ok: true, me: me };
}

function setPin_(body) {
  var me = auth_(body);
  if (me.rol !== 'kantoor') throw fout_('Alleen kantoor kan pincodes instellen.', 'denied');
  var mid = String(body.mid || '').trim(), naam = String(body.naam || '').trim();
  var pin = pinStr_(body.nieuwePin), rol = body.rol === 'kantoor' ? 'kantoor' : null;
  if (!mid || !SEG.test(mid)) throw fout_('Onbekende monteur.');
  if (pin && !/^\d{4,6}$/.test(pin)) throw fout_('Een pincode is 4 tot 6 cijfers.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = sheet_(SH_MON);
    var m = monteurs_().filter(function (x) { return x.id === mid; })[0];
    if (m) {
      sh.getRange(m.rij, 2).setValue(pin);
      if (naam) sh.getRange(m.rij, 1).setValue(naam);
      if (rol) sh.getRange(m.rij, 3).setValue(rol);
    } else {
      sh.appendRow([naam || mid, pin, rol || 'monteur', mid]);
      sh.getRange(sh.getLastRow(), 2).setNumberFormat('@').setValue(pin);
    }
    zorgMonteurDocs_();
  } finally { lock.releaseLock(); }
  return { ok: true, monteurs: monteurLijst_() };
}

function monteurLijst_() {
  return monteurs_().map(function (m) { return { id: m.id, naam: m.naam, rol: m.rol, heeftPin: !!m.pin }; });
}

/* ---------------------------------------------------------------- data */

function leesData_() {
  var sh = sheet_(SH_DATA), last = sh.getLastRow();
  var rijen = last < 2 ? [] : sh.getRange(2, 1, last - 1, 3).getValues();
  var index = {}, docs = {};
  rijen.forEach(function (r, i) {
    var p = String(r[0]);
    if (!p) return;
    index[p] = i + 2;
    var d = null;
    if (r[1] !== '' && r[1] !== null) { try { d = JSON.parse(r[1]); } catch (e) { d = null; } }
    docs[p] = { d: d, ts: Number(r[2]) || 0 };
  });
  return { sh: sh, index: index, docs: docs };
}

function magLezen_(me, p) {
  if (me.rol === 'kantoor') return true;
  var u = me.id;
  if (p === 'kantoor/config') return true;
  if (/^kantoor\/config\/werken\/[^\/]+$/.test(p)) return true;
  if (p === 'uren/' + u || p === 'goedgekeurd/' + u) return true;
  var s = p.split('/');
  return s.length === 4 && (s[0] === 'uren' || s[0] === 'goedgekeurd') && s[1] === u && s[2] === 'items';
}

function magSchrijven_(me, op, huidig) {
  if (me.rol === 'kantoor') return true;
  var u = me.id, p = op.p, s = p.split('/');
  if (p === 'uren/' + u) return op.op !== 'delete';
  if (s.length === 4 && s[0] === 'uren' && s[1] === u && s[2] === 'items') {
    if (huidig && huidig.status === 'ok') return false;               // goedgekeurd: niet meer wijzigen
    if (op.d && op.d.status === 'ok') return false;                   // zelf goedkeuren mag niet
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
    if (me.rol === 'kantoor' && !since) zorgMonteurDocs_();
    var data = leesData_(), docs = [], max = since;
    Object.keys(data.docs).forEach(function (p) {
      var x = data.docs[p];
      if (x.ts > max) max = x.ts;
      if (x.ts > since && magLezen_(me, p)) docs.push({ p: p, d: x.d });
    });
    res = { ok: true, me: me, now: Math.max(max, Number(PropertiesService.getScriptProperties().getProperty('lastTs')) || 0), docs: docs };
  } finally { lock.releaseLock(); }
  if (me.rol === 'kantoor') res.monteurs = monteurLijst_();
  return res;
}

function write_(body) {
  var me = auth_(body);
  var ops = Array.isArray(body.ops) ? body.ops : [];
  if (!ops.length) return { ok: true, geweigerd: [] };
  if (ops.length > 200) throw fout_('Te veel wijzigingen in één keer.');
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  var geweigerd = [], overzicht = false, werken = false;
  try {
    var data = leesData_(), props = PropertiesService.getScriptProperties();
    var ts = Math.max(Number(props.getProperty('lastTs')) || 0, Date.now());
    var nieuw = [];
    ops.forEach(function (op, i) {
      if (!op || ['set', 'update', 'delete'].indexOf(op.op) < 0 || !geldigPad_(op.p)) { geweigerd.push(i); return; }
      if (op.d !== undefined && (typeof op.d !== 'object' || op.d === null || Array.isArray(op.d))) { geweigerd.push(i); return; }
      var huidig = data.docs[op.p] ? data.docs[op.p].d : null;
      if (!magSchrijven_(me, op, huidig)) { geweigerd.push(i); return; }
      var d;
      if (op.op === 'delete') d = null;
      else if (op.op === 'update') { d = huidig ? JSON.parse(JSON.stringify(huidig)) : {}; Object.keys(op.d || {}).forEach(function (k) { d[k] = op.d[k]; }); }
      else d = op.d || {};
      var json = d === null ? '' : JSON.stringify(d);
      if (json.length > 45000) { geweigerd.push(i); return; }
      ts += 1;
      var rij = [op.p, json, ts];
      if (data.index[op.p]) data.sh.getRange(data.index[op.p], 1, 1, 3).setValues([rij]);
      else { nieuw.push(rij); data.index[op.p] = -1; }
      data.docs[op.p] = { d: d, ts: ts };
      if (/^(uren|goedgekeurd)\/[^\/]+\/items\//.test(op.p) || /^(uren|goedgekeurd)\/[^\/]+$/.test(op.p)) overzicht = true;
      if (/^kantoor\/config\/werken\//.test(op.p)) { werken = true; overzicht = true; }
    });
    if (nieuw.length) data.sh.getRange(data.sh.getLastRow() + 1, 1, nieuw.length, 3).setValues(nieuw);
    props.setProperty('lastTs', String(ts));
    if (werken) bouwWerken_(data.docs);
    if (overzicht) bouwUren_(data.docs);
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
    var d = { monteur: m.naam, bijgewerkt: new Date().toISOString() };
    if (data.index[p]) data.sh.getRange(data.index[p], 1, 1, 3).setValues([[p, JSON.stringify(d), ts]]);
    else nieuw.push([p, JSON.stringify(d), ts]);
  });
  if (nieuw.length) data.sh.getRange(data.sh.getLastRow() + 1, 1, nieuw.length, 3).setValues(nieuw);
  props.setProperty('lastTs', String(ts));
}

/* --------------------------------------------------- leesbare overzichten */

var TYPES = { normaal: 'Normaal', overwerk: 'Overwerk', meerwerk: 'Meerwerk', service: 'Service', ziek: 'Ziek', vrij: 'Vrij', dokter: 'Dokter', tandarts: 'Tandarts' };

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
      r.soort === 'binnen' ? 'Kantoor' : r.soort === 'buiten' ? 'Buiten' : '',
      TYPES[r.type || 'normaal'] || r.type || '', Number(r.uren) || 0, Number(r.reis) || 0,
      r.omschrijving || '', ok ? 'Goedgekeurd' : 'Te controleren', r.bron || 'app', r.aangemaakt || ''
    ]);
  });
  rijen.sort(function (a, b) { return String(b[0]).localeCompare(String(a[0])) || String(a[2]).localeCompare(String(b[2]), 'nl'); });
  schrijfTab_(SH_UREN, ['Datum', 'Week', 'Monteur', 'Werknummer', 'Werk', 'Soort', 'Type', 'Uren', 'Reis', 'Omschrijving', 'Status', 'Bron', 'Ingevoerd op'], rijen);
}

function bouwWerken_(docs) {
  var rijen = [];
  Object.keys(docs).forEach(function (p) {
    if (!/^kantoor\/config\/werken\/[^\/]+$/.test(p) || !docs[p].d) return;
    var w = docs[p].d;
    rijen.push([w.nr || '', w.naam || '', w.plaats || '', Number(w.budget) || 0, w.actief === false ? 'Nee' : 'Ja']);
  });
  rijen.sort(function (a, b) { return String(a[0]).localeCompare(String(b[0]), 'nl', { numeric: true }); });
  schrijfTab_(SH_WERK, ['Werknummer', 'Naam', 'Plaats', 'Urenbudget', 'Actief'], rijen);
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
  bouwWerken_(d); bouwUren_(d);
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
  mon.getRange('B:B').setNumberFormat('@');
  var data = tab(SH_DATA, ['pad', 'json', 'ts']);
  tab(SH_UREN, ['Datum']); tab(SH_WERK, ['Werknummer']);

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
  var tekst = 'Klaar. Vul in het tabblad Monteurs bij jezelf een pincode in (Rol = kantoor). ' +
    'Daarna: Implementeren > Nieuwe implementatie > Web-app (Uitvoeren als: Ik, Toegang: Iedereen).';
  try { SpreadsheetApp.getUi().alert(tekst); } catch (e) { Logger.log(tekst); }
}
