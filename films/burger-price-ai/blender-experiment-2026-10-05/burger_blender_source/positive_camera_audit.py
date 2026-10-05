import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

def audit(scene,a):
 checks=[]
 def add(label,t,point_object,offset=(0,0,0),visible_object=None):
  scene.frame_set(round(t*24)+1);point=point_object.matrix_world@Vector(offset);q=world_to_camera_view(scene,scene.camera,point);ob=visible_object or point_object
  row={'scene':label,'seconds':t,'projection':list(q),'render_visible':not ob.hide_render}
  assert q.z>0 and 0<q.x<1 and 0<q.y<1 and not ob.hide_render,row
  checks.append(row)
 for label,t in [('arrival',2),('first handoff',7.2),('first bite',14.3),('fences',23.5),('fountain',28),('columns',32.3),('second handoff',36.8),('second price',44),('return ride',87),('return bite',95.3)]:
  add(label,t,a['youth']['joints']['head'],visible_object=a['youth']['parts']['head_mesh'])
 add('title burger',19.5,bpy.data.objects['Original title bouncing burger'],(0,0,.28),next(o for o in bpy.data.objects['Original title bouncing burger'].children if o.type=='MESH'))
 for label,t in [('machine intake',49.7),('machine ticket',62)]:add(label,t,a['pricing']['machine']['root'],(0,0,2.4),bpy.data.objects['Pricing engine cast steel body'])
 for label,t in [('owner quote',68.2),('owner keypad',77.3)]:
  actor=a['pricing']['office']['owner'];add(label,t,actor['joints']['head'],visible_object=actor['parts']['head_mesh'])
 add('empty booth cook',103,a['seller']['joints']['head'],visible_object=a['seller']['parts']['head_mesh'])
 return {'required_subject_checks':len(checks),'checks':checks}
