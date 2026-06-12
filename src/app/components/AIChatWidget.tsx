import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader, Bot } from 'lucide-react';
import { logUserAction } from '../firebase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const starterQuestions = [
  'How do I improve soil health for tomatoes?',
  'What\'s the best fertiliser for wet season planting?',
  'When should I harvest my Roma tomatoes?',
  'How do I prevent pest damage on pepper?',
];

const mockResponses: Record<string, string> = {
  default: 'Based on your farm profile in Kaduna State, here\'s what I recommend:\n\n**Key insight:** The current wet season (June–August) is optimal for vegetable crops with high rainfall tolerance.\n\n- Ensure proper drainage to prevent waterlogging\n- Apply nitrogen-rich fertiliser at 3–4 week intervals\n- Monitor for aphids and spider mites weekly\n\nWould you like me to generate a specific care plan?',
  tomato: 'For Roma tomatoes in Kaduna, here\'s your soil improvement guide:\n\n**pH target:** 5.5–6.8 (your soil reads 6.2 — excellent!)\n\n1. **Add compost** — 3–4 tonnes per hectare before planting\n2. **NPK fertiliser** — Apply 15:15:15 at planting, then 27:13:13 at fruiting\n3. **Mulching** — 5–7cm layer reduces moisture loss by 40%\n\nYour Field A sandy loam is ideal for tomato root development.',
  fertiliser: 'For wet season planting in your region:\n\n**Best fertilisers ranked:**\n1. **NPK 20:10:10** — Nitrogen-rich for leafy growth\n2. **Urea** — Top-dress at 6 weeks after emergence\n3. **Organic compost** — Mix 2 tonnes/ha with topsoil\n\n⚠️ Apply before rain forecast to improve absorption. With 82mm expected this month, timing is perfect.',
  harvest: 'Roma tomato harvest window for your June planting:\n\n📅 **Estimated harvest:** 85–95 days after transplanting\n🗓 **Target window:** Late August to early September 2026\n\n**Signs of readiness:**\n- Fruit turns from green → orange → red\n- Firm to the touch, slight yield when pressed\n- Skin begins to crack along shoulder\n\nHarvest in early morning to preserve freshness. Price typically peaks in September — good timing!',
  pest: 'Pepper pest management in wet season:\n\n**Top threats now:**\n1. **Aphids** — Spray neem oil (10ml/litre) every 7 days\n2. **Thrips** — Yellow sticky traps, 10 per hectare\n3. **Mites** — Increase irrigation (reduces mite activity)\n\n**Prevention:**\n- 50cm row spacing for airflow\n- Remove infected leaves immediately\n- Rotate with maize next season\n\nCurrent pest risk for your area: **Low** (good news!).',
};

const getResponse = (msg: string): string => {
  const lower = msg.toLowerCase();
  if (lower.includes('tomato') || lower.includes('soil')) return mockResponses.tomato;
  if (lower.includes('fertiliser') || lower.includes('fertilizer') || lower.includes('npk')) return mockResponses.fertiliser;
  if (lower.includes('harvest')) return mockResponses.harvest;
  if (lower.includes('pest') || lower.includes('insect') || lower.includes('aphid')) return mockResponses.pest;
  return mockResponses.default;
};

interface Props { role: 'farmer' | 'consumer'; }

export function AIChatWidget({ role }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: role === 'farmer'
        ? 'Hello Aminu! 👋 I\'m your FarmX AI assistant. I can help with crop advice, pest management, market prices, and planting tips. What would you like to know?'
        : 'Hello Chioma! 👋 I\'m your FarmX assistant. I can help you find fresh produce, track orders, and suggest seasonal foods. How can I help?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    
    // Log interaction to Firebase Firestore continuous audit trail
    logUserAction('AI_CHAT_QUERY', 'User sent a query to the FarmX AI model', { query: msg });

    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', content: getResponse(msg) }]);
      setLoading(false);
    }, 1200);
  };

  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} style={{ fontWeight: 500, color: '#27500A', marginBottom: 2 }}>{line.replace(/\*\*/g, '')}</p>;
      }
      if (line.startsWith('- ')) {
        return <p key={i} style={{ paddingLeft: 12 }}>• {line.slice(2)}</p>;
      }
      if (line.match(/^\d+\./)) {
        return <p key={i} style={{ paddingLeft: 12 }}>{line}</p>;
      }
      if (line === '') return <div key={i} style={{ height: 6 }} />;
      return <p key={i}>{line}</p>;
    });
  };

  const accentColor = role === 'farmer' ? '#27500A' : '#185FA5';

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 w-12 h-12 rounded-full flex items-center justify-center z-50 transition-all active:scale-[0.95]"
        style={{ background: accentColor, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
      >
        {open ? <X size={18} className="text-white" /> : <MessageCircle size={18} className="text-white" />}
        {!open && messages.length === 1 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: '#FAEEDA', border: '1.5px solid #fff', fontSize: 8, color: '#854F0B', fontWeight: 700 }}>AI</span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-36 right-4 lg:bottom-20 lg:right-6 z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{ width: 320, height: 420, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', boxShadow: '0 16px 40px rgba(0,0,0,0.15)' }}>
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: accentColor }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <Bot size={14} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white" style={{ fontSize: 13, fontWeight: 500 }}>FarmX AI</p>
              <p className="text-white/70" style={{ fontSize: 10 }}>Powered by Claude · Online</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={14} className="text-white/80" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ background: '#FAFAF8' }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: accentColor, fontSize: 10 }}>
                    <Bot size={12} className="text-white" />
                  </div>
                )}
                <div className="max-w-[80%] rounded-xl px-3 py-2"
                  style={{
                    background: m.role === 'user' ? accentColor : '#fff',
                    color: m.role === 'user' ? '#fff' : '#444441',
                    border: m.role === 'assistant' ? '0.5px solid rgba(0,0,0,0.1)' : 'none',
                    fontSize: 12, lineHeight: 1.6
                  }}>
                  {m.role === 'assistant' ? formatContent(m.content) : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: accentColor }}>
                  <Bot size={12} className="text-white" />
                </div>
                <div className="rounded-xl px-3 py-2.5 flex items-center gap-1.5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)' }}>
                  <Loader size={12} style={{ color: accentColor }} className="animate-spin" />
                  <span style={{ fontSize: 11, color: '#5F5E5A' }}>Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Starter questions */}
          {messages.length === 1 && role === 'farmer' && (
            <div className="px-3 py-2 flex flex-wrap gap-1.5" style={{ borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
              {starterQuestions.slice(0, 2).map(q => (
                <button key={q} onClick={() => send(q)}
                  className="rounded-full px-2.5 py-1"
                  style={{ fontSize: 10, background: '#EAF3DE', color: '#27500A', border: '0.5px solid #3B6D11' }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 p-3" style={{ borderTop: '0.5px solid rgba(0,0,0,0.1)', background: '#fff' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask about crops, weather, prices…"
              className="flex-1 px-3 rounded-lg outline-none"
              style={{ height: 34, border: '0.5px solid rgba(0,0,0,0.15)', fontSize: 12, color: '#444441', background: '#F7F6F2' }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-[0.95]"
              style={{ background: input.trim() ? accentColor : '#F1EFE8' }}
              aria-label="Send message">
              <Send size={13} style={{ color: input.trim() ? '#fff' : '#5F5E5A' }} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
