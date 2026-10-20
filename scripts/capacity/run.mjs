#!/usr/bin/env node
import {spawn, execFileSync} from 'node:child_process';
import {mkdir, copyFile, writeFile, readFile, symlink} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import {cpus, totalmem, platform, release} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {assertIsolatedTarget, summarizeSamples} from './metrics.mjs';
import {createCapacityFixture, fixturePlace} from './fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const short = process.argv.includes('--smoke');
const directory = path.join(root, 'output', 'capacity', `${new Date().toISOString().replace(/[:.]/g,'-')}-${short?'smoke':'full'}`);
const copy = path.join(directory, 'app');
const target = assertIsolatedTarget('http://127.0.0.1:56547');
const fixtureOrigin = assertIsolatedTarget('http://127.0.0.1:56548');
const nonce = randomUUID();
const children = [];
const evidence = {startedAt: new Date().toISOString(), mode: short?'smoke':'full', target,
  environment: {platform:platform(), release:release(), node:process.version, cpu:cpus()[0]?.model, logicalCpus:cpus().length, memoryGb:Number((totalmem()/1024**3).toFixed(1))},
  limitations: ['Local Next.js production build, single-process PGlite and a limited PostgREST/Auth adapter; not Supabase cloud or Vercel capacity.',
    'Synthetic places have tags but no images. Browser rendering, assets, Realtime, email, real Auth, AMap and paid model calls are excluded.',
    'Virtual users run closed-loop with one second think time; this is not an open arrival-rate or long-duration soak test.'], phases:[]};
let fixture;
let log;

function startNext(args) {
  const child = spawn(process.execPath, [path.join(root,'node_modules/next/dist/bin/next'), ...args], {
    cwd:copy, env:{...process.env, NODE_ENV:'production', NEXT_TELEMETRY_DISABLED:'1', CITYU_BUILD_DIR:'.next',
      NEXT_PUBLIC_SUPABASE_URL:fixtureOrigin, NEXT_PUBLIC_SUPABASE_ANON_KEY:'capacity-fixture-public-key',
      DEEPSEEK_API_KEY:'', NEXT_PUBLIC_AMAP_KEY:'', NEXT_PUBLIC_AMAP_SECURITY_CODE:''},
    stdio:['ignore','pipe','pipe'], windowsHide:true
  });
  children.push(child);
  child.stdout.on('data', chunk=>void log?.write(chunk));
  child.stderr.on('data', chunk=>void log?.write(chunk));
  return child;
}
async function waitExit(child) {
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  if(code!==0)throw new Error(`Next.js build exited with ${code}. See build.log.`);
}
async function request(label, pathname, options, validate) {
  const start=performance.now();
  let status=0, bytes=0, ok=false;
  try {
    const response=await fetch(`${target}${pathname}`, {...options, redirect:'error', signal:AbortSignal.timeout(10000)});
    status=response.status;
    const buffer=Buffer.from(await response.arrayBuffer()); bytes=buffer.length;
    if(response.ok) {const body=JSON.parse(buffer.toString());ok=Boolean(validate(body));}
  } catch { /* Network timeouts and semantic failures stay in the denominator. */ }
  return {label,durationMs:performance.now()-start,status,bytes,ok};
}
const catalog=()=>request('catalog','/api/places',{}, body=>body.ok && body.data.items.length===fixture.stats().placeCount
  && body.data.items.every(item=>item.name.startsWith('隔离测试咖啡店')));
const detail=()=>request('detail',`/api/places/${fixturePlace}`,{},body=>body.ok && body.data.id===fixturePlace);
const search=()=>request('search-event','/api/search/events',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({query:'咖啡',normalized_query:'咖啡',filters:{category:'food'},result_count:1,matched_level:'name'})},body=>body.ok && body.data.recorded===true);

async function phase(users, durationSeconds) {
  const before=fixture.stats(), samples=[];
  const start=performance.now(), deadline=start+durationSeconds*1000;
  await Promise.all(Array.from({length:users},async(_,index)=>{
    await sleep(index/users*500);
    while(performance.now()<deadline){
      samples.push(await catalog());
      samples.push(await detail());
      samples.push(await search());
      const remaining=deadline-performance.now();
      if(remaining>0)await sleep(Math.min(1000,remaining));
    }
  }));
  const elapsedMs=performance.now()-start, after=fixture.stats();
  const byRoute={}; for(const label of ['catalog','detail','search-event']) byRoute[label]=summarizeSamples(samples.filter(item=>item.label===label),elapsedMs);
  const summary=summarizeSamples(samples,elapsedMs);
  const passed=summary.failures===0 && byRoute.catalog.successP95Ms<=2000 && byRoute.detail.successP95Ms<=1000 && byRoute['search-event'].successP95Ms<=1000;
  return {kind:'browse',places:after.placeCount,virtualUsers:users,thinkMs:1000,elapsedMs:Number(elapsedMs.toFixed(0)),
    summary,byRoute,passed,fixtureSqlQueries:after.sqlCount-before.sqlCount,fixtureSqlTotalMs:Number((after.sqlMs-before.sqlMs).toFixed(2)),harnessPeakRssMb:Number((after.peakRssBytes/1024**2).toFixed(1))};
}
async function writeBurst(users, offset) {
  const start=performance.now();
  const samples=await Promise.all(Array.from({length:users},(_,i)=>request('review-create',`/api/places/${fixturePlace}/reviews`,{
    method:'POST', headers:{'content-type':'application/json',authorization:`Bearer capacity-user-${offset+i}`},
    body:JSON.stringify({rating:4,content:'隔离容量测试评价',expectedUpdatedAt:null})
  },body=>body.ok && body.data.rating===4 && body.data.placeId===fixturePlace)));
  return {kind:'review-burst',virtualUsers:users,summary:summarizeSamples(samples,performance.now()-start)};
}

try {
  await mkdir(copy,{recursive:true});
  const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean)
    .filter(name=>/^(app|components|lib|data|types|i18n|messages|public)\//.test(name)
      || /^(package(-lock)?\.json|next\.config\.ts|next-env\.d\.ts|tsconfig\.json|tailwind\.config\.ts|postcss\.config\.mjs|eslint\.config\.mjs|middleware\.ts)$/.test(name));
  const manifest=[];
  for(const name of files){const destination=path.join(copy,name);await mkdir(path.dirname(destination),{recursive:true});await copyFile(path.join(root,name),destination);
    manifest.push({file:name,sha256:createHash('sha256').update(await readFile(destination)).digest('hex')});}
  await writeFile(path.join(directory,'source-manifest.json'),JSON.stringify(manifest,null,2));
  await symlink(path.join(root,'node_modules'),path.join(copy,'node_modules'),platform()==='win32'?'junction':'dir');
  fixture=await createCapacityFixture(root,56548,nonce);
  const health=await (await fetch(`${fixtureOrigin}/__capacity/health`,{redirect:'error'})).json();
  if(health.nonce!==nonce)throw new Error('Isolated fixture identity check failed.');
  log=await import('node:fs').then(fs=>fs.createWriteStream(path.join(directory,'build.log')));
  console.log('Building isolated production copy; no .env files copied.');
  await waitExit(startNext(['build']));
  const server=startNext(['start','--hostname','127.0.0.1','--port','56547']);
  let ready=false;
  for(let i=0;i<60;i++){
    if(server.exitCode!==null)throw new Error('Isolated Next server stopped.');
    const probe=await catalog();
    if(probe.ok){ready=true;break;} await sleep(500);
  }
  if(!ready)throw new Error('Isolated application identity / catalog readiness check failed.');
  const probes=[await catalog(),await detail(),await search()];
  evidence.preflight=probes;
  if(probes.some(probe=>!probe.ok))throw new Error('A real application route failed preflight; refusing to benchmark error responses.');
  console.log('Preflight verified catalog, detail and search persistence.');
  for(const users of short?[2]:[10,25,50,100]){
    const result=await phase(users,short?3:15);evidence.phases.push(result);
    console.log(JSON.stringify({places:result.places,users,rps:result.summary.rps,p95Ms:result.summary.successP95Ms,failures:result.summary.failures,passed:result.passed}));
    await writeFile(path.join(directory,'results.json'),JSON.stringify(evidence,null,2));
    if(result.summary.errorPercent>5)break;
  }
  if(!short){
    await fixture.seed(500);
    for(const users of [10,25,50,100]){const result=await phase(users,15);evidence.phases.push(result);console.log(JSON.stringify({places:500,users,rps:result.summary.rps,p95Ms:result.summary.successP95Ms,failures:result.summary.failures,passed:result.passed}));if(result.summary.errorPercent>5)break;}
  }
  for(const [index,users] of (short?[2]:[10,25,50,100]).entries()){
    const result=await writeBurst(users,index*150);evidence.phases.push(result);console.log(JSON.stringify(result));
  }
  evidence.finishedAt=new Date().toISOString();
  await writeFile(path.join(directory,'results.json'),JSON.stringify(evidence,null,2));
  console.log(`Evidence saved to ${path.relative(root,directory)}`);
} catch(error) {
  evidence.error=error.message;
  await writeFile(path.join(directory,'results.json'),JSON.stringify(evidence,null,2)).catch(()=>{});
  console.error(error.message); console.error(`Evidence directory: ${directory}`); process.exitCode=1;
} finally {
  for(const child of children){if(child.exitCode===null)child.kill();}
  if(fixture)await fixture.close();
  log?.end();
}
