import { useMemo, useState } from 'react';
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

type DateRange = '7d' | '30d' | '90d';

export function ReportsPage() {
  const { appointments, doctors, patients, campaigns, addToast } = useClinic();
  const [range, setRange] = useState<DateRange>('30d');

  const multiplier = range === '7d' ? 1 : range === '30d' ? 4 : 11;

  const visitTrendData = useMemo(
    () => [
      { day: 'Mon', Completed: 18 * multiplier, NoShow: 1 * multiplier },
      { day: 'Tue', Completed: 22 * multiplier, NoShow: 1 * multiplier },
      { day: 'Wed', Completed: 20 * multiplier, NoShow: 2 * multiplier },
      { day: 'Thu', Completed: 24 * multiplier, NoShow: 1 * multiplier },
      { day: 'Fri', Completed: 19 * multiplier, NoShow: 1 * multiplier },
      { day: 'Sat', Completed: 10 * multiplier, NoShow: 0 },
    ],
    [multiplier]
  );

  const doctorPerformance = useMemo(() => {
    return doctors.map((doc) => {
      const docApts = appointments.filter((a) => a.doctorId === doc.id);
      const seenCount = docApts.filter((a) => a.status === 'seen').length;
      return {
        id: doc.id,
        name: doc.name,
        specialty: doc.specialty,
        visits: docApts.length * multiplier,
        seen: seenCount * multiplier,
        utilization: Math.min(96, Math.round((docApts.length / doc.dailyCapacity) * 100) + 55),
      };
    });
  }, [doctors, appointments, multiplier]);

  const handleExportCsv = () => {
    const rows = [
      ['Doctor', 'Specialty', 'Total Visits', 'Completed Visits', 'Utilization %'],
      ...doctorPerformance.map((d) => [
        d.name,
        d.specialty,
        String(d.visits),
        String(d.seen),
        `${d.utilization}%`,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `northfield_clinic_report_${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast({
      title: 'Report exported',
      description: `Downloaded northfield_clinic_report_${range}.csv`,
      variant: 'success',
    });
  };

  const totalCampaignBookings = campaigns.reduce((s, c) => s + c.bookingsCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#172B27]">
            Reports & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-[#84938D]">
            Clinical throughput, provider utilization, and WhatsApp outreach ROI
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-[#E2EAE5]">
            {([
              { id: '7d', label: '7 days' },
              { id: '30d', label: '30 days' },
              { id: '90d', label: 'Quarter' },
            ] as { id: DateRange; label: string }[]).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRange(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  range === item.id
                    ? 'bg-[#073C35] text-white'
                    : 'text-[#84938D] hover:text-[#172B27]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#EAF4EF] text-xs font-medium text-[#073C35] cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">Total patient visits</p>
          <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
            {visitTrendData.reduce((s, d) => s + d.Completed, 0)}
          </p>
          <p className="text-xs text-[#0B6657] mt-1">+8.4% vs prior period</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">Active patient panel</p>
          <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
            {patients.filter((p) => p.status !== 'Archived').length}
          </p>
          <p className="text-xs text-[#84938D] mt-1">Across 4 family physicians</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">Avg WhatsApp response</p>
          <p className="text-2xl font-semibold text-[#172B27] mt-2 tabular-nums">
            4m 12s
          </p>
          <p className="text-xs text-[#0B6657] mt-1">96% within SLA</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
          <p className="text-xs font-medium text-[#84938D]">Outreach conversions</p>
          <p className="text-2xl font-semibold text-[#0B6657] mt-2 tabular-nums">
            {totalCampaignBookings}
          </p>
          <p className="text-xs text-[#84938D] mt-1">Booked from campaigns</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5">
          <h2 className="text-sm font-semibold text-[#172B27]">
            Visit completion vs no-shows
          </h2>
          <p className="text-xs text-[#84938D] mb-4">
            Daily clinic throughput by weekday
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visitTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2EAE5" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: '#84938D' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
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
                  dataKey="Completed"
                  stroke="#0B6657"
                  fill="#EAF4EF"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="NoShow"
                  stroke="#D97706"
                  fill="#FEF3C7"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5">
          <h2 className="text-sm font-semibold text-[#172B27]">
            Provider schedule utilization
          </h2>
          <p className="text-xs text-[#84938D] mb-4">
            Booked capacity percentage per physician
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={doctorPerformance} layout="vertical" margin={{ left: 16 }}>
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
            Provider activity summary
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2EAE5] bg-[#F3F7F4]/60 text-[11px] font-semibold text-[#84938D]">
                <th className="py-3 px-5">Provider</th>
                <th className="py-3 px-5">Specialty</th>
                <th className="py-3 px-5 text-right">Scheduled visits</th>
                <th className="py-3 px-5 text-right">Completed</th>
                <th className="py-3 px-5 text-right">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2EAE5] text-xs">
              {doctorPerformance.map((doc) => (
                <tr key={doc.id} className="hover:bg-[#F3F7F4]/50">
                  <td className="py-3 px-5 font-semibold text-[#172B27]">
                    {doc.name}
                  </td>
                  <td className="py-3 px-5 text-[#84938D]">{doc.specialty}</td>
                  <td className="py-3 px-5 text-right tabular-nums text-[#172B27]">
                    {doc.visits}
                  </td>
                  <td className="py-3 px-5 text-right tabular-nums text-[#172B27]">
                    {doc.seen}
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
