const KEY = 'today-kakei-v1';
const defaults = {incomeTypes:['給料','その他'],categories:['食費','交通費','日用品','娯楽','美容','衣服','学費','サブスク','その他'], incomes:[],expenses:[],plans:[],goals:{}};
let data = JSON.parse(localStorage.getItem(KEY) || 'null') || structuredClone(defaults);
data = {...structuredClone(defaults),...data,goals:data.goals||{}};
let selectedMonth = new Date().toISOString().slice(0,7), recordFilter = 'all';
const $ = s => document.querySelector(s);
const yen = n => `${n < 0 ? '−' : ''}¥${Math.abs(Math.round(n||0)).toLocaleString('ja-JP')}`;
const localDate = d => new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const today = () => localDate(new Date());
const save = () => localStorage.setItem(KEY, JSON.stringify(data));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random();
const inMonth = (item, month, key='date') => (item[key]||'').startsWith(month);
const sum = xs => xs.reduce((a,x)=>a+Number(x.amount||0),0);
const escapeHtml = text => String(text||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function monthInfo(month=selectedMonth){
  const [y,m] = month.split('-').map(Number), totalDays = new Date(y,m,0).getDate();
  const activeToday = today().startsWith(month) ? new Date().getDate() : (month < today().slice(0,7) ? totalDays : 1);
  const daysLeft = Math.max(1,totalDays-activeToday+1);
  const incomes = data.incomes.filter(x=>inMonth(x,month));
  const expenses = data.expenses.filter(x=>inMonth(x,month));
  const plans = plansForMonth(month);
  const income = sum(incomes), actual = sum(expenses), planned = sum(plans), goal = Number(data.goals[month]||0);
  // Planned payments are reserved once; actual variable spending is then deducted separately.
  const freeBeforeActual = income-planned-goal;
  const remainingFree = freeBeforeActual-actual;
  const historical = expenses.filter(x=>x.date < `${month}-${String(activeToday).padStart(2,'0')}`);
  const todayExpenses = expenses.filter(x=>x.date === `${month}-${String(activeToday).padStart(2,'0')}`);
  // The daily allocation starts from the month pool. Previous underspend/overspend becomes carryover.
  const basic = Math.floor(freeBeforeActual/totalDays);
  const carry = basic*(activeToday-1)-sum(historical);
  const todaySpent = sum(todayExpenses);
  const available = basic+carry-todaySpent;
  return {month,totalDays,activeToday,daysLeft,incomes,expenses,plans,income,actual,planned,goal,freeBeforeActual,remainingFree,basic,carry,todaySpent,available};
}
function plansForMonth(month){
  const maxDay=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
  return data.plans.flatMap(p=>{
    if(inMonth(p,month,'dueDate'))return [{...p,sourceId:p.id}];
    if(!p.repeat || p.dueDate.slice(0,7)>month)return [];
    const day=Math.min(Number(p.dueDate.slice(8,10)),maxDay);
    return [{...p,id:`${p.id}:${month}`,sourceId:p.id,dueDate:`${month}-${String(day).padStart(2,'0')}`}];
  });
}
function monthText(month){const [y,m]=month.split('-');return `${y}年${Number(m)}月`;}
function recordHtml(x,type){const label=type==='income'?(x.type||'その他'):(x.content||x.category||'支出');const detail=type==='income'?`${x.date} ・ ${x.type||'その他'}`:`${x.date} ・ ${x.category||'その他'}${x.payment ? ' ・ '+x.payment : ''}`;return `<article class="record ${type}"><div class="record-icon">${type==='income'?'↓':'↑'}</div><div class="record-main"><b>${escapeHtml(label)}</b><small>${escapeHtml(detail)}</small></div><strong class="record-amount ${type==='income'?'income':''}">${type==='income'?'+':'−'}${yen(x.amount)}</strong><button class="icon-button" data-delete="${type}" data-id="${x.id}" aria-label="削除">×</button></article>`}
function planHtml(x){return `<article class="record"><div class="record-icon">◷</div><div class="record-main"><b>${escapeHtml(x.content||'予定支出')}</b><small>${x.dueDate} ・ ${escapeHtml(x.category||'その他')}${x.repeat?' ・ 毎月':''}${x.paid?' ・ 支払済み':''}</small></div><strong class="record-amount">${yen(x.amount)}</strong><button class="icon-button" data-delete="plan" data-id="${x.sourceId||x.id}" aria-label="削除">×</button></article>`}

function render(){
  const i=monthInfo(); $('#monthLabel').textContent=monthText(selectedMonth); $('#monthInput').value=selectedMonth;
  $('#todayAvailable').textContent=yen(i.available); $('#dailyBase').textContent=yen(i.basic); $('#carryover').textContent=`${i.carry>0?'＋':i.carry<0?'−':'±'}${yen(Math.abs(i.carry))}`; $('#carryover').className=i.carry<0?'danger':'';
  $('#todaySpent').textContent=yen(i.todaySpent); $('#remainingFree').textContent=yen(i.remainingFree); $('#daysLeft').textContent=`${i.daysLeft}日`;
  $('#heroMessage').textContent=i.available>=0 ? (i.carry>=0?'無理なく使えるペースです':'使いすぎ分を調整中です') : '今日は使いすぎ。明日以降の予算で調整されます。'; $('#heroCard').classList.toggle('negative',i.available<0);
  const recent=[...i.expenses].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4); $('#recentExpenses').className=`record-list${recent.length?'':' empty'}`; $('#recentExpenses').innerHTML=recent.length?recent.map(x=>recordHtml(x,'expense')).join(''):'まだ支出はありません';
  const records=[...i.expenses.map(x=>({...x,_type:'expense'})),...i.incomes.map(x=>({...x,_type:'income'}))].filter(x=>recordFilter==='all'||x._type===recordFilter).sort((a,b)=>b.date.localeCompare(a.date)); $('#allRecords').className=`record-list${records.length?'':' empty'}`; $('#allRecords').innerHTML=records.length?records.map(x=>recordHtml(x,x._type)).join(''):'この月の記録はありません';
  $('#savingGoalDisplay').textContent=yen(i.goal); $('#planList').className=`record-list${i.plans.length?'':' empty'}`; $('#planList').innerHTML=i.plans.length?[...i.plans].sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).map(planHtml).join(''):'予定支出はありません';
  $('#totalIncome').textContent=yen(i.income); $('#totalExpense').textContent=yen(i.actual); $('#totalPlans').textContent=yen(i.planned); $('#goalAmount').textContent=yen(i.goal);
  const byCat={};i.expenses.forEach(x=>byCat[x.category||'その他']=(byCat[x.category||'その他']||0)+Number(x.amount)); const entries=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  $('#categoryChart').className=`chart${entries.length?'':' empty'}`; $('#categoryChart').innerHTML=entries.length?entries.map(([c,v])=>`<div class="chart-row"><div class="chart-label"><span>${escapeHtml(c)}</span><b>${yen(v)} (${Math.round(v/i.actual*100)}%)</b></div><div class="bar"><i style="width:${v/i.actual*100}%"></i></div></div>`).join(''):'支出を追加すると、ここに内訳が表示されます';
  $('#calculationExplanation').textContent=`収入 ${yen(i.income)} − 予定支出 ${yen(i.planned)} − 貯金目標 ${yen(i.goal)} ＝ 月の自由費 ${yen(i.freeBeforeActual)}。そこから実際の支出 ${yen(i.actual)} を引いた残りが ${yen(i.remainingFree)} です。`;
  simulate();
}
function simulate(){const value=Number($('#simulationAmount').value||0),i=monthInfo();if(!value){$('#simulationResult').textContent='金額を入れると、今後の1日予算の変化を確認できます。';return}const before=Math.floor(i.remainingFree/i.daysLeft),after=Math.floor((i.remainingFree-value)/i.daysLeft),change=before-after;$('#simulationResult').innerHTML=`購入前：<b>${yen(before)}/日</b> → 購入後：<b>${yen(after)}/日</b><br><strong class="${after<0?'danger':''}">この買い物をすると、今後の1日あたり予算が${yen(change)}下がります。</strong>`}

const field=(label,input)=>`<label class="field"><span>${label}</span>${input}</label>`;
function openForm(kind){
 const d=$('#entryDialog'), now=today(), catOpts=data.categories.map(c=>`<option>${escapeHtml(c)}</option>`).join(''), typeOpts=data.incomeTypes.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
 let title='',fields='';
 if(kind==='expense'){title='支出を追加';fields=field('金額（円）','<input name="amount" type="number" inputmode="numeric" min="1" required autofocus placeholder="例：500">')+field('カテゴリ',`<input name="category" list="categories" value="食費" required><datalist id="categories">${catOpts}</datalist>`)+field('内容','<input name="content" required placeholder="例：コンビニ">')+field('支出日',`<input name="date" type="date" value="${now}" required>`)+field('支払方法（任意）','<input name="payment" placeholder="例：現金、カード">')+field('メモ（任意）','<textarea name="memo"></textarea>')}
 if(kind==='income'){title='収入を追加';fields=field('金額（円）','<input name="amount" type="number" inputmode="numeric" min="1" required autofocus>')+field('入金日',`<input name="date" type="date" value="${now}" required>`)+field('収入の種類',`<input name="type" list="incomeTypes" value="給料" required><datalist id="incomeTypes">${typeOpts}</datalist>`)+field('メモ（任意）','<textarea name="memo"></textarea>')+field('予定収入','<label class="check"><input name="expected" type="checkbox"> 予定として登録する</label>')}
 if(kind==='plan'){title='予定支出を追加';fields=field('金額（円）','<input name="amount" type="number" inputmode="numeric" min="1" required autofocus>')+field('支出予定日',`<input name="dueDate" type="date" value="${now}" required>`)+field('内容','<input name="content" required placeholder="例：クレジットカード支払い">')+field('カテゴリ',`<input name="category" list="categories" value="その他" required><datalist id="categories">${catOpts}</datalist>`)+field('状態','<label class="check"><input name="paid" type="checkbox"> すでに支払った</label>')+field('繰り返し','<label class="check"><input name="repeat" type="checkbox"> 毎月同じ予定を登録する</label>')+field('メモ（任意）','<textarea name="memo"></textarea>')}
 if(kind==='saving'){title='貯金目標を設定';fields=field(`${monthText(selectedMonth)}に最低でも貯金したい金額（円）`,`<input name="amount" type="number" inputmode="numeric" min="0" value="${data.goals[selectedMonth]||''}" required autofocus>`)}
 $('#modalTitle').textContent=title;$('#formFields').innerHTML=fields;$('#entryForm').dataset.kind=kind;d.showModal();
}
function submitForm(e){e.preventDefault();const f=new FormData(e.currentTarget),kind=e.currentTarget.dataset.kind, obj=Object.fromEntries(f);if(kind==='saving'){data.goals[selectedMonth]=Number(obj.amount||0)}else{obj.id=uid();obj.amount=Number(obj.amount);obj.repeat=!!obj.repeat;obj.expected=!!obj.expected;obj.paid=!!obj.paid;if(obj.category&&!data.categories.includes(obj.category))data.categories.push(obj.category);if(obj.type&&!data.incomeTypes.includes(obj.type))data.incomeTypes.push(obj.type);if(kind==='expense')data.expenses.push(obj);if(kind==='income')data.incomes.push(obj);if(kind==='plan')data.plans.push(obj)}save();$('#entryDialog').close();render()}
function deleteItem(type,id){if(!confirm('この記録を削除しますか？'))return;const key=type==='income'?'incomes':type==='expense'?'expenses':'plans';data[key]=data[key].filter(x=>x.id!==id);save();render()}

document.addEventListener('click',e=>{const tab=e.target.closest('[data-tab]');if(tab){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===tab.dataset.tab));document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b===tab));window.scrollTo({top:0,behavior:'smooth'});return}const open=e.target.closest('[data-open]');if(open)openForm(open.dataset.open);if(e.target.closest('[data-close]'))e.target.closest('dialog').close();const del=e.target.closest('[data-delete]');if(del)deleteItem(del.dataset.delete,del.dataset.id);const filter=e.target.closest('[data-record-filter]');if(filter){recordFilter=filter.dataset.recordFilter;document.querySelectorAll('[data-record-filter]').forEach(b=>b.classList.toggle('selected',b===filter));render()}});
$('#entryForm').addEventListener('submit',submitForm);$('#monthPicker').addEventListener('click',()=>$('#monthDialog').showModal());$('#setMonth').addEventListener('click',e=>{e.preventDefault();if($('#monthInput').value){selectedMonth=$('#monthInput').value;$('#monthDialog').close();render()}});$('#simulationAmount').addEventListener('input',simulate);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
render();
