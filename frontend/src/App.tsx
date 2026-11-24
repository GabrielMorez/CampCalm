import { useCallback, useEffect, useRef, useState } from 'react';
import AuthDialog from './AuthDialog';
import Explore from './Explore';
import Icon from './Icons';
import Owner, { type ProtectedRequest } from './Owner';
import Toast, { type ToastKind, type ToastNotice } from './Toast';
import { ApiError, authApi, errorMessage, money, request } from './api';
import type { AvailableSpace, LoginInput, LoginResponse, PublicCamping, RefreshResponse, RegisterInput, ReservationCreated, SearchFilters } from './types';

type View = 'explore' | 'owner';

export default function App() {
  const [view, setView] = useState<View>('explore');
  const [authOpen, setAuthOpen] = useState(false);
  const [session, setSession] = useState<LoginResponse | null>(null);
  const sessionRef = useRef<LoginResponse | null>(null);
  const refreshRef = useRef<Promise<LoginResponse | null> | null>(null);
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const noticeId = useRef(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const notify = useCallback((message: string, kind: ToastKind = 'success', title = '') => {
    const fallbackTitle: Record<ToastKind, string> = {
      success: 'Tudo certo!', error: 'Não foi possível concluir',
      info: 'Informação', warning: 'Atenção',
    };
    setNotice({ id: ++noticeId.current, kind, title: title || fallbackTitle[kind], message });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice((current) => current?.id === notice.id ? null : current);
    }, notice.kind === 'error' ? 8500 : 6500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function updateSession(next: LoginResponse | null) {
    sessionRef.current = next;
    setSession(next);
  }

  async function login(input: LoginInput) {
    const result = await authApi.login(input);
    updateSession(result);
    notify('Você já pode explorar campings e solicitar reservas.', 'success', 'Login realizado');
  }

  async function register(input: RegisterInput) {
    await authApi.register(input);
    const result = await authApi.login({ email: input.email, password: input.password });
    updateSession(result);
    notify('Sua conta foi criada e você já está conectado.', 'success', 'Bem-vindo ao CampCalm!');
  }

  async function refreshSession(): Promise<LoginResponse | null> {
    if (!refreshRef.current) {
      const current = sessionRef.current;
      if (!current) return null;
      refreshRef.current = authApi.refresh(current.refreshToken)
        .then((response: RefreshResponse) => {
          const latest = sessionRef.current;
          if (!latest) return null;
          const next: LoginResponse = { ...latest, ...response };
          updateSession(next);
          return next;
        })
        .catch(() => {
          updateSession(null);
          return null;
        })
        .finally(() => { refreshRef.current = null; });
    }
    return refreshRef.current;
  }

  const protectedRequest = useCallback<ProtectedRequest>(async <T,>(path: string, options: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown } = {}): Promise<T> => {
    const current = sessionRef.current;
    if (!current) throw new ApiError(401, 'UNAUTHORIZED', 'Entre na sua conta para continuar.');
    try {
      return await request<T>(path, { ...options, accessToken: current.accessToken });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      const renewed = await refreshSession();
      if (!renewed) throw new ApiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.');
      return request<T>(path, { ...options, accessToken: renewed.accessToken });
    }
  }, []);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    const current = sessionRef.current;
    updateSession(null);
    setView('explore');
    try {
      if (current) await authApi.logout(current.refreshToken);
      notify('Sua sessão foi encerrada com segurança.', 'success', 'Até a próxima!');
    } catch {
      notify('Você saiu deste dispositivo, mas não foi possível confirmar o encerramento da sessão no servidor.', 'warning', 'Sessão local encerrada');
    } finally {
      setLoggingOut(false);
    }
  }

  function openOwner() {
    if (!sessionRef.current) { setAuthOpen(true); notify('Entre na sua conta para acessar os seus campings.', 'info', 'Acesso necessário'); return; }
    setView('owner');
  }

  async function reserve(camping: PublicCamping, space: AvailableSpace, filters: SearchFilters): Promise<boolean> {
    if (!sessionRef.current) {
      setAuthOpen(true);
      notify('Entre ou crie sua conta e depois confirme a reserva.', 'info', 'Entre para reservar');
      return false;
    }
    try {
      const result = await protectedRequest<ReservationCreated>('/reservations', {
        method: 'POST',
        body: {
          campingId: camping.id,
          spaceId: space.id,
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      });
      notify(`Sua solicitação de ${money(result.totalCents)} foi enviada. Aguarde a confirmação do camping.`, 'success', 'Reserva solicitada!');
      return true;
    } catch (cause) {
      notify(errorMessage(cause), 'error', 'Reserva não realizada');
      return false;
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-inner container">
          <button className="brand" type="button" onClick={() => setView('explore')} aria-label="CampCalm — ir para explorar">
            <span className="brand-mark"><Icon name="mountain" size={29}/></span>
            <span className="brand-name">Camp<span>Calm</span></span>
          </button>

          <nav className="main-nav" aria-label="Navegação principal">
            <button type="button" className={view === 'explore' ? 'active' : ''} onClick={() => setView('explore')}>
              Explorar
            </button>
            <button type="button" className={view === 'owner' ? 'active' : ''} onClick={openOwner}>
              Meu camping
            </button>
          </nav>

          <div className="header-actions">
            {session ? (
              <>
                <span className="account-label" title={session.user.email}><Icon name="user" size={16}/><span>{session.user.email}</span></span>
                <button className="button outline header-login" disabled={loggingOut} onClick={() => { void logout(); }}>{loggingOut ? <span className="ui-spinner" aria-hidden="true"/> : <Icon name="logout" size={16}/>} {loggingOut ? 'Saindo...' : 'Sair'}</button>
              </>
            ) : (
              <button className="button header-login primary" onClick={() => setAuthOpen(true)}><Icon name="user" size={16}/> Entrar</button>
            )}
          </div>
        </div>
      </header>

      <Toast notice={notice} onClose={() => setNotice(null)}/>

      <main className="container main-content">
        {view === 'explore'
          ? <Explore signedIn={Boolean(session)} onLogin={() => setAuthOpen(true)} onReserve={reserve}/>
          : <Owner api={protectedRequest} notify={notify}/>}
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="brand-footer"><Icon name="mountain" size={24}/><strong>CampCalm</strong></div>
          <span>Seu refúgio começa aqui.</span>
          <span>Endereços: <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></span>
        </div>
      </footer>

      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onLogin={login} onRegister={register} />}
    </div>
  );
}
