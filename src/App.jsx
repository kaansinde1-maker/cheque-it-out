import { useState, useEffect, useRef } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Trash2, Plus, Bell, TrendingUp, Wallet, PenLine, X, RefreshCw, Download, Upload,
         Moon, Sun, Calendar, Search, Bookmark, Pencil, ChevronDown, ChevronRight,
         ChevronLeft, MoreHorizontal, BarChart2, Coins, ArrowUpRight, ArrowDownRight, CreditCard, Flame, Snowflake } from "lucide-react";

/* ═══ SABİTLER ═══ */
const AC = "#8A5A33", ACRGB = "138,90,51";
const OK = "#4A8D6F", ER = "#C74B4B", BL = "#5B7FA6", WARN = "#D49A2A";
const KEY = "fintrack-v1";
const DEF_TOP_CATS=[
  {id:"food",name:"Yiyecek & İçecek"},{id:"transport",name:"Ulaşım"},
  {id:"shopping",name:"Alışveriş"},{id:"entertainment",name:"Eğlence"},
  {id:"home",name:"Ev"},{id:"health",name:"Sağlık"},{id:"other",name:"Diğer"},
];
const ASSET_TYPES=[
  {id:"gold",name:"Altın",unit:"g",needsSymbol:false},
  {id:"currency",name:"Döviz",unit:"birim",needsSymbol:true,symbolLabel:"Döviz kodu",symbolPlaceholder:"USD, EUR, GBP…"},
  {id:"stock",name:"Hisse",unit:"adet",needsSymbol:true,symbolLabel:"Hisse kodu / şirket",symbolPlaceholder:"AAPL, THYAO…"},
  {id:"crypto",name:"Kripto",unit:"coin",needsSymbol:true,symbolLabel:"Coin sembolü",symbolPlaceholder:"BTC, ETH…"},
  {id:"other",name:"Diğer",unit:"birim",needsSymbol:true,symbolLabel:"Ad",symbolPlaceholder:"Neyi takip ediyorsun?"},
];
const CC_CATEGORIES=["Gıda/Market","Restoran/Yemek","Giyim/Aksesuar","Elektronik/Teknoloji","Akaryakıt/Ulaşım","Faturalar/Hizmetler","Eğlence/Hobiler","Seyahat/Konaklama","Sağlık/Kozmetik","Eğitim","Diğer"];
const CC_THEME_KEYS=["blue","emerald","amber","purple","red","cyan","indigo","lime","sky","yellow","slate"];
const ccLabel=c=>c.bankName?`${c.bankName} — ${c.cardName}`:c.cardName;
const CC_THEMES={red:"#C74B4B",blue:"#5B7FA6",purple:"#8B6FB0",emerald:"#4A8D6F",cyan:"#4AA3A8",amber:"#D4894A",indigo:"#6B6FB0",slate:"#8890A3",yellow:"#C7A23B",lime:"#8FAD4A",sky:"#5B9FC7"};
const GOAL_COLORS=["#4A8D6F","#D4894A","#5B7FA6","#C74B4B","#9B59B6","#E67E22"];
const BLANK={transactions:[],categories:[],topCategories:DEF_TOP_CATS,budget:{monthly:0,perCategory:{}},recurring:[],settings:{dark:false,chartType:"line"},goals:[],investments:[],currentPrices:{},credit:{cards:[],transactions:[],categories:CC_CATEGORIES,categoryBudgets:{}}};

/* ═══ YARDIMCI FONKSİYONLAR ═══ */
const fmt       = n  => "₺"+Number(n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
const todayStr  = () => new Date().toISOString().slice(0,10);
const monthKey  = d  => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const dayKey    = (month,day) => `${month}-${String(day).padStart(2,"0")}`;
const shiftMonth= (month,offset) => { const [y,m]=month.split("-").map(Number); return monthKey(new Date(y,m-1+offset,1)); };
const thisMonth = () => monthKey(new Date());
const prevMonth = () => { const d=new Date(); d.setMonth(d.getMonth()-1); return monthKey(d); };
const monthOf   = d  => d?.slice(0,7);
const sumAmount = list => list.reduce((s,t)=>s+Number(t.amount),0);
const isExpense = t => t.type!=="income";
const isIncomeTx= t => t.type==="income";
// Ortak stil yardımcıları
const sectionLabel=margin=>({fontSize:11,color:"var(--ink3)",letterSpacing:"0.1em",textTransform:"uppercase",margin});
const iconBtn=padding=>({border:"none",background:"transparent",color:"var(--ink3)",padding});
const inputStyle=(padding,fontSize,mono=false)=>({border:"0.5px solid var(--line2)",borderRadius:6,padding,fontSize,...(mono?{fontFamily:"monospace"}:{}),background:"var(--surf2)",color:"var(--ink)"});
const chipStyle=(active,color,padding,fontSize)=>({padding,borderRadius:20,fontSize,border:`0.5px solid ${active?color:"var(--line2)"}`,background:active?color:"transparent",color:active?"#fff":"var(--ink2)"});
const softLine=dark=>dark?"#222836":"#D6C69E";
const axisColor=dark=>dark?"#3E4560":"#8F7E5A";
const uid       = () => Math.random().toString(36).slice(2,9);

const SCOPE_OPTS=[["alltime","Tüm zamanlar"],["12m","12 ay"],["6m","6 ay"],["3m","3 ay"],["thismonth","Bu ay"]];
const filterByScope=(arr,scope)=>{
  if(scope==="alltime") return arr;
  if(scope==="thismonth") return arr.filter(t=>monthOf(t.date)===thisMonth());
  const months=scope==="3m"?3:scope==="6m"?6:12;
  const cutoff=new Date(); cutoff.setMonth(cutoff.getMonth()-months);
  return arr.filter(t=>new Date(t.date+"T12:00:00")>=cutoff);
};

/* ═══ HESAPLAMALAR ═══ */
function normalizeData(raw){
  const d={...BLANK,...raw};
  if(!d.topCategories?.length) d.topCategories=DEF_TOP_CATS;
  if(!d.goals) d.goals=[];
  if(!d.investments) d.investments=[];
  if(!d.currentPrices) d.currentPrices={};
  if(!d.settings?.trMigrated){
    const MAP={"Food & Drink":"Yiyecek & İçecek","Transport":"Ulaşım","Shopping":"Alışveriş","Entertainment":"Eğlence","Home":"Ev","Health":"Sağlık","Other":"Diğer"};
    const tr=x=>MAP[x]||x;
    const un=x=>x==="Unspecified"?"Belirtilmemiş":x;
    d.topCategories=d.topCategories.map(c=>({...c,name:tr(c.name)}));
    d.transactions=d.transactions.map(t=>({...t,name:un(t.name),category:t.category?tr(un(t.category)):t.category}));
    d.recurring=(d.recurring||[]).map(r=>({...r,name:un(r.name),category:r.category?tr(un(r.category)):r.category}));
    d.categories=d.categories.map(c=>({...c,name:un(c.name)}));
    const pc={}; Object.entries(d.budget?.perCategory||{}).forEach(([k,v])=>{pc[tr(un(k))]=v;});
    d.budget={...d.budget,perCategory:pc};
    d.settings={...(d.settings||{}),trMigrated:true};
  }
  if(!d.credit) d.credit={cards:[],transactions:[],categories:CC_CATEGORIES,categoryBudgets:{}};
  if(!d.credit.categories?.length) d.credit.categories=CC_CATEGORIES;
  return d;
}

const saveTextFile=(name,text,type)=>{
  if(window.nativeSaveFile) return window.nativeSaveFile(name,text,type);
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([text],{type}));
  a.download=name; a.click();
};

const parseCSV = text => {
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  if(lines.length<2) return [];
  const out=[];
  for(let i=1;i<lines.length;i++){
    const fields=[]; let f="",inQ=false;
    for(const ch of lines[i]+","){
      if(ch==='"') inQ=!inQ;
      else if(ch===","&&!inQ){fields.push(f.trim());f="";}
      else f+=ch;
    }
    const [date,name,category,amount,notes,type,account]=fields;
    if(date?.match(/^\d{4}-\d{2}-\d{2}$/)&&name&&!isNaN(Number(amount))&&Number(amount)>0)
      out.push({id:uid(),createdAt:new Date().toISOString(),date,name,category:category||name,amount:Number(amount),notes:notes||"",type:type||"expense",account:account||""});
  }
  return out;
};

function getInsights(data){
  const cur=thisMonth(), prev=prevMonth();
  const curExp=data.transactions.filter(t=>monthOf(t.date)===cur&&isExpense(t));
  const prevExp=data.transactions.filter(t=>monthOf(t.date)===prev&&isExpense(t));
  const curInc=data.transactions.filter(t=>monthOf(t.date)===cur&&isIncomeTx(t));
  const income=sumAmount(curInc);
  const expenses=sumAmount(curExp);
  const net=income-expenses;
  const catTot={},prevCatTot={};
  curExp.forEach(t=>{const c=t.category||t.name;catTot[c]=(catTot[c]||0)+Number(t.amount);});
  prevExp.forEach(t=>{const c=t.category||t.name;prevCatTot[c]=(prevCatTot[c]||0)+Number(t.amount);});
  const topCat=Object.entries(catTot).sort(([,a],[,b])=>b-a)[0];
  let bigChange=null;
  Object.entries(catTot).forEach(([cat,cur])=>{
    const p=prevCatTot[cat];
    if(p){const pct=Math.round(Math.abs((cur-p)/p*100));
      if(!bigChange||pct>bigChange.pct) bigChange={cat,pct,up:cur>p};}
  });
  const day=new Date().getDate();
  const dailyAvg=day>0&&expenses>0?expenses/day:0;
  const savRate=income>0?Math.round(net/income*100):null;
  const ins=[];
  if(income>0||expenses>0) ins.push({label:"Net akış",value:fmt(Math.abs(net)),sub:net>=0?"fazla":"açık",color:net>=0?OK:ER,icon:net>=0?"↑":"↓"});
  if(topCat) ins.push({label:"En çok harcama",value:topCat[0],sub:fmt(topCat[1]),color:AC,icon:"◈"});
  if(bigChange) ins.push({label:bigChange.cat,value:(bigChange.up?"+":"-")+bigChange.pct+"%",sub:"geçen aya göre",color:bigChange.up?ER:OK,icon:bigChange.up?"▲":"▼"});
  if(dailyAvg>0) ins.push({label:"Günlük ort.",value:fmt(dailyAvg),sub:"bu ay",color:BL,icon:"∅"});
  if(savRate!==null) ins.push({label:"Tasarruf oranı",value:savRate+"%",sub:"gelirin",color:savRate>=0?OK:ER,icon:"%"});
  return ins;
}

// Bir varlığı benzersiz kılan anahtar: `${assetId}::${SEMBOL}`
const holdingKey=(assetId,symbol)=>`${assetId}::${(symbol||"").toUpperCase()}`;

function computeHoldings(investments,key){
  const txs=investments.filter(i=>holdingKey(i.assetId,i.symbol)===key).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt));
  let qty=0,avgCost=0,realized=0;
  txs.forEach(t=>{
    const tQty=Number(t.quantity),tTotal=Number(t.total);
    if(t.kind==="buy"){
      const newQty=qty+tQty;
      avgCost=newQty>0?((avgCost*qty)+tTotal)/newQty:0;
      qty=newQty;
    } else {
      const sellPricePerUnit=tTotal/tQty;
      realized+=(sellPricePerUnit-avgCost)*tQty;
      qty=Math.max(0,qty-tQty);
    }
  });
  return {qty,avgCost,realized,txCount:txs.length};
}

// Kredi kartı borç hesapları (Krediler sekmesi)
const ccDiffMonths=(startStr,endStr)=>{
  const [sy,sm]=startStr.split("-").map(Number),[ey,em]=endStr.split("-").map(Number);
  return (ey-sy)*12+(em-sm);
};
const ccStatementDiff=(txStr,targetStr,statementDay)=>{
  const [txY,txM,txD]=txStr.split("-").map(Number);
  const [tgY,tgM]=targetStr.split("-").map(Number);
  let fy=txY,fm=txM;
  if(txD>statementDay){ fm++; if(fm>12){fm=1;fy++;} }
  return (tgY-fy)*12+(tgM-fm);
};
const ccIsPlannedInstallment=tx=>tx.isInstallment&&tx.totalInstallments&&tx.type!=="payment";
const ccBaseInstallmentNo=tx=>Math.max(1,tx.currentInstallmentNumber??1);
const ccMonthOffset=(tx,card,targetStr)=>(card&&card.statementDay)?ccStatementDiff(tx.date,targetStr,card.statementDay):ccDiffMonths(tx.date,targetStr);
const ccInstallmentNoAt=(tx,card,targetStr)=>ccBaseInstallmentNo(tx)+ccMonthOffset(tx,card,targetStr);
const ccTodayInstallmentNo=(tx,card)=>tx.isInstallment?Math.max(1,ccInstallmentNoAt(tx,card,todayStr())):1;
const ccRemainingDebt=(tx,card)=>{
  const total=tx.totalInstallments||1;
  return (tx.amount/total)*Math.max(0,total-ccTodayInstallmentNo(tx,card));
};
const ccBalance=card=>card.currentDebt+(card.previousDebt||0);
const ccMinRatio=limit=>limit>25000?0.40:0.20;
const ccCardDebt=(card,transactions)=>{
  const futureInstallmentDebt=transactions
    .filter(tx=>tx.cardId===card.id&&ccIsPlannedInstallment(tx))
    .reduce((sum,tx)=>sum+ccRemainingDebt(tx,card),0);
  const totalOutstanding=ccBalance(card)+futureInstallmentDebt;
  const usageRatio=card.limit>0?Math.min(100,Math.round((totalOutstanding/card.limit)*100)):0;
  const availableLimit=card.limit-totalOutstanding;
  const minimumPayment=ccBalance(card)*card.minimumPaymentRatio;
  return {futureInstallmentDebt,usageRatio,availableLimit,minimumPayment};
};
const ccBuildTimeline=(cards,transactions,monthsAhead=12)=>{
  const timeline=[];
  const [cy,cm]=thisMonth().split("-").map(Number);
  for(let i=0;i<monthsAhead;i++){
    const d=new Date(cy,cm-1+i,1);
    const key=monthKey(d);
    const label=d.toLocaleDateString("tr-TR",{month:"long",year:"numeric"});
    const items=[];
    transactions.filter(ccIsPlannedInstallment).forEach(tx=>{
      const card=cards.find(c=>c.id===tx.cardId);
      const activeNo=ccInstallmentNoAt(tx,card,`${key}-01`);
      if(activeNo>=1&&activeNo<=tx.totalInstallments){
        items.push({name:`${tx.description} (${activeNo}/${tx.totalInstallments})`,cardName:card?ccLabel(card):"Bilinmeyen Kart",amount:tx.amount/tx.totalInstallments});
      }
    });
    timeline.push({label,monthKey:key,items,total:items.reduce((s,it)=>s+it.amount,0)});
  }
  return timeline;
};
const ccPayoffSim=(cards,method,extraBudget)=>{
  let active=cards.filter(c=>c.currentDebt>0).map(c=>({id:c.id,bankName:c.bankName,cardName:c.cardName,currentDebt:c.currentDebt,minimumPaymentRatio:c.minimumPaymentRatio,limit:c.limit}));
  if(active.length===0) return {steps:[],monthsToPayoff:0};
  if(method==="snowball") active.sort((a,b)=>a.currentDebt-b.currentDebt);
  else active.sort((a,b)=>(b.currentDebt/b.limit)-(a.currentDebt/a.limit));
  const steps=[]; let months=0; const maxMonths=36;
  while(active.some(c=>c.currentDebt>0)&&months<maxMonths){
    months++;
    const actions=[];
    active=active.map(c=>{
      if(c.currentDebt<=0) return c;
      let min=c.currentDebt*c.minimumPaymentRatio;
      if(min<100&&c.currentDebt>0) min=c.currentDebt;
      min=Math.min(min,c.currentDebt);
      const newDebt=Math.max(0,c.currentDebt-min);
      actions.push(`"${ccLabel(c)}" asgari ödeme: ${fmt(min)}`);
      return {...c,currentDebt:newDebt};
    });
    let extra=extraBudget;
    const target=active.find(c=>c.currentDebt>0);
    if(target&&extra>0){
      const before=target.currentDebt;
      const applied=Math.min(extra,before);
      target.currentDebt=Math.max(0,target.currentDebt-applied);
      actions.push(`🔥 Öncelikli hedef: "${ccLabel(target)}" kartına ${fmt(applied)} ekstra ödeme`);
      if(target.currentDebt===0) actions.push(`🎉 "${ccLabel(target)}" kartının borcu kapandı!`);
    }
    steps.push({monthIndex:months,actions,remainingDebts:active.map(c=>({id:c.id,name:c.cardName,bank:c.bankName,debt:c.currentDebt}))});
  }
  return {steps,monthsToPayoff:months};
};

/* ═══ BİLEŞENLER ═══ */
export default function App(){
  const [data,setData]             = useState(BLANK);
  const [loading,setLoading]       = useState(true);
  const [tab,setTab]               = useState("log");
  const [pendingRec,setPendingRec] = useState(null);
  const [notice,setNotice]         = useState(null);
  const [showOverflow,setShowOverflow] = useState(false);
  const importRef=useRef(), restoreRef=useRef(), overflowRef=useRef();
  const dark=data.settings?.dark||false;

  useEffect(()=>{
    (async()=>{
      try{ const r=await window.storage.get(KEY);
        if(r) setData(normalizeData(JSON.parse(r.value)));
      }
      catch(_){ /* kayıtlı veri okunamazsa boş verilerle devam edilir */ }
      finally{ setLoading(false); }
    })();
  },[]);
  useEffect(()=>{ if(!loading) window.storage.set(KEY,JSON.stringify(data)).catch(()=>{}); },[data,loading]);
  useEffect(()=>{
    if(loading) return;
    const t=todayStr();
    const due=data.recurring.find(r=>r.nextDue<=t&&!(r.confirmedDates||[]).includes(t));
    if(due) setPendingRec(due);
  },[loading]);
  useEffect(()=>{
    const h=e=>{ if(overflowRef.current&&!overflowRef.current.contains(e.target)) setShowOverflow(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);

  const mut=fn=>setData(prev=>({...prev,...fn(prev)}));
  const toggleDark=()=>mut(d=>({settings:{...(d.settings||{}),dark:!d.settings?.dark}}));
  const showNote=msg=>{setNotice(msg);setTimeout(()=>setNotice(null),5000);};
  const toggleChart=()=>mut(d=>({settings:{...d.settings,chartType:d.settings?.chartType==="bar"?"line":"bar"}}));

  const addTx   =tx      =>mut(d=>({transactions:[{id:uid(),createdAt:new Date().toISOString(),...tx},...d.transactions]}));
  const delTx   =id      =>mut(d=>({transactions:d.transactions.filter(t=>t.id!==id)}));
  const editTx  =(id,up) =>mut(d=>({transactions:d.transactions.map(t=>t.id===id?{...t,...up}:t)}));
  const addCat  =name    =>{ if(!data.categories.find(c=>c.name.toLowerCase()===name.toLowerCase())) mut(d=>({categories:[...d.categories,{id:uid(),name}]})); };
  const delCat  =id      =>mut(d=>({categories:d.categories.filter(c=>c.id!==id)}));
  const addTopCat=name   =>{ if(!data.topCategories?.find(c=>c.name.toLowerCase()===name.toLowerCase())) mut(d=>({topCategories:[...(d.topCategories||[]),{id:uid(),name}]})); };
  const setMBudget    =v    =>mut(d=>({budget:{...d.budget,monthly:v}}));
  const setCatBudget  =(n,v)=>mut(d=>({budget:{...d.budget,perCategory:{...d.budget.perCategory,[n]:v}}}));
  const addRec  =r  =>mut(d=>({recurring:[...d.recurring,{id:uid(),confirmedDates:[],...r}]}));
  const delRec  =id =>mut(d=>({recurring:d.recurring.filter(r=>r.id!==id)}));
  const addGoal =g  =>mut(d=>({goals:[...d.goals,{id:uid(),saved:0,...g}]}));
  const delGoal =id =>mut(d=>({goals:d.goals.filter(g=>g.id!==id)}));
  const addToGoal=(id,amount)=>mut(d=>({goals:d.goals.map(g=>g.id===id?{...g,saved:g.saved+amount}:g)}));
  const addInv    =inv =>mut(d=>({investments:[{id:uid(),createdAt:new Date().toISOString(),...inv},...d.investments]}));
  const delInv     =id  =>mut(d=>({investments:d.investments.filter(i=>i.id!==id)}));
  const editInv    =(id,up)=>mut(d=>({investments:d.investments.map(i=>i.id===id?{...i,...up}:i)}));
  const renameSymbol=(assetId,oldSym,newSym)=>mut(d=>{
    const oldKey=holdingKey(assetId,oldSym), newKey=holdingKey(assetId,newSym);
    const newPrices={...d.currentPrices};
    if(newPrices[oldKey]!==undefined){ newPrices[newKey]=newPrices[oldKey]; delete newPrices[oldKey]; }
    return {
      investments:d.investments.map(i=>(i.assetId===assetId&&(i.symbol||"").toUpperCase()===oldSym.toUpperCase())?{...i,symbol:newSym.toUpperCase()}:i),
      currentPrices:newPrices,
    };
  });
  const renameItem=(oldName,newName,byCategory)=>mut(d=>{
    const lo=oldName.toLowerCase(), nn=newName.trim();
    const same=x=>(x||"").toLowerCase()===lo;
    const fix=o=>{
      if(o.type==="income") return o;
      if(byCategory){
        if(!same(o.category||o.name)) return o;
        return {...o,category:nn,name:(same(o.name)&&(!o.category||same(o.category)))?nn:o.name};
      }
      if(!same(o.name)) return o;
      return {...o,name:nn,category:same(o.category)?nn:o.category};
    };
    const seen=new Set();
    const categories=d.categories.map(c=>same(c.name)?{...c,name:nn}:c).filter(c=>{const k=c.name.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
    const pc={...(d.budget.perCategory||{})};
    Object.keys(pc).forEach(k=>{ if(k.toLowerCase()===lo&&k!==nn){ if(!pc[nn]) pc[nn]=pc[k]; delete pc[k]; } });
    let topCategories=d.topCategories;
    if(byCategory){
      const seen2=new Set();
      topCategories=d.topCategories.map(c=>same(c.name)?{...c,name:nn}:c).filter(c=>{const k=c.name.toLowerCase();if(seen2.has(k))return false;seen2.add(k);return true;});
    }
    return {transactions:d.transactions.map(fix),recurring:(d.recurring||[]).map(fix),categories,topCategories,budget:{...d.budget,perCategory:pc}};
  });
  const setCurPrice=(assetId,price)=>mut(d=>({currentPrices:{...d.currentPrices,[assetId]:price}}));

  const addCCCard  =c      =>mut(d=>({credit:{...d.credit,cards:[...d.credit.cards,{id:uid(),...c}]}}));
  const editCCCard =(id,up)=>mut(d=>({credit:{...d.credit,cards:d.credit.cards.map(c=>c.id===id?{...c,...up}:c)}}));
  const delCCCard  =id     =>mut(d=>({credit:{...d.credit,cards:d.credit.cards.filter(c=>c.id!==id)}}));
  const addCCTx    =tx     =>mut(d=>({credit:{...d.credit,transactions:[{id:uid(),...tx},...d.credit.transactions]}}));
  const editCCTx   =(id,up)=>mut(d=>({credit:{...d.credit,transactions:d.credit.transactions.map(t=>t.id===id?{...t,...up}:t)}}));
  const delCCTx    =id     =>mut(d=>({credit:{...d.credit,transactions:d.credit.transactions.filter(t=>t.id!==id)}}));
  const setCCCategoryBudget=(cat,v)=>mut(d=>({credit:{...d.credit,categoryBudgets:{...d.credit.categoryBudgets,[cat]:v}}}));

  const confirmRec=(r,amount)=>{
    addTx({name:r.name,amount,category:r.category,date:todayStr(),notes:"",type:"expense",account:""});
    const nd=(()=>{ const d=new Date(r.nextDue); r.frequency==="weekly"?d.setDate(d.getDate()+7):d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,10); })();
    mut(d=>({recurring:d.recurring.map(rec=>rec.id===r.id?{...rec,confirmedDates:[...(rec.confirmedDates||[]),todayStr()],nextDue:nd,amount}:rec)}));
    setPendingRec(null);
  };

  const exportCSV=()=>{
    const rows=["Tarih,Ad,Kategori,Tutar,Not,Tür,Hesap"];
    data.transactions.forEach(t=>rows.push(`${t.date},"${t.name}","${t.category||t.name}",${t.amount},"${t.notes||""}","${t.type||"expense"}","${t.account||""}"`));
    saveTextFile("check-it-out-export.csv",rows.join("\n"),"text/csv");
  };

  const exportBackup=()=>saveTextFile("cheque-it-out-yedek.json",JSON.stringify(data,null,1),"application/json");

  const handleRestore=e=>{
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const parsed=JSON.parse(ev.target.result);
        if(!Array.isArray(parsed.transactions)) throw new Error("geçersiz yedek");
        if(!window.confirm("Mevcut tüm veriler yedekteki verilerle değiştirilecek. Devam edilsin mi?")) return;
        setData(normalizeData(parsed));
        showNote("✓ Yedek yüklendi.");
      }catch(_){ showNote("Geçersiz yedek dosyası."); }
    };
    reader.readAsText(file); e.target.value="";
  };

  const handleImport=e=>{
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const imported=parseCSV(ev.target.result);
      if(imported.length>0){
        const existing=new Set(data.transactions.map(t=>`${t.date}|${t.name}|${t.amount}`));
        const fresh=imported.filter(t=>!existing.has(`${t.date}|${t.name}|${t.amount}`));
        mut(d=>({transactions:[...fresh,...d.transactions].sort((a,b)=>b.date.localeCompare(a.date))}));
        showNote(`✓ ${fresh.length} işlem içe aktarıldı${imported.length-fresh.length>0?` (${imported.length-fresh.length} kopya atlandı)`:""}.`);
      } else showNote("Geçerli işlem bulunamadı.");
    };
    reader.readAsText(file); e.target.value="";
  };

  const month=thisMonth();
  const monthTxs=data.transactions.filter(t=>monthOf(t.date)===month);
  const monthTotal=sumAmount(monthTxs.filter(isExpense));

  if(loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,fontSize:14}}>Yükleniyor…</div>;

  const sh={data,addTx,delTx,editTx,addCat,delCat,addTopCat,addRec,delRec,setMBudget,setCatBudget,addGoal,delGoal,addToGoal,addInv,delInv,editInv,renameSymbol,renameItem,setCurPrice,addCCCard,editCCCard,delCCCard,addCCTx,editCCTx,delCCTx,setCCCategoryBudget,monthTotal,monthTxs,dark};

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@500&display=swap');
        .ft    {--bg:#E8DBB8;--surf:#F2E8CC;--surf2:#E0D2AC;--ink:#372E22;--ink2:#6B5B43;--ink3:#8F7E5A;--line:#D6C69E;--line2:#C3B28A;}
        .ft.dk {--bg:#0D1017;--surf:#161B27;--surf2:#1C2233;--ink:#ECEEF8;--ink2:#A0A9C2;--ink3:#606880;--line:#222836;--line2:#2C3348;}
        .ft-serif{font-family:'DM Serif Display',serif;}
        .ft-mono {font-family:'DM Mono',monospace;}
        .ft-inp  {border:none;background:transparent;font-family:system-ui,sans-serif;color:var(--ink);width:100%;}
        .ft-inp:focus{outline:none;}
        .ft-inp::placeholder{color:var(--ink3);}
        .ft-btn  {cursor:pointer;font-family:system-ui,sans-serif;}
        .ft-row:hover{background:var(--surf2);border-radius:6px;}
        .ft-row .ft-acts{opacity:0;transition:opacity 0.15s;display:flex;align-items:center;gap:1px;}
        .ft-row:hover .ft-acts{opacity:1;}
        .ft-sugg:hover{background:var(--surf2);}
        .ft-tab{transition:color 0.15s;}
        .ft-hday:hover{filter:brightness(1.15);}
        input[type="date"]{color-scheme:light dark;}
        input[type="number"]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type="number"]{-moz-appearance:textfield;}
        .ins-scroll::-webkit-scrollbar{display:none;}
      `}</style>
      <div className={`ft${dark?" dk":""}`} style={{fontFamily:"system-ui,sans-serif",color:"var(--ink)",background:"var(--bg)",minHeight:"100vh"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"28px 24px 0"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <svg width="60" height="32" viewBox="0 0 90 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{color:"var(--ink)",flexShrink:0}} aria-label="Kanatlı para ve peşinden koşan çöp adam">
                <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="22" cy="12" r="4.5"/>
                  <line x1="21" y1="17" x2="16" y2="30"/>
                  <polyline points="20,20 27,19 33,15"/>
                  <polyline points="19,22 26,26 32,24"/>
                  <polyline points="16,30 24,34 22,43"/>
                  <polyline points="16,30 9,36 3,34"/>
                </g>
                <g stroke={AC} strokeWidth="1.6" strokeLinecap="round" opacity="0.55">
                  <line x1="46" y1="25" x2="52" y2="25"/>
                  <line x1="43" y1="30" x2="51" y2="30"/>
                </g>
                <g fill={AC} fillOpacity="0.28" stroke={AC} strokeWidth="1.6" strokeLinejoin="round">
                  <path d="M57 19 C54 12 49 8 43 8 C45 11 45 13 44 15 C47 15 49 17 51 19 C53 19 55 20 57 21 Z"/>
                  <path d="M75 19 C78 12 83 8 89 8 C87 11 87 13 88 15 C85 15 83 17 81 19 C79 19 77 20 75 21 Z"/>
                  <path fill="none" d="M57 20 L44 13 M57 20.5 L47.5 17 M75 20 L88 13 M75 20.5 L84.5 17"/>
                </g>
                <circle cx="66" cy="20" r="9.5" fill={AC}/>
                <circle cx="66" cy="20" r="6.8" stroke="#fff" strokeOpacity="0.45" strokeWidth="1"/>
                <text x="66" y="24.3" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" fontFamily="system-ui,sans-serif">₺</text>
              </svg>
              <h1 className="ft-serif" style={{fontSize:28,fontWeight:400,margin:0,letterSpacing:"-0.3px"}}>Cheque It Out</h1>
            </div>
            <p style={{color:"var(--ink2)",fontSize:12,margin:"4px 0 0 69px"}}>{new Date().toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long"})}</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
            <button onClick={toggleDark} className="ft-btn" style={{border:"0.5px solid var(--line2)",borderRadius:8,padding:"7px 9px",background:"transparent",color:"var(--ink2)",display:"flex",alignItems:"center"}}>
              {dark?<Sun size={14}/>:<Moon size={14}/>}
            </button>
            <div ref={overflowRef} style={{position:"relative"}}>
              <button onClick={()=>setShowOverflow(v=>!v)} className="ft-btn" style={{border:`0.5px solid ${showOverflow?"var(--ink2)":"var(--line2)"}`,borderRadius:8,padding:"7px 9px",background:"transparent",color:"var(--ink2)",display:"flex",alignItems:"center"}}>
                <MoreHorizontal size={14}/>
              </button>
              {showOverflow&&(
                <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:"var(--surf)",border:"0.5px solid var(--line2)",borderRadius:10,zIndex:50,minWidth:155,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,0.13)"}}>
                  <input ref={importRef} type="file" accept=".csv" onChange={e=>{handleImport(e);setShowOverflow(false);}} style={{display:"none"}}/>
                  <input ref={restoreRef} type="file" accept=".json,application/json" onChange={e=>{handleRestore(e);setShowOverflow(false);}} style={{display:"none"}}/>
                  {[[()=>importRef.current?.click(),<Upload size={13}/>,"CSV içe aktar"],[()=>{exportCSV();setShowOverflow(false);},<Download size={13}/>,"CSV dışa aktar"],[()=>{exportBackup();setShowOverflow(false);},<Download size={13}/>,"Yedek al (JSON)"],[()=>restoreRef.current?.click(),<Upload size={13}/>,"Yedekten yükle"]].map(([fn,icon,label])=>(
                    <button key={label} onClick={fn} className="ft-btn" style={{width:"100%",padding:"11px 14px",border:"none",background:"transparent",textAlign:"left",fontSize:13,color:"var(--ink)",display:"flex",alignItems:"center",gap:9}}>
                      <span style={{color:"var(--ink2)"}}>{icon}</span>{label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {notice&&<div style={{margin:"12px 24px 0",background:dark?"#0f2a0f":"#DFE5C2",border:`0.5px solid ${OK}`,borderRadius:8,padding:"9px 14px",fontSize:13,color:OK}}>{notice}</div>}

        {pendingRec&&(
          <div style={{margin:"12px 24px 0",background:dark?"#261a08":"#EDD9AE",border:`1px solid ${AC}`,borderRadius:12,padding:"16px 20px"}}>
            <RecBanner r={pendingRec} onConfirm={a=>confirmRec(pendingRec,a)} onDismiss={()=>setPendingRec(null)}/>
          </div>
        )}

        <div style={{display:"flex",padding:"16px 24px 0",borderBottom:"0.5px solid var(--line)"}}>
          {[["log","Kayıt",PenLine],["analysis","Analiz",TrendingUp],["budget","Bütçe",Wallet],["invest","Yatırım",Coins],["credit","Krediler",CreditCard]].map(([id,label,Icon])=>(
            <button key={id} onClick={()=>setTab(id)} className="ft-btn ft-tab" style={{flex:1,padding:"10px 0",border:"none",background:"transparent",color:tab===id?AC:"var(--ink2)",borderBottom:`2px solid ${tab===id?AC:"transparent"}`,marginBottom:-1,fontSize:13,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Icon size={14}/>{label}
            </button>
          ))}
        </div>

        <div style={{padding:"0 24px 80px"}}>
          {tab==="log"      && <LogTab      {...sh}/>}
          {tab==="analysis" && <AnalysisTab {...sh} toggleChart={toggleChart}/>}
          {tab==="budget"   && <BudgetTab   {...sh}/>}
          {tab==="invest"   && <InvestTab   {...sh}/>}
          {tab==="credit"   && <CreditTab   {...sh}/>}
        </div>
      </div>
    </>
  );
}

function RecBanner({r,onConfirm,onDismiss}){
  const [amount,setAmount]=useState(String(r.amount));
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}><Bell size={15} color={AC}/><span style={{fontWeight:500,fontSize:14}}>Bugün vadesi gelen tekrarlı kayıt — {r.name}</span></div>
        <button onClick={onDismiss} className="ft-btn" style={iconBtn(0)}><X size={14}/></button>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{display:"flex",alignItems:"center",borderBottom:`2px solid ${AC}`,paddingBottom:4,flex:1,maxWidth:160}}>
          <span className="ft-mono" style={{color:AC,fontSize:16,marginRight:3}}>₺</span>
          <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="ft-inp ft-mono" style={{fontSize:16,fontWeight:500}}/>
        </div>
        <button onClick={()=>onConfirm(Number(amount))} className="ft-btn" style={{padding:"8px 18px",border:"none",borderRadius:8,background:AC,color:"#fff",fontSize:13,fontWeight:500}}>Onayla</button>
      </div>
    </div>
  );
}

function LogTab({data,addTx,delTx,editTx,addCat,delCat,addTopCat,addRec,delRec,dark}){
  const [txType,setTxType]             = useState("expense");
  const [name,setName]                 = useState("");
  const [amount,setAmount]             = useState("");
  const [topCat,setTopCat]             = useState("");
  const [notes,setNotes]               = useState("");
  const [date,setDate]                 = useState(todayStr());
  const [showDate,setShowDate]         = useState(false);
  const [showNotes,setShowNotes]       = useState(false);
  const [showRec,setShowRec]           = useState(false);
  const [showRecF,setShowRecF]         = useState(false);
  const [sugg,setSugg]                 = useState([]);
  const [suggIdx,setSuggIdx]           = useState(-1);
  const [dateFilter,setDateFilter]     = useState("");
  const [search,setSearch]             = useState("");
  const [confirmDel,setConfirmDel]     = useState(null);
  const [confirmDelTx,setConfirmDelTx] = useState(null);
  const [editingId,setEditingId]       = useState(null);
  const [editForm,setEditForm]         = useState({});
  const [showNewCat,setShowNewCat]     = useState(false);
  const [newCatName,setNewCatName]     = useState("");
  const amtRef=useRef();

  useEffect(()=>{
    if(!name.trim()){setSugg([]);return;}
    const lc=name.toLowerCase();
    const fromCats=data.categories.filter(c=>c.name.toLowerCase().startsWith(lc)&&c.name.toLowerCase()!==lc).map(c=>c.name);
    const fromTxs=[...new Set(data.transactions.map(t=>t.name))].filter(n=>n.toLowerCase().startsWith(lc)&&n.toLowerCase()!==lc&&!fromCats.map(c=>c.toLowerCase()).includes(n.toLowerCase()));
    setSugg([...fromCats,...fromTxs].slice(0,6).map((n,i)=>({id:i,name:n})));
    setSuggIdx(-1);
  },[name,data.categories,data.transactions]);

  const isCat=n=>!!data.categories.find(c=>c.name.toLowerCase()===n.toLowerCase());
  const disabled=!amount||Number(amount)<=0;
  const isIncome=txType==="income";
  const accentColor=isIncome?OK:AC;
  const typedRecurring=data.recurring.filter(r=>(r.type||"expense")===txType);

  const handleLog=()=>{
    const n=name.trim()||"Belirtilmemiş",a=Number(amount);
    if(!a||a<=0) return;
    const existingCat=data.categories.find(c=>c.name.toLowerCase()===n.toLowerCase());
    addTx({name:n,amount:a,category:topCat||existingCat?.name||n,date,notes:notes.trim(),type:txType});
    if(!isIncome){
      const prior=data.transactions.filter(t=>t.name.toLowerCase()===n.toLowerCase()&&isExpense(t)).length;
      if(prior>=1&&!existingCat) addCat(n);
    }
    setName("");setAmount("");setNotes("");setTopCat("");setDate(todayStr());setShowDate(false);setShowNotes(false);setSugg([]);
  };

  const month=thisMonth();
  const mInc =sumAmount(data.transactions.filter(t=>monthOf(t.date)===month&&isIncomeTx(t)));
  const mExp =sumAmount(data.transactions.filter(t=>monthOf(t.date)===month&&isExpense(t)));
  const mNet =mInc-mExp;

  const baseTxs=dateFilter?data.transactions.filter(t=>t.date===dateFilter):data.transactions;
  const [recentLimit,setRecentLimit] = useState(5);
  const displayTxs=search.trim()?baseTxs.filter(t=>{const q=search.toLowerCase();return t.name.toLowerCase().includes(q)||(t.category||"").toLowerCase().includes(q)||(t.notes||"").toLowerCase().includes(q);}):baseTxs.slice(0,dateFilter?50:recentLimit);
  const displayTotal=sumAmount(displayTxs);

  const startEdit=t=>{setEditingId(t.id);setEditForm({name:t.name,amount:String(t.amount),notes:t.notes||"",date:t.date,type:t.type||"expense",account:t.account||""});};
  const cancelEdit=()=>{setEditingId(null);setEditForm({});};
  const saveEdit=()=>{
    if(!editForm.name.trim()||!editForm.amount||Number(editForm.amount)<=0) return;
    editTx(editingId,{name:editForm.name.trim(),amount:Number(editForm.amount),notes:editForm.notes.trim(),date:editForm.date,category:editForm.name.trim(),type:editForm.type,account:editForm.account});
    cancelEdit();
  };

  return(
    <div>
      {(mInc>0||mExp>0)&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:20}}>
          {[["₺ Gelir",fmt(mInc),OK],["₺ Gider",fmt(mExp),ER],["Net",fmt(Math.abs(mNet)),mNet>=0?OK:ER]].map(([label,value,color])=>(
            <div key={label} style={{background:"var(--surf)",borderRadius:10,padding:"10px 12px",textAlign:"center",border:"0.5px solid var(--line)"}}>
              <p style={{fontSize:9,color:"var(--ink3)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</p>
              <p className="ft-mono" style={{fontSize:12,fontWeight:600,margin:0,color}}>{value}</p>
              {label==="Net"&&<p style={{fontSize:9,color:"var(--ink3)",margin:"2px 0 0"}}>{mNet>=0?"fazla":"açık"}</p>}
            </div>
          ))}
        </div>
      )}

      {data.categories.length>0&&(
        <div style={{marginTop:16}}>
          <p style={sectionLabel("0 0 10px")}>Hızlı seçim</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {data.categories.map(c=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",border:`0.5px solid ${confirmDel===c.id?ER:"var(--line2)"}`,borderRadius:20,overflow:"hidden",background:confirmDel===c.id?(dark?"#2a0a0a":"#ECCFBB"):"transparent",transition:"border-color 0.15s,background 0.15s"}}>
                {confirmDel===c.id?(
                  <>
                    <span style={{padding:"6px 10px 6px 13px",fontSize:12,color:ER,fontWeight:500,whiteSpace:"nowrap"}}>"{c.name}" silinsin mi?</span>
                    <button onClick={()=>{delCat(c.id);setConfirmDel(null);}} className="ft-btn" style={{padding:"5px 8px",border:"none",background:ER,color:"#fff",fontSize:11,fontWeight:600}}>Evet</button>
                    <button onClick={()=>setConfirmDel(null)} className="ft-btn" style={{padding:"5px 9px",border:"none",background:"transparent",color:"var(--ink2)",fontSize:11}}>Hayır</button>
                  </>
                ):(
                  <>
                    <button onClick={()=>{setName(c.name);amtRef.current?.focus();}} className="ft-btn"
                      style={{padding:"6px 12px",border:"none",background:"transparent",fontSize:13,color:"var(--ink)",fontWeight:500}}>{c.name}</button>
                    <button onClick={()=>setConfirmDel(c.id)} className="ft-btn"
                      style={{padding:"6px 8px 6px 0",border:"none",background:"transparent",color:"var(--ink3)"}}><X size={11}/></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{background:"var(--surf)",borderRadius:14,padding:"20px 20px 24px",marginTop:16,border:"0.5px solid var(--line)"}}>
        <div style={{display:"flex",border:"0.5px solid var(--line2)",borderRadius:9,padding:2,marginBottom:20}}>
          {["expense","income"].map(t=>(
            <button key={t} onClick={()=>setTxType(t)} className="ft-btn" style={{flex:1,padding:"7px 0",border:"none",borderRadius:7,background:txType===t?(t==="income"?OK:AC):"transparent",color:txType===t?"#fff":"var(--ink2)",fontSize:13,fontWeight:txType===t?600:400,transition:"all 0.15s"}}>
              {t==="expense"?"↓ Gider":"↑ Gelir"}
            </button>
          ))}
        </div>

        <div style={{position:"relative"}}>
          <input value={name} onChange={e=>setName(e.target.value)}
            onKeyDown={e=>{
              if(sugg.length>0){
                if(e.key==="ArrowDown"){e.preventDefault();setSuggIdx(v=>Math.min(v+1,sugg.length-1));}
                else if(e.key==="ArrowUp"){e.preventDefault();setSuggIdx(v=>Math.max(v-1,-1));}
                else if(e.key==="Enter"&&suggIdx>=0){e.preventDefault();setName(sugg[suggIdx].name);setSugg([]);setSuggIdx(-1);amtRef.current?.focus();}
                else if(e.key==="Escape"){setSugg([]);setSuggIdx(-1);}
                else if(e.key==="Enter"&&suggIdx<0){amtRef.current?.focus();}
              } else if(e.key==="Enter"){amtRef.current?.focus();}
            }}
            placeholder={isIncome?"Kaynak — veya boş bırak (Belirtilmemiş)":"Neye harcadın? — veya boş bırak"} className="ft-inp"
            style={{fontSize:18,paddingBottom:10,borderBottom:`2px solid ${name?"var(--ink)":"var(--line2)"}`,transition:"border-color 0.15s"}}/>
          {sugg.length>0&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:"var(--surf)",border:"0.5px solid var(--line2)",borderRadius:8,zIndex:10,marginTop:4,overflow:"hidden"}}>
              {sugg.map((s,i)=>(
                <button key={s.id} onClick={()=>{setName(s.name);setSugg([]);setSuggIdx(-1);amtRef.current?.focus();}} className="ft-btn ft-sugg"
                  style={{width:"100%",padding:"10px 14px",border:"none",background:i===suggIdx?"var(--surf2)":"transparent",textAlign:"left",fontSize:14,color:"var(--ink)",display:"flex",alignItems:"center",gap:8}}>
                  {i===suggIdx&&<span style={{fontSize:10,color:"var(--ink3)"}}>↵</span>}
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{display:"flex",alignItems:"center",borderBottom:`2px solid ${amount?accentColor:"var(--line2)"}`,marginTop:20,paddingBottom:10,transition:"border-color 0.15s"}}>
          <span className="ft-mono" style={{color:accentColor,fontSize:24,marginRight:6,fontWeight:500,lineHeight:1}}>₺</span>
          <input ref={amtRef} type="number" value={amount} onChange={e=>setAmount(e.target.value)}
            onKeyDown={e=>{
              if(e.key==="ArrowUp"||e.key==="ArrowDown") e.preventDefault();
              if(e.key==="Enter"&&!showNotes) handleLog();
            }}
            placeholder="0.00" className="ft-inp ft-mono" style={{fontSize:24,fontWeight:500}}/>
        </div>

        {showNotes&&<input value={notes} onChange={e=>setNotes(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLog()}
          placeholder="Not ekle… (isteğe bağlı)" className="ft-inp"
          style={{marginTop:14,paddingBottom:8,borderBottom:"1px solid var(--line2)",fontSize:14}}/>}

        <div style={{marginTop:16}}>
          <p style={{fontSize:9,color:"var(--ink3)",margin:"0 0 7px",letterSpacing:"0.08em",textTransform:"uppercase"}}>Kategori</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            {(data.topCategories||DEF_TOP_CATS).map(tc=>(
              <button key={tc.id} onClick={()=>setTopCat(topCat===tc.name?"":tc.name)} className="ft-btn"
                style={{padding:"4px 10px",borderRadius:20,fontSize:11,border:`0.5px solid ${topCat===tc.name?accentColor:"var(--line2)"}`,background:topCat===tc.name?accentColor:"transparent",color:topCat===tc.name?"#fff":"var(--ink2)",transition:"all 0.15s"}}>
                {tc.name}
              </button>
            ))}
            {showNewCat?(
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <input value={newCatName} onChange={e=>setNewCatName(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&newCatName.trim()){addTopCat(newCatName.trim());setNewCatName("");setShowNewCat(false);}if(e.key==="Escape"){setShowNewCat(false);setNewCatName("");}}}
                  placeholder="Yeni kategori" className="ft-inp" autoFocus
                  style={{borderBottom:"0.5px solid var(--line2)",fontSize:11,width:90,paddingBottom:2}}/>
                <button onClick={()=>{if(newCatName.trim()){addTopCat(newCatName.trim());setNewCatName("");setShowNewCat(false);}}} className="ft-btn"
                  style={{border:"none",background:accentColor,color:"#fff",borderRadius:5,padding:"2px 7px",fontSize:11}}>+</button>
                <button onClick={()=>{setShowNewCat(false);setNewCatName("");}} className="ft-btn"
                  style={iconBtn("2px 3px")}><X size={11}/></button>
              </div>
            ):(
              <button onClick={()=>setShowNewCat(true)} className="ft-btn"
                style={{padding:"3px 8px",borderRadius:20,fontSize:11,border:"0.5px solid var(--line2)",background:"transparent",color:"var(--ink3)"}}>+ Yeni</button>
            )}
          </div>
        </div>

        <div style={{marginTop:14,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>{setShowDate(v=>!v);if(showDate)setDate(todayStr());}} className="ft-btn"
            style={{fontSize:12,color:"var(--ink2)",border:"none",background:"transparent",padding:0,display:"flex",alignItems:"center",gap:4}}>
            {showDate?<X size={11}/>:<Plus size={11}/>}
            {!showDate?(date!==todayStr()?date:"Tarih seç"):"Bugünü kullan"}
          </button>
          {showDate&&<input type="date" value={date} onChange={e=>setDate(e.target.value)}
            style={{border:"0.5px solid var(--line2)",borderRadius:6,padding:"3px 8px",fontSize:12,background:"transparent",color:"var(--ink)"}}/>}
          <button onClick={()=>setShowNotes(v=>!v)} className="ft-btn"
            style={{fontSize:12,color:showNotes?accentColor:"var(--ink2)",border:"none",background:"transparent",padding:0,display:"flex",alignItems:"center",gap:4}}>
            {showNotes?<X size={11}/>:<Plus size={11}/>} Not
          </button>
          <button onClick={()=>setShowRec(v=>!v)} className="ft-btn"
            style={{marginLeft:"auto",fontSize:12,color:showRec?accentColor:"var(--ink2)",border:"none",background:"transparent",padding:0,display:"flex",alignItems:"center",gap:4}}>
            <RefreshCw size={11}/> {isIncome?"Tekrarlı gelir":"Tekrarlı gider"}
          </button>
        </div>

        <button onClick={handleLog} disabled={disabled} className="ft-btn"
          style={{width:"100%",marginTop:20,padding:13,border:"none",borderRadius:9,background:disabled?"var(--surf2)":accentColor,color:disabled?"var(--ink3)":"#fff",fontSize:14,fontWeight:500,transition:"background 0.15s"}}>
          {isIncome?"Geliri kaydet":"Harcamayı kaydet"}
        </button>
      </div>

      {showRec&&(
        <div style={{marginTop:8,background:"var(--surf2)",borderRadius:12,padding:"14px 16px",border:"0.5px solid var(--line)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showRecF?10:typedRecurring.length>0?10:0}}>
            <span style={{fontSize:11,color:"var(--ink3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>
              {isIncome?"Tekrarlı Gelir":"Tekrarlı Giderler"}{typedRecurring.length>0?` (${typedRecurring.length})`:""}
            </span>
            <button onClick={()=>setShowRecF(v=>!v)} className="ft-btn"
              style={{fontSize:12,color:accentColor,border:"none",background:"transparent",display:"flex",alignItems:"center",gap:3}}>
              {showRecF?<><X size={12}/> İptal</>:<><Plus size={12}/> Ekle</>}
            </button>
          </div>
          {showRecF&&<RecurringForm onAdd={r=>{addRec(r);setShowRecF(false);}} onCancel={()=>setShowRecF(false)} type={txType}/>}
          {typedRecurring.length===0&&!showRecF
              ?<p style={{color:"var(--ink3)",fontSize:13,margin:0}}>Henüz tekrarlı {isIncome?"gelir":"gider"} yok.</p>
              :typedRecurring.map(r=>(
                <div key={r.id} style={{display:"flex",alignItems:"center",background:"var(--surf)",borderRadius:8,padding:"10px 12px",marginBottom:6,border:"0.5px solid var(--line)"}}>
                  <RefreshCw size={12} style={{color:isIncome?OK:AC,marginRight:8,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <p style={{margin:0,fontSize:13,fontWeight:500}}>{r.name}</p>
                    <p style={{margin:"1px 0 0",fontSize:10,color:"var(--ink2)"}}>{r.frequency==="weekly"?"haftalık":"aylık"} · sıradaki: {r.nextDue}</p>
                  </div>
                  <span className="ft-mono" style={{fontSize:12,color:isIncome?OK:AC,marginRight:8}}>{fmt(r.amount)}</span>
                  <button onClick={()=>delRec(r.id)} className="ft-btn" style={iconBtn(2)}><Trash2 size={12}/></button>
                </div>
              ))}
        </div>
      )}

      <div style={{marginTop:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <p style={sectionLabel(0)}>
            {dateFilter?dateFilter+" tarihli işlemler":search?"Arama sonuçları":"Son işlemler"}
          </p>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {(dateFilter||search)&&<button onClick={()=>{setDateFilter("");setSearch("");}} className="ft-btn" style={{fontSize:11,color:"var(--ink2)",border:"none",background:"transparent",display:"flex",alignItems:"center",gap:2}}><X size={11}/> Temizle</button>}
            <div style={{display:"flex",alignItems:"center",gap:5,border:"0.5px solid var(--line2)",borderRadius:7,padding:"4px 8px",background:"var(--surf)"}}>
              <Calendar size={12} color="var(--ink3)"/>
              <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}
                style={{border:"none",background:"transparent",fontSize:12,color:dateFilter?"var(--ink)":"var(--ink3)",width:110,cursor:"pointer"}}/>
            </div>
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8,border:`0.5px solid ${search?AC:"var(--line2)"}`,borderRadius:9,padding:"8px 12px",marginBottom:12,background:"var(--surf)",transition:"border-color 0.15s"}}>
          <Search size={14} color={search?AC:"var(--ink3)"}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ad, kategori, not ara…" className="ft-inp" style={{fontSize:13}}/>
          {search&&<button onClick={()=>setSearch("")} className="ft-btn" style={{border:"none",background:"transparent",color:"var(--ink3)",padding:0,flexShrink:0}}><X size={13}/></button>}
        </div>

        {(dateFilter||search)&&displayTxs.length>0&&(
          <div style={{display:"flex",justifyContent:"space-between",background:"var(--surf2)",borderRadius:8,padding:"10px 14px",marginBottom:12,border:"0.5px solid var(--line)"}}>
            <span style={{fontSize:13,color:"var(--ink2)"}}>{displayTxs.length} işlem</span>
            <span className="ft-mono" style={{fontSize:13,fontWeight:500,color:AC}}>{fmt(displayTotal)}</span>
          </div>
        )}

        {displayTxs.length===0?(
          <p style={{color:"var(--ink3)",fontSize:14,textAlign:"center",padding:"32px 0"}}>
            {dateFilter||search?"Eşleşen işlem yok.":"Henüz kayıt yok. İlk harcamanı yukarıdan kaydet."}
          </p>
        ):(
          displayTxs.map(t=>
            editingId===t.id?(
              <div key={t.id} style={{background:"var(--surf2)",borderRadius:10,padding:"14px 16px",marginBottom:8,border:`1px solid ${AC}`}}>
                <div style={{display:"flex",border:"0.5px solid var(--line2)",borderRadius:7,padding:2,marginBottom:10}}>
                  {["expense","income"].map(tp=>(
                    <button key={tp} onClick={()=>setEditForm(f=>({...f,type:tp}))} className="ft-btn"
                      style={{flex:1,padding:"5px 0",border:"none",borderRadius:6,background:editForm.type===tp?(tp==="income"?OK:AC):"transparent",color:editForm.type===tp?"#fff":"var(--ink2)",fontSize:12,fontWeight:editForm.type===tp?600:400}}>
                      {tp==="expense"?"↓ Gider":"↑ Gelir"}
                    </button>
                  ))}
                </div>
                <div style={{display:"flex",gap:10,marginBottom:10}}>
                  <input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} className="ft-inp" placeholder="Ad"
                    style={{flex:2,borderBottom:"1px solid var(--line2)",paddingBottom:6,fontSize:14,fontWeight:500}}/>
                  <div style={{display:"flex",alignItems:"center",borderBottom:"1px solid var(--line2)",paddingBottom:6,flex:1}}>
                    <span className="ft-mono" style={{color:AC,marginRight:3,fontSize:14}}>₺</span>
                    <input type="number" value={editForm.amount} onChange={e=>setEditForm(f=>({...f,amount:e.target.value}))} className="ft-inp ft-mono" placeholder="0.00" style={{fontSize:14,fontWeight:500}}/>
                  </div>
                </div>
                <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center"}}>
                  <input value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} className="ft-inp" placeholder="Not (isteğe bağlı)"
                    style={{flex:1,borderBottom:"1px solid var(--line2)",paddingBottom:6,fontSize:13}}/>
                  <input type="date" value={editForm.date} onChange={e=>setEditForm(f=>({...f,date:e.target.value}))}
                    style={{border:"0.5px solid var(--line2)",borderRadius:6,padding:"3px 8px",fontSize:12,background:"var(--surf)",color:"var(--ink)",flexShrink:0}}/>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={cancelEdit} className="ft-btn" style={{flex:1,padding:8,border:"0.5px solid var(--line2)",borderRadius:8,background:"transparent",color:"var(--ink2)",fontSize:13}}>İptal</button>
                  <button onClick={saveEdit} className="ft-btn" style={{flex:2,padding:8,border:"none",borderRadius:8,background:AC,color:"#fff",fontSize:13,fontWeight:500}}>Değişiklikleri kaydet</button>
                </div>
              </div>
            ):(
              <div key={t.id} className="ft-row" style={{display:"flex",alignItems:"center",padding:"11px 8px",borderBottom:"0.5px solid var(--line)"}}>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:0,fontSize:14,fontWeight:500,color:isIncomeTx(t)?OK:"var(--ink)"}}>
                    {isIncomeTx(t)&&<span style={{marginRight:4,fontSize:12}}>↑</span>}{t.name}
                  </p>
                  <p style={{margin:"2px 0 0",fontSize:11,color:"var(--ink2)"}}>
                    {t.account?`${t.account} · `:""}
                    {t.category&&t.category!==t.name?`${t.category} · `:""}{t.date}
                    {t.notes?<span style={{color:"var(--ink3)"}}> · {t.notes}</span>:null}
                  </p>
                </div>
                <span className="ft-mono" style={{fontSize:14,fontWeight:500,marginRight:6,flexShrink:0,color:isIncomeTx(t)?OK:"var(--ink)"}}>{fmt(t.amount)}</span>
                <div className="ft-acts">
                  {isExpense(t)&&!isCat(t.name)&&(
                    <button onClick={()=>addCat(t.name)} className="ft-btn" title="Hızlı seçime kaydet"
                      style={iconBtn(4)}><Bookmark size={13}/></button>
                  )}
                  <button onClick={()=>startEdit(t)} className="ft-btn" title="Düzenle" style={iconBtn(4)}><Pencil size={13}/></button>
                  {confirmDelTx===t.id?(
                    <>
                      <span style={{fontSize:11,color:ER,whiteSpace:"nowrap",marginLeft:2}}>Silinsin mi?</span>
                      <button onClick={()=>{delTx(t.id);setConfirmDelTx(null);}} className="ft-btn"
                        style={{border:"none",background:ER,color:"#fff",borderRadius:5,padding:"2px 6px",fontSize:11,fontWeight:600,marginLeft:2}}>Evet</button>
                      <button onClick={()=>setConfirmDelTx(null)} className="ft-btn"
                        style={{border:"none",background:"transparent",color:"var(--ink2)",fontSize:11,padding:"2px 4px"}}>Hayır</button>
                    </>
                  ):(
                    <button onClick={()=>setConfirmDelTx(t.id)} className="ft-btn" title="Sil"
                      style={iconBtn(4)}><Trash2 size={13}/></button>
                  )}
                </div>
              </div>
            )
          )
        )}
        {!dateFilter&&!search&&baseTxs.length>recentLimit&&(
          <button onClick={()=>setRecentLimit(v=>v===5?20:5)} className="ft-btn"
            style={{width:"100%",marginTop:10,padding:9,border:"0.5px solid var(--line2)",borderRadius:8,background:"var(--surf)",color:"var(--ink2)",fontSize:12,fontWeight:500}}>
            {recentLimit===5?`Daha fazla göster (${Math.min(20,baseTxs.length)-5} tane daha)`:"Daha az göster"}
          </button>
        )}
      </div>
    </div>
  );
}

function RecurringForm({onAdd,onCancel,type="expense"}){
  const [name,setName]=useState(""); const [amount,setAmount]=useState(""); const [frequency,setFrequency]=useState("monthly"); const [nextDue,setNextDue]=useState(todayStr());
  const isInc=type==="income"; const accentCol=isInc?OK:AC;
  const sel={border:"0.5px solid var(--line2)",borderRadius:6,padding:"4px 8px",fontSize:12,color:"var(--ink)",background:"var(--surf)"};
  return(
    <div style={{background:"var(--surf2)",borderRadius:10,padding:16,marginBottom:12,border:`0.5px solid ${accentCol}44`}}>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder={isInc?"Kaynak adı (ör. Maaş, Kira geliri)":"Gider adı (ör. Netflix, Kira)"} className="ft-inp" style={{borderBottom:"0.5px solid var(--line2)",paddingBottom:8,marginBottom:12,fontSize:14}}/>
      <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center"}}>
        <div style={{flex:1,display:"flex",alignItems:"center",borderBottom:`0.5px solid var(--line2)`,paddingBottom:8}}>
          <span className="ft-mono" style={{color:accentCol,marginRight:4,fontSize:14}}>₺</span>
          <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="ft-inp ft-mono" style={{fontSize:14}}/>
        </div>
        <select value={frequency} onChange={e=>setFrequency(e.target.value)} style={sel}><option value="weekly">Haftalık</option><option value="monthly">Aylık</option></select>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <span style={{fontSize:12,color:"var(--ink2)"}}>İlk vade:</span>
        <input type="date" value={nextDue} onChange={e=>setNextDue(e.target.value)} style={sel}/>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onCancel} className="ft-btn" style={{flex:1,padding:9,border:"0.5px solid var(--line2)",borderRadius:8,background:"transparent",color:"var(--ink2)",fontSize:13}}>İptal</button>
        <button onClick={()=>{if(amount) onAdd({name:name.trim()||"Belirtilmemiş",amount:Number(amount),category:name.trim()||"Belirtilmemiş",frequency,nextDue,type});}} className="ft-btn"
          style={{flex:2,padding:9,border:"none",borderRadius:8,background:accentCol,color:"#fff",fontSize:13,fontWeight:500}}>
          {isInc?"Gelir":"Gider"} ekle
        </button>
      </div>
    </div>
  );
}

function InsightsRow({data}){
  const ins=getInsights(data);
  if(ins.length===0) return null;
  return(
    <div style={{marginTop:20}}>
      <p style={sectionLabel("0 0 10px")}>Öngörüler</p>
      <div className="ins-scroll" style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>
        {ins.map((ins,i)=>(
          <div key={i} style={{flexShrink:0,background:"var(--surf)",borderRadius:12,padding:"12px 14px",minWidth:120,border:"0.5px solid var(--line)",borderTop:`3px solid ${ins.color}`}}>
            <p style={{fontSize:18,margin:"0 0 4px",lineHeight:1}}>{ins.icon}</p>
            <p style={{fontSize:11,color:"var(--ink3)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{ins.label}</p>
            <p className="ft-mono" style={{fontSize:14,fontWeight:600,margin:0,color:ins.color}}>{ins.value}</p>
            <p style={{fontSize:10,color:"var(--ink3)",margin:"2px 0 0"}}>{ins.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatmapCalendar({data}){
  const [viewMonth,setViewMonth]=useState(thisMonth());
  const [selDay,setSelDay]=useState(null);
  const [year,month]=viewMonth.split("-").map(Number);
  const daysInMonth=new Date(year,month,0).getDate();
  const firstDow=new Date(year,month-1,1).getDay();
  const dayTotals={};
  data.transactions.filter(t=>monthOf(t.date)===viewMonth&&isExpense(t)).forEach(t=>{dayTotals[t.date]=(dayTotals[t.date]||0)+Number(t.amount);});
  const maxSpend=Math.max(...Object.values(dayTotals),1);
  const nav=offset=>{setViewMonth(shiftMonth(viewMonth,offset));setSelDay(null);};
  const selTxs=selDay?data.transactions.filter(t=>t.date===selDay):[];
  const selExp=sumAmount(selTxs.filter(isExpense));
  const selInc=sumAmount(selTxs.filter(isIncomeTx));
  return(
    <div style={{marginTop:28}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <p style={sectionLabel(0)}>Harcama takvimi</p>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>nav(-1)} className="ft-btn" style={{border:"none",background:"transparent",color:"var(--ink2)",padding:2,display:"flex"}}><ChevronLeft size={16}/></button>
          <span style={{fontSize:13,fontWeight:500,minWidth:130,textAlign:"center"}}>{new Date(year,month-1,1).toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}</span>
          <button onClick={()=>nav(1)} className="ft-btn" style={{border:"none",background:"transparent",color:"var(--ink2)",padding:2,display:"flex"}}><ChevronRight size={16}/></button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
        {["P","P","S","Ç","P","C","C"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,color:"var(--ink3)",fontWeight:600,padding:"3px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {Array.from({length:firstDow}).map((_,i)=><div key={`p${i}`}/>)}
        {Array.from({length:daysInMonth}).map((_,i)=>{
          const d=i+1;
          const dateStr=dayKey(viewMonth,d);
          const amount=dayTotals[dateStr]||0;
          const intensity=amount/maxSpend;
          const isSel=selDay===dateStr;
          const isToday=dateStr===todayStr();
          const alpha=amount>0?0.18+intensity*0.82:0;
          return(
            <div key={d} onClick={()=>setSelDay(isSel?null:dateStr)} className="ft-hday"
              style={{height:36,background:isSel?AC:amount>0?`rgba(${ACRGB},${alpha})`:"var(--surf2)",borderRadius:6,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:isToday&&!isSel?`1.5px solid ${AC}`:"1.5px solid transparent",transition:"background 0.1s"}}>
              <span style={{fontSize:11,color:isSel?"#fff":intensity>0.65?"#fff":"var(--ink)",fontWeight:isToday?700:400,lineHeight:1}}>{d}</span>
              {amount>0&&<span style={{fontSize:8,color:isSel?"rgba(255,255,255,0.75)":intensity>0.65?"rgba(255,255,255,0.65)":"var(--ink3)",marginTop:1}}>{amount>=1000?Math.round(amount/1000)+"k":Math.round(amount)}</span>}
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:5,marginTop:8,justifyContent:"flex-end"}}>
        <span style={{fontSize:9,color:"var(--ink3)"}}>Az</span>
        {[0.15,0.35,0.55,0.75,0.95].map(a=><div key={a} style={{width:11,height:11,borderRadius:3,background:`rgba(${ACRGB},${a})`}}/>)}
        <span style={{fontSize:9,color:"var(--ink3)"}}>Çok</span>
      </div>
      {selDay&&(
        <div style={{marginTop:10,background:"var(--surf)",borderRadius:10,border:`0.5px solid ${AC}`,padding:"12px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:500}}>{new Date(selDay+"T12:00:00").toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long"})}</span>
            <div style={{display:"flex",gap:10}}>
              {selInc>0&&<span className="ft-mono" style={{fontSize:12,color:OK}}>+{fmt(selInc)}</span>}
              {selExp>0&&<span className="ft-mono" style={{fontSize:12,color:AC}}>{fmt(selExp)}</span>}
            </div>
          </div>
          {selTxs.length===0?<p style={{fontSize:12,color:"var(--ink3)",margin:0}}>Bu günde işlem yok.</p>
          :selTxs.map(t=>(
            <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderTop:"0.5px solid var(--line)"}}>
              <span style={{fontSize:13,color:"var(--ink)"}}>
                {isIncomeTx(t)&&<span style={{color:OK,marginRight:3,fontSize:11}}>↑</span>}
                {t.name}{t.notes&&<span style={{color:"var(--ink3)",fontSize:11}}> · {t.notes}</span>}
              </span>
              <span className="ft-mono" style={{fontSize:13,color:isIncomeTx(t)?OK:"var(--ink)",fontWeight:500}}>{fmt(t.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalysisTab({data,dark,toggleChart,renameItem}){
  const [sel,setSel]=useState(null);
  const [period,setPeriod]=useState("daily");
  const [avgMode,setAvgMode]=useState("daily");
  const [dowScope,setDowScope]=useState("alltime");
  const [catScope,setCatScope]=useState("alltime");
  const [catDD,setCatDD]=useState(false);
  const [monthScope,setMonthScope]=useState("thismonth");
  const [monthDD,setMonthDD]=useState(false);
  const [viewItem,setViewItem]=useState(null);
  const chartType=data.settings?.chartType||"line";

  if(viewItem) return <ItemDetailPage data={data} query={viewItem.name} byCategory={viewItem.byCategory} onBack={()=>setViewItem(null)}
    onRename={nn=>{ renameItem(viewItem.name,nn,viewItem.byCategory); if(sel&&sel.toLowerCase()===viewItem.name.toLowerCase()) setSel(null); setViewItem({...viewItem,name:nn}); }}/>;

  const catMap={};
  data.transactions.filter(isExpense).forEach(t=>{const raw=(t.category||t.name).trim(),key=raw.toLowerCase();if(!catMap[key])catMap[key]=raw;});
  const allCats=Object.values(catMap).sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase()));
  const txs=sel?data.transactions.filter(t=>isExpense(t)&&(t.category||t.name).toLowerCase()===sel.toLowerCase()):data.transactions.filter(isExpense);

  const cur=thisMonth();
  const [cyear,cmonth]=cur.split("-").map(Number);
  const daysInMonth=new Date(cyear,cmonth,0).getDate();

  // Tek geçişte günlere ve aylara göre grupla
  const byDate={}, byMonth={};
  txs.forEach(t=>{
    (byDate[t.date]=byDate[t.date]||[]).push(t);
    const m=monthOf(t.date);byMonth[m]=(byMonth[m]||0)+Number(t.amount);
  });
  const dailyData=Array.from({length:daysInMonth},(_,i)=>({month:String(i+1),total:sumAmount(byDate[dayKey(cur,i+1)]||[])}));
  const monthlyData=Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).slice(-12)
    .map(([m,total])=>({month:new Date(m+"-01").toLocaleDateString("tr-TR",{month:"short",year:"2-digit"}),total:Math.round(total)}));
  const monthRows=Object.entries(byMonth).sort(([a],[b])=>b.localeCompare(a));

  const chartData=period==="daily"?dailyData:monthlyData;

  const curMonthTxs=txs.filter(t=>monthOf(t.date)===cur);
  const curTotal=sumAmount(curMonthTxs);
  const curCount=curMonthTxs.length;
  const grand=sumAmount(txs);

  // Günlük ortalama: ayın tamamına değil, bu aydaki ilk kayıttan bugüne kadar geçen güne bölünür
  const firstTxDate=curMonthTxs.map(t=>t.date).sort()[0];
  const activeDays=firstTxDate
    ?Math.max(1,Math.round((new Date(todayStr())-new Date(firstTxDate+"T12:00:00"))/(1000*60*60*24))+1)
    :1;
  const dailyAvgVal=curTotal/activeDays;
  const numMonths=Math.max(1,Object.keys(byMonth).length);
  const monthlyAvgVal=grand/numMonths;

  const freqMap={};
  data.transactions.filter(isExpense).forEach(t=>{const n=(t.name||"Belirtilmemiş").trim();freqMap[n]=(freqMap[n]||0)+1;});
  const topFreq=Object.entries(freqMap).sort(([,a],[,b])=>b-a).slice(0,3);

  // Haftanın günü ortalamaları (Pzt=1 … Paz=0)
  const DOW_L=["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
  const thisYear=new Date().getFullYear();
  const byDow=Array.from({length:7},()=>[]);
  txs.forEach(t=>{
    const d=new Date(t.date+"T12:00:00");
    if(dowScope==="year"&&d.getFullYear()!==thisYear) return;
    byDow[d.getDay()].push(t);
  });
  const dowData=[1,2,3,4,5,6,0].map((dow,i)=>{
    const rel=byDow[dow];
    const uniqueDays=new Set(rel.map(t=>t.date)).size;
    return {label:DOW_L[i],avg:uniqueDays>0?sumAmount(rel)/uniqueDays:0};
  });
  const maxDow=Math.max(...dowData.map(d=>d.avg),1);

  const scopedByCat={};
  filterByScope(data.transactions.filter(isExpense),catScope).forEach(t=>{
    const key=(t.category||t.name).toLowerCase();
    (scopedByCat[key]=scopedByCat[key]||[]).push(t);
  });

  const Tip=({active,payload})=>{
    if(!active||!payload?.length) return null;
    return(<div style={{background:"var(--surf)",border:"0.5px solid var(--line2)",borderRadius:8,padding:"8px 12px",fontSize:12}}><p style={{margin:0,fontWeight:500}}>{period==="daily"?"Gün "+payload[0].payload.month:payload[0].payload.month}</p><p className="ft-mono" style={{margin:"2px 0 0",color:AC}}>{fmt(payload[0].value)}</p></div>);
  };
  return(
    <div>
      <InsightsRow data={data}/>
      <div style={{marginTop:20,marginBottom:20}}>
        <p style={sectionLabel("0 0 10px")}>Kategoriye göre filtrele</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          <button onClick={()=>setSel(null)} className="ft-btn" style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${!sel?AC:"var(--line2)"}`,background:!sel?AC:"transparent",color:!sel?"#fff":"var(--ink2)",fontSize:13,fontWeight:500}}>Tümü</button>
          {allCats.map(cat=>(
            <button key={cat} onClick={()=>setSel(cat===sel?null:cat)} className="ft-btn"
              style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${sel===cat?AC:"var(--line2)"}`,background:sel===cat?AC:"transparent",color:sel===cat?"#fff":"var(--ink)",fontSize:13,fontWeight:500}}>{cat}</button>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,marginBottom:24}}>
        <div style={{background:"var(--surf2)",borderRadius:10,padding:"14px 12px 10px",textAlign:"center",position:"relative"}}>
          <div onClick={()=>setMonthDD(v=>!v)} className="ft-btn" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:3,userSelect:"none"}}>
            <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.06em"}}>
              {monthScope==="thismonth"?"Bu ay":SCOPE_OPTS.find(([v])=>v===monthScope)?.[1]||"Bu ay"}
            </p>
            <ChevronDown size={10} color="var(--ink3)" style={{marginBottom:6}}/>
          </div>
          <p className="ft-mono" style={{fontSize:12,fontWeight:500,margin:0}}>
            {fmt(sumAmount(filterByScope(txs,monthScope)))}
          </p>
          {monthDD&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:4,background:"var(--surf)",border:"0.5px solid var(--line2)",borderRadius:8,zIndex:20,overflow:"hidden",boxShadow:"0 4px 16px rgba(0,0,0,0.15)"}}>
              {SCOPE_OPTS.map(([v,l])=>(
                <button key={v} onClick={()=>{setMonthScope(v);setMonthDD(false);}} className="ft-btn"
                  style={{width:"100%",padding:"8px 10px",border:"none",background:monthScope===v?"var(--surf2)":"transparent",textAlign:"left",fontSize:11,color:monthScope===v?AC:"var(--ink)"}}>{l}</button>
              ))}
            </div>
          )}
        </div>
        <div onClick={()=>setAvgMode(v=>v==="daily"?"monthly":"daily")} className="ft-btn"
          style={{background:"var(--surf2)",borderRadius:10,padding:"12px 12px 10px",textAlign:"center",border:`1px solid ${AC}33`,userSelect:"none"}}>
          <p style={{fontSize:10,color:AC,margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.06em",display:"flex",alignItems:"center",justifyContent:"center",gap:3}}>
            {avgMode==="daily"?"Günlük ort.":"Aylık ort."}<span style={{fontSize:12,lineHeight:1}}>⇅</span>
          </p>
          <p className="ft-mono" style={{fontSize:12,fontWeight:500,margin:0}}>{avgMode==="daily"?fmt(dailyAvgVal):fmt(monthlyAvgVal)}</p>
          <p style={{fontSize:8,color:"var(--ink3)",margin:"3px 0 0",letterSpacing:"0.03em"}}>değiştirmek için dokun</p>
        </div>
        <div style={{background:"var(--surf2)",borderRadius:10,padding:"14px 12px",textAlign:"center"}}>
          <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{curCount} kayıt</p>
          <p className="ft-mono" style={{fontSize:12,fontWeight:500,margin:0}}>bu ay</p>
        </div>
      </div>
      {chartData.length>0?(
        <div style={{background:"var(--surf)",borderRadius:14,padding:"20px 8px 12px",border:"0.5px solid var(--line)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"0 0 16px 12px",paddingRight:4}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <p style={{fontSize:11,color:"var(--ink3)",letterSpacing:"0.08em",textTransform:"uppercase",margin:0}}>
                {period==="daily"?"Günlük — "+new Date(cur+"-01").toLocaleDateString("tr-TR",{month:"long",year:"numeric"}):"Aylık trend"}
              </p>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{display:"flex",background:"var(--surf2)",borderRadius:7,padding:2}}>
                {["daily","monthly"].map(p=>(
                  <button key={p} onClick={()=>setPeriod(p)} className="ft-btn"
                    style={{padding:"3px 8px",border:"none",borderRadius:5,background:period===p?"var(--surf)":"transparent",color:period===p?AC:"var(--ink3)",fontSize:11,fontWeight:period===p?600:400,transition:"all 0.15s"}}>
                    {p==="daily"?"Günlük":"Aylık"}
                  </button>
                ))}
              </div>
              <button onClick={toggleChart} className="ft-btn" title="Grafik türünü değiştir"
                style={{border:"0.5px solid var(--line2)",borderRadius:7,padding:"4px 8px",background:"transparent",color:"var(--ink2)",display:"flex",alignItems:"center",gap:4,fontSize:11}}>
                {chartType==="line"?<BarChart2 size={13}/>:<TrendingUp size={13}/>}
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            {chartType==="bar"?(
              <BarChart data={chartData} margin={{top:0,right:12,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={softLine(dark)} vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:11,fill:axisColor(dark)}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:axisColor(dark)}} axisLine={false} tickLine={false} tickFormatter={v=>"₺"+v} width={62}/>
                <Tooltip content={<Tip/>}/>
                <Bar dataKey="total" fill={AC} radius={[4,4,0,0]}/>
              </BarChart>
            ):(
              <LineChart data={chartData} margin={{top:0,right:12,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={softLine(dark)} vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:11,fill:axisColor(dark)}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:axisColor(dark)}} axisLine={false} tickLine={false} tickFormatter={v=>"₺"+v} width={62}/>
                <Tooltip content={<Tip/>}/>
                <Line type="monotone" dataKey="total" stroke={AC} strokeWidth={2.5} dot={{fill:AC,r:4,strokeWidth:0}} activeDot={{r:6,strokeWidth:0}}/>
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      ):(
        <div style={{textAlign:"center",padding:"48px 0",color:"var(--ink3)",fontSize:14}}>Harcama trendlerini görmek için işlem kaydet.</div>
      )}
      <HeatmapCalendar data={data}/>
      {monthRows.length>0&&(
        <div style={{marginTop:28}}>
          <p style={sectionLabel("0 0 12px")}>Aylık döküm</p>
          <div style={{background:"var(--surf)",borderRadius:14,border:"0.5px solid var(--line)",overflow:"hidden"}}>
            {monthRows.map(([m,total],i)=>{
              const prev=monthRows[i+1]?.[1]||null;
              const diff=prev!==null?total-prev:null;
              const pct=prev?Math.round(Math.abs(diff/prev)*100):null;
              const isCur=m===cur;
              return(
                <div key={m} style={{display:"flex",alignItems:"center",padding:"12px 16px",borderBottom:i<monthRows.length-1?"0.5px solid var(--line)":"none",background:isCur?(dark?"#1a2a1a":"#DFE3BF"):"transparent"}}>
                  <div style={{flex:1}}>
                    <span style={{fontSize:13,fontWeight:isCur?600:400}}>{new Date(m+"-01").toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}</span>
                    {isCur&&<span style={{fontSize:10,color:OK,marginLeft:8,fontWeight:600,letterSpacing:"0.05em"}}>ŞİMDİ</span>}
                  </div>
                  <span className="ft-mono" style={{fontSize:13,fontWeight:500,marginRight:10}}>{fmt(total)}</span>
                  {diff!==null?(
                    <span className="ft-mono" style={{fontSize:11,color:diff>0?ER:OK,fontWeight:500,minWidth:80,textAlign:"right"}}>
                      {diff>0?"▲":"▼"} {fmt(Math.abs(diff))} <span style={{opacity:0.6,fontWeight:400}}>({pct}%)</span>
                    </span>
                  ):<span style={{minWidth:80}}/>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {!sel&&allCats.length>0&&(
        <div style={{marginTop:28}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,position:"relative"}}>
            <p style={sectionLabel(0)}>Kategoriye göre</p>
            <div onClick={()=>setCatDD(v=>!v)} className="ft-btn"
              style={{fontSize:11,color:AC,border:`0.5px solid ${AC}`,borderRadius:6,padding:"3px 9px",display:"flex",alignItems:"center",gap:4,userSelect:"none"}}>
              {SCOPE_OPTS.find(([v])=>v===catScope)?.[1]} <ChevronDown size={11}/>
            </div>
            {catDD&&(
              <div style={{position:"absolute",top:"100%",right:0,marginTop:4,background:"var(--surf)",border:"0.5px solid var(--line2)",borderRadius:8,zIndex:20,overflow:"hidden",boxShadow:"0 4px 16px rgba(0,0,0,0.15)",minWidth:120}}>
                {SCOPE_OPTS.map(([v,l])=>(
                  <button key={v} onClick={()=>{setCatScope(v);setCatDD(false);}} className="ft-btn"
                    style={{width:"100%",padding:"8px 12px",border:"none",background:catScope===v?"var(--surf2)":"transparent",textAlign:"left",fontSize:12,color:catScope===v?AC:"var(--ink)"}}>{l}</button>
                ))}
              </div>
            )}
          </div>
          {allCats.map(cat=>({cat,total:sumAmount(scopedByCat[cat.toLowerCase()]||[])}))
            .filter(c=>c.total>0)
            .sort((a,b)=>b.total-a.total)
            .map(({cat,total})=>(
              <div key={cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 2px",borderBottom:"0.5px solid var(--line)"}}>
                <button onClick={()=>setViewItem({name:cat,byCategory:true})} className="ft-btn"
                  style={{border:"none",background:"transparent",padding:0,fontSize:13,fontWeight:500,color:"var(--ink)",textDecoration:"underline",textDecorationColor:"var(--line2)",textUnderlineOffset:3}}>{cat}</button>
                <span className="ft-mono" style={{fontSize:13,color:AC}}>{fmt(total)}</span>
              </div>
            ))}
        </div>
      )}

      {topFreq.length>0&&(
        <div style={{marginTop:28}}>
          <p style={sectionLabel("0 0 12px")}>En sık yapılan alımlar</p>
          {topFreq.map(([name,count],i)=>(
            <div key={name} style={{display:"flex",alignItems:"center",background:"var(--surf)",borderRadius:10,padding:"12px 16px",marginBottom:8,border:"0.5px solid var(--line)"}}>
              <span className="ft-mono" style={{fontSize:16,fontWeight:700,color:"var(--ink3)",marginRight:14,minWidth:20,textAlign:"center"}}>{i+1}</span>
              <button onClick={()=>setViewItem({name,byCategory:false})} className="ft-btn"
                style={{flex:1,border:"none",background:"transparent",padding:0,textAlign:"left",fontSize:14,fontWeight:500,color:"var(--ink)",textDecoration:"underline",textDecorationColor:"var(--line2)",textUnderlineOffset:3}}>{name}</button>
              <span className="ft-mono" style={{fontSize:13,color:AC}}>{count}×</span>
            </div>
          ))}
        </div>
      )}

      <div style={{marginTop:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p style={sectionLabel(0)}>Haftanın gününe göre ort. harcama</p>
          <div onClick={()=>setDowScope(v=>v==="alltime"?"year":"alltime")} className="ft-btn"
            style={{fontSize:11,color:AC,border:`0.5px solid ${AC}`,borderRadius:6,padding:"3px 9px",display:"flex",alignItems:"center",gap:4,userSelect:"none"}}>
            {dowScope==="alltime"?"Tüm zamanlar":"Bu yıl"} <span style={{fontSize:12}}>⇅</span>
          </div>
        </div>
        <div style={{background:"var(--surf)",borderRadius:12,padding:"16px 14px 12px",border:"0.5px solid var(--line)"}}>
          <div style={{display:"flex",gap:4,alignItems:"flex-end",height:72,marginBottom:8}}>
            {dowData.map(d=>(
              <div key={d.label} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{width:"100%",background:d.avg>0?AC:"var(--surf2)",borderRadius:"3px 3px 0 0",height:`${Math.max(d.avg>0?6:2,(d.avg/maxDow)*68)}px`,transition:"height 0.4s",opacity:d.avg>0?0.85:0.3}}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:4}}>
            {dowData.map(d=>(
              <div key={d.label} style={{flex:1,textAlign:"center"}}>
                <p style={{fontSize:10,color:"var(--ink3)",margin:0,fontWeight:600}}>{d.label}</p>
                <p className="ft-mono" style={{fontSize:9,color:d.avg>0?AC:"var(--ink3)",margin:"2px 0 0"}}>{d.avg>0?fmt(d.avg):"—"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

/* ── Ürün/kategori detay sayfası ── */
function ItemDetailPage({data,query,byCategory,onBack,onRename}){
  const [viewMonth,setViewMonth]=useState(thisMonth());
  const [editing,setEditing]=useState(false);
  const [newName,setNewName]=useState(query);
  useEffect(()=>{ setNewName(query); },[query]);
  const submitRename=()=>{
    const nn=newName.trim();
    if(nn&&nn!==query) onRename(nn);
    setEditing(false);
  };
  const match=t=>isExpense(t)&&(byCategory?(t.category||t.name):t.name).toLowerCase()===query.toLowerCase();
  const txs=data.transactions.filter(match).sort((a,b)=>b.date.localeCompare(a.date));
  const total=sumAmount(txs);
  const count=txs.length;
  const avg=count?total/count:0;
  const dates=txs.map(t=>t.date).sort();
  const first=dates[0];

  const DOW_L=["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"];
  const dowCount={};
  txs.forEach(t=>{const d=new Date(t.date+"T12:00:00").getDay();dowCount[d]=(dowCount[d]||0)+1;});
  const topDow=Object.entries(dowCount).sort(([,a],[,b])=>b-a)[0];

  let avgGap=null;
  if(dates.length>1){
    let gaps=[];
    for(let i=1;i<dates.length;i++) gaps.push((new Date(dates[i])-new Date(dates[i-1]))/(1000*60*60*24));
    avgGap=gaps.reduce((s,g)=>s+g,0)/gaps.length;
  }

  // Trend: en yeni yarının ortalaması ile eski yarının ortalaması karşılaştırılır
  let trend=null;
  if(count>=4){
    const half=Math.floor(count/2);
    const recent=sumAmount(txs.slice(0,half))/half;
    const older=sumAmount(txs.slice(half))/(count-half);
    if(older>0){const pct=Math.round(((recent-older)/older)*100); trend={pct,up:recent>older};}
  }

  const [vy,vm]=viewMonth.split("-").map(Number);
  const daysInMonth=new Date(vy,vm,0).getDate();
  const firstDow=new Date(vy,vm-1,1).getDay();
  const dayTotals={};
  txs.filter(t=>monthOf(t.date)===viewMonth).forEach(t=>{dayTotals[t.date]=(dayTotals[t.date]||0)+Number(t.amount);});
  const maxDay=Math.max(...Object.values(dayTotals),1);
  const nav=off=>setViewMonth(shiftMonth(viewMonth,off));

  return(
    <div style={{marginTop:24}}>
      <button onClick={onBack} className="ft-btn" style={{display:"flex",alignItems:"center",gap:5,border:"none",background:"transparent",color:"var(--ink2)",padding:0,marginBottom:16,fontSize:13}}>
        <ChevronLeft size={15}/> Analize dön
      </button>
      {editing?(
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submitRename();if(e.key==="Escape"){setEditing(false);setNewName(query);}}} autoFocus
              className="ft-inp ft-serif" style={{fontSize:22,borderBottom:`2px solid ${AC}`,paddingBottom:4}}/>
            <button onClick={submitRename} className="ft-btn" style={{border:"none",background:AC,color:"#fff",borderRadius:7,padding:"6px 12px",fontSize:12,fontWeight:500}}>Kaydet</button>
            <button onClick={()=>{setEditing(false);setNewName(query);}} className="ft-btn" style={{border:"0.5px solid var(--line2)",background:"transparent",color:"var(--ink2)",borderRadius:7,padding:"6px 10px",fontSize:12}}>İptal</button>
          </div>
          <p style={{fontSize:11,color:"var(--ink3)",margin:"6px 0 0"}}>Geçmişteki tüm kayıtlar yeni adla güncellenir. Aynı adda bir kayıt grubu varsa birleşirler.</p>
        </div>
      ):(
        <div style={{display:"flex",alignItems:"center",gap:8,margin:"0 0 4px"}}>
          <h2 className="ft-serif" style={{fontSize:24,margin:0}}>{query}</h2>
          <button onClick={()=>setEditing(true)} className="ft-btn" title="Adı düzenle" style={{border:"none",background:"transparent",color:"var(--ink3)",padding:4,display:"flex"}}><Pencil size={15}/></button>
        </div>
      )}
      <p style={{fontSize:12,color:"var(--ink3)",margin:"0 0 20px"}}>{byCategory?"Kategori":"Ürün"} · {count} alım{first?` · ilk kayıt ${first}`:""}</p>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:24}}>
        {[["Toplam harcama",fmt(total)],["Ort. / alım",fmt(avg)],["Alımlar",String(count)]].map(([l,v])=>(
          <div key={l} style={{background:"var(--surf2)",borderRadius:10,padding:"14px 12px",textAlign:"center"}}>
            <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</p>
            <p className="ft-mono" style={{fontSize:13,fontWeight:600,margin:0}}>{v}</p>
          </div>
        ))}
      </div>

      <div style={{background:"var(--surf)",borderRadius:12,padding:"16px",border:"0.5px solid var(--line)",marginBottom:24}}>
        <p style={sectionLabel("0 0 12px")}>Davranış</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {topDow&&<p style={{fontSize:13,margin:0}}>En sık <strong>{DOW_L[topDow[0]]}</strong> günü alınıyor ({topDow[1]} kez).</p>}
          {avgGap!==null&&<p style={{fontSize:13,margin:0}}>Bunu yaklaşık her <strong>{avgGap.toFixed(1)} günde</strong> bir alıyorsun.</p>}
          {trend&&<p style={{fontSize:13,margin:0,color:trend.up?ER:OK}}>Son alımlar öncekilere göre <strong>%{Math.abs(trend.pct)} {trend.up?"daha yüksek":"daha düşük"}</strong>.</p>}
          {!topDow&&!avgGap&&<p style={{fontSize:13,color:"var(--ink3)",margin:0}}>Örüntüleri görmek için birkaç alım daha kaydet.</p>}
        </div>
      </div>

      <div style={{marginBottom:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <p style={sectionLabel(0)}>Alım takvimi</p>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>nav(-1)} className="ft-btn" style={{border:"none",background:"transparent",color:"var(--ink2)",padding:2,display:"flex"}}><ChevronLeft size={15}/></button>
            <span style={{fontSize:12,fontWeight:500,minWidth:120,textAlign:"center"}}>{new Date(vy,vm-1,1).toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}</span>
            <button onClick={()=>nav(1)} className="ft-btn" style={{border:"none",background:"transparent",color:"var(--ink2)",padding:2,display:"flex"}}><ChevronRight size={15}/></button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
          {["P","P","S","Ç","P","C","C"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:9,color:"var(--ink3)",fontWeight:600}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
          {Array.from({length:firstDow}).map((_,i)=><div key={`p${i}`}/>)}
          {Array.from({length:daysInMonth}).map((_,i)=>{
            const d=i+1; const dateStr=dayKey(viewMonth,d);
            const amount=dayTotals[dateStr]||0; const intensity=amount/maxDay;
            return(
              <div key={d} style={{height:32,background:amount>0?`rgba(${ACRGB},${0.2+intensity*0.8})`:"var(--surf2)",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:10,color:intensity>0.6?"#fff":"var(--ink)"}}>{d}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p style={sectionLabel("0 0 10px")}>Tüm alımlar</p>
        {txs.map(t=>(
          <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"9px 4px",borderBottom:"0.5px solid var(--line)"}}>
            <div>
              <span style={{fontSize:13}}>{t.date}</span>
              {t.notes&&<span style={{fontSize:11,color:"var(--ink3)"}}> · {t.notes}</span>}
            </div>
            <span className="ft-mono" style={{fontSize:13,fontWeight:500}}>{fmt(t.amount)}</span>
          </div>
        ))}
      </div>

      <div style={{marginTop:20,padding:"12px 14px",background:"var(--surf2)",borderRadius:10,fontSize:12,color:"var(--ink3)"}}>
        Davranış verisi için fikirler: günün saatine göre harcama, maaş günleriyle ilişki, mevsimsel örüntüler, ürün başına fiyat değişimi ve aynı kategorideki benzer ürünlerle karşılaştırma.
      </div>
    </div>
  );
}

/* ── Yatırım sekmesi ── */
function InvestTab({data,addInv,delInv,editInv,renameSymbol,setCurPrice}){
  const [showForm,setShowForm]       = useState(false);
  const [kind,setKind]               = useState("buy");
  const [assetId,setAssetId]         = useState("gold");
  const [symbol,setSymbol]           = useState("");
  const [qty,setQty]                 = useState("");
  const [total,setTotal]             = useState("");
  const [date,setDate]               = useState(todayStr());
  const [editPriceKey,setEditPriceKey] = useState(null);
  const [priceInput,setPriceInput]   = useState("");
  const [confirmDel,setConfirmDel]   = useState(null);
  const [expandKey,setExpandKey]     = useState(null);
  const [editTxId,setEditTxId]       = useState(null);
  const [editTxForm,setEditTxForm]   = useState({});
  const [renameKey,setRenameKey]     = useState(null);
  const [renameInput,setRenameInput] = useState("");

  const investments=data.investments||[];
  const currentPrices=data.currentPrices||{};
  const assetInfo=id=>ASSET_TYPES.find(a=>a.id===id)||ASSET_TYPES[4];
  const curAssetInfo=assetInfo(assetId);

  const activeKeys=[...new Set(investments.map(i=>holdingKey(i.assetId,i.symbol)))];

  const summaries=activeKeys.map(key=>{
    const [aId,sym]=key.split("::");
    const h=computeHoldings(investments,key);
    const cp=Number(currentPrices[key]||0);
    const curValue=h.qty*cp;
    const unrealized=cp>0?(cp-h.avgCost)*h.qty:null;
    return {key,assetId:aId,symbol:sym,...h,currentPrice:cp,curValue,unrealized};
  }).filter(s=>s.txCount>0);

  const totalCurValue=summaries.reduce((s,x)=>s+(x.curValue||0),0);
  const totalUnrealized=summaries.reduce((s,x)=>s+(x.unrealized||0),0);

  const symbolValid=!curAssetInfo.needsSymbol||symbol.trim().length>0;

  const handleAdd=()=>{
    const q=Number(qty),t=Number(total);
    if(!q||q<=0||!t||t<=0||!symbolValid) return;
    addInv({assetId,symbol:curAssetInfo.needsSymbol?symbol.trim().toUpperCase():"",kind,quantity:q,total:t,date});
    setQty("");setTotal("");setSymbol("");setShowForm(false);
  };

  const pricePerUnit=qty&&total?Number(total)/Number(qty):0;

  const displayName=s=>{
    const info=assetInfo(s.assetId);
    return s.symbol?`${s.symbol} — ${info.name}`:info.name;
  };

  return(
    <div>
      {summaries.length===0?(
        <div style={{marginTop:24,textAlign:"center",padding:"40px 20px",background:"var(--surf)",borderRadius:14,border:"0.5px solid var(--line)"}}>
          <Coins size={28} color="var(--ink3)" style={{marginBottom:10}}/>
          <p style={{fontSize:14,color:"var(--ink2)",margin:"0 0 4px",fontWeight:500}}>Henüz yatırım yok</p>
          <p style={{fontSize:12,color:"var(--ink3)",margin:0}}>Takibe başlamak için ilk alımını kaydet.</p>
        </div>
      ):(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:20,marginBottom:16}}>
            <div style={{background:"var(--surf)",borderRadius:12,padding:"14px",border:"0.5px solid var(--line)"}}>
              <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Portföy değeri</p>
              <p className="ft-mono" style={{fontSize:16,fontWeight:600,margin:0}}>{fmt(totalCurValue)}</p>
            </div>
            <div style={{background:"var(--surf)",borderRadius:12,padding:"14px",border:"0.5px solid var(--line)"}}>
              <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Gerçekleşmemiş K/Z</p>
              <p className="ft-mono" style={{fontSize:16,fontWeight:600,margin:0,color:totalUnrealized>=0?OK:ER}}>
                {totalUnrealized>=0?"+":""}{fmt(totalUnrealized)}
              </p>
            </div>
          </div>

          {summaries.map(s=>{
            const info=assetInfo(s.assetId);
            const isExp=expandKey===s.key;
            const assetTxs=investments.filter(i=>holdingKey(i.assetId,i.symbol)===s.key).sort((a,b)=>b.date.localeCompare(a.date));
            return(
              <div key={s.key} style={{background:"var(--surf)",borderRadius:14,padding:"16px 18px",marginBottom:12,border:"0.5px solid var(--line)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <button onClick={()=>setExpandKey(isExp?null:s.key)} className="ft-btn"
                    style={{border:"none",background:"transparent",padding:0,display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
                    {isExp?<ChevronDown size={14} color="var(--ink3)"/>:<ChevronRight size={14} color="var(--ink3)"/>}
                    <span style={{fontSize:15,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayName(s)}</span>
                  </button>
                  {info.needsSymbol&&renameKey!==s.key&&(
                    <button onClick={()=>{setRenameKey(s.key);setRenameInput(s.symbol);}} className="ft-btn" title="Sembolü yeniden adlandır"
                      style={{border:"none",background:"transparent",color:"var(--ink3)",padding:"2px 4px",marginRight:4}}><Pencil size={11}/></button>
                  )}
                  <span className="ft-mono" style={{fontSize:13,color:"var(--ink2)",flexShrink:0}}>{s.qty.toLocaleString("tr-TR",{maximumFractionDigits:3})} {info.unit}</span>
                </div>

                {renameKey===s.key&&(
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,background:"var(--surf2)",borderRadius:8,padding:"8px 10px"}}>
                    <span style={{fontSize:11,color:"var(--ink2)"}}>Yeni ad:</span>
                    <input value={renameInput} onChange={e=>setRenameInput(e.target.value)}
                      style={{flex:1,border:"0.5px solid var(--line2)",borderRadius:5,padding:"3px 7px",fontSize:12,textTransform:"uppercase",background:"var(--surf)",color:"var(--ink)"}} autoFocus/>
                    <button onClick={()=>{if(renameInput.trim()){renameSymbol(s.assetId,s.symbol,renameInput.trim());}setRenameKey(null);}} className="ft-btn"
                      style={{border:"none",background:AC,color:"#fff",borderRadius:5,padding:"3px 8px",fontSize:11}}>Kaydet</button>
                    <button onClick={()=>setRenameKey(null)} className="ft-btn" style={iconBtn("3px 4px")}><X size={12}/></button>
                  </div>
                )}

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                  <div>
                    <p style={{fontSize:9,color:"var(--ink3)",margin:"0 0 3px",textTransform:"uppercase"}}>Ort. maliyet</p>
                    <p className="ft-mono" style={{fontSize:12,margin:0}}>{fmt(s.avgCost)}</p>
                  </div>
                  <div>
                    <p style={{fontSize:9,color:"var(--ink3)",margin:"0 0 3px",textTransform:"uppercase"}}>Güncel fiyat</p>
                    {editPriceKey===s.key?(
                      <div style={{display:"flex",alignItems:"center",gap:3}}>
                        <input type="number" value={priceInput} onChange={e=>setPriceInput(e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter"&&priceInput){setCurPrice(s.key,Number(priceInput));setEditPriceKey(null);}}}
                          style={{width:60,border:"0.5px solid var(--line2)",borderRadius:4,padding:"1px 4px",fontSize:11,fontFamily:"monospace",background:"var(--surf2)",color:"var(--ink)"}} autoFocus/>
                        <button onClick={()=>{if(priceInput){setCurPrice(s.key,Number(priceInput));setEditPriceKey(null);}}} className="ft-btn"
                          style={{border:"none",background:AC,color:"#fff",borderRadius:4,padding:"1px 5px",fontSize:10}}>✓</button>
                      </div>
                    ):(
                      <button onClick={()=>{setEditPriceKey(s.key);setPriceInput(String(s.currentPrice||""));}} className="ft-btn"
                        style={{border:"none",background:"transparent",padding:0,display:"flex",alignItems:"center",gap:3}}>
                        <span className="ft-mono" style={{fontSize:12,color:s.currentPrice?"var(--ink)":AC}}>{s.currentPrice?fmt(s.currentPrice):"Fiyat gir"}</span>
                        <Pencil size={9} color="var(--ink3)"/>
                      </button>
                    )}
                  </div>
                  <div>
                    <p style={{fontSize:9,color:"var(--ink3)",margin:"0 0 3px",textTransform:"uppercase"}}>Değer</p>
                    <p className="ft-mono" style={{fontSize:12,margin:0}}>{s.currentPrice?fmt(s.curValue):"—"}</p>
                  </div>
                </div>

                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,paddingTop:10,borderTop:"0.5px solid var(--line)"}}>
                  <span style={{color:"var(--ink2)"}}>Gerçekleşen: <span className="ft-mono" style={{color:s.realized>=0?OK:ER}}>{s.realized>=0?"+":""}{fmt(s.realized)}</span></span>
                  {s.unrealized!==null&&<span style={{color:"var(--ink2)"}}>Gerçekleşmemiş: <span className="ft-mono" style={{color:s.unrealized>=0?OK:ER}}>{s.unrealized>=0?"+":""}{fmt(s.unrealized)}</span></span>}
                </div>

                {isExp&&(
                  <div style={{marginTop:12,paddingTop:12,borderTop:"0.5px solid var(--line)"}}>
                    {assetTxs.map(t=>
                      editTxId===t.id?(
                        <div key={t.id} style={{background:"var(--surf2)",borderRadius:8,padding:"10px 12px",marginBottom:6}}>
                          <div style={{display:"flex",gap:8,marginBottom:8}}>
                            <input type="number" value={editTxForm.quantity} onChange={e=>setEditTxForm(f=>({...f,quantity:e.target.value}))}
                              placeholder="Adet" style={{flex:1,border:"0.5px solid var(--line2)",borderRadius:5,padding:"4px 7px",fontSize:12,fontFamily:"monospace",background:"var(--surf)",color:"var(--ink)"}}/>
                            <input type="number" value={editTxForm.total} onChange={e=>setEditTxForm(f=>({...f,total:e.target.value}))}
                              placeholder="Toplam" style={{flex:1,border:"0.5px solid var(--line2)",borderRadius:5,padding:"4px 7px",fontSize:12,fontFamily:"monospace",background:"var(--surf)",color:"var(--ink)"}}/>
                            <input type="date" value={editTxForm.date} onChange={e=>setEditTxForm(f=>({...f,date:e.target.value}))}
                              style={{border:"0.5px solid var(--line2)",borderRadius:5,padding:"4px 6px",fontSize:11,background:"var(--surf)",color:"var(--ink)"}}/>
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>setEditTxId(null)} className="ft-btn" style={{flex:1,padding:6,border:"0.5px solid var(--line2)",borderRadius:6,background:"transparent",color:"var(--ink2)",fontSize:11}}>İptal</button>
                            <button onClick={()=>{
                              const q=Number(editTxForm.quantity),tt=Number(editTxForm.total);
                              if(q>0&&tt>0){editInv(t.id,{quantity:q,total:tt,date:editTxForm.date});setEditTxId(null);}
                            }} className="ft-btn" style={{flex:1,padding:6,border:"none",borderRadius:6,background:AC,color:"#fff",fontSize:11,fontWeight:500}}>Kaydet</button>
                          </div>
                        </div>
                      ):(
                        <div key={t.id} style={{display:"flex",alignItems:"center",padding:"7px 0"}}>
                          {t.kind==="buy"?<ArrowDownRight size={13} color={OK} style={{marginRight:8,flexShrink:0}}/>:<ArrowUpRight size={13} color={ER} style={{marginRight:8,flexShrink:0}}/>}
                          <div style={{flex:1}}>
                            <p style={{margin:0,fontSize:12,fontWeight:500}}>{t.kind==="buy"?"Alındı":"Satıldı"} {Number(t.quantity).toLocaleString("tr-TR",{maximumFractionDigits:3})} {info.unit}</p>
                            <p style={{margin:"1px 0 0",fontSize:10,color:"var(--ink3)"}}>{t.date} · {fmt(Number(t.total)/Number(t.quantity))}/{info.unit}</p>
                          </div>
                          <span className="ft-mono" style={{fontSize:12,marginRight:6}}>{fmt(t.total)}</span>
                          <button onClick={()=>{setEditTxId(t.id);setEditTxForm({quantity:String(t.quantity),total:String(t.total),date:t.date});}} className="ft-btn"
                            style={iconBtn(3)}><Pencil size={12}/></button>
                          {confirmDel===t.id?(
                            <>
                              <button onClick={()=>{delInv(t.id);setConfirmDel(null);}} className="ft-btn" style={{border:"none",background:ER,color:"#fff",borderRadius:5,padding:"2px 6px",fontSize:10,marginRight:3}}>Evet</button>
                              <button onClick={()=>setConfirmDel(null)} className="ft-btn" style={{border:"none",background:"transparent",color:"var(--ink2)",fontSize:10,padding:"2px 4px"}}>Hayır</button>
                            </>
                          ):(
                            <button onClick={()=>setConfirmDel(t.id)} className="ft-btn" style={iconBtn(3)}><Trash2 size={12}/></button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      <div style={{marginTop:16}}>
        <button onClick={()=>setShowForm(v=>!v)} className="ft-btn"
          style={{width:"100%",padding:13,border:showForm?"0.5px solid var(--line2)":"none",borderRadius:9,background:showForm?"transparent":AC,color:showForm?"var(--ink2)":"#fff",fontSize:14,fontWeight:500}}>
          {showForm?"İptal":"+ Alım / satım ekle"}
        </button>

        {showForm&&(
          <div style={{background:"var(--surf)",borderRadius:14,padding:"18px 20px",marginTop:10,border:"0.5px solid var(--line)"}}>
            <div style={{display:"flex",background:"var(--surf2)",borderRadius:9,padding:3,marginBottom:16}}>
              {["buy","sell"].map(k=>(
                <button key={k} onClick={()=>setKind(k)} className="ft-btn" style={{flex:1,padding:"7px 0",border:"none",borderRadius:7,background:kind===k?"var(--surf)":"transparent",color:kind===k?(k==="buy"?OK:ER):"var(--ink3)",fontSize:13,fontWeight:kind===k?600:400}}>
                  {k==="buy"?"↓ Alım":"↑ Satım"}
                </button>
              ))}
            </div>

            <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 7px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Varlık türü</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {ASSET_TYPES.map(a=>(
                <button key={a.id} onClick={()=>{setAssetId(a.id);setSymbol("");}} className="ft-btn"
                  style={chipStyle(assetId===a.id,AC,"5px 12px",12)}>
                  {a.name}
                </button>
              ))}
            </div>

            {curAssetInfo.needsSymbol&&(
              <div style={{marginBottom:16}}>
                <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 6px",textTransform:"uppercase"}}>{curAssetInfo.symbolLabel}</p>
                <input value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder={curAssetInfo.symbolPlaceholder} className="ft-inp"
                  style={{borderBottom:`2px solid ${symbol?"var(--ink)":"var(--line2)"}`,paddingBottom:8,fontSize:15,textTransform:"uppercase"}}/>
              </div>
            )}

            <div style={{display:"flex",gap:12,marginBottom:12}}>
              <div style={{flex:1}}>
                <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 6px",textTransform:"uppercase"}}>Miktar ({curAssetInfo.unit})</p>
                <input type="number" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" className="ft-inp"
                  style={{borderBottom:`2px solid ${qty?"var(--ink)":"var(--line2)"}`,paddingBottom:8,fontSize:16}}/>
              </div>
              <div style={{flex:1}}>
                <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 6px",textTransform:"uppercase"}}>{kind==="buy"?"Ödenen toplam":"Alınan toplam"}</p>
                <div style={{display:"flex",alignItems:"center",borderBottom:`2px solid ${total?AC:"var(--line2)"}`,paddingBottom:8}}>
                  <span className="ft-mono" style={{color:AC,fontSize:16,marginRight:4}}>₺</span>
                  <input type="number" value={total} onChange={e=>setTotal(e.target.value)} placeholder="0.00" className="ft-inp ft-mono" style={{fontSize:16}}/>
                </div>
              </div>
            </div>

            {pricePerUnit>0&&(
              <p style={{fontSize:11,color:"var(--ink3)",margin:"0 0 12px"}}>≈ {curAssetInfo.unit} başına {fmt(pricePerUnit)}</p>
            )}

            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              <span style={{fontSize:12,color:"var(--ink2)"}}>Tarih:</span>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                style={{...inputStyle("3px 8px",12)}}/>
            </div>

            <button onClick={handleAdd} disabled={!qty||!total||!symbolValid} className="ft-btn"
              style={{width:"100%",padding:12,border:"none",borderRadius:9,background:(!qty||!total||!symbolValid)?"var(--surf2)":(kind==="buy"?OK:ER),color:(!qty||!total||!symbolValid)?"var(--ink3)":"#fff",fontSize:14,fontWeight:500}}>
              {kind==="buy"?"Alımı kaydet":"Satımı kaydet"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({pct,color,track,height=8,radius=6,marginBottom,transition="width 0.5s"}){
  return(
    <div style={{background:track,borderRadius:radius,height,overflow:"hidden",...(marginBottom===undefined?{}:{marginBottom})}}>
      <div style={{height,borderRadius:radius,width:`${pct}%`,background:color,transition}}/>
    </div>
  );
}

function BudgetTab({data,setMBudget,setCatBudget,addGoal,delGoal,addToGoal,monthTotal,monthTxs,dark}){
  const [mInput,setMInput]=useState(String(data.budget.monthly||""));
  const [editCat,setEditCat]=useState(null);
  const [catInput,setCatInput]=useState("");
  const allCats=[...new Set(data.transactions.filter(isExpense).map(t=>t.category||t.name))].sort();
  const remain=(data.budget.monthly||0)-monthTotal;
  const pct=data.budget.monthly?Math.min(100,(monthTotal/data.budget.monthly)*100):0;
  const over=data.budget.monthly>0&&monthTotal>data.budget.monthly;
  const near=!over&&pct>80;
  return(
    <div>
      <div style={{background:"var(--surf)",borderRadius:14,padding:"24px 20px",marginTop:24,border:"0.5px solid var(--line)"}}>
        <p style={sectionLabel("0 0 16px")}>Aylık bütçe</p>
        <div style={{display:"flex",alignItems:"center",borderBottom:`2px solid ${mInput?AC:"var(--line2)"}`,paddingBottom:10,marginBottom:data.budget.monthly>0?16:0,transition:"border-color 0.15s"}}>
          <span className="ft-mono" style={{color:AC,fontSize:24,marginRight:6,fontWeight:500}}>₺</span>
          <input type="number" value={mInput} onChange={e=>setMInput(e.target.value)} onBlur={()=>setMBudget(Number(mInput))} onKeyDown={e=>e.key==="Enter"&&setMBudget(Number(mInput))}
            placeholder="Aylık limit belirle" className="ft-inp ft-mono" style={{fontSize:24,fontWeight:500}}/>
        </div>
        {data.budget.monthly>0&&(
          <>
            <ProgressBar pct={pct} color={over?ER:near?WARN:OK} track={softLine(dark)} marginBottom={10} transition="width 0.5s,background 0.3s"/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
              <span style={{color:"var(--ink2)"}}>{fmt(monthTotal)} harcandı</span>
              <span style={{color:over?ER:OK,fontWeight:500}}>{over?`${fmt(Math.abs(remain))} bütçe aşımı`:`${fmt(remain)} kaldı`}</span>
            </div>
            {over&&<div style={{background:dark?"#2a0a0a":"#ECCFBB",border:"0.5px solid #DDAA94",borderRadius:8,padding:"9px 12px",marginTop:12,fontSize:12,color:ER}}>⚠️ Aylık bütçeni aştın.</div>}
            {near&&<div style={{background:dark?"#2a2000":"#EADBA3",border:"0.5px solid #D6BD6E",borderRadius:8,padding:"9px 12px",marginTop:12,fontSize:12,color:"#92400E"}}>⚠️ Aylık bütçenin %{Math.round(pct)}'i kullanıldı.</div>}
          </>
        )}
      </div>
      {allCats.length>0&&(
        <div style={{marginTop:24}}>
          <p style={sectionLabel("0 0 4px")}>Kategori limitleri</p>
          <p style={{fontSize:11,color:"var(--ink3)",margin:"0 0 12px"}}>Aylık limitler — yalnızca bu ayın harcamalarına göre takip edilir. Her ayın 1'inde sıfırlanır.</p>
          {allCats.map(cat=>{
            const limit=Number(data.budget.perCategory?.[cat]||0);
            const spent=sumAmount(monthTxs.filter(t=>isExpense(t)&&(t.category||t.name)===cat));
            const cp=limit?Math.min(100,(spent/limit)*100):0;
            const co=limit>0&&spent>limit; const cn=!co&&cp>80;
            return(
              <div key={cat} style={{background:"var(--surf)",borderRadius:10,padding:"14px 16px",marginBottom:10,border:"0.5px solid var(--line)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:limit>0?10:0}}>
                  <span style={{fontSize:14,fontWeight:500}}>{cat}</span>
                  {editCat===cat?(
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span className="ft-mono" style={{color:AC,fontSize:13}}>₺</span>
                      <input type="number" value={catInput} onChange={e=>setCatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setCatBudget(cat,Number(catInput));setEditCat(null);}}}
                        style={{...inputStyle("3px 6px",13,true),width:80}} autoFocus/>
                      <button onClick={()=>{setCatBudget(cat,Number(catInput));setEditCat(null);}} className="ft-btn" style={{border:"none",background:OK,color:"#fff",borderRadius:6,padding:"3px 8px",fontSize:12}}>Ayarla</button>
                      <button onClick={()=>setEditCat(null)} className="ft-btn" style={iconBtn("3px 4px")}><X size={13}/></button>
                    </div>
                  ):(
                    <button onClick={()=>{setEditCat(cat);setCatInput(String(limit||""));}} className="ft-btn" style={{border:"none",background:"transparent",fontSize:12,display:"flex",alignItems:"center",gap:4,padding:0}}>
                      {limit>0?<span className="ft-mono" style={{color:co?ER:"var(--ink2)"}}>{fmt(spent)} <span style={{color:"var(--ink3)"}}>/ {fmt(limit)}</span></span>:<span style={{color:AC}}>+ Limit belirle</span>}
                    </button>
                  )}
                </div>
                {limit>0&&(
                  <>
                    <ProgressBar pct={cp} color={co?ER:cn?WARN:OK} track={softLine(dark)} height={5} radius={4}/>
                    {co&&<p style={{fontSize:11,color:ER,margin:"5px 0 0"}}>{fmt(spent-limit)} aşıldı</p>}
                    {cn&&!co&&<p style={{fontSize:11,color:"#92400E",margin:"5px 0 0"}}>Limite yaklaşıldı — {fmt(limit-spent)} kaldı</p>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      <GoalsSection data={data} addGoal={addGoal} delGoal={delGoal} addToGoal={addToGoal}/>
    </div>
  );
}

function GoalsSection({data,addGoal,delGoal,addToGoal}){
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({name:"",target:"",deadline:"",color:GOAL_COLORS[0]});
  const [addFundsId,setAddFundsId]=useState(null);
  const [fundsAmt,setFundsAmt]=useState("");
  return(
    <div style={{marginTop:28}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <p style={sectionLabel(0)}>Tasarruf hedefleri</p>
        <button onClick={()=>setShowForm(v=>!v)} className="ft-btn" style={{fontSize:12,color:AC,border:"none",background:"transparent",display:"flex",alignItems:"center",gap:3}}>
          {showForm?<><X size={12}/> İptal</>:<><Plus size={12}/> Hedef ekle</>}
        </button>
      </div>
      {showForm&&(
        <div style={{background:"var(--surf2)",borderRadius:10,padding:16,marginBottom:14,border:"0.5px solid var(--line2)"}}>
          <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Hedef adı (ör. Acil durum fonu, Tatil)" className="ft-inp"
            style={{borderBottom:"0.5px solid var(--line2)",paddingBottom:8,marginBottom:12,fontSize:14}}/>
          <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center"}}>
            <div style={{flex:1,display:"flex",alignItems:"center",borderBottom:"0.5px solid var(--line2)",paddingBottom:8}}>
              <span className="ft-mono" style={{color:AC,marginRight:4,fontSize:14}}>₺</span>
              <input type="number" value={form.target} onChange={e=>setForm(f=>({...f,target:e.target.value}))} placeholder="Hedef tutar" className="ft-inp ft-mono" style={{fontSize:14}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:11,color:"var(--ink2)",whiteSpace:"nowrap"}}>Tarih:</span>
              <input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))}
                style={{border:"0.5px solid var(--line2)",borderRadius:6,padding:"3px 6px",fontSize:11,background:"var(--surf)",color:"var(--ink)"}}/>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <span style={{fontSize:12,color:"var(--ink2)"}}>Renk:</span>
            {GOAL_COLORS.map(c=>(
              <button key={c} onClick={()=>setForm(f=>({...f,color:c}))} className="ft-btn"
                style={{width:22,height:22,borderRadius:"50%",background:c,border:form.color===c?"2.5px solid var(--ink)":"2.5px solid transparent",padding:0}}/>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowForm(false)} className="ft-btn" style={{flex:1,padding:9,border:"0.5px solid var(--line2)",borderRadius:8,background:"transparent",color:"var(--ink2)",fontSize:13}}>İptal</button>
            <button onClick={()=>{ if(form.name.trim()&&form.target){addGoal({name:form.name.trim(),target:Number(form.target),deadline:form.deadline,color:form.color});setForm({name:"",target:"",deadline:"",color:GOAL_COLORS[0]});setShowForm(false);}}} className="ft-btn"
              style={{flex:2,padding:9,border:"none",borderRadius:8,background:AC,color:"#fff",fontSize:13,fontWeight:500}}>Hedef ekle</button>
          </div>
        </div>
      )}
      {data.goals.length===0&&!showForm&&<p style={{color:"var(--ink3)",fontSize:13}}>Henüz hedef yok. Bir tasarruf hedefi belirle ve ilerlemeni buradan takip et.</p>}
      {data.goals.map(g=>{
        const pct=Math.min(100,(g.saved/g.target)*100)||0;
        const remaining=g.target-g.saved;
        const monthsLeft=g.deadline?Math.max(1,Math.ceil((new Date(g.deadline)-new Date())/(1000*60*60*24*30))):null;
        const monthlyNeeded=monthsLeft&&remaining>0?remaining/monthsLeft:null;
        return(
          <div key={g.id} style={{background:"var(--surf)",borderRadius:12,padding:16,marginBottom:10,border:"0.5px solid var(--line)",borderLeft:`4px solid ${g.color}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <span style={{fontSize:14,fontWeight:600}}>{g.name}</span>
                {g.deadline&&<p style={{fontSize:11,color:"var(--ink2)",margin:"3px 0 0"}}>Hedef: {new Date(g.deadline+"T12:00:00").toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}{monthsLeft&&` · ${monthsLeft} ay kaldı`}</p>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {addFundsId===g.id?(
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span className="ft-mono" style={{color:g.color,fontSize:12}}>₺</span>
                    <input type="number" value={fundsAmt} onChange={e=>setFundsAmt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&fundsAmt){addToGoal(g.id,Number(fundsAmt));setAddFundsId(null);setFundsAmt("");}}}
                      style={{width:70,border:"0.5px solid var(--line2)",borderRadius:5,padding:"3px 5px",fontSize:12,fontFamily:"monospace",background:"var(--surf2)",color:"var(--ink)"}} autoFocus/>
                    <button onClick={()=>{if(fundsAmt){addToGoal(g.id,Number(fundsAmt));setAddFundsId(null);setFundsAmt("");}}} className="ft-btn" style={{border:"none",background:g.color,color:"#fff",borderRadius:5,padding:"3px 7px",fontSize:11}}>+</button>
                    <button onClick={()=>{setAddFundsId(null);setFundsAmt("");}} className="ft-btn" style={iconBtn("3px 2px")}><X size={12}/></button>
                  </div>
                ):(
                  <>
                    <button onClick={()=>setAddFundsId(g.id)} className="ft-btn" style={{fontSize:11,color:g.color,border:`0.5px solid ${g.color}`,borderRadius:6,padding:"3px 8px",background:"transparent"}}>+ Para ekle</button>
                    <button onClick={()=>delGoal(g.id)} className="ft-btn" style={iconBtn(2)}><Trash2 size={13}/></button>
                  </>
                )}
              </div>
            </div>
            <ProgressBar pct={pct} color={g.color} track="var(--line)" marginBottom={8}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
              <span style={{color:"var(--ink2)"}}>{fmt(g.saved)} biriktirildi</span>
              <span className="ft-mono" style={{color:g.color,fontWeight:500}}>{fmt(g.target)} hedefin %{Math.round(pct)}'i</span>
            </div>
            {monthlyNeeded&&remaining>0&&<p style={{fontSize:11,color:"var(--ink3)",margin:"5px 0 0"}}>Hedefe ulaşmak için ayda {fmt(monthlyNeeded)} gerekli</p>}
            {pct>=100&&<p style={{fontSize:12,color:g.color,fontWeight:600,margin:"6px 0 0"}}>🎉 Hedefe ulaşıldı!</p>}
          </div>
        );
      })}
    </div>
  );
}

function CreditTab({data,addCCCard,editCCCard,delCCCard,addCCTx,editCCTx,delCCTx,setCCCategoryBudget,dark}){
  const cards=data.credit.cards||[];
  const transactions=data.credit.transactions||[];
  const categories=data.credit.categories||CC_CATEGORIES;
  const categoryBudgets=data.credit.categoryBudgets||{};

  const [ccView,setCcView]=useState("overview");

  const VIEWS=[["overview","Genel Bakış"],["planner","Planlayıcı"],["statement","Ekstre"],["calendar","Takvim"],["charts","Grafikler"]];

  const totalDebt=cards.reduce((s,c)=>s+c.currentDebt+(c.previousDebt||0),0);
  const totalFutureInst=transactions.filter(ccIsPlannedInstallment)
    .reduce((sum,tx)=>sum+ccRemainingDebt(tx,cards.find(c=>c.id===tx.cardId)),0);
  const totalOutstanding=totalDebt+totalFutureInst;
  const totalMinPayment=cards.reduce((s,c)=>s+(ccBalance(c)*c.minimumPaymentRatio),0);

  return(
    <div>
      <div style={{display:"flex",gap:4,background:"var(--surf2)",borderRadius:9,padding:3,marginTop:20,marginBottom:20,overflowX:"auto"}}>
        {VIEWS.map(([id,label])=>(
          <button key={id} onClick={()=>setCcView(id)} className="ft-btn"
            style={{flex:"1 0 auto",padding:"7px 10px",border:"none",borderRadius:7,background:ccView===id?"var(--surf)":"transparent",color:ccView===id?BL:"var(--ink3)",fontSize:12,fontWeight:ccView===id?600:400,whiteSpace:"nowrap"}}>
            {label}
          </button>
        ))}
      </div>

      {cards.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          <div style={{background:"var(--surf)",borderRadius:12,padding:"14px",border:"0.5px solid var(--line)"}}>
            <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Toplam borç</p>
            <p className="ft-mono" style={{fontSize:16,fontWeight:600,margin:0,color:totalOutstanding>0?ER:"var(--ink)"}}>{fmt(totalOutstanding)}</p>
          </div>
          <div style={{background:"var(--surf)",borderRadius:12,padding:"14px",border:"0.5px solid var(--line)"}}>
            <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Asgari ödeme (toplam)</p>
            <p className="ft-mono" style={{fontSize:16,fontWeight:600,margin:0}}>{fmt(totalMinPayment)}</p>
          </div>
        </div>
      )}

      {ccView==="overview"&&<CCOverview cards={cards} transactions={transactions} categories={categories} dark={dark}
        addCCCard={addCCCard} editCCCard={editCCCard} delCCCard={delCCCard} addCCTx={addCCTx} editCCTx={editCCTx} delCCTx={delCCTx}/>}
      {ccView==="planner"&&<CCPlanner cards={cards} transactions={transactions}/>}
      {ccView==="statement"&&<CCStatement cards={cards} transactions={transactions}/>}
      {ccView==="calendar"&&<CCCalendar cards={cards} transactions={transactions}/>}
      {ccView==="charts"&&<CCCharts cards={cards} transactions={transactions} categories={categories} categoryBudgets={categoryBudgets} setCCCategoryBudget={setCCCategoryBudget} dark={dark}/>}
    </div>
  );
}

/* ── Krediler: Genel Bakış (kartlar + işlemler) ── */
function CCOverview({cards,transactions,categories,dark,addCCCard,editCCCard,delCCCard,addCCTx,editCCTx,delCCTx}){
  const [showCardForm,setShowCardForm]     = useState(false);
  const [cardForm,setCardForm]             = useState({cardName:"",cardNumber:"",limit:"",currentDebt:"",previousDebt:"",statementDay:"15",dueDay:"25",cardHolder:""});
  const [editCardId,setEditCardId]         = useState(null);
  const [editCardForm,setEditCardForm]     = useState({});
  const [confirmDelCard,setConfirmDelCard] = useState(null);
  const [expandCard,setExpandCard]         = useState(null);

  const [showTxForm,setShowTxForm]     = useState(false);
  const [txForm,setTxForm]             = useState({cardId:"",description:"",amount:"",category:categories[0]||"Diğer",date:todayStr(),isInstallment:false,totalInstallments:"",currentInstallmentNumber:"1",type:"expense"});
  const [editTxId,setEditTxId]         = useState(null);
  const [editTxForm,setEditTxForm]     = useState({});
  const [confirmDelTx,setConfirmDelTx] = useState(null);

  const cardHasTx=id=>transactions.some(t=>t.cardId===id);

  const cardFormValid=cardForm.cardName.trim()&&cardForm.cardNumber.length===4&&Number(cardForm.limit)>0&&cardForm.cardHolder.trim();
  const handleAddCard=()=>{
    if(!cardFormValid) return;
    const limitVal=Number(cardForm.limit);
    addCCCard({
      bankName:"",cardName:cardForm.cardName.trim(),
      cardNumber:cardForm.cardNumber.replace(/\D/g,"").slice(-4),limit:limitVal,
      currentDebt:Number(cardForm.currentDebt)||0,previousDebt:Number(cardForm.previousDebt)||0,
      statementDay:Number(cardForm.statementDay),dueDay:Number(cardForm.dueDay),
      cardHolder:cardForm.cardHolder.trim(),colorTheme:CC_THEME_KEYS[cards.length%CC_THEME_KEYS.length],
      minimumPaymentRatio:ccMinRatio(limitVal),
    });
    setCardForm({cardName:"",cardNumber:"",limit:"",currentDebt:"",previousDebt:"",statementDay:"15",dueDay:"25",cardHolder:""});
    setShowCardForm(false);
  };
  const startEditCard=c=>{
    setEditCardId(c.id);
    setEditCardForm({bankName:c.bankName,cardName:c.cardName,cardNumber:c.cardNumber,limit:String(c.limit),currentDebt:String(c.currentDebt),previousDebt:String(c.previousDebt||0),statementDay:String(c.statementDay),dueDay:String(c.dueDay),cardHolder:c.cardHolder,colorTheme:c.colorTheme});
  };
  const saveEditCard=()=>{
    const limitVal=Number(editCardForm.limit);
    if(!editCardForm.cardNumber.trim()||!limitVal||!editCardForm.cardHolder.trim()) return;
    editCCCard(editCardId,{
      bankName:editCardForm.bankName,cardName:editCardForm.cardName.trim(),cardNumber:editCardForm.cardNumber.replace(/\D/g,"").slice(-4),
      limit:limitVal,currentDebt:Number(editCardForm.currentDebt)||0,previousDebt:Number(editCardForm.previousDebt)||0,
      statementDay:Number(editCardForm.statementDay),dueDay:Number(editCardForm.dueDay),cardHolder:editCardForm.cardHolder.trim(),
      minimumPaymentRatio:ccMinRatio(limitVal),
    });
    setEditCardId(null);
  };

  const txValid=txForm.cardId&&txForm.description.trim()&&Number(txForm.amount)>0&&(!txForm.isInstallment||Number(txForm.totalInstallments)>0);
  const handleAddTx=()=>{
    if(!txValid) return;
    addCCTx({
      cardId:txForm.cardId,description:txForm.description.trim(),amount:Number(txForm.amount),category:txForm.category,
      date:txForm.date,type:txForm.type,isInstallment:txForm.type==="payment"?false:txForm.isInstallment,
      totalInstallments:txForm.isInstallment&&txForm.type!=="payment"?Number(txForm.totalInstallments):undefined,
      currentInstallmentNumber:txForm.isInstallment&&txForm.type!=="payment"?Number(txForm.currentInstallmentNumber)||1:undefined,
    });
    setTxForm(f=>({...f,description:"",amount:"",isInstallment:false,totalInstallments:"",currentInstallmentNumber:"1"}));
    setShowTxForm(false);
  };
  const startEditTx=t=>{setEditTxForm({...t,amount:String(t.amount),totalInstallments:String(t.totalInstallments||""),currentInstallmentNumber:String(t.currentInstallmentNumber||1)});setEditTxId(t.id);};
  const saveEditTx=()=>{
    const amt=Number(editTxForm.amount);
    if(!editTxForm.description.trim()||!amt||amt<=0) return;
    editCCTx(editTxId,{
      description:editTxForm.description.trim(),amount:amt,category:editTxForm.category,date:editTxForm.date,type:editTxForm.type,
      isInstallment:editTxForm.type==="payment"?false:editTxForm.isInstallment,
      totalInstallments:editTxForm.isInstallment&&editTxForm.type!=="payment"?Number(editTxForm.totalInstallments):undefined,
      currentInstallmentNumber:editTxForm.isInstallment&&editTxForm.type!=="payment"?Number(editTxForm.currentInstallmentNumber)||1:undefined,
    });
    setEditTxId(null);
  };

  return(
    <div>
      {cards.length===0&&(
        <div style={{textAlign:"center",padding:"40px 20px",background:"var(--surf)",borderRadius:14,border:"0.5px solid var(--line)",marginBottom:16}}>
          <CreditCard size={28} color="var(--ink3)" style={{marginBottom:10}}/>
          <p style={{fontSize:14,color:"var(--ink2)",margin:"0 0 4px",fontWeight:500}}>Henüz kart eklenmedi</p>
          <p style={{fontSize:12,color:"var(--ink3)",margin:0}}>Başlamak için aşağıdan bir kredi kartı ekleyin.</p>
        </div>
      )}

      {cards.map(c=>{
        const {futureInstallmentDebt,usageRatio,availableLimit,minimumPayment}=ccCardDebt(c,transactions);
        const theme=CC_THEMES[c.colorTheme]||CC_THEMES.slate;
        const isExp=expandCard===c.id;
        const isEditingCard=editCardId===c.id;
        const cardTxs=transactions.filter(t=>t.cardId===c.id).sort((a,b)=>b.date.localeCompare(a.date));
        return(
          <div key={c.id} style={{background:"var(--surf)",borderRadius:14,padding:"16px 18px",marginBottom:12,border:"0.5px solid var(--line)",borderTop:`3px solid ${theme}`}}>
            {isEditingCard?(
              <div style={{marginBottom:12}}>
                <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                  <input value={editCardForm.cardName} onChange={e=>setEditCardForm(f=>({...f,cardName:e.target.value}))} placeholder="Kart adı"
                    style={{...inputStyle("5px 8px",13),flex:1,minWidth:100}}/>
                  <input value={editCardForm.cardNumber} onChange={e=>setEditCardForm(f=>({...f,cardNumber:e.target.value.replace(/\D/g,"").slice(0,4)}))} maxLength={4} inputMode="numeric" placeholder="Son 4 hane"
                    style={{...inputStyle("5px 8px",13),width:90}}/>
                  <input value={editCardForm.cardHolder} onChange={e=>setEditCardForm(f=>({...f,cardHolder:e.target.value}))} placeholder="Kart sahibi"
                    style={{...inputStyle("5px 8px",13),flex:1,minWidth:100}}/>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                  <input type="number" value={editCardForm.limit} onChange={e=>setEditCardForm(f=>({...f,limit:e.target.value}))} placeholder="Limit"
                    style={{...inputStyle("5px 8px",13,true),flex:1,minWidth:80}}/>
                  <input type="number" value={editCardForm.currentDebt} onChange={e=>setEditCardForm(f=>({...f,currentDebt:e.target.value}))} placeholder="Dönem borcu"
                    style={{...inputStyle("5px 8px",13,true),flex:1,minWidth:80}}/>
                  <input type="number" value={editCardForm.previousDebt} onChange={e=>setEditCardForm(f=>({...f,previousDebt:e.target.value}))} placeholder="Devreden borç"
                    style={{...inputStyle("5px 8px",13,true),flex:1,minWidth:80}}/>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                  <input type="number" value={editCardForm.statementDay} onChange={e=>setEditCardForm(f=>({...f,statementDay:e.target.value}))} placeholder="Kesim günü"
                    style={{...inputStyle("5px 8px",13),width:100}}/>
                  <input type="number" value={editCardForm.dueDay} onChange={e=>setEditCardForm(f=>({...f,dueDay:e.target.value}))} placeholder="Son ödeme günü"
                    style={{...inputStyle("5px 8px",13),width:110}}/>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setEditCardId(null)} className="ft-btn" style={{flex:1,padding:7,border:"0.5px solid var(--line2)",borderRadius:7,background:"transparent",color:"var(--ink2)",fontSize:12}}>İptal</button>
                  <button onClick={saveEditCard} className="ft-btn" style={{flex:2,padding:7,border:"none",borderRadius:7,background:theme,color:"#fff",fontSize:12,fontWeight:500}}>Kaydet</button>
                </div>
              </div>
            ):(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <button onClick={()=>setExpandCard(isExp?null:c.id)} className="ft-btn"
                    style={{border:"none",background:"transparent",padding:0,display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
                    {isExp?<ChevronDown size={14} color="var(--ink3)"/>:<ChevronRight size={14} color="var(--ink3)"/>}
                    <div style={{textAlign:"left",overflow:"hidden"}}>
                      {c.bankName&&<p style={{margin:0,fontSize:10,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:"0.06em"}}>{c.bankName}</p>}
                      <p style={{margin:0,fontSize:15,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.cardName} •••• {c.cardNumber}</p>
                    </div>
                  </button>
                  <button onClick={()=>startEditCard(c)} className="ft-btn" title="Kartı düzenle"
                    style={iconBtn("2px 4px")}><Pencil size={12}/></button>
                  {confirmDelCard===c.id?(
                    <>
                      <button onClick={()=>{ if(!cardHasTx(c.id)) delCCCard(c.id); setConfirmDelCard(null); }} className="ft-btn"
                        style={{border:"none",background:ER,color:"#fff",borderRadius:5,padding:"2px 6px",fontSize:10,marginLeft:2}}>Evet</button>
                      <button onClick={()=>setConfirmDelCard(null)} className="ft-btn" style={{border:"none",background:"transparent",color:"var(--ink2)",fontSize:10,padding:"2px 4px"}}>Hayır</button>
                    </>
                  ):(
                    <button onClick={()=>setConfirmDelCard(c.id)} className="ft-btn" title="Kartı sil"
                      style={iconBtn("2px 4px")}><Trash2 size={12}/></button>
                  )}
                </div>

                {confirmDelCard===c.id&&cardHasTx(c.id)&&(
                  <div style={{background:dark?"#2a0a0a":"#ECCFBB",border:"0.5px solid #DDAA94",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:ER}}>
                    Bu karta bağlı işlemler var — önce onları silin veya taşıyın.
                  </div>
                )}

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                  <div>
                    <p style={{fontSize:9,color:"var(--ink3)",margin:"0 0 3px",textTransform:"uppercase"}}>Dönem borcu</p>
                    <p className="ft-mono" style={{fontSize:12,margin:0}}>{fmt(c.currentDebt)}</p>
                  </div>
                  <div>
                    <p style={{fontSize:9,color:"var(--ink3)",margin:"0 0 3px",textTransform:"uppercase"}}>Limit</p>
                    <p className="ft-mono" style={{fontSize:12,margin:0}}>{fmt(c.limit)}</p>
                  </div>
                  <div>
                    <p style={{fontSize:9,color:"var(--ink3)",margin:"0 0 3px",textTransform:"uppercase"}}>Kullanılabilir</p>
                    <p className="ft-mono" style={{fontSize:12,margin:0,color:availableLimit<0?ER:OK}}>{fmt(availableLimit)}</p>
                  </div>
                </div>

                <ProgressBar pct={usageRatio} color={usageRatio>80?ER:usageRatio>50?WARN:OK} track={softLine(dark)} marginBottom={8}/>

                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:10}}>
                  <span style={{color:"var(--ink2)"}}>Kullanım %{usageRatio}</span>
                  {futureInstallmentDebt>0&&<span style={{color:"var(--ink2)"}}>Gelecek taksitler: <span className="ft-mono">{fmt(futureInstallmentDebt)}</span></span>}
                </div>

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,borderTop:"0.5px solid var(--line)",fontSize:11}}>
                  <span style={{color:"var(--ink2)"}}>Kesim: gün {c.statementDay} · Son ödeme: gün {c.dueDay}</span>
                  <span style={{color:"var(--ink2)"}}>Asgari (%{Math.round(c.minimumPaymentRatio*100)}): <span className="ft-mono" style={{color:WARN,fontWeight:500}}>{fmt(minimumPayment)}</span></span>
                </div>
              </>
            )}

            {isExp&&!isEditingCard&&(
              <div style={{marginTop:12,paddingTop:12,borderTop:"0.5px solid var(--line)"}}>
                {cardTxs.length===0?<p style={{fontSize:12,color:"var(--ink3)",margin:0}}>Bu karta ait işlem yok.</p>:cardTxs.map(t=>(
                  <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"0.5px solid var(--line)"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:0,fontSize:12,fontWeight:500,color:t.type==="payment"?OK:"var(--ink)"}}>
                        {t.type==="payment"&&<span style={{marginRight:4}}>↑</span>}{t.description}
                        {t.isInstallment&&<span style={{color:"var(--ink3)"}}> · {t.totalInstallments} ay</span>}
                      </p>
                      <p style={{margin:"1px 0 0",fontSize:10,color:"var(--ink3)"}}>{t.date} · {t.category}</p>
                    </div>
                    <span className="ft-mono" style={{fontSize:12,marginRight:6,color:t.type==="payment"?OK:"var(--ink)"}}>{fmt(t.amount)}</span>
                    <button onClick={()=>startEditTx(t)} className="ft-btn" style={iconBtn(3)}><Pencil size={11}/></button>
                    {confirmDelTx===t.id?(
                      <>
                        <button onClick={()=>{delCCTx(t.id);setConfirmDelTx(null);}} className="ft-btn" style={{border:"none",background:ER,color:"#fff",borderRadius:5,padding:"2px 5px",fontSize:10}}>Evet</button>
                        <button onClick={()=>setConfirmDelTx(null)} className="ft-btn" style={{border:"none",background:"transparent",color:"var(--ink2)",fontSize:10,padding:"2px 3px"}}>Hayır</button>
                      </>
                    ):(
                      <button onClick={()=>setConfirmDelTx(t.id)} className="ft-btn" style={iconBtn(3)}><Trash2 size={11}/></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div style={{marginTop:16}}>
        <button onClick={()=>setShowCardForm(v=>!v)} className="ft-btn"
          style={{width:"100%",padding:11,border:showCardForm?"0.5px solid var(--line2)":`0.5px solid ${BL}`,borderRadius:9,background:"transparent",color:showCardForm?"var(--ink2)":BL,fontSize:13,fontWeight:500}}>
          {showCardForm?"İptal":"+ Kart ekle"}
        </button>
        {showCardForm&&(
          <div style={{background:"var(--surf)",borderRadius:14,padding:"16px 18px",marginTop:10,border:"0.5px solid var(--line)"}}>
            <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
              <input value={cardForm.cardName} onChange={e=>setCardForm(f=>({...f,cardName:e.target.value}))} placeholder="Kart adı (ör. Garanti Bonus)"
                style={{...inputStyle("6px 9px",13),flex:1,minWidth:100}}/>
              <input value={cardForm.cardNumber} onChange={e=>setCardForm(f=>({...f,cardNumber:e.target.value.replace(/\D/g,"").slice(0,4)}))} maxLength={4} inputMode="numeric" placeholder="Son 4 hane"
                style={{...inputStyle("6px 9px",13),width:100}}/>
            </div>
            <input value={cardForm.cardHolder} onChange={e=>setCardForm(f=>({...f,cardHolder:e.target.value}))} placeholder="Kart sahibi"
              style={{...inputStyle("6px 9px",13),width:"100%",marginBottom:10}}/>
            <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
              <input type="number" value={cardForm.limit} onChange={e=>setCardForm(f=>({...f,limit:e.target.value}))} placeholder="Limit ₺"
                style={{...inputStyle("6px 9px",13,true),flex:1,minWidth:80}}/>
              <input type="number" value={cardForm.currentDebt} onChange={e=>setCardForm(f=>({...f,currentDebt:e.target.value}))} placeholder="Dönem borcu ₺"
                style={{...inputStyle("6px 9px",13,true),flex:1,minWidth:80}}/>
              <input type="number" value={cardForm.previousDebt} onChange={e=>setCardForm(f=>({...f,previousDebt:e.target.value}))} placeholder="Devreden borç ₺"
                style={{...inputStyle("6px 9px",13,true),flex:1,minWidth:80}}/>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
              <label style={{fontSize:11,color:"var(--ink2)"}}>Kesim günü</label>
              <input type="number" value={cardForm.statementDay} onChange={e=>setCardForm(f=>({...f,statementDay:e.target.value}))}
                style={{...inputStyle("5px 7px",12),width:60}}/>
              <label style={{fontSize:11,color:"var(--ink2)"}}>Son ödeme günü</label>
              <input type="number" value={cardForm.dueDay} onChange={e=>setCardForm(f=>({...f,dueDay:e.target.value}))}
                style={{...inputStyle("5px 7px",12),width:60}}/>
            </div>
            {cardForm.limit&&<p style={{fontSize:11,color:"var(--ink3)",margin:"0 0 12px"}}>Asgari ödeme oranı: %{Math.round(ccMinRatio(Number(cardForm.limit))*100)} (BDDK kuralı)</p>}
            <button onClick={handleAddCard} disabled={!cardFormValid} className="ft-btn"
              style={{width:"100%",padding:11,border:"none",borderRadius:9,background:!cardFormValid?"var(--surf2)":BL,color:!cardFormValid?"var(--ink3)":"#fff",fontSize:13,fontWeight:500}}>
              Kartı kaydet
            </button>
          </div>
        )}
      </div>

      <div style={{marginTop:10}}>
        {cards.length===0?(
          <p style={{fontSize:12,color:"var(--ink3)",textAlign:"center",marginTop:8}}>İşlem eklemek için önce bir kart ekleyin.</p>
        ):(
          <>
            <button onClick={()=>{setShowTxForm(v=>!v);if(!txForm.cardId) setTxForm(f=>({...f,cardId:cards[0].id}));}} className="ft-btn"
              style={{width:"100%",padding:13,border:showTxForm?"0.5px solid var(--line2)":"none",borderRadius:9,background:showTxForm?"transparent":AC,color:showTxForm?"var(--ink2)":"#fff",fontSize:14,fontWeight:500}}>
              {showTxForm?"İptal":"+ İşlem ekle"}
            </button>
            {showTxForm&&(
              <div style={{background:"var(--surf)",borderRadius:14,padding:"18px 20px",marginTop:10,border:"0.5px solid var(--line)"}}>
                <div style={{display:"flex",background:"var(--surf2)",borderRadius:9,padding:3,marginBottom:14}}>
                  {["expense","payment"].map(tp=>(
                    <button key={tp} onClick={()=>setTxForm(f=>({...f,type:tp}))} className="ft-btn"
                      style={{flex:1,padding:"7px 0",border:"none",borderRadius:7,background:txForm.type===tp?"var(--surf)":"transparent",color:txForm.type===tp?(tp==="payment"?OK:AC):"var(--ink3)",fontSize:13,fontWeight:txForm.type===tp?600:400}}>
                      {tp==="expense"?"Harcama":"↑ Kart ödemesi"}
                    </button>
                  ))}
                </div>

                <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 7px",textTransform:"uppercase"}}>Kart</p>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                  {cards.map(c=>(
                    <button key={c.id} onClick={()=>setTxForm(f=>({...f,cardId:c.id}))} className="ft-btn"
                      style={chipStyle(txForm.cardId===c.id,AC,"5px 12px",12)}>
                      {ccLabel(c)}
                    </button>
                  ))}
                </div>

                <input value={txForm.description} onChange={e=>setTxForm(f=>({...f,description:e.target.value}))} placeholder={txForm.type==="payment"?"Ödeme açıklaması":"Ne aldınız?"} className="ft-inp"
                  style={{borderBottom:`2px solid ${txForm.description?"var(--ink)":"var(--line2)"}`,paddingBottom:8,marginBottom:16,fontSize:15}}/>

                <div style={{display:"flex",gap:12,marginBottom:14}}>
                  <div style={{flex:1}}>
                    <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 6px",textTransform:"uppercase"}}>Tutar</p>
                    <div style={{display:"flex",alignItems:"center",borderBottom:`2px solid ${txForm.amount?AC:"var(--line2)"}`,paddingBottom:8}}>
                      <span className="ft-mono" style={{color:AC,fontSize:16,marginRight:4}}>₺</span>
                      <input type="number" value={txForm.amount} onChange={e=>setTxForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" className="ft-inp ft-mono" style={{fontSize:16}}/>
                    </div>
                  </div>
                  <div style={{flex:1}}>
                    <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 6px",textTransform:"uppercase"}}>Tarih</p>
                    <input type="date" value={txForm.date} onChange={e=>setTxForm(f=>({...f,date:e.target.value}))}
                      style={{...inputStyle("6px 8px",13),width:"100%"}}/>
                  </div>
                </div>

                {txForm.type!=="payment"&&(
                  <>
                    <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 7px",textTransform:"uppercase"}}>Kategori</p>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                      {categories.map(cat=>(
                        <button key={cat} onClick={()=>setTxForm(f=>({...f,category:cat}))} className="ft-btn"
                          style={chipStyle(txForm.category===cat,AC,"4px 10px",11)}>
                          {cat}
                        </button>
                      ))}
                    </div>

                    <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,cursor:"pointer"}}>
                      <input type="checkbox" checked={txForm.isInstallment} onChange={e=>setTxForm(f=>({...f,isInstallment:e.target.checked}))}/>
                      <span style={{fontSize:13,color:"var(--ink2)"}}>Taksitli işlem</span>
                    </label>

                    {txForm.isInstallment&&(
                      <div style={{display:"flex",gap:10,marginBottom:14}}>
                        <div style={{flex:1}}>
                          <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 6px",textTransform:"uppercase"}}>Toplam taksit</p>
                          <input type="number" value={txForm.totalInstallments} onChange={e=>setTxForm(f=>({...f,totalInstallments:e.target.value}))} placeholder="ör. 12"
                            style={{...inputStyle("6px 8px",13),width:"100%"}}/>
                        </div>
                        <div style={{flex:1}}>
                          <p style={{fontSize:10,color:"var(--ink3)",margin:"0 0 6px",textTransform:"uppercase"}}>Şu anki taksit no</p>
                          <input type="number" value={txForm.currentInstallmentNumber} onChange={e=>setTxForm(f=>({...f,currentInstallmentNumber:e.target.value}))} placeholder="1"
                            style={{...inputStyle("6px 8px",13),width:"100%"}}/>
                        </div>
                      </div>
                    )}
                    {txForm.isInstallment&&txForm.amount&&txForm.totalInstallments&&(
                      <p style={{fontSize:11,color:"var(--ink3)",margin:"-6px 0 14px"}}>≈ {fmt(Number(txForm.amount)/Number(txForm.totalInstallments))}/ay</p>
                    )}
                  </>
                )}

                <button onClick={handleAddTx} disabled={!txValid} className="ft-btn"
                  style={{width:"100%",padding:12,border:"none",borderRadius:9,background:!txValid?"var(--surf2)":(txForm.type==="payment"?OK:AC),color:!txValid?"var(--ink3)":"#fff",fontSize:14,fontWeight:500}}>
                  {txForm.type==="payment"?"Ödemeyi kaydet":"İşlemi kaydet"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {editTxId&&(()=>{
        const t=editTxForm;
        return(
          <div style={{background:"var(--surf)",borderRadius:14,padding:"18px 20px",marginTop:10,border:`1px solid ${AC}`}}>
            <p style={{fontSize:12,fontWeight:600,margin:"0 0 12px"}}>İşlemi düzenle</p>
            <input value={t.description} onChange={e=>setEditTxForm(f=>({...f,description:e.target.value}))} placeholder="Açıklama" className="ft-inp"
              style={{borderBottom:"1px solid var(--line2)",paddingBottom:8,marginBottom:12,fontSize:14}}/>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <div style={{flex:1,display:"flex",alignItems:"center",borderBottom:"1px solid var(--line2)",paddingBottom:8}}>
                <span className="ft-mono" style={{color:AC,marginRight:3,fontSize:14}}>₺</span>
                <input type="number" value={t.amount} onChange={e=>setEditTxForm(f=>({...f,amount:e.target.value}))} className="ft-inp ft-mono" style={{fontSize:14}}/>
              </div>
              <input type="date" value={t.date} onChange={e=>setEditTxForm(f=>({...f,date:e.target.value}))}
                style={{...inputStyle("5px 8px",12)}}/>
            </div>
            {t.type!=="payment"&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {categories.map(cat=>(
                  <button key={cat} onClick={()=>setEditTxForm(f=>({...f,category:cat}))} className="ft-btn"
                    style={chipStyle(t.category===cat,AC,"4px 10px",11)}>{cat}</button>
                ))}
              </div>
            )}
            {t.type!=="payment"&&t.isInstallment&&(
              <div style={{display:"flex",gap:10,marginBottom:12}}>
                <input type="number" value={t.totalInstallments} onChange={e=>setEditTxForm(f=>({...f,totalInstallments:e.target.value}))} placeholder="Toplam taksit"
                  style={{...inputStyle("5px 8px",12),flex:1}}/>
                <input type="number" value={t.currentInstallmentNumber} onChange={e=>setEditTxForm(f=>({...f,currentInstallmentNumber:e.target.value}))} placeholder="Şu anki no"
                  style={{...inputStyle("5px 8px",12),flex:1}}/>
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditTxId(null)} className="ft-btn" style={{flex:1,padding:8,border:"0.5px solid var(--line2)",borderRadius:8,background:"transparent",color:"var(--ink2)",fontSize:13}}>İptal</button>
              <button onClick={saveEditTx} className="ft-btn" style={{flex:2,padding:8,border:"none",borderRadius:8,background:AC,color:"#fff",fontSize:13,fontWeight:500}}>Kaydet</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ── Krediler: Planlayıcı (12 aylık plan + borç kapatma simülatörü) ── */
function CCPlanner({cards,transactions}){
  const [planMode,setPlanMode]         = useState("monthly");
  const [payoffMethod,setPayoffMethod] = useState("avalanche");
  const [extraBudget,setExtraBudget]   = useState("");

  const timeline=ccBuildTimeline(cards,transactions,12);
  const grandTotal=timeline.reduce((s,m)=>s+m.total,0);

  const byBank={};
  timeline.forEach(m=>m.items.forEach(it=>{ byBank[it.cardName]=(byBank[it.cardName]||0)+it.amount; }));
  const bankRows=Object.entries(byBank).sort(([,a],[,b])=>b-a);

  const sim=ccPayoffSim(cards,payoffMethod,Number(extraBudget)||0);

  if(cards.length===0){
    return <p style={{fontSize:13,color:"var(--ink3)",textAlign:"center",padding:"32px 0"}}>Planlama için önce Genel Bakış'tan bir kart ekleyin.</p>;
  }

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <p style={sectionLabel(0)}>Önümüzdeki 12 ay</p>
        <div style={{display:"flex",background:"var(--surf2)",borderRadius:7,padding:2}}>
          {[["monthly","Aylık"],["bank","Bankaya göre"]].map(([id,label])=>(
            <button key={id} onClick={()=>setPlanMode(id)} className="ft-btn"
              style={{padding:"4px 10px",border:"none",borderRadius:5,background:planMode===id?"var(--surf)":"transparent",color:planMode===id?AC:"var(--ink3)",fontSize:11,fontWeight:planMode===id?600:400}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{background:"var(--surf)",borderRadius:12,padding:"12px 16px",marginBottom:16,border:"0.5px solid var(--line)",display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:12,color:"var(--ink2)"}}>12 aylık toplam taksit yükü</span>
        <span className="ft-mono" style={{fontSize:13,fontWeight:600}}>{fmt(grandTotal)}</span>
      </div>

      {planMode==="monthly"?(
        timeline.map(m=>(
          <div key={m.monthKey} style={{background:"var(--surf)",borderRadius:12,padding:"14px 16px",marginBottom:8,border:"0.5px solid var(--line)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:m.items.length>0?8:0}}>
              <span style={{fontSize:13,fontWeight:600,textTransform:"capitalize"}}>{m.label}</span>
              <span className="ft-mono" style={{fontSize:13,color:m.total>0?AC:"var(--ink3)"}}>{fmt(m.total)}</span>
            </div>
            {m.items.map((it,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:11,color:"var(--ink2)"}}>
                <span>{it.name} <span style={{color:"var(--ink3)"}}>· {it.cardName}</span></span>
                <span className="ft-mono">{fmt(it.amount)}</span>
              </div>
            ))}
            {m.items.length===0&&<p style={{fontSize:11,color:"var(--ink3)",margin:0}}>Bu ay için planlı taksit yok.</p>}
          </div>
        ))
      ):(
        bankRows.length===0?<p style={{fontSize:13,color:"var(--ink3)",textAlign:"center",padding:"24px 0"}}>Planlı taksit bulunmuyor.</p>:
        bankRows.map(([bank,total])=>(
          <div key={bank} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--surf)",borderRadius:10,padding:"12px 16px",marginBottom:8,border:"0.5px solid var(--line)"}}>
            <span style={{fontSize:13,fontWeight:500}}>{bank}</span>
            <span className="ft-mono" style={{fontSize:13,color:AC}}>{fmt(total)}</span>
          </div>
        ))
      )}

      <div style={{marginTop:28}}>
        <p style={sectionLabel("0 0 12px")}>Borç kapatma simülatörü</p>
        <div style={{background:"var(--surf)",borderRadius:14,padding:"16px 18px",border:"0.5px solid var(--line)"}}>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <button onClick={()=>setPayoffMethod("avalanche")} className="ft-btn"
              style={{flex:1,padding:"9px 0",border:`0.5px solid ${payoffMethod==="avalanche"?ER:"var(--line2)"}`,borderRadius:8,background:payoffMethod==="avalanche"?ER:"transparent",color:payoffMethod==="avalanche"?"#fff":"var(--ink2)",fontSize:12,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              <Flame size={13}/> Çığ (Avalanche)
            </button>
            <button onClick={()=>setPayoffMethod("snowball")} className="ft-btn"
              style={{flex:1,padding:"9px 0",border:`0.5px solid ${payoffMethod==="snowball"?BL:"var(--line2)"}`,borderRadius:8,background:payoffMethod==="snowball"?BL:"transparent",color:payoffMethod==="snowball"?"#fff":"var(--ink2)",fontSize:12,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              <Snowflake size={13}/> Kartopu (Snowball)
            </button>
          </div>
          <p style={{fontSize:11,color:"var(--ink3)",margin:"0 0 12px"}}>
            {payoffMethod==="avalanche"?"En yüksek kullanım oranına sahip kartı önce hedefler — faiz riskini azaltır.":"En düşük bakiyeli kartı önce hedefler — motivasyon için hızlı kazançlar sağlar."}
          </p>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <span style={{fontSize:12,color:"var(--ink2)",whiteSpace:"nowrap"}}>Aylık ekstra bütçe:</span>
            <div style={{display:"flex",alignItems:"center",borderBottom:`2px solid ${extraBudget?AC:"var(--line2)"}`,paddingBottom:6,flex:1}}>
              <span className="ft-mono" style={{color:AC,fontSize:14,marginRight:3}}>₺</span>
              <input type="number" value={extraBudget} onChange={e=>setExtraBudget(e.target.value)} placeholder="0.00" className="ft-inp ft-mono" style={{fontSize:14}}/>
            </div>
          </div>

          {sim.steps.length===0?(
            <p style={{fontSize:12,color:"var(--ink3)",margin:0}}>Aktif dönem borcu bulunmuyor.</p>
          ):(
            <>
              <p style={{fontSize:12,color:OK,fontWeight:500,margin:"0 0 12px"}}>Tahmini kapanış süresi: {sim.monthsToPayoff} ay</p>
              {sim.steps.map(s=>(
                <div key={s.monthIndex} style={{padding:"9px 0",borderTop:"0.5px solid var(--line)"}}>
                  <p style={{fontSize:11,fontWeight:600,margin:"0 0 4px",color:"var(--ink2)"}}>Ay {s.monthIndex}</p>
                  {s.actions.map((a,i)=><p key={i} style={{fontSize:11,color:"var(--ink2)",margin:"2px 0"}}>{a}</p>)}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Krediler: Ekstre ── */
function CCStatement({cards,transactions}){
  const [stMonth,setStMonth] = useState(thisMonth());
  const [search,setSearch]   = useState("");
  const [selCardId,setSelCardId] = useState("all");

  if(cards.length===0){
    return <p style={{fontSize:13,color:"var(--ink3)",textAlign:"center",padding:"32px 0"}}>Ekstre görmek için önce Genel Bakış'tan bir kart ekleyin.</p>;
  }

  const targetDateStr=`${stMonth}-01`;
  const relevantCards=selCardId==="all"?cards:cards.filter(c=>c.id===selCardId);

  const statementRows=relevantCards.map(card=>{
    const txs=transactions.filter(tx=>{
      if(tx.cardId!==card.id) return false;
      if(!tx.isInstallment){
        const diff=ccStatementDiff(tx.date,targetDateStr,card.statementDay);
        return diff===0;
      }
      const activeNo=ccBaseInstallmentNo(tx)+ccStatementDiff(tx.date,targetDateStr,card.statementDay);
      return activeNo>=1&&activeNo<=(tx.totalInstallments||1);
    }).filter(tx=>!search.trim()||tx.description.toLowerCase().includes(search.toLowerCase())||tx.category.toLowerCase().includes(search.toLowerCase()));
    const total=txs.reduce((s,tx)=>{
      if(!tx.isInstallment) return s+(tx.type==="payment"?-tx.amount:tx.amount);
      return s+(tx.amount/(tx.totalInstallments||1));
    },0);
    return {card,txs,total};
  }).filter(r=>r.txs.length>0);

  const grandTotal=statementRows.reduce((s,r)=>s+r.total,0);

  return(
    <div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <input type="month" value={stMonth} onChange={e=>setStMonth(e.target.value)}
          style={{border:"0.5px solid var(--line2)",borderRadius:7,padding:"6px 10px",fontSize:13,background:"var(--surf)",color:"var(--ink)"}}/>
        <select value={selCardId} onChange={e=>setSelCardId(e.target.value)}
          style={{border:"0.5px solid var(--line2)",borderRadius:7,padding:"6px 10px",fontSize:13,background:"var(--surf)",color:"var(--ink)"}}>
          <option value="all">Tüm kartlar</option>
          {cards.map(c=><option key={c.id} value={c.id}>{ccLabel(c)}</option>)}
        </select>
      </div>

      <div style={{display:"flex",alignItems:"center",gap:8,border:`0.5px solid ${search?AC:"var(--line2)"}`,borderRadius:9,padding:"8px 12px",marginBottom:14,background:"var(--surf)"}}>
        <Search size={14} color={search?AC:"var(--ink3)"}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Açıklama veya kategoride ara…" className="ft-inp" style={{fontSize:13}}/>
        {search&&<button onClick={()=>setSearch("")} className="ft-btn" style={iconBtn(0)}><X size={13}/></button>}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",background:"var(--surf2)",borderRadius:8,padding:"10px 14px",marginBottom:14,border:"0.5px solid var(--line)"}}>
        <span style={{fontSize:13,color:"var(--ink2)"}}>Bu ekstre dönemi toplamı</span>
        <span className="ft-mono" style={{fontSize:13,fontWeight:600,color:AC}}>{fmt(grandTotal)}</span>
      </div>

      {statementRows.length===0?(
        <p style={{fontSize:13,color:"var(--ink3)",textAlign:"center",padding:"32px 0"}}>Bu dönem için işlem bulunamadı.</p>
      ):statementRows.map(({card,txs,total})=>(
        <div key={card.id} style={{background:"var(--surf)",borderRadius:12,padding:"14px 16px",marginBottom:10,border:"0.5px solid var(--line)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:600}}>{ccLabel(card)}</span>
            <span className="ft-mono" style={{fontSize:13,color:AC}}>{fmt(total)}</span>
          </div>
          {txs.sort((a,b)=>a.date.localeCompare(b.date)).map(tx=>(
            <div key={tx.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderTop:"0.5px solid var(--line)",fontSize:12}}>
              <span style={{color:tx.type==="payment"?OK:"var(--ink)"}}>
                {tx.description}{tx.isInstallment&&<span style={{color:"var(--ink3)"}}> · taksit {ccBaseInstallmentNo(tx)+ccStatementDiff(tx.date,targetDateStr,card.statementDay)}/{tx.totalInstallments}</span>}
              </span>
              <span className="ft-mono" style={{color:tx.type==="payment"?OK:"var(--ink)"}}>{fmt(tx.isInstallment?tx.amount/(tx.totalInstallments||1):tx.amount)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Krediler: Takvim ── */
function CCCalendar({cards,transactions}){
  const [viewMonth,setViewMonth]=useState(thisMonth());
  const [selDay,setSelDay]=useState(null);
  const [year,month]=viewMonth.split("-").map(Number);
  const daysInMonth=new Date(year,month,0).getDate();
  const firstDow=new Date(year,month-1,1).getDay();

  const dayEvents={};
  cards.forEach(c=>{
    if(c.statementDay>=1&&c.statementDay<=daysInMonth){
      const key=dayKey(viewMonth,c.statementDay);
      (dayEvents[key]=dayEvents[key]||[]).push({type:"statement",label:`${ccLabel(c)} — kesim günü`});
    }
    if(c.dueDay>=1&&c.dueDay<=daysInMonth){
      const key=dayKey(viewMonth,c.dueDay);
      (dayEvents[key]=dayEvents[key]||[]).push({type:"due",label:`${ccLabel(c)} — son ödeme günü`});
    }
  });
  transactions.filter(tx=>monthOf(tx.date)===viewMonth).forEach(tx=>{
    const card=cards.find(c=>c.id===tx.cardId);
    (dayEvents[tx.date]=dayEvents[tx.date]||[]).push({type:tx.type==="payment"?"payment":"expense",label:`${tx.description} — ${fmt(tx.amount)}${card?` (${card.cardName})`:""}`});
  });

  const nav=off=>{setViewMonth(shiftMonth(viewMonth,off));setSelDay(null);};

  if(cards.length===0){
    return <p style={{fontSize:13,color:"var(--ink3)",textAlign:"center",padding:"32px 0"}}>Takvim için önce Genel Bakış'tan bir kart ekleyin.</p>;
  }

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <button onClick={()=>nav(-1)} className="ft-btn" style={{border:"none",background:"transparent",color:"var(--ink2)",padding:2,display:"flex"}}><ChevronLeft size={16}/></button>
        <span style={{fontSize:14,fontWeight:600,textTransform:"capitalize"}}>{new Date(year,month-1,1).toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}</span>
        <button onClick={()=>nav(1)} className="ft-btn" style={{border:"none",background:"transparent",color:"var(--ink2)",padding:2,display:"flex"}}><ChevronRight size={16}/></button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
        {["P","P","S","Ç","P","C","C"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,color:"var(--ink3)",fontWeight:600,padding:"3px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {Array.from({length:firstDow}).map((_,i)=><div key={`p${i}`}/>)}
        {Array.from({length:daysInMonth}).map((_,i)=>{
          const d=i+1;
          const dateStr=dayKey(viewMonth,d);
          const events=dayEvents[dateStr]||[];
          const isSel=selDay===dateStr;
          const isToday=dateStr===todayStr();
          const hasDue=events.some(e=>e.type==="due");
          const hasStatement=events.some(e=>e.type==="statement");
          const hasTx=events.some(e=>e.type==="expense"||e.type==="payment");
          return(
            <div key={d} onClick={()=>setSelDay(isSel?null:dateStr)} className="ft-hday"
              style={{height:44,background:isSel?AC:hasDue?"rgba(199,75,75,0.18)":hasStatement?"rgba(91,127,166,0.18)":"var(--surf2)",borderRadius:6,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:isToday&&!isSel?`1.5px solid ${AC}`:"1.5px solid transparent"}}>
              <span style={{fontSize:11,color:isSel?"#fff":"var(--ink)",fontWeight:isToday?700:400,lineHeight:1}}>{d}</span>
              <div style={{display:"flex",gap:2,marginTop:3}}>
                {hasDue&&<div style={{width:4,height:4,borderRadius:"50%",background:isSel?"#fff":ER}}/>}
                {hasStatement&&<div style={{width:4,height:4,borderRadius:"50%",background:isSel?"#fff":BL}}/>}
                {hasTx&&<div style={{width:4,height:4,borderRadius:"50%",background:isSel?"#fff":AC}}/>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:14,marginTop:10,fontSize:10,color:"var(--ink3)"}}>
        <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:6,height:6,borderRadius:"50%",background:ER}}/> Son ödeme</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:6,height:6,borderRadius:"50%",background:BL}}/> Kesim günü</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:6,height:6,borderRadius:"50%",background:AC}}/> İşlem</span>
      </div>

      {selDay&&(
        <div style={{marginTop:14,background:"var(--surf)",borderRadius:10,border:`0.5px solid ${AC}`,padding:"12px 14px"}}>
          <p style={{fontSize:13,fontWeight:500,margin:"0 0 8px"}}>{new Date(selDay+"T12:00:00").toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long"})}</p>
          {(dayEvents[selDay]||[]).length===0?(
            <p style={{fontSize:12,color:"var(--ink3)",margin:0}}>Bu günde bir olay yok.</p>
          ):(dayEvents[selDay]||[]).map((e,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",fontSize:12,color:e.type==="due"?ER:e.type==="statement"?BL:"var(--ink)"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:e.type==="due"?ER:e.type==="statement"?BL:AC,flexShrink:0}}/>
              {e.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Krediler: Grafikler ── */

function CCCharts({cards,transactions,categories,categoryBudgets,setCCCategoryBudget,dark}){
  const PIE_COLORS=[AC,BL,OK,ER,"#8B6FB0","#D4B44A","#4AA3A8","#8FAD4A","#C7A23B","#6B6FB0","#8890A3"];
  const [scope,setScope]=useState("alltime");
  const [editCat,setEditCat]=useState(null);
  const [catInput,setCatInput]=useState("");

  const expenseTxs=filterByScope(transactions.filter(t=>t.type!=="payment"),scope);
  const catTotals={};
  expenseTxs.forEach(t=>{ catTotals[t.category]=(catTotals[t.category]||0)+Number(t.amount); });
  const pieData=Object.entries(catTotals).filter(([,v])=>v>0).sort(([,a],[,b])=>b-a).map(([name,value])=>({name,value}));
  const grandTotal=pieData.reduce((s,p)=>s+p.value,0);

  const byMonth={};
  expenseTxs.forEach(t=>{ const m=monthOf(t.date); byMonth[m]=(byMonth[m]||0)+Number(t.amount); });
  const monthlyBars=Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).slice(-12)
    .map(([m,total])=>({month:new Date(m+"-01").toLocaleDateString("tr-TR",{month:"short",year:"2-digit"}),total:Math.round(total)}));

  if(cards.length===0){
    return <p style={{fontSize:13,color:"var(--ink3)",textAlign:"center",padding:"32px 0"}}>Grafikler için önce Genel Bakış'tan bir kart ekleyin.</p>;
  }

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <p style={sectionLabel(0)}>Kategoriye göre harcama</p>
        <select value={scope} onChange={e=>setScope(e.target.value)}
          style={{border:`0.5px solid ${AC}`,borderRadius:6,padding:"3px 8px",fontSize:11,color:AC,background:"transparent"}}>
          {SCOPE_OPTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {pieData.length===0?(
        <div style={{textAlign:"center",padding:"40px 0",color:"var(--ink3)",fontSize:14}}>Bu dönem için harcama bulunmuyor.</div>
      ):(
        <>
          <div style={{background:"var(--surf)",borderRadius:14,padding:"12px",border:"0.5px solid var(--line)",marginBottom:16}}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={v=>fmt(v)}/>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {pieData.map((p,i)=>(
            <div key={p.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 2px",borderBottom:"0.5px solid var(--line)"}}>
              <span style={{fontSize:13,display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:9,height:9,borderRadius:"50%",background:PIE_COLORS[i%PIE_COLORS.length]}}/>
                {p.name}
              </span>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:11,color:"var(--ink3)"}}>{grandTotal>0?Math.round(p.value/grandTotal*100):0}%</span>
                <span className="ft-mono" style={{fontSize:13,color:AC}}>{fmt(p.value)}</span>
              </div>
            </div>
          ))}

          {monthlyBars.length>0&&(
            <div style={{background:"var(--surf)",borderRadius:14,padding:"16px 8px 8px",border:"0.5px solid var(--line)",marginTop:20}}>
              <p style={{fontSize:11,color:"var(--ink3)",letterSpacing:"0.08em",textTransform:"uppercase",margin:"0 0 12px 8px"}}>Aylık harcama trendi</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyBars} margin={{top:0,right:12,bottom:0,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={softLine(dark)} vertical={false}/>
                  <XAxis dataKey="month" tick={{fontSize:11,fill:axisColor(dark)}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:11,fill:axisColor(dark)}} axisLine={false} tickLine={false} tickFormatter={v=>"₺"+v} width={55}/>
                  <Tooltip formatter={v=>fmt(v)}/>
                  <Bar dataKey="total" fill={AC} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      <div style={{marginTop:28}}>
        <p style={sectionLabel("0 0 12px")}>Kategori bütçeleri</p>
        {categories.map(cat=>{
          const limit=Number(categoryBudgets[cat]||0);
          const spent=catTotals[cat]||0;
          const pct=limit?Math.min(100,(spent/limit)*100):0;
          const over=limit>0&&spent>limit;
          return(
            <div key={cat} style={{background:"var(--surf)",borderRadius:10,padding:"12px 14px",marginBottom:8,border:"0.5px solid var(--line)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:limit>0?8:0}}>
                <span style={{fontSize:13,fontWeight:500}}>{cat}</span>
                {editCat===cat?(
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span className="ft-mono" style={{color:AC,fontSize:12}}>₺</span>
                    <input type="number" value={catInput} onChange={e=>setCatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setCCCategoryBudget(cat,Number(catInput));setEditCat(null);}}}
                      style={{...inputStyle("3px 6px",12,true),width:80}} autoFocus/>
                    <button onClick={()=>{setCCCategoryBudget(cat,Number(catInput));setEditCat(null);}} className="ft-btn" style={{border:"none",background:OK,color:"#fff",borderRadius:6,padding:"3px 7px",fontSize:11}}>Ayarla</button>
                  </div>
                ):(
                  <button onClick={()=>{setEditCat(cat);setCatInput(String(limit||""));}} className="ft-btn" style={{border:"none",background:"transparent",fontSize:11,padding:0}}>
                    {limit>0?<span className="ft-mono" style={{color:over?ER:"var(--ink2)"}}>{fmt(spent)} <span style={{color:"var(--ink3)"}}>/ {fmt(limit)}</span></span>:<span style={{color:AC}}>+ Limit belirle</span>}
                  </button>
                )}
              </div>
              {limit>0&&(
                <ProgressBar pct={pct} color={over?ER:pct>80?WARN:OK} track={softLine(dark)} height={5} radius={4}/>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
