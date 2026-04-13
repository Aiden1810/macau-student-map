import {ImageResponse} from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 180,
  height: 180
};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0B5E3B',
          color: '#FFFFFF',
          fontSize: 72,
          fontWeight: 800,
          fontFamily: 'Arial, sans-serif'
        }}
      >
        M
      </div>
    ),
    size
  );
}
