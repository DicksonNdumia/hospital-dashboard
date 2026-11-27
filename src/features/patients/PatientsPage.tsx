import { useMemo, useState } from 'react';
import {
  Search,
  UserPlus,
  ArrowUpDown,
  Eye,
  Edit3,
  Archive,
  MessageSquare,
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { Patient, PatientStatus } from '../../types/clinic';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';

type SortField = 'name' | 'lastAppointment' | 'assignedDoctorId' | 'status';

export function PatientsPage() {
  const {
    patients,
    doctors,
    authUser,
    getDoctorById,
    openPatientModal,
    setProfilePatientId,
    openConversationForPatient,
    archivePatient,
  } = useClinic();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PatientStatus>('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [archiveTarget, setArchiveTarget] = useState<Patient | null>(null);

  const canManagePatients =
    authUser?.role === 'ADMIN' || authUser?.role === 'RECEPTIONIST';

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredPatients = useMemo(() => {
    const list = patients.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (doctorFilter !== 'all' && p.assignedDoctorId !== doctorFilter)
        return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.phone.toLowerCase().includes(q) &&
          !p.email.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    return [...list].sort((a, b) => {
      let aVal = '';
      let bVal = '';
      if (sortField === 'assignedDoctorId') {
        aVal = a.assignedDoctorId ? getDoctorById(a.assignedDoctorId)?.name ?? '' : '';
        bVal = b.assignedDoctorId ? getDoctorById(b.assignedDoctorId)?.name ?? '' : '';
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }
      const cmp = aVal.localeCompare(bVal);
      return sortAsc ? cmp : -cmp;
    });
  }, [patients, statusFilter, doctorFilter, search, sortField, sortAsc, getDoctorById]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedPatients = filteredPatients.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#172B27]">Patients</h1>
          <p className="text-xs sm:text-sm text-[#84938D]">
            {patients.length} patient records persisted at Northfield Family Clinic
          </p>
        </div>

        {canManagePatients && (
          <button
            type="button"
            onClick={() => openPatientModal({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs sm:text-sm font-medium transition-colors self-start sm:self-auto cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Add patient
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F3F7F4] rounded-xl self-start">
          {(['all', 'Active', 'New', 'Follow-up', 'Archived'] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-[#172B27] shadow-2xs'
                    : 'text-[#84938D] hover:text-[#172B27]'
                }`}
              >
                {st === 'all' ? 'All patients' : st}
              </button>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, phone, email..."
              className="pl-8 pr-3 py-2 rounded-xl border border-[#E2EAE5] text-xs text-[#172B27] focus:outline-none focus:border-[#0B6657] w-60"
            />
          </div>

          <select
            value={doctorFilter}
            onChange={(e) => {
              setDoctorFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter patients by doctor"
            className="px-3 py-2 rounded-xl border border-[#E2EAE5] bg-white text-xs text-[#172B27] focus:outline-none focus:border-[#0B6657]"
          >
            <option value="all">All doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Patient Directory Table */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        {paginatedPatients.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-[#172B27]">
              No matching patient records
            </p>
            <p className="text-xs text-[#84938D] mt-1">
              Clear your search filter or add a new patient.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2EAE5] bg-[#F3F7F4]/60 text-[11px] font-semibold text-[#84938D]">
                    <th className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleSort('name')}
                        className="inline-flex items-center gap-1 hover:text-[#172B27] cursor-pointer"
                      >
                        Patient name
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">Phone number</th>
                    <th className="py-3 px-4 whitespace-nowrap">Email</th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleSort('lastAppointment')}
                        className="inline-flex items-center gap-1 hover:text-[#172B27] cursor-pointer"
                      >
                        Last appointment
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleSort('assignedDoctorId')}
                        className="inline-flex items-center gap-1 hover:text-[#172B27] cursor-pointer"
                      >
                        Assigned doctor
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleSort('status')}
                        className="inline-flex items-center gap-1 hover:text-[#172B27] cursor-pointer"
                      >
                        Patient status
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2EAE5] text-xs">
                  {paginatedPatients.map((p) => {
                    const doc = p.assignedDoctorId
                      ? getDoctorById(p.assignedDoctorId)
                      : undefined;
                    const statusColor =
                      p.status === 'Active'
                        ? 'text-[#0B6657]'
                        : p.status === 'New'
                        ? 'text-[#20B875]'
                        : p.status === 'Follow-up'
                        ? 'text-amber-700'
                        : 'text-[#84938D]';

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-[#F3F7F4]/50 transition-colors"
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setProfilePatientId(p.id)}
                            className="flex items-center gap-2.5 text-left group cursor-pointer"
                          >
                            <Avatar name={p.name} bgColor={p.avatarColor} size="sm" />
                            <div>
                              <p className="font-semibold text-[#172B27] group-hover:text-[#0B6657] transition-colors">
                                {p.name}
                              </p>
                              <p className="text-[11px] text-[#84938D]">
                                {p.insuranceProvider}
                              </p>
                            </div>
                          </button>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap tabular-nums text-[#172B27]">
                          {p.phone}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-[#84938D]">
                          {p.email}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap tabular-nums text-[#172B27]">
                          {p.lastAppointment}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-[#172B27]">
                          {doc?.name ?? '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`font-medium ${statusColor}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setProfilePatientId(p.id)}
                              title="View patient profile"
                              aria-label={`View ${p.name}`}
                              className="p-1.5 rounded-lg border border-[#E2EAE5] text-[#172B27] hover:bg-[#EAF4EF] hover:text-[#073C35] transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openConversationForPatient(p.id)}
                              title="Internal clinic thread"
                              aria-label={`Message about ${p.name}`}
                              className="p-1.5 rounded-lg border border-[#E2EAE5] text-[#0B6657] hover:bg-[#EAF4EF] transition-colors cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            {canManagePatients && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openPatientModal({ mode: 'edit', patient: p })
                                  }
                                  title="Edit patient"
                                  aria-label={`Edit ${p.name}`}
                                  className="p-1.5 rounded-lg border border-[#E2EAE5] text-[#172B27] hover:bg-[#F3F7F4] transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {p.status !== 'Archived' && (
                                  <button
                                    type="button"
                                    onClick={() => setArchiveTarget(p)}
                                    title="Archive patient"
                                    aria-label={`Archive ${p.name}`}
                                    className="p-1.5 rounded-lg border border-[#E2EAE5] text-[#84938D] hover:text-[#172B27] hover:bg-[#F3F7F4] transition-colors cursor-pointer"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-[#E2EAE5] flex items-center justify-between text-xs text-[#84938D]">
                <span className="tabular-nums">
                  Page {safePage} of {totalPages} · {filteredPatients.length} patients
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg border border-[#E2EAE5] disabled:opacity-45 text-[#172B27] cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 rounded-lg border border-[#E2EAE5] disabled:opacity-45 text-[#172B27] cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Soft Archive Confirmation Modal */}
      <Modal
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        title="Archive patient record"
        subtitle={archiveTarget?.name}
        maxWidthClass="max-w-md"
      >
        <p className="text-sm text-[#172B27]">
          Archiving <span className="font-semibold">{archiveTarget?.name}</span> removes them from active booking queues while preserving medical visit history and audit logs.
        </p>
        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={() => setArchiveTarget(null)}
            className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium text-[#172B27] hover:bg-[#F3F7F4] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!archiveTarget) return;
              await archivePatient(archiveTarget.id);
              setArchiveTarget(null);
            }}
            className="px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
          >
            Archive patient
          </button>
        </div>
      </Modal>
    </div>
  );
}
