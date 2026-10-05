"""Faithful source scenes1–3 in a persistent volumetric set, with only physical connectors.
No changed story order or invented payment arithmetic. The full film retains all18sourcebeats.
"""
import bpy,math,sys,json,argparse,time,bmesh
from pathlib import Path
from mathutils import Vector,Matrix
P=Path(__file__).resolve().parent;sys.path.insert(0,str(P));import environment as env;import character as ch;import props
raw=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
ap=argparse.ArgumentParser();ap.add_argument('--mode',default='stills');ap.add_argument('--save-path',default=str(P/'burger-faithful-proof.blend'));ap.add_argument('--percent',type=int,default=50);ap.add_argument('--start',type=int,default=1);ap.add_argument('--end',type=int,default=432);a=ap.parse_args(raw)
FPS=24;DURATION=18;O=P/'faithful_output';O.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=1080;s.render.resolution_y=1920;s.render.resolution_percentage=a.percent;s.render.fps=FPS;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';s.render.image_settings.compression=15;s.render.threads_mode='FIXED';s.render.threads=8
sh=s.display.shading;sh.light='STUDIO';sh.studio_light='paint.sl';sh.color_type='OBJECT';sh.show_shadows=True;sh.shadow_intensity=.22;sh.show_cavity=True;sh.cavity_type='BOTH';sh.curvature_ridge_factor=.03;sh.curvature_valley_factor=.45;sh.cavity_ridge_factor=0;sh.cavity_valley_factor=.45;sh.show_object_outline=True;sh.object_outline_color=(.07,.11,.12);sh.show_specular_highlight=False;sh.background_type='WORLD';s.world.color=props.col('D5E4E6')[:3];s.display.render_aa='5';s.view_settings.view_transform='Standard';s.view_settings.look='None';s.view_settings.exposure=.20
street=env.build_street();shop=street['shop1']
shop['register'].location.x=.70;shop['register'].scale=(.8,.8,.8);shop['register'].rotation_euler.z=math.pi;shop['phone'].location.x=1.48
for ob in bpy.data.objects:
 if ob.name.startswith('Soft road repair'):ob.hide_render=True;ob.hide_viewport=True
# First neighborhood shows its original cottages; later districts remain available for scenes5–7.
for o in street['objects']:
 if o.matrix_world.translation.x>18.5:o.hide_render=True;o.hide_viewport=True
bike=props.create_bicycle('Persistent green bicycle');youth=ch.create_character('The cyclist','youth',(0,0,1.24));seller=ch.create_character('The cook','vendor',(14,4,1.52));burger=props.create_burger('The one burger',(13.081,2.911,1.874),.82)
coins=[props.create_coin('Offered coin '+str(i)) for i in range(2)]
# The original gag uses coins, without an invented tender/change arithmetic sequence.
for c in shop['coins']+[shop['register_display']]:c.hide_render=True;c.hide_viewport=True
regdisplay=shop['register_display'];regdisplay.data.body='5.69';regdisplay.hide_render=False;regdisplay.hide_viewport=False
bpy.context.view_layer.update();regM=shop['register'].matrix_world.copy();counter=Vector((13.045,3.045,1.95));payment=Vector((13.045,3.045,1.95));home=Vector((13.081,2.911,1.874));drawer=shop['cash_drawer'];drawerbase=drawer.location.copy();total_key=shop['keys'][9];keybase=total_key.location.copy();key_world=total_key.matrix_world.translation.copy()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='Source scene cameras';cam.data.type='PERSP';cam.data.sensor_fit='HORIZONTAL';cam.data.clip_start=.025;cam.data.clip_end=150;s.camera=cam

def u(t,a,b):q=max(0,min(1,(t-a)/(b-a)));return q*q*(3-2*q)
def V(v):return Vector(v)
def mix(a,b,t):return V(a).lerp(V(b),t)
def R(h):return Matrix.Rotation(h,3,'Z')
def world(p,h,q):return V(p)+R(h)@V(q)
def path(t,points):
 if t<=points[0][0]:return V(points[0][1])
 for (a,p),(b,q) in zip(points,points[1:]):
  if t<=b:return mix(p,q,u(t,a,b))
 return V(points[-1][1])
def k(o,prop,value,f,constant=False):props.key(o,prop,value,f,'CONSTANT' if constant else 'LINEAR')
def blink(actor,amount,f):
 if hasattr(ch,'blink_character'):ch.blink_character(actor,amount,f)

# Actual bite geometry is prepared before animation; it appears only at the mouth contact.
bitten=[];original=[]
for src in list(burger.children):
 if src.type!='MESH' or 'sesame' in src.name:continue
 cp=src.copy();cp.data=src.data.copy();cp.animation_data_clear();
 bm=bmesh.new();bm.from_mesh(cp.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(cp.data);bm.free();bpy.context.collection.objects.link(cp);cp.parent=burger;cp.name=src.name+' bitten';cp.hide_render=False;cp.hide_viewport=False
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12);cut=bpy.context.object;cut.parent=burger;cut.location=(.26,-.18,.46);cut.scale=(.215,.215,.30)
 bpy.context.view_layer.update();m=cp.modifiers.new('Bite','BOOLEAN');m.operation='DIFFERENCE';m.object=cut;bpy.context.view_layer.objects.active=cp;cp.select_set(True);cut.select_set(False)
 try:bpy.ops.object.modifier_apply(modifier=m.name)
 except RuntimeError as exc:raise RuntimeError('Bite modifier failed: '+str(exc))
 bpy.data.objects.remove(cut,do_unlink=True);original.append(src);bitten.append(cp)
crumbs=[props.sphere('Chomp crumb'+str(i),(0,0,0),(.025,.02,.028),'bun') for i in range(5)]

for f in range(1,DURATION*FPS+1):
 t=(f-1)/FPS
 # Source01: roll in, skid and foot-down. Forward cranks/wheels derive from +X distance.
 if t<2.8:x=9.0+(10.65-9.0)*t/2.8
 elif t<3.6:x=10.65+.52*(1-(1-u(t,2.8,3.6))**2)
 else:x=11.17
 bpos=V((x,3.01,.12));bc=props.pose_bicycle(bike,bpos,0,distance=x-9.0,lean=.04*u(t,4.7,5.0),parked=u(t,4.7,5.0),frame=f)
 p=bc['seat'].copy();h=0.;pitch=.15;hh=0.;expr='smile';hands={'L':bc['hands'][0],'R':bc['hands'][1]};feet={'L':bc['feet'][0],'R':bc['feet'][1]}
 if t>=3.0:
  p=mix(p,(10.75,2.61,1.36),u(t,3.0,3.8));pitch=.15*(1-u(t,3.0,3.8))
  feet['L']=mix(bc['feet'][0],(10.73,2.42,.26),u(t,3.0,3.6))
  feet['R']=path(t,[(3.0,bc['feet'][1]),(3.75,(10.40,2.95,1.69)),(4.15,(10.15,2.53,1.15)),(4.55,(10.77,2.80,.26))])
 if t>=4.55:
  q=u(t,4.55,5.35);p=mix((10.75,2.61,1.36),(12.268,2.268,1.36),q);h=math.pi/4*q;hh=h;pitch=.03
  # Two short planted steps join the source wide shot to its window composition.
  feet={'L':mix((10.73,2.42,.26),world((12.268,2.268,.26),math.pi/4,(0,-.19,0)),u(t,4.55,4.95)),'R':mix((10.77,2.80,.26),world((12.268,2.268,.26),math.pi/4,(0,.19,0)),u(t,4.95,5.35))}
  feet['L'].z+=.13*math.sin(math.pi*max(0,min(1,(t-4.55)/.4))) if t<4.95 else 0
  feet['R'].z+=.13*math.sin(math.pi*max(0,min(1,(t-4.95)/.4))) if 4.95<t<5.35 else 0
  hands={side:world(p,h,(.15,sign*.405,-.02)) for side,sign in [('L',-1),('R',1)]}
 if t>=5.35:
  p=V((12.268,2.268,1.36));h=math.pi/4;hh=h;pitch=.04;feet={side:world((p.x,p.y,.26),h,(0,sign*.19,0)) for side,sign in [('L',-1),('R',1)]};hands={side:world(p,h,(.15,sign*.405,-.02)) for side,sign in [('L',-1),('R',1)]}
 # The offered coins emerge from the pocket and are slapped, then raked. No price arithmetic added.
 pocket=world(p,h,(-.03,.05,-.10));coincenter=pocket.copy()
 if 5.2<=t<7.75:
  coincenter=path(t,[(5.2,pocket),(5.55,world(p,h,(.35,.08,.50))),(5.90,payment+V((0,0,.18))),(6.0,payment),(7.75,payment)])
  if t<6.10:hands['R']=coincenter+V((.02,.02,.04))
 # Source02: vendor pushes the burger and the boy snatches it, with continuous hand/object contact.
 vp=V((14.23,3.49,1.49));vh=-3*math.pi/4
 vf={side:world((vp.x,vp.y,.42),vh,(0,sign*.20,0)) for side,sign in [('L',-1),('R',1)]};vhand={side:world(vp,vh,(.25,sign*.38,.05)) for side,sign in [('L',-1),('R',1)]}
 food=home.copy()
 if 6<=t<7.10:
  food=mix(home,counter+V((-.03,-.03,-.035)),u(t,6.15,6.65));vhand['L']=food+V((.17,-.17,.035));hands['R']=mix(world(p,h,(.15,.405,-.02)),food+V((-.17,.17,.035)),u(t,6.35,6.80))
 if t>=7.10:
  hold=world(p,h,(.48,0,.70));food=mix(counter+V((-.03,-.03,-.035)),hold,u(t,7.1,7.42));side=R(h)@V((0,.22,0));hands['L']=food-side+V((0,0,.025));hands['R']=food+side+V((0,0,.025))
  vhand['L']=mix(food+V((.17,-.17,.035)),world(vp,vh,(.25,-.38,.05)),u(t,7.10,7.45))
 if 7.75<=t<9.25:
  collect=world(vp,vh,(.58,-.12,.38));coincenter=mix(payment,collect,u(t,7.85,8.30));vhand['L']=coincenter+V((0,0,.035))
 if 9.25<=t<10.4:
  deposit=regM@V((0,-.18,.52));coincenter=mix(world(vp,vh,(.58,-.12,.38)),deposit,u(t,9.25,9.55));vhand['R']=coincenter+V((0,0,.04))
 if t>=10.4:coincenter=regM@V((0,-.18,.25))
 # Cash-register spring gag: one emphatic key press, drawer shoots, seller's tired blink.
 press=math.exp(-((t-9.60)/.11)**2);kp=keybase.copy();kp.z-=.04*press;k(total_key,'location',kp,f)
 if 9.30<t<9.95:vhand['R']=key_world+V((0,0,.13-.06*press))
 d=drawerbase.copy();d.y=-.29-.48*u(t,9.68,9.84)+.12*u(t,10.00,10.20);k(drawer,'location',d,f)
 # Source03: close-up, one bite, crumbs, chewing and closed-eye bliss; same booth persists.
 if t>=11.4:
  turn=u(t,11.4,12.0);h=math.pi/4-math.pi*turn;hh=h;pitch=.03
  feet={side:world((p.x,p.y,.26),h,(0,sign*.19,0)) for side,sign in [('L',-1),('R',1)]}
  zraise=.35*(1-u(t,11.4,12))+.16*u(t,12.6,13.15)-.16*u(t,13.55,14.1);food=world(p,h,(.48,0,.35+zraise));side=R(h)@V((0,.22,0));hands['L']=food-side+V((0,0,.025));hands['R']=food+side+V((0,0,.025))
  expr='talk' if 12.7<t<13.45 else 'laugh' if t>15.1 else 'smile'
 k(burger,'location',food,f);k(burger,'rotation_euler',(0,.12*u(t,13.5,14.1),h),f)
 for i,c in enumerate(coins):k(c,'location',coincenter+V(((i-1)*.085,0,.023*i)),f)
 ch.pose_character(youth,p,h,hands,feet,hh,expr,frame=f,torso_pitch=pitch,head_pitch=.12*u(t,12.6,13.15)*(1-u(t,13.35,13.7)))
 ch.pose_character(seller,vp,vh,vhand,vf,vh,'smile',frame=f,torso_pitch=.16)
 blink(seller,math.exp(-((t-10.40)/.12)**2)+math.exp(-((t-10.85)/.13)**2),f)
 blink(youth,u(t,15.0,15.3),f)
 # Cheerful small jaw/head pulses read as chewing rather than extra mouth text.
 if 13.45<t<15.05:
  scale=1+.018*math.sin((t-13.45)*math.tau*3);k(youth['joints']['head'],'scale',(1,1,scale),f)
 elif t>=15.05:k(youth['joints']['head'],'scale',(1,1,1),f)
 for ob in original:k(ob,'hide_render',t>=13.3,f,True);k(ob,'hide_viewport',t>=13.3,f,True)
 for ob in bitten:k(ob,'hide_render',t<13.3,f,True);k(ob,'hide_viewport',t<13.3,f,True)
 for i,cr in enumerate(crumbs):
  visible=13.3<=t<13.95;k(cr,'hide_render',not visible,f,True);k(cr,'hide_viewport',not visible,f,True);dt=max(0,t-13.3);k(cr,'location',food+R(h)@V((.21+.04*i,.13-.065*i,.30-.50*dt-1.8*dt*dt)),f)
 # Three original viewpoints, with no invented montage or missing transaction.
 if t<6:cp=V((7.9,-4.0,2.7));target=V((12.1,3.1,2.25));lens=43
 elif t<12:cp=V((14.05,5.35,3.1));target=V((12.40,2.70,2.20));lens=26
 else:cp=V((11.65,-.7,2.95));target=V((12.65,2.48,2.42));lens=47
 k(cam,'location',cp,f,True);k(cam,'rotation_euler',(target-cp).to_track_quat('-Z','Y').to_euler(),f,True);cam.data.lens=lens;cam.data.keyframe_insert(data_path='lens',frame=f)
 if f%120==0:print('BAKED',f,flush=True)
for fc in cam.data.animation_data.action.fcurves:
 for pt in fc.keyframe_points:pt.interpolation='CONSTANT'
s.frame_start=1;s.frame_end=DURATION*FPS;s['scope']='Faithful source scenes1–3 only; not a replacement for the18-scene film.'
for n,t in [('01 Booth arrival and coins',0),('02 Push snatch rake drawer',6),('03 Bite chew bliss',12)]:s.timeline_markers.new(n,frame=int(t*FPS)+1)
s.frame_set(7*FPS+1);bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=a.save_path)
if a.mode=='stills':
 for t in [6.5,9.7,14.3]:
  s.frame_set(round(t*FPS)+1);s.render.filepath=str(O/f'faithful_{t:04.1f}.png');bpy.ops.render.render(write_still=True)
elif a.mode=='render':
 d=O/'frames';d.mkdir(exist_ok=True)
 for f in range(a.start,a.end+1):s.frame_set(f);s.render.filepath=str(d/f'frame_{f:04d}.png');bpy.ops.render.render(write_still=True)
print('FAITHFUL_PROOF_READY',flush=True)
