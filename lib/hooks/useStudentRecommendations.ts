'use client';

import {useEffect, useState} from 'react';

type StudentPlace = {place_id: string; name: string; address: string | null};

type StudentRecommendations =
  | {status: 'loading'}
  | {status: 'error'}
  | {status: 'ready'; items: StudentPlace[]};

export function useStudentRecommendations(enabled: boolean) {
  const [result, setResult] = useState<StudentRecommendations>({status: 'loading'});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setResult({status: 'loading'});
    void fetch('/api/discovery/student-picks', {cache: 'no-store', signal: controller.signal})
      .then(async response => {
        const body = await response.json();
        if (!response.ok || !body?.ok || !body.data?.available || !Array.isArray(body.data.items)) {
          throw new Error('Student recommendations unavailable');
        }
        if (!controller.signal.aborted) setResult({status: 'ready', items: body.data.items});
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({status: 'error'});
      });
    return () => controller.abort();
  }, [enabled, attempt]);

  return {result, retry: () => setAttempt(previous => previous + 1)};
}
