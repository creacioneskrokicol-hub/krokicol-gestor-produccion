const $ = id => document.getElementById(id);
let sizes = ["39","40","41","42"];
let records = JSON.parse(localStorage.getItem("krokicolProduccion") || "[]");
$("date").value = new Date().toISOString().slice(0,10);

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
function save(){localStorage.setItem("krokicolProduccion",JSON.stringify(records));}
function formatDate(date){const [year,month,day]=String(date).split("-");return `${day}/${month}/${year}`;}
function renderRecords(){
  $("countRows").textContent=records.length;
  $("recordsHead").innerHTML=`<tr><th>Fecha</th><th>Turno</th><th>Color</th><th>Operario</th>${sizes.map(s=>`<th>${s} INT</th><th>${s} BUENO</th><th>${s} MALO</th>`).join("")}<th>Acción</th></tr>`;
  $("recordsBody").innerHTML=records.length?records.map((r,i)=>`<tr><td>${formatDate(r.date)}</td><td>${r.shift}</td><td>${escapeHtml(r.color)}</td><td>${escapeHtml(r.operator)}</td>${sizes.map(s=>`<td>${r.values[s]?.int??""}</td><td>${r.values[s]?.good??""}</td><td>${r.values[s]?.bad??""}</td>`).join("")}<td><button class="text-button" data-delete="${i}">Eliminar</button></td></tr>`).join(""):`<tr><td class="empty" colspan="${5+sizes.length*3}">Todavía no hay registros. Agrega el primer operario.</td></tr>`;
  document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>{records.splice(Number(b.dataset.delete),1);save();renderRecords();}));
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("addRecord").addEventListener("click",()=>{
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
  records.push({product:$("product").value.trim(),lot:$("lot").value.trim(),date,shift:$("shift").value,color,operator,values,sizes:[...sizes]});
  save();renderRecords();$("operator").value="";document.querySelectorAll(".int,.bad").forEach(e=>e.value="");updateGoods();$("operator").focus();
});
$("clearInputs").addEventListener("click",()=>{$("operator").value="";document.querySelectorAll(".int,.bad").forEach(e=>e.value="");updateGoods();});
$("clearAll").addEventListener("click",()=>{if(confirm("¿Eliminar todos los registros guardados en este navegador?")){records=[];save();renderRecords();}});
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
