import { useState } from 'react';
import { useAudioRecorder } from 'react-audio-voice-recorder';
import { apiUploadFile } from '../api/client';
import { wsSendMessage } from '../ws';

interface VoiceRecorderProps {
  channelId: string;
}

export default function VoiceRecorder({ channelId }: VoiceRecorderProps) {
  const [status, setStatus]   = useState<'idle' | 'recording' | 'uploading'>('idle');
  const [error, setError]     = useState<string | null>(null);

  const {
    startRecording,
    stopRecording,
    isRecording,
    recordingBlob,
  } = useAudioRecorder();

  const handleRecordingComplete = async (blob: Blob) => {
    setStatus('uploading');
    setError(null);
    try {
      const file = await apiUploadFile(blob, 'audio/webm');
      // Send a voice message where the ciphertext carries the file ID as JSON.
      await wsSendMessage(channelId, JSON.stringify({ file_id: file.file_id }), 'voice');
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Upload failed');
    } finally {
      setStatus('idle');
    }
  };

  const handlePointerDown = async () => {
    setError(null);
    try {
      startRecording();
      setStatus('recording');
    } catch {
      setError('Microphone access denied');
    }
  };

  const handlePointerUp = () => {
    if (status !== 'recording') return;
    stopRecording();
    setStatus('idle');
    if (recordingBlob) handleRecordingComplete(recordingBlob);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        id="voice-record-btn"
        className="icon-btn"
        title={isRecording ? 'Release to send' : 'Hold to record voice'}
        aria-label={isRecording ? 'Recording… release to send' : 'Record voice note'}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          color: isRecording ? 'var(--color-red)' : undefined,
          animation: isRecording ? 'pulse 1s infinite' : undefined,
        }}
        disabled={status === 'uploading'}
      >
        {status === 'uploading' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '🎙️'}
      </button>
      {error && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          right: 0,
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-red)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px 8px',
          fontSize: 'var(--text-xs)',
          color: '#fca5a5',
          whiteSpace: 'nowrap',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
