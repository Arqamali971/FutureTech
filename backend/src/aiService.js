const axios = require('axios');
const { all, get, run } = require('./db');

function normalize(s = '') { return String(s).toLowerCase().trim(); }
function money(n) { return `PKR ${Number(n || 0).toLocaleString('en-PK')}`; }
function products(row) { return row.products ? row.products.split(',').map(x => x.trim()) : []; }
function detectCNIC(text) { const m = String(text).match(/\b\d{5}-?\d{7}-?\d\b/); return m ? m[0] : null; }
function cleanCNIC(cnic) { return String(cnic || '').replace(/-/g, ''); }

function extractAmount(message) {
  const m = normalize(message).replace(/,/g, '');
  const match = /(\d+(?:\.\d+)?)\s*(million|m|lakh|k)?\s*\+/.exec(m)
    || /above\s*(\d+(?:\.\d+)?)\s*(million|m|lakh|k)?/.exec(m)
    || /greater than\s*(\d+(?:\.\d+)?)\s*(million|m|lakh|k)?/.exec(m)
    || /with\s*(\d+(?:\.\d+)?)\s*(million|m|lakh|k)?/.exec(m)
    || /balance\s*(?:of|above)?\s*(\d+(?:\.\d+)?)\s*(million|m|lakh|k)?/.exec(m);
  if (!match) return null;
  let n = Number(match[1]);
  const unit = match[2];
  if (unit === 'million' || unit === 'm') n *= 1000000;
  if (unit === 'lakh') n *= 100000;
  if (unit === 'k') n *= 1000;
  return n;
}

function extractName(message) {
  const patterns = [
    /show full profile of\s+([a-zA-Z ]+)/i,
    /show profile of\s+([a-zA-Z ]+)/i,
    /profile of\s+([a-zA-Z ]+)/i,
    /details for\s+([a-zA-Z ]+)/i,
    /complaint summary for\s+([a-zA-Z ]+)/i,
    /what should i do for\s+([a-zA-Z ]+)/i,
    /next best action for\s+([a-zA-Z ]+)/i,
    /nba for\s+([a-zA-Z ]+)/i,
    /export summary of\s+([a-zA-Z ]+)/i
  ];
  for (const p of patterns) {
    const m = message.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function detectIntent(message) {
  const m = normalize(message);
  const amount = extractAmount(message);

  if (m.includes('chart') || m.includes('graph') || m.includes('visual')) return 'overall_chart';
  if (detectCNIC(message)) return 'cnic_only';
  if (/customer id\s*\d+/i.test(message) || /\bid\s*\d+/i.test(message)) return 'customer_by_id';
  if ((m.includes('how many') || m.includes('total') || m.includes('count')) && (m.includes('customer') || m.includes('client'))) return 'customer_count';
  if (m.includes('bank statement') || m === 'statement' || m.includes('statement request')) return 'bank_statement';
  if (m.includes('credit card detail') || m.includes('credit card details') || m.includes('card detail') || m.includes('card details')) return 'card_details';
  if (m.includes('block card') || m.includes('card blocking') || m.includes('card block')) return 'card_blocking';
  if ((m.includes('high priority') || m.includes('priority customer')) && (m.includes('complaint') || m.includes('sr'))) return 'high_priority_complaints';
  if (m.includes('high value') && m.includes('complaint')) return 'high_value_complaints';
  if (m.includes('corporate') && (m.includes('5m') || m.includes('5 million') || m.includes('5000000') || m.includes('5,000,000'))) return 'corporate_5m';
  if (m.includes('missed payment') || m.includes('3+ missed')) return 'missed_payments';
  if (m.includes('high risk')) return 'high_risk';
  if (m.includes('complaint summary')) return 'complaint_summary';
  if (m.includes('top complaint') || m.includes('complaint trend') || m.includes('all complaints')) return 'complaint_trend';
  if (m.includes('next best action') || m.includes('what should i do') || m.includes('nba')) return 'nba';
  if (amount && (m.includes('customer') || m.includes('account') || m.includes('client') || m.includes('amount') || m.includes('balance'))) return 'customers_above_amount';
  if (m.includes('export summary')) return 'export_summary';
  if (m.includes('profile') || m.includes('full profile') || m.includes('details for')) return 'profile_by_name';
  return 'fallback';
}

async function getMemory(sessionId) {
  await run('INSERT OR IGNORE INTO sessions (id, memory) VALUES (?, ?)', [sessionId, '{}']);
  const row = await get('SELECT memory FROM sessions WHERE id=?', [sessionId]);
  try { return JSON.parse(row?.memory || '{}'); } catch { return {}; }
}
async function setMemory(sessionId, memory) {
  await run('INSERT OR REPLACE INTO sessions (id, memory, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [sessionId, JSON.stringify(memory || {})]);
}
async function clearPending(sessionId, memory) {
  delete memory.pendingIntent;
  delete memory.pendingText;
  delete memory.pendingCustomerIntent;
  await setMemory(sessionId, memory);
}

async function customerByName(name) { return get('SELECT * FROM customers WHERE lower(name)=lower(?)', [name]); }
async function customerById(id) { return get('SELECT * FROM customers WHERE id=?', [id]); }
async function customerByCnic(cnic) {
  const clean = cleanCNIC(cnic);
  const rows = await all('SELECT * FROM customers');
  return rows.find(r => cleanCNIC(r.cnic) === clean);
}
async function complaintsFor(id) { return all('SELECT * FROM complaints WHERE customer_id=? ORDER BY status, priority DESC, age_days DESC', [id]); }

function buildNBA(c, comps = []) {
  const actions = [];
  if (comps.some(x => x.status === 'Open')) actions.push({ priority: 'High', action: 'Follow up on open complaint and assign SLA owner.' });
  if (c.missed_payments >= 3) actions.push({ priority: 'Critical', action: 'Arrange recovery call and review credit limit immediately.' });
  if (c.balance >= 3000000 && c.risk_rating !== 'High') actions.push({ priority: 'Medium', action: 'Offer fixed deposit, treasury product, or investment plan.' });
  if (c.segment === 'Corporate') actions.push({ priority: 'Medium', action: 'Suggest payroll, treasury, loans, or merchant acquiring bundle.' });
  if (!actions.length) actions.push({ priority: 'Low', action: 'Maintain relationship through routine service check-in.' });
  return actions.slice(0, 3);
}

async function fullProfile(c) {
  const comps = await complaintsFor(c.id);
  return {
    type: 'profile',
    title: `Full Customer Profile: ${c.name}`,
    text: `${c.name} is a ${c.segment} customer with ${money(c.balance)} balance and ${c.risk_rating} risk rating.`,
    customer: {
      id: c.id,
      name: c.name,
      cnic: c.cnic,
      segment: c.segment,
      balance: money(c.balance),
      riskRating: c.risk_rating,
      priority: c.priority,
      relationshipManager: c.relationship_manager,
      missedPayments: c.missed_payments,
      sentiment: c.sentiment,
      lastActivity: c.last_activity
    },
    products: products(c),
    complaints: comps.map(x => ({ category: x.category, status: x.status, priority: x.priority, ageDays: x.age_days, resolutionDays: x.resolution_days || '-', sentiment: x.sentiment, summary: x.summary })),
    nba: buildNBA(c, comps)
  };
}

async function notFound(name) {
  const rows = await all('SELECT name FROM customers');
  const q = normalize(name).split(' ')[0];
  const suggestions = rows.filter(r => normalize(r.name).includes(q) || q.includes(normalize(r.name).split(' ')[0])).slice(0, 3).map(r => r.name);
  return { type: 'not_found', text: 'Customer not found in CRM dataset.', suggestions };
}

async function customerCount() {
  const row = await get('SELECT COUNT(*) as count FROM customers');
  const segments = await all('SELECT segment, COUNT(*) total FROM customers GROUP BY segment ORDER BY total DESC');
  return { type: 'summary_cards', title: 'Customer Count', text: `You currently have ${row.count} customers in the CRM dataset.`, cards: segments.map(x => ({ label: x.segment, value: x.total })), columns: ['Segment', 'Customers'], rows: segments.map(x => [x.segment, x.total]) };
}

async function customersAboveAmount(amount) {
  const rows = await all('SELECT * FROM customers WHERE balance >= ? ORDER BY balance DESC', [amount]);
  return { type: 'table', title: `Customers with balance above ${money(amount)}`, insight: `${rows.length} customers match this amount filter. Top balances are sorted first.`, columns: ['Name', 'Customer ID', 'Segment', 'Balance', 'Risk', 'Priority', 'Recommended Action'], rows: rows.map((r, i) => [`${i < 3 ? '⭐ ' : ''}${r.name}`, r.id, r.segment, money(r.balance), r.risk_rating, r.priority, buildNBA(r, [])[0].action]) };
}

async function highPriorityComplaints() {
  const rows = await all(`SELECT c.name,c.id,c.balance,c.segment,c.priority,cm.category,cm.status,cm.priority complaint_priority,cm.age_days,cm.summary FROM customers c JOIN complaints cm ON c.id=cm.customer_id WHERE cm.priority IN ('High','Critical') ORDER BY CASE cm.priority WHEN 'Critical' THEN 1 ELSE 2 END, cm.age_days DESC`);
  return { type: 'table', title: 'High Priority Customer Complaints and SRs', insight: `${rows.length} high priority complaints/SRs found. Critical and aging items should be handled first.`, columns: ['Customer', 'ID', 'Segment', 'Balance', 'Complaint/SR', 'Status', 'Priority', 'Age', 'Summary', 'NBA'], rows: rows.map(r => [r.name, r.id, r.segment, money(r.balance), r.category, r.status, r.complaint_priority, `${r.age_days} days`, r.summary, 'Call customer and assign SLA owner']) };
}
async function highValueComplaints() {
  const rows = await all(`SELECT c.name,c.balance,cm.category,cm.age_days,cm.priority FROM customers c JOIN complaints cm ON c.id=cm.customer_id WHERE c.balance>=5000000 AND cm.status='Open' ORDER BY c.balance DESC`);
  return { type: 'table', title: 'High-value customers with open complaints', insight: `${rows.length} customers require urgent follow-up.`, columns: ['Name', 'Balance', 'Complaint type', 'Priority', 'Age of complaint', 'NBA'], rows: rows.map(r => [r.name, money(r.balance), r.category, r.priority, `${r.age_days} days`, 'Follow up complaint and assign owner']) };
}
async function corporateAbove5M() {
  const rows = await all(`SELECT * FROM customers WHERE segment='Corporate' AND balance>5000000 ORDER BY balance DESC`);
  return { type: 'table', title: 'Corporate clients with balance above PKR 5M', insight: 'Top 3 accounts should be prioritized for treasury, loans, and investment cross-sell.', columns: ['Name', 'Balance', 'Risk', 'RM', 'Cross-sell'], rows: rows.map((r, i) => [`${i < 3 ? '⭐ ' : ''}${r.name}`, money(r.balance), r.risk_rating, r.relationship_manager, 'Treasury, business loan, investments']) };
}
async function missedPayments() {
  const rows = await all(`SELECT * FROM customers WHERE missed_payments>=3 ORDER BY missed_payments DESC`);
  return { type: 'table', title: 'Customers with 3+ missed payments this quarter', insight: 'Critical risk customers need recovery calls and credit limit review.', columns: ['Name', 'Missed Payments', 'Risk Rating', 'Alert'], rows: rows.map(r => [r.name, r.missed_payments, 'High', r.missed_payments >= 4 ? 'Critical' : 'High']) };
}
async function highRisk() {
  const rows = await all(`SELECT * FROM customers WHERE risk_rating='High' ORDER BY missed_payments DESC`);
  return { type: 'table', title: 'High Risk Customers', insight: 'Recommended actions: recovery call, credit limit review, and account monitoring.', columns: ['Name', 'Balance', 'Missed Payments', 'Reasoning Indicators', 'Recommended Action'], rows: rows.map(r => [r.name, money(r.balance), r.missed_payments, `Complaints or missed payments, inactivity: ${r.last_activity}`, 'Recovery call and monitoring']) };
}
async function complaintSummary(c) {
  const comps = await complaintsFor(c.id);
  const open = comps.filter(x => x.status === 'Open').length;
  const resolved = comps.filter(x => x.status === 'Resolved' || x.status === 'Closed').length;
  const resolvedRows = comps.filter(x => x.resolution_days);
  const avg = resolvedRows.reduce((a, b) => a + b.resolution_days, 0) / Math.max(1, resolvedRows.length);
  return { type: 'complaint_summary', title: `Complaint Summary: ${c.name}`, text: `Open: ${open}, Closed/Resolved: ${resolved}, Average resolution time: ${avg.toFixed(1)} days. Sentiment: ${c.sentiment}.`, complaints: comps.map(x => ({ category: x.category, status: x.status, priority: x.priority, ageDays: x.age_days, sentiment: x.sentiment, summary: x.summary })) };
}
async function complaintTrend() {
  const rows = await all(`SELECT category, COUNT(*) volume, AVG(age_days) avgAge FROM complaints GROUP BY category ORDER BY volume DESC`);
  return { type: 'chart', title: 'Top Complaint Categories', text: 'These categories show the highest complaint/SR concentration.', chart: { type: 'bar', xKey: 'category', yKey: 'volume', data: rows.map(r => ({ category: r.category, volume: r.volume })) }, columns: ['Category', 'Volume', 'Trend Insight'], rows: rows.map(r => [r.category, r.volume, r.avgAge > 10 ? 'Increasing aging risk' : 'Stable']) };
}
async function overallChart(message) {
  const m = normalize(message);
  if (m.includes('sr') && (m.includes('closed') || m.includes('close')) && m.includes('high')) {
    const rows = await all(`SELECT category, COUNT(*) volume FROM complaints WHERE sr_type='SR' AND status='Closed' AND priority='High' GROUP BY category ORDER BY volume DESC`);
    return { type: 'chart', title: 'Closed High Priority SRs This Month', text: 'Closed high priority service requests grouped by category.', chart: { type: 'bar', xKey: 'category', yKey: 'volume', data: rows.map(r => ({ category: r.category, volume: r.volume })) }, columns: ['Category', 'Closed SRs'], rows: rows.map(r => [r.category, r.volume]) };
  }
  if (m.includes('complaint')) return complaintTrend();
  const rows = await all(`SELECT segment, COUNT(*) volume FROM customers GROUP BY segment ORDER BY volume DESC`);
  return { type: 'chart', title: 'Customer Distribution by Segment', text: 'Overall customer distribution grouped by segment.', chart: { type: 'pie', xKey: 'segment', yKey: 'volume', data: rows.map(r => ({ segment: r.segment, volume: r.volume })) }, columns: ['Segment', 'Customers'], rows: rows.map(r => [r.segment, r.volume]) };
}
function statementResponse(c) {
  return { type: 'statement', title: `Bank Statement Summary: ${c.name}`, text: `Statement request validated for ${c.name}.`, columns: ['Date', 'Description', 'Debit', 'Credit', 'Balance'], rows: [['2026-04-01', 'Opening Balance', '-', '-', money(c.balance - 120000)], ['2026-04-08', 'Funds Transfer', money(45000), '-', money(c.balance - 165000)], ['2026-04-15', 'Salary/Business Credit', '-', money(165000), money(c.balance)]] };
}
function cardResponse(c, type = 'details') {
  if (type === 'block') return { type: 'text', text: `I found ${c.name}. Card blocking can be initiated after OTP/customer verification. Suggested action: block card, issue replacement, and log case under card services.` };
  return { type: 'table', title: `Credit Card Details: ${c.name}`, insight: 'Sensitive card details are masked. Full details require OTP/customer verification.', columns: ['Customer', 'Card Product', 'Status', 'Limit', 'Outstanding', 'Recommended Action'], rows: [[c.name, products(c).includes('Credit Card') ? 'Credit Card' : 'No credit card product found', products(c).includes('Credit Card') ? 'Active' : '-', products(c).includes('Credit Card') ? money(Math.min(Math.max(c.balance * 0.12, 250000), 1500000)) : '-', products(c).includes('Credit Card') ? money(Math.min(Math.max(c.balance * 0.03, 25000), 250000)) : '-', products(c).includes('Credit Card') ? 'Verify customer before showing full card data' : 'No card action required']] };
}
async function exportSummary(c) {
  const p = await fullProfile(c);
  p.download = `/api/export/customer/${c.id}`;
  p.copyText = `${c.name} | ${c.segment} | Balance ${money(c.balance)} | Risk ${c.risk_rating} | RM ${c.relationship_manager}`;
  return p;
}
async function externalAI(payload) {
  if (process.env.USE_EXTERNAL_AI !== 'true' || !process.env.AI_ENGINE_URL) return null;
  try { const r = await axios.post(process.env.AI_ENGINE_URL, payload, { timeout: 15000 }); return r.data; } catch { return null; }
}

async function responseForCustomerIntent(intent, c) {
  if (intent === 'bank_statement') return statementResponse(c);
  if (intent === 'card_blocking') return cardResponse(c, 'block');
  if (intent === 'card_details') return cardResponse(c, 'details');
  if (intent === 'profile_by_name' || intent === 'cnic_only') return fullProfile(c);
  if (intent === 'complaint_summary') return complaintSummary(c);
  if (intent === 'nba') return { type: 'nba', title: `Next Best Action for ${c.name}`, actions: buildNBA(c, await complaintsFor(c.id)) };
  if (intent === 'export_summary') return exportSummary(c);
  return fullProfile(c);
}

function askForCustomer(intent) {
  const map = {
    bank_statement: 'Please share the customer CNIC so I can fetch the bank statement securely.',
    card_blocking: 'Please share the customer CNIC to proceed with card blocking.',
    card_details: 'Please share the customer CNIC to fetch credit card details securely.',
    profile_by_name: 'Please share the customer CNIC, name, or Customer ID so I can fetch the full profile.',
    complaint_summary: 'Please share the customer CNIC, name, or Customer ID for complaint summary.',
    nba: 'Please share the customer CNIC, name, or Customer ID so I can suggest the next best action.',
    export_summary: 'Please share the customer CNIC, name, or Customer ID to export the summary.'
  };
  return { type: 'ask', text: map[intent] || 'Please share the customer CNIC, name, or Customer ID.' };
}

function requiresCustomerContext(intent) {
  return ['bank_statement', 'card_blocking', 'card_details', 'profile_by_name', 'complaint_summary', 'nba', 'export_summary'].includes(intent);
}

function pendingAskResponse(intent) {
  const ask = askForCustomer(intent);
  ask.requiresCNIC = true;
  ask.pendingIntent = intent;
  return ask;
}

async function answer(message, sessionId = 'default', options = {}) {
  let intent = detectIntent(message);
  const cnic = detectCNIC(message);
  const memory = await getMemory(sessionId);
  let response;

  try {
    const clientPendingIntent = options.pendingIntent && requiresCustomerContext(options.pendingIntent) ? options.pendingIntent : null;
    const savedPendingIntent = memory.pendingCustomerIntent || memory.pendingIntent || null;
    const pendingIntent = clientPendingIntent || savedPendingIntent;

    if (cnic && pendingIntent) {
      const c = await customerByCnic(cnic);
      await clearPending(sessionId, memory);
      response = c ? await responseForCustomerIntent(pendingIntent, c) : { type: 'text', text: 'Customer not found for this CNIC.' };
      await run('INSERT INTO chat_logs (session_id,message,intent,response_json) VALUES (?,?,?,?)', [sessionId, message, pendingIntent, JSON.stringify(response)]);
      return { intent: pendingIntent, response };
    }

    switch (intent) {
      case 'cnic_only': {
        const c = await customerByCnic(cnic);
        response = c ? await fullProfile(c) : { type: 'text', text: 'Customer not found in CRM dataset for this CNIC.' };
        break;
      }
      case 'customer_by_id': {
        const id = (message.match(/customer id\s*(\d+)/i) || message.match(/\bid\s*(\d+)/i))[1];
        const c = await customerById(Number(id));
        response = c ? await fullProfile(c) : { type: 'text', text: 'Customer not found in CRM dataset.' };
        break;
      }
      case 'profile_by_name': {
        const name = extractName(message);
        if (!name) { memory.pendingIntent = intent; memory.pendingCustomerIntent = intent; await setMemory(sessionId, memory); response = pendingAskResponse(intent); break; }
        const c = await customerByName(name);
        response = c ? await fullProfile(c) : await notFound(name);
        break;
      }
      case 'bank_statement':
      case 'card_blocking':
      case 'card_details': {
        if (!cnic) { memory.pendingIntent = intent; memory.pendingCustomerIntent = intent; await setMemory(sessionId, memory); response = pendingAskResponse(intent); break; }
        const c = await customerByCnic(cnic);
        response = c ? await responseForCustomerIntent(intent, c) : { type: 'text', text: 'Customer not found for this CNIC.' };
        break;
      }
      case 'customer_count': response = await customerCount(); break;
      case 'customers_above_amount': response = await customersAboveAmount(extractAmount(message) || 3000000); break;
      case 'high_priority_complaints': response = await highPriorityComplaints(); break;
      case 'high_value_complaints': response = await highValueComplaints(); break;
      case 'corporate_5m': response = await corporateAbove5M(); break;
      case 'missed_payments': response = await missedPayments(); break;
      case 'high_risk': response = await highRisk(); break;
      case 'complaint_trend': response = await complaintTrend(); break;
      case 'overall_chart': response = await overallChart(message); break;
      case 'complaint_summary': {
        const name = extractName(message);
        if (!name && !cnic) { memory.pendingIntent = intent; memory.pendingCustomerIntent = intent; await setMemory(sessionId, memory); response = pendingAskResponse(intent); break; }
        const c = cnic ? await customerByCnic(cnic) : await customerByName(name);
        response = c ? await complaintSummary(c) : await notFound(name || cnic);
        break;
      }
      case 'nba': {
        const name = extractName(message);
        if (!name && !cnic) { memory.pendingIntent = intent; memory.pendingCustomerIntent = intent; await setMemory(sessionId, memory); response = pendingAskResponse(intent); break; }
        const c = cnic ? await customerByCnic(cnic) : await customerByName(name);
        response = c ? await responseForCustomerIntent(intent, c) : await notFound(name || cnic);
        break;
      }
      case 'export_summary': {
        const name = extractName(message);
        if (!name && !cnic) { memory.pendingIntent = intent; memory.pendingCustomerIntent = intent; await setMemory(sessionId, memory); response = pendingAskResponse(intent); break; }
        const c = cnic ? await customerByCnic(cnic) : await customerByName(name);
        response = c ? await exportSummary(c) : await notFound(name || cnic);
        break;
      }
      default: {
        const ext = await externalAI({ message, sessionId, memory });
        response = ext || { type: 'text', text: 'I can help with customer counts, customers above any amount, high priority complaints, high risk customers, missed payments, profiles, bank statements, card details, card blocking, and overall charts. Ask naturally, for example: “give customers with 3 million+ amount”.' };
      }
    }
  } catch (e) {
    console.error(e);
    response = { type: 'text', text: 'I could not process this request. Please try again with a little more detail.' };
  }

  await run('INSERT INTO chat_logs (session_id,message,intent,response_json) VALUES (?,?,?,?)', [sessionId, message, intent, JSON.stringify(response)]);
  return { intent, response };
}

module.exports = { answer, money };
