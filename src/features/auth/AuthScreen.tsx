import React, { useEffect, useState } from 'react';
import { HeartPulse, Lock, Mail, User, ShieldCheck } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';

export function AuthScreen() {
  const { authStatus, defaultAdmin, setupInitialAdmin, login } = useClinic();
  const isSetup = authStatus === 'setup_required';

  const [name, setName] = useState(defaultAdmin.name);
  const [email, setEmail] = useState(defaultAdmin.email);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName((prev) => prev || defaultAdmin.name);
    setEmail((prev) => prev || defaultAdmin.email);
  }, [defaultAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isSetup) {
        await setupInitialAdmin({ name, email, password });
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F7F4] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E2EAE5] shadow-sm overflow-hidden">
        <div className="bg-[#073C35] text-white px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0B6657] flex items-center justify-center shrink-0">
              <HeartPulse className="w-5 h-5 text-[#20B875]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Northfield Family Clinic
              </h1>
              <p className="text-xs text-[#9DBCB3]">
                {isSetup
                  ? 'Initial administrator setup'
                  : 'Clinic operations portal'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isSetup && (
            <div className="rounded-xl bg-[#EAF4EF] border border-[#CBE2D6] p-3.5 flex items-start gap-2.5 text-xs text-[#073C35]">
              <ShieldCheck className="w-4 h-4 text-[#0B6657] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Claim clinic administrator access</p>
                <p className="text-[#0B6657] mt-0.5">
                  Create the primary Admin account to unlock patient records, scheduling, and staff role registration.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 font-medium"
            >
              {error}
            </div>
          )}

          {isSetup && (
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Full name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Staff email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dicksonndumia19@gmail.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Password {isSetup && <span className="text-[#84938D]">(min 8 characters)</span>}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={isSetup ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSetup ? 'Choose an admin password' : 'Enter your password'}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl bg-[#073C35] hover:bg-[#0B6657] disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            {submitting
              ? isSetup
                ? 'Configuring workspace...'
                : 'Signing in...'
              : isSetup
              ? 'Create Admin account & sign in'
              : 'Sign in'}
          </button>

          <p className="text-[11px] text-center text-[#84938D] pt-1">
            Role-based access enforced for Admin, Receptionist, and Doctor staff accounts.
          </p>
        </form>
      </div>
    </div>
  );
}
