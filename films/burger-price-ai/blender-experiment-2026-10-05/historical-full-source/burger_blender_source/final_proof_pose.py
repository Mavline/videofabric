import bpy,math
from pathlib import Path
P=Path(__file__).resolve().parent;s=bpy.context.scene
b=bpy.data.objects['The one burger']
for fc in b.animation_data.action.fcurves:
 if fc.data_path=='rotation_euler' and fc.array_index==1:
  for k in fc.keyframe_points:k.co.y*=3.75
# Bring the visible soles onto the pedal tops during riding, blending out at foot plant.
for side,stop in [('L',3.6),('R',4.55)]:
 foot=bpy.data.objects['The cyclist | shoe group '+side]
 if foot.animation_data:
  for fc in foot.animation_data.action.fcurves:
   if fc.data_path=='location' and fc.array_index==2:
    for pt in fc.keyframe_points:
     t=(pt.co.x-1)/24;q=max(0,min(1,(t-3.0)/(stop-3.0)));q=q*q*(3-2*q);pt.co.y+=.0775*(1-q)
s.frame_set(157);bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath or str(P/'burger-faithful-proof.blend'))
