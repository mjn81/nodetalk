interface VoiceRecorderProps {
  channelId: string;
}

export default function VoiceRecorder({ channelId }: VoiceRecorderProps) {
  // Stubbed out due to React 19 compatibility crash with react-audio-voice-recorder
  return (
    <button className="icon-btn" disabled title="Voice notes currently disabled">
      🎙️
    </button>
  );
}
