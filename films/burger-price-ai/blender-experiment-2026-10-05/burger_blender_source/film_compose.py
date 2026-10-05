"""Camera-safe typesetting, shot visibility and animation reuse for the faithful film.
All output consists of ordinary Blender objects and baked keyframes, no handlers.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
import props

_FONTS=Path(__file__).resolve().parent/'fonts'
FONT_PATH=str(_FONTS/'DejaVuSans.ttf') if (_FONTS/'DejaVuSans.ttf').exists() else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD_PATH=str(_FONTS/'DejaVuSans-Bold.ttf') if (_FONTS/'DejaVuSans-Bold.ttf').exists() else '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def subtree(root):return [root]+list(root.children_recursive)
def key(o,p,v,f,constant=False):props.key(o,p,v,f,'CONSTANT' if constant else 'LINEAR')
def visibility(objects,on,f):
 for o in objects:
  key(o,'hide_render',not on,f,True);key(o,'hide_viewport',not on,f,True)
def root_visibility(root,on,f):visibility(subtree(root),on,f)

def make_overlay(camera,name):
 r=props.empty(name,parent=camera,loc=(0,0,-1));r['screen_overlay']=True
 return {'root':r,'objects':[r],'text':[]}

def add_text(overlay,name,text,xy,size=.06,color='253A40',bold=False,width=.84,align='CENTER'):
 data=bpy.data.curves.new(name,'FONT');data.body=text;data.align_x=align;data.align_y='TOP';data.size=size;data.space_line=1.10;data.extrude=0;data.resolution_u=8
 path=BOLD_PATH if bold else FONT_PATH
 font=next((f for f in bpy.data.fonts if Path(f.filepath).name==Path(path).name),None)
 if font is None:font=bpy.data.fonts.load(path)
 data.font=font
 o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.parent=overlay['root'];o.location=(xy[0],xy[1],.007);o.color=props.col(color)
 # Measure only this small text datablock at construction, not in each bake frame.
 bpy.context.view_layer.update()
 if o.dimensions.x>width:data.size*=width/o.dimensions.x
 overlay['objects'].append(o);overlay['text'].append(o);return o

def add_panel(overlay,name,xy,dimensions,color='FFF1D7',radius=.022):
 o=props.box(name,(xy[0],xy[1],0),(dimensions[0],dimensions[1],.004),color,overlay['root'],radius)
 overlay['objects'].append(o);return o

def pose_overlay(overlay,camera,f,visible=True,scale=1):
 # Horizontal sensor fit: view width at unit distance is sensor_width/lens.
 width=camera.data.sensor_width/camera.data.lens
 key(overlay['root'],'location',(0,0,-1),f,True);key(overlay['root'],'scale',(width*scale,)*3,f,True)
 visibility(overlay['objects'],visible,f)

def snapshot_channels(objects,frames):
 """Freeze existing evaluated channels before extending their actions to later shots."""
 tracks=[];seen=set()
 for o in objects:
  ids=[o]
  if getattr(o,'data',None):ids.append(o.data)
  for owner in ids:
   if owner.as_pointer() in seen:continue
   seen.add(owner.as_pointer());ad=getattr(owner,'animation_data',None)
   if not ad or not ad.action:continue
   for fc in ad.action.fcurves:
    values=[float(fc.evaluate(f)) for f in frames]
    tracks.append((owner,fc.data_path,fc.array_index,values,fc.data_path in {'hide_render','hide_viewport'}))
 return {'frames':list(frames),'tracks':tracks}

def copy_snapshot(snapshot,start_frame):
 for owner,path,index,values,constant in snapshot['tracks']:
  if not owner.animation_data:owner.animation_data_create()
  if not owner.animation_data.action:owner.animation_data.action=bpy.data.actions.new(owner.name+' reused action')
  action=owner.animation_data.action;fc=action.fcurves.find(path,index=index)
  if fc is None:fc=action.fcurves.new(path,index=index)
  for i,v in enumerate(values):
   pt=fc.keyframe_points.insert(start_frame+i,v,options={'FAST','REPLACE'});pt.interpolation='CONSTANT' if constant else 'LINEAR'
  fc.update()

def camera_pose(camera,position,target,lens,f):
 p=Vector(position);t=Vector(target);key(camera,'location',p,f,True);key(camera,'rotation_euler',(t-p).to_track_quat('-Z','Y').to_euler(),f,True)
 camera.data.lens=lens;camera.data.keyframe_insert(data_path='lens',frame=f)

def constant_visibility_and_camera(camera):
 for ob in bpy.data.objects:
  ad=ob.animation_data
  if not ad or not ad.action:continue
  for fc in ad.action.fcurves:
   if fc.data_path in {'hide_render','hide_viewport'} or ob==camera:
    for k in fc.keyframe_points:k.interpolation='CONSTANT'
 if camera.data.animation_data:
  for fc in camera.data.animation_data.action.fcurves:
   for k in fc.keyframe_points:k.interpolation='CONSTANT'
