"""Build the source-faithful 18-scene Blender remake. Rendering is opt-in.
Usage: blender -b -P build_full_faithful.py -- --mode build --percent 50
The original film and source are never modified. All assets are procedural volume.
"""
import bpy,sys,math,runpy,json,argparse
from pathlib import Path
from mathutils import Vector,Matrix
P=Path(__file__).resolve().parent;sys.path.insert(0,str(P))
import character as ch,props,film_compose as fc
raw=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
ap=argparse.ArgumentParser();ap.add_argument('--mode',default='build',choices=['build','stills']);ap.add_argument('--percent',type=int,default=50);a=ap.parse_args(raw)
O=P/'full_faithful_output';O.mkdir(exist_ok=True)
TIMING=P/'source_faithful_18_timing.json'
timeline=json.loads(TIMING.read_text());FPS=24
# Reproduce the tested original three opening scenes, in their original order.
sys.argv=['blender','--','--mode','build','--percent',str(a.percent),'--save-path',str(O/'film_build_work.blend')]
g=runpy.run_path(str(P/'proof_faithful.py'))
runpy.run_path(str(P/'finish_proof_geometry.py'));runpy.run_path(str(P/'final_proof_pose.py'))
s=bpy.context.scene;cam=s.camera;street=g['street'];youth=g['youth'];seller=g['seller'];bike=g['bike'];burger=g['burger'];coins=g['coins']
s.frame_set(1);first_objects=list(bpy.data.objects);initial_vis={o:(o.hide_render,o.hide_viewport) for o in first_objects}
bite_snapshot=fc.snapshot_channels(first_objects,range(289,433));opening_snapshot=fc.snapshot_channels(first_objects,[1])
# Build the rest once, reusing the same cast, bicycle, burger and coins.
import route_sequence as route_mod,pricing_sequence as price_mod,second_kiosk_sequence as second_mod
for o in street['objects']:o.hide_render=False;o.hide_viewport=False
route=route_mod.create_route_sequence(street,youth,bike,cam)
second=second_mod.create_second_kiosk_sequence(street,youth,seller,bike,burger,coins,cam)
street['shop2']['register_display'].data.body='6.89'
pricing=price_mod.create_pricing_sequence(origin=(100,0,0),include_reaction=False)
all_new=list(set(bpy.data.objects)-set(first_objects))
for o in all_new:fc.visibility([o],False,1)
for o,(hr,hv) in initial_vis.items():fc.key(o,'hide_render',hr,1,True);fc.key(o,'hide_viewport',hv,1,True)
# Do not let a future shape-key action extrapolate its eye-pop/jaw into the opening.
second['jaw'].value=0;second['jaw'].keyframe_insert('value',frame=1)
for eye,rest in zip(youth['eyes'],second['eye_rest']):fc.key(eye,'location',rest,1);fc.key(eye,'scale',(1,1,1),1)
# Persistent camera-side dressing removals and exact two-coin source tender.
permanent_hidden=[o for o in street['objects'] if o.name.startswith('Soft road repair') or (o.name.startswith('SUNNY TIMBER BURGERS') and any(q in o.name for q in ['paper cup',' shelf','interior back worktop','back cupboard doors','cupboard joint','cupboard knob']))]
permanent_hidden+=street['shop1']['coins']+street['shop2']['coins']
whole=[o for o in burger.children if o.name.endswith('domed upper bun')];bitten=[o for o in burger.children if 'bitten' in o.name or o.name=='Visible soft bread interior']
seed_hide=[o for o in burger.children if 'sesame seed' in o.name and (o.location.x-.34)**2+(o.location.y+.12)**2<.155**2]

def show_street(on,f):fc.visibility(street['objects'],on,f)
def show_cast(on,f):
 fc.root_visibility(youth['root'],on,f);fc.root_visibility(seller['root'],on,f);fc.root_visibility(bike['root'],on,f)
 fc.root_visibility(burger,on,f)
 for coin in coins:fc.root_visibility(coin,on,f)
def whole_burger(f):
 fc.visibility(whole,True,f);fc.visibility(bitten,False,f);fc.visibility(seed_hide,True,f)
def non_route_gags(f):
 fc.visibility([route['tongue'],route['gulp']]+route['dust'],False,f)
 fc.root_visibility(route['counter']['root'],False,f)
def non_second_gags(f):second_mod.restore_second_kiosk_staging(second,f)
def blank_pricing(f):
 for roots in pricing['set_roots'].values():
  for root in roots:fc.root_visibility(root,False,f)
def block(name,body,xy=(0,.76),size=.077,width=.86,panel=True,color='263A40'):
 d=fc.make_overlay(cam,name)
 lines=body.count('\n')+1;height=size*1.15*lines+.04
 if panel:fc.add_panel(d,name+' calm cream field',(xy[0],xy[1]-height*.42),(min(.92,width+.06),height),'FFF1D7')
 fc.add_text(d,name+' lettering',body,xy,size,color,True,width);return d

# One clear caption focus. Each phrase is complete before its reading hold starts.
overlays={}
title=fc.make_overlay(cam,'04 Title composition');fc.add_panel(title,'Full cream title field',(0,0),(1.12,2.0),'F7ECD2',.0)
title_words=[
 (fc.add_text(title,'Title ONE','ONE',(0,.60),.20,'D89F37',True,.38),0.0),
 (fc.add_text(title,'Title BURGER','BURGER,',(0,.40),.20,'2D706D',True,.80),.125),
 (fc.add_text(title,'Title TWO','TWO',(-.225,.19),.16,'D89F37',True,.31),.250),
 (fc.add_text(title,'Title PRICES','PRICES',(.16,.19),.16,'2D706D',True,.50),.375)]
fc.add_text(title,'Title Reuters date','Reuters, Sept 29, 2026',(0,-.025),.055,'263A40',False,.80)
title_burger=props.create_burger('Original title bouncing burger',scale=1);title_burger.parent=title['root'];title_burger.location=(0,-.47,.22);title_burger.rotation_euler=(-1.20,0,-.10);title_burger.scale=(.36,)*3
title['objects']+=fc.subtree(title_burger);overlays['title']=title
for name,body,start,end,xy,size,width,color in [
 ('observed_source','Reuters, Sept 29, 2026',42.1,47,(0,.73),.052,.84,'263A40'),
 ('observed_percent','+21%',41.75,47,(-.22,.61),.092,.40,'B9403C'),
 ('machine_input','nearly 14,000 restaurants\nmillions of orders a day',47.5,53,(0,.78),.068,.86,'263A40'),
 ('engine_caption','The engine recommends\nan "optimal price"\nfor each restaurant.',53.5,65,(0,.79),.074,.86,'263A40'),
 ('company_quote','McDonald\'s:\n"a tool,\nnot a mandate"',65,72,(0,.78),.079,.85,'263A40'),
 ('owner_quote','Ex-owner:\n"You don\'t really\nhave much of a\nchoice anymore."',72,81,(0,.79),.067,.84,'263A40'),
 ('same_burger','Same burger.\nDifferent\nneighborhood.',92.5,98,(.19,-.35),.067,.45,'263A40')]:
 d=block(name,body,xy,size,width,True,color);d['start']=start;d['end']=end;overlays[name]=d
illustration=fc.make_overlay(cam,'Machine illustration label');fc.add_text(illustration,'Illustration label','Illustration',(-.40,-.78),.037,'4D595A',False,.35,align='LEFT');overlays['illustration']=illustration
ending=fc.make_overlay(cam,'18 Sources and original Reuters caveat')
fc.add_panel(ending,'Sources calm field',(0,.565),(.94,.57),'FFF1D7')
fc.add_text(ending,'Sources','Sources: Reuters / CNBC,\nEngadget, Restaurant Business\nSept 29 – Oct 1, 2026',(0,.81),.048,'263A40',False,.84)
fc.add_text(ending,'Original Reuters caveat','Reuters could not confirm\nthe price gap came from\nthe pricing engine.',(0,.62),.064,'263A40',True,.85)
fc.add_text(ending,'Original channel signature','Ideas & Technologies',(0,.37),.051,'2D706D',True,.84);overlays['end']=ending
for d in overlays.values():fc.pose_overlay(d,cam,1,False)

# Reuse the exact validated bite animation at scene17; preserve the visual rhyme.
last_shot=3
for f in range(18*FPS+1,110*FPS+1):
 T=(f-1)/FPS;shot=next(q for q in timeline['shots'] if q['start']<=T<q['end']);sid=shot['order'];t=T-shot['start'];dur=shot['duration']
 if sid!=last_shot:
  route_mod.restore_route_staging(route,f);second_mod.restore_second_kiosk_staging(second,f);blank_pricing(f)
  show_street(sid in {5,6,7,8,9,15,16,17,18},f);show_cast(sid in {5,6,7,8,9,15,16,17},f)
  fc.root_visibility(route['column_house'],sid in {5,6,7,16},f);fc.root_visibility(route['modest_frontage'],sid in {5,6,7,16},f)
  if sid in {5,6,7,16}:
   fc.root_visibility(seller['root'],False,f);fc.root_visibility(burger,False,f)
   for coin in coins:fc.root_visibility(coin,False,f)
  if sid in {8,9,15}:whole_burger(f)
  if sid==17:
   # First-booth close-up has already been copied; its opening visibility wins.
   for o,(hr,hv) in initial_vis.items():
    fc.key(o,'hide_render',hr,f,True);fc.key(o,'hide_viewport',hv,f,True)
   whole_burger(f)
  if sid==18:
   fc.root_visibility(seller['root'],True,f)
  fc.visibility(permanent_hidden,False,f);last_shot=sid
 if sid==4:
  fc.camera_pose(cam,(7.9,-4,2.7),(12.1,3.1,2.25),43,f)
  # Original whole-word pops, followed by one physical burger squash/bounce.
  for ob,at in title_words:
   dt=t-at;scale=1 if dt>=.125 else .65 if dt<.0417 else 1.08 if dt<.0834 else 1
   fc.key(ob,'scale',(scale,scale,1),f,True)
  lift=0;xs=zs=1
  if .917<=t<1.0:xs=1.14;zs=.80
  elif 1.0<=t<1.5:
   q=(t-1.0)/.5;lift=.13*math.sin(math.pi*q);xs=1-.10*math.sin(math.pi*q);zs=1+.12*math.sin(math.pi*q)
  elif 1.5<=t<1.5834:xs=1.08;zs=.88
  fc.key(title_burger,'location',(0,-.47+lift,.22),f,True);fc.key(title_burger,'scale',(.36*xs,.36,.36*zs),f,True)
 elif sid in {5,6,7,16}:
  route_mod.pose_route_shot(route,sid,t,dur,f)
  fc.visibility(second['stalks']+[second['pointing_finger']],False,f)
 elif sid in {8,9,15}:
  second_mod.pose_second_kiosk_shot(second,sid,t,dur,f);whole_burger(f);non_route_gags(f)
 elif sid in {10,11,12,13,14}:
  price_mod.pose_scene(pricing,sid,t,frame=f,camera=cam,duration=dur)
 elif sid==17:
  # Copied F-curves include the tested camera, face, contact, crumbs and ingredient switch.
  pass
 elif sid==18:
  fc.camera_pose(cam,(7.9,-4,2.7),(12.1,3.1,2.25),43,f)
  p=Vector((14.23,3.49,1.49));h=-3*math.pi/4;rot=Matrix.Rotation(h,3,'Z')
  hands={side:p+rot@Vector((.25,sign*.38,.05)) for side,sign in [('L',-1),('R',1)]}
  feet={side:Vector((p.x,p.y,.42))+rot@Vector((0,sign*.20,0)) for side,sign in [('L',-1),('R',1)]}
  yawn=max(0,math.sin(math.pi*min(1,max(0,(t-8)/1.1)))) if 8<=t<9.1 else 0
  ch.pose_character(seller,p,h,hands,feet,h,'talk' if yawn>.15 else 'smile',f,torso_pitch=.16-.08*yawn,head_pitch=-.14*yawn);ch.blink_character(seller,yawn,f)
  non_route_gags(f)
 # Camera-safe overlay scale is determined by each actual shot lens.
 if sid==17:cam.data.lens=47
 for name,d in overlays.items():
  on=(18<=T<22) if name=='title' else (47<=T<81) if name=='illustration' else (98<=T<110) if name=='end' else d['start']<=T<d['end']
  fc.pose_overlay(d,cam,f,on,1)
  if name=='title' and on:
   for ob,at in title_words:fc.visibility([ob],t>=at,f)
 if f%240==0:print('FULL_FAITHFUL_BAKED',f,'/',110*FPS,flush=True)
# Copy the original bite only after sequential baking so interpolation updates
# remain O(1) while composing the other shots.
fc.copy_snapshot(bite_snapshot,92*FPS+1)
# Re-assert final visibility AFTER the copied animation. Otherwise a deliberately
# omitted identical hold key can be invalidated by this late source-scene reuse.
fc.visibility(second['stalks']+[second['pointing_finger'],route['tongue'],route['gulp']]+route['dust'],False,92*FPS+1)
fc.root_visibility(youth['root'],False,98*FPS+1);fc.root_visibility(bike['root'],False,98*FPS+1);fc.root_visibility(burger,False,98*FPS+1)
for coin in coins:fc.root_visibility(coin,False,98*FPS+1)
fc.visibility([second['pointing_finger']],False,98*FPS+1)
# Explicitly restore original first3 keys changed at future-sequence creation, without
# allowing hidden future props to leak into the original opening.
for o in permanent_hidden:fc.visibility([o],False,1)
fc.constant_visibility_and_camera(cam)
s['edit_transition']='Original scene09 dip-to-ink45.875–47.0 and scene10 fade-in47.0–47.375 are reproduced by encode_manifest.py --original-dip, together with the soundtrack.'
s.frame_start=1;s.frame_end=110*FPS;s.render.resolution_percentage=a.percent;s['scope']='All 18 original story scenes, source order and gags retained; readable caption holds; Illustration safeguard.'
s.timeline_markers.clear()
for q in timeline['shots']:s.timeline_markers.new(f"{q['order']:02d} {q['id']}",frame=int(q['start']*FPS)+1)
import asset_registry,visibility_audit,positive_camera_audit
assets=dict(street=street,youth=youth,seller=seller,bike=bike,burger=burger,coins=coins,route=route,second=second,pricing=pricing,overlays=overlays,permanent_hidden=permanent_hidden,whole=whole,bitten=bitten,seed_hide=seed_hide)
price_mod.patch_readability(s)
report=visibility_audit.apply_and_audit(s,assets);s['visibility_audit']=json.dumps(report);s['source_scene_count']=18
fc.constant_visibility_and_camera(cam);camera_report=positive_camera_audit.audit(s,assets);asset_registry.save(s,assets)
(O/'positive_camera_audit.json').write_text(json.dumps(camera_report,indent=2))
(O/'full_visibility_audit.json').write_text(json.dumps(report,indent=2))
s.frame_set(13*FPS+1);bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(P/'burger-price-faithful-18.blend'),compress=True)
(O/'timeline.json').write_text(json.dumps(timeline,indent=2))
if a.mode=='stills':
 for T in [19.5,23.5,28,32.3,36.8,40,44,49.7,55,62,68.2,77.3,82,84.7,87,90.7,95.3,103]:
  s.frame_set(round(T*FPS)+1);s.render.filepath=str(O/f'full_{T:05.1f}.png');bpy.ops.render.render(write_still=True)
print('FULL_FAITHFUL_SCENE_READY',flush=True)
