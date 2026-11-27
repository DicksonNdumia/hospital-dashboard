import { format } from 'date-fns';
import { prisma } from './db.ts';

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function intervalsOverlap(
  startA: number,
  durA: number,
  startB: number,
  durB: number
): boolean {
  const endA = startA + durA;
  const endB = startB + durB;
  return startA < endB && startB < endA;
}

export async function validateSchedulingRules(params: {
  excludeAppointmentId?: string;
  doctorId: string;
  patientId: string;
  date: string;
  time: string;
  durationMinutes: number;
  status: string;
}): Promise<string | null> {
  // Cancelled appointments do not occupy slots
  if (params.status === 'CANCELLED') return null;

  const doctor = await prisma.doctor.findUnique({
    where: { id: params.doctorId },
    include: { schedules: true },
  });
  if (!doctor) return 'Selected doctor does not exist.';

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  if (params.date === todayStr && !doctor.availableToday) {
    return `${doctor.name} is currently marked off-duty today.`;
  }

  const targetDate = new Date(`${params.date}T12:00:00`);
  const dayOfWeek = targetDate.getDay();
  const daySchedule = doctor.schedules.find((s) => s.dayOfWeek === dayOfWeek);
  const startMin = timeToMinutes(params.time);
  const endMin = startMin + params.durationMinutes;

  if (daySchedule) {
    if (!daySchedule.isActive) {
      return `${doctor.name} is not scheduled to work on that day.`;
    }
    const schedStart = timeToMinutes(daySchedule.startTime);
    const schedEnd = timeToMinutes(daySchedule.endTime);
    if (startMin < schedStart || endMin > schedEnd) {
      return `${doctor.name} is available ${daySchedule.startTime}–${daySchedule.endTime} on that day.`;
    }
  } else if (dayOfWeek === 0) {
    return `${doctor.name} is not scheduled to work on Sundays.`;
  }

  // Check doctor overlapping active appointments
  const doctorSameDay = await prisma.appointment.findMany({
    where: {
      doctorId: params.doctorId,
      date: params.date,
      status: { not: 'CANCELLED' },
      ...(params.excludeAppointmentId
        ? { id: { not: params.excludeAppointmentId } }
        : {}),
    },
  });

  for (const existing of doctorSameDay) {
    if (
      intervalsOverlap(
        startMin,
        params.durationMinutes,
        timeToMinutes(existing.time),
        existing.durationMinutes
      )
    ) {
      return `Schedule conflict: ${doctor.name} already has an appointment at ${existing.time}.`;
    }
  }

  // Check patient overlapping active appointments
  const patientSameDay = await prisma.appointment.findMany({
    where: {
      patientId: params.patientId,
      date: params.date,
      status: { not: 'CANCELLED' },
      ...(params.excludeAppointmentId
        ? { id: { not: params.excludeAppointmentId } }
        : {}),
    },
  });

  for (const existing of patientSameDay) {
    if (
      intervalsOverlap(
        startMin,
        params.durationMinutes,
        timeToMinutes(existing.time),
        existing.durationMinutes
      )
    ) {
      return `Patient already has an active overlapping appointment at ${existing.time}.`;
    }
  }

  return null;
}

export async function getAvailableDoctorSlots(params: {
  doctorId: string;
  patientId?: string;
  date: string;
  durationMinutes?: number;
}): Promise<{ availableSlots: string[]; reason?: string }> {
  const duration = params.durationMinutes ?? 30;
  const doctor = await prisma.doctor.findUnique({
    where: { id: params.doctorId },
    include: { schedules: true },
  });
  if (!doctor) {
    return { availableSlots: [], reason: 'Doctor not found.' };
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  if (params.date === todayStr && !doctor.availableToday) {
    return { availableSlots: [], reason: `${doctor.name} is off duty today.` };
  }

  const targetDate = new Date(`${params.date}T12:00:00`);
  const dayOfWeek = targetDate.getDay();
  const daySchedule = doctor.schedules.find((s) => s.dayOfWeek === dayOfWeek);

  if (daySchedule && !daySchedule.isActive) {
    return { availableSlots: [], reason: `${doctor.name} is not scheduled on this day.` };
  }
  if (!daySchedule && dayOfWeek === 0) {
    return { availableSlots: [], reason: 'Clinic is closed on Sundays.' };
  }

  const schedStart = daySchedule ? timeToMinutes(daySchedule.startTime) : 8 * 60 + 30;
  const schedEnd = daySchedule ? timeToMinutes(daySchedule.endTime) : 17 * 60;

  const [doctorBookings, patientBookings] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        doctorId: params.doctorId,
        date: params.date,
        status: { not: 'CANCELLED' },
      },
      select: { time: true, durationMinutes: true },
    }),
    params.patientId
      ? prisma.appointment.findMany({
          where: {
            patientId: params.patientId,
            date: params.date,
            status: { not: 'CANCELLED' },
          },
          select: { time: true, durationMinutes: true },
        })
      : Promise.resolve([]),
  ]);

  const busyIntervals = [...doctorBookings, ...patientBookings].map((b) => ({
    start: timeToMinutes(b.time),
    duration: b.durationMinutes,
  }));

  const slots: string[] = [];
  for (let t = schedStart; t + duration <= schedEnd; t += 30) {
    const conflicts = busyIntervals.some((b) =>
      intervalsOverlap(t, duration, b.start, b.duration)
    );
    if (!conflicts) {
      slots.push(minutesToTime(t));
    }
  }

  return { availableSlots: slots };
}
