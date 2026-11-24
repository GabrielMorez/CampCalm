import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { errorMessage, request } from './api';
import Icon from './Icons';
import type { AddressCandidate } from './types';

interface AddressPickerProps {
  label: string;
  value: string;
  onChange: (text: string) => void;
  onSelect: (result: AddressCandidate) => void;
  placeholder?: string;
  hint?: string;
}

interface GeocodeResponse {
  results: AddressCandidate[];
}

/** Busca explícita de endereços. A lista é flutuante e não altera a altura dos formulários. */
export default function AddressPicker({ label, value, onChange, onSelect, placeholder, hint }: AddressPickerProps) {
  const [results, setResults] = useState<AddressCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestVersion = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  async function lookup() {
    const address = value.trim();
    if (address.length < 4) {
      setError('Digite pelo menos quatro caracteres do endereço ou da cidade.');
      setOpen(true);
      return;
    }
    const version = ++requestVersion.current;
    setLoading(true);
    setOpen(true);
    setActiveIndex(-1);
    setError('');
    setResults([]);
    setSearched(false);
    try {
      const response = await request<GeocodeResponse>(`/geocoding/search?q=${encodeURIComponent(address)}`);
      if (version !== requestVersion.current) return;
      setResults(response.results);
      setSearched(true);
    } catch (cause) {
      if (version === requestVersion.current) setError(errorMessage(cause));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  function change(text: string) {
    ++requestVersion.current;
    setLoading(false);
    setResults([]);
    setSearched(false);
    setOpen(false);
    setActiveIndex(-1);
    setError('');
    onChange(text);
  }

  function choose(item: AddressCandidate) {
    ++requestVersion.current;
    onSelect(item);
    setResults([]);
    setOpen(false);
    setSearched(false);
    setError('');
    setActiveIndex(-1);
  }

  function onAddressKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (open && results.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setActiveIndex((index) => {
        if (event.key === 'ArrowDown') return (index + 1) % results.length;
        return index <= 0 ? results.length - 1 : index - 1;
      });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = open && results.length > 0 ? results[activeIndex >= 0 ? activeIndex : 0] : undefined;
      if (selected) choose(selected);
      else void lookup();
    }
  }

  const showPopover = open && (loading || Boolean(error) || searched || results.length > 0);

  return (
    <div className="address-picker" ref={containerRef}>
      <div className="address-picker-form">
        <label className="address-input-label">
          {label}
          <input
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showPopover && results.length > 0}
            aria-controls={listId}
            aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
            value={value}
            onChange={(event) => change(event.target.value)}
            onKeyDown={onAddressKeyDown}
            onFocus={() => { if (results.length > 0) setOpen(true); }}
            placeholder={placeholder ?? 'Rua, número, bairro, cidade e estado'}
            minLength={4}
            maxLength={180}
            required
          />
        </label>
        <button type="button" className="button outline address-lookup" onClick={() => { void lookup(); }} disabled={loading}>
          {loading ? <span className="ui-spinner" aria-hidden="true"/> : <Icon name="search" size={16}/>}
          {loading ? 'Localizando...' : 'Localizar'}
        </button>
      </div>
      {hint && <p className="hint">{hint}</p>}
      {showPopover && (
        <div className="address-popover" aria-live="polite">
          {loading && <p className="address-popover-message"><span className="ui-spinner" aria-hidden="true"/> Buscando endereços...</p>}
          {!loading && error && <p className="address-popover-message address-popover-error" role="alert">{error}</p>}
          {!loading && !error && searched && results.length === 0 && <p className="address-popover-message">Endereço não encontrado. Inclua cidade, UF ou número e tente novamente.</p>}
          {!loading && results.length > 0 && (
            <div className="address-results" id={listId} role="listbox" aria-label="Endereços encontrados">
              <span className="address-results-title">Escolha uma localização</span>
              {results.map((item, index) => (
                <button
                  id={`${listId}-${index}`}
                  className={`address-option ${activeIndex === index ? 'is-active' : ''}`}
                  key={`${item.latitude}-${item.longitude}-${index}`}
                  role="option"
                  aria-selected={activeIndex === index}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(item)}
                >
                  <Icon name="pin" size={17}/>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
