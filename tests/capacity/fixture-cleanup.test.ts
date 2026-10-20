import {execFile} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {describe, expect, it} from 'vitest';

describe('capacity fixture startup cleanup', () => {
  it('exits after an occupied port instead of leaving its monitor and database alive', async () => {
    const moduleUrl = pathToFileURL(path.resolve('scripts/capacity/fixture.mjs')).href;
    const code = `import {createServer} from 'node:http';
      const {createCapacityFixture}=await import(${JSON.stringify(moduleUrl)});
      const blocker=createServer();await new Promise(resolve=>blocker.listen(0,'127.0.0.1',resolve));
      try{await createCapacityFixture(process.cwd(),blocker.address().port,'test');throw new Error('Expected port conflict');}
      catch(error){if(error.code!=='EADDRINUSE')throw error;console.log('port-conflict-cleaned');}
      finally{await new Promise(resolve=>blocker.close(resolve));}`;
    const result = await new Promise<{error: Error | null; stdout: string}>(resolve => {
      execFile(process.execPath, ['--input-type=module', '-e', code], {cwd: process.cwd(), timeout: 7000},
        (error, stdout) => resolve({error, stdout}));
    });
    expect(result.stdout).toContain('port-conflict-cleaned');
    expect(result.error).toBeNull();
  }, 12000);
});
