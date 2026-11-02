/* Gradezy: read-only, user-triggered capture. No network requests or background scraping. */
const $=id=>document.getElementById(id);
let captured=null;
function capturePage(){
 const clean=s=>String(s||"").replace(/\s+/g," ").trim();
 const tables=[...document.querySelectorAll("table")].filter(t=>t.getClientRects().length);
 const candidates=tables.map(table=>{
  const headers=[...table.querySelectorAll("thead tr:last-child th")].map(x=>clean(x.innerText));
  const rows=[...table.querySelectorAll("tbody tr")].filter(tr=>tr.getClientRects().length).map(tr=>[...tr.querySelectorAll(":scope > td, :scope > th")].map(td=>clean(td.innerText)));
  const allHeaders=headers.length?headers:[...table.querySelectorAll("tr:first-child th")].map(x=>clean(x.innerText));
  const haystack=allHeaders.join(" ").toLowerCase();
  const score=["grade","student","submission","turnitin","id","attempt","email","mark"].filter(k=>haystack.includes(k)).length;
  return {headers:allHeaders,rows:rows.filter(r=>r.some(Boolean)),score};
 }).filter(t=>t.rows.length&&t.headers.length);
 candidates.sort((a,b)=>b.score-a.score||b.rows.length-a.rows.length);
 const best=candidates[0];
 if(!best||best.score<1)return {error:"No recognisable assessment table found on this page. Open the Moodle grade or submission table first."};
 return {headers:best.headers,rows:best.rows,page:location.pathname,visibleOnly:true};
}
$("capture").onclick=async()=>{
 $("status").textContent="Reading visible page…";$("results").hidden=true;
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id||!/^https?:/.test(tab.url||""))throw Error("Open a Moodle assessment page first.");
  const result=await chrome.scripting.executeScript({target:{tabId:tab.id},func:capturePage});
  const data=result[0]?.result;if(!data||data.error)throw Error(data?.error||"No records found.");
  captured=data;$("count").textContent=data.rows.length+" visible records captured";
  const table=$("preview");table.replaceChildren();
  const thead=document.createElement("thead"),tr=document.createElement("tr");
  data.headers.slice(0,5).forEach(h=>{const th=document.createElement("th");th.textContent=h;tr.append(th)});thead.append(tr);table.append(thead);
  const tbody=document.createElement("tbody");data.rows.slice(0,12).forEach(row=>{const tr=document.createElement("tr");row.slice(0,5).forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.append(td)});tbody.append(tr)});table.append(tbody);
  $("status").textContent="Review the captured columns and rows before exporting.";$("results").hidden=false;
 }catch(e){$("status").textContent=e.message||"Unable to capture records."}
};
$("export").onclick=async()=>{
 if(!captured)return;
 const quote=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
 const csv=[captured.headers,...captured.rows].map(r=>r.map(quote).join(",")).join("\r\n");
 const blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 try{await chrome.downloads.download({url,filename:"gradezy-moodle-capture.csv",saveAs:true})}finally{setTimeout(()=>URL.revokeObjectURL(url),60000)}
};