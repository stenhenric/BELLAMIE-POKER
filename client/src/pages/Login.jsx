import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/lobby');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-felt p-4 font-body">
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      <div className="relative glass-panel rounded-3xl p-8 w-full max-w-md z-10 text-center">

        <div className="mb-8">
          <h1 className="text-4xl font-heading font-bold mb-2 tracking-widest text-gold-gradient drop-shadow-lg">
            POKER WITH STEN
          </h1>
          <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50 mb-3"></div>
          <p className="text-amber-100/70 uppercase tracking-widest text-xs font-semibold">Premium Card Lounge</p>
        </div>

        {error && <p className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm backdrop-blur-sm">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <input
              type="email"
              placeholder="EMAIL ADDRESS"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full input-dark rounded-xl px-5 py-4 text-sm font-medium tracking-wide"
              required
            />
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="PASSWORD"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full input-dark rounded-xl px-5 py-4 pr-12 text-sm font-medium tracking-wide"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500/50 hover:text-amber-400 transition-colors"
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-gold rounded-xl py-4 font-bold tracking-widest uppercase mt-2 text-sm"
          >
            {loading ? 'Authenticating...' : 'Enter Lounge'}
          </button>
        </form>

        <p className="text-center text-sm text-stone-400 mt-8 font-medium">
          First time here?{' '}
          <Link to="/register" className="text-amber-400 hover:text-amber-300 transition-colors uppercase tracking-wide ml-1">
            Request Access
          </Link>
        </p>
      </div>
    </div>
  );
}

