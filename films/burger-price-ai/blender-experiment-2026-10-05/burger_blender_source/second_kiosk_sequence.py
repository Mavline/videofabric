"""Faithful source 08, 09 and 15, sharing the real second kiosk and world props.

create_second_kiosk_sequence(street,youth=None,seller=None,bike=None,burger=None,
                             coins=None,camera=None)
pose_second_kiosk_shot(assets,scene_id,local_t,duration=None,frame=None)
restore_second_kiosk_staging(assets,frame=None)

Default shot lengths: 7 / 6 / 5 seconds. Source action order is unchanged.
Only connectors added: a held shared-hand contact at the snatch; scene15's
visible return of the unbought burger and retrieval of the SAME offered coins.
No new dollar tender, change calculation, price, purchase, or story shot.

All actors use world wrist/ankle targets and the character's fixed-length IK.
The stopped rider keeps both soles on sidewalk until the deliberate crouch;
the spin is around the rear tire contact, and the dash pedals actually turn.
No frame handlers, drivers, simulations, image planes, or film render calls.
Captions and the dip are returned as data, leaving the master compositor free.
"""
import bpy, math
from mathutils import Vector, Matrix, Euler
import environment as env
import character as ch
import props

DURATIONS={8:7.0,9:6.0,15:5.0}
TIMING_DOMAINS={8:7.0,9:5.0,15:4.0}
SOURCE_DURATIONS={8:3.0,9:2.0,15:1.0}
RETURN_JOIN_POSITION=(24.65,-.30,.035)
RETURN_JOIN_HEADING=math.pi
NAMES={8:'Same coins; push, snatch, tap, point',9:'The $6.89 reaction',15:'Return, crouch, spin, dash'}

def V(p): return Vector(p)
def clamp(x): return max(0.,min(1.,x))
def smooth(x): x=clamp(x);return x*x*(3.-2.*x)
def U(t,a,b): return smooth((t-a)/(b-a))
def mix(a,b,u): return V(a).lerp(V(b),u)
def R(h): return Matrix.Rotation(h,3,'Z')
def W(p,h,q): return V(p)+R(h)@V(q)
def K(o,p,v,f=None,constant=False): props.key(o,p,v,f,'CONSTANT' if constant else 'LINEAR')
def visible(o,value,frame=None):
 K(o,'hide_render',not value,frame,True);K(o,'hide_viewport',not value,frame,True)
def tree(o): return [o]+list(o.children_recursive)
def path(t,points):
 if t<=points[0][0]: return V(points[0][1])
 for (a,p),(b,q) in zip(points,points[1:]):
  if t<=b:return mix(p,q,U(t,a,b))
 return V(points[-1][1])
def _hide(root,value,frame=None):
 for o in tree(root):visible(o,not value,frame)
def _camera(camera,p,target,lens,frame):
 spec={'location':tuple(p),'target':tuple(target),'lens':lens,'sensor_fit':'HORIZONTAL'}
 if camera:
  K(camera,'location',p,frame);K(camera,'rotation_euler',(V(target)-V(p)).to_track_quat('-Z','Y').to_euler(),frame)
  camera.data.type='PERSP';camera.data.sensor_fit='HORIZONTAL';camera.data.clip_start=.02;camera.data.lens=lens
  if frame is not None:camera.data.keyframe_insert('lens',frame=frame)
 return spec

def create_second_kiosk_sequence(street,youth=None,seller=None,bike=None,burger=None,coins=None,camera=None):
 before=set(bpy.data.objects);shop=street['shop2'];bpy.context.view_layer.update();M=shop['root'].matrix_world.copy();wp=lambda p:M@V(p)
 shop['register_display'].data.body='6.89'
 youth=youth or ch.create_character('Second booth cyclist','youth')
 seller=seller or ch.create_character('Second booth cook','vendor')
 bike=bike or props.create_bicycle('Persistent booth-two bicycle')
 burger=burger or props.create_burger('Second booth unbought burger',scale=.82)
 coins=coins if coins is not None else [props.create_coin('Same offered coin '+str(i)) for i in range(2)]
 # The original first-bite rig may supply a burger with alternate bite meshes.
 # Its owner remains responsible for selecting whole/bite variants externally.
 ch.blink_character(youth,0);ch.blink_character(seller,0)
 face=youth['parts']['head_mesh'];basis=face.data.shape_keys
 if basis is None:face.shape_key_add(name='Basis')
 jaw=face.data.shape_keys.key_blocks.get('Second booth jaw drop') or face.shape_key_add(name='Second booth jaw drop')
 for point,base in zip(jaw.data,face.data.shape_keys.key_blocks[0].data):
  point.co=base.co;point.co.z-=.105*smooth((-base.co.z-.18)/.30)
 stalks=[]
 for i,eye in enumerate(youth['eyes']):
  stalk=props.sphere('Price reaction eye stalk '+str(i),(.36,eye.location.y,.19),(.14,.057,.057),'cream',youth['joints']['head']);stalks.append(stalk);visible(stalk,False)
 eye_rest=[eye.location.copy() for eye in youth['eyes']]
 pointing_finger=props.sphere('Vendor lifted index finger',(.04,-.03,-.225),(.047,.047,.16),'skin',seller['parts']['hand_L']);visible(pointing_finger,False)
 # The vendor's two taps are the numeric/coin mismatch gag, without invented arithmetic.
 tap_marks=[]
 for i in range(3):
  a=i*2*math.pi/3
  ob=props.rod('Two coin taps impact tick '+str(i),(.12*math.cos(a),.12*math.sin(a),0),(.20*math.cos(a),.20*math.sin(a),.05),.012,'gold');tap_marks.append(ob);visible(ob,False)
 dust=[]
 for i in range(6):
  ob=props.sphere('Second kiosk skid dust '+str(i),(0,0,0),(.14,.10,.08),'D8D2BB');dust.append(ob);visible(ob,False)
 # Own state snapshots make camera-side shell visibility reversible at cut boundaries.
 staged=[o for o in shop['objects'] if any(token in o.name for token in ['left structural side','right structural side','back interior wall','back service window','barrel copper roof','roof seam','rounded teal rear roof fascia','rolled curved roof rim'])]
 staged+=shop['coins']
 staging={o:(o.hide_render,o.hide_viewport) for o in staged}
 a=dict(street=street,shop=shop,youth=youth,seller=seller,bike=bike,burger=burger,coins=coins,camera=camera,M=M,wp=wp,staging=staging,
        jaw=jaw,eye_rest=eye_rest,stalks=stalks,pointing_finger=pointing_finger,dust=dust,tap_marks=tap_marks,
        bike_stop=V((29.35,2.18,.12)),boy_stop=V((28.93,2.18,1.335)),boy_heading=math.pi/4,
        seller_stop=wp((.15,-.70,1.47)),seller_heading=-3*math.pi/4,
        food_home=wp((.13,-1.43,1.825)),food_contact=wp((-.24,-1.69,1.93)),payment=wp((-.64,-1.57,1.82)),
        price_rotation=shop['price_sign'].rotation_euler.copy(),objects=list(set(bpy.data.objects)-before))
 a['boy_feet']={side:W((a['boy_stop'].x,a['boy_stop'].y,.26),a['boy_heading'],(-.06,sign*.24,0)) for side,sign in [('L',-1),('R',1)]}
 a['seller_feet']={side:W((a['seller_stop'].x,a['seller_stop'].y,.42),a['seller_heading'],(0,sign*.20,0)) for side,sign in [('L',-1),('R',1)]}
 a['food_hold']=W(a['boy_stop'],a['boy_heading'],(.52,0,.66))
 return a

def restore_second_kiosk_staging(a,frame=None):
 for ob,(hr,hv) in a['staging'].items():K(ob,'hide_render',hr,frame,True);K(ob,'hide_viewport',hv,frame,True)
 for ob in a['stalks']+a['dust']+a['tap_marks']+[a['pointing_finger']]:visible(ob,False,frame)
 for eye,rest in zip(a['youth']['eyes'],a['eye_rest']):K(eye,'location',rest,frame);K(eye,'scale',(1,1,1),frame)
 for side in ['L','R']:K(a['youth']['parts']['pupil '+side],'scale',(.012,.033,.055),frame)
 a['jaw'].value=0
 if frame is not None:a['jaw'].keyframe_insert('value',frame=frame)
 mouth=a['youth']['parts']['surprised mouth'];K(mouth,'scale',(.021,.077,.085),frame);K(mouth,'location',(.325,0,-.29),frame)
 K(a['shop']['price_sign'],'rotation_euler',a['price_rotation'],frame)


def _stage(a,shot,f):
 for ob,(hr,hv) in a['staging'].items():
  hidden=(shot==8 and ob not in a['shop']['coins']) or (shot==9 and 'rolled curved roof rim' in ob.name)
  K(ob,'hide_render',hidden or hr or ob in a['shop']['coins'],f,True);K(ob,'hide_viewport',hidden or hv or ob in a['shop']['coins'],f,True)
 for actor in (a['youth'],a['seller']):
  for ob in tree(actor['root']):
   if ob not in a['stalks']:visible(ob,True,f)
 for ob in tree(a['bike']['root']):visible(ob,True,f)
 for ob in tree(a['burger']):visible(ob,'bitten' not in ob.name.lower(),f)
 for coin in a['coins']:
  for ob in tree(coin):visible(ob,True,f)
 for ob in a['dust']+a['tap_marks']+a['stalks']:visible(ob,False,f)


def _neutral(a):
 p=a['boy_stop'].copy();h=a['boy_heading'];vp=a['seller_stop'].copy();vh=a['seller_heading']
 hands={side:W(p,h,(.18,sign*.38,.10)) for side,sign in [('L',-1),('R',1)]}
 vhand={side:W(vp,vh,(.25,sign*.37,.14)) for side,sign in [('L',-1),('R',1)]}
 return p,h,vp,vh,hands,vhand

def _grip(food,h):
 # Wrists lie just outside the buns; palms/fingers reach toward the actual rim.
 side=R(h)@V((0,.245,0));return {'L':food-side+V((0,0,.095)),'R':food+side+V((0,0,.095))}

def _coin_pose(a,center,f,vertical=False):
 for i,c in enumerate(a['coins']):
  off=R(a['boy_heading'])@V(((i-(len(a['coins'])-1)/2)*.13,0,.026*i))
  K(c,'location',center+off,f);K(c,'rotation_euler',((math.pi/2 if vertical else 0),0,a['boy_heading']),f)

def _reaction(a,pop,jaw,f,shrink=False):
 for eye,rest in zip(a['youth']['eyes'],a['eye_rest']):
  K(eye,'location',rest+V((.14*pop,0,.09*pop)),f);K(eye,'scale',(1+.60*pop,)*3,f)
 for ob in a['stalks']:visible(ob,pop>.03,f)
 for side in ['L','R']:
  pupil=a['youth']['parts']['pupil '+side]
  K(pupil,'scale',(.012,.033*(.42 if shrink else 1),.055*(.42 if shrink else 1)),f)
 a['jaw'].value=jaw
 if f is not None:a['jaw'].keyframe_insert('value',frame=f)
 mouth=a['youth']['parts']['surprised mouth'];K(mouth,'scale',(.021,.077,.085*(1+1.2*jaw)),f);K(mouth,'location',(.325,0,-.29-.035*jaw),f)


def _dash_control_points(a):
 start=a['bike_stop']+V((-1.70,0,0));end=V(RETURN_JOIN_POSITION)
 return start,start+V((-1.,0,0)),end+V((1.,0,0)),end

def _road_height(y):
 # Sidewalk to road descent is eased through the existing low curb band.
 return .035+.085*smooth((y-.80)/.30)

def _dash_sample(a,u):
 u=clamp(u);p0,p1,p2,p3=_dash_control_points(a);v=1-u
 p=p0*v**3+p1*(3*v*v*u)+p2*(3*v*u*u)+p3*u**3
 tangent=3*v*v*(p1-p0)+6*v*u*(p2-p1)+3*u*u*(p3-p2)
 heading=math.atan2(tangent.y,tangent.x)
 if heading<0:heading+=math.tau
 # Both tires retain ground contact as the front rolls off the low curb first.
 pitch=0.
 for _ in range(4):
  yr=p.y+(-.85*math.cos(pitch)+.53*math.sin(pitch))*math.sin(heading)
  yf=p.y+(.85*math.cos(pitch)+.53*math.sin(pitch))*math.sin(heading)
  rearz,frontz=_road_height(yr),_road_height(yf)
  pitch=math.asin(max(-1.,min(1.,(rearz-frontz)/1.70)))
 p.z=(rearz+frontz)/2+.53*(1-math.cos(pitch))
 return p,heading,pitch

def dash_trajectory(a,u):
 """Return center-path position, tangent heading, wheel distance and curb pitch."""
 u=clamp(u)
 if 'dash_distance_lut' not in a:
  last=_dash_sample(a,0)[0];distances=[0.]
  for i in range(1,257):
   q=_dash_sample(a,i/256)[0];distances.append(distances[-1]+(q-last).length);last=q
  a['dash_distance_lut']=distances
 p,heading,pitch=_dash_sample(a,u);q=u*256;i=min(255,int(q));k=q-i;lut=a['dash_distance_lut'];distance=lut[i]*(1-k)+lut[i+1]*k
 return p,heading,distance,pitch

def return_join_state(a):
 p,h,d,pitch=dash_trajectory(a,1.)
 return {'position':tuple(p),'heading':h,'wheel_distance':d,'wheel_phase':d/.53,'crank_phase':1.20+d/.689,'pitch':pitch}


def _vendor_point_local(actor):
 shoulder=Matrix.Rotation(.10,3,'Y')@V((.005,-.315,.68*1.13))
 elbow=shoulder+V((.06,-.575,-.26)).normalized()*actor['arm_lengths'][0]
 return elbow,elbow+V((0,0,actor['arm_lengths'][1]))

def _solve_vendor_pointing(actor,amount,frame=None):
 """Fixed-length IK with an outward elbow and vertical final forearm."""
 parts=actor['parts'];joints=actor['joints'];shoulder=joints['shoulder_L'].location.copy();wrist=joints['wrist_L'].location.copy()
 target_elbow,_=_vendor_point_local(actor);pole=mix((-.40,-.53,.28),target_elbow,amount)
 elbow,wrist=ch._ik(shoulder,wrist,*actor['arm_lengths'],pole)
 ch._pose_chain(actor,'arm','L',shoulder,elbow,wrist,frame)
 for name,value in [('elbow_L',elbow),('wrist_L',wrist)]:K(joints[name],'location',value,frame)
 for name in ['upperarm_L','sleeve_L']:ch._link(parts[name],shoulder,elbow,frame)
 ch._link(parts['forearm_L'],elbow,wrist,frame);K(parts['elbow_L'],'location',elbow,frame)
 hand=parts['hand_L'];K(hand,'location',wrist,frame);hand.rotation_mode='QUATERNION';K(hand,'rotation_quaternion',(elbow-wrist).to_track_quat('Z','Y'),frame)


def pose_second_kiosk_shot(a,scene_id,local_t,duration=None,frame=None):
 shot=int(scene_id)
 if shot not in DURATIONS:raise ValueError('Only source shots 8, 9 and 15 are handled here')
 dur=DURATIONS[shot] if duration is None else float(duration)
 t=clamp(float(local_t)/dur)*TIMING_DOMAINS[shot];f=frame;wp=a['wp'];_stage(a,shot,f)
 p,h,vp,vh,hands,vhand=_neutral(a);feet={k:v.copy() for k,v in a['boy_feet'].items()};vfeet=a['seller_feet'];hh=h;hp=0;pitch=.035;expr='smile';vexpr='smile';vhh=vh+.16;vhead_pitch=0
 food=a['food_home'].copy();coin=a['payment'].copy();foodrot=(0,0,h);pop=jaw=0.;captions=[];dip=0.;beat='';shared=False
 bikepos=a['bike_stop'].copy();bikeheading=0.;bikedistance=0.;bikephase=1.20;bikelean=.025
 bc=props.pose_bicycle(a['bike'],bikepos,bikeheading,phase=bikephase,lean=bikelean,frame=f)
 if shot==8:
  # Fixed planted feet: only a breath-sized upper-body pant, no root glide.
  breath=math.sin(t*math.tau*2.1)*(.035*(1-U(t,.6,1.1)));pitch=.045+breath;expr='talk' if t<.75 and int(t*7)%2==0 else 'smile'
  pocket=W(p,h,(.08,.12,-.03));show=W(p,h,(.50,.08,.57));coin=path(t,[(0,pocket),(.75,pocket),(1.03,show),(2.65,show),(2.95,a['payment']+V((0,0,.12))),(3.19,a['payment'])])
  if t<3.19:hands['R']=coin+R(h)@V((-.035,.05,.025))
  # Owner pulls back, pushes, then keeps his fingers at the food until the
  # receiving hand has visibly touched it. The boy's pull starts AFTER release.
  food=path(t,[(0,a['food_home']),(1.62,a['food_home']),(1.86,a['food_home']+R(h)@V((.07,0,0))),(2.45,a['food_contact']),(3.04,a['food_contact']),(3.33,a['food_hold'])])
  vcontact=food+R(h)@V((.13,.20,.095))
  receiver=_grip(food,h)
  vhand['L']=vcontact if t<=3.04 else mix(vcontact,W(vp,vh,(.25,-.37,.14)),U(t,3.04,3.35))
  hands['L']=mix(hands['L'],receiver['L'],U(t,2.05,2.70))
  if t>=3.05:hands['R']=mix(a['payment']+V((0,0,.13)),receiver['R'],U(t,3.05,3.37))
  shared=2.70<=t<=3.04
  # Two distinct dry taps, then a lifted index/mitten aimed straight at the tag.
  tapreach=U(t,3.6,4.03);tapz=.15-.11*math.exp(-((t-4.20)/.075)**2)-.11*math.exp(-((t-4.53)/.075)**2)
  if t>3.6:vhand['L']=mix(W(vp,vh,(.25,-.37,.14)),a['payment']+V((0,0,tapz)),tapreach)
  point=W(vp,vh,_vendor_point_local(a['seller'])[1])
  if t>=4.80:vhh=(vh+.16)+(-math.pi/2-vh-.16)*U(t,4.80,5.12);vhead_pitch=-.14*U(t,4.80,5.12);vhand['L']=mix(a['payment']+V((0,0,.15)),point,U(t,4.80,5.12));hh=h+(-.20-h)*U(t,4.90,5.25);hp=-.16*U(t,4.90,5.25);expr='surprise'
  if 4.03<=t<4.76:expr='worry'
  for ob in a['tap_marks']:
   active=abs(t-4.20)<.075 or abs(t-4.53)<.075;visible(ob,active,f);K(ob,'location',a['payment']+V((0,0,.05)),f)
  for i,ob in enumerate(a['dust']):
   age=clamp(t/.6);visible(ob,t<.6,f);K(ob,'location',p+V((-.3+.12*i,-.22,.0))-V((0,0,1.17-.16*age)),f);K(ob,'scale',(.09+.17*age,.07+.12*age,.08+.05*age),f)
  # The one accent push-in follows the boy's real eye midpoint; ordinary keys.
  cp=wp((-2.05,-.71,3.08));target=wp((-.03,-1.81,2.29));lens=29.
  zoom=U(t,5.94,7.0)
  if zoom>0:
   eye_mid=W(p,h,(math.sin(pitch)*1.26,0,math.cos(pitch)*1.26))+R(hh)@V((.29,0,.16));target=mix(target,eye_mid,zoom);cp=mix(cp,eye_mid+R(hh)@V((.86,-.16,.02)),zoom);lens=29+29*zoom
  beat='pant' if t<.8 else 'same coins' if t<1.85 else 'push' if t<2.70 else 'receiving contact' if t<=3.04 else 'snatch' if t<3.6 else 'double coin tap' if t<4.80 else 'point to price' if t<5.94 else 'eye push-in'
 elif shot==9:
  food=a['food_hold'].copy();tremble=.022*math.sin((t-2.5)*math.tau*11) if 2.5<=t<3.125 else 0;food+=V((0,tremble,tremble*.6));hands=_grip(food,h);expr='surprise';hp=-.20;hh=-.20
  pop=U(t,.3125,.625)
  if .3125<t<.625:pop+=.12*math.sin((t-.3125)/.3125*math.pi)
  jaw=U(t,1.25,1.5625);dip=U(t,4.0625,4.6875)
  vhand['L']=W(vp,vh,_vendor_point_local(a['seller'])[1]);vhh=-math.pi/2;vhead_pitch=-.14;foodrot=(tremble*3,0,h)
  # Scene 9 stays in the actual trailer. The hanging tag is not a new screen prop.
  cp=wp((3.00,-4.90,3.20));target=wp((.80,-2.20,3.05));lens=36.
  if t>=.625:captions.append({'text':'+21%','box':(.085,.245,.30,.075),'kind':'red'})
  if t>=.9375:captions.append({'text':'Reuters, Sept 29, 2026','box':(.085,.205,.35,.025),'kind':'source'})
  beat='frozen mid-bite' if t<.3125 else 'eyes pop' if t<1.25 else 'jaw drop' if t<2.5 else 'burger tremble' if t<3.125 else 'reading hold' if t<4.0625 else 'dip to ink'
 elif shot==15:
  # Cut back with the same food, coins and bicycle where scene9 left them.
  expr='worry';hh=-.20;hp=-.08
  # Necessary connector: offer back, both parties touch, then boy lets go.
  food=path(t,[(0,a['food_hold']),(.15,a['food_hold']),(.63,a['food_contact']),(.94,a['food_contact']),(1.22,a['food_contact']+R(h)@V((.22,0,.03)))])
  hands=_grip(food,h);vcontact=food+R(h)@V((.13,.20,.095));vhand['L']=mix(vhand['L'],vcontact,U(t,.28,.65));shared=.65<=t<=.92
  if t>=.94:hands['L']=mix(hands['L'],bc['hands'][0],U(t,.94,1.45))
  # Coins are picked straight off the very sill on which they were dropped.
  coin=path(t,[(0,a['payment']),(1.00,a['payment']),(1.30,W(p,h,(.34,.07,.46))),(1.53,bc['hands'][1]+V((0,0,.05)))])
  if .94<=t<1.0:hands['R']=mix(_grip(a['food_contact'],h)['R'],a['payment']+V((0,0,.04)),U(t,.94,1.0))
  elif 1.0<=t<1.53:hands['R']=coin+V((0,0,.04))
  elif t>=1.53:hands['R']=bc['hands'][1]
  if t>=1.0:h=a['boy_heading']*(1-U(t,1.0,1.60));hh=h;pitch=.035+.225*U(t,1.15,1.72)
  # Crouch stays over the stopped bicycle. Feet transfer to pedals in a
  # staggered lift, rather than sliding along the sidewalk.
  if t>=1.36:
   feet['R']=mix(a['boy_feet']['R'],bc['feet'][1]+V((0,0,.0775)),U(t,1.36,1.72));feet['R'].z+=.12*math.sin(math.pi*clamp((t-1.36)/.36))
   p=mix(a['boy_stop'],bc['seat']+V((0,0,-.04)),U(t,1.72,2.08));h=a['boy_heading']*(1-U(t,1.0,1.60));hh=h
  if t>=1.72:
   feet['L']=mix(a['boy_feet']['L'],bc['feet'][0]+V((0,0,.0775)),U(t,1.72,2.08));feet['L'].z+=.16*math.sin(math.pi*clamp((t-1.72)/.36))
   hands={'L':bc['hands'][0],'R':bc['hands'][1]};pitch=.26+.08*U(t,1.72,2.12)
  if t>=2.08:
   # Yank and 180-degree spin: root follows the rear ground contact arc.
   spin=U(t,2.15,2.70);bikeheading=math.pi*spin;rear=a['bike_stop']+V((-.85,0,0));bikepos=rear+R(bikeheading)@V((.85,0,0));bikepos.z+=.12*math.sin(math.pi*spin)
   distance=0.;curb_pitch=0.
   if t>=2.76:bikepos,bikeheading,distance,curb_pitch=dash_trajectory(a,U(t,2.76,3.62))
   bikedistance=distance;bikephase=1.20+distance/.689;lean=-.10*math.sin(math.pi*spin) if t<2.76 else 0.
   bc=props.pose_bicycle(a['bike'],bikepos,bikeheading,distance=distance,phase=bikephase,lean=lean,frame=f)
   if t>=2.76:
    flat=Matrix.Translation(bikepos)@R(bikeheading).to_4x4();full=Matrix.Translation(bikepos)@Euler((0,curb_pitch,bikeheading)).to_matrix().to_4x4();transform=full@flat.inverted()
    K(a['bike']['root'],'rotation_euler',(0,curb_pitch,bikeheading),f)
    bc['hands']=[transform@q for q in bc['hands']];bc['feet']=[transform@q for q in bc['feet']];bc['seat']=transform@bc['seat']
   p=bc['seat']+V((0,0,-.06+.10*U(t,2.76,3.0)));h=bikeheading;hh=h;hp=.03;pitch=.33
   hands={'L':bc['hands'][0],'R':bc['hands'][1]};feet={'L':bc['feet'][0]+V((0,0,.0775)),'R':bc['feet'][1]+V((0,0,.0775))};coin=bc['hands'][1]+V((0,0,.045))
  if t>=1.22:vhand['L']=food+R(a['boy_heading'])@V((.13,.20,.095))
  if t>=2.90:vexpr='surprise'
  for i,ob in enumerate(a['dust']):
   age=clamp((t-2.80)/1.15);visible(ob,2.8<t<4,f);K(ob,'location',a['bike_stop']+V((-.35+.17*i,.10*math.sin(i),.13+.20*age)),f);K(ob,'scale',(.12+.23*age,.09+.17*age,.09+.20*age),f)
  # Wide return rhymes with the opening and gives the spin its whole silhouette.
  cp=wp((4.70,-7.00,3.10));target=wp((.0,-1.70,2.40));lens=43.
  beat='glare and return' if t<.65 else 'return contact' if t<.94 else 'take coins back' if t<1.53 else 'crouch' if t<2.15 else 'spin' if t<2.76 else 'dash' if t<3.62 else 'seller blink hold'
 # Same physical food/coin roots survive all three shots.
 K(a['burger'],'location',food,f);K(a['burger'],'rotation_euler',foodrot,f)
 _coin_pose(a,coin,f,vertical=(shot==8 and .85<t<2.8) or (shot==15 and 1.15<t<1.50))
 ch.pose_character(a['youth'],p,h,hands,feet,hh,expr,frame=f,torso_pitch=pitch,head_pitch=hp)
 ch.pose_character(a['seller'],vp,vh,vhand,vfeet,vhh,vexpr,frame=f,torso_pitch=.10,head_pitch=vhead_pitch)
 if (shot==8 and t>=4.80) or shot==9:_solve_vendor_pointing(a['seller'],U(t,4.80,5.12) if shot==8 else 1.,f)
 # The extended index points straight upward in world space, independent of
 # the bend of the vendor's supporting wrist.
 finger=a['pointing_finger'];finger.rotation_mode='QUATERNION';inverse=a['seller']['parts']['hand_L'].rotation_quaternion.inverted()
 K(finger,'rotation_quaternion',inverse,f);K(finger,'location',inverse@V((0,0,.19)),f)
 if shot==15:
  for i,brow in enumerate(a['youth']['brows']):K(brow,'rotation_euler',((-.32 if i==0 else .32),0,0),f);K(brow,'location',(0,0,-.02),f)
 ch.blink_character(a['youth'],1 if shot==8 and 1.40<t<1.52 else 0,f)
 ch.blink_character(a['seller'],1 if shot==15 and (3.52<t<3.62 or 3.85<t<3.94) else 0,f)
 _reaction(a,pop,jaw,f,shrink=shot==8 and t>5.94)
 visible(a['pointing_finger'],(shot==8 and t>=5.12) or shot==9,f)
 # Tag swing remains a transform of the actual hanging card.
 rot=a['price_rotation'].copy();rot.z+=.28 if shot==9 else 0
 if shot==9:rot.y=math.radians(4)*(1-U(t,0,.625))
 elif shot==15:rot.y=math.radians(8)*math.sin(max(0,t-2.8)*11)*U(t,2.8,3.05)
 K(a['shop']['price_sign'],'rotation_euler',rot,f)
 spec=_camera(a['camera'],cp,target,lens,f)
 a['last_state']={'scene':shot,'local_t':local_t,'duration':dur,'beat':beat,'camera':spec,'captions':captions,'dip_alpha':dip,'shared_contact':shared,'burger':tuple(food),'coins':tuple(coin),'boy_root':tuple(p),'seller_root':tuple(vp),'boy_feet':{k:tuple(v) for k,v in feet.items()},'bike_root':tuple(bikepos),'bike_heading':bikeheading,'bike_wheel_phase':bikedistance/.53,'bike_crank_phase':bikephase}
 return a['last_state']
