// Line icons of the menu, drawn with currentColor so they follow the link's color in every state.
import type { NavigationItem } from './navigation.js';

const ICON_PATHS: Record<NavigationItem['icon'], string> = {
  /** Inbox tray: requests that arrive and wait for a decision. */
  inbox: 'M4 13h4l2 3h4l2-3h4M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5',
};

export function NavigationIcon({ icon }: { icon: NavigationItem['icon'] }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={ICON_PATHS[icon]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
