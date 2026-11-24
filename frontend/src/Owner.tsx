import { useEffect, useState, type FormEvent } from 'react';
import AddressPicker from './AddressPicker';
import Icon from './Icons';
import './icon-polish.css';
import type { ToastKind } from './Toast';
import { accommodationName, errorMessage, money, publicationName, reservationName, shortDate } from './api';
import type { AccommodationType, AddressCandidate, ManagedReservation, OwnedCamping, Space } from './types';

export type ProtectedRequest = <T>(path: string, options?: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown }) => Promise<T>;

interface OwnerProps {
  api: ProtectedRequest;
  notify: (message: string, kind?: ToastKind, title?: string) => void;
}

const allTypes: AccommodationType[] = ['TENT', 'MOTORHOME', 'TRAILER'];

export default function Owner({ api, notify }: OwnerProps) {
  const [campings, setCampings] = useState<OwnedCamping[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [reservations, setReservations] = useState<ManagedReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [changingReservation, setChangingReservation] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [campingName, setCampingName] = useState('');
  const [campingAddress, setCampingAddress] = useState('');
  const [campingLocation, setCampingLocation] = useState<AddressCandidate | null>(null);
  const [editingAddress, setEditingAddress] = useState('');
  const [editingLocation, setEditingLocation] = useState<AddressCandidate | null>(null);
  const [spaceName, setSpaceName] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [price, setPrice] = useState('85');
  const [types, setTypes] = useState<AccommodationType[]>(['TENT']);

  async function loadCampings(preferredId?: string) {
    setLoading(true);
    setError('');
    try {
      const result = await api<OwnedCamping[]>('/me/campings');
      setCampings(result);
      setSelectedId((previous) => {
        const chosen = preferredId ?? previous;
        return result.some((camping) => camping.id === chosen) ? chosen : (result[0]?.id ?? '');
      });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(campingId: string) {
    setDetailsLoading(true);
    setDetailError('');
    try {
      const [availableSpaces, incomingReservations] = await Promise.all([
        api<Space[]>(`/campings/${campingId}/spaces`),
        api<ManagedReservation[]>(`/campings/${campingId}/reservations`),
      ]);
      setSpaces(availableSpaces);
      setReservations(incomingReservations);
    } catch (cause) {
      setDetailError(errorMessage(cause));
      setSpaces([]);
      setReservations([]);
    } finally {
      setDetailsLoading(false);
    }
  }

  useEffect(() => { void loadCampings(); }, [api]);
  useEffect(() => { if (selectedId) void loadDetails(selectedId); else { setSpaces([]); setReservations([]); } }, [selectedId, api]);

  useEffect(() => {
    const camping = campings.find((item) => item.id === selectedId);
    setEditingAddress(camping?.addressText ?? '');
    setEditingLocation(null);
  }, [selectedId, campings]);

  async function updateCampingAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    if (!editingLocation) {
      setDetailError('Localize e selecione o novo endereço antes de salvar.');
      return;
    }
    setBusy(true);
    setDetailError('');
    try {
      await api(`/campings/${selectedId}/address`, {
        method: 'PUT',
        body: {
          addressText: editingLocation.label,
          latitude: editingLocation.latitude,
          longitude: editingLocation.longitude,
        },
      });
      setEditingLocation(null);
      notify('A localização foi salva. O camping aguardará nova análise antes de voltar à busca.', 'success', 'Endereço atualizado');
      await loadCampings(selectedId);
    } catch (cause) {
      const message = errorMessage(cause);
      setDetailError(message);
      notify(message, 'error', 'Endereço não atualizado');
    } finally {
      setBusy(false);
    }
  }

  async function createCamping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campingLocation) {
      setError('Localize e selecione o endereço do camping antes de cadastrar.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await api<{ id: string; name: string }>('/campings', {
        method: 'POST',
        body: {
          name: campingName.trim(),
          addressText: campingLocation.label,
          latitude: campingLocation.latitude,
          longitude: campingLocation.longitude,
        },
      });
      setCampingName('');
      setCampingAddress('');
      setCampingLocation(null);
      notify(`“${created.name}” foi cadastrado e está aguardando aprovação para aparecer na busca.`, 'success', 'Camping cadastrado');
      await loadCampings(created.id);
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      notify(message, 'error', 'Camping não cadastrado');
    } finally {
      setBusy(false);
    }
  }

  function toggleType(value: AccommodationType) {
    setTypes((previous) => previous.includes(value) ? previous.filter((type) => type !== value) : [...previous, value]);
  }

  async function createSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setDetailError('');
    try {
      if (types.length === 0) throw new Error('Selecione pelo menos um tipo de acomodação.');
      const priceNumber = Number(price.replace(',', '.'));
      if (!Number.isFinite(priceNumber) || priceNumber < 0) throw new Error('Informe uma diária válida.');
      const dailyRateCents = Math.round(priceNumber * 100);
      await api<Space>(`/campings/${selectedId}/spaces`, {
        method: 'POST',
        body: {
          name: spaceName.trim(),
          accommodationTypes: types,
          ...(dimensions.trim() ? { dimensions: dimensions.trim() } : {}),
          dailyRateCents,
        },
      });
      setSpaceName('');
      setDimensions('');
      notify('O novo espaço já está disponível no painel do camping.', 'success', 'Espaço cadastrado');
      await loadDetails(selectedId);
    } catch (cause) {
      const message = errorMessage(cause);
      setDetailError(message);
      notify(message, 'error', 'Espaço não cadastrado');
    } finally {
      setBusy(false);
    }
  }

  async function decide(reservation: ManagedReservation, action: 'approve' | 'refuse') {
    if (changingReservation) return;
    setChangingReservation(reservation.id);
    setDetailError('');
    try {
      const result = await api<{ id: string; status: 'CONFIRMED' | 'REFUSED' }>(
        `/reservations/${reservation.id}/${action}`, { method: 'POST' },
      );
      // Atualiza imediatamente o estado visível sem aguardar a nova listagem.
      setReservations((current) => current.map((item) => item.id === reservation.id ? { ...item, status: result.status } : item));
      if (action === 'approve') {
        notify(`A reserva de ${reservation.camperName} foi confirmada. O período permanece bloqueado.`, 'success', 'Reserva aprovada');
      } else {
        notify(`A solicitação de ${reservation.camperName} foi recusada. O período está disponível novamente.`, 'success', 'Reserva recusada');
      }
      await loadDetails(selectedId);
    } catch (cause) {
      const message = errorMessage(cause);
      setDetailError(message);
      notify(message, 'error', action === 'approve' ? 'Falha ao aprovar reserva' : 'Falha ao recusar reserva');
    } finally {
      setChangingReservation(null);
    }
  }

  const selected = campings.find((camping) => camping.id === selectedId);
  const pendingCount = reservations.filter((reservation) => reservation.status === 'PENDING').length;

  return (
    <div className="owner-page">
      <section className="owner-intro">
        <div className="owner-intro-content">
          <span className="eyebrow">SEU ESPAÇO, NOSSA PAIXÃO</span>
          <h1>Seu camping, sempre bem cuidado.</h1>
          <p>Gerencie espaços e reservas com a mesma tranquilidade de quem está perto da natureza.</p>
        </div>
        <div className="owner-intro-art" aria-hidden="true"><Icon name="mountain" size={100}/></div>
      </section>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="owner-grid">
        <aside className="owner-sidebar">
          <div className="panel"><div className="panel-heading"><h2>Meus campings</h2><span className="count-pill">{campings.length}</span></div>
            {loading ? <p className="muted">Carregando...</p> : campings.length === 0 ? <p className="muted">Você ainda não administra nenhum camping.</p> : (
              <div className="owned-list">{campings.map((camping) => (
                <button key={camping.id} className={`owned-item ${selectedId === camping.id ? 'current' : ''}`} onClick={() => setSelectedId(camping.id)}>
                  <span className="owned-icon"><Icon name="mountain" size={20}/></span><span className="owned-content"><strong>{camping.name}</strong><small>{camping.addressText ?? 'Endereço não informado'} · {publicationName[camping.publicationStatus] ?? camping.publicationStatus}</small></span><Icon name="arrow" size={16} className="owned-chevron"/>
                </button>
              ))}</div>
            )}
          </div>
          <div className="panel new-camping-panel"><div className="panel-heading"><div><span className="eyebrow">EXPANDA SEUS HORIZONTES</span><h2>Cadastre um camping</h2></div><span className="panel-head-icon"><Icon name="plus" size={21}/></span></div>
            <form className="form-stack" onSubmit={(event) => { void createCamping(event); }}>
              <label>Nome do camping<input required minLength={2} maxLength={120} placeholder="Ex.: Refúgio da Serra" value={campingName} onChange={(event) => setCampingName(event.target.value)} /></label>
              <AddressPicker
                label="Endereço do camping"
                value={campingAddress}
                onChange={(text) => { setCampingAddress(text); setCampingLocation(null); }}
                onSelect={(location) => { setCampingAddress(location.label); setCampingLocation(location); }}
                placeholder="Ex.: Rua XV de Novembro, 123, Indaial - SC"
                hint="Digite, clique em Localizar e escolha o endereço correto. As coordenadas serão preenchidas automaticamente."
              />
              {campingLocation && <p className="address-confirmed"><Icon name="check" size={15}/> Endereço selecionado: {campingLocation.label}</p>}
              <button className="button primary full" disabled={busy}>{busy ? 'Salvando...' : <><Icon name="plus" size={16}/> Cadastrar camping</>}</button>
              <p className="hint">Novos campings ficam aguardando aprovação antes de aparecer na busca.</p>
            </form>
          </div>
        </aside>

        <section className="owner-main">
          {!selected ? <div className="empty-panel"><span className="empty-icon"><Icon name="mountain" size={32}/></span><h3>Comece cadastrando seu camping</h3><p>Depois você poderá adicionar espaços e receber solicitações de reserva.</p></div> : <>
            <div className="selected-owner-head"><div><span className="eyebrow">GERENCIAMENTO</span><h2>{selected.name}</h2><p className="camping-address-subtitle"><Icon name="pin" size={16}/> {selected.addressText ?? 'Endereço ainda não informado'}</p><span className={`status-pill ${selected.publicationStatus === 'APPROVED' ? 'approved' : 'pending'}`}>{publicationName[selected.publicationStatus]}</span></div><button className="button subtle" onClick={() => { void loadDetails(selectedId); }}> <Icon name="refresh" size={15}/> Atualizar</button></div>
            {detailError && <p className="error-banner" role="alert">{detailError}</p>}
            <div className="panel">
              <div className="panel-heading"><div><h2>Endereço do camping</h2><p>Atualizar a localização exige uma nova análise antes da publicação.</p></div></div>
              <form className="form-stack" onSubmit={(event) => { void updateCampingAddress(event); }}>
                <AddressPicker
                  label="Endereço completo"
                  value={editingAddress}
                  onChange={(text) => { setEditingAddress(text); setEditingLocation(null); }}
                  onSelect={(location) => { setEditingAddress(location.label); setEditingLocation(location); }}
                  placeholder="Rua, número, bairro, cidade e UF"
                />
                {editingLocation && <p className="address-confirmed"><Icon name="check" size={15}/> Localização selecionada: {editingLocation.label}</p>}
                <button className="button outline" type="submit" disabled={busy || !editingLocation}>
                  Salvar novo endereço
                </button>
              </form>
            </div>
            <div className="owner-stat-row"><div className="owner-stat"><span>Espaços cadastrados</span><strong>{spaces.length}</strong></div><div className="owner-stat"><span>Solicitações pendentes</span><strong>{pendingCount}</strong></div><div className="owner-stat"><span>Total de reservas listadas</span><strong>{reservations.length}</strong></div></div>

            <div className="panel"><div className="panel-heading"><div><h2>Seus espaços</h2><p>Adicione vagas e defina os valores por diária.</p></div></div>
              {detailsLoading ? <p className="muted">Carregando espaços...</p> : spaces.length === 0 ? <p className="muted">Nenhum espaço cadastrado ainda.</p> : <div className="mini-spaces">{spaces.map((space) => <div className="mini-space" key={space.id}><span className="mini-space-icon"><Icon name="tent" size={22}/></span><div><strong>{space.name}</strong><small>{space.accommodationTypes.map((type) => accommodationName[type]).join(' · ')}</small></div><strong>{money(space.dailyRateCents)}<small>/noite</small></strong></div>)}</div>}
              <form className="form-stack add-space" onSubmit={(event) => { void createSpace(event); }}>
                <h3>Adicionar espaço</h3>
                <div className="two-fields"><label>Nome<input required minLength={2} maxLength={120} placeholder="Ex.: Vaga 02" value={spaceName} onChange={(event) => setSpaceName(event.target.value)} /></label><label>Diária (R$)<input required type="text" inputMode="decimal" placeholder="85,00" value={price} onChange={(event) => setPrice(event.target.value)} /></label></div>
                <label>Dimensões (opcional)<input maxLength={120} placeholder="Ex.: 10m x 8m" value={dimensions} onChange={(event) => setDimensions(event.target.value)} /></label>
                <fieldset className="type-fieldset"><legend>Tipos de acomodação</legend><div className="checkbox-row">{allTypes.map((type) => <label key={type}><input type="checkbox" checked={types.includes(type)} onChange={() => toggleType(type)} /> {accommodationName[type]}</label>)}</div></fieldset>
                <button className="button primary" disabled={busy}>{busy ? 'Salvando...' : <><Icon name="plus" size={16}/> Adicionar espaço</>}</button>
              </form>
            </div>

            <div className="panel"><div className="panel-heading"><div><h2>Pedidos de reserva</h2><p>Acompanhe e responda às solicitações dos campistas.</p></div><span className="count-pill">{pendingCount} pendentes</span></div>
              {detailsLoading ? <p className="muted">Carregando reservas...</p> : reservations.length === 0 ? <div className="empty-mini">Nenhuma solicitação recebida ainda.</div> : <div className="reservation-list">{reservations.map((reservation) => <article key={reservation.id} className="reservation-row">
                <div className="reservation-main"><span className="res-avatar">{reservation.camperName.charAt(0).toUpperCase()}</span><div><strong>{reservation.camperName}</strong><span>{reservation.spaceName} · {shortDate(reservation.startDate)} – {shortDate(reservation.endDate)}</span><span>{reservation.nights} {reservation.nights === 1 ? 'noite' : 'noites'} · {money(reservation.totalCents)}</span></div></div>
                <div className="reservation-actions"><span className={`status-pill ${reservation.status.toLowerCase()}`}>{reservationName[reservation.status] ?? reservation.status}</span>{reservation.status === 'PENDING' && <div className="decision-buttons"><button className="button success small" disabled={changingReservation !== null} onClick={() => { void decide(reservation, 'approve'); }}>{changingReservation === reservation.id ? <><span className="ui-spinner" aria-hidden="true"/> Processando...</> : <><Icon name="check" size={14}/> Aprovar</>}</button><button className="button outline small" disabled={changingReservation !== null} onClick={() => { void decide(reservation, 'refuse'); }}>{changingReservation === reservation.id ? 'Aguarde...' : 'Recusar'}</button></div>}</div>
              </article>)}</div>}
            </div>
          </>}
        </section>
      </div>
    </div>
  );
}
