import React, { useEffect, useState } from 'react';
import {
  HeartPulse,
  Lock,
  Mail,
  User,
  ShieldCheck,
  Phone,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';

export function AuthScreen() {
  const { authStatus, defaultAdmin, setupInitialAdmin, patientRegister, login } =
    useClinic();
  const isSetup = authStatus === 'setup_required';

  const [mode, setMode] = useState<'signin' | 'patient_register'>('signin');
  const [name, setName] = useState(defaultAdmin.name);
  const [email, setEmail] = useState(defaultAdmin.email);
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('Self-Pay');
  const [memberId, setMemberId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'signin') {
      setName((prev) => prev || defaultAdmin.name);
      setEmail((prev) => prev || defaultAdmin.email);
    }
  }, [defaultAdmin, mode]);

  const switchMode = (next: 'signin' | 'patient_register') => {
    setMode(next);
    setError(null);
    setPassword('');
    if (next === 'patient_register') {
      setName('');
      setEmail('');
    } else {
      setEmail(defaultAdmin.email);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isSetup) {
        await setupInitialAdmin({ name, email, password });
      } else if (mode === 'patient_register') {
        await patientRegister({
          name,
          email,
          password,
          phone,
          dateOfBirth,
          insuranceProvider: insuranceProvider.trim() || 'Self-Pay',
          memberId: memberId.trim() || 'SELF-PAY',
        });
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
                  : mode === 'patient_register'
                  ? 'Patient self-service portal registration'
                  : 'Clinic & patient portal sign in'}
              </p>
            </div>
          </div>
        </div>

        {!isSetup && (
          <div className="px-6 pt-5">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F3F7F4] border border-[#E2EAE5]">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white text-[#073C35] shadow-xs'
                    : 'text-[#84938D] hover:text-[#172B27]'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode('patient_register')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'patient_register'
                    ? 'bg-white text-[#073C35] shadow-xs'
                    : 'text-[#84938D] hover:text-[#172B27]'
                }`}
              >
                New patient signup
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isSetup && (
            <div className="rounded-xl bg-[#EAF4EF] border border-[#CBE2D6] p-3.5 flex items-start gap-2.5 text-xs text-[#073C35]">
              <ShieldCheck className="w-4 h-4 text-[#0B6657] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Claim clinic administrator access</p>
                <p className="text-[#0B6657] mt-0.5">
                  Create the primary Admin account to unlock patient records, scheduling, laboratory workflows, and staff registration.
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

          {(isSetup || mode === 'patient_register') && (
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
                  placeholder={isSetup ? defaultAdmin.name : 'e.g. Jordan Rivera'}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              {mode === 'patient_register' ? 'Patient email' : 'Account email'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  mode === 'patient_register'
                    ? 'you@example.com'
                    : 'dicksonndumia19@gmail.com'
                }
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
              />
            </div>
          </div>

          {!isSetup && mode === 'patient_register' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                    Phone number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 234-5678"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                    Date of birth
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      required
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                    Insurance provider
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={insuranceProvider}
                      onChange={(e) => setInsuranceProvider(e.target.value)}
                      placeholder="Self-Pay"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                    Member ID (optional)
                  </label>
                  <input
                    type="text"
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    placeholder="SELF-PAY"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm text-[#172B27] focus:outline-none focus:border-[#0B6657]"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Password{' '}
              {(isSetup || mode === 'patient_register') && (
                <span className="text-[#84938D]">(min 8 characters)</span>
              )}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={isSetup || mode === 'patient_register' ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  isSetup
                    ? 'Choose an admin password'
                    : mode === 'patient_register'
                    ? 'Create a portal password'
                    : 'Enter your password'
                }
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
                : mode === 'patient_register'
                ? 'Creating patient account...'
                : 'Signing in...'
              : isSetup
              ? 'Create Admin account & sign in'
              : mode === 'patient_register'
              ? 'Create patient portal account'
              : 'Sign in'}
          </button>

          <p className="text-[11px] text-center text-[#84938D] pt-1">
            Role-based access enforced for Admin, Receptionist, Doctor, Lab Technician, and Patient accounts.
          </p>
        </form>
      </div>
    </div>
  );
}

