import { createContext, useContext } from 'react';

export interface EmbedContextValue {
  /** The full-app link for the current view, never the chrome-less embed URL. */
  shareUrl: () => string;
  /** Opens the embed snippet dialog; absent inside an embed. */
  onEmbed?: () => void;
}

export const EmbedContext = createContext<EmbedContextValue>({ shareUrl: () => window.location.href });

export function useEmbed(): EmbedContextValue {
  return useContext(EmbedContext);
}
