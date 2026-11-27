import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
const firebaseConfig = {
  apiKey: "AIzaSyCPFKeVPFpsFSdvnK6fjjhWfo8H949lon0",
  authDomain: "krokicol-gestor-produccion.firebaseapp.com",
  projectId: "krokicol-gestor-produccion",
  storageBucket: "krokicol-gestor-produccion.firebasestorage.app",
  messagingSenderId: "1076212200191",
  appId: "1:1076212200191:web:6c0b0b1ef071af136f52ca"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const recordsCollection = collection(db, "productionRecords");
let unsubscribeRecords = null;
let sizes = ["39","40","41","42"];
let records = [];
$("date").value = new Date().toISOString().slice(0,10);

// Acceso: la base de datos solo se consulta después de autenticar al usuario.
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("loginButton");
  $("loginMessage").textContent = "";
  button.disabled = true;
  button.textContent = "Ingresando…";
  try {
    await signInWithEmailAndPassword(auth, $("loginEmail").value.trim(), $("loginPassword").value);
  } catch (error) {
    const messages = {
      "auth/invalid-credential": "El correo o la contraseña no son correctos.",
      "auth/user-not-found": "No existe un usuario con ese correo.",
      "auth/wrong-password": "La contraseña no es correcta.",
      "auth/too-many-requests": "Demasiados intentos. Espera un momento y vuelve a intentarlo."
    };
    $("loginMessage").textContent = messages[error.code] || "No se pudo iniciar sesión. Verifica los datos y tu conexión.";
  } finally {
    button.disabled = false;
    button.textContent = "Ingresar";
  }
});

$("logoutButton").addEventListener("click", async () => {
  if (confirm("¿Quieres cerrar tu sesión?")) await signOut(auth);
});

onAuthStateChanged(auth, user => {
  if (unsubscribeRecords) { unsubscribeRecords(); unsubscribeRecords = null; }
  $("authScreen").hidden = !!user;
  $("homeScreen").hidden = !user;
  $("productionView").hidden = true;
  $("lineView").hidden = true;

  if (!user) { records = []; renderRecords(); return; }
  $("userEmail").textContent = user.email || "Usuario autorizado";
  unsubscribeRecords = onSnapshot(query(recordsCollection, orderBy("createdAt", "desc")), snapshot => {
    records = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderRecords();
    const status = $("connectionStatus");
    if (status) status.textContent = "· Datos sincronizados";
  }, error => {
    console.error("Error al sincronizar producción:", error);
    alert("No se pudieron cargar los registros. Revisa las reglas de Firestore y tu conexión.");
  });
});

function renderSizeInputs(){
  $("sizeInputs").innerHTML = sizes.map(s=>`<tr><td>${s}</td><td><input type="number" min="0" max="100" step="1" list="quantityOptions" class="int" data-size="${s}" placeholder="0"></td><td><input type="number" min="0" max="100" step="1" list="quantityOptions" class="bad" data-size="${s}" placeholder="0"></td><td class="good-cell" id="good-${s}">0</td></tr>`).join("");
  document.querySelectorAll(".int,.bad").forEach(el=>el.addEventListener("input", updateGoods));
}
function updateGoods(){
  sizes.forEach(s=>{
    const total = Number(document.querySelector(`.int[data-size="${s}"]`)?.value || 0);
    const bad = Number(document.querySelector(`.bad[data-size="${s}"]`)?.value || 0);
    $("good-"+s).textContent = Math.max(0,total-bad);
    $("good-"+s).style.color = bad>total ? "#b04438" : "";
  });
}
const availableSizes = Array.from({length:26}, (_,i)=>String(i+20)); // 20 a 45
let selectedSizes = new Set(["39","40","41","42"]);
let confirmedSizes = ["39","40","41","42"];
function compareSizes(a,b){
  const aSpecial = String(a).endsWith("*"), bSpecial = String(b).endsWith("*");
  const aNumber = Number(String(a).replace("*","")), bNumber = Number(String(b).replace("*",""));
  if(aSpecial !== bSpecial) return aSpecial ? 1 : -1;
  return aNumber - bNumber;
}


function renderSizePicker(){
  const makeOptions = special => availableSizes.map(n=>{
    const value = special ? `${n}*` : n;
    const checked = selectedSizes.has(value) ? "checked" : "";
    return `<label class="size-chip ${checked ? "is-selected" : ""}"><input type="checkbox" value="${value}" ${checked}><span>${value}</span></label>`;
  }).join("");
  $("normalSizeOptions").innerHTML = makeOptions(false);
  $("specialSizeOptions").innerHTML = makeOptions(true);
  document.querySelectorAll(".size-chip input").forEach(input=>{
    input.addEventListener("change",()=>{
      if(input.checked) selectedSizes.add(input.value); else selectedSizes.delete(input.value);
      input.closest(".size-chip").classList.toggle("is-selected",input.checked);
      $("selectedCount").textContent = `${selectedSizes.size} seleccionada${selectedSizes.size===1?"":"s"}`;
    });
  });
  $("selectedCount").textContent = `${selectedSizes.size} seleccionada${selectedSizes.size===1?"":"s"}`;
}

function openSizePicker(){
  selectedSizes = new Set(confirmedSizes);
  renderSizePicker();
  $("sizeModal").hidden = false;
}
function closeSizePicker(){ $("sizeModal").hidden = true; }
$("openSizePicker").addEventListener("click", openSizePicker);
$("closeSizePicker").addEventListener("click", closeSizePicker);
$("cancelSizePicker").addEventListener("click", closeSizePicker);
$("sizeModalBackdrop").addEventListener("click", closeSizePicker);
$("confirmSizePicker").addEventListener("click",()=>{
  if(!selectedSizes.size){alert("Selecciona al menos una talla para continuar.");return;}
  confirmedSizes = [...selectedSizes].sort(compareSizes);
  sizes = [...confirmedSizes];
  $("sizes").value = confirmedSizes.join(", ");
  renderSizeInputs();
  closeSizePicker();
});
function formatDate(date){const [year,month,day]=String(date).split("-");return `${day}/${month}/${year}`;}
function renderRecords(){
  $("countRows").textContent=records.length;
  $("recordsHead").innerHTML=`<tr><th>Fecha</th><th>Turno</th><th>Color</th><th>Operario</th>${sizes.map(s=>`<th>${s} INT</th><th>${s} BUENO</th><th>${s} MALO</th>`).join("")}<th>Acción</th></tr>`;
  $("recordsBody").innerHTML=records.length?records.map((r,i)=>`<tr><td>${formatDate(r.date)}</td><td>${r.shift}</td><td>${escapeHtml(r.color)}</td><td>${escapeHtml(r.operator)}</td>${sizes.map(s=>`<td>${r.values[s]?.int??""}</td><td>${r.values[s]?.good??""}</td><td>${r.values[s]?.bad??""}</td>`).join("")}<td><button class="text-button" data-delete="${i}">Eliminar</button></td></tr>`).join(""):`<tr><td class="empty" colspan="${5+sizes.length*3}">Todavía no hay registros. Agrega el primer operario.</td></tr>`;
  document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{
    const record = records[Number(b.dataset.delete)];
    if (!record?.id || !confirm("¿Eliminar este registro de producción?")) return;
    try { await deleteDoc(doc(db, "productionRecords", record.id)); }
    catch (error) { console.error(error); alert("No se pudo eliminar el registro. Inténtalo de nuevo."); }
  }));
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("addRecord").addEventListener("click",async()=>{
  const operator=$("operator").value.trim(), color=$("color").value.trim(), date=$("date").value;
  if(!operator||!color||!date){alert("Completa fecha, color y nombre del operario.");return;}
  const values={}; let hasData=false, invalid=false;
  sizes.forEach(s=>{
    const int=Number(document.querySelector(`.int[data-size="${s}"]`)?.value||0);
    const bad=Number(document.querySelector(`.bad[data-size="${s}"]`)?.value||0);
    if(int>0||bad>0)hasData=true;
    if(bad>int)invalid=true;
    values[s]={int,bad,good:int-bad};
  });
  if(!hasData){alert("Ingresa al menos una cantidad de inyectadas.");return;}
  if(invalid){alert("La cantidad de malas no puede ser mayor que las inyectadas.");return;}
  const newRecord = {product:$("product").value.trim(),lot:$("lot").value.trim(),date,shift:$("shift").value,color,operator,values,sizes:[...sizes],createdAt:serverTimestamp()};
  const addButton = $("addRecord");
  addButton.disabled = true;
  try {
    await addDoc(recordsCollection, newRecord);
    $("operator").value="";document.querySelectorAll(".int,.bad").forEach(e=>e.value="");updateGoods();$("operator").focus();
  } catch (error) { console.error(error); alert("No se pudo guardar en la nube. Verifica tu conexión y las reglas de Firestore."); }
  finally { addButton.disabled = false; }
});
$("clearInputs").addEventListener("click",()=>{$("operator").value="";document.querySelectorAll(".int,.bad").forEach(e=>e.value="");updateGoods();});
$("clearAll").addEventListener("click",async()=>{
  if (!records.length || !confirm("¿Eliminar TODOS los registros compartidos de producción? Esta acción afecta a todos los usuarios y no se puede deshacer.")) return;
  try {
    const snapshot = await getDocs(recordsCollection);
    const batch = writeBatch(db);
    snapshot.docs.forEach(item => batch.delete(item.ref));
    await batch.commit();
  } catch (error) { console.error(error); alert("No se pudieron eliminar todos los registros. Inténtalo de nuevo."); }
});
$("exportExcel").addEventListener("click", async ()=>{
  if(!records.length){alert("Primero agrega al menos un registro.");return;}
  if(typeof ExcelJS==="undefined"){alert("No se pudo cargar ExcelJS. Revisa tu conexión a internet.");return;}
  const allSizes=[...new Set(records.flatMap(r=>r.sizes||Object.keys(r.values)))].sort(compareSizes);
  const wb=new ExcelJS.Workbook();wb.creator="KROKICOL";wb.subject="Control de producción";
  const ws=wb.addWorksheet("Producción",{views:[{state:"frozen",xSplit:5,ySplit:4,showGridLines:false}]});
  const lastCol=5+allSizes.length*3+3;
  const shifts={"MAÑANA":"FF92D050","TARDE":"FFFFC000","NOCHE":"FF4472C4"};
  const border={top:{style:"thin",color:{argb:"FF9BA9A2"}},bottom:{style:"thin",color:{argb:"FF9BA9A2"}},left:{style:"thin",color:{argb:"FF9BA9A2"}},right:{style:"thin",color:{argb:"FF9BA9A2"}}};
  ws.mergeCells(1,1,2,lastCol);let title=ws.getCell(1,1);
  title.value=`${(records[0].product||"REGISTRO DE PRODUCCIÓN").toUpperCase()}  -  LOTE ${records[0].lot||"SIN LOTE"}`;
  title.font={name:"Arial",size:16,bold:true,color:{argb:"FFFFFFFF"}};title.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1687B8"}};title.alignment={vertical:"middle",horizontal:"center"};ws.getRow(1).height=25;ws.getRow(2).height=15;
  [["N.º",1],["TURNO",2],["FECHA",3],["COLOR",4],["OPERARIO",5]].forEach(([v,c])=>{ws.mergeCells(3,c,4,c);ws.getCell(3,c).value=v;});
  let c=6;allSizes.forEach(size=>{ws.mergeCells(3,c,3,c+2);ws.getCell(3,c).value=String(size);ws.getCell(4,c).value="INY";ws.getCell(4,c+1).value="BUENO";ws.getCell(4,c+2).value="MALO";c+=3;});
  ws.mergeCells(3,c,3,c+2);ws.getCell(3,c).value="TOTAL";ws.getCell(4,c).value="INY";ws.getCell(4,c+1).value="BUENO";ws.getCell(4,c+2).value="MALO";
  for(let r=3;r<=4;r++){ws.getRow(r).height=22;for(let x=1;x<=lastCol;x++){let q=ws.getCell(r,x);q.fill={type:"pattern",pattern:"solid",fgColor:{argb:r===3?"FF1687B8":"FFD9EAF2"}};q.font={name:"Arial",size:10,bold:true,color:{argb:r===3?"FFFFFFFF":"FF18332D"}};q.alignment={vertical:"middle",horizontal:"center",wrapText:true};q.border=border;}}
  records.forEach((rec,i)=>{const r=5+i,fill=shifts[rec.shift]||"FFFFFFFF";let x=6,ti=0,tb=0,tm=0;[i+1,rec.shift,new Date(Number(rec.date.slice(0,4)),Number(rec.date.slice(5,7))-1,Number(rec.date.slice(8,10))),rec.color,rec.operator].forEach((v,j)=>ws.getCell(r,j+1).value=v);ws.getCell(r,3).numFmt="dd/mm/yyyy";allSizes.forEach(size=>{const v=rec.values[size]||{int:0,good:0,bad:0};ws.getCell(r,x).value=Number(v.int||0);ws.getCell(r,x+1).value=Number(v.good||0);ws.getCell(r,x+2).value=Number(v.bad||0);ti+=Number(v.int||0);tb+=Number(v.good||0);tm+=Number(v.bad||0);x+=3;});ws.getCell(r,x).value=ti;ws.getCell(r,x+1).value=tb;ws.getCell(r,x+2).value=tm;ws.getRow(r).height=21;for(let k=1;k<=lastCol;k++){let q=ws.getCell(r,k);q.fill={type:"pattern",pattern:"solid",fgColor:{argb:fill}};q.font={name:"Arial",size:10,color:{argb:"FF1F2926"}};q.alignment={vertical:"middle",horizontal:k===4||k===5?"left":"center"};q.border=border;}for(let k=8;k<lastCol;k+=3){ws.getCell(r,k).font={name:"Arial",size:10,bold:true,color:{argb:"FF176B3A"}};ws.getCell(r,k+1).font={name:"Arial",size:10,color:{argb:"FFB04438"}};}for(let k=lastCol-2;k<=lastCol;k++){ws.getCell(r,k).font={name:"Arial",size:10,bold:true,color:{argb:"FF18332D"}};ws.getCell(r,k).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE8F0EC"}};}});
  const totalRow=5+records.length;ws.mergeCells(totalRow,1,totalRow,5);ws.getCell(totalRow,1).value="TOTAL";
  const letter=n=>{let out="";while(n){const z=(n-1)%26;out=String.fromCharCode(65+z)+out;n=Math.floor((n-1)/26);}return out;};
  for(let k=6;k<=lastCol;k++)ws.getCell(totalRow,k).value={formula:`SUM(${letter(k)}5:${letter(k)}${totalRow-1})`};
  ws.getRow(totalRow).height=24;for(let k=1;k<=lastCol;k++){let q=ws.getCell(totalRow,k);q.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFD9EAD3"}};q.font={name:"Arial",size:10,bold:true,color:{argb:"FF18332D"}};q.alignment={vertical:"middle",horizontal:"center"};q.border=border;}
  [7,13,14,20,20].forEach((w,i)=>ws.getColumn(i+1).width=w);for(let k=6;k<=lastCol;k++)ws.getColumn(k).width=11;
  ws.autoFilter={from:{row:3,column:1},to:{row:4+records.length,column:lastCol}};ws.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:ws.PAPER_SIZE_LETTER};ws.headerFooter.oddFooter="KROKICOL · Página &P de &N";
  const sum=wb.addWorksheet("Resumen",{views:[{showGridLines:false}]});sum.mergeCells("A1:D1");sum.getCell("A1").value="RESUMEN GENERAL DE PRODUCCIÓN";sum.getCell("A1").font={bold:true,size:15,color:{argb:"FFFFFFFF"}};sum.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1687B8"}};sum.addRow(["Producto",records[0].product||""]);sum.addRow(["Lote",records[0].lot||""]);sum.addRow([]);const hdr=sum.addRow(["TALLA","INY","BUENO","MALO"]);hdr.eachCell(q=>{q.font={bold:true,color:{argb:"FFFFFFFF"}};q.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1687B8"}};});let totals=[0,0,0];allSizes.forEach(size=>{let a=0,b=0,d=0;records.forEach(rec=>{const v=rec.values[size]||{};a+=Number(v.int||0);b+=Number(v.good||0);d+=Number(v.bad||0);});totals[0]+=a;totals[1]+=b;totals[2]+=d;sum.addRow([size,a,b,d]);});const rr=sum.addRow(["TOTAL",...totals]);rr.eachCell(q=>{q.font={bold:true};q.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFD9EAD3"}};});sum.columns=[{width:22},{width:18},{width:18},{width:18}];
  const buffer=await wb.xlsx.writeBuffer();const blob=new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`KROKICOL_Produccion_${(records[0].lot||"lote").replace(/[^a-z0-9_-]/gi,"_")}.xlsx`;a.click();URL.revokeObjectURL(url);
});
$("sizes").value = confirmedSizes.join(", ");renderSizePicker();renderSizeInputs();renderRecords();



/* =================================
   MODULO LINEA - FORMATO M15 PG
================================= */

let lineColors = [
  $("lineColor0")?.value || "Negro Rojo",
  $("lineColor1")?.value || "Negro Verde",
  $("lineColor2")?.value || "Azul Rojo",
  $("lineColor3")?.value || "Azul Verde"
];

let lineSizes = [];

// =====================================
// SELECTOR DE TALLAS DEL MODULO LINEA
// =====================================

let draftLineSizes = [];

const lineSizeModal = $("lineSizeModal");
const lineSizeOptions = $("lineSizeOptions");
const lineSelectedSizes = $("lineSelectedSizes");
const lineSizesInput = $("lineSizes");


function renderLineSizePicker() {
  const normalContainer = $("lineNormalSizes");
  const specialContainer = $("lineSpecialSizes");
  const selectedContainer = $("lineSelectedSizes");

  if (!normalContainer || !specialContainer || !selectedContainer) return;

  normalContainer.innerHTML = "";
  specialContainer.innerHTML = "";
  selectedContainer.innerHTML = "";

  // Crear tallas normales y especiales
  for (let size = 20; size <= 45; size++) {
    [
      { value: String(size), container: normalContainer },
      { value: `${size}*`, container: specialContainer }
    ].forEach(({ value, container }) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "size-option";
      button.textContent = value;

      if (draftLineSizes.includes(value)) {
        button.classList.add("selected");
      }

      button.addEventListener("click", () => {
  draftLineSizes.push(value);

  draftLineSizes.sort((a, b) => {
    const specialA = a.endsWith("*");
    const specialB = b.endsWith("*");

    if (specialA !== specialB) {
      return specialA ? 1 : -1;
    }

    return parseInt(a) - parseInt(b);
  });

  renderLineSizePicker();
});

      container.appendChild(button);
    });
  }

  // Mostrar selecciones individuales
  draftLineSizes.forEach((size, index) => {
    const chip = document.createElement("button");

    chip.type = "button";
    chip.className = "line-size-chip";
    chip.textContent = `${size} ×`;

    chip.addEventListener("click", () => {
      draftLineSizes.splice(index, 1);
      renderLineSizePicker();
    });

    selectedContainer.appendChild(chip);
  });

  const counter = $("lineSelectedCount");

  if (counter) {
    counter.textContent = `${draftLineSizes.length} seleccionadas`;
  }
}


// Abrir ventana
$("openLineSizePicker")?.addEventListener("click", () => {
  draftLineSizes = [...lineSizes];
  renderLineSizePicker();
  lineSizeModal.hidden = false;
});

// Cerrar sin guardar cambios
function closeLineSizePicker() {
  lineSizeModal.hidden = true;
}

$("closeLineSizePicker")?.addEventListener(
  "click",
  closeLineSizePicker
);

$("cancelLineSizePicker")?.addEventListener(
  "click",
  closeLineSizePicker
);

$("lineSizeModalBackdrop")?.addEventListener(
  "click",
  closeLineSizePicker
);

// Confirmar selección
$("confirmLineSizePicker")?.addEventListener("click", () => {
  if (draftLineSizes.length === 0) {
    alert("Selecciona al menos una talla.");
    return;
  }

  lineSizes = [...draftLineSizes];

  if (lineSizesInput) {
    lineSizesInput.value = lineSizes.join(", ");
  }

  closeLineSizePicker();

  // Actualizar las tres hojas de Línea
  renderLineTable();
});


// Actualizar el nombre de la referencia seleccionada
function updateLineReferenceDisplay() {
  const reference = $("lineReference")?.value || "M15 PG";

  if ($("lineReferenceTitle")) {
    $("lineReferenceTitle").textContent = reference;
  }

  if ($("lineFormatName")) {
    $("lineFormatName").textContent = reference;
  }
}

function updateLineSheetTitles() {
  const reference = $("lineManualReference")?.value.trim() || "";
  const prefix = $("lineLotPrefix")?.textContent.trim() || "";
  const sequence = $("lineLotSequence")?.value || "";

  const lot = prefix + String(sequence).padStart(3, "0");

  document.querySelectorAll(".line-title-reference").forEach(element => {
    element.textContent = reference;
  });

  document.querySelectorAll(".line-title-lot").forEach(element => {
    element.textContent = lot;
  });
}

$("lineManualReference")?.addEventListener("input", updateLineSheetTitles);
$("lineLotSequence")?.addEventListener("input", updateLineSheetTitles);

updateLineSheetTitles();

// Escuchar cambios en el selector
$("lineReference")?.addEventListener("change", updateLineReferenceDisplay);

// Actualizar los nombres de los colores
function updateLineColors() {
  lineColors.forEach((color, index) => {
    const input = $(`lineColor${index}`);

    if (input) {
      lineColors[index] = input.value.trim() || `Color ${index + 1}`;
    }
  });

  renderLineTable();
}

// Escuchar cambios en los campos de color
[0, 1, 2, 3].forEach(index => {
  $(`lineColor${index}`)?.addEventListener("input", updateLineColors);
});

// Agregar un nuevo color en el módulo Línea
// Botón para eliminar cualquier color

function addLineColorRemoveButton(colorHeader) {
  const removeButton = document.createElement("button");

  removeButton.type = "button";
  removeButton.textContent = "×";
  removeButton.title = "Eliminar color";
  removeButton.style.marginLeft = "6px";

  removeButton.addEventListener("click", () => {
    const tableBody = document.querySelector(".programming-table tbody");

    const colorIndex = Array.from(colorHeader.parentElement.children)
      .indexOf(colorHeader) - 1;

    if (lineColors.length <= 1) {
      alert("Debe quedar al menos un color.");
      return;
    }

    // Guardar cantidades antes de eliminar
    const productionData = Array.from(
      document.querySelectorAll("#lineTableContainer input[data-color]")
    ).map(input => ({
      color: Number(input.dataset.color),
      size: input.dataset.size,
      slot: input.dataset.slot,
      value: input.value
    }));

    // Guardar averiados antes de eliminar
    const badData = Array.from(
      document.querySelectorAll(
        '#lineInjectionTableContainer input[data-injection="bad"]'
      )
    ).map(input => ({
      color: Number(input.dataset.color),
      size: input.dataset.size,
      value: input.value
    }));

    lineColors[colorIndex] =
      colorHeader.querySelector("input").value.trim() ||
      `Color ${colorIndex + 1}`;

    tableBody.rows[0].deleteCell(colorIndex + 1);
    tableBody.rows[1].deleteCell(colorIndex + 1);

    lineColors.splice(colorIndex, 1);

    // Reorganizar identificadores de programación
    lineColors.forEach((color, index) => {
      const colorInput = tableBody.rows[0].cells[index + 1]
        .querySelector("input");

      const programInput = tableBody.rows[1].cells[index + 1]
        .querySelector("input");

      colorInput.id = `lineColor${index}`;
      programInput.id = `lineProgram${index}`;
    });

    // Reconstruir las tres hojas
    renderLineTable();

    // Recuperar cantidades de los colores restantes
    productionData.forEach(data => {
      if (data.color === colorIndex) return;

      const newColorIndex =
        data.color > colorIndex ? data.color - 1 : data.color;

      const input = document.querySelector(
        `#lineTableContainer input[data-color="${newColorIndex}"][data-size="${data.size}"][data-slot="${data.slot}"]`
      );

      if (input) input.value = data.value;
    });

    // Recuperar averiados de los colores restantes
    badData.forEach(data => {
      if (data.color === colorIndex) return;

      const newColorIndex =
        data.color > colorIndex ? data.color - 1 : data.color;

      const input = document.querySelector(
        `#lineInjectionTableContainer input[data-injection="bad"][data-color="${newColorIndex}"][data-size="${data.size}"]`
      );

      if (input) input.value = data.value;
    });

    // Actualizar todos los cálculos
    updateLineTotals();
  });

  colorHeader.appendChild(removeButton);
}


// Agregar botones a los cuatro colores iniciales
const initialColorHeaders = document.querySelectorAll(
  ".programming-table tbody tr:first-child th"
);

Array.from(initialColorHeaders).slice(1).forEach(header => {
  addLineColorRemoveButton(header);
});

// Agregar un nuevo color
$("addLineColor")?.addEventListener("click", () => {
  const tableBody = document.querySelector(".programming-table tbody");

  if (!tableBody) return;

  const colorIndex = lineColors.length;
  const colorName = `Color ${colorIndex + 1}`;

  // Campo del nombre
  const colorHeader = document.createElement("th");
  const colorInput = document.createElement("input");

  colorInput.type = "text";
  colorInput.id = `lineColor${colorIndex}`;
  colorInput.value = colorName;

  colorHeader.appendChild(colorInput);
  addLineColorRemoveButton(colorHeader);

  tableBody.rows[0].appendChild(colorHeader);

  // Campo de programación
  const programCell = document.createElement("td");
  const programInput = document.createElement("input");

  programInput.type = "number";
  programInput.id = `lineProgram${colorIndex}`;
  programInput.min = "0";
  programInput.step = "1";
  programInput.value = "0";

  programInput.addEventListener("input", () => {
    renderLineTable();
  });

  programCell.appendChild(programInput);
  tableBody.rows[1].appendChild(programCell);

  lineColors.push(colorName);

  colorInput.addEventListener("input", updateLineColors);

  renderLineTable();
});

// Mostrar la referencia inicial
updateLineReferenceDisplay();

function renderLineTable() {
  const container = $("lineTableContainer");
  if (!container) return;

  let html = `
    <div class="line-table-wrap">
      <table class="line-table">
        <thead>
        
            <tr>
  <th rowspan="2" class="line-color-header">Color</th>
  ${lineSizes.map((size, sizeIndex) => `
    <th colspan="3" class="line-size-${sizeIndex}">Talla ${size}</th>
  `).join("")}
  <th rowspan="2">Total color</th>
</tr>
<tr>
  ${lineSizes.map((size, sizeIndex) => `
    <th class="line-size-${sizeIndex}">Cantidad 1</th>
    <th class="line-size-${sizeIndex}">Cantidad 2</th>
    <th class="line-size-${sizeIndex}">Total</th>
  `).join("")}
</tr>
          
        </thead>
        <tbody>
  `;

  lineColors.forEach((color, colorIndex) => {
    
const programInputId = `lineProgram${colorIndex}`;
const programValue = Number($(programInputId)?.value || 0);

html += `
  <tr>
    <th class="line-program-label">Programadas</th>
    ${lineSizes.map((size, sizeIndex) => `
  <td class="line-programmed line-size-${sizeIndex}"
    colspan="3"
    data-program-color="${colorIndex}">${programValue}</td>
`).join("")}
    <td></td>
  </tr>
  <tr>
    <th class="line-color-header">${color}</th>
`;


    lineSizes.forEach((size, sizeIndex) => {
      html += `
        <td>
          <input type="number" min="0" step="1"
            data-color="${colorIndex}"
            data-size="${sizeIndex}"
            data-slot="1"
            value="0">
        </td>
        <td>
          <input type="number" min="0" step="1"
            data-color="${colorIndex}"
            data-size="${sizeIndex}"
            data-slot="2"
            value="0">
        </td>
        <td class="line-total" id="lineCellTotal-${colorIndex}-${sizeIndex}">0</td>
      `;
    });

    html += `<td class="line-total" id="lineColorTotal-${colorIndex}">0</td></tr>`;
  });

  html += `
        </tbody>
        <tfoot>
          <tr>
            <th>Total por talla</th>
            ${lineSizes.map((size, sizeIndex) => `
              <td colspan="3" class="line-total" id="lineSizeTotal-${sizeIndex}">0</td>
            `).join("")}
            <td class="line-total" id="lineTableTotal">0</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

container.innerHTML = html;
renderLineInjectionTable();
renderLineSummaryTable();
updateLineProgrammedValues();
updateLineTotals();
}



function renderLineInjectionTable() {
  const container = $("lineInjectionTableContainer");
  if (!container) return;

  let html = `
    <div class="line-table-wrap">
      <table class="line-table injection-table">
        <thead>
          <tr>
            <th>Color</th>
            <th>Concepto</th>
            ${lineSizes.map((size, sizeIndex) => `<th class="line-size-${sizeIndex}">Talla ${size}</th>`).join("")}
            <th>Totales</th>
          </tr>
        </thead>
        <tbody>
  `;

  lineColors.forEach((color, colorIndex) => {
    // Fila Programadas
html += `
  <tr>
    <th rowspan="4">${color}</th>
    <th class="line-program-label">Programadas</th>
`;

lineSizes.forEach((size, sizeIndex) => {
  html += `
    <td class="line-size-${sizeIndex} line-programmed"
        id="injectionProgrammed-${colorIndex}-${sizeIndex}">0</td>
  `;
});

html += `<td class="line-total">—</td></tr>`;


    // Fila Total
    html += `<tr><th>Inyectadas</th>`;

    lineSizes.forEach((size, sizeIndex) => {
      html += `
        <td class="line-total line-size-${sizeIndex}"
          id="injectionTotal-${colorIndex}-${sizeIndex}">0</td>
      `;
    });

    html += `<td class="line-total">—</td></tr>`;

    // Fila Averiado
    html += `<tr><th>Averiado</th>`;

    lineSizes.forEach((size, sizeIndex) => {
      html += `
        <td class="line-size-${sizeIndex}">
          <input type="number" min="0" step="1" value="0"
            data-injection="bad"
            data-color="${colorIndex}"
            data-size="${sizeIndex}">
        </td>
      `;
    });

   html += `<td class="line-total injection-bad-number" id="injectionBadColor-${colorIndex}">0</td></tr>`;

    // Fila Buenos y totales del color
    html += `<tr><th>Buenos</th>`;

    lineSizes.forEach((size, sizeIndex) => {
      html += `
        <td class="line-total line-size-${sizeIndex}"
    id="injectionGood-${colorIndex}-${sizeIndex}">0</td>
      `;
    });

    html += `
  <td class="line-total" id="injectionGoodColor-${colorIndex}">0</td>
</tr>

    `;
  });

  html += `
        </tbody>
        <tfoot>
          <tr>
            <th colspan="2">Totales por talla</th>

            ${lineSizes.map((size, sizeIndex) => `
  <td class="line-total injection-summary line-size-${sizeIndex}">
    <div>
      <span id="injectionGoodSize-${sizeIndex}">0</span>
    </div>
    <div>
      <span id="injectionBadSize-${sizeIndex}" class="injection-bad-number">0</span>
    </div>
  </td>
`).join("")}

            <td class="line-total injection-grand-total">
  <div class="grand-result good">
    Total Buenos <strong id="injectionGrandGood">0</strong>
  </div>
  <div class="grand-result bad">
    Total Averiados <strong id="injectionGrandBad">0</strong>
  </div>
</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  container.innerHTML = html;
  updateLineInjectionTotals();
}

function renderLineSummaryTable() {
  const container = $("lineSummaryTableContainer");
  if (!container) return;

  let html = `
    <div class="line-table-wrap">
      <table class="line-table injection-table">
        <thead>
          <tr>
            <th>Color</th>
            <th>Concepto</th>
            ${lineSizes.map((size, sizeIndex) =>
              `<th class="line-size-${sizeIndex}">Talla ${size}</th>`
            ).join("")}
            <th>Totales</th>
          </tr>
        </thead>
        <tbody>
  `;

  lineColors.forEach((color, colorIndex) => {
    html += `
      <tr>
        <th rowspan="2">${color}</th>
        <th class="line-program-label">Programadas</th>
    `;

    lineSizes.forEach((size, sizeIndex) => {
      html += `
        <td class="line-programmed line-size-${sizeIndex}"
            id="summaryProgrammed-${colorIndex}-${sizeIndex}">0</td>
      `;
    });

    html += `<td class="line-total">—</td></tr>`;
    html += `<tr><th>Total</th>`;

    lineSizes.forEach((size, sizeIndex) => {
      html += `
        <td class="line-total line-size-${sizeIndex}"
            id="summaryTotal-${colorIndex}-${sizeIndex}">0</td>
      `;
    });

    html += `
      <td class="line-total"
          id="summaryGoodColor-${colorIndex}">0</td>
      </tr>
    `;
  });

  html += `
        </tbody>
        <tfoot>
          <tr>
            <th colspan="2">Totales por talla</th>
            ${lineSizes.map((size, sizeIndex) => `
              <td class="line-total line-size-${sizeIndex}"
                  id="summaryGoodSize-${sizeIndex}">0</td>
            `).join("")}
            <td class="line-total" id="summaryGrandGood">0</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  container.innerHTML = html;
}


function updateLineProgrammedValues() {
  lineColors.forEach((color, colorIndex) => {
  const programInputId = `lineProgram${colorIndex}`;
    const value = Number($(programInputId)?.value || 0);

    document.querySelectorAll(
      `#lineTableContainer [data-program-color="${colorIndex}"]`
    ).forEach(cell => {
      cell.textContent = value;
    });

    lineSizes.forEach((size, sizeIndex) => {
      const cell = $(`injectionProgrammed-${colorIndex}-${sizeIndex}`);
      if (cell) cell.textContent = value;

      const summaryCell = $(`summaryProgrammed-${colorIndex}-${sizeIndex}`);
      if (summaryCell) summaryCell.textContent = value;
    });
  });
}


lineColors.forEach((color, colorIndex) => {
  $(`lineProgram${colorIndex}`)?.addEventListener(
    "input",
    updateLineProgrammedValues
  );
});


// Calcular producción, averiados y pares buenos
function updateLineInjectionTotals() {
  let grandGood = 0;
  const goodSizeTotals = Array(lineSizes.length).fill(0);
const badSizeTotals = Array(lineSizes.length).fill(0);

  lineColors.forEach((color, colorIndex) => {
    let goodColorTotal = 0;
    let badColorTotal = 0;

    lineSizes.forEach((size, sizeIndex) => {
      const productionCell = $(
        `lineCellTotal-${colorIndex}-${sizeIndex}`
      );

      const produced = Number(productionCell?.textContent || 0);

      const badInput = document.querySelector(
        `#lineInjectionTableContainer input[data-injection="bad"][data-color="${colorIndex}"][data-size="${sizeIndex}"]`
      );

      // Evitar que los averiados superen la producción
if (badInput) {
  badInput.min = 0;
  badInput.max = produced;

  let enteredBad = Math.max(
    0,
    Math.floor(Number(badInput.value || 0))
  );

  if (enteredBad > produced) {
    enteredBad = produced;
    badInput.value = produced;
  }
}

const bad = Math.min(
  produced,
  Math.max(0, Math.floor(Number(badInput?.value || 0)))
);

      const good = produced - bad;

      const summaryCell = $(`summaryTotal-${colorIndex}-${sizeIndex}`);
if (summaryCell) summaryCell.textContent = good;

      const totalCell = $(`injectionTotal-${colorIndex}-${sizeIndex}`);
      const goodCell = $(`injectionGood-${colorIndex}-${sizeIndex}`);

      if (totalCell) totalCell.textContent = produced;
      if (goodCell) goodCell.textContent = good;

      goodColorTotal += good;
      badColorTotal += bad;

      goodSizeTotals[sizeIndex] += good;
      badSizeTotals[sizeIndex] += bad;
    });

    const goodColorCell = $(`injectionGoodColor-${colorIndex}`);
    const badColorCell = $(`injectionBadColor-${colorIndex}`);
    const summaryColorCell = $(`summaryGoodColor-${colorIndex}`);
if (summaryColorCell) summaryColorCell.textContent = goodColorTotal;

    if (goodColorCell) goodColorCell.textContent = goodColorTotal;
    if (badColorCell) badColorCell.textContent = badColorTotal;

    grandGood += goodColorTotal;
  });

  goodSizeTotals.forEach((total, index) => {
  const cell = $(`injectionGoodSize-${index}`);
  if (cell) cell.textContent = total;

  const summaryCell = $(`summaryGoodSize-${index}`);
  if (summaryCell) summaryCell.textContent = total;
});

  badSizeTotals.forEach((total, index) => {
    const cell = $(`injectionBadSize-${index}`);
    if (cell) cell.textContent = total;
  });

  const grandCell = $("injectionGrandGood");
  if (grandCell) grandCell.textContent = grandGood;

  const grandBad = badSizeTotals.reduce((sum, total) => sum + total, 0);
const badGrandCell = $("injectionGrandBad");
if (badGrandCell) badGrandCell.textContent = grandBad;

  const summaryGrandCell = $("summaryGrandGood");
if (summaryGrandCell) summaryGrandCell.textContent = grandGood;
}


// Actualizar cuando el supervisor escriba averiados
$("lineInjectionTableContainer")?.addEventListener("input", event => {
  if (event.target.matches('input[data-injection="bad"]')) {
    updateLineInjectionTotals();
  }
});


function updateLineTotals() {
  let grandTotal = 0;
  const sizeTotals = Array(lineSizes.length).fill(0);

  lineColors.forEach((color, colorIndex) => {
    let colorTotal = 0;

    lineSizes.forEach((size, sizeIndex) => {
      const inputs = document.querySelectorAll(
        `#lineTableContainer input[data-color="${colorIndex}"][data-size="${sizeIndex}"]`
      );

      const first = Number(inputs[0]?.value || 0);
      const second = Number(inputs[1]?.value || 0);
      const total = first + second;

      const cell = $(`lineCellTotal-${colorIndex}-${sizeIndex}`);
      if (cell) cell.textContent = total;

      colorTotal += total;
      sizeTotals[sizeIndex] += total;
    });

    const colorCell = $(`lineColorTotal-${colorIndex}`);
    if (colorCell) colorCell.textContent = colorTotal;

    grandTotal += colorTotal;
  });

  sizeTotals.forEach((total, index) => {
    const cell = $(`lineSizeTotal-${index}`);
    if (cell) cell.textContent = total;
  });

  if ($("lineTableTotal")) $("lineTableTotal").textContent = grandTotal;
  if ($("lineGrandTotal")) $("lineGrandTotal").textContent = grandTotal;
  updateLineInjectionTotals();
}

// Actualizar cálculos al escribir cantidades
$("lineTableContainer")?.addEventListener("input", event => {
  if (event.target.matches("input[type='number']")) {
    updateLineTotals();
  }
});

function updateLineLotPrefix() {
  const dateValue = $("lineDate")?.value;
  const prefix = $("lineLotPrefix");
  const sequence = $("lineLotSequence");

  if (!dateValue || !prefix || !sequence) return;

  const [year, month] = dateValue.split("-");

  prefix.textContent = year.slice(-2) + month;

  if (sequence.dataset.year !== year) {
    sequence.value = year === "2026" ? "155" : "001";
    sequence.dataset.year = year;
  }
}

// Abrir módulo Línea
$("openLine")?.addEventListener("click", () => {
  $("homeScreen").hidden = true;
  $("productionView").hidden = true;
  $("lineView").hidden = false;
  if (!$("lineTableContainer").innerHTML.trim()) {
  renderLineTable();
}

  if ($("lineDate")) {
  if (!$("lineDate").value) {
    $("lineDate").value = new Date().toISOString().slice(0, 10);
  }

  updateLineLotPrefix();
  $("lineDate").onchange = updateLineLotPrefix;
}
});

// Regresar al menú principal
$("backLineHome")?.addEventListener("click", () => {
  $("lineView").hidden = true;
  $("homeScreen").hidden = false;
});

// =====================================
// EXPORTAR EXCEL DEL MÓDULO LÍNEA
// =====================================


$("exportLineExcel")?.addEventListener("click", exportLineExcel);

async function exportLineExcel() {
  if (typeof ExcelJS === "undefined") {
    alert("No se pudo cargar ExcelJS. Revisa tu conexión a internet.");
    return;
  }

  const reference = $("lineManualReference")?.value.trim() || "Sin referencia";
  const prefix = $("lineLotPrefix")?.textContent.trim() || "";
  const sequence = $("lineLotSequence")?.value || "001";
  const lot = prefix + String(sequence).padStart(3, "0");

  if (!lineSizes.length || !lineColors.length) {
    alert("Primero selecciona las tallas y los colores.");
    return;
  }

  const button = $("exportLineExcel");
  if (button) button.disabled = true;

  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = "KROKICOL";
    wb.subject = "Control de producción - Línea";

    const border = {
      top: { style: "thin", color: { argb: "FF9BA9A2" } },
      bottom: { style: "thin", color: { argb: "FF9BA9A2" } },
      left: { style: "thin", color: { argb: "FF9BA9A2" } },
      right: { style: "thin", color: { argb: "FF9BA9A2" } }
    };

    const colors = {
      blue: "FF1687B8",
      lightBlue: "FFD9EAF2",
      green: "FFD9EAD3",
      text: "FF18332D",
      bad: "FFB04438",
      white: "FFFFFFFF"
    };

    function setupSheet(ws, lastCol) {
      ws.views = [{ state: "frozen", ySplit: 5, showGridLines: false }];

      ws.mergeCells(1, 1, 1, lastCol);
      ws.getCell(1, 1).value = "Referencia y lote";
      ws.getCell(1, 1).font = {
        name: "Arial", size: 13, bold: true, color: { argb: colors.white }
      };
      ws.getCell(1, 1).fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: colors.blue }
      };
      ws.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };

      ws.mergeCells(2, 1, 2, lastCol);
      ws.getCell(2, 1).value = `${reference} - ${lot}`;
      ws.getCell(2, 1).font = {
        name: "Arial", size: 12, bold: true, color: { argb: colors.text }
      };
      ws.getCell(2, 1).alignment = { horizontal: "center", vertical: "middle" };

      ws.getRow(1).height = 25;
      ws.getRow(2).height = 23;
    }

    function styleCell(cell, options = {}) {
      cell.border = border;
      cell.font = {
        name: "Arial",
        size: 10,
        color: { argb: colors.text },
        ...options.font
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
        ...options.alignment
      };

      if (options.fill) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: options.fill }
        };
      }
    }

    function styleHeader(ws, row, lastCol) {
      for (let col = 1; col <= lastCol; col++) {
        styleCell(ws.getCell(row, col), {
          fill: colors.blue,
          font: { bold: true, color: { argb: colors.white } }
        });
      }
    }

    function getNumber(id) {
      return Number($(id)?.textContent || 0);
    }

    function getInput(selector) {
      return Number(document.querySelector(selector)?.value || 0);
    }

    // =====================================
    // HOJA 1: PLANTA
    // =====================================

    const plantaCols = 2 + lineSizes.length * 3;
    const planta = wb.addWorksheet("Planta");

    setupSheet(planta, plantaCols);

    planta.mergeCells(4, 1, 5, 1);
    planta.getCell(4, 1).value = "Color";

    lineSizes.forEach((size, i) => {
      const col = 2 + i * 3;
      planta.mergeCells(4, col, 4, col + 2);
      planta.getCell(4, col).value = `Talla ${size}`;

      planta.getCell(5, col).value = "Cantidad 1";
      planta.getCell(5, col + 1).value = "Cantidad 2";
      planta.getCell(5, col + 2).value = "Total";
    });

    planta.mergeCells(4, plantaCols, 5, plantaCols);
    planta.getCell(4, plantaCols).value = "Total color";

    styleHeader(planta, 4, plantaCols);
    styleHeader(planta, 5, plantaCols);

    let plantaRow = 6;

    lineColors.forEach((color, colorIndex) => {
      const programRow = plantaRow++;

      planta.getCell(programRow, 1).value = "Programadas";

      lineSizes.forEach((size, sizeIndex) => {
        const col = 2 + sizeIndex * 3;
        planta.mergeCells(programRow, col, programRow, col + 2);
        planta.getCell(programRow, col).value =
          getInput(`#lineProgram${colorIndex}`);
      });

      const dataRow = plantaRow++;
      planta.getCell(dataRow, 1).value = color;

      lineSizes.forEach((size, sizeIndex) => {
        const col = 2 + sizeIndex * 3;

        const first = getInput(
          `#lineTableContainer input[data-color="${colorIndex}"][data-size="${sizeIndex}"][data-slot="1"]`
        );

        const second = getInput(
          `#lineTableContainer input[data-color="${colorIndex}"][data-size="${sizeIndex}"][data-slot="2"]`
        );

        planta.getCell(dataRow, col).value = first;
        planta.getCell(dataRow, col + 1).value = second;
        planta.getCell(dataRow, col + 2).value = first + second;
      });

      planta.getCell(dataRow, plantaCols).value =
        getNumber(`lineColorTotal-${colorIndex}`);
    });

    const plantaTotalRow = plantaRow;
    planta.getCell(plantaTotalRow, 1).value = "Total por talla";

    lineSizes.forEach((size, i) => {
      const col = 2 + i * 3;
      planta.mergeCells(plantaTotalRow, col, plantaTotalRow, col + 2);
      planta.getCell(plantaTotalRow, col).value =
        getNumber(`lineSizeTotal-${i}`);
    });

    planta.getCell(plantaTotalRow, plantaCols).value =
      getNumber("lineTableTotal");

    // =====================================
    // HOJA 2: LÍNEA
    // =====================================

    const lineCols = lineSizes.length + 3;
    const linea = wb.addWorksheet("Línea");

    setupSheet(linea, lineCols);

    ["Color", "Concepto", ...lineSizes.map(s => `Talla ${s}`), "Totales"]
      .forEach((value, i) => {
        linea.getCell(4, i + 1).value = value;
      });

    styleHeader(linea, 4, lineCols);

    let lineaRow = 5;

    lineColors.forEach((color, colorIndex) => {
      const firstRow = lineaRow;

      const concepts = [
        "Programadas",
        "Inyectadas",
        "Averiado",
        "Buenos"
      ];

      concepts.forEach((concept, conceptIndex) => {
        const row = lineaRow++;

        if (conceptIndex === 0) {
          linea.mergeCells(firstRow, 1, firstRow + 3, 1);
          linea.getCell(firstRow, 1).value = color;
        }

        linea.getCell(row, 2).value = concept;

        lineSizes.forEach((size, sizeIndex) => {
          const col = sizeIndex + 3;
          let value = 0;

          if (conceptIndex === 0) {
            value = getInput(`#lineProgram${colorIndex}`);
          } else if (conceptIndex === 1) {
            value = getNumber(`injectionTotal-${colorIndex}-${sizeIndex}`);
          } else if (conceptIndex === 2) {
            value = getInput(
              `#lineInjectionTableContainer input[data-injection="bad"][data-color="${colorIndex}"][data-size="${sizeIndex}"]`
            );
          } else {
            value = getNumber(`injectionGood-${colorIndex}-${sizeIndex}`);
          }

          linea.getCell(row, col).value = value;

          if (conceptIndex === 2) {
            styleCell(linea.getCell(row, col), {
              font: { color: { argb: colors.bad } }
            });
          }
        });

        const totalCol = lineCols;

        if (conceptIndex === 0 || conceptIndex === 1) {
          linea.getCell(row, totalCol).value = "—";
        } else if (conceptIndex === 2) {
          linea.getCell(row, totalCol).value =
            getNumber(`injectionBadColor-${colorIndex}`);
          styleCell(linea.getCell(row, totalCol), {
            font: { bold: true, color: { argb: colors.bad } }
          });
        } else {
          linea.getCell(row, totalCol).value =
            getNumber(`injectionGoodColor-${colorIndex}`);
        }
      });
    });

    ["Total buenos", "Total averiados"].forEach((label, index) => {
      const row = lineaRow++;

      linea.mergeCells(row, 1, row, 2);
      linea.getCell(row, 1).value = label;

      lineSizes.forEach((size, sizeIndex) => {
        const id = index === 0
          ? `injectionGoodSize-${sizeIndex}`
          : `injectionBadSize-${sizeIndex}`;

        linea.getCell(row, sizeIndex + 3).value = getNumber(id);

        if (index === 1) {
          styleCell(linea.getCell(row, sizeIndex + 3), {
            font: { bold: true, color: { argb: colors.bad } }
          });
        }
      });

      linea.getCell(row, lineCols).value = getNumber(
        index === 0 ? "injectionGrandGood" : "injectionGrandBad"
      );
    });

    // =====================================
    // HOJA 3: EMPAQUE
    // =====================================

    const empaque = wb.addWorksheet("Empaque");
    const empaqueCols = lineSizes.length + 3;

    setupSheet(empaque, empaqueCols);

    ["Color", "Concepto", ...lineSizes.map(s => `Talla ${s}`), "Totales"]
      .forEach((value, i) => {
        empaque.getCell(4, i + 1).value = value;
      });

    styleHeader(empaque, 4, empaqueCols);

    let empaqueRow = 5;

    lineColors.forEach((color, colorIndex) => {
      const firstRow = empaqueRow;

      ["Programadas", "Total"].forEach((concept, conceptIndex) => {
        const row = empaqueRow++;

        if (conceptIndex === 0) {
          empaque.mergeCells(firstRow, 1, firstRow + 1, 1);
          empaque.getCell(firstRow, 1).value = color;
        }

        empaque.getCell(row, 2).value = concept;

        lineSizes.forEach((size, sizeIndex) => {
          const value = conceptIndex === 0
            ? getInput(`#lineProgram${colorIndex}`)
            : getNumber(`summaryTotal-${colorIndex}-${sizeIndex}`);

          empaque.getCell(row, sizeIndex + 3).value = value;
        });

        empaque.getCell(row, empaqueCols).value =
          conceptIndex === 0
            ? "—"
            : getNumber(`summaryGoodColor-${colorIndex}`);
      });
    });

    const empaqueTotalRow = empaqueRow;

    empaque.mergeCells(empaqueTotalRow, 1, empaqueTotalRow, 2);
    empaque.getCell(empaqueTotalRow, 1).value = "Totales por talla";

    lineSizes.forEach((size, sizeIndex) => {
      empaque.getCell(empaqueTotalRow, sizeIndex + 3).value =
        getNumber(`summaryGoodSize-${sizeIndex}`);
    });

    empaque.getCell(empaqueTotalRow, empaqueCols).value =
      getNumber("summaryGrandGood");




    // =====================================
    // DISEÑO FINAL DEL EXCEL
    // SOLO DISEÑO, COLORES Y BORDES
    // =====================================

    const excelColors = {
      blue: "FF1687B8",
      programmed: "FF0563C1",
      green: "FF176B3A",
      red: "FFDC3545",
      text: "FF18332D",
      white: "FFFFFFFF",
      border: "FFB7C9C2"
    };

    // Formato general de las celdas
    function formatCell(cell, options = {}) {

      cell.font = {
        ...(cell.font || {}),
        name: "Arial",
        size: 10,
        color: { argb: options.color || excelColors.text },
        bold: options.bold ?? false
      };

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: excelColors.white }
      };

      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true
      };

      cell.border = {
        top: {
          style: "thin",
          color: { argb: excelColors.border }
        },
        bottom: {
          style: options.separator ? "medium" : "thin",
          color: { argb: excelColors.border }
        },
        left: {
          style: "thin",
          color: { argb: excelColors.border }
        },
        right: {
          style: "thin",
          color: { argb: excelColors.border }
        }
      };
    }

    // Encabezados azules
    function formatHeader(ws, row, lastCol) {
      for (let col = 1; col <= lastCol; col++) {
        const cell = ws.getCell(row, col);

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: excelColors.blue }
        };

        cell.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: excelColors.white }
        };

        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true
        };

        cell.border = {
          top: { style: "thin", color: { argb: excelColors.border } },
          bottom: { style: "medium", color: { argb: excelColors.border } },
          left: { style: "thin", color: { argb: excelColors.border } },
          right: { style: "thin", color: { argb: excelColors.border } }
        };
      }
    }

    // Aplicar formato a una fila completa
    function formatRow(ws, row, lastCol, options = {}) {
      for (let col = 1; col <= lastCol; col++) {
        formatCell(ws.getCell(row, col), options);
      }
    }

    // =====================================
    // HOJA 1: PLANTA
    // =====================================

    formatHeader(planta, 4, plantaCols);
    formatHeader(planta, 5, plantaCols);

    lineColors.forEach((color, index) => {

      const programRow = 6 + index * 2;
      const dataRow = programRow + 1;

      // Programadas en azul
      formatRow(planta, programRow, plantaCols, {
        color: excelColors.programmed,
        bold: true
      });

      // Datos de producción
      formatRow(planta, dataRow, plantaCols, {
        color: excelColors.text,
        separator: true
      });

      // Totales por talla en verde
      lineSizes.forEach((size, sizeIndex) => {
        const totalCol = 2 + sizeIndex * 3 + 2;

        formatCell(planta.getCell(dataRow, totalCol), {
          color: excelColors.green,
          bold: true,
          separator: true
        });
      });

      // Total del color
      formatCell(planta.getCell(dataRow, plantaCols), {
        color: excelColors.green,
        bold: true,
        separator: true
      });
    });

    // Totales finales
    formatRow(planta, plantaTotalRow, plantaCols, {
      color: excelColors.green,
      bold: true
    });

    planta.getRow(plantaTotalRow).height = 25;

    // =====================================
    // HOJA 2: LÍNEA
    // =====================================

    formatHeader(linea, 4, lineCols);

    lineColors.forEach((color, index) => {

      const firstRow = 5 + index * 4;

      // Programadas
      formatRow(linea, firstRow, lineCols, {
        color: excelColors.programmed,
        bold: true
      });

      // Inyectadas
      formatRow(linea, firstRow + 1, lineCols, {
        color: excelColors.text,
        bold: true
      });

      // Averiados
      formatRow(linea, firstRow + 2, lineCols, {
        color: excelColors.red,
        bold: false
      });

      // Total de averiados
      formatCell(linea.getCell(firstRow + 2, lineCols), {
        color: excelColors.red,
        bold: true
      });

      // Buenos
      formatRow(linea, firstRow + 3, lineCols, {
        color: excelColors.green,
        bold: true,
        separator: true
      });
    });

    // Totales generales
    const lineaTotalsStart = 5 + lineColors.length * 4;

    formatRow(linea, lineaTotalsStart, lineCols, {
      color: excelColors.green,
      bold: true
    });

    formatRow(linea, lineaTotalsStart + 1, lineCols, {
      color: excelColors.red,
      bold: true
    });

    // =====================================
    // HOJA 3: EMPAQUE
    // =====================================

    formatHeader(empaque, 4, empaqueCols);

    lineColors.forEach((color, index) => {

      const programRow = 5 + index * 2;
      const totalRow = programRow + 1;

      // Programadas
      formatRow(empaque, programRow, empaqueCols, {
        color: excelColors.programmed,
        bold: true
      });

      // Totales por color
      formatRow(empaque, totalRow, empaqueCols, {
        color: excelColors.green,
        bold: true,
        separator: true
      });
    });

    // Totales finales de empaque
    formatRow(empaque, empaqueTotalRow, empaqueCols, {
      color: excelColors.green,
      bold: true
    });

    empaque.getRow(empaqueTotalRow).height = 25;





    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const safeName = `${reference} - ${lot}`
      .replace(/[\\/:*?"<>|]/g, "_");

    link.href = url;
    link.download = `${safeName}.xlsx`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

  } catch (error) {
    console.error("Error al exportar el Excel de Línea:", error);
    alert("No se pudo generar el Excel. Revisa la consola para ver el error.");
  } finally {
    if (button) button.disabled = false;
  }
}


