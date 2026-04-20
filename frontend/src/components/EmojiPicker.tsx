import { useEffect, useRef } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

interface EmojiPickerProps {
  onSelect: (emoji: { native: string }) => void;
  onClickOutside: () => void;
}

export default function EmojiPicker({ onSelect, onClickOutside }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClickOutside();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClickOutside]);

  return (
    <div ref={ref}>
      <Picker
        data={data}
        onEmojiSelect={onSelect}
        theme="dark"
        previewPosition="none"
        skinTonePosition="none"
        navPosition="bottom"
      />
    </div>
  );
}
