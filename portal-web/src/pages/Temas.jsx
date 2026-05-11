import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { Save, RefreshCw, Palette, Type, Layout, Sun, Moon, Zap, Image as ImageIcon } from 'lucide-react';

const Temas = () => {
  const { api } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    sidebar_bg: '#15191C',
    sidebar_text: '#FFFFFF',
    main_bg: '#0B0E11',
    main_text: '#FFFFFF',
    primary_color: '#00A9BC',
    font_family: 'Arial',
    logo_filter: 'none'
  });

  const presets = {
    predeterminado: {
      sidebar_bg: '#15191C',
      sidebar_text: '#FFFFFF',
      main_bg: '#0B0E11',
      main_text: '#FFFFFF',
      primary_color: '#00A9BC',
      font_family: 'Arial',
      logo_filter: 'none'
    },
    oscuro: {
      sidebar_bg: '#000000',
      sidebar_text: '#FFFFFF',
      main_bg: '#050505',
      main_text: '#EEEEEE',
      primary_color: '#FFFFFF',
      font_family: 'Arial',
      logo_filter: 'none'
    },
    claro: {
      sidebar_bg: '#F9F9F7',
      sidebar_text: '#222222',
      main_bg: '#FFFFFF',
      main_text: '#111111',
      primary_color: '#2D3436',
      font_family: 'Arial',
      logo_filter: 'invert(1) brightness(0.2)'
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/config');
      if (Object.keys(res.data).length > 0) {
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (key) => {
    const preset = presets[key];
    setSettings(preset);
    applyStyles(preset);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.post('/api/config', settings);
      applyStyles(settings);
      alert('Configuración guardada correctamente.');
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const applyStyles = (s) => {
    const root = document.documentElement;
    root.style.setProperty('--c-surface', s.sidebar_bg);
    root.style.setProperty('--c-bg', s.main_bg);
    root.style.setProperty('--c-text', s.main_text);
    root.style.setProperty('--c-sidebar-text', s.sidebar_text);
    root.style.setProperty('--c-primary', s.primary_color);
    root.style.setProperty('--logo-filter', s.logo_filter || 'none');
    root.style.setProperty('--font-main', s.font_family);
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner"></div></div>;

  return (
    <div className="page-fade-in">
      <div className="dashboard-hero">
        <div className="hero-left">
          <h1>Personalización del Portal</h1>
          <p className="muted">Selecciona un tema predefinido o ajusta los colores manualmente.</p>
        </div>
        <div className="hero-right">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* PRESETS */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} color="var(--c-primary)" />
          Temas Rápidos
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <button className="btn btn-ghost" style={{ justifyContent: 'center', height: '60px' }} onClick={() => applyPreset('predeterminado')}>
            <RefreshCw size={18} style={{ marginRight: '10px' }} />
            Predeterminado
          </button>
          <button className="btn btn-ghost" style={{ justifyContent: 'center', height: '60px' }} onClick={() => applyPreset('oscuro')}>
            <Moon size={18} style={{ marginRight: '10px' }} />
            Modo Oscuro
          </button>
          <button className="btn btn-ghost" style={{ justifyContent: 'center', height: '60px' }} onClick={() => applyPreset('claro')}>
            <Sun size={18} style={{ marginRight: '10px' }} />
            Modo Claro
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        {/* SIDEBAR CONFIG */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Layout size={20} color="var(--c-primary)" />
            <h3 style={{ margin: 0 }}>Barra Lateral (Sidebar)</h3>
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Color de Fondo</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                type="color" 
                value={settings.sidebar_bg} 
                onChange={e => setSettings({...settings, sidebar_bg: e.target.value})}
                style={{ width: '50px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              />
              <input 
                type="text" 
                className="form-input" 
                value={settings.sidebar_bg}
                onChange={e => setSettings({...settings, sidebar_bg: e.target.value})}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Color de Texto</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                type="color" 
                value={settings.sidebar_text} 
                onChange={e => setSettings({...settings, sidebar_text: e.target.value})}
                style={{ width: '50px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              />
              <input 
                type="text" 
                className="form-input" 
                value={settings.sidebar_text}
                onChange={e => setSettings({...settings, sidebar_text: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* MAIN AREA CONFIG */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Palette size={20} color="var(--c-primary)" />
            <h3 style={{ margin: 0 }}>Fondo Principal</h3>
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Color de Fondo General</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                type="color" 
                value={settings.main_bg} 
                onChange={e => setSettings({...settings, main_bg: e.target.value})}
                style={{ width: '50px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              />
              <input 
                type="text" 
                className="form-input" 
                value={settings.main_bg}
                onChange={e => setSettings({...settings, main_bg: e.target.value})}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Color de Texto General</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                type="color" 
                value={settings.main_text} 
                onChange={e => setSettings({...settings, main_text: e.target.value})}
                style={{ width: '50px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              />
              <input 
                type="text" 
                className="form-input" 
                value={settings.main_text}
                onChange={e => setSettings({...settings, main_text: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* ACCENT & FONTS */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Type size={20} color="var(--c-primary)" />
            <h3 style={{ margin: 0 }}>Tipografía y Logo</h3>
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Color Primario (Acento)</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                type="color" 
                value={settings.primary_color} 
                onChange={e => setSettings({...settings, primary_color: e.target.value})}
                style={{ width: '50px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              />
              <input 
                type="text" 
                className="form-input" 
                value={settings.primary_color}
                onChange={e => setSettings({...settings, primary_color: e.target.value})}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Familia Tipográfica</label>
            <select 
              className="form-input" 
              value={settings.font_family}
              onChange={e => setSettings({...settings, font_family: e.target.value})}
            >
              <option value="Arial">Arial (Sans Serif)</option>
              <option value="Inter">Inter (Moderno)</option>
              <option value="Roboto">Roboto (Google)</option>
              <option value="monospace">Monospace (Técnico)</option>
              <option value="'Courier New', Courier, monospace">Courier New</option>
              <option value="Georgia, serif">Georgia (Serif)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ImageIcon size={14} />
              Invertir Logo (para fondos claros)
            </label>
            <select 
              className="form-input" 
              value={settings.logo_filter === 'none' ? 'no' : 'si'}
              onChange={e => setSettings({...settings, logo_filter: e.target.value === 'si' ? 'invert(1) brightness(0.2)' : 'none'})}
            >
              <option value="no">No (Blanco original)</option>
              <option value="si">Sí (Oscuro/Invertido)</option>
            </select>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Temas;
