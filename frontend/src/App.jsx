import React, { useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Send,
  Bot,
  User,
  BarChart3,
  Search,
  MessageSquare,
  ShieldAlert,
  CreditCard,
  FileText,
  TrendingUp,
  Users,
  Sparkles,
  HelpCircle,
  ChevronRight,
  Command
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

const API_URL = 'http://localhost:5000/api/chat';

const faqGroups = [
  {
    title: 'Customer Insights',
    icon: <Users size={16} />,
    items: [
      'How many customers do we have?',
      'Give customers with 3 million+ amount',
      'Show all high risk customers',
      'Corporate clients with balance above PKR 5M'
    ]
  },
  {
    title: 'Complaints & Service Requests',
    icon: <ShieldAlert size={16} />,
    items: [
      'Give high priority customer complaints',
      'High-value customers with open complaints',
      'What are top complaint categories?',
      'Show SR closed for high priority customer this month graph'
    ]
  },
  {
    title: 'Secure Customer Actions',
    icon: <CreditCard size={16} />,
    items: [
      'Bank statement',
      'Credit card details',
      'Show full profile',
      'Card blocking request'
    ]
  }
];

const slashCommands = [
  {
    command: '/customers-3m',
    label: 'Customers above PKR 3M',
    prompt: 'Give customers with 3 million+ amount',
    icon: <Users size={15} />
  },
  {
    command: '/priority-complaints',
    label: 'High priority complaints',
    prompt: 'Give high priority customer complaints',
    icon: <ShieldAlert size={15} />
  },
  {
    command: '/complaint-chart',
    label: 'Complaint category chart',
    prompt: 'Show chart of all complaints',
    icon: <BarChart3 size={15} />
  },
  {
    command: '/sr-closed-chart',
    label: 'SR closed graph',
    prompt: 'Show SR closed for high priority customer this month graph',
    icon: <TrendingUp size={15} />
  },
  {
    command: '/statement',
    label: 'Bank statement request',
    prompt: 'Bank statement',
    icon: <FileText size={15} />
  },
  {
    command: '/card-details',
    label: 'Credit card details',
    prompt: 'Credit card details',
    icon: <CreditCard size={15} />
  },
  {
    command: '/profile',
    label: 'Customer profile',
    prompt: 'Show full profile',
    icon: <Search size={15} />
  }
];

const quickPrompts = [
  'Give customers with 3 million+ amount',
  'Give high priority customer complaints',
  'Show chart of all complaints'
];

function ChartBox({ chart }) {
  if (!chart?.data?.length) return null;

  const type = chart.type || 'bar';
  const xKey = chart.xKey || 'name';
  const yKey = chart.yKey || 'value';

  return (
    <div className="chartBox">
      <div className="chartHeader">
        <BarChart3 size={16} />
        <span>{chart.title || 'Data Visualization'}</span>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        {type === 'pie' ? (
          <PieChart>
            <Pie data={chart.data} dataKey={yKey} nameKey={xKey} outerRadius={92} label>
              {chart.data.map((_, i) => (
                <Cell key={i} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : type === 'line' ? (
          <LineChart data={chart.data} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey={yKey} strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        ) : (
          <BarChart data={chart.data} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Bar dataKey={yKey} radius={[8, 8, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function Table({ columns, rows }) {
  if (!columns || !rows) return null;

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((x, j) => <td key={j}>{x}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Response({ data }) {
  const r = data?.response || data;
  if (!r) return null;

  return (
    <div className="responseBlock">
      {r.title && <div className="rTitle">{r.title}</div>}
      {r.text && <p>{r.text}</p>}
      {r.insight && <div className="insight"><Sparkles size={15} />{r.insight}</div>}

      {r.cards && (
        <div className="cards">
          {r.cards.map((c) => (
            <div className="card" key={c.label}>
              <strong>{c.value}</strong>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      )}

      {r.customer && (
        <div className="profileGrid">
          {Object.entries(r.customer).map(([k, v]) => (
            <div key={k}>
              <label>{k}</label>
              <b>{v}</b>
            </div>
          ))}
        </div>
      )}

      {r.products && (
        <>
          <h4>Products</h4>
          <div className="chips">{r.products.map((p) => <span key={p}>{p}</span>)}</div>
        </>
      )}

      {r.nba && (
        <>
          <h4>Next Best Actions</h4>
          {r.nba.map((a, i) => (
            <div className="action" key={i}>
              <b>{a.priority}</b>
              <span>{a.action}</span>
            </div>
          ))}
        </>
      )}

      {r.actions && r.actions.map((a, i) => (
        <div className="action" key={i}>
          <b>{a.priority}</b>
          <span>{a.action}</span>
        </div>
      ))}

      {r.chart && <ChartBox chart={r.chart} />}
      <Table columns={r.columns} rows={r.rows} />

      {r.suggestions?.length > 0 && (
        <div className="insight">
          <HelpCircle size={15} />
          Similar matches: {r.suggestions.join(', ')}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      data: {
        response: {
          type: 'text',
          title: 'Welcome to Nexa Banking Assistant',
          text: 'Ask me about customers, balances, complaints, risks, statements, card details, profiles, and charts. Type / to use commands.'
        }
      }
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingIntent, setPendingIntent] = useState(null);
  const chatRef = useRef(null);

  const filteredCommands = useMemo(() => {
    if (!input.startsWith('/')) return [];
    const q = input.toLowerCase();
    return slashCommands.filter((item) => item.command.includes(q) || item.label.toLowerCase().includes(q));
  }, [input]);

  async function send(custom) {
    const text = (custom || input).trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    setTimeout(() => {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);

    try {
      const res = await axios.post(API_URL, {
        message: text,
        sessionId: 'web-session',
        pendingIntent
      });

      const response = res.data?.response;
      if (response?.requiresCNIC && response?.pendingIntent) {
        setPendingIntent(response.pendingIntent);
      } else {
        setPendingIntent(null);
      }

      setMessages((prev) => [...prev, { role: 'assistant', data: res.data }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          data: {
            response: {
              type: 'text',
              title: 'Connection issue',
              text: 'Backend is not reachable. Please start backend on port 5000.'
            }
          }
        }
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
      }, 80);
    }
  }

  async function resetChat() {
    setPendingIntent(null);
    setInput('');
    try {
      await axios.post('http://localhost:5000/api/session/reset', { sessionId: 'web-session' });
    } catch {}
    setMessages([
      {
        role: 'assistant',
        data: {
          response: {
            type: 'text',
            title: 'Welcome to Nexa Banking Assistant',
            text: 'Ask me about customers, balances, complaints, risks, statements, card details, profiles, and charts. Type / to use commands.'
          }
        }
      }
    ]);
  }

  function handleCommandSelect(item) {
    send(item.prompt);
  }

  return (
    <div className="appShell">
      <aside className="sidePanel">
        <div className="brandBlock">
          <div className="brandIcon"><BarChart3 size={24} /></div>
          <div>
            <h1>FutureTech AI</h1>
            <p>Banking CRM Assistant</p>
          </div>
        </div>

        <button className="newChat" onClick={resetChat}>
          <MessageSquare size={17} /> New Chat
        </button>

        <div className="sideScroll">
          {faqGroups.map((group) => (
            <div className="faqGroup" key={group.title}>
              <div className="groupTitle">{group.icon}{group.title}</div>
              {group.items.map((item) => (
                <button className="faqItem" onClick={() => send(item)} key={item}>
                  <span>{item}</span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <main className="chatPanel">
        <header className="chatHeader">
          <div>
            {/* <div className="eyebrow"><Sparkles size={14} /> Intent Based Assistant</div> */}
            <h2>Nexa Banking Assistant</h2>
            {/* <p>Ask natural banking CRM questions and get tables, summaries, actions, and charts.</p> */}
          </div>
          {/* <div className="statusPill">Live API</div> */}
        </header>

        <section className="quickStrip">
          {quickPrompts.map((prompt) => (
            <button key={prompt} onClick={() => send(prompt)}>{prompt}</button>
          ))}
        </section>

        <section className="chatArea" ref={chatRef}>
          {messages.map((m, i) => (
            <div className={`msg ${m.role}`} key={i}>
              <div className="avatar">{m.role === 'user' ? <User size={18} /> : <Bot size={18} />}</div>
              <div className="bubble">{m.role === 'user' ? m.text : <Response data={m.data} />}</div>
            </div>
          ))}

          {loading && (
            <div className="msg assistant">
              <div className="avatar"><Bot size={18} /></div>
              <div className="bubble loadingBubble">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
        </section>

        <footer className="composer">
          {filteredCommands.length > 0 && (
            <div className="commandMenu">
              <div className="commandMenuTitle"><Command size={14} /> Slash commands</div>
              {filteredCommands.map((item) => (
                <button key={item.command} onClick={() => handleCommandSelect(item)}>
                  <span className="commandIcon">{item.icon}</span>
                  <span>
                    <b>{item.command}</b>
                    <small>{item.label}</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="composerInner">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
              placeholder="Type your question or / for commands"
            />
            <button className="sendBtn" onClick={() => send()} disabled={loading}>
              <Send size={20} />
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
