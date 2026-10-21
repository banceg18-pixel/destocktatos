import type { SVGProps } from "react";

/** Icônes au trait fin (1,4 px), dessinées pour le design system ; `currentColor` partout. */
type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 18): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export const IconSearch = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </svg>
);
export const IconUser = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.5 20.5c1.2-3.6 4.1-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
  </svg>
);
export const IconBag = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4.5 8.5h15l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.2a1.5 1.5 0 0 1-1.5-1.3z" />
    <path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3" />
  </svg>
);
export const IconMenu = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M3.5 8.5h17M3.5 15.5h17" />
  </svg>
);
export const IconPause = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M9 6v12M15 6v12" />
  </svg>
);
export const IconPlay = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M8 5.5v13l10.5-6.5z" />
  </svg>
);
export const IconClose = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="m5.5 5.5 13 13M18.5 5.5l-13 13" />
  </svg>
);
export const IconTruck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3.2v2.8h-7" />
    <circle cx="6.5" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </svg>
);
export const IconWrench = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M14.7 6.3a4 4 0 0 0-5.3 5.3l-6 6a1.7 1.7 0 0 0 2.4 2.4l6-6a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.4-.6-.6-2.4z" />
  </svg>
);
export const IconShield = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z" />
    <path d="m8.8 12 2.2 2.2 4.2-4.4" />
  </svg>
);
export const IconRecycle = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M7 8.5 9.8 4a1.4 1.4 0 0 1 2.4 0l1.7 2.8M16.6 10.3l2.6 4.4a1.4 1.4 0 0 1-1.2 2.1h-3.2M10.4 16.8H5.9a1.4 1.4 0 0 1-1.2-2.1l1.6-2.7" />
    <path d="m13.5 4.8.4 2-2 .4M17.2 18.9l-2.4-2.1 2-1.8M4.8 13.4l1.5-1.4 1.6 1.8" />
  </svg>
);
export const IconStore = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 9.5V20h16V9.5M3 9.5 5 4h14l2 5.5a2.6 2.6 0 0 1-4.5 1.6 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5 0A2.6 2.6 0 0 1 3 9.5z" />
    <path d="M10 20v-5h4v5" />
  </svg>
);
export const IconLock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
    <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
  </svg>
);
export const IconPhone = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6.6 3.5h2.6l1.4 4-2 1.3a10.5 10.5 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a1.6 1.6 0 0 1-1.7 1.6C10.4 18.5 5.5 13.6 5 5.2a1.6 1.6 0 0 1 1.6-1.7z" />
  </svg>
);
export const IconMail = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
    <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
  </svg>
);
export const IconPin = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);
export const IconClock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const IconChevron = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </svg>
);
export const IconFilter = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </svg>
);
export const IconMinus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 12h14" />
  </svg>
);
export const IconPlus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconAlert = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5.5M12 16.2v.3" />
  </svg>
);
export const IconTrash = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5L17.5 7" />
  </svg>
);
export const IconZap = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" />
  </svg>
);
export const IconChat = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M20.5 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 20.5 12z" />
    <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth={2.2} />
  </svg>
);
export const IconSend = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 12 20.5 4l-5.5 16.5-3.2-7.3z" />
    <path d="m11.8 13.2 8.7-9.2" />
  </svg>
);
