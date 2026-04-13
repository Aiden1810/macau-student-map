import {ImageResponse} from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 512,
  height: 512
};
export const contentType = 'image/png';

export default function Icon() {
  const side = Math.min(size.width, size.height);

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
          fontSize: Math.round(side * 0.42),
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
