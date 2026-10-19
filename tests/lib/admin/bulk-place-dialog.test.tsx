import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import BulkPlaceStatusDialog from '../../../components/admin/BulkPlaceStatusDialog';
import BulkPlaceStatusResult from '../../../components/admin/BulkPlaceStatusResult';

describe('bulk place confirmation and feedback', () => {
  it('names selected places and explains that taking them offline retains their details', () => {
    const html = renderToStaticMarkup(<BulkPlaceStatusDialog status="archived" busy={false}
      items={[{id: 'a', name: '牛肉面店', status: 'published'}]} onCancel={() => {}} onConfirm={() => {}} />);
    expect(html).toContain('确认下线 1 家店铺');
    expect(html).toContain('牛肉面店');
    expect(html).toContain('店铺资料和图片会保留');
    expect(html).toContain('取消');
  });
  it('keeps uncertain results separate from confirmed successes', () => {
    const html = renderToStaticMarkup(<BulkPlaceStatusResult results={[
      {id: 'a', name: '面店', outcome: 'updated'},
      {id: 'b', name: '咖啡店', outcome: 'failed', code: 'UNKNOWN_RESULT', message: '刷新确认实际状态'}
    ]} />);
    expect(html).toContain('成功 1 家');
    expect(html).toContain('未成功或待确认 1 家');
    expect(html).toContain('咖啡店');
    expect(html).toContain('刷新确认实际状态');
  });
});
