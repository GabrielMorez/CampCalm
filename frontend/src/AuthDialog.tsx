import { useState, type FormEvent } from 'react';
import { errorMessage } from './api';
import Icon from './Icons';
import type { LoginInput, RegisterInput } from './types';

interface AuthDialogProps {
  onClose: () => void;
  onLogin: (input: LoginInput) => Promise<void>;
  onRegister: (input: RegisterInput) => Promise<void>;
}

export default function AuthDialog({ onClose, onLogin, onRegister }: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await onLogin({ email, password });
      } else {
        await onRegister({ name, phone, email, password });
      }
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onClose();
    }}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-label="Acessar o CampCalm">
        <button type="button" disabled={loading} className="modal-close" onClick={onClose} aria-label="Fechar"><Icon name="close" size={20}/></button>
        <div className="modal-logo"><Icon name="mountain" size={31}/></div>
        <p className="eyebrow">BEM-VINDO AO CAMPCALM</p>
        <h2>{mode === 'login' ? 'Bom ter você por aqui.' : 'Comece sua jornada.'}</h2>
        <p className="muted">{mode === 'login' ? 'Entre para solicitar reservas e gerenciar seus campings.' : 'Uma conta para acampar e para administrar seu espaço.'}</p>
        <div className="auth-tabs" role="tablist" aria-label="Tipo de acesso">
          <button type="button" className={mode === 'login' ? 'selected' : ''} disabled={loading} onClick={() => { setMode('login'); setError(''); }}>Entrar</button>
          <button type="button" className={mode === 'register' ? 'selected' : ''} disabled={loading} onClick={() => { setMode('register'); setError(''); }}>Criar conta</button>
        </div>
        <form className="form-stack" aria-busy={loading} onSubmit={(event) => { void submit(event); }}>
          {mode === 'register' && (
            <>
              <label>Nome completo<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" autoComplete="name" /></label>
              <label>Telefone<input required minLength={8} maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(47) 99999-9999" autoComplete="tel" /></label>
            </>
          )}
          <label>E-mail<input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" autoComplete="email" /></label>
          <label>Senha<input type="password" required minLength={mode === 'register' ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>
          {mode === 'register' && <p className="hint">Use uma senha de 12 a 128 caracteres.</p>}
          {error && <p className="error-banner" role="alert"><strong>Não foi possível continuar.</strong> {error}</p>}
          <button type="submit" disabled={loading} className="button primary full">{loading && <span className="ui-spinner" aria-hidden="true"/>}{loading ? (mode === 'login' ? 'Entrando...' : 'Criando sua conta...') : mode === 'login' ? 'Entrar na conta' : 'Criar minha conta'}</button>
        </form>
        <p className="muted tiny center">A navegação e a consulta de vagas são livres, sem cadastro.</p>
      </section>
    </div>
  );
}
