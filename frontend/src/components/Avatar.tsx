// Deterministic SVG identicon avatar generator
// Uses minidenticons — no external API calls, generated from username seed

import { minidenticon } from 'minidenticons';

interface AvatarProps {
  userId: string;
  size?: number;
  className?: string;
}

/**
 * Avatar renders a deterministic SVG identicon based on userId.
 * The same userId always produces the same icon on every device — offline-first.
 */
export function Avatar({ userId, size = 36, className }: AvatarProps) {
  const svgString = minidenticon(userId, 80, 50);
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

  return (
    <img
      src={dataUrl}
      alt={`Avatar for ${userId}`}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--color-bg-elevated)',
        display: 'block',
      }}
    />
  );
}
