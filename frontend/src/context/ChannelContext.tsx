// Context: Channel list and active channel
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiListChannels, apiCreateChannel, type Channel } from '../api/client';
import { onWS } from '../ws';
import { useAuth } from './AuthContext';

interface ChannelContextValue {
  channels: Channel[];
  activeChannel: Channel | null;
  setActiveChannel(ch: Channel): void;
  createChannel(name: string, members: string[]): Promise<Channel>;
  refreshChannels(): Promise<void>;
  isLoading: boolean;
}

const ChannelContext = createContext<ChannelContextValue | null>(null);

export function ChannelProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [channels, setChannels]           = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [isLoading, setLoading]           = useState(false);

  const refreshChannels = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await apiListChannels();
      setChannels(list);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load when user logs in.
  useEffect(() => {
    refreshChannels();
  }, [refreshChannels]);

  // Reload channel list when we receive a new channel_key (means we joined a new channel).
  useEffect(() => {
    return onWS('channel_key', () => {
      refreshChannels();
    });
  }, [refreshChannels]);

  const createChannel = useCallback(async (name: string, members: string[]) => {
    const ch = await apiCreateChannel(name, members);
    setChannels(prev => [ch, ...prev]);
    return ch;
  }, []);

  return (
    <ChannelContext.Provider value={{
      channels,
      activeChannel,
      setActiveChannel,
      createChannel,
      refreshChannels,
      isLoading,
    }}>
      {children}
    </ChannelContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChannels() {
  const ctx = useContext(ChannelContext);
  if (!ctx) throw new Error('useChannels must be used within ChannelProvider');
  return ctx;
}

/** Derives the display name for a channel:
 *  - DM (2 members): show the OTHER user's username
 *  - Group (3+ members): show the channel name
 */
export function getChannelDisplayName(ch: Channel, currentUserId: string): string {
  if (ch.members.length === 2) {
    return ch.members.find(m => m !== currentUserId) ?? ch.name;
  }
  return ch.name || `Group (${ch.members.length})`;
}
