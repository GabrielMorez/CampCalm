import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'mountain' | 'map' | 'calendar' | 'search' | 'tent' | 'arrow'
  | 'compass' | 'shield' | 'heart' | 'user' | 'check' | 'refresh'
  | 'close' | 'sun' | 'pin' | 'clock' | 'leaf' | 'plus' | 'logout';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export default function Icon({ name, size = 20, ...props }: IconProps) {
  const content: Record<IconName, ReactNode> = {
    mountain: <><path d="M2.7 19.2 10 6.4l4.1 7.1 2.3-3.8 5 9.5H2.7Z"/><path d="m7.1 11.6 2.9 2 2.7-1.5"/></>,
    map: <><path d="m3 6.4 6-2.4 6 2.4 6-2.4v13.6L15 20l-6-2.4L3 20V6.4Z"/><path d="M9 4v13.6M15 6.4V20"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5"/></>,
    tent: <><path d="M3 20 12 4l9 16H3Z"/><path d="m12 4 4.4 16M9 20l3.4-6.1 3.4 6.1"/></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m15.4 8.6-2.6 6-4.3 1.8 2.6-6 4.3-1.8Z"/></>,
    shield: <><path d="M12 22c5.7-2.5 8-6.2 8-10.6V5.5L12 2 4 5.5v5.9C4 15.8 6.3 19.5 12 22Z"/><path d="m8.5 12 2.4 2.5 4.8-5"/></>,
    heart: <path d="M20.8 8.7c0 4.4-8.8 10.6-8.8 10.6S3.2 13.1 3.2 8.7c0-4.2 5.2-6.4 8.8-2.2 3.6-4.2 8.8-2 8.8 2.2Z"/>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4.7 21v-2.1c0-3.8 3.3-6.3 7.3-6.3s7.3 2.5 7.3 6.3V21"/></>,
    check: <path d="m4.5 12 5 5L20 6.5"/>,
    refresh: <><path d="M20.3 7.5A8.5 8.5 0 0 0 5.5 6L3 8.5"/><path d="M3 3.5v5h5"/><path d="M3.7 16.5A8.5 8.5 0 0 0 18.5 18l2.5-2.5"/><path d="M21 20.5v-5h-5"/></>,
    close: <path d="M5 5 19 19M19 5 5 19"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5m0-14.2-1.5 1.5M6.4 17.6l-1.5 1.5"/></>,
    pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    leaf: <><path d="M20.5 3.5C11 3 4 7.5 4 14.5a6 6 0 0 0 6 6c7 0 11.5-7 10.5-17Z"/><path d="M4 20c3-6 7-10 13-13"/></>,
    plus: <path d="M12 4v16M4 12h16"/>,
    logout: <><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M12 12h9m-4-4 4 4-4 4"/></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {content[name]}
    </svg>
  );
}
