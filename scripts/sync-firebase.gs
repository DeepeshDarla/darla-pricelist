// ─────────────────────────────────────────
// Darla Pricelist — Google Sheets → Firebase RTDB sync
// Paste this entire file into Extensions → Apps Script
// ─────────────────────────────────────────

var FIREBASE_URL    = "https://pricelist-qr-codes-default-rtdb.asia-southeast1.firebasedatabase.app";
var FIREBASE_SECRET = "julQ7MTvwAcS4YFF4V1mlMgbkS1LdBwoG6O2BAJl";

var CATEGORIES = {
  "Fabric":        "fabric",
  "Hangers":       "hangers",
  "Blinds":        "blinds",
  "Wallpapers":    "wallpapers",
  "Motors":        "motors",
  "Beds":          "beds",
  "Flooring":      "sleepwell",    // tab renamed; RTDB path stays "sleepwell"
  "Rods & Tracks": "rods"          // new tab + new RTDB path
};

// ─────────────────────────────────────────
// SANITIZERS
// ─────────────────────────────────────────
function sk(str) {
  return String(str||"").trim()
    .replace(/[^a-zA-Z0-9\-_]/g,"_")
    .replace(/_+/g,"_")
    .replace(/^_+|_+$/g,"")
    || "_";
}
function sv(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return "";
  return String(val).trim();
}

// ─────────────────────────────────────────
// TRIGGERS
// ─────────────────────────────────────────
function onSheetEdit(e) {
  PropertiesService.getScriptProperties().setProperty("needsSync", "true");
}
function autoSync() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty("needsSync") === "true") {
    Logger.log("Change detected — syncing...");
    syncAll();
    props.setProperty("needsSync", "false");
  } else {
    Logger.log("No changes — skipping");
  }
}

// ─────────────────────────────────────────
// SYNC ALL — run individually if timeout
// ─────────────────────────────────────────
function syncAll() {
  Logger.log("=== SYNC ALL STARTED ===");
  syncFabric();
  syncHangers();
  syncBlinds();
  syncWallpapers();
  syncMotors();
  syncBeds();
  syncFlooring();
  syncRods();
  Logger.log("=== SYNC ALL COMPLETE ===");
}

function syncFabric()     { syncCategory("Fabric"); }
function syncHangers()    { syncCategory("Hangers"); }
function syncBlinds()     { syncCategory("Blinds"); }
function syncWallpapers() { syncCategory("Wallpapers"); }
function syncMotors()     { syncCategory("Motors"); }
function syncBeds()       { syncCategory("Beds"); }
function syncFlooring()   { syncCategory("Flooring"); }      // was syncSleepwell
function syncRods()       { syncCategory("Rods & Tracks"); } // new

// ─────────────────────────────────────────
// GENERIC CATEGORY SYNC
// ─────────────────────────────────────────
function syncCategory(tabName) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var node = CATEGORIES[tabName];
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) { Logger.log("Tab not found: " + tabName); return; }
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) { Logger.log("No data: " + tabName); return; }
  var headers = data[0].map(function(h) { return sv(h).toLowerCase(); });
  var rows    = data.slice(1).filter(function(r) { return sv(r[0]) !== ""; });
  Logger.log("Syncing " + tabName + " — " + rows.length + " rows");
  syncCategoryData(node, headers, rows);
  Logger.log(tabName + " complete");
}

// ─────────────────────────────────────────
// CORE SYNC
// ─────────────────────────────────────────
function syncCategoryData(node, headers, rows) {

  function getVal(r, h) {
    var i = headers.indexOf(h);
    return i > -1 ? sv(r[i]) : "";
  }
  function codeKey(raw) {
    return String(raw||"").trim().toUpperCase().replace(/[^A-Z0-9\-]/g, "");
  }

  var byCode = {}, byBrand = {}, bcm = {}, bcsm = {}, brandOrig = {};

  rows.forEach(function(r) {
    var rawCode = sv(r[0]);
    var code    = codeKey(rawCode);
    if (!code) return;

    // Build Firebase record — every header becomes a safe snake_case key
    var obj = { code: rawCode.trim() };
    headers.forEach(function(h, i) {
      if (!h || h === "qr code") return;
      var safeKey = h.replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
      if (safeKey) obj[safeKey] = sv(r[i]);
    });

    // ── by_code index ──
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push(obj);

    // ── by_brand 3-level hierarchy ──
    // For most categories the first level is Brand.
    // For Flooring (sleepwell) and Rods, Category is the first level.
    var brand = getVal(r, "brand");
    var bKey, cKey, sKey, cLabel, sLabel;

    if (node === "fabric" || node === "hangers") {
      bKey   = sk(brand) || "_";
      cKey   = sk(getVal(r, "catalog")) || "_";
      cLabel = getVal(r, "catalog");
      sKey   = sk(getVal(r, "s_no") || getVal(r, "s.no")) || "_";
      sLabel = getVal(r, "s_no") || getVal(r, "s.no");

    } else if (node === "wallpapers") {
      // Brand → Catalog → Design Details  (was wrongly using s_no before)
      bKey   = sk(brand) || "_";
      cKey   = sk(getVal(r, "catalog")) || "_";
      cLabel = getVal(r, "catalog");
      sKey   = sk(getVal(r, "design details")) || "_";
      sLabel = getVal(r, "design details");

    } else if (node === "blinds") {
      bKey   = sk(brand) || "_";
      cKey   = sk(getVal(r, "blind type")) || "_";
      cLabel = getVal(r, "blind type");
      sKey   = sk(getVal(r, "catalog")) || "_";
      sLabel = getVal(r, "catalog");

    } else if (node === "motors") {
      bKey   = sk(brand) || "_";
      cKey   = sk(getVal(r, "category")) || "_";
      cLabel = getVal(r, "category");
      sKey   = sk(getVal(r, "product")) || "_";
      sLabel = getVal(r, "product");

    } else if (node === "beds") {
      bKey   = sk(brand) || "_";
      cKey   = sk(getVal(r, "model")) || "_";
      cLabel = getVal(r, "model");
      sKey   = sk(getVal(r, "size")) || "_";
      sLabel = getVal(r, "size");

    } else if (node === "sleepwell") {
      // Flooring: Category → Brand → Catalog  (Item is a record field, not a path level)
      var catVal = getVal(r, "category");
      brand  = catVal;
      bKey   = sk(catVal) || "_";
      cKey   = sk(getVal(r, "brand")) || "_";
      cLabel = getVal(r, "brand");
      sKey   = sk(getVal(r, "catalog")) || "_";
      sLabel = getVal(r, "catalog");

    } else if (node === "rods") {
      // Rods & Tracks: Category → Product → Colour  (Style is a record field)
      var catVal = getVal(r, "category");
      brand  = catVal;
      bKey   = sk(catVal) || "_";
      cKey   = sk(getVal(r, "product")) || "_";
      cLabel = getVal(r, "product");
      sKey   = sk(getVal(r, "colour")) || "_";
      sLabel = getVal(r, "colour");

    } else {
      // Fallback: Brand → Catalog → S.No
      bKey   = sk(brand) || "_";
      cKey   = sk(getVal(r, "catalog")) || "_";
      cLabel = getVal(r, "catalog");
      sKey   = sk(getVal(r, "s_no") || getVal(r, "s.no")) || "_";
      sLabel = getVal(r, "s_no") || getVal(r, "s.no");
    }

    if (!brand) return; // skip rows with no first-level key

    // Nest into byBrand
    if (!byBrand[bKey]) byBrand[bKey] = {};
    if (!byBrand[bKey][cKey]) byBrand[bKey][cKey] = {};
    if (!byBrand[bKey][cKey][sKey]) byBrand[bKey][cKey][sKey] = [];
    byBrand[bKey][cKey][sKey].push(obj);

    // Meta maps
    brandOrig[bKey] = brand;
    if (!bcm[bKey]) bcm[bKey] = {};
    if (cKey && cKey !== "_") {
      bcm[bKey][cKey] = cLabel;
      var metaKey = bKey + "|||" + cKey;
      if (!bcsm[metaKey]) bcsm[metaKey] = {};
      if (sKey && sKey !== "_") {
        bcsm[metaKey][sKey] = sLabel;
      }
    }
  });

  // ── Push by_code in batches of 400 ──
  var codes     = Object.keys(byCode);
  var batchSize = 400;
  Logger.log(node + " — " + codes.length + " unique codes");
  for (var i = 0; i < codes.length; i += batchSize) {
    var batch = {};
    codes.slice(i, i + batchSize).forEach(function(c) { batch[c] = byCode[c]; });
    var resp = UrlFetchApp.fetch(
      FIREBASE_URL + "/" + node + "/by_code.json?auth=" + FIREBASE_SECRET,
      { method: "PATCH", contentType: "application/json",
        payload: JSON.stringify(batch), muteHttpExceptions: true }
    );
    var batchNum = Math.floor(i / batchSize) + 1;
    var batchTotal = Math.ceil(codes.length / batchSize);
    Logger.log(node + " by_code batch " + batchNum + "/" + batchTotal + " — " + resp.getResponseCode());
    if (resp.getResponseCode() !== 200)
      Logger.log("FAILED: " + resp.getContentText().substring(0, 300));
  }

  // ── Push by_brand (one PUT per brand key) ──
  var brandKeys = Object.keys(byBrand);
  brandKeys.forEach(function(bKey) {
    var resp = UrlFetchApp.fetch(
      FIREBASE_URL + "/" + node + "/by_brand/" + bKey + ".json?auth=" + FIREBASE_SECRET,
      { method: "PUT", contentType: "application/json",
        payload: JSON.stringify(byBrand[bKey]), muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200)
      Logger.log("by_brand FAILED for " + bKey + ": " + resp.getContentText().substring(0, 200));
  });
  Logger.log(node + " by_brand done — " + brandKeys.length + " brand keys");

  // ── Push meta ──
  var brandList = Object.keys(brandOrig).sort().map(function(b) {
    return { key: b, label: brandOrig[b] };
  });
  var bcmArr = {}, bcsmArr = {};
  Object.keys(bcm).sort().forEach(function(b) {
    bcmArr[b] = Object.keys(bcm[b]).sort().map(function(c) {
      return { key: c, label: bcm[b][c] };
    });
    bcmArr[b].forEach(function(c) {
      var mk = b + "|||" + c.key;
      bcsmArr[mk] = Object.keys(bcsm[mk] || {}).sort().map(function(s) {
        return { key: s, label: bcsm[mk][s] };
      });
    });
  });
  var meta  = { brandList: brandList, bcmArr: bcmArr, bcsmArr: bcsmArr };
  var mResp = UrlFetchApp.fetch(
    FIREBASE_URL + "/" + node + "/meta.json?auth=" + FIREBASE_SECRET,
    { method: "PUT", contentType: "application/json",
      payload: JSON.stringify(meta), muteHttpExceptions: true }
  );
  Logger.log(node + " meta — " + brandList.length + " top-level keys — HTTP " + mResp.getResponseCode());
}

// ─────────────────────────────────────────
// NUCLEAR RESET — wipes Firebase then re-syncs everything
// Use when hierarchy changes require a clean slate (e.g. Flooring restructure)
// ─────────────────────────────────────────
function nuclearResetAndSync() {
  Logger.log("=== WIPING FIREBASE ===");
  var toDelete = [
    "fabric","hangers","blinds","wallpapers","motors","beds",
    "sleepwell","rods",
    "mattress","mattresses","by_code","by_brand","meta","test"
  ];
  toDelete.forEach(function(cat) {
    UrlFetchApp.fetch(
      FIREBASE_URL + "/" + cat + ".json?auth=" + FIREBASE_SECRET,
      { method: "DELETE", muteHttpExceptions: true }
    );
    Logger.log("Deleted: " + cat);
  });
  Utilities.sleep(2000);
  Logger.log("=== SYNCING ALL ===");
  syncAll();
  Logger.log("=== DONE ===");
}
