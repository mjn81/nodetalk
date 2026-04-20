import { useChannels } from '../context/ChannelContext';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';

export default function AppPage() {
  const { activeChannel } = useChannels();

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="chat-area" style={{ minWidth: 0 }}>
        {activeChannel ? (
          <ChatArea channel={activeChannel} />
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon">💬</div>
            <h1 className="empty-state__title">Welcome to NodeTalk</h1>
            <p className="empty-state__desc">
              Select a conversation on the left, or click <strong>✏️</strong> to start a new one.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
