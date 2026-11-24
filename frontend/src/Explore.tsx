import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AddressPicker from './AddressPicker';
import Icon from './Icons';
import { accommodationName, dateInputAfter, errorMessage, money, request } from './api';
import type { AddressCandidate, AvailableSpace, PublicCamping, SearchFilters } from './types';

interface ExploreProps {
  signedIn: boolean;
  onLogin: () => void;
  onReserve: (camping: PublicCamping, space: AvailableSpace, filters: SearchFilters) => Promise<boolean>;
}

const defaultFilters: SearchFilters = {
  latitude: '-26.897',
  longitude: '-49.231',
  radiusKm: '50',
  startDate: dateInputAfter(2),
  endDate: dateInputAfter(4),
};

const scenicPhotos = [
  'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=820&q=82',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=820&q=82',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=820&q=82',
];

export default function Explore({ signedIn, onLogin, onReserve }: ExploreProps) {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [addressInput, setAddressInput] = useState('Indaial, Santa Catarina');
  const [searchLocation, setSearchLocation] = useState<AddressCandidate | null>({
    label: 'Indaial, Santa Catarina', latitude: -26.897, longitude: -49.231, resultType: 'city',
  });
  const [campings, setCampings] = useState<PublicCamping[]>([]);
  const [selected, setSelected] = useState<PublicCamping | null>(null);
  const [spaces, setSpaces] = useState<AvailableSpace[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [reserving, setReserving] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [sort, setSort] = useState<'nearby' | 'name'>('nearby');
  const [error, setError] = useState('');
  const [spacesError, setSpacesError] = useState('');

  const displayedCampings = useMemo(() => sort === 'name'
    ? [...campings].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    : campings, [campings, sort]);

  function update<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    if (key === 'startDate' || key === 'endDate') {
      setSelected(null);
      setSpaces([]);
    }
  }

  async function search(current: SearchFilters) {
    setSearching(true);
    setError('');
    setSelected(null);
    setSpaces([]);
    try {
      const params = new URLSearchParams({
        latitude: current.latitude,
        longitude: current.longitude,
        radiusKm: current.radiusKm,
      });
      const result = await request<PublicCamping[]>(`/campings?${params.toString()}`);
      setCampings(result);
    } catch (cause) {
      setError(errorMessage(cause));
      setCampings([]);
    } finally {
      setSearched(true);
      setSearching(false);
    }
  }

  useEffect(() => { void search(defaultFilters); }, []);

  async function showSpaces(camping: PublicCamping, current: SearchFilters = filters) {
    setSelected(camping);
    setSpaces([]);
    setSpacesError('');
    if (current.startDate < dateInputAfter(0) || current.endDate <= current.startDate) {
      setSpacesError('Selecione datas futuras, com check-out posterior ao check-in.');
      return;
    }
    setLoadingSpaces(true);
    try {
      const params = new URLSearchParams({ startDate: current.startDate, endDate: current.endDate });
      const result = await request<AvailableSpace[]>(`/campings/${camping.id}/available-spaces?${params}`);
      setSpaces(result);
      window.setTimeout(() => document.getElementById('available-spaces')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (cause) {
      setSpacesError(errorMessage(cause));
    } finally {
      setLoadingSpaces(false);
    }
  }

  function useLocation() {
    if (!navigator.geolocation) {
      setError('Seu navegador não oferece geolocalização. Informe uma cidade ou endereço.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { ...filters, latitude: coords.latitude.toFixed(5), longitude: coords.longitude.toFixed(5) };
        setFilters(next);
        setAddressInput('Minha localização atual (GPS)');
        setSearchLocation({ label: 'Minha localização atual (GPS)', latitude: coords.latitude, longitude: coords.longitude, resultType: 'gps' });
        void search(next);
      },
      () => setError('Não foi possível obter sua localização. Informe uma cidade ou endereço.'),
      { timeout: 10000, enableHighAccuracy: false },
    );
  }

  async function reserve(space: AvailableSpace) {
    if (!selected) return;
    setReserving(space.id);
    try {
      const success = await onReserve(selected, space, filters);
      if (success) await showSpaces(selected);
    } finally {
      setReserving(null);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!searchLocation) {
      setError('Localize e selecione um endereço antes de buscar campings.');
      return;
    }
    void search(filters);
    document.getElementById('camping-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function selectAddress(location: AddressCandidate) {
    const next = { ...filters, latitude: String(location.latitude), longitude: String(location.longitude) };
    setAddressInput(location.label);
    setSearchLocation(location);
    setFilters(next);
    void search(next);
  }

  return (
    <div className="explore-page">
      <section className="hero-shell" aria-label="Boas-vindas ao CampCalm">
        <img className="hero-photo" alt="" aria-hidden="true"
          src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1900&q=88"
          onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/hero-landscape.svg'; }}/>
        <div className="hero-overlay" />
        <div className="hero-copy">
          <span className="hero-tag"><Icon name="leaf" size={15}/> VIAGENS PARA RESPIRAR MELHOR</span>
          <h1>Encontre seu próximo <em>refúgio na natureza.</em></h1>
          <p>Descubra lugares especiais para acampar, confira espaços disponíveis e viva momentos que ficam na memória.</p>
          <div className="hero-note"><Icon name="sun" size={18}/> Mais céu aberto. Menos rotina.</div>
        </div>
        <span className="hero-photo-credit">Imagem ilustrativa</span>
      </section>

      <form className="search-panel" onSubmit={submitSearch} id="camping-search">
        <div className="search-heading">
          <div><span className="eyebrow">PLANEJE SUA PRÓXIMA VIAGEM</span><h2>Para onde vamos?</h2></div>
          <button type="button" className="link-button" onClick={useLocation}><Icon name="pin" size={17}/> Usar minha localização</button>
        </div>
        <div className="search-grid">
          <div className="search-address-field">
            <AddressPicker
              label="Destino"
              value={addressInput}
              onChange={(text) => { setAddressInput(text); setSearchLocation(null); }}
              onSelect={selectAddress}
              placeholder="Cidade, região ou endereço"
            />
          </div>
          <label>Check-in<input required type="date" min={dateInputAfter(0)} value={filters.startDate} onChange={(event) => update('startDate', event.target.value)}/></label>
          <label>Check-out<input required type="date" min={filters.startDate} value={filters.endDate} onChange={(event) => update('endDate', event.target.value)}/></label>
          <label>Raio de busca
            <select value={filters.radiusKm} onChange={(event) => update('radiusKm', event.target.value)}>
              <option value="20">Até 20 km</option><option value="50">Até 50 km</option>
              <option value="100">Até 100 km</option><option value="200">Até 200 km</option>
            </select>
          </label>
          <button className="button primary search-action" type="submit" disabled={searching}>
            <Icon name="search" size={19}/>{searching ? 'Buscando...' : 'Buscar campings'}
          </button>
        </div>
        {searchLocation && <p className="search-hint"><Icon name="pin" size={14}/> Localização escolhida: {searchLocation.label}</p>}
        {error && <p className="error-banner" role="alert">{error}</p>}
      </form>

      <div className="benefits-row" aria-label="Como funciona o CampCalm">
        <div><span className="benefit-icon"><Icon name="compass" size={23}/></span><span><strong>Encontre seu lugar</strong><small>Explore campings por região</small></span></div>
        <div><span className="benefit-icon"><Icon name="calendar" size={23}/></span><span><strong>Escolha suas datas</strong><small>Consulte vagas e diárias</small></span></div>
        <div><span className="benefit-icon"><Icon name="shield" size={23}/></span><span><strong>Reserve com tranquilidade</strong><small>Solicite e aguarde a confirmação</small></span></div>
      </div>

      <section className="results-section" id="camping-results">
        <div className="section-heading">
          <div><span className="eyebrow">EXPLORE NOVOS CAMINHOS</span><h2>Campings para descobrir</h2><p>Escolha um lugar e veja os espaços disponíveis para as suas datas.</p></div>
          <div className="results-controls">
            {searched && <span className="count-pill">{campings.length} {campings.length === 1 ? 'camping' : 'campings'}</span>}
            <label className="sort-control">Ordenar
              <select value={sort} onChange={(event) => setSort(event.target.value as 'nearby' | 'name')}>
                <option value="nearby">Mais próximos</option>
                <option value="name">Nome (A–Z)</option>
              </select>
            </label>
          </div>
        </div>

        {searching ? (
          <div className="empty-panel"><span className="empty-icon"><Icon name="compass" size={34}/></span><h3>Procurando bons lugares...</h3><p>Estamos consultando os campings publicados na região selecionada.</p></div>
        ) : displayedCampings.length === 0 ? (
          <div className="empty-panel"><span className="empty-icon"><Icon name="tent" size={34}/></span><h3>Ainda não encontramos campings nessa região</h3><p>Experimente ampliar o raio ou buscar outra cidade. Estabelecimentos aguardando aprovação não aparecem aqui.</p></div>
        ) : (
          <div className="camping-grid">
            {displayedCampings.map((camping, index) => (
              <article key={camping.id} className={`camping-card ${selected?.id === camping.id ? 'selected-card' : ''}`}>
                <div className="camping-visual">
                  <img alt="Paisagem natural ilustrativa" loading="lazy" src={scenicPhotos[index % scenicPhotos.length]}
                    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = `/images/camping-landscape-${index % 3 + 1}.svg`; }}/>
                  <span className="visual-label"><Icon name="leaf" size={13}/> Natureza e descanso</span>
                  <span className="image-disclaimer">Imagem ilustrativa</span>
                </div>
                <div className="camping-card-body">
                  <div className="camping-title-row"><h3>{camping.name}</h3></div>
                  <p className="camping-location"><Icon name="pin" size={16}/>{camping.addressText ?? 'Endereço não informado'}</p>
                  <div className="camping-card-foot">
                    <span className="card-info"><Icon name="calendar" size={16}/> Confira valores por data</span>
                    <button className="button outline" type="button" onClick={() => { void showSpaces(camping); }}>Ver espaços <Icon name="arrow" size={17}/></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <section className="availability-section" id="available-spaces">
          <div className="section-heading">
            <div><span className="eyebrow">SUA EXPERIÊNCIA COMEÇA AQUI</span><h2>Espaços em {selected.name}</h2><p>{selected.addressText ?? 'Consulte os espaços disponíveis'} · {filters.startDate.split('-').reverse().join('/')} a {filters.endDate.split('-').reverse().join('/')}</p></div>
            <button className="button subtle" onClick={() => { void showSpaces(selected); }} type="button"><Icon name="refresh" size={16}/> Atualizar vagas</button>
          </div>
          {spacesError && <p className="error-banner" role="alert">{spacesError}</p>}
          {loadingSpaces ? <div className="empty-panel">Consultando disponibilidade para as datas selecionadas...</div>
          : spaces.length === 0 && !spacesError ? (
            <div className="empty-panel"><span className="empty-icon"><Icon name="calendar" size={34}/></span><h3>Sem vagas para esse período</h3><p>Tente outras datas para encontrar espaços disponíveis.</p></div>
          ) : (
            <div className="spaces-grid">
              {spaces.map((space) => (
                <article className="space-card" key={space.id}>
                  <div>
                    <div className="space-top"><span className="space-icon"><Icon name="tent" size={24}/></span><span className="available-badge"><Icon name="check" size={13}/> Disponível</span></div>
                    <h3>{space.name}</h3>
                    <div className="chips">{space.accommodationTypes.map((type) => <span className="chip" key={type}>{accommodationName[type] ?? type}</span>)}</div>
                    {space.dimensions && <p className="muted">Dimensões: {space.dimensions}</p>}
                    <p className="muted">{space.nights} {space.nights === 1 ? 'diária' : 'diárias'} · {money(space.dailyRateCents)}/noite</p>
                  </div>
                  <div className="space-footer">
                    <div><span className="muted small">Total da estadia</span><strong className="price">{money(space.totalCents)}</strong></div>
                    <button type="button" className="button primary" disabled={reserving !== null} onClick={() => { void reserve(space); }}>
                      {reserving === space.id && <span className="ui-spinner" aria-hidden="true"/>}{reserving === space.id ? 'Enviando solicitação...' : signedIn ? 'Solicitar reserva' : 'Entrar para reservar'} {reserving !== space.id && <Icon name="arrow" size={16}/>} 
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!signedIn && <p className="helper-text">Para solicitar uma reserva, <button className="text-link" onClick={onLogin}>entre ou crie sua conta</button>.</p>}
        </section>
      )}
    </div>
  );
}
