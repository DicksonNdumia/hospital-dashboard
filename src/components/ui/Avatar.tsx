import { useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string;
  bgColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-7 h-7 text-[11px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
};

export function Avatar({
  name,
  src,
  bgColor = '#EAF4EF',
  size = 'md',
  className = '',
}: AvatarProps) {
  const [failed, setFailed] = useState(false);

  const initials = name
    .replace(/^Dr\.\s+/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${SIZE_MAP[size]} rounded-full object-cover shrink-0 border border-[#E2EAE5] ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      style={{ backgroundColor: bgColor }}
      className={`${SIZE_MAP[size]} rounded-full flex items-center justify-center font-semibold text-[#073C35] shrink-0 border border-[#E2EAE5]/80 select-none ${className}`}
    >
      {initials || 'P'}
    </div>
  );
}
