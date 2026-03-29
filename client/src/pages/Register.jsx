import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.username, form.email, form.password);
      navigate('/lobby');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
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
          <p className="text-amber-100/70 uppercase tracking-widest text-xs font-semibold">Join the Club</p>
        </div>

        {error && <p className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm backdrop-blur-sm">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <input
              type="text"
              placeholder="PLAYER ALIAS"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              className="w-full input-dark rounded-xl px-5 py-4 text-sm font-medium tracking-wide"
              required
            />
          </div>
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
          <div>
            <input
              type="password"
              placeholder="PASSWORD"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full input-dark rounded-xl px-5 py-4 text-sm font-medium tracking-wide"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-gold rounded-xl py-4 font-bold tracking-widest uppercase mt-2 text-sm"
          >
            {loading ? 'Registering...' : 'Claim Seat'}
          </button>
        </form>

        <p className="text-center text-sm text-stone-400 mt-8 font-medium">
          Already a member?{' '}
          <Link to="/login" className="text-amber-400 hover:text-amber-300 transition-colors uppercase tracking-wide ml-1">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
