"""Faithful volumetric source scenes 09–14. No renderer, handler, or global-state setup.

API
  create_pricing_sequence(origin=(0,0,0), include_reaction=True) -> assets
  pose_scene(assets, scene_id, t, frame=None, camera=None, duration=None) -> state
  bake_scene(assets, scene_id, start_frame, duration=None, fps=24, camera=None)

`t` is SOURCE-SCENE-LOCAL seconds unless duration is supplied. With a longer
length, gestures use the readable beat schedule and pauses land on settled poses.
Return state includes camera, captions, event state and physical anchors.
Collections live on separate real 3D sets, translated by origin. Only ordinary
transform/visibility/curve-point keyframes are written. Integrator owns cuts,
captions, dip-to-black, source caveat, and final film render.
"""
import bpy, math, random
from mathutils import Vector, Matrix
import character as ch
import props
import environment as env

SOURCE_LENGTHS={9:2.0,10:2.0,11:1.0,12:1.5,13:1.5,14:2.0}
SCENE_NAMES={9:'price-689',10:'machine-feed',11:'periscope-view',12:'machine-ticket',13:'owner-ticket',14:'owner-types'}
CAPTIONS={
 9:[{'text':'Reuters, Sept 29, 2026','at':.375,'box':(.07,.12,.38,.08),'kind':'source'}, {'text':'+21%','at':.25,'box':(.07,.21,.34,.12),'kind':'red'}],
 10:[{'text':'nearly 14,000 restaurants','at':.25,'box':(.07,.12,.86,.055)}, {'text':'millions of orders a day','at':.5,'box':(.07,.18,.86,.055)}, {'text':'Illustration','at':0,'box':(.07,.9,.30,.035),'kind':'label'}],
 11:[{'text':'The engine recommends\nan "optimal price"\nfor each restaurant.','at':.25,'box':(.07,.10,.86,.18)}, {'text':'Illustration','at':0,'box':(.07,.9,.30,.035),'kind':'label'}],
 12:[{'text':'The engine recommends\nan "optimal price"\nfor each restaurant.','at':0,'box':(.07,.10,.86,.18)}, {'text':'Illustration','at':0,'box':(.07,.9,.30,.035),'kind':'label'}],
 13:[{'text':'McDonald\'s:\n"a tool,\nnot a mandate"','at':0,'box':(.07,.11,.86,.18)}, {'text':'Illustration','at':0,'box':(.07,.91,.30,.035),'kind':'label'}],
 14:[{'text':'Ex-owner:\n"You don\'t really\nhave much of a\nchoice anymore."','at':0,'box':(.07,.68,.48,.19)}, {'text':'Illustration','at':0,'box':(.07,.91,.30,.035),'kind':'label'}]
}
# Added holds are legal only at clean gesture boundaries. Scene 10 pauses before
# the second gulp and after all inflow; its particles use an independent clock.
READING_HOLDS={9:[(1.5,1)],10:[(1.25,.3125),(2.0,.6875)],11:[(.70,1)]}
# Canonical reading schedule: (extended wall-local seconds, source-local seconds).
# Duplicate source values are intentional rests; none is a moving pose. For other
# longer lengths, interpolate wall knot positions between original and canonical
# timings. Public pose/bake APIs and original-duration behavior remain unchanged.
READABLE_CLOCKS={
 12:{'duration':8.0,'knots':[(0,0),(.25,.125),(.50,.25),(.75,.375),(1.0,.50),(1.25,.70),(2.875,.70),(3.0,.75),(10/3,.875),(11/3,1.0),(4.0,1.125),(4.2,1.375),(8.0,1.50)]},
 13:{'duration':7.0,'knots':[(0,0),(.50,.18),(.75,.36),(1.80,.50),(4.375,.70),(4.50,1.0),(5.60,1.50),(7.0,1.50)]},
 14:{'duration':9.0,'knots':[(0,0),(.25,.08),(.50,.20),(1.0,.32),(1.25,.45),(1.95,.45),(2.0,.50),(2.70,.85),(3.0,.95),(3.375,.95),(3.50,1.0),(3.75,1.125),(4.0,1.25),(4.25,1.375),(4.50,1.50),(5.20,1.63),(5.25,1.80),(9.0,2.0)]}
}
# Source-local intervals after which every moving part is settled.
# These are also convenient audit anchors for the final timeline integrator.
SETTLED_SOURCE_TIMES={10:[1.25,2.0],11:[.70],12:[.70,1.375],13:[.70,1.50],14:[.45,.95,1.80]}
PAL={'machine':'478E94','dark':'285B63','ink':'263A40','cream':'FFF0C8','paper':'FAF4DD','red':'B9403C','gold':'DDAE46','green':'82B784','white':'FFF8E8','wall':'8B817D','night':'697780','floor':'ADB2AB','wood':'A5957F','pink':'DF7894','stone':'D9D3C4','water':'8BCACB'}

def C(c):return props.col(PAL.get(c,c))
def E(n,p=(0,0,0),parent=None):return props.empty(n,parent,p)
def B(n,p,d,c,parent=None,r=.035):return props.box(n,p,d,PAL.get(c,c),parent,r)
def S(n,p,d,c,parent=None):return props.sphere(n,p,d,PAL.get(c,c),parent)
def L(n,pts,r,c,parent=None):return props.line(n,pts,r,PAL.get(c,c),parent)
def R(n,a,b,r,c,parent=None):return props.rod(n,a,b,r,PAL.get(c,c),parent)
def K(o,prop,val,f=None):props.key(o,prop,val,f,'LINEAR')
def visible(root,on,f=None):
 for o in [root]+list(root.children_recursive):
  for prop in ['hide_render','hide_viewport']:props.key(o,prop,not on,f,'CONSTANT')
def tx(n,body,p,size=.20,c='ink',parent=None,width=None):
 o=env.text(n,body,p,size,PAL.get(c,c),parent,True,width);return o

def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def phase(t,a,b):return smooth((t-a)/(b-a))
def mix(a,b,k):return Vector(a).lerp(Vector(b),k)
def world(root,p):return root.matrix_world@Vector(p)
def at(root,p):return root.location+Vector(p)
def _authored_world_matrix(obj):
 # The pricing rig's constraint-free empties can keep stale matrix_world values
 # while hidden. Compose their authored transforms without dependency evaluation.
 if obj.rotation_mode=='QUATERNION':rotation=obj.rotation_quaternion.to_matrix().to_4x4()
 elif obj.rotation_mode=='AXIS_ANGLE':
  angle,x,y,z=obj.rotation_axis_angle;rotation=Matrix.Rotation(angle,4,Vector((x,y,z)))
 else:rotation=obj.rotation_euler.to_matrix().to_4x4()
 local=Matrix.Translation(obj.location)@rotation@Matrix.Diagonal((*obj.scale,1.0))
 return _authored_world_matrix(obj.parent)@obj.matrix_parent_inverse@local if obj.parent else local
def camera_spec(location,target,lens=44):return {'location':tuple(location),'target':tuple(target),'lens':lens,'sensor_fit':'HORIZONTAL'}
def retime(scene_id,t,duration=None):
 length=SOURCE_LENGTHS[scene_id]
 if duration is None or duration<=length:return max(0,min(length,t if duration is None else t*length/duration))
 if scene_id in READABLE_CLOCKS:
  clock=READABLE_CLOCKS[scene_id];amount=min(1.0,(duration-length)/(clock['duration']-length))
  knots=[(source+amount*(wall-source),source) for wall,source in clock['knots']]
  knots[-1]=(duration,length)
  if t<=0:return 0.0
  for (a,sa),(b,sb) in zip(knots,knots[1:]):
   if t<=b:return sa+(sb-sa)*max(0,min(1,(t-a)/(b-a)))
  return length
 extra=duration-length;shift=0
 for hold,portion in READING_HOLDS[scene_id]:
  wall=hold+shift;added=extra*portion
  if t<wall:return max(0,t-shift)
  if t<=wall+added:return hold
  shift+=added
 return min(length,max(0,t-shift))

def _set_camera(camera,spec,f):
 if not camera:return
 K(camera,'location',spec['location'],f)
 K(camera,'rotation_euler',(Vector(spec['target'])-Vector(spec['location'])).to_track_quat('-Z','Y').to_euler(),f)
 camera.data.type='PERSP';camera.data.sensor_fit=spec.get('sensor_fit','HORIZONTAL');camera.data.lens=spec['lens'];camera.data.clip_start=.03;camera.data.clip_end=200
 if f is not None:camera.data.keyframe_insert('lens',frame=f)

def _room(name,root,night=True):
 B(name+' floor',(0,0,-.13),(15,14,.25),'floor',root)
 B(name+' rear wall',(0,2.1,5.7),(12,.35,11.4),'night' if night else 'wall',root)
 # Sparse physically recessed panel seams and tonal masonry, not a flat backdrop.
 rng=random.Random(811 if night else 31)
 for i in range(34):
  x=rng.uniform(-5.7,5.7);z=rng.uniform(.2,6.8)
  B(name+' tonal brick '+str(i),(x,1.915,z),(rng.uniform(.30,.75),.025,rng.uniform(.04,.13)),'64717A' if night else '96887D',root,.008)
 for z in [.15,6.7]:B(name+' wall moulding',(0,1.83,z),(12,.12,.11),'dark' if night else 'wood',root)
 for x in range(-6,7):L(name+' floor board seam',[(x,-6,.008),(x,2,.008)],.007,'909D9A',root)

def _funnel(name,root):
 # Real open hopper with wall thickness, taper and visibly hollow mouth.
 verts=[]
 rings=[(3.71,1.36,.63),(3.15,.36,.30),(3.71,1.23,.51),(3.20,.28,.23)]
 for z,w,d in rings:verts += [(-w,-d,z),(w,-d,z),(w,d,z),(-w,d,z)]
 faces=[]
 for a,b in [(0,4),(8,12),(0,8),(4,12)]:
  for i in range(4):faces.append((a+i,a+(i+1)%4,b+(i+1)%4,b+i))
 ob=props.mesh(name+' hollow tapered hopper',verts,faces,PAL['dark'],root)
 B(name+' intake darkness',(0,0,3.23),(.53,.42,.04),'ink',root)
 return ob

def create_ticket(name,parent,width=1.28,height=.93):
 root=E(name,parent=parent);half=width/2
 # Torn zigzag bottom is modeled into the paper edge, with actual thickness.
 verts=[(-half,0,0),(half,0,0),(half,0,-height)]
 for i in range(11,-1,-1):verts.append((-half+width*i/11,0,-height-(.045 if i%2 else 0)))
 face=props.mesh(name+' thick perforated slip',verts,[tuple(range(len(verts)))],PAL['paper'],root)
 solid=face.modifiers.new('Paper thickness','SOLIDIFY');solid.thickness=.018
 header=tx(name+' recommended','RECOMMENDED:',(0,-.018,-.17),max(.27,width*.13),'ink',root)
 # Preserve cap height on a hand-held slip; fit width with modest condensed
 # lettering instead of uniformly shrinking the whole recommendation word.
 bpy.context.view_layer.update()
 if header.dimensions.x>width*.9:header.scale.x*=width*.9/header.dimensions.x
 tx(name+' exact price','$6.89',(0,-.021,-.56),width*.32,'ink',root,width*.91)
 for i in range(12):B(name+' perforation '+str(i),(-half+.055+i*(width-.11)/11,-.017,-.045),(.022,.010,.014),'wood',root,.001)
 return root

def create_price_tag(name,parent,width=1.6,height=.92):
 # Root is the lower-left corner held by the owner.
 root=E(name,parent=parent)
 B(name+' thick tag',(width/2,0,height/2),(width,.055,height),'EEDD64',root,.045)
 for x in [.1,width-.1]:
  disc=env.disc_front(name+' punched hole',(x,-.033,height-.09),.022,.01,'ink',root)
  L(name+' dangling string',[(x,.008,height-.09),(x+.035,.005,height+.12),(x-.018,.003,height+.23)],.012,'wood',root)
 glyphs=[]
 for i,c in enumerate('$6.89'):
  x=width*(.15+.177*i)
  glyphs.append(tx(name+' glyph '+str(i),c,(x,-.042,height*.45),width*.35,'ink',root,width*.20))
 return {'root':root,'glyphs':glyphs,'width':width,'height':height}

def _machine(name,origin):
 root=E(name+' set',origin);_room(name,root,True);body=E(name+' articulated creature',parent=root)
 B(name+' cast steel body',(0,0,2.20),(3.85,1.72,2.35),'machine',body,.18)
 B(name+' top rolled shoulder',(0,0,3.34),(3.93,1.79,.19),'dark',body,.075)
 for side in [-1,1]:
  L(name+' spring leg '+str(side),[(side*.95,0,1.06),(side*.84,-.03,.69),(side*1.02,-.09,.34)],.09,'dark',body)
  S(name+' big shoe '+str(side),(side*1.07,-.20,.19),(.47,.37,.18),'6C5147',body)
 for x in [-1.70,1.70]:
  for z in [1.30,3.13]:S(name+' copper bolt',(x,-.889,z),(.048,.030,.048),'gold',body)
 B(name+' header plate',(0,-.893,3.23),(3.72,.055,.30),'white',body,.035)
 tx(name+' sensitivity label','SENSITIVITY TO PRICE',(0,-.93,3.23),.38,'ink',body,3.50)
 # Gauge is an extruded half-disc with a bezel and 15 physical ticks.
 radius=.78;pz=1.94
 verts=[(0,-.921,pz)]+[(radius*math.cos(math.pi*i/40),-.921,pz+radius*math.sin(math.pi*i/40)) for i in range(41)]
 dial=props.mesh(name+' half round gauge',verts,[tuple(range(len(verts)))],PAL['cream'],body);sol=dial.modifiers.new('Gauge face thickness','SOLIDIFY');sol.thickness=.055
 L(name+' round gauge bezel',[(radius*math.cos(math.pi*i/30),-.928,pz+radius*math.sin(math.pi*i/30)) for i in range(31)]+[(-radius,-.928,pz),(radius,-.928,pz)],.025,'dark',body)
 for i in range(15):
  a=math.radians(20+10*i);R(name+' dial tick '+str(i),(.64*math.cos(a),-.96,pz+.64*math.sin(a)),(.73*math.cos(a),-.96,pz+.73*math.sin(a)),.010,'ink',body)
 for word,x,z,color in [('LOW',-1.36,1.97,'green'),('MEDIUM',0,2.90,'gold'),('HIGH',1.36,1.97,'red')]:
  B(name+' '+word+' patch',(x,-.92,z),(1.55 if word=='MEDIUM' else .96,.035,.34),color,body,.035)
  tx(name+' '+word,word,(x,-.95,z),.42,'white' if word=='HIGH' else 'ink',body,1.45 if word=='MEDIUM' else .90)
 needle=E(name+' gauge needle',(0,-1.01,pz),body)
 R(name+' needle',(0,0,0),(0,0,.66),.018,'ink',needle);S(name+' needle pivot',(0,-1.04,pz),(.07,.035,.07),'red',body)
 # Exact source wording on a quiet two-line plate. Font size is calibrated
 # from rendered glyph bounds, not assumed em-to-pixel conversion (~40 px at 1080).
 B(name+' willingness caption plate',(0,-.912,1.43),(3.83,.06,.60),'paper',body,.025)
 tx(name+' willingness caption line 1','based on willingness to pay',(0,-.953,1.565),.32,'ink',body,3.73)
 tx(name+' willingness caption line 2','in your area',(0,-.953,1.295),.32,'ink',body,3.73)
 B(name+' output lip',(0,-.90,1.02),(1.90,.13,.15),'dark',body,.035)
 B(name+' ticket exit darkness',(0,-.979,1.02),(1.80,.025,.065),'ink',body,.010)
 ticket=create_ticket(name+' output ticket',body,1.70,.78);ticket.location=(0,-1.025,1.82)
 # A wider real slip allows the recommendation header to read as information.
 for obj in ticket.children:
  if obj.type=='FONT':
   obj.scale=(1,1,1)
   if obj.data.body=='RECOMMENDED:':obj.data.size=.42;obj.scale.x=.64;obj.location.z=-.18
   elif obj.data.body=='$6.89':obj.data.size=.50;obj.location.z=-.53
 # A cover obscures unprinted paper until it physically crosses the output slot.
 B(name+' paper feed mask',(0,-1.057,1.965),(1.82,.027,1.87),'machine',body,.005)
 # Gauge/caption are deliberately in front of the feed mask.
 for ob in body.children:
  if any(s in ob.name for s in ['gauge','tick','sensitivity','header','LOW','HIGH','MEDIUM','willingness','pivot']):ob.location.y-=.16
 needle.location.y-=.16
 hopper=E(name+' swallowing hopper',parent=body);_funnel(name,hopper)
 scope=E(name+' periscope',(1.56,.14,3.42),body)
 R(name+' telescoping scope tube',(0,0,-.04),(0,0,1.46),.13,'dark',scope)
 B(name+' elbow head',(-.13,0,1.47),(.60,.47,.43),'dark',scope,.13)
 eye=E(name+' scope eyeball',(-.18,-.26,1.48),scope)
 S(name+' white eye',(0,0,0),(.185,.055,.155),'white',eye);pupil=S(name+' looking pupil',(-.025,-.055,-.01),(.057,.015,.066),'ink',eye)
 lid=B(name+' eyelid',(0,-.075,.19),(.39,.03,.36),'dark',eye,.13)
 # Pinned map and stylized raised land, 140 red restaurants, 12 tiny generic booths.
 maproot=E(name+' purchase map',(0,1.56,5.06),root)
 B(name+' map paper',(0,0,0),(5.3,.12,1.57),'D4CCB0',maproot,.035)
 land=[(-2.2,-.075,.46),(-1.5,-.075,.62),(-.8,-.075,.41),(-.20,-.075,.5),(.7,-.075,.41),(1.5,-.075,.2),(2.1,-.075,-.05),(1.75,-.075,-.35),(.7,-.075,-.42),(-.1,-.075,-.28),(-.65,-.075,-.51),(-1.4,-.075,-.21),(-1.9,-.075,.05)]
 landob=props.mesh(name+' map land relief',land,[tuple(range(len(land)))],'B5C0A4',maproot);so=landob.modifiers.new('Land relief','SOLIDIFY');so.thickness=.025
 rng=random.Random(918);dots=[]
 for i in range(140):
  x=rng.uniform(-2.37,2.37);z=rng.uniform(-.60,.61);ob=S(name+' restaurant '+str(i),(x,-.104,z),(.032,.020,.032),'red',maproot);dots.append(ob)
 for i in range(12):
  x=-2.14+(i%6)*.84;z=-.33+(i//6)*.66
  B(name+' tiny restaurant',(x,-.115,z),(.16,.06,.13),'paper',maproot,.010);B(name+' tiny roof',(x,-.118,z+.08),(.20,.075,.055),'red',maproot,.010)
 for x in [-2.48,2.48]:S(name+' map pin',(x,-.13,.65),(.055,.035,.055),'red',maproot)
 streams=[]
 for i in range(40):
  if i%3:
   item=E(name+' receipt in stream '+str(i),parent=root);B(name+' receipt paper',(0,0,0),(.135,.018,.20),'paper',item,.005)
   for z in [-.045,0,.045]:B(name+' order line',(0,-.013,z),(.080,.008,.010),'ink',item,.001)
  else:
   item=props.create_coin(name+' coin in stream '+str(i));item.parent=root;item.scale=(.8,)*3
  streams.append(item)
 return dict(root=root,body=body,hopper=hopper,scope=scope,eye=eye,pupil=pupil,lid=lid,needle=needle,ticket=ticket,map=maproot,dots=dots,streams=streams)

def _handset(name,parent):
 root=E(name,parent=parent)
 L(name+' curved receiver',[(0,0,-.29),(.04,0,-.11),(.05,0,.12),(0,0,.30)],.075,'dark',root)
 for z in [-.31,.31]:S(name+' receiver cup',(0,-.005,z),(.14,.10,.12),'dark',root)
 return root

def _keypad(name,parent,p=(0,0,0)):
 root=E(name,p,parent);root.rotation_euler=(math.radians(24),0,0)
 # The key face lies in XY, intentionally sloped toward the camera.
 B(name+' keypad shell',(0,0,0),(.84,1.00,.16),'dark',root,.08)
 screen=B(name+' display',(0,.32,.098),(.68,.22,.025),'BBD7BC',root,.025)
 keyobs={};centers={};labels=['1','2','3','4','5','6','7','8','9','.','0','#']
 for i,label in enumerate(labels):
  x=(i%3-1)*.225;y=.10-(i//3)*.212
  ob=B(name+' key '+label,(x,y,.13),(.185,.168,.075),'white',root,.025);keyobs[label]=ob;centers[label]=(x,y,.195)
  t=tx(name+' legend '+label,label,(x,y,.171),.12,'ink',root);t.rotation_euler=(0,0,0)
 display=[]
 for i,label in enumerate('$6.89'):
  ob=tx(name+' display glyph '+str(i),label,(-.23+i*.115,.31,.116),.145,'ink',root,.10);ob.rotation_euler=(0,0,0);display.append(ob)
 return dict(root=root,keys=keyobs,centers=centers,display=display)

def _office(name,origin):
 root=E(name+' set',origin)
 B(name+' floor',(0,0,-.13),(12,12,.25),'floor',root)
 B(name+' warm back wall',(-3.0,0,6.0),(.22,30,12.0),'A38C78',root)
 # Window wall is a modeled opening with sill, thickness and rich street outside.
 for z,h in [(.45,.9),(7.0,4.0)]:B(name+' front wall strip',(2.35,0,z),(.30,30.0,h),'B3A08C',root)
 for y in [-8.56,8.56]:B(name+' window jamb',(2.35,y,3.00),(.38,12.0,4.8),'B3A08C',root)
 for y in [-2.56,2.56]:B(name+' wooden window side',(2.15,y,3.04),(.47,.11,4.02),'wood',root)
 for z in [1.04,5.04]:B(name+' wooden window rail',(2.15,0,z),(.47,5.2,.11),'wood',root)
 B(name+' counter',(1.05,0,1.66),(1.9,6.8,.18),'B0B6A6',root,.065)
 B(name+' counter apron',(1.25,0,.88),(.17,6.7,1.55),'7C968B',root,.035)
 for y in [-2.6,-1.8,-1.0,-.2,.6,1.4,2.2,3.0]:B(name+' panel seam',(1.34,y,.90),(.028,.012,1.45),'657E75',root,.004)
 # Street depth beyond the window: columns, fountain and clipped shrubs.
 B(name+' distant mansion',(8.5,2.2,2.8),(2.4,7.2,5.5),'D7BDB2',root)
 for y in [-.4,1.0,2.4,3.8]:
  env.cylinder(name+' stone column',(6.9,y,2.3),.22,3.6,'stone',root)
  B(name+' column plinth',(6.9,y,.49),(.66,.66,.22),'stone',root)
  B(name+' column capital',(6.9,y,4.10),(.68,.68,.24),'stone',root)
 B(name+' portico lintel',(6.9,1.7,4.35),(.80,5.6,.40),'stone',root)
 S(name+' clipped bush',(5.8,-2.5,.62),(1.1,1.1,.58),'91BA93',root)
 env.cylinder(name+' fountain basin',(5.5,-.75,.33),1.05,.35,'stone',root)
 env.cylinder(name+' water',(5.5,-.75,.515),.94,.045,'water',root)
 env.cylinder(name+' fountain pedestal',(5.5,-.75,.85),.13,.66,'stone',root)
 for i in range(7):
  a=i*math.tau/7;L(name+' fountain jet',[(5.5,-.75,1.7),(5.5+.40*math.cos(a),-.75+.40*math.sin(a),1.87),(5.5+.72*math.cos(a),-.75+.72*math.sin(a),.55)],.018,'88BABC',root)
 owner=ch.create_character(name+' owner','vendor',tuple(at(root,(-.33,-.66,1.24))))
 ch.blink_character(owner,0)
 # Back apron straps and bow preserve the rear three-quarter source design.
 for sy in [-1,1]:L(name+' back crossed apron strap', [(-.235,sy*.26,.70),(-.255,0,.31),(-.258,-sy*.24,-.08)],.025,'white',owner['root'])
 for sy in [-1,1]:L(name+' apron bow',[(-.28,0,-.07),(-.30,sy*.13,-.02),(-.30,sy*.17,-.12),(-.28,0,-.07)],.020,'white',owner['root'])
 ticket=create_ticket(name+' caught recommendation',root,1.12,.86)
 phone=E(name+' ringing phone',(.66,-2.10,1.82),root);B(name+' telephone base',(0,0,0),(.48,.56,.21),'dark',phone,.09)
 for i in range(9):B(name+' telephone key',((i%3-1)*.093,-.08+(i//3)*.08,.115),(.062,.052,.025),'white',phone,.006)
 receiver=_handset(name+' receiver',root)
 cord=L(name+' coiled phone cord',[(.66,-2.1,1.84),(.35,1.25,1.25),(.10,.5,1.1),(.2,-.9,2.65)],.017,'dark',root)
 keypad=_keypad(name,root,(.63,-1.09,1.86))
 tag=create_price_tag(name+' owner-held tag',root,1.45,.91)
 sigh=L(name+' sigh breath',[(0,0,0),(.12,0,.025),(.22,0,-.03),(.32,0,.01)],.022,'C0C5B9',root)
 # Simple source register remains real volume beyond the phone.
 B(name+' register body',(.80,-2.72,1.99),(.70,.57,.49),'dark',root,.08)
 B(name+' register drawer',(.78,-2.72,1.80),(.77,.60,.10),'machine',root,.025)
 R(name+' register display stem',(.80,-2.72,2.21),(.80,-2.72,2.50),.025,'dark',root)
 B(name+' register display',(.80,-2.72,2.54),(.38,.075,.19),'dark',root,.025)
 # Small warm wall battens establish the booth interior with dimensional shading.
 for y in [-4,-3,-2,-1,0,1,2,3,4]:B(name+' rear wall batten',(-2.86,y,3.3),(.04,.075,6.4),'8E7B6B',root,.01)
 return dict(root=root,owner=owner,ticket=ticket,phone=phone,receiver=receiver,cord=cord,keypad=keypad,tag=tag,sigh=sigh)

def _reaction(name,origin):
 root=E(name+' set',origin)
 B(name+' pavement',(0,0,-.14),(15,15,.25),'D1C5B8',root)
 B(name+' distant pastel house',(-4,4,2.5),(3,4,5),'D8BEB4',root)
 for x in [-3.5,-2.1]:
  env.cylinder(name+' column',(x,2.3,2.0),.24,4.0,'stone',root)
  B(name+' capital',(x,2.3,4.0),(.74,.65,.24),'stone',root)
 B(name+' portico cornice',(-2.8,2.3,4.2),(3.1,.9,.36),'stone',root)
 env.cylinder(name+' fountain basin',(-3.2,.8,.30),1.0,.30,'stone',root)
 for i in range(5):
  a=i*math.tau/5;L(name+' water arc',[(-3.2,.8,1.5),(-3.2+.4*math.cos(a),.8+.4*math.sin(a),1.7),(-3.2+.8*math.cos(a),.8+.8*math.sin(a),.5)],.018,'9ECDD0',root)
 B(name+' booth corner',(1.8,1.6,1.9),(.36,.36,3.8),'E2CB77',root)
 hero=ch.create_character(name+' frozen cyclist','youth',tuple(at(root,(-.45,0,1.24))))
 burger=props.create_burger(name+' trembling burger',scale=1.0);burger.parent=root
 tag=create_price_tag(name+' observed price',root,1.75,1.05);tag['root'].location=(.03,.25,3.65);tag['root'].rotation_euler.z=.47
 for x in [.10,1.65]:L(name+' hanging tag string',[(x,.005,.95),(x,.005,2.8)],.012,'wood',tag['root'])
 stalks=[]
 for i,eye in enumerate(hero['eyes']):
  e=S(name+' eye stalk '+str(i),(.36,eye.location.y,.19),(.14,.057,.057),'white',hero['joints']['head']);stalks.append(e)
 face=hero['parts']['head_mesh'];face.shape_key_add(name='Rest');jaw=face.shape_key_add(name='Source gag jaw drop')
 for point in jaw.data:
  point.co.z-=.105*smooth((-point.co.z-.18)/.30)
 return dict(root=root,hero=hero,burger=burger,tag=tag,stalks=stalks,jaw=jaw,eye_rest=[o.location.copy() for o in hero['eyes']])

def _scope_view(name,origin):
 root=E(name+' set',origin)
 B(name+' green ground',(0,8,-.12),(18,16,.22),'B7CBA8',root)
 B(name+' pastel mansion',(1.2,6,2.2),(6,2.5,4.4),'DCC4BB',root)
 for x in [-1.1,.4,1.9,3.4]:
  env.cylinder(name+' column',(x,4.5,1.9),.22,3.5,'stone',root)
  B(name+' column base',(x,4.5,.18),(.60,.60,.25),'stone',root)
  B(name+' capital',(x,4.5,3.63),(.65,.65,.28),'stone',root)
 B(name+' lintel',(1.2,4.5,3.93),(5.6,.9,.4),'stone',root)
 env.cylinder(name+' fountain basin',(-3.8,3.6,.38),1.2,.45,'stone',root)
 env.cylinder(name+' water pool',(-3.8,3.6,.63),1.08,.025,'water',root)
 for i in range(7):
  a=i*math.tau/7;L(name+' water jet',[(-3.8,3.6,1.6),(-3.8+.5*math.cos(a),3.6+.5*math.sin(a),1.85),(-3.8+.90*math.cos(a),3.6+.9*math.sin(a),.7)],.019,'8FBFC4',root)
 for x in [-5.6,4.3]:S(name+' clipped bush',(x,4,.60),(.8,.8,.64),'88AE8B',root)
 # This is an actual circular aperture in thick 3D housing, not a textured image.
 mask=E(name+' physical lens housing',parent=root)
 vs=[];faces=[];outer=20.0;inner=2.20
 for r in [inner,outer]:
  for i in range(96):a=i*math.tau/96;vs.append((r*math.cos(a),-2.1,2.6+r*math.sin(a)))
 for i in range(96):faces.append((i,(i+1)%96,(i+1)%96+96,i+96))
 ob=props.mesh(name+' opaque aperture',vs,faces,PAL['ink'],mask);sol=ob.modifiers.new('Housing thickness','SOLIDIFY');sol.thickness=.18
 props.torus(name+' slate lens rim',(0,-2.2,2.6),inner,.055,PAL['dark'],mask)
 lid=B(name+' blinking upper eyelid',(0,-2.31,7.4),(4.55,.16,4.9),'ink',mask,.12)
 return dict(root=root,mask=mask,lid=lid)

def create_pricing_sequence(origin=(0,0,0),include_reaction=True):
 """Build separate real-volume sets, with original-story assets ready for keyframes."""
 origin=Vector(origin);before=set(bpy.data.objects)
 machine=_machine('Pricing engine',origin+Vector((20,0,0)))
 office=_office('Franchisee illustration',origin+Vector((40,0,0)))
 scope=_scope_view('Periscope street',origin+Vector((60,0,0)))
 reaction=_reaction('Observed second store',origin) if include_reaction else None
 assets={'machine':machine,'office':office,'scope':scope,'reaction':reaction,'origin':origin,'objects':list(set(bpy.data.objects)-before),'source_lengths':SOURCE_LENGTHS,'captions':CAPTIONS}
 # Explicit hierarchy roots include externally built full-volume character rigs.
 assets['set_roots']={'machine':[machine['root']], 'office':[office['root'],office['owner']['root']], 'scope':[scope['root']], 'reaction':([reaction['root'],reaction['hero']['root']] if reaction else [])}
 bpy.context.view_layer.update()
 return assets

def _machine_pose(m,scene_id,t,f,flow_t=None,flow_end=2.0):
 flow_t=t if flow_t is None else flow_t
 printing=scene_id==12;K(m['scope'],'location',(1.56,.14,3.42 if printing else 2.38),f)
 K(m['lid'],'location',(0,-.075,.34),f);K(m['pupil'],'location',(-.025,-.055,-.045 if printing else -.01),f)
 gulp=max(0,1-abs(t-1.0)/.125,1-abs(t-1.50)/.125) if not printing else 0
 scale=(1+.035*gulp,1+.045*gulp,1-.08*gulp);K(m['hopper'],'scale',scale,f)
 # The hopper deforms about its narrow neck, maintaining attachment to the lid.
 K(m['hopper'],'location',(0,0,3.15*(1-scale[2])),f)
 shake=0
 if printing:
  for click in [.75,.875,1,1.125]:
   if click<=t<click+.0833:shake=.035*(1 if int((t-click)*24)%2==0 else -1)
 K(m['body'],'location',(shake,0,0),f);K(m['body'],'scale',(1+.018*gulp,1,1-.035*gulp),f)
 if printing:
  step=sum(t>=x for x in [.125,.25,.375,.50]);angle=math.radians(-70+17.5*step)
  if .5<t<.667:angle+=math.radians(3)*math.sin((t-.5)*math.tau*18)
  # Needle local Z rotates about Y: negative points LOW to the left.
  K(m['needle'],'rotation_euler',(0,angle,0),f)
  count=sum(t>=x for x in [.75,.875,1,1.125]);ext=count/4
  K(m['ticket'],'location',(0,-1.025,1.82-ext*.80),f)
  K(m['ticket'],'rotation_euler',(0,0,math.radians(1.4)*math.sin(t*17)*max(0,1-(t-1.125)/.25) if ext==1 else 0),f)
  visible(m['ticket'],count>0,f)
 else:
  K(m['needle'],'rotation_euler',(0,math.radians(-70),0),f);visible(m['ticket'],False,f)
 for i,item in enumerate(m['streams']):
  flight=.75;age=(flow_t+i*.03125)%flight;k=age/flight
  rng=random.Random(i+164);start=Vector((rng.uniform(-2.15,2.15),1.35,rng.uniform(4.63,5.52)));end=Vector((rng.uniform(-.18,.18),0,3.65));p=start.lerp(end,k);p.z+=.60*math.sin(math.pi*k)
  K(item,'location',p,f);K(item,'rotation_euler',(math.sin(i)*.35,flow_t*3+i,flow_t*4+i),f)
  # Stop new births one complete flight before the end. Existing orders
  # reach the hopper before disappearing, never vanish halfway through an arc.
  visible(item,not printing and flow_t<flow_end and flow_t-age<=flow_end-flight,f)
 for i,dot in enumerate(m['dots']):
  pulse=1+.25*max(0,math.sin((t-.5)*math.tau*4+i*.57))*max(0,1-(t-.5)/.4) if .5<=t<.9 and not printing else 1
  K(dot,'scale',(.032*pulse,.020,.032*pulse),f)
 return {'needle':'MEDIUM' if printing and t>=.5 else 'LOW','ticket_fraction':(sum(t>=x for x in [.75,.875,1,1.125])/4 if printing else 0),'hopper_gulp':gulp,'dip_alpha':max(0,1-t/.375)**2 if not printing else 0}

def _office_pose(o,scene_id,t,f):
 root=o['root'];owner=o['owner'];p=at(root,(-.33,-.66,1.24));typing=scene_id==14
 if not typing:
  catch=phase(t,.18,.36);read=phase(t,.36,.50)
  hand=mix((.18,-1.03,1.78),(.50,-1.0,2.70),catch)
  hand=mix(hand,(.56,-.92,2.69),read)
  heading=0;head_heading=-.12-.50*phase(t,1.25,1.50)
  ch.pose_character(owner,p,heading,hand_targets={'L':at(root,hand),'R':at(root,(.35,-.08,1.82))},expression='worry',head_heading=head_heading,head_pitch=.10 if t>=.5 else 0,frame=f)
  # Ticket flutters into the window, then the bottom corner meets the actual hand.
  flight=mix((1.7,1.10,4.60),(.60,-.94,3.57),phase(t,0,.28));flight.y+=.13*math.sin(t*27)*(1-catch)
  held=Vector((.60,-.94,3.57));q=flight.lerp(held,phase(t,.25,.46));K(o['ticket'],'location',q,f)
  K(o['ticket'],'rotation_euler',(0,.05*math.sin(t*10)*(1-read),-.50 if read>.8 else -.65+.22*math.sin(t*12)),f)
  visible(o['ticket'],True,f);visible(o['tag']['root'],False,f);visible(o['keypad']['root'],False,f)
  ring=(.045*max(0,math.sin((t-1)*math.tau*8)) if 1<=t<1.5 else 0)
  K(o['phone'],'location',(.66,-2.1,1.82+ring),f)
  K(o['receiver'],'location',(.66,-2.10,2.01+ring),f);K(o['receiver'],'rotation_euler',(math.pi/2,math.pi/2,0),f)
  visible(o['sigh'],False,f)
  ch.blink_character(owner,0,f)
  return {'owner_action':'turn to phone' if t>=1.25 else 'read recommendation' if t>=.50 else 'catch recommendation','typed':''}
 # Receiver stays cradled physically between the near shoulder and ear.
 nod=.06*math.sin(math.pi*phase(t,.08,.20)) if .08<t<.20 else .06*math.sin(math.pi*phase(t,.32,.45)) if .32<t<.45 else 0
 sigh=phase(t,.50,.85);p.z-=.065*sigh
 press_times=[1,1.125,1.25,1.375];labels=['6','.','8','9'];count=sum(t>=x for x in press_times)
 for glyph_i,glyph in enumerate(o['tag']['glyphs']):visible(glyph,glyph_i<=count,f)
 # Actual key world centers become the pointing wrist targets; cap travel is separate.
 kp=o['keypad'];bpy.context.view_layer.update();active=None;pressed=None
 for i,(when,label) in enumerate(zip(press_times,labels)):
  down=when<=t<when+1/24
  if down:pressed=label
  key=kp['keys'][label];base=Vector(kp['centers'][label]);base.z=.13-(.035 if down else 0)
  K(key,'location',base,f)
  if when-.065<=t<when+.06:active=label
 next_label=active or labels[min(count,3)];center=kp['root'].matrix_world@Vector(kp['centers'][next_label]);handleft=center+Vector((-.10,-.015,.085 if active else .21))
 # Raised hand anchors the lower-left corner. Its lift comes only after all four inputs.
 lift=.11*phase(t,1.50,1.63);right=at(root,(.10,-.25,2.95+lift))
 ch.pose_character(owner,p,0,hand_targets={'R':right,'L':handleft},head_heading=-.17,head_pitch=nod+.07*sigh,expression='worry',frame=f)
 wrist=_authored_world_matrix(owner['joints']['wrist_R']).translation
 tagpos=_authored_world_matrix(root).inverted()@wrist
 K(o['tag']['root'],'location',tagpos+Vector((.03,0,.025)),f);K(o['tag']['root'],'rotation_euler',(0,0,.60),f)
 visible(o['tag']['root'],True,f)
 # Restore per-glyph visibility after revealing the tag hierarchy.
 for glyph_i,glyph in enumerate(o['tag']['glyphs']):
  visible(glyph,glyph_i<=count,f)
  pop=1
  if glyph_i and glyph_i<=count:
   age=t-press_times[glyph_i-1];pop=1+.12*max(0,1-age/(2/24))
  K(glyph,'scale',(pop,pop,pop),f)
 visible(o['ticket'],False,f)
 head=owner['joints']['head'];bpy.context.view_layer.update();ear=head.matrix_world@Vector((-.05,-.33,-.08));ear_local=root.matrix_world.inverted()@ear
 K(o['receiver'],'location',ear_local+Vector((.07,-.045,-.18)),f);K(o['receiver'],'rotation_euler',(0,-.25,.10),f)
 # Curly cable follows the receiver using baked bezier coordinates, no handler.
 cordpts=[];start=Vector((.66,-2.10,1.85));end=ear_local+Vector((.07,-.045,-.48))
 for i in range(4):q=start.lerp(end,i/3);q.z-=.55*math.sin(math.pi*i/3);cordpts.append(q)
 for pt,q in zip(o['cord'].data.splines[0].bezier_points,cordpts):pt.co=q
 if f is not None:
  for i,pt in enumerate(o['cord'].data.splines[0].bezier_points):pt.keyframe_insert('co',frame=f)
 K(o['phone'],'location',(.66,-2.1,1.82),f)
 # Display uses separately created text objects in the scene; body changes are metadata
 # only, so an integration may overlay the typed value while glyph keys stay baked.
 for i,glyph in enumerate(kp['display']):visible(glyph,i<=count,f)
 K(o['sigh'],'location',(.48+(t-.50)*.9,-.77,2.48-.03*sigh),f);visible(o['sigh'],.50<=t<.95,f)
 ch.blink_character(owner,1 if .50<=t<.63 else 0,f)
 return {'owner_action':'show entered price' if t>=1.5 else 'type price' if t>=1 else 'ready to type' if t>=.95 else 'sigh' if t>=.5 else 'listen and nod','typed':'$'+''.join(labels[:count]),'key':active,'pressed_key':pressed}

def _reaction_pose(r,t,f):
 root=r['root'];p=at(root,(-.45,0,1.24));q=Vector((.44,-.10,1.82));tremble=.018*(1 if int(round((t-1)*24))%2==0 else -1) if 1<=t<1.25 else 0;q.z+=tremble
 ch.pose_character(r['hero'],p,0,hand_targets={'L':at(root,q+Vector((-.08,-.26,.08))),'R':at(root,q+Vector((.12,.22,.07)))},head_heading=-.12,head_pitch=-.06,expression='surprise',frame=f)
 K(r['burger'],'location',q,f);K(r['burger'],'rotation_euler',(0,tremble*2,0),f)
 pop=phase(t,.125,.25);pops=pop+(.12*math.sin((t-.125)*math.pi/.125) if .125<t<.25 else 0)
 for i,eye in enumerate(r['hero']['eyes']):
  K(eye,'location',r['eye_rest'][i]+Vector((.14*pop,0,.09*pop)),f);K(eye,'scale',(1+.60*pops,)*3,f)
 for stalk in r['stalks']:visible(stalk,pop>.05,f)
 r['jaw'].value=phase(t,.5,.625)
 if f is not None:r['jaw'].keyframe_insert('value',frame=f)
 mouth=r['hero']['parts']['surprised mouth'];K(mouth,'scale',(.021,.077,.085*(1+phase(t,.5,.625)*1.1)),f);K(mouth,'location',(.325,0,-.29-.035*phase(t,.5,.625)),f)
 K(r['tag']['root'],'rotation_euler',(0,0,.47+math.radians(4)*(1-phase(t,0,.25))),f)
 return {'reaction':'eyes pop and jaw drop','price':'$6.89','delta':'+21%','dip_alpha':phase(t,1.625,1.875)}

def pose_scene(assets,scene_id,t,frame=None,camera=None,duration=None):
 """Pose a source scene; optional camera receives ordinary keyframes. Captions returned."""
 scene_id=int(scene_id);wall_t=max(0,float(t));t=retime(scene_id,t,duration);f=frame
 active='reaction' if scene_id==9 else 'machine' if scene_id in [10,12] else 'scope' if scene_id==11 else 'office'
 for name,roots in assets['set_roots'].items():
  for root in roots:visible(root,name==active,f)
 if active=='machine':
  m=assets['machine'];feed_length=2.0 if duration is None else (duration if duration<=2 else 2+(duration-2)*.3125)
  state=_machine_pose(m,scene_id,t,f,flow_t=wall_t,flow_end=feed_length);o=m['root'].location
  spec=camera_spec(o+Vector((3.1,-12.3,5.5)),o+Vector((-.12,0,2.62)),96) if scene_id==12 else camera_spec(o+Vector((4.0,-10.5,6.4)),o+Vector((0,0,3.25)),66)
  state['anchors']={'hopper':tuple(at(m['root'],(0,0,3.71))),'ticket_slot':tuple(at(m['root'],(0,-1.025,1.02))),'gauge':tuple(at(m['root'],(0,-1.18,1.94)))}
 elif active=='office':
  m=assets['office'];state=_office_pose(m,scene_id,t,f);o=m['root'].location
  spec=camera_spec(o+Vector((-2.55,-4.8,3.9)),o+Vector((.80,.25,2.70)),58) if scene_id==13 else camera_spec(o+Vector((1.9,-3.2,3.65)),o+Vector((.18,-.35,2.65)),40)
  state['anchors']={'keypad':tuple(m['keypad']['root'].matrix_world.translation),'tag_hand':tuple(m['owner']['joints']['wrist_R'].matrix_world.translation),'phone':tuple(m['phone'].matrix_world.translation)}
 elif active=='scope':
  m=assets['scope'];o=m['root'].location;k=phase(t,0,.5);pan=1.25*k
  if .50<t<.50+2/24:pan+=.018*math.sin(math.pi*(t-.50)/(2/24))
  # Camera pivots inside an actual volumetric street; housing is parented to camera
  # motion by the same offset, retaining a screen-fixed aperture and moving world.
  K(m['mask'],'location',(-1.25+pan,0,0),f)
  lid=.0
  if .875<=t<1.0:lid=min(1.0,1.2*math.sin((t-.875)/.125*math.pi))
  K(m['lid'],'location',(0,-2.31,7.40-4.65*lid),f);visible(m['lid'],lid>.001,f)
  spec=camera_spec(o+Vector((-1.25+pan,-10.0,3.30)),o+Vector((-1.25+pan,4.4,2.20)),45)
  state={'pan':pan,'blink':lid}
 else:
  if not assets['reaction']:raise ValueError('Scene 9 omitted at construction; use include_reaction=True')
  m=assets['reaction'];state=_reaction_pose(m,t,f);o=m['root'].location
  spec=camera_spec(o+Vector((5.7,-9.6,4.1)),o+Vector((.22,.10,2.70)),108)
 _set_camera(camera,spec,f)
 state.update(scene=scene_id,source_t=t,camera=spec,captions=[c for c in CAPTIONS[scene_id] if t>=c['at']])
 return state

def bake_scene(assets,scene_id,start_frame,duration=None,fps=24,camera=None):
 duration=SOURCE_LENGTHS[int(scene_id)] if duration is None else duration
 states=[]
 for i in range(round(duration*fps)+1):states.append(pose_scene(assets,scene_id,i/fps,start_frame+i,camera,duration))
 return {'start':start_frame,'end':start_frame+round(duration*fps),'duration':duration,'last_state':states[-1]}


def patch_readability(scene=None, camera=None, start_seconds=57.0, end_seconds=65.0, fps=24):
 """Fast in-memory patch for the saved master's existing two-line revision.

 No geometry rebuild, save, render, or route/character pose bake occurs. Existing
 object identities remain intact for asset_registry.load(scene). Repeated calls
 are safe. Caller owns saving the patched master.
 """
 scene=scene or bpy.context.scene;camera=camera or scene.camera
 root=bpy.data.objects.get('Pricing engine set')
 required=['Pricing engine willingness caption line 1','Pricing engine willingness caption line 2','Pricing engine output ticket thick perforated slip']
 if root is None or any(bpy.data.objects.get(n) is None for n in required):
  raise ValueError('This patch expects the saved master with the existing two-line machine footplate revision')
 saved_frame=scene.frame_current
 # Hidden viewport objects may retain an unevaluated/identity matrix_world when
 # the master is opened on a title or credits shot. The set root is unparented,
 # so its authored location is the authoritative world origin even while hidden.
 if root.parent is not None:raise ValueError('Pricing engine set must remain unparented for this post-load patch')
 origin=root.location.copy();changed=[]
 def static_value(obj,path,value):
  # These are label/plate-local controls, never the animated print root or cast.
  if obj.animation_data and obj.animation_data.action:
   action=obj.animation_data.action
   for fc in list(action.fcurves):
    if fc.data_path==path:action.fcurves.remove(fc)
  setattr(obj,path,value)
 def text(name,size,scale=(1,1,1)):
  obj=bpy.data.objects.get(name)
  if obj is None:raise ValueError('Missing expected label: '+name)
  obj.data=obj.data.copy();obj.data.size=size;static_value(obj,'scale',scale);static_value(obj,'rotation_euler',(math.pi/2,0,0));changed.append(name);return obj
 def mesh_width(name,width):
  obj=bpy.data.objects.get(name)
  if obj is None:raise ValueError('Missing expected plate: '+name)
  obj.data=obj.data.copy();xs=[v.co.x for v in obj.data.vertices];lo=min(xs);hi=max(xs);center=(lo+hi)/2;ratio=width/(hi-lo)
  for v in obj.data.vertices:v.co.x=center+(v.co.x-center)*ratio
  obj.data.update();changed.append(name)
 text('Pricing engine sensitivity label',.38)
 for label in ['LOW','MEDIUM','HIGH']:text('Pricing engine '+label,.42)
 text('Pricing engine willingness caption line 1',.32)
 text('Pricing engine willingness caption line 2',.32)
 mesh_width('Pricing engine willingness caption plate',3.83)
 mesh_width('Pricing engine output lip',1.90)
 mesh_width('Pricing engine ticket exit darkness',1.80)
 mesh_width('Pricing engine paper feed mask',1.82)
 mesh_width('Pricing engine output ticket thick perforated slip',1.70)
 text('Pricing engine output ticket recommended',.42,(.64,1,1))
 text('Pricing engine output ticket exact price',.50)
 for i in range(12):
  obj=bpy.data.objects.get('Pricing engine output ticket perforation '+str(i))
  if obj:
   loc=obj.location.copy();loc.x=-.85+.055+i*1.59/11;static_value(obj,'location',loc)
 # The caught slip stays the same hand-sized mesh; only its lettering changes.
 name='Franchisee illustration caught recommendation recommended'
 if bpy.data.objects.get(name):
  header=text(name,.27);bpy.context.view_layer.update()
  width=max(v[0] for v in header.bound_box)-min(v[0] for v in header.bound_box)
  header.scale.x=min(1,1.12*.9/max(.001,width))
 start=round(start_seconds*fps)+1;end=round(end_seconds*fps)
 spec=camera_spec(origin+Vector((3.1,-12.3,5.5)),origin+Vector((-.12,0,2.62)),96)
 rotation=(Vector(spec['target'])-Vector(spec['location'])).to_track_quat('-Z','Y').to_euler()
 def replace_interval(owner,path,values):
  ad=getattr(owner,'animation_data',None);action=ad.action if ad else None
  if action:
   for fc in action.fcurves:
    if fc.data_path==path:
     value=values[fc.array_index] if isinstance(values,(list,tuple,Vector)) else values
     for point in fc.keyframe_points:
      if start<=point.co.x<=end:point.co.y=value;point.handle_left.y=value;point.handle_right.y=value;point.interpolation='CONSTANT'
     fc.update()
  setattr(owner,path,values);owner.keyframe_insert(data_path=path,frame=start);owner.keyframe_insert(data_path=path,frame=end)
  if owner.animation_data and owner.animation_data.action:
   for fc in owner.animation_data.action.fcurves:
    if fc.data_path==path:
     for point in fc.keyframe_points:
      if start<=point.co.x<=end:point.interpolation='CONSTANT'
 if camera:
  replace_interval(camera,'location',Vector(spec['location']));replace_interval(camera,'rotation_euler',tuple(rotation));replace_interval(camera.data,'lens',96.0)
  # The shared sentence remains screen-fixed across the closer scene-12 cut.
  width=camera.data.sensor_width/96
  for obj in bpy.data.objects:
   if obj.parent==camera and obj.get('screen_overlay'):
    replace_interval(obj,'scale',(width,width,width))
    if obj.name in {'engine_caption','Machine illustration label'}:
     for part in [obj]+list(obj.children_recursive):
      if hasattr(part.display,'show_shadows'):part.display.show_shadows=False
 scene.frame_set(saved_frame)
 return {'patched_objects':changed,'camera_frames':[start,end],'lens':96,'ticket_width':1.70,'owner_ticket_width_unchanged':1.12,'pose_cues_modified':False,'saved':False}


def patch_owner_tag_entry(pricing=None, frame=1729, reference_frame=1730):
 """Repair only the three existing tag-location keys at the scene-14 entry.

 Call patch_owner_tag_entry(asset_registry.load(scene)['pricing']). The next
 frame already contains the identical intended listening pose. No pose bake,
 other key, rotation, visibility, render, or file save is performed.
 """
 if pricing is None:
  import asset_registry
  pricing=asset_registry.load(bpy.context.scene)['pricing']
 tag=pricing['office']['tag']['root'];action=tag.animation_data.action if tag.animation_data else None
 if action is None:raise ValueError('The owner tag has no baked action')
 edits=[]
 for axis in range(3):
  fc=action.fcurves.find('location',index=axis)
  if fc is None:raise ValueError('Missing tag location channel '+str(axis))
  dst=next((k for k in fc.keyframe_points if abs(k.co.x-frame)<.0001),None)
  src=next((k for k in fc.keyframe_points if abs(k.co.x-reference_frame)<.0001),None)
  if dst is None or src is None:raise ValueError('Both entry and reference keys must already exist')
  edits.append((fc,dst,float(dst.co.y),float(src.co.y)))
 # Gather all inputs before writing, so a missing channel cannot partly patch.
 for fc,dst,before,value in edits:dst.co.y=value;fc.update()
 return {'object':tag.name,'frame':frame,'reference_frame':reference_frame,
         'channels':['location[0]','location[1]','location[2]'],
         'before':[e[2] for e in edits],'after':[e[3] for e in edits],'saved':False}
