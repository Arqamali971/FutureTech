import React, { useMemo, useRef, useState, useEffect } from "react";
import axios from "axios";
import {
  Bot,
  Send,
  FileText,
  CreditCard,
  ShieldAlert,
  Landmark,
  CircleHelp,
  ClipboardList
} from "lucide-react";

const API_URL = "http://localhost:5000/api/chat";

const faqs = [
  {
    icon: <FileText size={15} />,
    text: "Get bank Statement",
    command: "Get my bank statement"
  },
  {
    icon: <ShieldAlert size={15} />,
    text: "Block my lost debit card",
    command: "Block Debit card"
  },
  {
    icon: <CreditCard size={15} />,
    text: "Why was my card transaction declined?",
    command: "Why was my card transaction declined?"
  },
  {
    icon: <ClipboardList size={15} />,
    text: "Check my complaint status",
    command: "give complaint-status"
  }
];

const slashCommands = [
  { command: "/statement", label: "Bank statement request or guidance" },
  { command: "/card-block", label: "Lost or stolen card blocking help" },
  { command: "/balance", label: "Account balance related query" },
  { command: "/chequebook", label: "Cheque book request status" },
  { command: "/complaint-status", label: "Check service request or complaint status" },
  { command: "/digital-banking", label: "Mobile app or internet banking issue" },
  { command: "/transaction", label: "Failed, reversed, or disputed transaction" },
  { command: "/help", label: "Show available banking commands" }
];

export default function ChatAssistant() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text:
        "Hi, I am Nexa, your banking support assistant. How can i help you ?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const bottomRef = useRef(null);

  const filteredCommands = useMemo(() => {
    if (!input.startsWith("/")) return [];
    return slashCommands.filter((item) => item.command.includes(input.toLowerCase()));
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  const sendMessage = async (customMessage) => {
    const messageToSend = customMessage || input;
    if (!messageToSend.trim() || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: messageToSend }]);
    setInput("");
    setShowCommands(false);
    setLoading(true);

    try {
      const response = await axios.post(API_URL, {
        message: messageToSend,
        context: {
          module: "banking-customer-support",
          userRole: "administrator",
          screen: "customer-ai-chat"
        }
      });

      setMessages((prev) => [...prev, { role: "assistant", text: response.data.reply }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            "Backend is not reachable. Please start backend on port 5000 and check AI_ENGINE_URL in backend/.env."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-module">
      <div className="assistant-toolbar">
        <div className="assistant-heading">
          <div className="assistant-icon">
            <Landmark size={18} />
          </div>
          <div>
            <h1>Nexa Banking Assistant</h1>

          </div>
        </div>

        <div className="quick-actions">
          <button onClick={() => sendMessage("/help")}>
            <CircleHelp size={14} /> Help
          </button>
        </div>
      </div>

      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message-row ${msg.role}`}>
            {msg.role === "assistant" && (
              <div className="message-avatar">
                <Bot size={14} />
              </div>
            )}
            <div className="message-bubble">
              {msg.text.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message-row assistant">
            <div className="message-avatar">
              <Bot size={14} />
            </div>
            <div className="message-bubble loading-bubble">Nexa is checking this for you...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-footer-area">
        <div className="faq-grid">
          {faqs.map((item, index) => (
            <button key={index} onClick={() => sendMessage(item.command)}>
              {item.icon}
              <span>{item.text}</span>
            </button>
          ))}
        </div>

        <div className="input-area">
          {showCommands && filteredCommands.length > 0 && (
            <div className="commands-menu">
              {filteredCommands.map((item) => (
                <button
                  key={item.command}
                  onClick={() => {
                    setInput(item.command);
                    setShowCommands(false);
                  }}
                >
                  <Landmark size={14} />
                  <span>
                    <b>{item.command}</b>
                    <small>{item.label}</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowCommands(e.target.value.startsWith("/"));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder='Ask banking questions... or type / for commands'
          />
          <button className="send-btn" onClick={() => sendMessage()} disabled={loading}>
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
