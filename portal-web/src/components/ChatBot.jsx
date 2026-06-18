import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, Send, X, Bot, User, HelpCircle } from 'lucide-react';

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy tu asistente de Routing. ¿Sobre qué cliente o trabajador necesitas información?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const API_KEY = 'sk-847b1b3aa0c744cd8b228b4b508e0ac8';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let contextExtra = "";
      // Detección mejorada: Clientes o Workers (Operadores/Staff)
      const isSearching = input.toLowerCase().includes('cliente') || 
                         input.toLowerCase().includes('operador') || 
                         input.toLowerCase().includes('trabajador') || 
                         input.toLowerCase().includes('worker') ||
                         input.toLowerCase().includes('info') ||
                         (input.split(' ').length <= 3 && /^[A-Z]/.test(input));

      if (isSearching) {
        try {
          const queryClean = input.replace(/cliente|operador|trabajador|worker|info de|quien es/gi, '').trim();
          const searchRes = await axios.get(`http://localhost:4000/api/clientes/chatbot/info?query=${encodeURIComponent(queryClean)}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          
          if (searchRes.data.found) {
            const res = searchRes.data;
            if (res.type === 'CLIENTE') {
              const c = res.data;
              contextExtra = `[DATA CLIENTE: ${c.nombre}, DNI ${c.dni}, Estado: ${c.estado}, Deuda: ${c.deuda}, Pago: ${c.fecha_pago}, Última Ficha: ${c.ultima_ficha}]`;
            } else {
              const w = res.data;
              contextExtra = `[DATA TRABAJADOR: ${w.nombre}, Usuario: ${w.usuario}, Sede: ${w.sede}, Estado: ${w.estado}, Rutas Completadas: ${w.total_rutas}]`;
            }
          }
        } catch (e) { console.error("Error buscando en DB", e); }
      }

      const response = await axios.post('https://api.deepseek.com/chat/completions', {
        model: "deepseek-chat",
        messages: [
          { 
            role: "system", 
            content: `Eres el Asistente Operativo de 'Routing'.
            
            REGLAS:
            1. No uses etiquetas técnicas como [DATA CLIENTE].
            2. Si es un CLIENTE, informa: Nombre/DNI, Estado actual, Deuda/Pago y Última Ficha.
            3. Si es un TRABAJADOR (Operador/Staff), informa: Nombre, Usuario, Sede, Estado y Total de rutas completadas.
            4. Si mencionas el 'Sidebar' o 'Cambiar de Sede', añade SIEMPRE: "(Es el botón que está parpadeando en azul)".
            5. Si no hay datos, di que no existe en la sede actual.
            6. Sé breve (~20 palabras).` 
          },
          ...messages.slice(-6), 
          { 
            role: 'user', 
            content: contextExtra ? `Datos en DB: ${contextExtra}. Pregunta: ${input}` : input 
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const botContent = response.data.choices[0].message.content;
      
      // Si la respuesta menciona sidebar o sede, activamos el parpadeo
      if (botContent.toLowerCase().includes('sidebar') || botContent.toLowerCase().includes('sede')) {
        window.dispatchEvent(new CustomEvent('highlight-sede-selector'));
      }

      setMessages(prev => [...prev, { role: 'assistant', content: botContent }]);
    } catch (error) {
      console.error('ChatBot Error:', error);
      let errorMsg = 'Error al conectar. Intenta de nuevo.';
      if (error.response?.status === 402) errorMsg = 'Error 402: Sin saldo en DeepSeek.';
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTour = () => {
    window.dispatchEvent(new CustomEvent('start-tour'));
  };

  return (
    <>
      <style>
        {`
          .gota {
              width: 60px;
              height: 60px;
              background: linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%);
              border-radius: 50% 50% 50% 10% / 50% 50% 50% 50%;
              box-shadow: 
                  inset -3px -3px 6px rgba(255,255,255,0.5),
                  inset 3px 3px 10px rgba(0,0,0,0.1),
                  0 10px 15px rgba(0,0,0,0.1);
              transform: rotate(45deg);
              position: relative;
              cursor: pointer;
              border: none;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: transform 0.2s;
          }
          .gota:hover {
              transform: rotate(45deg) scale(1.05);
          }
          .gota:hover .gota-icon-path {
              fill: url(#ai-gradient);
          }
          .gota::before {
              content: '';
              position: absolute;
              top: 9px;
              left: 9px;
              width: 18px;
              height: 9px;
              background: rgba(255,255,255,0.8);
              border-radius: 50%;
              transform: rotate(-20deg);
          }
          .gota-content {
              transform: rotate(-45deg);
              display: flex;
              align-items: center;
              justify-content: center;
          }
        `}
      </style>
      <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 9999, fontFamily: 'Poppins, sans-serif', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
      
      <button 
        onClick={handleStartTour}
        title="Iniciar Recorrido"
        style={{
          width: '45px', height: '45px', borderRadius: '25px', 
          backgroundColor: 'var(--c-surface-2)', color: 'var(--c-primary)',
          border: '1px solid var(--c-border)', cursor: 'pointer', display: 'flex', 
          alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}
      >
        <HelpCircle size={22} />
      </button>

      <button 
        className="gota"
        onClick={() => setIsOpen(!isOpen)} 
      >
        <div className="gota-content">
          {isOpen ? <X size={26} color="#333" /> : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path className="gota-icon-path" d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="#333" style={{ transition: 'fill 0.3s' }}/>
                  <path className="gota-icon-path" d="M19 4L19.8 6.2L22 7L19.8 7.8L19 10L18.2 7.8L16 7L18.2 6.2L19 4Z" fill="#333" style={{ transition: 'fill 0.3s' }}/>
               </svg>
               <svg width="0" height="0">
                 <defs>
                   <linearGradient id="ai-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                     <stop offset="0%" stopColor="#00d2ff" />
                     <stop offset="100%" stopColor="#8a2be2" />
                   </linearGradient>
                 </defs>
               </svg>
            </div>
          )}
        </div>
      </button>

      {isOpen && (
        <div style={{ position: 'absolute', bottom: '80px', right: '0', width: '380px', height: '520px', backgroundColor: 'var(--c-surface)', borderRadius: '24px', border: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ padding: '20px', background: 'var(--c-primary)', color: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Bot size={20} />
            <div style={{ fontWeight: '800', fontSize: '14px' }}>Asistente Inteligente</div>
          </div>
          <div ref={scrollRef} style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '10px 14px', borderRadius: '16px', fontSize: '13px', backgroundColor: m.role === 'user' ? 'var(--c-primary)' : 'var(--c-surface-2)', color: m.role === 'user' ? 'white' : 'var(--c-text)' }}>
                {m.content}
              </div>
            ))}
          </div>
          <div style={{ padding: '15px', borderTop: '1px solid var(--c-border)' }}>
            <div style={{ display: 'flex', gap: '8px', background: 'var(--c-surface)', padding: '6px', borderRadius: '14px', border: '1px solid var(--c-border)' }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Ej: Info del trabajador Mario..." style={{ flex: 1, background: 'none', border: 'none', color: 'var(--c-text)', fontSize: '13px', outline: 'none' }} />
              <button onClick={handleSend} disabled={loading} style={{ background: 'var(--c-primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '8px' }}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default ChatBot;
