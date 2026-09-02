// Opens the app-wide command palette (used by the Header search box).
export function openCommandPalette(): void {
  window.dispatchEvent(new CustomEvent('localflow:open-command'))
}

export const OPEN_COMMAND_EVENT = 'localflow:open-command'