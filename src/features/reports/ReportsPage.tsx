import { Download } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useClinic } from '../../context/ClinicContext';

export function ReportsPage() {
  const { analytics, addToast } = useClinic();

  const trends = analytics?.appointmentTrends ?? [];
  const workload = analytics?.doctorWorkload ?? [];

  const handleExportCsv = () => {
    const rows = [
      ['Doctor', 'Specialty', 'Total Visits', 'Today Visits', 'Completed Visits', 'Utilization %'],
      ...workload.map((d) => [
        d.name,
        d.specialty,
        String(d.totalVisits),
        String(d.todayVisits),
        String(d.completedVisits),
        `${d.utilization}%`,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'northfield_clinic_analytics.csv';
    link.click();
    URL.revokeObjectURL(url);
    addToast({
      title: 'Report exported',
      description: 'Downloaded northfield_clinic_analytics.csv',
      variant: 'success',
    });
  };

  const totalWeekScheduled = trends.reduce((s, d) => s + d.Scheduled, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#172B27]">
            Reports & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-[#84938D]">
            Live database metrics for clinical throughput, waiting times, and doctor workload
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#EAF4EF] text-xs font-medium text-[#073C35] self-start sm:self-auto cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">
            This week’s visits
          </p>
          <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
            {totalWeekScheduled}
          </p>
          <p className="text-xs text-[#0B6657] mt-1">
            {analytics?.completedAppointmentsToday ?? 0} completed today
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">
            Registered patients
          </p>
          <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
            {analytics?.totalRegisteredPatients ?? 0}
          </p>
          <p className="text-xs text-[#84938D] mt-1">Active patient records</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">
            Average waiting time
          </p>
          <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
            {analytics?.averageWaitMinutes ?? 0} min
          </p>
          <p className="text-xs text-[#0B6657] mt-1">
            Calculated from visit timestamps
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">Campaign bookings</p>
          <p className="text-2xl font-semibold text-[#0B6657] mt-2 tabular-nums">
            {analytics?.campaignBookings ?? 0}
          </p>
          <p className="text-xs text-[#84938D] mt-1">
            Today no-show rate: {analytics?.noShowRate ?? 0}%
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5">
          <h2 className="text-sm font-semibold text-[#172B27]">
            Weekly appointment trends
          </h2>
          <p className="text-xs text-[#84938D] mb-4">
            Scheduled vs completed visits across Monday–Saturday
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2EAE5" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: '#84938D' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#84938D' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #E2EAE5',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Scheduled"
                  stroke="#0B6657"
                  fill="#EAF4EF"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Completed"
                  stroke="#20B875"
                  fill="#D4F0E2"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5">
          <h2 className="text-sm font-semibold text-[#172B27]">
            Doctor workload & utilization
          </h2>
          <p className="text-xs text-[#84938D] mb-4">
            Today’s booked percentage of daily capacity
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workload} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2EAE5" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: '#84938D' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={120}
                  tick={{ fontSize: 12, fill: '#172B27' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #E2EAE5',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="utilization" fill="#20B875" radius={[0, 6, 6, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Provider Breakdown Table */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2EAE5]">
          <h2 className="text-sm font-semibold text-[#172B27]">
            Provider workload summary
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2EAE5] bg-[#F3F7F4]/60 text-[11px] font-semibold text-[#84938D]">
                <th className="py-3 px-5">Provider</th>
                <th className="py-3 px-5">Specialty</th>
                <th className="py-3 px-5 text-right">Today visits</th>
                <th className="py-3 px-5 text-right">Total visits</th>
                <th className="py-3 px-5 text-right">Completed</th>
                <th className="py-3 px-5 text-right">Today utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2EAE5] text-xs">
              {workload.map((doc) => (
                <tr key={doc.id} className="hover:bg-[#F3F7F4]/50">
                  <td className="py-3 px-5 font-semibold text-[#172B27]">
                    {doc.name}
                  </td>
                  <td className="py-3 px-5 text-[#84938D]">{doc.specialty}</td>
                  <td className="py-3 px-5 text-right tabular-nums text-[#172B27]">
                    {doc.todayVisits} / {doc.dailyCapacity}
                  </td>
                  <td className="py-3 px-5 text-right tabular-nums text-[#172B27]">
                    {doc.totalVisits}
                  </td>
                  <td className="py-3 px-5 text-right tabular-nums text-[#172B27]">
                    {doc.completedVisits}
                  </td>
                  <td className="py-3 px-5 text-right tabular-nums font-semibold text-[#0B6657]">
                    {doc.utilization}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
