const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { initDb, all } = require('./db');
const { answer } = require('./aiService');
const app = express();
app.use(cors());
app.use(express.json());
app.get('/', (req,res)=>res.json({ok:true,service:'FutureTech Banking AI Backend'}));
app.post('/api/chat', async (req,res)=>{
 try{
  const { message, sessionId='default', pendingIntent=null } = req.body;
  if(!message) return res.status(400).json({error:'message is required'});
  const result = await answer(message, sessionId, { pendingIntent });
  res.json(result);
 }catch(e){res.status(500).json({intent:'error',response:{type:'text',text:'Backend error. Please check server logs.'}})}
});
app.get('/api/logs', async (req,res)=>res.json(await all('SELECT * FROM chat_logs ORDER BY id DESC LIMIT 100')));
app.post('/api/session/reset', async (req,res)=>{
 try{
  const { sessionId='default' } = req.body || {};
  const { run } = require('./db');
  await run('INSERT OR REPLACE INTO sessions (id, memory, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [sessionId, '{}']);
  res.json({ok:true});
 }catch(e){res.status(500).json({ok:false});}
});
initDb().then(()=>{const port=process.env.PORT||5000; app.listen(port,()=>console.log(`Backend running on http://localhost:${port}`));}).catch(err=>{console.error(err);process.exit(1);});
