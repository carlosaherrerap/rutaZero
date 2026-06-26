import React, { useState, useRef, useEffect } from 'react';
import Calendar from '@atlaskit/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function CustomDatePicker({ value, onChange, style, className, name }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (e) => {
    // Atlaskit Calendar onChange receives an object with an 'iso' property
    const isoDate = e.iso || e; 
    if (onChange) {
      // Simulate native event target
      onChange({ target: { name, value: isoDate } });
    }
    setIsOpen(false);
  };

  let defaultYear = new Date().getFullYear();
  let defaultMonth = new Date().getMonth() + 1;
  if (value) {
    const parts = value.split('-');
    if (parts.length >= 2) {
      defaultYear = parseInt(parts[0], 10);
      defaultMonth = parseInt(parts[1], 10);
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: 'var(--c-surface, #fff)',
          border: '1px solid var(--c-border, #ccc)',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '13px',
          color: value ? 'var(--c-text, #333)' : 'var(--c-muted, #999)',
          ...style
        }}
        className={className}
      >
        <span>{value || 'Seleccionar fecha'}</span>
        <CalendarIcon size={16} color="var(--c-muted, #999)" />
      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          zIndex: 9999,
          background: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--c-border, #ccc)'
        }}>
          <Calendar
            defaultSelected={value ? [value] : []}
            defaultMonth={defaultMonth}
            defaultYear={defaultYear}
            onSelect={handleSelect}
            testId={'calendar'}
          />
        </div>
      )}
    </div>
  );
}
