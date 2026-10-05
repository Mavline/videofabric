"""Explicit shot ownership for a baked film, plus an all-frame visibility audit."""
import bpy,json

def tree(o):return [o]+list(o.children_recursive)
def curve(o,p):
 ad=o.animation_data
 return ad.action.fcurves.find(p) if ad and ad.action else None

def value(o,p,f):
 c=curve(o,p);return bool(c.evaluate(f)) if c else bool(getattr(o,p))

def key(o,p,f,v):
 setattr(o,p,v);o.keyframe_insert(data_path=p,frame=f)
 c=curve(o,p)
 for k in c.keyframe_points:
  if abs(k.co.x-f)<.01:k.interpolation='CONSTANT';break

def outside(ranges,n,fps=24):
 allowed=set()
 for start,end in ranges:allowed.update(range(round(start*fps)+1,round(end*fps)+1))
 spans=[];begin=None
 for f in range(1,n+2):
  off=f<=n and f not in allowed
  if off and begin is None:begin=f
  if not off and begin is not None:spans.append((begin,f-1));begin=None
 return spans

def restrict(objects,ranges,n):
 spans=outside(ranges,n)
 for o in set(objects):
  for prop in ('hide_render','hide_viewport'):
   c=curve(o,prop);after={hi+1:value(o,prop,hi+1) for lo,hi in spans if hi<n}
   if c:
    for k in c.keyframe_points:
     if any(lo<=k.co.x<=hi for lo,hi in spans):k.co.y=1;k.interpolation='CONSTANT'
   for lo,hi in spans:
    key(o,prop,lo,True)
    if hi<n:key(o,prop,hi+1,after[hi+1])

def groups(a):
 g=[]
 def add(name,objects,ranges):g.append((name,list(set(objects)),ranges))
 add('main youth',tree(a['youth']['root']),[(0,18),(22,47),(81,98)])
 add('main cook',tree(a['seller']['root']),[(0,18),(34,47),(81,86),(92,110)])
 add('bicycle',tree(a['bike']['root']),[(0,18),(22,47),(81,98)])
 add('held burger',tree(a['burger']),[(0,18),(34,47),(81,86),(92,98)])
 add('offered coins',[o for r in a['coins'] for o in tree(r)],[(0,18),(34,47),(81,86),(92,98)])
 add('price eye stalks',a['second']['stalks'],[(41,47)])
 add('pointing index',[a['second']['pointing_finger']],[(34,47)])
 add('route mouth gags',[a['route']['tongue'],a['route']['gulp']],[(22,26)])
 add('route dust',a['route']['dust'],[(30,34),(86,92)])
 add('route distance',tree(a['route']['counter']['root']),[(22,34),(86,92)])
 add('second shop ticks',a['second']['tap_marks'],[(34,41)])
 add('second shop dust',a['second']['dust'],[(34,41),(81,86)])
 add('first bite crumbs',[o for o in bpy.data.objects if o.name.startswith('Chomp crumb')],[(12,18),(92,98)])
 for name,ranges in [('machine',[(47,53),(57,65)]),('scope',[(53,57)]),('office',[(65,81)])]:
  add('pricing '+name,[o for r in a['pricing']['set_roots'][name] for o in tree(r)],ranges)
 for name,d in a['overlays'].items():
  ranges=[(18,22)] if name=='title' else [(47,81)] if name=='illustration' else [(98,110)] if name=='end' else [(d['start'],d['end'])]
  add('caption '+name,d['objects'],ranges)
 return g

def apply_and_audit(scene,a):
 n=scene.frame_end;g=groups(a)
 # Restrictive sub-groups are applied after broad actor/prop membership.
 for name,objects,ranges in g:restrict(objects,ranges,n)
 permanent=set(o for root in a['permanent_hidden'] for o in tree(root))
 for o in permanent:
  if o.animation_data and o.animation_data.action:
   for c in list(o.animation_data.action.fcurves):
    if c.data_path in {'hide_render','hide_viewport'}:o.animation_data.action.fcurves.remove(c)
  o.hide_render=True;o.hide_viewport=True
 violations=[];checked=0
 for name,objects,ranges in g:
  for o in objects:
   if o.animation_data and (o.animation_data.drivers or o.animation_data.nla_tracks):raise RuntimeError('Visibility audit requires ordinary single-action keys: '+o.name)
   for lo,hi in outside(ranges,n):
    for f in range(lo,hi+1):
     checked+=1
     if not value(o,'hide_render',f):violations.append((name,o.name,f))
 # Verify expression families and open/closed eye substitutions over all frames.
 expression_errors=[];eye_errors=[]
 for actor in [a['youth'],a['seller'],a['pricing']['office']['owner']]:
  for f in range(1,n+1):
   active=[name for name,obs in actor['expressions'].items() if any(not value(o,'hide_render',f) for o in obs)]
   if len(active)>1:expression_errors.append((actor['name'],f,active))
   bc=actor.get('blink_controls')
   if bc and any(not value(o,'hide_render',f) for o in bc['closed_lines']) and any(not value(o,'hide_render',f) for o in bc['open_objects']):eye_errors.append((actor['name'],f))
 report={'master_frames':n,'duration':n/scene.render.fps,'checked_object_frames':checked,'ownership_groups':len(g),'outside_scene_visibility_violations':violations[:50],'expression_conflicts':expression_errors[:50],'open_closed_eye_conflicts':eye_errors[:50],'permanent_hidden_objects':len(permanent)}
 assert not violations and not expression_errors and not eye_errors,report
 return report
