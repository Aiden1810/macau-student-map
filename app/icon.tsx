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
          background: 'linear-gradient(135deg, #006633 0%, #0A7A46 100%)'
        }}
      >
        <div
          style={{
            width: Math.round(side * 0.58),
            height: Math.round(side * 0.58),
            borderRadius: Math.round(side * 0.14),
            background: '#FFFFFF',
            color: '#006633',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(side * 0.34),
            fontWeight: 800,
            fontFamily: 'Arial, sans-serif',
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.18)'
          }}
        >
          M
        </div>
      </div>
    ),
    size
  );
}
