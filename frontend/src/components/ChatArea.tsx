import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiListMessages, type Message, type Channel } from '../api/client';
import { onWS, wsSendMessage, decryptMessage } from '../ws';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';
import EmojiPicker from './EmojiPicker';
import VoiceRecorder from './VoiceRecorder';

interface ChatAreaProps {
  channel: Channel;
}

interface DecryptedMessage extends Message {
  text?: string;
}

// Group consecutive messages from the same sender
function isGrouped(prev: DecryptedMessage | undefined, curr: DecryptedMessage): boolean {
  if (!prev) return false;
  return (
    prev.sender_id === curr.sender_id &&
    new Date(curr.sent_at).getTime() - new Date(prev.sent_at).getTime() < 120_000
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function ChatArea({ channel }: ChatAreaProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [inputText, setInputText]   = useState('');
  const [sending, setSending]       = useState(false);
  const [showEmoji, setShowEmoji]   = useState(false);
  const feedRef    = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }
    });
  }, []);

  // Decrypt and set a message
  const addMessage = useCallback(async (msg: Message) => {
    const text = msg.type === 'text' ? await decryptMessage(msg) : undefined;
    setMessages(prev => [...prev, { ...msg, text }]);
    scrollToBottom();
  }, [scrollToBottom]);

  // Load history on channel switch
  useEffect(() => {
    setMessages([]);
    apiListMessages(channel.id, 50).then(async (msgs) => {
      const decrypted = await Promise.all(
        msgs.reverse().map(async m => ({
          ...m,
          text: m.type === 'text' ? await decryptMessage(m) : undefined,
        }))
      );
      setMessages(decrypted);
      scrollToBottom();
    });
  }, [channel.id, scrollToBottom]);

  // Subscribe to incoming messages for this channel
  useEffect(() => {
    return onWS('message', (payload) => {
      const msg = payload as Message;
      if (msg.channel_id === channel.id) {
        addMessage(msg);
      }
    });
  }, [channel.id, addMessage]);

  // Send text message
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    setInputText('');
    await wsSendMessage(channel.id, text, 'text');
    setSending(false);
    inputRef.current?.focus();
  }, [inputText, sending, channel.id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    setInputText(prev => prev + emoji.native);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  // Group messages and inject date separators
  const rendered: Array<{ type: 'date'; label: string } | { type: 'msg'; msg: DecryptedMessage; grouped: boolean }> = [];
  let lastDate = '';
  messages.forEach((msg, i) => {
    const dateLabel = formatDate(msg.sent_at);
    if (dateLabel !== lastDate) {
      rendered.push({ type: 'date', label: dateLabel });
      lastDate = dateLabel;
    }
    const grouped = isGrouped(messages[i - 1], msg);
    rendered.push({ type: 'msg', msg, grouped });
  });

  return (
    <div className="chat-area">
      {/* Topbar */}
      <div className="chat-topbar">
        <div className="chat-topbar__avatar">
          <Avatar userId={channel.id} size={36} />
        </div>
        <div>
          <div className="chat-topbar__name">{channel.name || channel.id}</div>
          <div className="chat-topbar__status">
            {channel.members.length === 2 ? 'Direct Message' : `${channel.members.length} members`}
          </div>
        </div>
        <div className="chat-topbar__actions">
          <button className="icon-btn" title="Search" aria-label="Search messages">🔍</button>
          <button className="icon-btn" title="Members" aria-label="View members">👥</button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="messages-feed" ref={feedRef} id="messages-feed">
        {rendered.map((item, idx) => {
          if (item.type === 'date') {
            return (
              <div className="messages-feed__date-divider" key={`date-${idx}`}>
                <span>{item.label}</span>
              </div>
            );
          }
          const { msg, grouped } = item;
          const isOwn = msg.sender_id === user?.user_id;

          return (
            <div
              key={msg.id}
              className={[
                'message-row',
                isOwn ? 'message-row--own' : '',
                grouped ? 'message-row--grouped' : '',
              ].join(' ')}
            >
              <div className="message-row__avatar">
                {!grouped && <Avatar userId={msg.sender_id} size={30} />}
              </div>
              <div className="message-bubble">
                {!grouped && !isOwn && (
                  <div className="message-bubble__sender">{msg.sender_id}</div>
                )}
                {msg.type === 'text' && (
                  <div className="message-bubble__text" dir="auto">
                    {msg.text ?? '[encrypted]'}
                  </div>
                )}
                {msg.type === 'voice' && <VoiceBubble msg={msg} />}
                <div className="message-bubble__time">{formatTime(msg.sent_at)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            id="chat-input"
            className="chat-input-field"
            placeholder="Message…"
            value={inputText}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            dir="auto"
            aria-label="Type a message"
          />
          <div className="chat-input-actions">
            <VoiceRecorder channelId={channel.id} />
            <div className="emoji-trigger-wrapper">
              <button
                id="emoji-btn"
                className="icon-btn"
                onClick={() => setShowEmoji(v => !v)}
                aria-label="Pick emoji"
                title="Emoji"
              >
                😊
              </button>
              {showEmoji && (
                <div className="emoji-picker-popup">
                  <EmojiPicker onSelect={handleEmojiSelect} onClickOutside={() => setShowEmoji(false)} />
                </div>
              )}
            </div>
            <button
              id="send-btn"
              className="send-btn"
              onClick={handleSend}
              disabled={!inputText.trim() || sending}
              aria-label="Send message"
              title="Send"
            >
              {sending ? <span className="spinner" /> : '➤'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Voice Bubble ─────────────────────────────────────────────────────────
function VoiceBubble({ msg }: { msg: DecryptedMessage }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fake waveform bars for visual interest (real waveform needs WebAudio)
  const bars = Array.from({ length: 28 }, (_, i) =>
    Math.sin(i * 0.8 + (msg.id.charCodeAt(i % msg.id.length) ?? 1)) * 0.5 + 0.5
  );

  const handlePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <div className="voice-bubble">
      <button className="voice-bubble__play-btn" onClick={handlePlay} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '⏸' : '▶'}
      </button>
      <div className="voice-bubble__waveform" aria-hidden="true">
        {bars.map((h, i) => (
          <div
            key={i}
            className="voice-bubble__waveform-bar"
            style={{ height: `${Math.max(20, h * 100)}%` }}
          />
        ))}
      </div>
      <span className="voice-bubble__duration">0:00</span>
    </div>
  );
}
