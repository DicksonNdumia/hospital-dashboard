import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  FlaskConical,
  Plus,
  Search,
  CheckCircle2,
  FileUp,
  Download,
  UserCheck,
  ClipboardCheck,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import {
  LabOrder,
  LabOrderStatus,
  LabPriority,
  LabResultFlag,
} from '../../types/clinic';
import { Modal } from '../../components/ui/Modal';

const STATUS_LABELS: Record<LabOrderStatus, string> = {
  REQUESTED: 'Requested',
  SAMPLE_COLLECTED: 'Sample Collected',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  RELEASED: 'Released',
};

const PIPELINE_STEPS: LabOrderStatus[] = [
  'REQUESTED',
  'SAMPLE_COLLECTED',
  'PROCESSING',
  'COMPLETED',
  'UNDER_REVIEW',
  'APPROVED',
  'RELEASED',
];

function statusTextColor(status: LabOrderStatus) {
  switch (status) {
    case 'RELEASED':
    case 'APPROVED':
      return 'text-[#0B6657]';
    case 'UNDER_REVIEW':
    case 'COMPLETED':
      return 'text-[#073C35]';
    case 'PROCESSING':
    case 'SAMPLE_COLLECTED':
      return 'text-amber-700';
    default:
      return 'text-[#84938D]';
  }
}

export function LaboratoryPage() {
  const {
    authUser,
    patients,
    doctors,
    labTests,
    labOrders,
    labTechnicians,
    createLabTest,
    createLabOrder,
    assignLabOrder,
    saveLabResults,
    uploadLabReport,
    transitionLabOrder,
    downloadLabReport,
    addToast,
  } = useClinic();

  const role = authUser?.role ?? 'DOCTOR';
  const isTech = role === 'LAB_TECHNICIAN';
  const isDoctor = role === 'DOCTOR';
  const isAdmin = role === 'ADMIN';
  const canOrderLab = isDoctor || isAdmin;
  const canManageCatalog = isTech || isAdmin;
  const canProcessLab = isTech || isAdmin;
  const canApproveOrRelease = isDoctor || isAdmin;

  const [tab, setTab] = useState<'queue' | 'history' | 'catalog'>('queue');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);

  // Order Detail Modal state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrder: LabOrder | null = useMemo(
    () => labOrders.find((o) => o.id === selectedOrderId) ?? null,
    [labOrders, selectedOrderId]
  );

  // Sample / Review / Results / Upload drafts inside Order Detail Modal
  const [sampleIdDraft, setSampleIdDraft] = useState('');
  const [reviewNotesDraft, setReviewNotesDraft] = useState('');
  const [resultRows, setResultRows] = useState<
    Array<{
      parameterName: string;
      value: string;
      unit: string;
      referenceRange: string;
      flag: LabResultFlag;
      notes: string;
    }>
  >([]);
  const [reportTitleDraft, setReportTitleDraft] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  // Create Lab Order Modal
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [newOrderPatientId, setNewOrderPatientId] = useState('');
  const [newOrderDoctorId, setNewOrderDoctorId] = useState(
    authUser?.doctorId ?? ''
  );
  const [newOrderTestId, setNewOrderTestId] = useState('');
  const [newOrderTechId, setNewOrderTechId] = useState('');
  const [newOrderPriority, setNewOrderPriority] =
    useState<LabPriority>('ROUTINE');
  const [newOrderIndication, setNewOrderIndication] = useState('');

  // Create Lab Test Modal
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testCode, setTestCode] = useState('');
  const [testName, setTestName] = useState('');
  const [testCategory, setTestCategory] = useState('Hematology');
  const [testSampleType, setTestSampleType] = useState('Whole Blood');
  const [testUnit, setTestUnit] = useState('');
  const [testRefRange, setTestRefRange] = useState('');
  const [testTurnaround, setTestTurnaround] = useState(24);
  const [testPrice, setTestPrice] = useState(35);

  const openOrderDetail = (order: LabOrder) => {
    setSelectedOrderId(order.id);
    setSampleIdDraft(order.sampleId ?? `SMP-${order.orderNumber.replace('LAB-', '')}`);
    setReviewNotesDraft(order.doctorReviewNotes ?? '');
    setResultRows(
      order.results.length > 0
        ? order.results.map((r) => ({
            parameterName: r.parameterName,
            value: r.value,
            unit: r.unit,
            referenceRange: r.referenceRange,
            flag: r.flag,
            notes: r.notes,
          }))
        : [
            {
              parameterName: order.labTest.name,
              value: '',
              unit: order.labTest.unit,
              referenceRange: order.labTest.referenceRange,
              flag: 'NORMAL',
              notes: '',
            },
          ]
    );
    setReportTitleDraft(`${order.labTest.name} Report`);
    setPdfFile(null);
  };

  const kpis = useMemo(() => {
    const requested = labOrders.filter((o) =>
      ['REQUESTED', 'SAMPLE_COLLECTED'].includes(o.status)
    ).length;
    const processing = labOrders.filter((o) =>
      ['PROCESSING', 'COMPLETED'].includes(o.status)
    ).length;
    const underReview = labOrders.filter((o) => o.status === 'UNDER_REVIEW').length;
    const released = labOrders.filter((o) => o.status === 'RELEASED').length;
    return { requested, processing, underReview, released };
  }, [labOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return labOrders.filter((o) => {
      if (tab === 'history' && !['APPROVED', 'RELEASED'].includes(o.status)) {
        return false;
      }
      if (tab === 'queue' && o.status === 'RELEASED') {
        return false;
      }
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && o.priority !== priorityFilter) return false;
      if (assignedToMeOnly && o.technicianId !== authUser?.id) return false;
      if (q) {
        const hay = [
          o.orderNumber,
          o.patient?.name ?? '',
          o.labTest.name,
          o.labTest.code,
          o.doctor.name,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    labOrders,
    tab,
    statusFilter,
    priorityFilter,
    assignedToMeOnly,
    authUser?.id,
    search,
  ]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderPatientId || !newOrderTestId) return;
    setBusyAction(true);
    try {
      await createLabOrder({
        patientId: newOrderPatientId,
        doctorId: authUser?.doctorId ?? (newOrderDoctorId || undefined),
        labTestId: newOrderTestId,
        technicianId: newOrderTechId || null,
        priority: newOrderPriority,
        clinicalIndication: newOrderIndication.trim(),
      });
      setOrderModalOpen(false);
      setNewOrderIndication('');
    } finally {
      setBusyAction(false);
    }
  };

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction(true);
    try {
      await createLabTest({
        code: testCode,
        name: testName,
        category: testCategory,
        sampleType: testSampleType,
        unit: testUnit,
        referenceRange: testRefRange,
        turnaroundHours: Number(testTurnaround) || 24,
        priceCents: Math.round((Number(testPrice) || 0) * 100),
      });
      setTestModalOpen(false);
      setTestCode('');
      setTestName('');
    } finally {
      setBusyAction(false);
    }
  };

  const handleSaveResults = async () => {
    if (!selectedOrder) return;
    const valid = resultRows.filter(
      (r) => r.parameterName.trim() && r.value.trim()
    );
    if (valid.length === 0) {
      addToast({
        title: 'Enter at least one result value',
        variant: 'warning',
      });
      return;
    }
    setBusyAction(true);
    try {
      await saveLabResults(selectedOrder.id, valid);
    } finally {
      setBusyAction(false);
    }
  };

  const handleUploadPdf = async () => {
    if (!selectedOrder || !pdfFile) return;
    if (
      pdfFile.type !== 'application/pdf' &&
      !pdfFile.name.toLowerCase().endsWith('.pdf')
    ) {
      addToast({
        title: 'Invalid file type',
        description: 'Only PDF documents (.pdf) are allowed.',
        variant: 'error',
      });
      return;
    }
    if (pdfFile.size > 5 * 1024 * 1024) {
      addToast({
        title: 'File exceeds 5 MB limit',
        variant: 'error',
      });
      return;
    }
    setBusyAction(true);
    try {
      await uploadLabReport(
        selectedOrder.id,
        pdfFile,
        reportTitleDraft.trim() || `${selectedOrder.labTest.name} Report`
      );
      setPdfFile(null);
    } finally {
      setBusyAction(false);
    }
  };

  const handleTransition = async (
    targetStatus: Exclude<LabOrderStatus, 'REQUESTED'>
  ) => {
    if (!selectedOrder) return;
    setBusyAction(true);
    try {
      await transitionLabOrder(selectedOrder.id, targetStatus, {
        ...(targetStatus === 'SAMPLE_COLLECTED'
          ? { sampleId: sampleIdDraft.trim() }
          : {}),
        ...(targetStatus === 'APPROVED' || targetStatus === 'PROCESSING'
          ? { doctorReviewNotes: reviewNotesDraft.trim() }
          : {}),
      });
    } finally {
      setBusyAction(false);
    }
  };

  const activePatients = patients.filter((p) => p.status !== 'Archived');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#172B27]">
            Laboratory Management
          </h1>
          <p className="text-xs sm:text-sm text-[#84938D]">
            Diagnostic test catalog, sample collection tracking, results entry, and doctor approval workflow
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageCatalog && (
            <button
              type="button"
              onClick={() => setTestModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#F3F7F4] text-[#172B27] text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add lab test
            </button>
          )}
          {canOrderLab && (
            <button
              type="button"
              onClick={() => {
                setNewOrderPatientId(activePatients[0]?.id ?? '');
                setNewOrderDoctorId(
                  authUser?.doctorId ?? doctors[0]?.id ?? ''
                );
                setNewOrderTestId(labTests[0]?.id ?? '');
                setOrderModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer"
            >
              <FlaskConical className="w-4 h-4" />
              Order lab test
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">Requested & Collected</p>
          <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
            {kpis.requested}
          </p>
          <p className="text-xs text-[#84938D] mt-1">Awaiting lab processing</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">Processing & Entered</p>
          <p className="text-2xl font-semibold text-amber-700 mt-2 tabular-nums">
            {kpis.processing}
          </p>
          <p className="text-xs text-[#84938D] mt-1">Technician work in progress</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">Under Doctor Review</p>
          <p className="text-2xl font-semibold text-[#073C35] mt-2 tabular-nums">
            {kpis.underReview}
          </p>
          <p className="text-xs text-[#84938D] mt-1">Pending physician sign-off</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">Released Reports</p>
          <p className="text-2xl font-semibold text-[#0B6657] mt-2 tabular-nums">
            {kpis.released}
          </p>
          <p className="text-xs text-[#84938D] mt-1">Available in patient portal</p>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-[#F3F7F4] p-1 border border-[#E2EAE5] self-start">
          {(
            [
              { id: 'queue', label: 'Active Queue' },
              { id: 'history', label: 'Approved & Released History' },
              { id: 'catalog', label: `Test Catalog (${labTests.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                tab === t.id
                  ? 'bg-white text-[#073C35] shadow-xs'
                  : 'text-[#84938D] hover:text-[#172B27]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab !== 'catalog' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#84938D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order #, patient, test..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-[#E2EAE5] text-xs text-[#172B27] focus:outline-none focus:border-[#0B6657]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[#E2EAE5] bg-white px-2.5 py-1.5 text-xs text-[#172B27]"
            >
              <option value="all">All statuses</option>
              {PIPELINE_STEPS.map((st) => (
                <option key={st} value={st}>
                  {STATUS_LABELS[st]}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-xl border border-[#E2EAE5] bg-white px-2.5 py-1.5 text-xs text-[#172B27]"
            >
              <option value="all">All priorities</option>
              <option value="ROUTINE">ROUTINE</option>
              <option value="URGENT">URGENT</option>
              <option value="STAT">STAT</option>
            </select>

            {isTech && (
              <label className="inline-flex items-center gap-1.5 text-xs text-[#172B27] px-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignedToMeOnly}
                  onChange={(e) => setAssignedToMeOnly(e.target.checked)}
                  className="accent-[#073C35]"
                />
                Assigned to me
              </label>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      {tab === 'catalog' ? (
        <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2EAE5] bg-[#F3F7F4]/70 text-[11px] font-semibold text-[#84938D] uppercase tracking-wider">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Test Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Sample Type</th>
                  <th className="py-3 px-4">Reference Range</th>
                  <th className="py-3 px-4">Turnaround</th>
                  <th className="py-3 px-4 text-right">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2EAE5] text-xs">
                {labTests.map((t) => (
                  <tr key={t.id} className="hover:bg-[#F3F7F4]/40">
                    <td className="py-3 px-4 font-mono font-semibold text-[#073C35]">
                      {t.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#172B27]">
                      {t.name}
                    </td>
                    <td className="py-3 px-4 text-[#84938D]">{t.category}</td>
                    <td className="py-3 px-4 text-[#172B27]">{t.sampleType}</td>
                    <td className="py-3 px-4 text-[#84938D] tabular-nums">
                      {t.referenceRange || '—'} {t.unit}
                    </td>
                    <td className="py-3 px-4 text-[#172B27] tabular-nums">
                      {t.turnaroundHours}h
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-[#172B27] tabular-nums">
                      ${(t.priceCents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-10 text-center space-y-2">
          <FlaskConical className="w-8 h-8 text-[#84938D] mx-auto" />
          <p className="text-sm font-medium text-[#172B27]">
            No laboratory orders match this view
          </p>
          <p className="text-xs text-[#84938D]">
            {canOrderLab
              ? 'Doctors and administrators can create diagnostic requests using "Order lab test".'
              : 'Orders created by doctors will appear here for specimen collection and processing.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2EAE5] bg-[#F3F7F4]/70 text-[11px] font-semibold text-[#84938D] uppercase tracking-wider">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Test</th>
                  <th className="py-3 px-4">Ordering Doctor</th>
                  <th className="py-3 px-4">Technician</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Workflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2EAE5] text-xs">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#F3F7F4]/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-[#073C35] tabular-nums">
                      {order.orderNumber}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#172B27]">
                      {order.patient?.name ?? 'Patient'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-[#172B27]">
                        {order.labTest.name}
                      </span>
                      <span className="text-[#84938D] ml-1.5 font-mono">
                        ({order.labTest.code})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#84938D]">{order.doctor.name}</td>
                    <td className="py-3 px-4 text-[#172B27]">
                      {order.technician?.name ?? (
                        <span className="text-[#84938D]">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          order.priority === 'STAT'
                            ? 'text-red-700'
                            : order.priority === 'URGENT'
                            ? 'text-amber-700'
                            : 'text-[#84938D]'
                        }`}
                      >
                        {order.priority}
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-semibold ${statusTextColor(order.status)}`}>
                      {STATUS_LABELS[order.status]}
                    </td>
                    <td className="py-3 px-4 text-[#84938D] tabular-nums">
                      {format(new Date(order.createdAt), 'MMM d, HH:mm')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openOrderDetail(order)}
                        className="px-3 py-1.5 rounded-lg bg-[#EAF4EF] hover:bg-[#D8ECE1] text-[#073C35] font-medium cursor-pointer"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Lab Test Modal (DOCTOR / ADMIN) */}
      <Modal
        open={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        title="Order laboratory test"
        subtitle="Creates a tracked diagnostic request for lab processing"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Patient
            </label>
            <select
              required
              value={newOrderPatientId}
              onChange={(e) => setNewOrderPatientId(e.target.value)}
              className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27]"
            >
              <option value="">Select patient...</option>
              {activePatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.email})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Laboratory test
              </label>
              <select
                required
                value={newOrderTestId}
                onChange={(e) => setNewOrderTestId(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27]"
              >
                <option value="">Select test...</option>
                {labTests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Priority
              </label>
              <select
                value={newOrderPriority}
                onChange={(e) =>
                  setNewOrderPriority(e.target.value as LabPriority)
                }
                className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27]"
              >
                <option value="ROUTINE">ROUTINE</option>
                <option value="URGENT">URGENT</option>
                <option value="STAT">STAT</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!authUser?.doctorId && (
              <div>
                <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                  Ordering doctor
                </label>
                <select
                  required
                  value={newOrderDoctorId}
                  onChange={(e) => setNewOrderDoctorId(e.target.value)}
                  className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27]"
                >
                  <option value="">Select doctor...</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Assign technician (optional)
              </label>
              <select
                value={newOrderTechId}
                onChange={(e) => setNewOrderTechId(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] bg-white px-3 py-2 text-sm text-[#172B27]"
              >
                <option value="">Unassigned (lab queue)</option>
                {labTechnicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172B27] mb-1.5">
              Clinical indication / notes
            </label>
            <textarea
              rows={2}
              value={newOrderIndication}
              onChange={(e) => setNewOrderIndication(e.target.value)}
              placeholder="e.g. Routine annual screening or persistent fatigue evaluation"
              className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm text-[#172B27]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E2EAE5]">
            <button
              type="button"
              onClick={() => setOrderModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busyAction}
              className="px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] disabled:opacity-60 text-white text-xs font-medium cursor-pointer"
            >
              Submit lab request
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Lab Test Modal */}
      <Modal
        open={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        title="Add test to laboratory catalog"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreateTest} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Code
              </label>
              <input
                type="text"
                required
                value={testCode}
                onChange={(e) => setTestCode(e.target.value.toUpperCase())}
                placeholder="CRP"
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Test name
              </label>
              <input
                type="text"
                required
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="C-Reactive Protein"
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Category
              </label>
              <input
                type="text"
                required
                value={testCategory}
                onChange={(e) => setTestCategory(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Sample type
              </label>
              <input
                type="text"
                required
                value={testSampleType}
                onChange={(e) => setTestSampleType(e.target.value)}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Unit
              </label>
              <input
                type="text"
                value={testUnit}
                onChange={(e) => setTestUnit(e.target.value)}
                placeholder="mg/L"
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Ref. range
              </label>
              <input
                type="text"
                value={testRefRange}
                onChange={(e) => setTestRefRange(e.target.value)}
                placeholder="< 3.0"
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                TAT (hrs)
              </label>
              <input
                type="number"
                min={1}
                value={testTurnaround}
                onChange={(e) => setTestTurnaround(Number(e.target.value))}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172B27] mb-1.5">
                Fee ($)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={testPrice}
                onChange={(e) => setTestPrice(Number(e.target.value))}
                className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E2EAE5]">
            <button
              type="button"
              onClick={() => setTestModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busyAction}
              className="px-4 py-2 rounded-xl bg-[#073C35] text-white text-xs font-medium cursor-pointer"
            >
              Add test
            </button>
          </div>
        </form>
      </Modal>

      {/* Lab Order Workflow & Results Drawer/Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#073C35]/25 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOrderId(null);
          }}
        >
          <div className="w-full max-w-2xl bg-white h-full border-l border-[#E2EAE5] shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-[#E2EAE5] flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-[#0B6657] font-semibold">
                  {selectedOrder.orderNumber} · {selectedOrder.priority}
                </p>
                <h2 className="text-base font-semibold text-[#172B27]">
                  {selectedOrder.labTest.name} ({selectedOrder.labTest.code})
                </h2>
                <p className="text-xs text-[#84938D]">
                  Patient: {selectedOrder.patient?.name} · Ordered by {selectedOrder.doctor.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                aria-label="Close lab order"
                className="p-2 rounded-xl text-[#84938D] hover:text-[#172B27] hover:bg-[#F3F7F4] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 7-Stage Pipeline Tracker */}
              <div className="bg-[#F3F7F4] rounded-xl p-4 border border-[#E2EAE5] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#172B27]">
                    Current stage: {STATUS_LABELS[selectedOrder.status]}
                  </span>
                  {selectedOrder.sampleId && (
                    <span className="font-mono text-[#0B6657]">
                      Sample {selectedOrder.sampleId}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-7 gap-1 pt-1">
                  {PIPELINE_STEPS.map((step, idx) => {
                    const currentIdx = PIPELINE_STEPS.indexOf(selectedOrder.status);
                    const done = idx <= currentIdx;
                    return (
                      <div key={step} className="space-y-1">
                        <div
                          className={`h-1.5 rounded-full ${
                            done ? 'bg-[#20B875]' : 'bg-[#DDE6E1]'
                          }`}
                        />
                        <p className="text-[10px] text-[#84938D] truncate">
                          {STATUS_LABELS[step]}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedOrder.clinicalIndication && (
                <div className="text-xs bg-white border border-[#E2EAE5] rounded-xl p-3">
                  <span className="font-semibold text-[#84938D]">Clinical indication: </span>
                  <span className="text-[#172B27]">{selectedOrder.clinicalIndication}</span>
                </div>
              )}

              {/* Assignment & Status Transitions */}
              <div className="border border-[#E2EAE5] rounded-2xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#172B27]">
                    <UserCheck className="w-4 h-4 text-[#0B6657]" />
                    Assigned Technician
                  </div>
                  {selectedOrder.status !== 'RELEASED' &&
                  (isTech || isDoctor || isAdmin) ? (
                    <select
                      value={selectedOrder.technicianId ?? ''}
                      onChange={(e) =>
                        assignLabOrder(selectedOrder.id, e.target.value || null)
                      }
                      className="rounded-xl border border-[#E2EAE5] bg-white px-3 py-1.5 text-xs text-[#172B27]"
                    >
                      <option value="">Unassigned</option>
                      {labTechnicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.name} ({tech.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-[#172B27]">
                      {selectedOrder.technician?.name ?? 'Unassigned'}
                    </span>
                  )}
                </div>

                {/* Role-based transition controls */}
                {selectedOrder.status === 'REQUESTED' && canProcessLab && (
                  <div className="pt-3 border-t border-[#E2EAE5] flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={sampleIdDraft}
                      onChange={(e) => setSampleIdDraft(e.target.value)}
                      placeholder="Specimen / Barcode ID"
                      className="flex-1 rounded-xl border border-[#E2EAE5] px-3 py-2 text-xs font-mono"
                    />
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleTransition('SAMPLE_COLLECTED')}
                      className="px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
                    >
                      Mark sample collected
                    </button>
                  </div>
                )}

                {selectedOrder.status === 'SAMPLE_COLLECTED' && canProcessLab && (
                  <div className="pt-3 border-t border-[#E2EAE5] flex justify-end">
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleTransition('PROCESSING')}
                      className="px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
                    >
                      Start processing specimen
                    </button>
                  </div>
                )}

                {selectedOrder.status === 'PROCESSING' && canProcessLab && (
                  <div className="pt-3 border-t border-[#E2EAE5] flex items-center justify-between gap-3">
                    <p className="text-xs text-[#84938D]">
                      Save structured results or attach a PDF report below before completing.
                    </p>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleTransition('COMPLETED')}
                      className="px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium shrink-0 cursor-pointer"
                    >
                      Mark processing completed
                    </button>
                  </div>
                )}

                {selectedOrder.status === 'COMPLETED' &&
                  (canProcessLab || isDoctor) && (
                    <div className="pt-3 border-t border-[#E2EAE5] flex items-center justify-between gap-3">
                      <p className="text-xs text-[#84938D]">
                        Send completed results & report for doctor sign-off.
                      </p>
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() => handleTransition('UNDER_REVIEW')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        Submit for doctor review
                      </button>
                    </div>
                  )}

                {selectedOrder.status === 'UNDER_REVIEW' && (
                  <div className="pt-3 border-t border-[#E2EAE5] space-y-3">
                    <label className="block text-xs font-medium text-[#172B27]">
                      Doctor clinical review notes
                    </label>
                    <textarea
                      rows={2}
                      disabled={!canApproveOrRelease}
                      value={reviewNotesDraft}
                      onChange={(e) => setReviewNotesDraft(e.target.value)}
                      placeholder="Interpretation, follow-up guidance, or re-test rationale..."
                      className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-xs disabled:bg-[#F3F7F4]"
                    />
                    {canApproveOrRelease ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => handleTransition('PROCESSING')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E2EAE5] hover:bg-[#F3F7F4] text-xs font-medium text-[#172B27] cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Return for re-test
                        </button>
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => handleTransition('APPROVED')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve lab results
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-[#84938D]">
                        Waiting for doctor approval. Technicians cannot approve or release reports.
                      </p>
                    )}
                  </div>
                )}

                {selectedOrder.status === 'APPROVED' && (
                  <div className="pt-3 border-t border-[#E2EAE5] flex items-center justify-between gap-3">
                    <p className="text-xs text-[#0B6657] font-medium">
                      Approved by {selectedOrder.approvedBy?.name ?? 'Physician'}. Ready to release to patient portal.
                    </p>
                    {canApproveOrRelease && (
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() => handleTransition('RELEASED')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#20B875] hover:bg-[#199e63] text-[#073C35] text-xs font-semibold cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Release to patient
                      </button>
                    )}
                  </div>
                )}

                {selectedOrder.status === 'RELEASED' && (
                  <div className="pt-3 border-t border-[#E2EAE5] text-xs text-[#0B6657] font-medium">
                    Released to patient portal{' '}
                    {selectedOrder.releasedAt
                      ? `on ${format(new Date(selectedOrder.releasedAt), 'MMM d, yyyy HH:mm')}`
                      : ''}
                    .
                  </div>
                )}
              </div>

              {/* Structured Result Entry */}
              <div className="border border-[#E2EAE5] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#172B27]">
                    Laboratory test results
                  </h3>
                  {canProcessLab &&
                    !['APPROVED', 'RELEASED'].includes(selectedOrder.status) && (
                      <button
                        type="button"
                        onClick={() =>
                          setResultRows((prev) => [
                            ...prev,
                            {
                              parameterName: '',
                              value: '',
                              unit: selectedOrder.labTest.unit,
                              referenceRange: selectedOrder.labTest.referenceRange,
                              flag: 'NORMAL',
                              notes: '',
                            },
                          ])
                        }
                        className="text-xs font-medium text-[#0B6657] hover:underline cursor-pointer"
                      >
                        + Add parameter
                      </button>
                    )}
                </div>

                <div className="space-y-2">
                  {resultRows.map((row, idx) => {
                    const editable =
                      canProcessLab &&
                      !['APPROVED', 'RELEASED'].includes(selectedOrder.status);
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center bg-[#F3F7F4]/60 p-2 rounded-xl border border-[#E2EAE5]"
                      >
                        <input
                          type="text"
                          disabled={!editable}
                          value={row.parameterName}
                          onChange={(e) => {
                            const next = [...resultRows];
                            next[idx] = { ...row, parameterName: e.target.value };
                            setResultRows(next);
                          }}
                          placeholder="Parameter"
                          className="col-span-4 rounded-lg border border-[#E2EAE5] bg-white px-2 py-1.5 text-xs disabled:bg-transparent"
                        />
                        <input
                          type="text"
                          disabled={!editable}
                          value={row.value}
                          onChange={(e) => {
                            const next = [...resultRows];
                            next[idx] = { ...row, value: e.target.value };
                            setResultRows(next);
                          }}
                          placeholder="Value"
                          className="col-span-2 rounded-lg border border-[#E2EAE5] bg-white px-2 py-1.5 text-xs tabular-nums disabled:bg-transparent"
                        />
                        <input
                          type="text"
                          disabled={!editable}
                          value={row.unit}
                          onChange={(e) => {
                            const next = [...resultRows];
                            next[idx] = { ...row, unit: e.target.value };
                            setResultRows(next);
                          }}
                          placeholder="Unit"
                          className="col-span-2 rounded-lg border border-[#E2EAE5] bg-white px-2 py-1.5 text-xs disabled:bg-transparent"
                        />
                        <select
                          disabled={!editable}
                          value={row.flag}
                          onChange={(e) => {
                            const next = [...resultRows];
                            next[idx] = {
                              ...row,
                              flag: e.target.value as LabResultFlag,
                            };
                            setResultRows(next);
                          }}
                          className="col-span-3 rounded-lg border border-[#E2EAE5] bg-white px-2 py-1.5 text-xs"
                        >
                          <option value="NORMAL">NORMAL</option>
                          <option value="LOW">LOW</option>
                          <option value="HIGH">HIGH</option>
                          <option value="CRITICAL">CRITICAL</option>
                        </select>
                        {editable && resultRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setResultRows((prev) => prev.filter((_, i) => i !== idx))
                            }
                            aria-label="Remove parameter"
                            className="col-span-1 text-[#84938D] hover:text-red-600 flex justify-center cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {canProcessLab &&
                  !['APPROVED', 'RELEASED'].includes(selectedOrder.status) && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={handleSaveResults}
                        className="px-3.5 py-1.5 rounded-xl bg-[#073C35] hover:bg-[#0B6657] text-white text-xs font-medium cursor-pointer"
                      >
                        Save results
                      </button>
                    </div>
                  )}
              </div>

              {/* Private PDF Lab Reports */}
              <div className="border border-[#E2EAE5] rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#172B27]">
                  PDF Laboratory Reports (Private Storage)
                </h3>

                {selectedOrder.reports.length === 0 ? (
                  <p className="text-xs text-[#84938D]">
                    No PDF report uploaded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E2EAE5] border border-[#E2EAE5] rounded-xl overflow-hidden">
                    {selectedOrder.reports.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-3 bg-white flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[#172B27] truncate">
                            {rep.title}
                          </p>
                          <p className="text-[11px] text-[#84938D] tabular-nums">
                            {rep.originalFileName} · {(rep.fileSize / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            downloadLabReport(rep.id, rep.originalFileName)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2EAE5] hover:bg-[#EAF4EF] text-[#073C35] font-medium cursor-pointer shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PDF
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {canProcessLab &&
                  !['APPROVED', 'RELEASED'].includes(selectedOrder.status) && (
                    <div className="pt-3 border-t border-[#E2EAE5] space-y-2.5">
                      <input
                        type="text"
                        value={reportTitleDraft}
                        onChange={(e) => setReportTitleDraft(e.target.value)}
                        placeholder="Report title"
                        className="w-full rounded-xl border border-[#E2EAE5] px-3 py-2 text-xs"
                      />
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          onChange={(e) =>
                            setPdfFile(e.target.files?.[0] ?? null)
                          }
                          className="flex-1 text-xs text-[#84938D] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[#E2EAE5] file:text-xs file:font-medium file:bg-[#F3F7F4] file:text-[#172B27]"
                        />
                        <button
                          type="button"
                          disabled={!pdfFile || busyAction}
                          onClick={handleUploadPdf}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#073C35] hover:bg-[#0B6657] disabled:opacity-50 text-white text-xs font-medium cursor-pointer shrink-0"
                        >
                          <FileUp className="w-3.5 h-3.5" />
                          Upload PDF (max 5MB)
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
