#!/usr/bin/env python3
"""Reproduce the complete film, resume valid frames, and recover one stalled worker."""
from pathlib import Path
import argparse,subprocess,os,json,sys,time,hashlib
P=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--blender',default='blender');p.add_argument('--blend',type=Path,default=P/'burger-price-faithful-18.blend');p.add_argument('--build',action='store_true');p.add_argument('--resume',action='store_true');p.add_argument('--width',type=int,default=1080);p.add_argument('--aa',default='8');p.add_argument('--workers',type=int,default=3);p.add_argument('--threads',type=int,default=3);p.add_argument('--out',type=Path);p.add_argument('--stall-seconds',type=float,default=180);a=p.parse_args()
cache=P/'render_cache';cache.mkdir(exist_ok=True)
env=dict(os.environ,LP_NUM_THREADS=str(a.threads),XDG_CACHE_HOME=str(cache));out=a.out or P/f'render_{a.width}_aa{a.aa}';out.mkdir(parents=True,exist_ok=True)
if a.build or not a.blend.exists():subprocess.run([a.blender,'-b','-t',str(a.threads),'-P',str(P/'build_full_faithful.py'),'--','--mode','build','--percent','100'],env=env,check=True)
assert a.blend.exists(),a.blend
manifest=out/'frame_manifest.json';source_sha=hashlib.sha256(a.blend.read_bytes()).hexdigest()
accents=['5.8:6.10','6.8:7.42','9.55:10.20','13.05:13.55','18.0:18.50','18.917:19.60','36.05:37.45','38.0:38.75','41.35:41.90','42.45:42.95','44.0:44.80','47.85:48.15','49.60:49.90','53.0:53.70','56.8:57.0','57.2:58.3','60.0:61.25','65.5:65.90','69.5:70.6','75.4:77.3','81.60:82.60','82.2:83.2','83.4:84.6','93.05:93.55']
reuse=a.resume and manifest.exists() and json.loads(manifest.read_text())['source']['sha256']==source_sha
if not reuse:
 cmd=[a.blender,'-b','--factory-startup','--disable-autoexec','-t','1','-P',str(P/'frame_reuse_manifest.py'),'--','--blend',str(a.blend),'--output',str(manifest),'--hold-fps','12']
 for accent in accents:cmd+=['--accent',accent]
 subprocess.run(cmd,env=dict(env,LP_NUM_THREADS='1'),check=True)
m=json.loads(manifest.read_text());assert not m['safety']['unsupported_state_flags'],m['safety']['unsupported_state_flags']
frames=out/'frames';frames.mkdir(exist_ok=True)
def valid(f):
 q=frames/f'frame_{f:06d}.png'
 if not q.exists() or q.stat().st_size<32:return False
 with q.open('rb') as h:head=h.read(8);h.seek(-12,2);tail=h.read()
 return head==b'\x89PNG\r\n\x1a\n' and b'IEND' in tail
pending=[f for f in m['canonical_render_frames'] if not valid(f)];worklist=out/'pending_frames.json';worklist.write_text(json.dumps(pending));print('RESUME_PLAN',json.dumps({'complete':len(m['canonical_render_frames'])-len(pending),'pending':len(pending),'total':len(m['canonical_render_frames'])}),flush=True)
workers=[]
def launch(part,attempt):
 threads=a.threads if attempt==0 else 1
 log=(out/f'render_{part}_attempt_{attempt}.log').open('w')
 cmd=[a.blender,'-b','--factory-startup','--disable-autoexec','-t',str(threads),'-P',str(P/'render_manifest.py'),'--','--manifest',str(manifest),'--out',str(frames),'--frame-list',str(worklist),'--part',str(part),'--parts',str(a.workers),'--width',str(a.width),'--aa',a.aa,'--threads',str(threads)]
 q=subprocess.Popen(cmd,env=dict(env,LP_NUM_THREADS=str(threads)),stdout=log,stderr=subprocess.STDOUT)
 progress=frames/f'progress_{part}.json';mt=progress.stat().st_mtime_ns if progress.exists() else 0
 return {'part':part,'attempt':attempt,'process':q,'log':log,'changed':time.monotonic(),'mtime':mt,'done':False}
def stop(w):
 q=w['process']
 if q.poll() is None:
  q.terminate()
  try:q.wait(timeout=10)
  except subprocess.TimeoutExpired:q.kill();q.wait()
 w['log'].close()
try:
 if pending:workers=[launch(part,0) for part in range(a.workers)]
 while any(not w['done'] for w in workers):
  for i,w in enumerate(workers):
   if w['done']:continue
   q=w['process'];rc=q.poll();progress=frames/f"progress_{w['part']}.json"
   mt=progress.stat().st_mtime_ns if progress.exists() else 0
   if mt!=w['mtime']:w['mtime']=mt;w['changed']=time.monotonic()
   stalled=rc is None and time.monotonic()-w['changed']>a.stall_seconds
   if rc==0:w['done']=True;w['log'].close();continue
   if rc is not None or stalled:
    stop(w)
    if w['attempt']>=1:raise RuntimeError(f"Render worker {w['part']} failed after retry; inspect its log. Code={rc}, stalled={stalled}")
    print('WORKER_RETRY',json.dumps({'part':w['part'],'code':rc,'stalled':stalled,'threads':1}),flush=True)
    workers[i]=launch(w['part'],w['attempt']+1)
  time.sleep(3)
finally:
 for w in workers:stop(w)
missing=[f for f in m['canonical_render_frames'] if not valid(f)];assert not missing,missing
movie=out/('burger-price-ai-blender-'+('master' if a.width>=1080 else 'preview')+'.mp4')
subprocess.run([sys.executable,str(P/'encode_manifest.py'),'--manifest',str(manifest),'--frames',str(frames),'--audio',str(P/'full_faithful_score.wav'),'--output',str(movie),'--original-dip'],check=True)
print(movie,flush=True)
