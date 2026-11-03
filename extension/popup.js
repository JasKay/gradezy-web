/* Gradezy local-only prototype: CSV exports, deterministic matching, no server or SharePoint writes. */
const $=id=>document.getElementById(id);let output=null;
function parse(text,delimiter){
 const rows=[];let row=[],field="",quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}
 else if(!quoted&&c===delimiter){row.push(field);field=""}
 else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field=""}
 else field+=c}
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
const norm=s=>String(s??"").trim().toLowerCase(),key=s=>norm(s).replace(/[^a-z0-9]/g,"");
const index=(headers,options)=>headers.findIndex(h=>options.includes(key(h)));
const csv=rows=>rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
async function readFile(input){const f=input.files[0];if(!f)throw Error("Choose a CSV export first.");const text=await f.text();const rows=parse(text.replace(/^\uFEFF/,""),f.name.toLowerCase().endsWith(".tsv")?"\t":",");if(rows.length<2)throw Error("No data rows in export.");return rows;}
const status=s=>$("status").textContent=s;
async function refresh(){const x=await chrome.storage.local.get("gradezyMoodle");$("saved").textContent=x.gradezyMoodle?x.gradezyMoodle.records.length+" saved Turnitin records ("+new Date(x.gradezyMoodle.savedAt).toLocaleString()+")":"No saved records yet."}
function tab(which){const a=which==="moodle";$("moodlePanel").hidden=!a;$("trackerPanel").hidden=a;$("moodleTab").classList.toggle("selected",a);$("trackerTab").classList.toggle("selected",!a);status("")}
$("moodleTab").onclick=()=>tab("moodle");$("trackerTab").onclick=()=>tab("tracker");
$("save").onclick=async()=>{try{
 const rows=await readFile($("moodleFile")),h=rows[0],e=index(h,["email","emailaddress","studentemail"]),p=index(h,["paperid"]),s=index(h,["similarityscore"]);
 if(e<0||p<0)throw Error("Turnitin export must include Email and Paper ID columns.");
 const records=rows.slice(1).filter(r=>r[e]&&r[p]).map(r=>({email:norm(r[e]),paper:String(r[p]).trim(),similarity:s>=0?String(r[s]).trim():""}));
 if(!records.length)throw Error("No valid Email/Paper ID records found.");
 await chrome.storage.local.set({gradezyMoodle:{records,savedAt:Date.now()}});status("Saved "+records.length+" records locally. Open your Progress Tracker and click Tracker matching.");await refresh();
 }catch(e){status("Error: "+e.message)}};
$("match").onclick=async()=>{try{
 output=null;$("download").hidden=true;$("preview").hidden=true;
 const attempt=$("attempt").value;if(!attempt)throw Error("Choose first submission or resubmission explicitly.");
 const saved=(await chrome.storage.local.get("gradezyMoodle")).gradezyMoodle;if(!saved?.records?.length)throw Error("Save a Moodle export first.");
 const rows=await readFile($("trackerFile")),h=rows[0],e=index(h,["eslemail"]),p=index(h,[attempt==="first"?"tiipaperid":"resubmissiontiipaperid"]),s=index(h,[attempt==="first"?"similarity":"resubsimilarity"]);
 if(e<0||p<0)throw Error("Tracker needs ESL Email and the selected attempt's Paper ID column.");
 const source=new Map();for(const r of saved.records){const a=source.get(r.email)||[];a.push(r);source.set(r.email,a)}
 const counts=new Map();for(const r of rows.slice(1)){const mail=norm(r[e]);if(mail)counts.set(mail,(counts.get(mail)||0)+1)}
 let updated=0,unchanged=0,exceptions=[];const changed=[];
 for(let i=1;i<rows.length;i++){const r=rows[i],email=norm(r[e]),found=source.get(email);if(!found)continue;
 if(counts.get(email)!==1){exceptions.push("Row "+(i+1)+": duplicate tracker email");continue}
 const papers=[...new Set(found.map(x=>x.paper))];if(papers.length!==1){exceptions.push("Row "+(i+1)+": multiple Paper IDs");continue}
 const before=String(r[p]??"").trim();if(before&&before!==papers[0]){exceptions.push("Row "+(i+1)+": existing Paper ID differs");continue}
 if(before===papers[0]){unchanged++;continue}
 // Similarity is populated only when the destination is blank and values agree.
 r[p]=papers[0];if(s>=0&&!String(r[s]??"").trim()){const sims=[...new Set(found.map(x=>x.similarity).filter(Boolean))];if(sims.length===1)r[s]=sims[0]}
 updated++;changed.push("Row "+(i+1)+": "+email+" → "+papers[0]);
 }
 output=rows;$("preview").hidden=false;$("preview").textContent="Proposed Paper ID updates: "+updated+"\nUnchanged: "+unchanged+"\nExceptions: "+exceptions.length+"\n\n"+changed.slice(0,12).join("\n")+"\n"+exceptions.slice(0,12).join("\n");
 $("download").hidden=!updated;status("Review all changes and verify assessment scope before using this file. SharePoint has NOT been edited.");
 }catch(e){status("Error: "+e.message)}};
$("download").onclick=()=>{if(!output)return;const blob=new Blob(["\uFEFF"+csv(output)],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="gradezy-reviewed-tracker.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)};
$("clear").onclick=async()=>{await chrome.storage.local.remove("gradezyMoodle");output=null;$("download").hidden=true;$("preview").hidden=true;status("Saved Moodle records cleared.");await refresh()};refresh();
