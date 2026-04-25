const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'banking_crm.db');
const db = new sqlite3.Database(dbPath);
function run(sql, params = []) { return new Promise((resolve, reject) => db.run(sql, params, function(err){ err ? reject(err) : resolve(this); })); }
function get(sql, params = []) { return new Promise((resolve, reject) => db.get(sql, params, (err,row)=> err ? reject(err) : resolve(row))); }
function all(sql, params = []) { return new Promise((resolve, reject) => db.all(sql, params, (err,rows)=> err ? reject(err) : resolve(rows))); }
async function initDb(){
 await run(`CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY, name TEXT, cnic TEXT UNIQUE, segment TEXT, balance REAL, risk_rating TEXT, priority TEXT, relationship_manager TEXT, products TEXT, missed_payments INTEGER, sentiment TEXT, last_activity TEXT)`);
 await run(`CREATE TABLE IF NOT EXISTS complaints (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER, category TEXT, status TEXT, priority TEXT, sr_type TEXT, created_at TEXT, closed_at TEXT, age_days INTEGER, resolution_days INTEGER, sentiment TEXT, summary TEXT)`);
 await run(`CREATE TABLE IF NOT EXISTS chat_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, message TEXT, intent TEXT, response_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
 await run(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, memory TEXT DEFAULT '{}', updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
 const existing = await get('SELECT COUNT(*) as count FROM customers');
 if(existing.count > 0) return;
 const customers = [
  [1001,'Ali Ahmed','42101-7654301-2','Retail',6200000,'Medium','High','Sara Khan','Savings Account,Credit Card,Fixed Deposit',0,'Positive','2026-04-20'],
  [1002,'Ahmed Raza','42101-7654302-3','Retail',1800000,'High','High','Bilal Shah','Current Account,Credit Card,Personal Loan',4,'Negative','2026-03-12'],
  [1003,'Fatima Noor','42101-7654303-4','Priority',9200000,'Low','Medium','Sara Khan','Savings Account,Investment Plan,Debit Card',0,'Positive','2026-04-22'],
  [1004,'Hassan Ali','42101-7654304-5','Corporate',12500000,'Medium','High','Noman Qureshi','Business Account,Treasury,Payroll',1,'Neutral','2026-04-19'],
  [1045,'Zain Enterprises','42101-7654305-6','Corporate',18500000,'High','Critical','Noman Qureshi','Business Account,Trade Finance,Loan,POS',3,'Negative','2026-04-05'],
  [1006,'Ayesha Malik','42101-7654306-7','Retail',3300000,'Low','Medium','Hira Sami','Savings Account,Debit Card',0,'Positive','2026-04-23'],
  [1007,'Omar Siddiqui','42101-7654307-8','SME',5700000,'Medium','Medium','Bilal Shah','Business Account,Loan,POS',2,'Neutral','2026-04-18'],
  [1008,'Karachi Traders','42101-7654308-9','Corporate',7600000,'High','High','Noman Qureshi','Business Account,Treasury,POS',3,'Negative','2026-04-01'],
  [1009,'Maryam Khan','42101-7654309-1','Retail',2900000,'Low','Low','Hira Sami','Savings Account,Debit Card',0,'Positive','2026-04-21'],
  [1010,'Usman Tariq','42101-7654310-2','Priority',4800000,'Medium','High','Sara Khan','Savings Account,Credit Card,Auto Loan',1,'Neutral','2026-04-17']
 ];
 for(const c of customers) await run('INSERT INTO customers VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', c);
 const complaints = [
  [1001,'Credit Card','Open','High','Complaint','2026-04-18',null,7,null,'Negative','Credit card billing dispute is pending.'],
  [1002,'Loan Payment','Open','High','Complaint','2026-04-10',null,15,null,'Negative','Customer has missed loan payment follow-up.'],
  [1002,'Mobile App','Resolved','Medium','SR','2026-04-02','2026-04-05',3,3,'Neutral','App login issue resolved.'],
  [1004,'Payroll','Closed','High','SR','2026-04-04','2026-04-08',4,4,'Neutral','Payroll file processing SR closed.'],
  [1045,'POS Settlement','Open','Critical','Complaint','2026-04-01',null,24,null,'Negative','Merchant POS settlement delayed.'],
  [1045,'Trade Finance','Closed','High','SR','2026-04-06','2026-04-13',7,7,'Neutral','LC document review closed.'],
  [1006,'ATM','Open','Medium','Complaint','2026-04-22',null,3,null,'Neutral','ATM cash reversal requested.'],
  [1007,'Loan Payment','Open','High','Complaint','2026-04-12',null,13,null,'Negative','SME loan payment dispute.'],
  [1008,'Internet Banking','Closed','High','SR','2026-04-14','2026-04-16',2,2,'Neutral','Corporate internet banking access restored.'],
  [1010,'Credit Card','Open','High','Complaint','2026-04-20',null,5,null,'Negative','Credit card limit issue pending.']
 ];
 for(const x of complaints) await run('INSERT INTO complaints (customer_id, category, status, priority, sr_type, created_at, closed_at, age_days, resolution_days, sentiment, summary) VALUES (?,?,?,?,?,?,?,?,?,?,?)', x);
}
module.exports = { run, get, all, initDb };
