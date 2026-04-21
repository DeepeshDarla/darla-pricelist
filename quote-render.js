// ═══════════════════════════════════════════════════════════════════
// quote-render.js — Darla Quote Builder
// App state, rendering, navigation, save/load
// Requires: quote-calc.js loaded first
// ═══════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════
var ASU = "https://script.google.com/macros/s/AKfycbx9A43LVU7Ikyxj5MNgRAnCvf9PSR5GisthNyC9oc_ye56OkTag32IUXstlDXtoWJ6v/exec";

var STAFF = [{name:"Deepesh Darla",pin:"1516"}];
var APP   = {staff:null, quote:blankQ()};

function blankQ(){
  return {id:null,date:new Date().toLocaleDateString("en-IN"),staff:"",staff2:"",customer:{name:"",mobile:"",arch:"",addr:""},rooms:[],saved:false};
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
window.addEventListener("DOMContentLoaded",function(){
  try{ init(); }catch(e){ console.error(e); }
});

function init(){
  buildStaffDrop();
  // Add touch feedback to PIN buttons — iOS :active is unreliable
  document.querySelectorAll(".pk").forEach(function(btn){
    btn.addEventListener("touchstart", function(e){
      this.classList.add("pressed");
    }, {passive:true});
    btn.addEventListener("touchend", function(e){
      var self = this;
      setTimeout(function(){ self.classList.remove("pressed"); }, 120);
    }, {passive:true});
    btn.addEventListener("touchcancel", function(){
      this.classList.remove("pressed");
    }, {passive:true});
  });

  var sel = localStorage.getItem("darla_selected_product");
  var ctx = localStorage.getItem("quote_product_ctx");
  if(sel && ctx){
    try{
      var draft = localStorage.getItem("darla_quote_draft");
      if(draft) APP.quote = JSON.parse(draft);
      attachProd(JSON.parse(ctx), JSON.parse(sel));
      localStorage.removeItem("darla_selected_product");
      localStorage.removeItem("quote_product_ctx");
      var sf = localStorage.getItem("darla_quote_staff");
      if(sf){ APP.staff=JSON.parse(sf); setStaffLabel(); }
      goTo("screen-builder");
      var sp = parseInt(localStorage.getItem("darla_scroll_pos")||"0");
      localStorage.removeItem("darla_scroll_pos");
      if(sp > 0) setTimeout(function(){ window.scrollTo(0, sp); }, 100);
      showToast("Product added \u2713");
    }catch(e){ goTo("screen-login"); }
    loadStaff(); // refresh staff list in background even when returning from search
    return;
  }

  var lid = qp("load");
  if(lid){ loadById(lid); return; }

  loadStaff();
}

function qp(n){ return new URLSearchParams(window.location.search).get(n)||""; }

// ═══════════════════════════════════════════════════════
// STAFF
// ═══════════════════════════════════════════════════════
function buildStaffDrop(){
  var el = document.getElementById("staffSel");
  if(!el || !STAFF.length) return;
  el.innerHTML = '<option value="">— Select Staff Member —</option>';
  STAFF.forEach(function(s){
    var o=document.createElement("option"); o.value=s.name; o.textContent=s.name; el.appendChild(o);
  });
}

function loadStaff(){
  // cache first
  try{
    var c=localStorage.getItem("darla_staff_cache");
    if(c){var l=JSON.parse(c);if(l&&l.length){STAFF=l;buildStaffDrop();}}
  }catch(e){}
  if(!ASU||ASU.indexOf("YOUR_")===0) return;
  fetch(ASU+"?action=getStaff&t="+Date.now())
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.staff&&d.staff.length){
        STAFF=d.staff;
        localStorage.setItem("darla_staff_cache",JSON.stringify(d.staff));
        buildStaffDrop();
      }
    }).catch(function(){});
}

// ═══════════════════════════════════════════════════════
// LOGIN / PIN
// ═══════════════════════════════════════════════════════
var pinBuf="", pickedStaff=null;

function onStaffPick(){
  var n=document.getElementById("staffSel").value;
  pickedStaff=STAFF.find(function(s){return s.name.trim().toLowerCase()===n.trim().toLowerCase()})||null;
  pinBuf=""; dotUpdate();
  document.getElementById("pinErr").textContent="";
  document.getElementById("loginSub").textContent=n?"Enter your PIN":"Select your name to continue";
}

function pk(k){
  if(!pickedStaff){document.getElementById("pinErr").textContent="Select your name first";return;}
  if(pinBuf.length>=4) return;
  pinBuf+=k; dotUpdate();
  if(pinBuf.length===4) setTimeout(checkPin,100);
}
function pd(){pinBuf=pinBuf.slice(0,-1);dotUpdate();}

function dotUpdate(err){
  for(var i=0;i<4;i++){
    var d=document.getElementById("pd"+i);if(!d)continue;
    d.className="dot";
    if(err)d.classList.add("err");
    else if(i<pinBuf.length)d.classList.add("on");
  }
}

function checkPin(){
  if(!pickedStaff)return;
  if(pinBuf===pickedStaff.pin){
    APP.staff=pickedStaff;
    localStorage.setItem("darla_quote_staff",JSON.stringify(APP.staff));
    setStaffLabel();
    clearForm();
    goTo("screen-customer");
  } else {
    dotUpdate(true);
    document.getElementById("pinErr").textContent="Incorrect PIN — try again";
    setTimeout(function(){pinBuf="";dotUpdate();document.getElementById("pinErr").textContent="";},1200);
  }
}

function skipLogin(){
  APP.staff={name:"Staff",pin:""};
  setStaffLabel();
  clearForm();
  goTo("screen-customer");
}

function setStaffLabel(){
  var el=document.getElementById("staffLabel");
  if(el&&APP.staff) el.textContent=APP.staff.name;
}

function clearForm(){
  APP.quote=blankQ();
  localStorage.removeItem("darla_quote_draft");
  ["cName","cMobile","cArch","cAddr","cSales1","cSales2"].forEach(function(id){var e=document.getElementById(id);if(e)e.value="";});
  var s1=document.getElementById("cSales1");
  if(s1&&APP.staff&&APP.staff.name) s1.value=APP.staff.name;
}

// ═══════════════════════════════════════════════════════
// START QUOTE
// ═══════════════════════════════════════════════════════
function startQuote(){
  var name=document.getElementById("cName").value.trim();
  var mob=document.getElementById("cMobile").value.trim();
  if(!name){showToast("Enter customer name");return;}
  if(!mob||mob.length<10){showToast("Enter valid mobile number");return;}
  APP.quote.customer={name:name,mobile:mob,arch:document.getElementById("cArch").value.trim(),addr:document.getElementById("cAddr").value.trim()};
  APP.quote.staff=document.getElementById("cSales1").value.trim()||(APP.staff?APP.staff.name:"Staff");
  APP.quote.staff2=document.getElementById("cSales2").value.trim();
  if(!APP.quote.id){APP.quote.id=nextId();APP.quote.date=new Date().toLocaleDateString("en-IN");}
  document.getElementById("bldName").textContent=name;
  document.getElementById("bldId").textContent=APP.quote.id;
  saveDraft();
  goTo("screen-builder");
}

// ═══════════════════════════════════════════════════════
// ROOMS
// ═══════════════════════════════════════════════════════
var PRESETS=["Living Room","Master Bedroom","Kids Room","Guest Room","Sons Room","Daughters Room","Parents Room","Home Theatre","Study","Kitchen","Dining Room","Pooja Room"];
var roomPreset="";

function openRoomModal(){
  roomPreset="";
  document.getElementById("mRoomName").value="";
  document.getElementById("roomPills").innerHTML=PRESETS.map(function(n){
    return '<div class="pill" onclick="pickPreset(this,&quot;'+n+'&quot;)">'+n+'</div>';
  }).join("");
  openModal("mRoom");
}

function pickPreset(el,n){
  document.querySelectorAll(".pill").forEach(function(p){p.classList.remove("on");});
  el.classList.add("on");
  roomPreset=n;
  document.getElementById("mRoomName").value="";
}

function confirmRoom(){
  var name=document.getElementById("mRoomName").value.trim()||roomPreset;
  if(!name){showToast("Select or enter a room name");return;}
  APP.quote.rooms.push({id:uid(),name:name,windows:[]});
  closeModal("mRoom");
  saveDraft();
  renderBld();
  var ri=APP.quote.rooms.length-1;
  setTimeout(function(){openWinModal(ri);},300);
}

function delRoom(ri){
  if(!confirm("Delete this room?"))return;
  APP.quote.rooms.splice(ri,1);
  saveDraft();renderBld();
}

// ═══════════════════════════════════════════════════════
// WINDOWS
// ═══════════════════════════════════════════════════════
// editingWin: null=new window, {ri,wi}=editing existing
var editingWin=null;

function openWinModal(ri){
  var room=APP.quote.rooms[ri];
  var num=room.windows.length+1;
  var prev=room.windows.length>0?room.windows[room.windows.length-1]:null;
  document.getElementById("mWinRi").value=ri;
  document.getElementById("mWinName").value="Window "+num;
  document.getElementById("mWinW").value="";
  document.getElementById("mWinH").value="";
  document.getElementById("mWinQ").value="1";
  document.getElementById("mWinR").value="";
  var hint=document.getElementById("mWinHint");
  var hasProd=prev&&prev.treatments&&prev.treatments.some(function(t){return t.components.some(function(c){return!!c.product;});});
  if(hint){hint.style.display=hasProd?"block":"none";if(hasProd)hint.textContent="\u2713 Products from Window "+(num-1)+" will be copied";}
  openModal("mWin");
}


function editWin(ri,wi){
  editingWin={ri:ri,wi:wi};
  var win=APP.quote.rooms[ri].windows[wi];
  document.getElementById("mWinRi").value=ri;
  document.getElementById("mWinName").value=win.name||"";
  document.getElementById("mWinW").value=win.width||"";
  document.getElementById("mWinH").value=win.height||"";
  document.getElementById("mWinQ").value=win.qty||1;
  document.getElementById("mWinR").value=win.remarks||"";
  var t=document.querySelector("#mWin .modal-title");
  if(t)t.textContent="Edit Window";
  var hint=document.getElementById("mWinHint");
  if(hint)hint.style.display="none";
  openModal("mWin");
}

function confirmWin(){
  var ri=parseInt(document.getElementById("mWinRi").value);
  var name=document.getElementById("mWinName").value.trim()||"Window "+(APP.quote.rooms[ri].windows.length+1);
  var w=parseFloat(document.getElementById("mWinW").value)||0;
  var h=parseFloat(document.getElementById("mWinH").value)||0;
  var q=parseInt(document.getElementById("mWinQ").value)||1;
  var rem=document.getElementById("mWinR").value.trim();
  if(!w||!h){showToast("Enter width and height");return;}
  if(editingWin){
    var win2=APP.quote.rooms[editingWin.ri].windows[editingWin.wi];
    if(name)win2.name=name; win2.width=w; win2.height=h; win2.qty=q; win2.remarks=rem;
    closeModal("mWin"); saveDraft(); renderBld();
    showToast("Window updated \u2713"); editingWin=null; return;
  }
  if(!name)name="Window "+(APP.quote.rooms[ri].windows.length+1);
  APP.quote.rooms[ri].windows.push({id:uid(),name:name,width:w,height:h,qty:q,remarks:rem,treatments:[]});
  closeModal("mWin");
  saveDraft();renderBld();
  var wi=APP.quote.rooms[ri].windows.length-1;
  setTimeout(function(){openTxModal(ri,wi);},300);
}

function delWin(ri,wi){
  if(!confirm("Remove this window?"))return;
  APP.quote.rooms[ri].windows.splice(wi,1);
  saveDraft();renderBld();
}

// ═══════════════════════════════════════════════════════
// TREATMENTS
// ═══════════════════════════════════════════════════════
function openTxModal(ri,wi){
  document.getElementById("mTxRi").value=ri;
  document.getElementById("mTxWi").value=wi;
  openModal("mTx");
}

function confirmTx(type){
  var ri=parseInt(document.getElementById("mTxRi").value);
  var wi=parseInt(document.getElementById("mTxWi").value);
  var room=APP.quote.rooms[ri];

  // Build treatment object with defaults
  var tx={id:uid(),type:type,components:[],stitchStyle:"Pleated",blindMode:"single"};

  // Auto-copy products from the most recent previous window with products
  if(wi>0){
    var srcComps=[];
    // Search previous windows in reverse for products to copy
    for(var pw=wi-1; pw>=0; pw--){
      var prevWin=room.windows[pw];
      if(!prevWin||!prevWin.treatments)continue;
      // Gather all Main+Sheer components with products from that window
      prevWin.treatments.forEach(function(pt){
        if(pt.type==="curtains"||pt.type==="roman_blinds"){
          pt.components.forEach(function(c){
            if(c.product&&(c.layer==="main"||c.layer==="sheer")){
              srcComps.push({layer:c.layer,product:c.product});
            }
          });
        }
      });
      if(srcComps.length>0)break; // Found products, stop
    }

    if(type==="curtains"&&srcComps.length>0){
      // Copy Main and Sheer components
      srcComps.forEach(function(sc){
        tx.components.push({id:uid(),layer:sc.layer,product:JSON.parse(JSON.stringify(sc.product)),stitchStyle:sc.stitchStyle||"Pleated",calc:{}});
      });
      showToast("Products copied from previous window \u2713");
    } else if(type==="roman_blinds"&&srcComps.length>0){
      // Default to double if prev window had both main+sheer, else single
      var hasMain=srcComps.some(function(c){return c.layer==="main";});
      var hasSheer=srcComps.some(function(c){return c.layer==="sheer";});
      tx.blindMode=hasSheer?"double":"single";
      // Copy based on mode — single=main only, double=main+sheer
      srcComps.forEach(function(sc){
        if(sc.layer==="main"||(sc.layer==="sheer"&&tx.blindMode==="double")){
          tx.components.push({id:uid(),layer:sc.layer,product:JSON.parse(JSON.stringify(sc.product)),stitchStyle:sc.stitchStyle||"Pleated",calc:{}});
        }
      });
      showToast("Products copied ("+tx.blindMode+") \u2713");
    }
    // blinds: no copy
  }

  room.windows[wi].treatments.push(tx);
  closeModal("mTx");
  saveDraft();renderBld();
}

function delTx(ri,wi,ti){
  APP.quote.rooms[ri].windows[wi].treatments.splice(ti,1);
  saveDraft();renderBld();
}

// ═══════════════════════════════════════════════════════
// COMPONENTS — addComp goes straight to product search
// ═══════════════════════════════════════════════════════
function addComp(ri,wi,ti,layer){
  APP.quote.rooms[ri].windows[wi].treatments[ti].components.push({id:uid(),layer:layer,product:null,discount:0,manualEntry:false,calc:{}});
  var ci=APP.quote.rooms[ri].windows[wi].treatments[ti].components.length-1;
  saveDraft();
  pickProduct(ri,wi,ti,ci);
}

function addCompManual(ri,wi,ti,layer){
  APP.quote.rooms[ri].windows[wi].treatments[ti].components.push({id:uid(),layer:layer,product:null,discount:0,manualEntry:true,calc:{}});
  saveDraft();
  renderBld();
  // Re-open the window and scroll to it after render
  setTimeout(function(){
    var winEl=document.getElementById("w_"+ri+"_"+wi);
    if(winEl){
      winEl.classList.add("open");
      winEl.scrollIntoView({behavior:"smooth",block:"start"});
    }
  },80);
}

// Manual product entry — called from inline form submit
function saveManualProduct(ri,wi,ti,ci){
  var brand   = (document.getElementById("mp_brand_"+ci)||{}).value||"";
  var catalog = (document.getElementById("mp_name_"+ci)||{}).value||"";
  var sno     = (document.getElementById("mp_sno_"+ci)||{}).value||"";
  var mrp     = parseFloat((document.getElementById("mp_mrp_"+ci)||{}).value)||0;
  if(!catalog&&!brand){ showToast("Enter at least a product name"); return; }
  if(!mrp){ showToast("Enter MRP"); return; }
  var comp = APP.quote.rooms[ri].windows[wi].treatments[ti].components[ci];
  comp.product = {brand:brand, catalog:catalog, s_no:sno, mrp:mrp, manual:true};
  comp.manualEntry = false; // collapse form
  saveDraft(); renderBld();
  showToast("Product saved \u2713");
}

// Toggle manual entry form
function toggleManualEntry(ri,wi,ti,ci){
  var comp = APP.quote.rooms[ri].windows[wi].treatments[ti].components[ci];
  comp.manualEntry = !comp.manualEntry;
  saveDraft(); renderBld();
}

// Update discount %
function updateDiscount(ri,wi,ti,ci,v){
  var comp = APP.quote.rooms[ri].windows[wi].treatments[ti].components[ci];
  var pct = parseFloat(v)||0;
  comp.discount = Math.min(100, Math.max(0, pct));
  saveDraft(); renderBld();
}

function delComp(ri,wi,ti,ci){
  APP.quote.rooms[ri].windows[wi].treatments[ti].components.splice(ci,1);
  saveDraft();renderBld();
}

function editMrp(ri,wi,ti,ci,v){
  var c=APP.quote.rooms[ri].windows[wi].treatments[ti].components[ci];
  if(!c||!c.product)return;
  var n=parseFloat(v);
  if(isNaN(n)||n<0)return;
  c.product.mrp=n;
  saveDraft();renderBld();
}

// ═══════════════════════════════════════════════════════
// PRODUCT SELECTION
// ═══════════════════════════════════════════════════════
function pickProduct(ri,wi,ti,ci){
  saveDraft();
  localStorage.setItem("darla_quote_staff",JSON.stringify(APP.staff));
  localStorage.setItem("quote_product_ctx",JSON.stringify({ri:ri,wi:wi,ti:ti,ci:ci}));
  // Save scroll position so we return to same spot
  localStorage.setItem("darla_scroll_pos", String(window.scrollY||0));
  var ttype=APP.quote.rooms[ri].windows[wi].treatments[ti].type;
  var cat=ttype==="blinds"?"blinds":"fabric";
  var base=window.location.href.split("?")[0];
  // Curtains: also allow switching to hangers tab in search
  var hangers=(ttype==="curtains")?"&allowHangers=1":"";
  window.location.href=base.replace("quote.html","index.html")+"?mode=quote&category="+cat+hangers+"&return="+encodeURIComponent(base);
}

function attachProd(ctx,prod){
  var c=APP.quote.rooms[ctx.ri].windows[ctx.wi].treatments[ctx.ti].components[ctx.ci];
  if(!c)return;
  c.product=prod;
  c.calc=calcComp(APP.quote.rooms[ctx.ri].windows[ctx.wi],c);
}

// ═══════════════════════════════════════════════════════
// CALCULATIONS — FIXED: consistent field names
// calcCurtains returns panelLen (was panelLength — renamed for consistency)
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// BUILDER RENDER
// ═══════════════════════════════════════════════════════
function renderBld(){
  var html="";
  APP.quote.rooms.forEach(function(room,ri){
    var wc=room.windows.length,rt=roomTotal(room);
    html+='<div class="room-card open" id="r_'+ri+'">'
      +'<div class="room-hdr" onclick="toggleRoom('+ri+')">'
      +'<div><div class="room-name">'+esc(room.name)+'</div>'
      +'<div class="room-meta">'+wc+' window'+(wc!==1?"s":"")+(rt?' &middot; <span class="room-total-inline">'+fmt(rt)+'</span>':'')+'</div></div>'
      +'<div class="room-toggle">&#8250;</div></div>'
      +'<div class="room-body">';
    room.windows.forEach(function(win,wi){html+=renderWin(win,ri,wi);});
    html+='<button class="btn btn-add" onclick="openWinModal('+ri+')" style="margin-top:8px">&#43; Add Window</button></div>'
      +'<div class="room-actions"><button class="btn btn-ghost btn-sm" onclick="delRoom('+ri+')" style="color:#ff6b6b;border-color:#3a1010">&#128465; Delete Room</button></div></div>';
  });
  document.getElementById("roomsWrap").innerHTML=html;
  // Re-open any windows that are within open rooms (all rooms auto-open)
  // Windows are open by default in renderWin — no extra work needed
}

function renderWin(win,ri,wi){
  var html='<div class="win-card open" id="w_'+ri+'_'+wi+'">'
    +'<div class="win-hdr" onclick="toggleWin(&quot;w_'+ri+'_'+wi+'&quot;)">'
    +'<div class="win-num">'+(wi+1)+'</div>'
    +'<div class="win-info"><div class="win-title">'+esc(win.name)+'</div>'
    +'<div class="win-dims">'+win.width+'" W \xd7 '+win.height+'" H &nbsp;&middot;&nbsp; Qty: '+win.qty+(win.remarks?' &middot; '+esc(win.remarks):'')+'</div></div>'
    +'<div style="display:flex;align-items:center;gap:5px"><button class="btn btn-ghost btn-sm" style="padding:5px 10px;font-size:11px" onclick="event.stopPropagation();editWin('+ri+','+wi+')">&#9998;</button><div class="win-toggle">&#8250;</div></div>'
    +'<div class="win-body">';
  win.treatments.forEach(function(t,ti){html+=renderTx(t,ri,wi,ti,win);});
  html+='<button class="btn btn-add" onclick="openTxModal('+ri+','+wi+')" style="margin:8px 0 4px">&#43; Add Treatment</button>'
    +'<button class="btn btn-ghost btn-sm" onclick="delWin('+ri+','+wi+')" style="width:100%;color:#ff6b6b;border-color:#3a1010">Remove Window</button>'
    +'</div></div>';
  return html;
}

function renderTx(t,ri,wi,ti,win){
  var lbl=t.type==="curtains"?"Curtains":t.type==="roman_blinds"?"Roman Blinds":"Blinds";
  var C=ri+","+wi+","+ti;
  t.components.forEach(function(c){c.treatmentType=t.type;});
  var hasc=t.components.length>0;
  var bm=t.blindMode||"single";

  var html='<div class="tx-card"><div class="tx-head">'
    +'<span class="tx-badge '+t.type+'">'
    +lbl+'</span>'
    +'<button class="btn btn-ghost btn-sm" style="padding:4px 10px;font-size:11px;color:#ff6b6b;border-color:#3a1010" onclick="delTx('+C+')">&#10005;</button>'
    +'</div>';

  // Stitching style moved to component level
    if(t.type==="roman_blinds"){
    html+='<div class="tx-meta-row">'
      +'<span class="tx-meta-lbl">Type</span>'
      +'<div class="blind-mode-toggle">'
      +'<button class="bmt-btn'+(bm==="single"?" active":"")+'" onclick="setBlindMode('+ri+','+wi+','+ti+',&quot;single&quot;)">Single</button>'
      +'<button class="bmt-btn'+(bm==="double"?" active":"")+'" onclick="setBlindMode('+ri+','+wi+','+ti+',&quot;double&quot;)">Double</button>'
      +'</div></div>';
  }

  if(!hasc){
    if(t.type==="curtains"||t.type==="roman_blinds"){
      var showSheer=(t.type==="curtains")||(t.type==="roman_blinds"&&bm==="double");
      html+='<div class="next-wrap"><div class="next-lbl">Add fabric layers</div>';
      // Main row
      html+='<div style="margin-bottom:7px"><div style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:#666;text-transform:uppercase;margin-bottom:5px">MAIN</div>'
        +'<div class="next-row">'
        +'<button class="nab nab-main" onclick="addComp('+C+',&quot;main&quot;)">&#128269; Search</button>'
        +'<button class="nab nab-window" onclick="addCompManual('+C+',&quot;main&quot;)">&#9998; Manual</button>'
        +'</div></div>';
      // Sheer row
      if(showSheer){
        html+='<div><div style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:#666;text-transform:uppercase;margin-bottom:5px">SHEER</div>'
          +'<div class="next-row">'
          +'<button class="nab nab-sheer" onclick="addComp('+C+',&quot;sheer&quot;)">&#128269; Search</button>'
          +'<button class="nab nab-window" onclick="addCompManual('+C+',&quot;sheer&quot;)">&#9998; Manual</button>'
          +'</div></div>';
      }
      html+='</div>';
    } else {
      html+='<div class="next-row">'
        +'<button class="nab nab-blind" style="flex:2" onclick="addComp('+C+',&quot;blind&quot;)">&#128269; Search Blind</button>'
        +'<button class="nab nab-window" style="flex:1" onclick="addCompManual('+C+',&quot;blind&quot;)">&#9998; Manual</button>'
        +'</div>';
    }
  }

  t.components.forEach(function(c,ci){html+=renderComp(c,ri,wi,ti,ci,win,t);});

  if(hasc){
    var hm=t.components.some(function(c){return c.layer==="main";});
    var hs=t.components.some(function(c){return c.layer==="sheer";});
    var allowSheer=(t.type==="curtains")||(t.type==="roman_blinds"&&bm==="double");
    html+='<div class="next-wrap"><div class="next-lbl">What\'s next?</div>';

    if(t.type==="curtains"||t.type==="roman_blinds"){
      // Show Search/Manual for any missing layer
      if(!hm){
        html+='<div style="margin-bottom:6px"><div style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:#666;text-transform:uppercase;margin-bottom:4px">ADD MAIN</div>'
          +'<div class="next-row">'
          +'<button class="nab nab-main" onclick="addComp('+C+',&quot;main&quot;)">&#128269; Search</button>'
          +'<button class="nab nab-window" onclick="addCompManual('+C+',&quot;main&quot;)">&#9998; Manual</button>'
          +'</div></div>';
      }
      if(!hs&&allowSheer){
        html+='<div style="margin-bottom:6px"><div style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:#666;text-transform:uppercase;margin-bottom:4px">ADD SHEER</div>'
          +'<div class="next-row">'
          +'<button class="nab nab-sheer" onclick="addComp('+C+',&quot;sheer&quot;)">&#128269; Search</button>'
          +'<button class="nab nab-window" onclick="addCompManual('+C+',&quot;sheer&quot;)">&#9998; Manual</button>'
          +'</div></div>';
      }
      if(hm&&(hs||!allowSheer)){
        html+='<div class="nab-done">&#10003; '+(allowSheer&&hs?"Main &amp; Sheer added":"Main fabric added")+"</div>";
      }
    } else {
      html+='<div class="next-row">'
        +'<button class="nab nab-blind" style="flex:2" onclick="addComp('+C+',&quot;blind&quot;)">&#128269; Add Another</button>'
        +'<button class="nab nab-window" style="flex:1" onclick="addCompManual('+C+',&quot;blind&quot;)">&#9998; Manual</button>'
        +'</div>';
    }
    html+='<div class="next-row" style="margin-top:8px">'
      +'<button class="nab nab-window" onclick="openWinModal('+ri+')">&#43; Window</button>'
      +'<button class="nab nab-room" onclick="openRoomModal()">&#43; Room</button>'
      +'</div></div>';
  }
  html+='</div>';
  return html;
}

function setTxStyle(ri,wi,ti,v){ // kept for compatibility
  APP.quote.rooms[ri].windows[wi].treatments[ti].stitchStyle=v;
  saveDraft();renderBld();
}
function setCompStyle(ri,wi,ti,ci,v){
  APP.quote.rooms[ri].windows[wi].treatments[ti].components[ci].stitchStyle=v;
  saveDraft();renderBld();
}

function setBlindMode(ri,wi,ti,mode){
  var tx=APP.quote.rooms[ri].windows[wi].treatments[ti];
  tx.blindMode=mode;
  // If switching to single, remove sheer components
  if(mode==="single"){
    tx.components=tx.components.filter(function(c){return c.layer!=="sheer";});
  }
  saveDraft();renderBld();
}

function renderComp(c,ri,wi,ti,ci,win,t){
  var calc=c.product?calcComp(win,Object.assign({},c,{treatmentType:t.type})):{};
  c.calc=calc;
  var isSheer=(c.layer==="sheer");
  var isCurtain=(t.type==="curtains");
  var cs=c.stitchStyle||"Pleated";
  var disc=c.discount||0;

  var html='<div class="comp-card"><div class="comp-hdr">'
    +'<span class="comp-layer-tag '+c.layer+'">'+(c.layer==="blind"?"BLIND":c.layer.toUpperCase())+'</span>'
    +'<button class="comp-del" onclick="delComp('+ri+','+wi+','+ti+','+ci+')">&#128465;</button>'
    +'</div>';

  // Stitching style selector — curtains only
  if(isCurtain){
    html+='<div class="tx-meta-row">'
      +'<span class="tx-meta-lbl">Stitch</span>'
      +'<select class="tx-style-sel" onchange="setCompStyle('+ri+','+wi+','+ti+','+ci+',this.value)">';
    ["Pleated","Eliza","Ripple","Eyelet","Plain"].forEach(function(s){
      html+='<option value="'+s+'"'+(cs===s?' selected':'')+'>'+s+'</option>';
    });
    html+='</select></div>';
  }

  // ── No product yet ──
  if(!c.product){
    if(c.manualEntry){
      // Manual entry form
      html+='<div class="manual-entry-form">'
        +'<div class="field" style="margin-bottom:8px"><label class="field-label">Brand</label>'
        +'<input class="inp" id="mp_brand_'+ci+'" placeholder="e.g. Ddecor" style="font-size:14px;padding:9px 12px"></div>'
        +'<div class="field" style="margin-bottom:8px"><label class="field-label">Product / Catalog *</label>'
        +'<input class="inp" id="mp_name_'+ci+'" placeholder="e.g. Adore" style="font-size:14px;padding:9px 12px"></div>'
        +'<div class="field" style="margin-bottom:8px"><label class="field-label">S.No / Code</label>'
        +'<input class="inp" id="mp_sno_'+ci+'" placeholder="e.g. 10Ddecor" style="font-size:14px;padding:9px 12px"></div>'
        +'<div class="field" style="margin-bottom:8px"><label class="field-label">MRP (per '+(t.type==="blinds"?"sqft":"mtr")+') *</label>'
        +'<input class="inp" id="mp_mrp_'+ci+'" type="number" placeholder="0" inputmode="decimal" style="font-size:14px;padding:9px 12px"></div>'
        +'<div class="btn-row">'
        +'<button class="btn btn-ghost btn-sm" style="margin-top:0" onclick="toggleManualEntry('+ri+','+wi+','+ti+','+ci+')">Cancel</button>'
        +'<button class="btn btn-sm" style="margin-top:0" onclick="saveManualProduct('+ri+','+wi+','+ti+','+ci+')">Save Product</button>'
        +'</div></div>';
    } else {
      html+='<div class="btn-row" style="margin-top:4px">'
        +'<button class="btn btn-sm" style="flex:2;background:#141414;border:1.5px dashed #383838;color:#aaa;box-shadow:none" onclick="pickProduct('+ri+','+wi+','+ti+','+ci+')">&#128269; Search Product</button>'
        +'<button class="btn btn-ghost btn-sm" style="flex:1;margin-top:0" onclick="toggleManualEntry('+ri+','+wi+','+ti+','+ci+')">&#9998; Manual</button>'
        +'</div>';
    }
    html+='</div>';
    return html;
  }

  // ── Product exists ──
  var p=c.product;
  var brand=p.brand||"";
  var catalog=p.catalog||p.product||p.blind_type||p.model||"";
  var sno=p.s_no||p["s.no"]||"";
  var unitLbl=t.type==="blinds"?"sqft":"mtr";
  var nameParts=[brand,catalog,sno].filter(Boolean);

  html+='<div class="comp-product-name">'+esc(nameParts.join(" / "))+'</div>';

  // MRP edit
  html+='<div class="comp-mrp-row">'
    +'<span class="comp-mrp-lbl">MRP /'+unitLbl+'</span>'
    +'<input class="comp-mrp-inp" type="number" value="'+esc(String(p.mrp||0))+'" min="0" step="0.5" inputmode="decimal" onchange="editMrp('+ri+','+wi+','+ti+','+ci+',this.value)" onclick="this.select()">'
    +'</div>';

  if(calc&&calc.total){
    html+='<div class="comp-calc">';

    if(t.type==="curtains"){
      html+='<div class="calc-row" style="font-size:11px;color:#555;margin-bottom:4px">'
        +'<span class="l">'+calc.numPanels+' panels \xd7 '+calc.panelLen+'m = '+calc.fabricQty+' mtrs</span></div>';
      (calc.lines||[]).forEach(function(ln){
        html+='<div class="calc-row">'
          +'<span class="l">'+ln.lbl+'</span>'
          +'<span class="v" style="display:flex;gap:6px;align-items:baseline">'
          +'<span style="font-size:10px;color:#666;white-space:nowrap">'+ln.qty+' \xd7 '+fmt(ln.rate)+'</span>'
          +'<span>=</span><span>'+fmt(ln.amt)+'</span></span></div>';
      });
    } else if(t.type==="roman_blinds"){
      html+='<div class="calc-row"><span class="l">Area</span><span class="v">'+calc.sqft+' sqft</span></div>';
      [
        {lbl:"Mechanism",   qtyStr:calc.sqft+" sqft",  rate:PRICES.romanMechanism, amt:calc.matCost},
        {lbl:"Panels",      qtyStr:calc.panels+" \xd7 "+calc.panelLen+"m = "+calc.fabricQty+"m", rate:null, amt:null},
        {lbl:"Fabric",      qtyStr:calc.fabricQty+"m", rate:p.mrp, amt:calc.fabCost},
        {lbl:"Lining",      qtyStr:calc.fabricQty+"m", rate:PRICES.romanLining, amt:calc.lining},
        {lbl:"Installation",qtyStr:"1 window",         rate:PRICES.romanInstall, amt:calc.installation},
        {lbl:"Stitching",   qtyStr:"1 window",         rate:PRICES.romanStitching, amt:calc.stitching}
      ].forEach(function(ln){
        if(ln.amt===null){
          html+='<div class="calc-row" style="font-size:11px;color:#555"><span class="l">'+ln.qtyStr+'</span></div>';
        } else {
          html+='<div class="calc-row"><span class="l">'+ln.lbl+'</span>'
            +'<span class="v" style="display:flex;gap:6px;align-items:baseline">'
            +'<span style="font-size:10px;color:#666;white-space:nowrap">'+ln.qtyStr+' \xd7 '+fmt(ln.rate)+'</span>'
            +'<span>=</span><span>'+fmt(ln.amt)+'</span></span></div>';
        }
      });
    } else {
      html+='<div class="calc-row"><span class="l">Area</span><span class="v">'+calc.sqft+' sqft</span></div>';
      html+='<div class="calc-row"><span class="l">Blind fabric</span>'
        +'<span class="v" style="display:flex;gap:6px;align-items:baseline">'
        +'<span style="font-size:10px;color:#666">'+calc.sqft+' sqft \xd7 '+fmt(p.mrp)+'</span>'
        +'<span>=</span><span>'+fmt(calc.unitTotal)+'</span></span></div>';
    }

    if((parseInt(win.qty)||1)>1){
      html+='<div class="calc-row" style="border-top:1px solid #1e1e1e;margin-top:4px;padding-top:4px">'
        +'<span class="l">Unit total</span><span class="v">'+fmt(calc.unitTotal)+'</span></div>'
        +'<div class="calc-row"><span class="l">\xd7 '+win.qty+' windows</span>'
        +'<span class="v">'+fmt(calc.total)+'</span></div>';
    }

    // Gross total
    html+='<div class="calc-row total"><span class="l">Gross Total</span><span class="v">'+fmt(calc.total)+'</span></div>';

    // Discount row
    html+='<div class="calc-row" style="margin-top:6px;align-items:center">'
      +'<span class="l">Discount %</span>'
      +'<span class="v" style="display:flex;align-items:center;gap:6px">'
      +'<input type="number" min="0" max="100" step="1" value="'+disc+'" inputmode="decimal" '
      +'style="background:#0a0a0a;border:1px solid #333;border-radius:6px;color:#fff;'
      +'font-size:13px;font-weight:700;width:56px;padding:4px 8px;text-align:right;outline:none;'
      +'-webkit-text-fill-color:#fff!important;-webkit-appearance:none" '
      +'onchange="updateDiscount('+ri+','+wi+','+ti+','+ci+',this.value)" onclick="this.select()">'
      +'<span style="color:#666;font-size:11px">%</span></span></div>';

    if(disc>0){
      var d=applyDiscount(calc.total,disc);
      html+='<div class="calc-row" style="color:#f39c12">'
        +'<span class="l">Discount</span>'
        +'<span class="v" style="color:#f39c12">-'+fmt(d.discountAmt)+'</span></div>';
      html+='<div class="calc-row" style="background:#0a1a0a;border-radius:6px;padding:5px 7px;margin-top:4px">'
        +'<span class="l" style="font-weight:800;color:#81c784">Net Total</span>'
        +'<span class="v" style="font-size:16px;font-weight:900;color:#81c784">'+fmt(d.net)+'</span></div>';
    }

    html+='</div>'; // comp-calc
  }

  html+='<div class="btn-row" style="margin-top:8px">'
    +'<button class="btn btn-ghost btn-sm" style="flex:1;margin-top:0;font-size:11px" onclick="pickProduct('+ri+','+wi+','+ti+','+ci+')">&#128269; Change</button>'
    +'<button class="btn btn-ghost btn-sm" style="flex:1;margin-top:0;font-size:11px" onclick="toggleManualEntry('+ri+','+wi+','+ti+','+ci+')">&#9998; Edit</button>'
    +'</div></div>';
  return html;
}

function toggleRoom(ri){var e=document.getElementById("r_"+ri);if(e)e.classList.toggle("open");}
function toggleWin(id){var e=document.getElementById(id);if(e)e.classList.toggle("open");}

// ═══════════════════════════════════════════════════════
// TOTALS
// ═══════════════════════════════════════════════════════
function compTotal(c,win,ttype){
  if(!c.product)return 0;
  var gross=calcComp(win,Object.assign({},c,{treatmentType:ttype})).total||0;
  return applyDiscount(gross,c.discount||0).net;
}
function roomTotal(room){
  var t=0;
  room.windows.forEach(function(win){win.treatments.forEach(function(tx){tx.components.forEach(function(c){t+=compTotal(c,win,tx.type);});});});
  return t;
}
function grandTotal(){
  var t=0;APP.quote.rooms.forEach(function(r){t+=roomTotal(r);});return t;
}
function grandGrossTotal(){
  var t=0;
  APP.quote.rooms.forEach(function(r){r.windows.forEach(function(win){win.treatments.forEach(function(tx){tx.components.forEach(function(c){
    if(!c.product)return;
    t+=calcComp(win,Object.assign({},c,{treatmentType:tx.type})).total||0;
  });});});});
  return t;
}

// ═══════════════════════════════════════════════════════
// SUMMARY — includes print-ready HTML structure
// ═══════════════════════════════════════════════════════
function renderSum(){
  var q=APP.quote,gt=grandTotal();
  var h="";

  // ── SCREEN: quote badge ──
  h+='<div class="qid-badge no-print">Quote Reference<span>'+esc(q.id||"\u2014")+'</span></div>';

  // ── PRINT HEADER (all modes) ──
  h+='<div class="print-only print-hdr">'
    +'<div class="print-brand"><div class="name">DARLA</div><div class="tag">Sales &amp; Agencies &middot; Mysore</div></div>'
    +'<div class="print-qinfo"><div class="qid">'+esc(q.id||"\u2014")+'</div><div class="date">'+esc(q.date)+'</div></div>'
    +'</div>';

  // ── CUSTOMER BLOCK ──
  h+='<div class="sum-cust">'
    +'<div class="sum-field"><span class="l">Customer</span><span class="v">'+esc(q.customer.name)+'</span></div>'
    +'<div class="sum-field"><span class="l">Mobile</span><span class="v">'+esc(q.customer.mobile)+'</span></div>'
    +(q.customer.arch?'<div class="sum-field"><span class="l">Designer</span><span class="v">'+esc(q.customer.arch)+'</span></div>':""  )
    +(q.customer.addr?'<div class="sum-field"><span class="l">Project</span><span class="v">'+esc(q.customer.addr)+'</span></div>':""  )
    +'<div class="sum-field"><span class="l">Salesman 1</span><span class="v">'+esc(q.staff||"")+'</span></div>'
    +(q.staff2?'<div class="sum-field"><span class="l">Salesman 2</span><span class="v">'+esc(q.staff2)+'</span></div>':""  )
    +'<div class="sum-field"><span class="l">Date</span><span class="v">'+esc(q.date)+'</span></div>'
    // Print columns
    +'<div class="cust-print-col print-only">'
    +'<h4>Customer</h4>'
    +'<div class="cname">'+esc(q.customer.name)+'</div>'
    +'<div class="cval">'+esc(q.customer.mobile)+'</div>'
    +(q.customer.addr?'<div class="cval" style="font-size:8pt;color:#666">'+esc(q.customer.addr)+'</div>':""  )
    +'</div>'
    +'<div class="cust-print-col cust-print-right print-only">'
    +'<h4>Staff</h4>'
    +(q.customer.arch?'<div class="cval"><span class="clabel">Designer</span>'+esc(q.customer.arch)+'</div>':""  )
    +'<div class="cval"><span class="clabel">Salesman</span>'+esc(q.staff||"")+'</div>'
    +(q.staff2?'<div class="cval"><span class="clabel">Salesman 2</span>'+esc(q.staff2)+'</div>':""  )
    +'</div>'
    +'</div>';

  // ── ROOMS ──
  q.rooms.forEach(function(room){
    var rt=roomTotal(room);
    h+='<div class="sum-room">'
      +'<div class="sum-room-hdr"><span class="sum-room-name">'+esc(room.name)+'</span><span class="sum-room-total price-col">'+fmt(rt)+'</span></div>';

    room.windows.forEach(function(win,wi){
      var wt=0;
      // Build print left column calc lines
      var printCalcLines=[];
      win.treatments.forEach(function(tx){
        tx.components.forEach(function(c){
          if(!c.product)return;
          var cc=calcComp(win,Object.assign({},c,{treatmentType:tx.type}));
          wt+=cc.total||0;
          if(tx.type==="blinds"){
            printCalcLines.push({k:"BLIND Area",v:(cc.sqft||0)+" sqft"});
          } else if(tx.type==="roman_blinds"){
            printCalcLines.push({k:c.layer.toUpperCase()+" panels",v:(cc.panels||0)+" \xd7 "+(cc.panelLen||0)+"m = "+(cc.fabricQty||0)+" mtrs"});
          } else {
            // Curtains — use calc.lines for accurate panel count per style
            var np=cc.numPanels||0, pl=cc.panelLen||0, fq=cc.fabricQty||0;
            printCalcLines.push({k:c.layer.toUpperCase()+" panels",v:np+" \xd7 "+pl+"m = "+fq+" mtrs"});
          }
        });
      });

      h+='<div class="sum-win-block">';

      // ── LEFT: Measurements (print) ──
      h+='<div class="win-print-left win-meas-block print-only">'
        +'<div style="display:flex;align-items:center;gap:2mm;margin-bottom:1mm">'
        +'<span class="win-badge">'+(wi+1)+'</span>'
        +'<span class="sum-win-title">'+esc(win.name)+'</span></div>'
        +'<div class="sum-win-dims">'+win.width+'" \xd7 '+win.height+'" Qty:'+win.qty+'</div>'
        +'<div class="print-meas">';
      printCalcLines.forEach(function(cl){
        h+='<div class="print-meas-row"><span class="k">'+cl.k+'</span><span class="mv">'+cl.v+'</span></div>';
      });
      h+='</div></div>';

      // ── RIGHT: Selections ──
      h+='<div class="win-print-right">'
        // On-screen window title
        +'<div class="no-print" style="margin-bottom:4px">'
        +'<div class="sum-win-title-row"><span class="win-badge">'+(wi+1)+'</span><span class="sum-win-title">'+esc(win.name)+'</span></div>'
        +'<div class="sum-win-dims">'+win.width+'&quot; W \xd7 '+win.height+'&quot; H &nbsp;&middot;&nbsp; Qty: '+win.qty+'</div>'
        +'</div>'
        // Selection sheet: window title visible
        +'<div class="print-only" style="margin-bottom:1mm">'
        +'<div style="display:flex;align-items:center;gap:2mm"><span class="win-badge">'+(wi+1)+'</span>'
        +'<b style="font-size:9pt">'+esc(win.name)+'</b></div>'
        +'</div>';

      win.treatments.forEach(function(tx){
        var txLbl=tx.type==="curtains"?"Curtains":tx.type==="roman_blinds"?"Roman Blinds":"Blinds";
        var hasItems=tx.components.some(function(c){return!!c.product;});
        if(!hasItems)return;
        var styleNote=(tx.type==="curtains"&&tx.stitchStyle)?" ("+tx.stitchStyle+")":"";
        var modeNote=(tx.type==="roman_blinds"&&tx.blindMode)?" ("+tx.blindMode+")":"";
        h+='<div class="sum-tx-lbl">'+(txLbl+styleNote+modeNote)+'</div>';
        tx.components.forEach(function(c){
          if(!c.product)return;
          var cc=calcComp(win,Object.assign({},c,{treatmentType:tx.type}));
          var p=c.product;
          var brand=p.brand||"";
          var catalog=p.catalog||p.product||p.blind_type||p.model||"";
          var sno=p.s_no||p["s.no"]||"";
          var nameLine=[brand,catalog,sno].filter(Boolean).join(" / ");
          var styleNote=(tx.type==="curtains"&&c.stitchStyle)?" ["+c.stitchStyle+"]":"";
          var qtyLbl=tx.type==="blinds"?(cc.sqft||0)+" sqft":(cc.fabricQty||0)+" mtrs";
          h+='<div class="sum-comp-row">'
            +'<div class="sum-comp-info">'
            +'<span class="tag">'+(c.layer==="blind"?"BLIND":c.layer.toUpperCase())+'</span>'
            +'<div class="name">'+esc(nameLine)+esc(styleNote)+'</div>'
            // Quote mode: show all line items
            +'<div class="sum-comp-lines quote-only">';
          if(tx.type==="curtains"&&cc.lines){
            cc.lines.forEach(function(ln){
              h+='<div style="display:flex;justify-content:space-between;font-size:10pt;padding:0.3mm 0">'
                +'<span style="color:#555">'+ln.lbl+'</span>'
                +'<span style="color:#555;font-size:9pt">'+ln.qty+' &times; '+fmt(ln.rate)+'</span>'
                +'<span style="font-weight:700">'+fmt(ln.amt)+'</span></div>';
            });
          } else if(tx.type==="roman_blinds"){
            [{lbl:"Mechanism",qty:cc.sqft+" sqft",rate:475,amt:cc.matCost},
             {lbl:"Fabric",qty:cc.fabricQty+"m",rate:p.mrp,amt:cc.fabCost},
             {lbl:"Lining",qty:cc.fabricQty+"m",rate:200,amt:cc.lining},
             {lbl:"Installation",qty:"1 win",rate:350,amt:cc.installation},
             {lbl:"Stitching",qty:"1 win",rate:350,amt:cc.stitching}
            ].forEach(function(ln){
              h+='<div style="display:flex;justify-content:space-between;font-size:10pt;padding:0.3mm 0">'
                +'<span style="color:#555">'+ln.lbl+'</span>'
                +'<span style="color:#555;font-size:9pt">'+ln.qty+' &times; '+fmt(ln.rate)+'</span>'
                +'<span style="font-weight:700">'+fmt(ln.amt)+'</span></div>';
            });
          }
          h+='</div>'
            +'<div class="detail price-col">'+fmt(p.mrp||0)+(tx.type==="blinds"?"/sqft":"/mtr")+" &middot; "+qtyLbl+'</div>'
            +'</div>'
            +'<div class="sum-comp-amt price-col">'+fmt(cc.total||0)+'</div>'
            +'</div>';
        });
      });

      if(wt>0){
        h+='<div class="win-sub-line">'
          +'<span class="win-sub-lbl">Window '+(wi+1)+' Total</span>'
          +'<span class="win-sub-val price-col">'+fmt(wt)+'</span>'
          +'</div>';
      }
      h+='</div>'; // win-print-right
      h+='</div>'; // sum-win-block
    });

    if(rt>0){
      h+='<div class="room-sub-footer price-col"><span class="l">'+esc(room.name)+' Sub-total</span><span class="v">'+fmt(rt)+'</span></div>';
    }
    h+='</div>'; // sum-room
  });

  var gross=grandGrossTotal();
  var totalDisc=gross-gt;
  if(totalDisc>0){
    h+='<div class="grand-card price-col">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      +'<span class="grand-lbl" style="margin-bottom:0">Original Total (MRP)</span>'
      +'<span style="font-size:18pt;font-weight:800;color:#555;text-decoration:line-through">'+fmt(gross)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      +'<span style="font-size:9pt;font-weight:800;letter-spacing:1.5pt;text-transform:uppercase;color:#f39c12">Total Discount</span>'
      +'<span style="font-size:16pt;font-weight:800;color:#f39c12">-'+fmt(totalDisc)+'</span></div>'
      +'<div style="border-top:1px solid #333;padding-top:10px;text-align:center">'
      +'<div class="grand-lbl">Your Price</div>'
      +'<div class="grand-val">'+Number(Math.round(gt)).toLocaleString("en-IN")+'</div>'
      +'</div>'
      +'<div class="grand-sub">After applicable discounts, inclusive of all charges</div>'
      +'</div>';
  } else {
    h+='<div class="grand-card price-col"><div class="grand-lbl">Grand Total (MRP)</div>'
      +'<div class="grand-val">'+Number(Math.round(gt)).toLocaleString("en-IN")+'</div>'
      +'<div class="grand-sub">All prices are MRP inclusive of all charges</div></div>';
  }

  h+='<div class="terms-card"><div class="title">Terms &amp; Notes</div>'
    +'<div class="body">'
    +'&bull; All prices are MRP. Final prices subject to confirmation.<br>'
    +'&bull; Quantities auto-calculated from window dimensions.<br>'
    +'&bull; Fabric subject to stock availability at time of order.<br>'
    +'&bull; Delivery: 3&ndash;4 weeks from order confirmation.<br>'
    +'&bull; This is a selection reference, not a final invoice.'
    +'</div></div>';

  document.getElementById("sumContent").innerHTML=h;
  var si=document.getElementById("sumId");
  if(si) si.textContent=APP.quote.id||"";
}

function printMode(mode){
  // Set print mode attribute and trigger print
  document.body.setAttribute("data-pmode", mode);
  // Small delay to allow CSS to apply
  setTimeout(function(){ window.print(); }, 80);
  // Reset after print dialog closes
  setTimeout(function(){ document.body.removeAttribute("data-pmode"); }, 3000);
}


function saveDraft(){
  localStorage.setItem("darla_quote_draft",JSON.stringify(APP.quote));
  // Debounce cloud save — fires 4 seconds after last change
  if(window._autoSaveTimer) clearTimeout(window._autoSaveTimer);
  if(APP.quote&&APP.quote.id&&cloudOK()){
    window._autoSaveTimer=setTimeout(function(){
      cloudSave(function(ok){
        if(ok) showToast("\u2713 Auto-saved");
      });
    },4000);
  }
}

function cloudSave(cb){
  if(!cloudOK()||!APP.quote||!APP.quote.id){if(cb)cb(false);return;}
  saveToList();
  fetch(ASU,{
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify({action:"saveQuote",quote:APP.quote})
  }).then(function(r){return r.json();})
    .then(function(d){APP.quote.saved=true;saveDraft();if(cb)cb(true);})
    .catch(function(){if(cb)cb(false);});
}

function saveToList(){
  var q=APP.quote; if(!q.id)return;
  var gt=grandTotal();
  var list=getList().filter(function(e){return e.id!==q.id;});
  list.unshift({id:q.id,date:q.date,staff:q.staff||"",staff2:q.staff2||"",name:q.customer.name||"",mobile:q.customer.mobile||"",arch:q.customer.arch||"",addr:q.customer.addr||"",total:gt,rooms:q.rooms.length,updated:new Date().toLocaleString("en-IN"),draft:JSON.stringify(q)});
  if(list.length>200)list=list.slice(0,200);
  localStorage.setItem("darla_quotes_list",JSON.stringify(list));
}

function getList(){try{return JSON.parse(localStorage.getItem("darla_quotes_list")||"[]");}catch(e){return[];}}
function cloudOK(){return ASU&&ASU.indexOf("YOUR_")!==0;}

function saveQuote(){
  saveDraft();saveToList();
  if(!cloudOK()){showToast("Saved locally \u2713 "+APP.quote.id);return;}
  fetch(ASU,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"saveQuote",quote:APP.quote})})
    .then(function(r){return r.json();})
    .then(function(){APP.quote.saved=true;saveDraft();saveToList();showToast("\u2713 Saved \u2014 "+APP.quote.id);})
    .catch(function(){showToast("Saved locally (offline)");});
}

function saveAndList(){
  saveDraft();saveToList();
  if(cloudOK())fetch(ASU,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"saveQuote",quote:APP.quote})}).catch(function(){});
  switchTab("all");
}

function saveAndExit(){
  saveDraft();saveToList();
  if(cloudOK())fetch(ASU,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"saveQuote",quote:APP.quote})}).then(function(){showToast("Saved \u2713");}).catch(function(){showToast("Saved locally");});
  switchTab("all");
}

function loadById(id){
  var local=getList().find(function(q){return q.id===id;});
  if(local&&local.draft){applyQ(JSON.parse(local.draft));showToast("Loaded: "+id);return;}
  if(!cloudOK()){showToast("Not found locally");return;}
  showToast("Loading...");
  fetch(ASU+"?action=loadQuote&id="+encodeURIComponent(id))
    .then(function(r){return r.json();})
    .then(function(d){if(d.quote){applyQ(d.quote);saveToList();showToast("Loaded: "+id);}else{showToast("Not found: "+id);}})
    .catch(function(){showToast("Error loading");});
}

function applyQ(q){
  APP.quote=q;saveDraft();
  document.getElementById("cName").value=q.customer.name||"";
  document.getElementById("cMobile").value=q.customer.mobile||"";
  document.getElementById("cArch").value=q.customer.arch||"";
  document.getElementById("cAddr").value=q.customer.addr||"";
  var s1=document.getElementById("cSales1"),s2=document.getElementById("cSales2");
  if(s1)s1.value=q.staff||"";
  if(s2)s2.value=q.staff2||"";
  document.getElementById("bldName").textContent=q.customer.name;
  document.getElementById("bldId").textContent=q.id;
  document.getElementById("tabNew").classList.add("active");
  document.getElementById("tabAll").classList.remove("active");
  goTo("screen-builder");
}

function shareQuote(){
  var url=window.location.origin+window.location.pathname+"?load="+APP.quote.id;
  if(navigator.share){navigator.share({title:"Darla Quote - "+APP.quote.customer.name,text:"Quote "+APP.quote.id,url:url});}
  else if(navigator.clipboard){navigator.clipboard.writeText(url).then(function(){showToast("Link copied \u2713");});}
  else{showToast(url);}
}

// ═══════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════
function goTo(id){
  document.querySelectorAll(".screen").forEach(function(s){s.classList.remove("active");});
  var s=document.getElementById(id);if(s)s.classList.add("active");
  window.scrollTo(0,0);
  var showBar=id==="screen-builder"||id==="screen-summary";
  document.getElementById("bldBar").style.display=(id==="screen-builder")?"flex":"none";
  document.getElementById("sumBar").style.display=(id==="screen-summary")?"flex":"none";
  if(id==="screen-summary")renderSum();
  if(id==="screen-builder")renderBld();
  if(id==="screen-quotes")renderQList();
}

function switchTab(tab){
  if(tab==="all"){
    document.getElementById("tabNew").classList.remove("active");
    document.getElementById("tabAll").classList.add("active");
    goTo("screen-quotes");
  } else {
    clearForm();
    document.getElementById("tabNew").classList.add("active");
    document.getElementById("tabAll").classList.remove("active");
    goTo("screen-customer");
  }
}

function newQuoteBtn(){
  clearForm();
  document.getElementById("tabNew").classList.add("active");
  document.getElementById("tabAll").classList.remove("active");
  goTo("screen-customer");
}

// ═══════════════════════════════════════════════════════
// QUOTES LIST
// ═══════════════════════════════════════════════════════
var qFiltered=[],qCloud=[];

function renderQList(){
  var local=getList();
  local.sort(function(a,b){return(parseInt(b.id.replace(/\D/g,""))||0)-(parseInt(a.id.replace(/\D/g,""))||0);});
  qFiltered=local;
  drawQList(local,true);
  if(!cloudOK()){drawQList(local,false);return;}
  fetch(ASU+"?action=listQuotes")
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.quotes&&d.quotes.length>=0){
        qCloud=d.quotes;
        var merged=mergeQ(d.quotes);
        qFiltered=merged;
        drawQList(merged,false);
        var c=document.getElementById("qCount");if(c)c.textContent=merged.length+" quote"+(merged.length!==1?"s":"")+" \u00b7 cloud";
      } else drawQList(local,false);
    }).catch(function(){drawQList(local,false);});
}

function mergeQ(cloud){
  var lm={};getList().forEach(function(q){lm[q.id]=q;});
  var m=cloud.map(function(c){var l=lm[c.id];return Object.assign({},c,{draft:l?l.draft:null,fromCloud:true});});
  m.sort(function(a,b){return(parseInt(b.id.replace(/\D/g,""))||0)-(parseInt(a.id.replace(/\D/g,""))||0);});
  return m;
}

function filterQ(){
  var q=(document.getElementById("qSearch").value||"").trim().toLowerCase();
  if(!cloudOK()||!qCloud.length){
    var list=getList();
    list.sort(function(a,b){return(parseInt(b.id.replace(/\D/g,""))||0)-(parseInt(a.id.replace(/\D/g,""))||0);});
    qFiltered=q?list.filter(function(e){return["name","mobile","id","staff","staff2","arch"].some(function(k){return(e[k]||"").toLowerCase().indexOf(q)!==-1;});}):list;
    drawQList(qFiltered,false);return;
  }
  var sel=document.getElementById("qSearch");if(sel)sel.disabled=true;
  fetch(ASU+"?action=listQuotes&search="+encodeURIComponent(q))
    .then(function(r){return r.json();})
    .then(function(d){if(sel)sel.disabled=false;if(d.quotes){qFiltered=mergeQ(d.quotes);drawQList(qFiltered,false);}})
    .catch(function(){if(sel)sel.disabled=false;drawQList(getList(),false);});
}

function drawQList(list,loading){
  var el=document.getElementById("qList");if(!el)return;
  var cnt=document.getElementById("qCount");
  if(loading){el.innerHTML='<div class="q-empty"><div class="spin"></div>Loading quotes...</div>';if(cnt)cnt.textContent="Loading...";return;}
  if(cnt)cnt.textContent=list.length+" quote"+(list.length!==1?"s":"");
  if(!list.length){el.innerHTML='<div class="q-empty"><div class="ico">&#128196;</div>No quotes found<br><span style="font-size:13px;display:block;margin-top:6px">'+(!cloudOK()?"Save a quote to see it here.":"No cloud quotes yet.")+'</span></div>';return;}
  var h="";
  list.forEach(function(q,i){
    var total=q.total||0,rooms=q.rooms||0,hasLocal=!!q.draft;
    h+='<div class="q-card" onclick="openQ('+i+')">'
      +'<div class="q-top"><div class="q-left">'
      +'<div class="q-id">'+esc(q.id||"\u2014")
      +(q.fromCloud?'<span class="q-tag q-tag-cloud" style="margin-left:6px">CLOUD</span>':'')
      +(!hasLocal&&q.fromCloud?'<span class="q-tag q-tag-load" style="margin-left:4px">TAP TO LOAD</span>':'')
      +'</div>'
      +'<div class="q-name">'+esc(q.name||"Unknown")+'</div>'
      +'<div class="q-meta">'+esc(q.mobile||"")+(q.arch?' &middot; '+esc(q.arch):'')+'</div>'
      +'<div class="q-meta">'+esc(q.date||"")+'</div>'
      +'</div><div class="q-right">'
      +(total?'<div class="q-total">&#8377;'+Number(Math.round(total)).toLocaleString("en-IN")+'</div>':"")
      +'<button onclick="delQ('+i+',event)" class="q-del">&#128465;</button>'
      +'</div></div>'
      +'<div class="q-bottom">'
      +'<span class="q-tag q-tag-staff">&#128100; '+esc(q.staff||"Staff")+(q.staff2?' &amp; '+esc(q.staff2):'')+'</span>'
      +(rooms?'<span class="q-tag q-tag-rooms">'+rooms+' room'+(rooms!==1?"s":"")+'</span>':"")
      +'<span class="q-tag q-tag-rooms" style="margin-left:auto">'+esc(q.updated||q.date||"")+'</span>'
      +'</div></div>';
  });
  el.innerHTML=h;
}

function openQ(i){
  var e=qFiltered[i];if(!e)return;
  if(e.draft){try{applyQ(JSON.parse(e.draft));showToast("Opened: "+e.id);}catch(ex){showToast("Error opening");}return;}
  if(!cloudOK()){showToast("Cannot load — not configured");return;}
  showToast("Loading from cloud...");
  fetch(ASU+"?action=loadQuote&id="+encodeURIComponent(e.id))
    .then(function(r){return r.json();})
    .then(function(d){if(d.quote){e.draft=JSON.stringify(d.quote);saveQEntry(e);applyQ(d.quote);showToast("Loaded: "+e.id);}else{showToast("Not found in cloud");}})
    .catch(function(){showToast("Error loading");});
}

function saveQEntry(e){
  var list=getList(),found=false;
  list=list.map(function(q){if(q.id===e.id){found=true;return e;}return q;});
  if(!found)list.unshift(e);
  localStorage.setItem("darla_quotes_list",JSON.stringify(list));
}

function delQ(i,ev){
  ev.stopPropagation();
  var e=qFiltered[i];if(!e)return;
  if(!confirm("Delete "+e.id+" for "+e.name+"?"))return;
  localStorage.setItem("darla_quotes_list",JSON.stringify(getList().filter(function(q){return q.id!==e.id;})));
  qFiltered.splice(i,1);drawQList(qFiltered,false);showToast("Deleted "+e.id);
  if(cloudOK())fetch(ASU,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"deleteQuote",id:e.id})}).catch(function(){});
}

// ═══════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════
function openModal(id){document.getElementById(id).classList.add("open");}
function closeModal(id){document.getElementById(id).classList.remove("open");}

// ═══════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════
function uid(){return Math.random().toString(36).substr(2,8);}
function nextId(){var n=parseInt(localStorage.getItem("darla_qnum")||"99")+1;localStorage.setItem("darla_qnum",String(n));return "DRL-"+n;}
function esc(t){if(!t)return"";return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

// togglePrices replaced by printMode()

function showToast(msg){
  var t=document.getElementById("toast");
  t.textContent=msg;t.classList.add("show");
  setTimeout(function(){t.classList.remove("show");},2500);
}
