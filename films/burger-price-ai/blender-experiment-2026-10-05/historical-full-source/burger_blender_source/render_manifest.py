"""Render only exact-state canonical frames from a validated manifest.
No animation, source scene, camera or asset edits are saved.
"""
import bpy,sys,argparse,json,hashlib,time,resource
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--manifest',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--part',type=int,default=0);p.add_argument('--parts',type=int,default=1);p.add_argument('--width',type=int,default=720);p.add_argument('--aa',default='5');p.add_argument('--threads',type=int,default=3);p.add_argument('--frame-list',type=Path);a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
m=json.loads(a.manifest.read_text());source=Path(m['source']['blend']);assert hashlib.sha256(source.read_bytes()).hexdigest()==m['source']['sha256'],'Scene changed after manifest generation'
assert not m['safety']['unsupported_state_flags'],m['safety']['unsupported_state_flags']
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False);s=bpy.data.scenes[m['source']['scene']];bpy.context.window.scene=s
s.render.resolution_x=a.width;s.render.resolution_y=round(a.width*16/9);s.render.resolution_percentage=100;s.display.render_aa=a.aa;s.render.threads_mode='FIXED';s.render.threads=a.threads;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';s.render.image_settings.compression=10
a.out.mkdir(parents=True,exist_ok=True);frame_pool=json.loads(a.frame_list.read_text()) if a.frame_list else m['canonical_render_frames'];frames=frame_pool[a.part::a.parts];start=time.monotonic()
config={'source_sha256':m['source']['sha256'],'width':s.render.resolution_x,'height':s.render.resolution_y,'aa':a.aa,'fps':m['timing']['master_fps']}
configpath=a.out/'render_configuration.json'
if configpath.exists():assert json.loads(configpath.read_text())==config,'Output folder belongs to a different render configuration'
else:
 tmp=configpath.with_suffix(f'.{a.part}.tmp');tmp.write_text(json.dumps(config,indent=2));tmp.replace(configpath)
for i,f in enumerate(frames):
 path=a.out/f'frame_{f:06d}.png';frame_start=time.monotonic()
 (a.out/f'progress_{a.part}.json').write_text(json.dumps({'part':a.part,'done':i,'total':len(frames),'frame':f,'state':'rendering','elapsed':time.monotonic()-start}))
 valid=False
 if path.exists() and path.stat().st_size>32:
  with path.open('rb') as check:
   header=check.read(8);check.seek(-12,2);tail=check.read()
  valid=header==b'\x89PNG\r\n\x1a\n' and b'IEND' in tail
 if not valid:
  s.frame_set(f);s.render.filepath=str(path);bpy.ops.render.render(write_still=True)
 progress={'part':a.part,'done':i+1,'total':len(frames),'frame':f,'elapsed':time.monotonic()-start,'last_seconds':time.monotonic()-frame_start,'rss_mb':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024}
 (a.out/f'progress_{a.part}.json').write_text(json.dumps(progress,indent=2));print('RENDER_PROGRESS',json.dumps(progress),flush=True)
print('RENDER_PART_DONE',a.part,flush=True)
