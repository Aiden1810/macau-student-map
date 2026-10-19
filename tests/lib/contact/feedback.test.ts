import {describe, expect, it} from 'vitest';
import {buildFeedbackText, feedbackSchema} from '../../../lib/contact/feedback';

describe('contact feedback draft', () => {
  it('keeps the complaint and optional place, without empty optional fields', () => {
    expect(buildFeedbackText({category: '投诉', place: ' 测试店 ', message: ' 描述\n第二行 ', replyTo: ''}, {
      title: '城觅反馈', category: '类型', place: '相关店铺', message: '内容', replyTo: '回复方式'
    })).toBe('城觅反馈\n\n类型: 投诉\n\n相关店铺: 测试店\n\n内容:\n描述\n第二行');
  });
  it('validates length and trims input before saving', () => {
    const input = {id: '19aa9dfc-5b1d-4fb4-a1c0-c6d8288d3700', category: 'issue', place: ' 店铺 ', message: ' 这是完整的功能反馈测试内容 ', replyTo: '', locale: 'zh-CN'};
    expect(feedbackSchema.parse(input).place).toBe('店铺');
    expect(feedbackSchema.safeParse({...input, message: '   '}).success).toBe(false);
    expect(feedbackSchema.safeParse({...input, message: 'a'.repeat(2001)}).success).toBe(false);
  });
  it('does not accept forged ownership or moderation fields', () => {
    expect(feedbackSchema.safeParse({id: '19aa9dfc-5b1d-4fb4-a1c0-c6d8288d3700', category: 'issue', place: '', message: '这是完整的功能反馈测试内容', replyTo: '', locale: 'zh-CN', user_id: 'other', status: 'resolved'}).success).toBe(false);
  });
});
