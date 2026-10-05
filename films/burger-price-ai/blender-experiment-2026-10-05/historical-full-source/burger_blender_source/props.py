"""Volumetric bicycle and food props. +X forward, +Z up; no flattened cards."""
import bpy,math,random
from mathutils import Vector, Matrix, Euler
PAL={'ink':'263B43','green':'236F51','greenlight':'46917A','chrome':'BDC6BA','cream':'FFF4D6','gold':'E7AD45','bun':'DC8E3F','patty':'5C352A','lettuce':'66A241','cheese':'F5C750','tomato':'C85038','skin':'E9AC83'}
def col(c):
 h=PAL.get(c,c).lstrip('#');v=[int(h[i:i+2],16)/255 for i in (0,2,4)];return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in v)+(1,)
def empty(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.parent=parent;o.location=loc;return o

def sphere(n,p,scale,c,parent=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12);o=bpy.context.object;o.name=n;o.location=p;o.scale=scale;o.color=col(c);o.parent=parent
 for f in o.data.polygons:f.use_smooth=True
 return o

def box(n,p,dim,c,parent=None,bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.name=n;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.location=p;o.color=col(c);o.parent=parent
 if bevel:
  m=o.modifiers.new('Rounded edges','BEVEL');m.width=bevel;m.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o

def line(n,points,r,c,parent=None):
 cu=bpy.data.curves.new(n,'CURVE');cu.dimensions='3D';cu.resolution_u=10;cu.bevel_depth=r;cu.bevel_resolution=3;sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for b,p in zip(sp.bezier_points,points):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(n,cu);bpy.context.collection.objects.link(o);o.parent=parent;o.color=col(c);return o

def rod(n,a,b,r,c,parent=None):
 a,b=Vector(a),Vector(b);mid=(a+b)/2;bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=(b-a).length);o=bpy.context.object;o.name=n;o.location=mid;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.color=col(c);o.parent=parent
 for f in o.data.polygons:f.use_smooth=True
 return o

def torus(n,p,major,minor,c,parent=None,rotation=(math.pi/2,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=48,minor_segments=8);o=bpy.context.object;o.name=n;o.location=p;o.rotation_euler=rotation;o.color=col(c);o.parent=parent;return o

def key(o,prop,value,frame,mode='BEZIER'):
 setattr(o,prop,value)
 if frame is not None:
  # Constant holds need only their state-change keys. Keep random-access bakes
  # conservative when future keys already exist; this never approximates motion.
  if mode=='CONSTANT' and o.animation_data and o.animation_data.action:
   curves=[fc for fc in o.animation_data.action.fcurves if fc.data_path==prop]
   vals=list(value) if hasattr(value,'__len__') and not isinstance(value,str) else [value]
   if len(curves)==len(vals) and all(len(fc.keyframe_points) and fc.keyframe_points[-1].co.x<=frame and fc.keyframe_points[-1].co.y==float(vals[fc.array_index]) for fc in curves):
    return
  o.keyframe_insert(data_path=prop,frame=frame)
  for fc in o.animation_data.action.fcurves:
   if fc.data_path==prop:
    pts=fc.keyframe_points
    if len(pts) and abs(pts[-1].co[0]-frame)<.01:pts[-1].interpolation=mode
    else:
     for pt in pts:
      if abs(pt.co[0]-frame)<.01:pt.interpolation=mode

def create_bicycle(name='Touring bicycle'):
 root=empty(name);wheels=[]
 for tag,x in [('rear',-.85),('front',.85)]:
  wheel=empty(name+' '+tag+' wheel',root,(x,0,.53));wheels.append(wheel)
  torus(name+' tire',(0,0,0),.478,.052,'ink',wheel)
  for yy in [-.037,.037]:torus(name+' rim',(0,yy,0),.438,.016,'chrome',wheel)
  rod(name+' axle',(0,-.10,0),(0,.10,0),.055,'gold',wheel)
  for i in range(12):
   t=i*math.tau/12;rod(name+' spoke',(0,(-1 if i%2 else 1)*.05,0),(.427*math.cos(t),0,.427*math.sin(t)),.009,'chrome',wheel)
  # Small amber reflectors make wheel travel direction readable in the proof.
  for angle in [math.pi/4,math.pi*1.25]:
   q=box(name+' amber wheel reflector',(.30*math.cos(angle),-.014,.30*math.sin(angle)),(.105,.05,.05),'gold',wheel,.02);q.rotation_euler.y=-angle
 # The triangles are structural tubes in 3D, not projected shapes.
 for a,b in [((-.85,0,.53),(-.36,0,1.19)),((-.36,0,1.19),(0,0,.56)),((0,0,.56),(-.85,0,.53)),((-.36,0,1.19),(.60,0,1.25)),((.60,0,1.25),(0,0,.56)),((.60,0,1.25),(.85,0,.53))]:rod(name+' frame',a,b,.044,'green',root)
 for yy in [-.09,.09]:
  rod(name+' rear stay',(0,0,.56),(-.85,yy,.53),.025,'greenlight',root)
  rod(name+' fork',(.60,yy,1.25),(.85,yy,.53),.028,'greenlight',root)
 rod(name+' seatpost',(-.36,0,1.17),(-.38,0,1.32),.030,'chrome',root)
 sphere(name+' leather saddle',(-.42,0,1.36),(.235,.155,.062),'ink',root)
 rod(name+' handle stem',(.60,0,1.25),(.67,0,1.58),.032,'chrome',root)
 line(name+' swept handlebar',[(.70,-.31,1.61),(.62,-.20,1.63),(.67,0,1.58),(.62,.20,1.63),(.70,.31,1.61)],.027,'chrome',root)
 for yy in [-.27,.27]:
  rod(name+' rubber grip',(.70,yy-.07,1.61),(.70,yy+.07,1.61),.045,'ink',root)
  line(name+' brake lever',[(.72,yy,1.58),(.80,yy,1.55),(.83,yy+.015,1.58)],.016,'ink',root)
  line(name+' brake cable',[(.74,yy,1.58),(.95,yy,1.36),(.70,yy,1.12)],.009,'ink',root)
 sphere(name+' bell',(.69,-.15,1.70),(.073,.073,.042),'gold',root)
 for x in [-.85,.85]:
  line(name+' curved mudguard',[(x+.575*math.cos(t),0,.53+.575*math.sin(t)) for t in [math.pi*.10+i*math.pi*.8/12 for i in range(13)]],.027,'greenlight',root)
  for yy in [-.04,.04]:line(name+' rack',[(x-.23,yy,1.08),(x+.20,yy,1.08)],.015,'chrome',root)
 # Mechanical drive: angular motion about +Y sends the top forward (+X).
 gear=empty(name+' crank',root,(0,0,.56))
 torus(name+' chainring',(0,.115,0),.155,.025,'gold',gear)
 pedals=[]
 for i,yy in [(0,-.15),(1,.15)]:
  z=.18 if i==0 else -.18;rod(name+' crank arm',(0,yy,0),(0,yy,z),.023,'chrome',gear)
  pe=empty(name+' pedal '+str(i),gear,(0,yy,z));box(name+' pedal platform',(0,0,0),(.245,.14,.055),'ink',pe,.025);pedals.append(pe)
 line(name+' chain',[(-.85,.14,.64),(-.35,.14,.71),(0,.14,.72),(.17,.14,.56),(0,.14,.39),(-.45,.14,.42),(-.85,.14,.44),(-.94,.14,.53),(-.85,.14,.64)],.010,'ink',root)
 stand=empty(name+' kickstand',root,(0,0,.54))
 rod(name+' stand leg',(0,0,0),(-.17,-.33,-.505),.021,'ink',stand)
 box(name+' stand foot',(-.17,-.33,-.505),(.14,.10,.04),'ink',stand,.02)
 return {'root':root,'wheels':wheels,'crank':gear,'pedals':pedals,'stand':stand,'radius':.53,'grips':[(.70,-.27,1.61),(.70,.27,1.61)],'seat':(-.42,0,1.36)}

def pose_bicycle(bike,position=(0,0,0),heading=0,distance=0,phase=None,lean=0,parked=False,frame=None):
 root=bike['root'];key(root,'location',position,frame,'LINEAR');key(root,'rotation_euler',(lean,0,heading),frame,'LINEAR')
 wheel_phase=distance/bike['radius'];phase=wheel_phase/1.30 if phase is None else phase
 for w in bike['wheels']:key(w,'rotation_euler',(0,wheel_phase,0),frame,'LINEAR')
 key(bike['crank'],'rotation_euler',(0,phase,0),frame,'LINEAR')
 for p in bike['pedals']:key(p,'rotation_euler',(0,-phase,0),frame,'LINEAR')
 key(bike['stand'],'rotation_euler',(0,1.3*(1-float(parked)),0),frame,'LINEAR')
 M=Matrix.Translation(Vector(position))@Euler((lean,0,heading)).to_matrix().to_4x4()
 grips=[M@Vector(q) for q in bike['grips']]
 feet=[]
 for i,yy in [(0,-.15),(1,.15)]:
  ang=phase+(math.pi if i else 0)
  feet.append(M@Vector((.18*math.sin(ang),yy,.56+.18*math.cos(ang)+.09)))
 seat=M@Vector(bike['seat'])
 return {'hands':grips,'feet':feet,'seat':seat,'phase':phase}

def mesh(n,verts,faces,c,parent=None):
 m=bpy.data.meshes.new(n);m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new(n,m);bpy.context.collection.objects.link(o);o.parent=parent;o.color=col(c)
 for f in m.polygons:f.use_smooth=True
 return o

def create_burger(name='The same burger',position=(0,0,0),scale=1):
 root=empty(name,loc=position);root.scale=(scale,)*3
 sphere(name+' lower bun',(0,0,.070),(.365,.335,.10),'bun',root)
 bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=.337,depth=.10);o=bpy.context.object;o.name=name+' patty';o.location=(0,0,.17);o.color=col('patty');o.parent=root;m=o.modifiers.new('Cooked rounded edge','BEVEL');m.width=.035;m.segments=3;o.modifiers.new('Normals','WEIGHTED_NORMAL')
 # Cheese corners droop in all four directions, rather than a flat front sticker.
 vs=[(-.29,-.29,.235),(.29,-.29,.235),(.29,.29,.235),(-.29,.29,.235),(-.33,-.31,.18),(.33,-.31,.17),(.33,.31,.18),(-.33,.31,.17)]
 mesh(name+' cheese',vs,[(0,1,2,3),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'cheese',root)
 for layer in [0,1]:
  verts=[(0,0,.28+layer*.025)]+[( (.358+.027*math.sin(i*math.tau/8))*math.cos(i*math.tau/40),(.358+.027*math.sin(i*math.tau/8))*math.sin(i*math.tau/40),.28+layer*.025+.018*math.sin(i*math.tau/5)) for i in range(40)]
  mesh(name+' ruffled lettuce',verts,[(0,i+1,(i+1)%40+1) for i in range(40)],'lettuce',root)
 bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=.32,depth=.045);o=bpy.context.object;o.name=name+' tomato';o.location=(0,0,.315);o.color=col('tomato');o.parent=root
 verts=[];faces=[];rings=9;N=40
 for j in range(rings+1):
  phi=(j/rings)*math.pi/2;rr=.365*math.sin(phi);zz=.34+.23*math.cos(phi)
  for i in range(N):ang=i*math.tau/N;verts.append((rr*math.cos(ang),rr*math.sin(ang),zz))
 for j in range(rings):
  for i in range(N):faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
 faces.append(tuple(range(rings*N,(rings+1)*N)))
 mesh(name+' domed upper bun',verts,faces,'bun',root)
 rng=random.Random(73)
 for i in range(18):
  r=.30*math.sqrt(rng.random());ang=rng.random()*math.tau;x=r*math.cos(ang);y=r*math.sin(ang);z=.34+.23*math.sqrt(1-(r/.365)**2)
  se=sphere(name+' sesame seed',(x,y,z+.011),(.034,.014,.009),'cream',root);normal=Vector((x/.365**2,y/.365**2,(z-.34)/.23**2));se.rotation_euler=normal.to_track_quat('Z','Y').to_euler();se.rotation_euler.rotate_axis('Z',rng.random()*math.pi)
 return root

def create_coin(name,position=(0,0,0)):
 root=empty(name,loc=position);torus(name+' rim',(0,0,0),.087,.012,'gold',root,rotation=(0,0,0))
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.084,depth=.02);o=bpy.context.object;o.name=name+' coin disc';o.parent=root;o.color=col('gold')
 return root
