import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChannels, getChannelDisplayName } from '../context/ChannelContext';
import { Avatar } from './Avatar';
import NewChannelModal from './NewChannelModal';
import type { Channel } from '../api/client';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { channels, activeChannel, setActiveChannel, isLoading } = useChannels();
  const [search, setSearch]         = useState('');
  const [showNewChannel, setShowNew] = useState(false);

  const filtered = channels.filter(ch => {
    const display = getChannelDisplayName(ch, user?.user_id ?? '');
    return display.toLowerCase().includes(search.toLowerCase());
  });

  const dmChannels    = filtered.filter(ch => ch.members.length === 2);
  const groupChannels = filtered.filter(ch => ch.members.length !== 2);

  const renderChannel = (ch: Channel) => {
    const display = getChannelDisplayName(ch, user?.user_id ?? '');
    const isActive = activeChannel?.id === ch.id;

    return (
      <div
        key={ch.id}
        className={`channel-item ${isActive ? 'active' : ''}`}
        onClick={() => setActiveChannel(ch)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setActiveChannel(ch)}
        aria-current={isActive ? 'page' : undefined}
        id={`channel-item-${ch.id}`}
      >
        <div className="channel-item__avatar">
          <Avatar userId={ch.id} size={36} />
        </div>
        <div className="channel-item__info">
          <div className="channel-item__name">{display}</div>
          <div className="channel-item__preview">
            {ch.members.length === 2 ? 'Direct message' : `${ch.members.length} members`}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <aside className="sidebar" aria-label="Channel list">
        {/* Header */}
        <div className="sidebar__header">
          <div className="sidebar__logo">N</div>
          <span className="sidebar__title">NodeTalk</span>
          <button
            id="new-channel-btn"
            className="icon-btn"
            style={{ marginInlineStart: 'auto' }}
            onClick={() => setShowNew(true)}
            title="New channel or DM"
            aria-label="Create new channel"
          >
            ✏️
          </button>
        </div>

        {/* Search */}
        <div className="sidebar__search">
          <input
            id="sidebar-search"
            type="search"
            placeholder="Search conversations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search conversations"
          />
        </div>

        {/* Channels list */}
        <div className="sidebar__channels">
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
              <span className="spinner" />
            </div>
          )}

          {!isLoading && groupChannels.length > 0 && (
            <>
              <div className="sidebar__section-label">Groups</div>
              {groupChannels.map(renderChannel)}
            </>
          )}

          {!isLoading && dmChannels.length > 0 && (
            <>
              <div className="sidebar__section-label">Direct Messages</div>
              {dmChannels.map(renderChannel)}
            </>
          )}

          {!isLoading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              {search ? 'No matches' : 'No conversations yet.\nClick ✏️ to start one.'}
            </div>
          )}
        </div>

        {/* Footer: current user */}
        <div className="sidebar__footer">
          <div className="sidebar__footer-avatar">
            <Avatar userId={user?.user_id ?? ''} size={34} />
          </div>
          <div className="sidebar__footer-info">
            <div className="sidebar__footer-name">{user?.username}</div>
            <div className="sidebar__footer-status">● Online</div>
          </div>
          <button
            id="logout-btn"
            className="icon-btn"
            onClick={logout}
            title="Log out"
            aria-label="Log out"
          >
            ↩
          </button>
        </div>
      </aside>

      {showNewChannel && (
        <NewChannelModal onClose={() => setShowNew(false)} />
      )}
    </>
  );
}
