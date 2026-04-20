import { useState } from 'react';
import { useChannels } from '../context/ChannelContext';
import { useAuth } from '../context/AuthContext';

interface NewChannelModalProps {
  onClose: () => void;
}

export default function NewChannelModal({ onClose }: NewChannelModalProps) {
  const { user } = useAuth();
  const { createChannel, setActiveChannel } = useChannels();

  const [mode, setMode]     = useState<'dm' | 'group'>('dm');
  const [name, setName]     = useState('');
  const [memberId, setMemberId] = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setError('');
    if (mode === 'dm' && !memberId.trim()) {
      setError('Enter a user ID to message');
      return;
    }
    if (mode === 'group' && !name.trim()) {
      setError('Group name is required');
      return;
    }

    setLoading(true);
    try {
      const members = mode === 'dm'
        ? [user!.user_id, memberId.trim()]
        : [user!.user_id];

      const ch = await createChannel(
        mode === 'group' ? name.trim() : '',
        members,
      );
      setActiveChannel(ch);
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-channel-title">
        <div className="modal__header">
          <h2 className="modal__title" id="new-channel-title">New Conversation</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['dm', 'group'] as const).map(m => (
            <button
              key={m}
              className={`btn ${mode === m ? 'btn--primary' : 'btn--ghost'}`}
              style={{ flex: 1, height: 36 }}
              onClick={() => setMode(m)}
              id={`mode-tab-${m}`}
            >
              {m === 'dm' ? '💬 Direct Message' : '👥 Group'}
            </button>
          ))}
        </div>

        {mode === 'dm' && (
          <div className="form-group">
            <label className="form-label" htmlFor="dm-user-id">User ID</label>
            <input
              id="dm-user-id"
              className="form-input"
              placeholder="Paste user ID…"
              value={memberId}
              onChange={e => setMemberId(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {mode === 'group' && (
          <div className="form-group">
            <label className="form-label" htmlFor="group-name">Group Name</label>
            <input
              id="group-name"
              className="form-input"
              placeholder="e.g. Design Team"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {error && <div className="alert alert--error">{error}</div>}

        <button
          id="create-channel-submit"
          className="btn btn--primary"
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Create'}
        </button>
      </div>
    </div>
  );
}
