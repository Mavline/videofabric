import bpy,math,json,bmesh
from pathlib import Path
P=Path(__file__).resolve().parent;O=P/'faithful_output';s=bpy.context.scene;s.frame_set(1)
# Camera-side dressing must not mask the source's register/hand action.
for o in bpy.data.objects:
 if o.name.startswith('SUNNY TIMBER BURGERS') and any(q in o.name for q in ['paper cup',' shelf','interior back worktop','back cupboard doors','cupboard joint','cupboard knob']):
  o.hide_render=True;o.hide_viewport=True
reg=bpy.data.objects['SUNNY TIMBER BURGERS REGISTER']
for o in reg.children:
 if any(q in o.name for q in ['display frame','green display','display digits']):o.location.z-=.24
 if 'display stem' in o.name:o.scale.z*=.43;o.location.z-=.12
# Rebuild the bitten crown as a clean watertight sculpted crescent, not intersecting Boolean layers.
root=bpy.data.objects['The one burger'];crown=bpy.data.objects['The one burger domed upper bun bitten'];R=.365;cx=.34;cy=-.12;rb=.155;dc=math.hypot(cx,cy);phi=math.atan2(cy,cx);alpha=math.acos((R*R+dc*dc-rb*rb)/(2*R*dc));N=96;M=10
verts=[(0,0,.57)];faces=[];bounds=[]
for i in range(N):
 theta=2*math.pi*i/N;delta=(theta-phi+math.pi)%(2*math.pi)-math.pi;rr=R
 if abs(delta)<=alpha:
  c=dc*math.cos(delta);rr=c-math.sqrt(max(0,c*c-(dc*dc-rb*rb)))
 bounds.append((theta,rr))
for j in range(1,M+1):
 for th,rr in bounds:
  r=rr*j/M;verts.append((r*math.cos(th),r*math.sin(th),.34+.23*math.sqrt(max(0,1-(r/R)**2))))
for i in range(N):faces.append((0,1+i,1+(i+1)%N))
for j in range(M-1):
 for i in range(N):a=1+j*N+i;b=1+j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
base=len(verts);verts.extend([(rr*math.cos(th),rr*math.sin(th),.34) for th,rr in bounds]);center=len(verts);verts.append((0,0,.34))
wallfaces=[]
for i in range(N):
 top=1+(M-1)*N+i;nexttop=1+(M-1)*N+(i+1)%N;faces.append((top,nexttop,base+(i+1)%N,base+i));faces.append((center,base+(i+1)%N,base+i))
 if bounds[i][1]<R-.0005 or bounds[(i+1)%N][1]<R-.0005:wallfaces.append((top,nexttop,base+(i+1)%N,base+i))
mesh=bpy.data.meshes.new('Clean sculpted bite crown');mesh.from_pydata(verts,[],faces);mesh.update();crown.data=mesh
for p in mesh.polygons:p.use_smooth=True
# Soft bread-colored interior, just offset inside the crescent to prevent z-fighting.
wm=bpy.data.meshes.new('Bread crumb interior');wv=[(x+.003*(cx-x)/max(.001,math.hypot(cx-x,cy-y)),y+.003*(cy-y)/max(.001,math.hypot(cx-x,cy-y)),z) for x,y,z in verts];wm.from_pydata(wv,[],wallfaces);wm.update();wo=bpy.data.objects.new('Visible soft bread interior',wm);bpy.context.collection.objects.link(wo);wo.parent=root;wo.color=(.66,.42,.19,1)
for p in wm.polygons:p.use_smooth=True
wo.animation_data_create();wo.animation_data.action=crown.animation_data.action.copy()
# Filling remains below the small top-corner bite, with no overlapping Boolean sheets.
for o in list(root.children):
 if o is crown or o is wo:continue
 if o.name.endswith(' bitten'):
  original=bpy.data.objects.get(o.name[:-7])
  if original:
   if original.animation_data:
    for fc in list(original.animation_data.action.fcurves):
     if fc.data_path in {'hide_render','hide_viewport'}:original.animation_data.action.fcurves.remove(fc)
   original.hide_render=False;original.hide_viewport=False
  bpy.data.objects.remove(o,do_unlink=True)
  continue
 if 'sesame seed' in o.name and (o.location.x-cx)**2+(o.location.y-cy)**2<rb*rb:
  for f,hide in [(1,False),(321,True)]:
   o.hide_render=hide;o.hide_viewport=hide;o.keyframe_insert(data_path='hide_render',frame=f);o.keyframe_insert(data_path='hide_viewport',frame=f)
  for fc in o.animation_data.action.fcurves:
   for pt in fc.keyframe_points:pt.interpolation='CONSTANT'
s.frame_set(157);bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath or str(P/'burger-faithful-proof.blend'))
print('PROOF_GEOMETRY_READY',flush=True)
