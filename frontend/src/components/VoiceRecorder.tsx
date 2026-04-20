import { Mic } from 'lucide-react';

interface VoiceRecorderProps {
  channelId: string;
}

export default function VoiceRecorder({ channelId }: VoiceRecorderProps) {
  // Stubbed out due to React 19 compatibility crash with react-audio-voice-recorder
  console.log("Voice Recorder mounted for channel:", channelId);
  return (
    <button className="text-[#b5bac1] hover:text-[#dbdee1] transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" disabled title="Voice notes currently disabled">
      <Mic size={24} />
    </button>
  );
}
