import React from 'react';
import { NavLink } from 'react-router-dom';

const PlaceholderPage = ({ title, description }) => {
  return (
    <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--c-surface)', borderRadius: '20px', border: '1px solid var(--c-border)', marginTop: '20px' }}>
      <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(0, 169, 188, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--c-primary)" strokeWidth="2"><path d="M12 2v20m10-10H2"/></svg>
      </div>
      <h1 style={{ fontSize: '28px', color: 'var(--c-text)', marginBottom: '12px' }}>{title}</h1>
      <p style={{ color: 'var(--c-muted)', fontSize: '16px', maxWidth: '500px', margin: '0 auto 30px' }}>{description || 'Esta sección está en construcción como parte del nuevo módulo de gestión.'}</p>
      <NavLink to="/dashboard" style={{ display: 'inline-block', padding: '12px 24px', background: 'var(--c-primary)', color: 'white', borderRadius: '12px', fontWeight: 'bold', textDecoration: 'none' }}>
        Volver al Inicio
      </NavLink>
    </div>
  );
};

export default PlaceholderPage;
