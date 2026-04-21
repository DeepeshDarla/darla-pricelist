// ═══════════════════════════════════════════════════════════════════
// quote-calc.js — Darla Quote Builder
// Pure calculation functions + pricing config
// No DOM access, no UI logic
// ═══════════════════════════════════════════════════════════════════

// ── PRICING CONFIG ─────────────────────────────────────────────────
// Change any price here — nowhere else in the code
var PRICES = {
  // Curtains
  stitchingPerMtr:     60,   // All curtain layers, all styles
  beltPcs:              2,   // Number of belt pieces per window (Main only)
  beltPerPc:          100,   // ₹ per belt piece
  bottomWtLenPerPanel: 1.5,  // Metres of bottom weight per panel (Sheer only)
  bottomWtPerMtr:      60,   // ₹ per metre bottom weight
  elizaTapeLen:         1.5, // Metres per panel
  elizaTapePerMtr:    350,
  rippleTapeLen:        1.5,
  rippleTapePerMtr:   150,
  eyeletTapeLen:        1.5,
  eyeletTapePerMtr:   350,
  eyeletRingsEach:     15,
  eyeletRingsPerPanel: 12,   // Rings per panel

  // Roman Blinds
  romanMechanism:     475,   // ₹ per sqft
  romanLining:        200,   // ₹ per metre
  romanInstall:       350,   // ₹ per window
  romanStitching:     350,   // ₹ per window
};

// ── HELPERS ────────────────────────────────────────────────────────
function r2(v, s) { return Math.round(v / s) * s; }
function trimDec(n) { return parseFloat(n.toFixed(2)); }
function fmt(n) { return '\u20B9' + Number(Math.round(n || 0)).toLocaleString('en-IN'); }
function esc(t) {
  if (!t) return '';
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── MAIN DISPATCH ──────────────────────────────────────────────────
function calcComp(win, comp) {
  if (!comp.product || !win) return {};
  var mrp    = parseFloat(comp.product.mrp) || 0;
  var w      = parseFloat(win.width)  || 0;
  var h      = parseFloat(win.height) || 0;
  var qty    = parseInt(win.qty)      || 1;
  var tt     = comp.treatmentType || 'curtains';
  var layer  = comp.layer        || 'main';
  var style  = comp.stitchStyle  || 'Pleated';

  if (tt === 'curtains')     return calcCurtains(w, h, mrp, qty, layer, style);
  if (tt === 'roman_blinds') return calcRoman(w, h, mrp, qty);
  if (tt === 'blinds')       return calcBlinds(w, h, mrp, qty);
  return calcCurtains(w, h, mrp, qty, layer, style);
}

// ── CURTAINS ───────────────────────────────────────────────────────
// Returns: {numPanels, panelLen, fabricQty, lines[], unitTotal, total}
function calcCurtains(w, h, mrp, qty, layer, style) {
  style = style || 'Pleated';
  var divisor = (style === 'Plain') ? 48 : 24;
  var p = Math.ceil((w + 10) / divisor);
  var l = trimDec(r2((h + 16) / 39, 0.05));
  var f = trimDec(Math.round(p * l * 100) / 100);

  var lines = [];

  // 1. Fabric
  lines.push({ lbl: 'Fabric', qty: f + ' mtrs', rate: mrp, amt: Math.round(f * mrp) });

  // 2. Stitching — all styles, all layers
  lines.push({ lbl: 'Stitching', qty: f + ' mtrs', rate: PRICES.stitchingPerMtr,
    amt: Math.round(f * PRICES.stitchingPerMtr) });

  // 3. Layer-specific base
  if (layer === 'sheer') {
    var bwAmt = Math.round(p * PRICES.bottomWtLenPerPanel * PRICES.bottomWtPerMtr);
    lines.push({ lbl: 'Bottom Weight',
      qty: p + ' \xd7 ' + PRICES.bottomWtLenPerPanel + 'm',
      rate: PRICES.bottomWtPerMtr, amt: bwAmt });
  } else {
    lines.push({ lbl: 'Belt Stitching',
      qty: PRICES.beltPcs + ' pcs',
      rate: PRICES.beltPerPc,
      amt: PRICES.beltPcs * PRICES.beltPerPc });
  }

  // 4. Style tape/rings
  if (style === 'Eliza') {
    lines.push({ lbl: 'Eliza Tape',
      qty: p + ' \xd7 ' + PRICES.elizaTapeLen + 'm',
      rate: PRICES.elizaTapePerMtr,
      amt: Math.round(p * PRICES.elizaTapeLen * PRICES.elizaTapePerMtr) });
  } else if (style === 'Ripple') {
    lines.push({ lbl: 'Ripple Tape',
      qty: p + ' \xd7 ' + PRICES.rippleTapeLen + 'm',
      rate: PRICES.rippleTapePerMtr,
      amt: Math.round(p * PRICES.rippleTapeLen * PRICES.rippleTapePerMtr) });
  } else if (style === 'Eyelet') {
    lines.push({ lbl: 'Eyelet Tape',
      qty: p + ' \xd7 ' + PRICES.eyeletTapeLen + 'm',
      rate: PRICES.eyeletTapePerMtr,
      amt: Math.round(p * PRICES.eyeletTapeLen * PRICES.eyeletTapePerMtr) });
    lines.push({ lbl: 'Eyelet Rings',
      qty: p + ' \xd7 ' + PRICES.eyeletRingsPerPanel + ' nos',
      rate: PRICES.eyeletRingsEach,
      amt: Math.round(p * PRICES.eyeletRingsPerPanel * PRICES.eyeletRingsEach) });
  }

  var unitTotal = lines.reduce(function(s, l) { return s + l.amt; }, 0);
  return {
    numPanels: p, panelLen: l, fabricQty: f,
    lines: lines,
    unitTotal: unitTotal,
    total: Math.round(unitTotal * qty)
  };
}

// ── ROMAN BLINDS ───────────────────────────────────────────────────
function calcRoman(w, h, mrp, qty) {
  var wf = r2(w / 12, 0.25), hf = r2(h / 12, 0.25);
  var sq = Math.round(wf * hf * 100) / 100;
  var mechanism   = Math.round(sq * PRICES.romanMechanism);
  var p           = Math.ceil(w / 48);
  var l           = trimDec(r2((h + 20) / 39, 0.05));
  var f           = trimDec(Math.round(p * l * 100) / 100);
  var fabricCost  = Math.round(f * mrp);
  var lining      = Math.round(f * PRICES.romanLining);
  var install     = PRICES.romanInstall;
  var stitching   = PRICES.romanStitching;
  var unitTotal   = mechanism + fabricCost + lining + install + stitching;
  return {
    sqft: sq, matCost: mechanism,
    panels: p, panelLen: l, fabricQty: f,
    fabCost: fabricCost, lining: lining,
    installation: install, stitching: stitching,
    unitTotal: unitTotal,
    total: Math.round(unitTotal * qty)
  };
}

// ── BLINDS ─────────────────────────────────────────────────────────
function calcBlinds(w, h, mrp, qty) {
  var sq = r2(w / 12, 0.25) * r2(h / 12, 0.25);
  sq = Math.round(sq * 100) / 100;
  return { sqft: sq, unitTotal: Math.round(sq * mrp), total: Math.round(sq * mrp * qty) };
}

// ── APPLY DISCOUNT ─────────────────────────────────────────────────
// Returns {gross, discountPct, discountAmt, net}
function applyDiscount(total, discountPct) {
  var pct  = parseFloat(discountPct) || 0;
  var dAmt = pct > 0 ? Math.round(total * pct / 100) : 0;
  return { gross: total, discountPct: pct, discountAmt: dAmt, net: total - dAmt };
}

// ── TOTALS ─────────────────────────────────────────────────────────
function compGross(c, win, ttype) {
  if (!c.product) return 0;
  return calcComp(win, Object.assign({}, c, { treatmentType: ttype })).total || 0;
}
function compNet(c, win, ttype) {
  var gross = compGross(c, win, ttype);
  return applyDiscount(gross, c.discount).net;
}
function roomNet(room) {
  var t = 0;
  room.windows.forEach(function(win) {
    win.treatments.forEach(function(tx) {
      tx.components.forEach(function(c) { t += compNet(c, win, tx.type); });
    });
  });
  return t;
}
function grandNet() {
  var t = 0;
  APP.quote.rooms.forEach(function(r) { t += roomNet(r); });
  return t;
}
function grandGross() {
  var t = 0;
  APP.quote.rooms.forEach(function(r) {
    r.windows.forEach(function(win) {
      win.treatments.forEach(function(tx) {
        tx.components.forEach(function(c) { t += compGross(c, win, tx.type); });
      });
    });
  });
  return t;
}
function totalDiscount() { return grandGross() - grandNet(); }
