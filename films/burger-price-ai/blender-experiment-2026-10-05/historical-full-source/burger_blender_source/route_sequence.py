"""Faithful volumetric route beats for source shots 05, 06, 07 and 16.

Public API
----------
create_route_sequence(street, youth=None, bike=None, camera=None)
pose_route_shot(route, shot_id, local_t, duration=None, frame=None)
camera_for_route(route, shot_id, local_t, duration=None)
stage_route_shot(route, shot_id, local_t, duration=None, frame=None)
restore_route_staging(route, frame=None)

The default readable durations are 4, 3, 3, 6 seconds. Pass source durations
2, 1.5, 1.5, 1 if the original timing is required. Source actions/counter order
are preserved. The return uses one continuous decreasing-X world trajectory;
its four camera sections follow the original columns/fountain/fences/home cuts.
No handlers, drivers, simulation, or frame_set calls are needed when baking.

Integration notes
-----------------
- pose_route_shot stages source-specific landmark visibility automatically.
  Call restore_route_staging(route, frame) on the first frame of non-route shots.
- Sole contacts use pedal center + .1675 m (.140 m sole-to-ankle plus
  .0275 m half pedal thickness), +.0775 m over props.py's current returned feet.
  props.py and character.py are not modified by this module.
- On return heading=pi; positive local wheel rotation becomes negative world-Y
  rotation, matching decreasing world-X travel. Do not negate it a second time.
- Forward roots: scene 5 x13.4..18.4; scene 6 x17.8..23.3; scene 7 x23.1..29.0.
  Return is continuous x24.65..13.08 with source cuts at quarter-duration marks.
- RETURN_JOIN and return_join_state() match the scene15 curb-arc endpoint,
  including wheel/crank phase and the rider's initial .04 m saddle rise.
- Road/bike root Z=.035; ground ankle Z=.175. Ordinary riding pelvis uses the
  exact saddle anchor. Standing sprint and final straddle deliberately leave it.
- Shared master scene should hide its 'Soft road repair' curves in previews.
- This module does not render any film, change render settings, or add captions
  beyond the source's 0..2 mi counter.
"""
import bpy, math
from mathutils import Vector, Matrix
import environment as env
import character as ch
import props

DURATIONS={5:4.0,6:3.0,7:3.0,16:6.0}
# Shared route/second-kiosk joins, world XYZ.
OUTBOUND_JOIN=(29.0,-.30,.035)
RETURN_JOIN=(24.65,-.30,.035)
# Agreed terminal values from second_kiosk_sequence.return_join_state().
RETURN_WHEEL_DISTANCE=4.006264978760862
RETURN_CRANK_PHASE=7.0146080968953015
SOURCE_DURATIONS={5:2.0,6:1.5,7:1.5,16:1.0}
SHOT_NAMES={5:'Picket fences: chew, gulp, lick',6:'Fountain: double take',7:'Columns: sniff, grin, sprint',16:'Two miles back'}

def clamp(x,a=0.,b=1.): return min(b,max(a,x))
def smooth(x): x=clamp(x);return x*x*(3-2*x)
def mix(a,b,t): return a+(b-a)*t

def key(o,prop,v,frame=None,constant=False):
    props.key(o,prop,v,frame,'CONSTANT' if constant else 'LINEAR')

def visible(o,value,frame=None):
    key(o,'hide_render',not value,frame,True)
    key(o,'hide_viewport',not value,frame,True)

def subtree(o):
    yield o
    for child in o.children: yield from subtree(child)

def _column_landmark():
    """Source 07's four-column house, pediment, urn and tall iron gate."""
    n='ROUTE SOURCE COLUMN HOUSE';r=env.empty(n,(26.15,7.5,0))
    env.box(n+' lawn terrace',(0,-.8,.1),(8.6,5.8,.20),'lawn',.07,r)
    env.box(n+' main house',(0,1.20,2.80),(7.20,3.8,5.6),'teal_light',.05,r)
    for z in [.5,2.70,5.57]: env.box(n+' wall stone band',(0,-.78,z),(7.34,.20,.17),'cream',.02,r)
    for x in [-2.72,2.72]:
        for z in [1.65,4.05]: env._window(n+' sash',x,-.75,z,.91,1.47,r)
    env.box(n+' tall entrance',(0,-.84,2.30),(1.16,.15,3.25),'teal_dark',.05,r)
    for j in range(3):
        env.box(n+' portico step '+str(j),(0,-2.08,.16+j*.17),(5.2-j*.32,2.2-j*.18,.18),'stone',.025,r)
    for x in [-1.94,-.65,.65,1.94]:
        env.box(n+' square plinth',(x,-1.63,.64),(.65,.65,.24),'stone_shadow',.025,r)
        env.cylinder(n+' column foot',(x,-1.63,.87),.32,.22,'cream',r,28)
        env.cylinder(n+' column shaft',(x,-1.63,2.91),.225,3.93,'stone',r,28)
        # Fine raised flutes and several rings make unmistakable round columns.
        for a in range(12):
            ang=a*math.tau/12
            env.rod(n+' column flute',(x+.219*math.sin(ang),-1.63+.219*math.cos(ang),1.02),(x+.219*math.sin(ang),-1.63+.219*math.cos(ang),4.75),.013,'cream',r,8)
        env.cylinder(n+' capital neck',(x,-1.63,4.95),.29,.20,'cream',r,24)
        env.box(n+' column capital',(x,-1.63,5.11),(.72,.68,.18),'cream',.026,r)
    env.box(n+' entablature',(0,-1.61,5.33),(5.40,1.18,.34),'stone',.04,r)
    env.mesh(n+' pediment',[(-2.87,-2.23,5.54),(2.87,-2.23,5.54),(0,-2.23,6.85),(-2.87,-1.02,5.54),(2.87,-1.02,5.54),(0,-1.02,6.85)],[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],'cream',r,.025)
    env.mesh(n+' inset tympanum',[(-2.30,-2.265,5.71),(2.30,-2.265,5.71),(0,-2.265,6.62)],[(0,1,2)],'teal_light',r)
    env.disc_front(n+' pediment oculus',(0,-2.29,6.03),.20,.05,'water',r)
    # Urn and gate are both source landmarks, not invented story information.
    urn=env.empty(n+' stone urn',(-3.48,-3.02,0),r)
    env.box(n+' urn plinth',(0,0,.59),(.62,.62,1.18),'stone',.05,urn)
    env.cylinder(n+' urn base',(0,0,1.22),.38,.15,'cream',urn)
    env.sphere(n+' rounded urn',(0,0,1.53),(.36,.36,.35),'stone',urn,20)
    env.cylinder(n+' urn lip',(0,0,1.81),.40,.12,'cream',urn)
    env.sphere(n+' urn clipped plant',(0,0,1.99),(.37,.36,.24),'leaf',urn,20)
    for x in [4.1,6.6]:
        env.box(n+' gate pillar',(x,-2.65,1.23),(.44,.48,2.46),'stone',.035,r)
        env.box(n+' gate capital',(x,-2.65,2.50),(.62,.67,.16),'cream',.025,r)
        env.sphere(n+' gate ball',(x,-2.65,2.77),(.20,.20,.20),'stone',r,20)
    for i in range(13):
        x=4.34+i*.168;z=2.35+.31*math.sin(math.pi*i/12)
        env.rod(n+' iron gate bar',(x,-2.65,.15),(x,-2.65,z),.027,'teal_dark',r)
        env.sphere(n+' gate finial',(x,-2.65,z+.06),(.046,.040,.073),'gold',r,12)
    for z in [.55,1.9]:env.rod(n+' gate rail',(4.2,-2.65,z),(6.4,-2.65,z),.031,'teal_dark',r)
    return r

def _connecting_fences():
    """Match the source modest street on the physical road back to booth one.
    These small cottage facades fill the geographic gap at x14..19. Existing
    scenery is left intact; no story landmark is removed or replaced."""
    r=env.empty('ROUTE SOURCE MODEST FRONTAGE')
    for i,(x,wall,roof) in enumerate([(13.4,'yellow_light','copper_light'),(16.0,'coral','lilac'),(18.55,'yellow_light','copper_light')]):
        q=env.cottage('Route modest cottage '+str(i),(x,11.7,0),2.45,wall,roof,2.35);q.parent=r
    env.fence('Route matching picket frontage',14.25,18.50,5.2,.97,r)
    # A short pegged washing line is also present in source 05.
    for x in [15.20,17.9]: env.rod('Route laundry post',(x,9.0,0),(x,9.0,2.5),.044,'wood',r)
    env.curve('Route sagging laundry line',[(15.2,9,2.5),(16.55,9,2.35),(17.9,9,2.5)],'wood_dark',.014,r)
    laundry=[]
    for i,x in enumerate([15.63,16.47,17.24]):
        pivot=env.empty('Route pegged cloth pivot '+str(i),(x,9,2.41),r)
        cloth=env.box('Route cloth '+str(i),(0,0,-.39),(.48,.033,.75),'cream' if i!=1 else 'pink',.015,pivot)
        laundry.append(pivot)
        for dx in [-.17,.17]:env.box('Route wooden peg',(dx,-.014,.0),(.04,.055,.10),'wood',.005,pivot)
    return r,laundry

def _make_counter(camera):
    r=env.empty('Route counter camera parent',parent=camera)
    r.location=(-.175,.444,-1.0)
    badge=props.sphere('Distance counter painted oval',(0,0,0),(.139,.053,.003),'C5EFE3',r)
    values={}
    for value in [0,.25,.5,.75,1,1.25,1.5,1.75,2]:
        label=env.text('Route distance '+str(value),f'{value:g} mi',(0,0,.006),.051,'ink',r,True)
        label.rotation_euler=(0,0,0);label.data.extrude=0;label.data.bevel_depth=0;values[value]=label
        visible(label,False)
    return {'root':r,'badge':badge,'values':values}

def create_route_sequence(street,youth=None,bike=None,camera=None):
    """Create additions and controls without altering scene/render settings.

    Reuse parent-supplied actors to keep the character and bicycle persistent.
    Returned actor objects, world anchors, counter objects and contact report
    are integration-visible. Extra scenery is real geometry at distinct depths.
    """
    before=set(bpy.data.objects)
    youth=youth or ch.create_character('Route cyclist','youth',(0,0,1.36))
    bike=bike or props.create_bicycle('Route green bicycle')
    if camera is None:
        bpy.ops.object.camera_add();camera=bpy.context.object;camera.name='Route source perspective camera'
    camera.data.type='PERSP';camera.data.sensor_fit='HORIZONTAL';camera.data.lens=50
    camera.data.clip_start=.02;camera.data.clip_end=180
    landmark=_column_landmark();frontage,laundry=_connecting_fences()
    counter=_make_counter(camera)
    head=youth['joints']['head']
    tongue=props.sphere('Route licking tongue',(.40,-.06,-.285),(.073,.047,.020),'E79E9A',head)
    gulp=props.sphere('Route swallow throat bump',(.082,-.105,.83),(.055,.058,.067),'E9AC83',youth['root'])
    visible(tongue,False);visible(gulp,False)
    jets=[o for o in street['fountain'].children if 'arcing water jet' in o.name]
    jet_shapes={o.name:[p.co.copy() for p in o.data.splines[0].bezier_points] for o in jets}
    dust=[]
    for i in range(5):
        q=props.sphere('Route wheel dust '+str(i),(0,0,0),(.17,.12,.13),'DCD4BF');visible(q,False);dust.append(q)
    # Keep source districts visually distinct when the master street is shared.
    staged_roots=[street['shop1']['root'],street['shop2']['root'],street['fountain'],street['arch'],landmark]
    staging_defaults={o:(o.hide_render,o.hide_viewport) for root in staged_roots for o in subtree(root)}
    # Bookkeeping uses evaluated-free analytic transforms, including reverse pass.
    return {'street':street,'youth':youth,'bike':bike,'camera':camera,'counter':counter,
            'column_house':landmark,'modest_frontage':frontage,'laundry':laundry,
            'tongue':tongue,'gulp':gulp,'jets':jets,'jet_shapes':jet_shapes,'dust':dust,
            'anchors':{'fences':Vector((16.5,-.30,.035)),'fountain':Vector((20.0,-.30,.035)),
                       'columns':Vector((26.15,-.30,.035)),'home_stop':Vector((13.08,-.30,.035))},
            'staging_defaults':staging_defaults,'stage_state':{},'objects':list(set(bpy.data.objects)-before),'last_contact_error':0.}

def _stage_visibility(route,ob,shown,frame):
    # Only store ordinary visibility keys at actual shot-state changes. Avoid
    # hundreds of redundant keys per frame on the detailed shop structures.
    states=route.setdefault('stage_state',{})
    previous=states.get(ob)
    if frame is None or previous is None or previous[0]!=shown or frame<previous[1]:
        visible(ob,shown,frame)
    states[ob]=(shown,frame if frame is not None else -1)

def stage_route_shot(route,shot_id,local_t,duration=None,frame=None):
    """Shot dressing: do not prematurely reveal the next source landmark.
    Call restore_route_staging when leaving route shots in a shared master scene.
    This changes visibility only, never actor positions or route geometry.
    """
    shot=int(shot_id);duration=DURATIONS[shot] if duration is None else duration
    district=shot
    if shot==16:district=[7,6,5,1][min(3,int(clamp(local_t/duration)*4))]
    street=route['street']
    groups=[(street['shop1']['root'],district==1),(street['shop2']['root'],False),
            (street['fountain'],district==6),(street['arch'],district==6),
            (route['column_house'],district==7)]
    for root,shown in groups:
        for o in subtree(root):_stage_visibility(route,o,shown,frame)
    _stage_visibility(route,route['counter']['badge'],True,frame)
    if 'root' in route['counter']:_stage_visibility(route,route['counter']['root'],True,frame)
    return district

def restore_route_staging(route,frame=None):
    """Restore inherited street visibility and remove route-only overlay/gags."""
    for ob,(hr,hv) in route['staging_defaults'].items():
        key(ob,'hide_render',hr,frame,True);key(ob,'hide_viewport',hv,frame,True)
    for ob in subtree(route['counter']['root']):visible(ob,False,frame)
    for ob in [route['tongue'],route['gulp']]+route['dust']:visible(ob,False,frame)
    route['stage_state']={}

def _state(shot,t,duration):
    """World path and source-local acting time; never resets within a shot."""
    shot=int(shot);u=clamp(t/duration);st=u*SOURCE_DURATIONS[shot]
    if shot==5:
        x=mix(13.4,18.4,u);start=13.4;heading=0;pitch=.15;pelvis_offset=Vector((0,0,0))
    elif shot==6:
        x=mix(17.8,23.3,u);start=17.8;heading=0;pitch=.15;pelvis_offset=Vector((0,0,0))
    elif shot==7:
        start=23.1;heading=0;pitch=.15;pelvis_offset=Vector((0,0,0))
        # Sniff/grin remain in frame; the final third has real acceleration.
        if st<1: x=23.1+3.5*st
        else: q=st-1;x=26.6+3.5*q+2.6*q*q
        if .833333<=st<1: pitch=.37;pelvis_offset=Vector((.035,0,-.045))
        elif st>=1: pitch=.32;pelvis_offset=Vector((.06,0,.055))
    else:
        start=RETURN_JOIN[0];heading=math.pi;join_hold=1-smooth(u/.08);pitch=.30+.03*join_hold;pelvis_offset=Vector((0,0,.04*join_hold))
        # Four source districts with a continuous monotone path across the cuts.
        if u<.25: x=mix(RETURN_JOIN[0],22.55,u/.25)
        elif u<.5: x=mix(22.55,18.9,(u-.25)/.25)
        elif u<.75: x=mix(18.9,15.4,(u-.5)/.25)
        elif u<.925: x=mix(15.4,13.08,1-(1-(u-.75)/.175)**3)
        else: x=13.08
        if u>.825: pitch=mix(.30,.07,smooth((u-.825)/.1))
    pos=Vector((x,-.30,.035))
    distance=(x-start)*math.cos(heading) # local rolling displacement; world axle reverses with heading
    phase=distance/.53/1.30
    if shot==16:
        phase=RETURN_CRANK_PHASE+distance/.689
        distance+=RETURN_WHEEL_DISTANCE
    if shot==7:
        frozen=(3.5*.833333)/.53/1.30
        if .833333<=st<1: phase=frozen
        elif st>=1: phase=frozen+(x-26.6)/.53/1.30
    return {'position':pos,'heading':heading,'distance':distance,'phase':phase,'pitch':pitch,
            'pelvis_offset':pelvis_offset,'source_t':st,'u':u}

def return_join_state():
    """Shared scene15→16 continuity contract, including the rolling phase."""
    return {'position':RETURN_JOIN,'heading':math.pi,'wheel_distance':RETURN_WHEEL_DISTANCE,
            'wheel_phase':RETURN_WHEEL_DISTANCE/.53,'crank_phase':RETURN_CRANK_PHASE,
            'pitch':0.0,'rider_pelvis_offset':(0,0,.04),'rider_torso_pitch':.33}

def camera_for_route(route,shot_id,local_t,duration=None):
    """Perspective camera transforms. Outbound remains locked like the source;
    the return has source's four hard-cut views, no unmotivated orbit/zoom."""
    shot=int(shot_id);duration=DURATIONS[shot] if duration is None else duration
    st=_state(shot,local_t,duration);u=st['u']
    if shot==5:cx=16.25;target=Vector((cx,.10,3.45));pos=Vector((cx+1.3,-10.4,3.9));cut=0
    elif shot==6:cx=20.55;target=Vector((cx,.2,3.60));pos=Vector((cx+1.15,-10.8,4.1));cut=0
    elif shot==7:cx=26.45;target=Vector((cx,.3,3.65));pos=Vector((cx+1.15,-11.0,4.2));cut=0
    else:
        cut=min(3,int(u*4))
        centers=[24.65,21.5,17.25,13.70];cx=centers[cut]
        target=Vector((cx,.25,3.45));pos=Vector((cx-1.25,-10.4,3.95))
    return {'position':pos,'target':target,'rotation':(target-pos).to_track_quat('-Z','Y').to_euler(),'lens':65.,'cut':cut}

def _counter_value(shot,st):
    if shot==5: seq=[(0,0),(.5,.25),(1,.5),(1.5,.75)]
    elif shot==6: seq=[(0,1),(.5,1.25),(1,1.5)]
    elif shot==7: seq=[(0,1.75),(.5,2)]
    else: seq=[(i*.125,v) for i,v in enumerate([1.75,1.5,1.25,1,.75,.5,.25,0])]
    current=seq[0]
    for tm,value in seq:
        if st+1e-6>=tm:current=(tm,value)
    return current[1],st-current[0]

def pose_route_shot(route,shot_id,local_t,duration=None,frame=None):
    """Set/key a frame using local seconds. Returns contacts, source gag and camera.
    Uses ordinary animation keyframes only and never advances the current scene.
    """
    shot=int(shot_id)
    if shot not in DURATIONS:raise ValueError('Route module only owns source shots 5, 6, 7, 16')
    duration=DURATIONS[shot] if duration is None else float(duration)
    stage_route_shot(route,shot,local_t,duration,frame)
    st=_state(shot,local_t,duration);ts=st['source_t'];u=st['u'];h=st['heading']
    bike=route['bike'];actor=route['youth'];cam=route['camera']
    bc=props.pose_bicycle(bike,st['position'],h,st['distance'],st['phase'],frame=frame)
    # Physical sole contact: ankle is .140 above the shoe sole; the pedal
    # platform is .055 thick. Derive it independently of legacy helper offsets.
    rotation=Matrix.Rotation(h,3,'Z')
    bc['feet']=[st['position']+rotation@Vector((.18*math.sin(st['phase']+i*math.pi),yy,.56+.18*math.cos(st['phase']+i*math.pi)+.1675)) for i,yy in [(0,-.15),(1,.15)]]
    pelvis=bc['seat']+Matrix.Rotation(h,3,'Z')@st['pelvis_offset']
    hands=dict(zip(('L','R'),bc['hands']));feet=dict(zip(('L','R'),bc['feet']))
    expression='smile';head_pitch=0;head_heading=h;blink=0.;gag='riding';lick=False;gulp=False
    if shot==5:
        if ts<1:
            expression='talk' if int(ts*12)%3==0 else 'smile';head_pitch=.015*math.sin(ts*math.tau*3);gag='chewing'
        elif ts<1.125:
            gulp=True;head_pitch=-.11;gag='gulp'
        else:lick=ts<1.55;gag='lick lips';head_pitch=.015
    elif shot==6:
        if .5<=ts<.583334:blink=1.;head_pitch=.10;gag='double take blink'
        elif ts>=.583334:
            expression='surprise';head_pitch=-.12
            # Keep the impressed face legible in profile, as in the source's cheated head turn.
            dx=19.6-(st['position'].x+.02);head_heading=-.10+.05*math.sin((ts-.583334)*2.2)
            gag='impressed fountain look'
    elif shot==7:
        if .5<=ts<.666667:
            head_pitch=-.12-.12*math.sin((ts-.5)/.166667*math.pi);blink=.65;gag='two sniffs'
        elif .666667<=ts<.833333:expression='laugh';gag='grin'
        elif .833333<=ts<1:expression='laugh';head_pitch=.08;gag='crouch with still pedals'
        elif ts>=1:expression='smile';head_pitch=.05;gag='sprint'
    else:
        expression='worry' if u<.5 else 'smile';head_pitch=.03*(1-smooth(u/.08));gag=['columns return','fountain return','fences return','home skid'][min(3,int(u*4))]
        if u>=.875:
            # A planted near shoe only after the physical stop; far foot stays on its pedal.
            q=smooth((u-.875)/.05);pelvis.z-=.18*q;feet['R']=Vector(feet['R']).lerp(Vector((st['position'].x+.36,st['position'].y-.29,.175)),q)
            if u>=.925:gag='home stop';expression='laugh'
    ch.pose_character(actor,pelvis,h,hands,feet,head_heading,expression,frame,torso_pitch=st['pitch'],head_pitch=head_pitch)
    ch.blink_character(actor,blink,frame)
    visible(route['tongue'],lick,frame);visible(route['gulp'],gulp,frame)
    if lick:
        q=clamp((ts-1.125)/.425);key(route['tongue'],'location',(.398,-.11+.21*q,-.278+.019*math.sin(q*math.pi)),frame)
    if gulp:
        q=clamp((ts-1)/.125);key(route['gulp'],'location',(.085,-.104,.97-.25*q),frame)
    # Small washing movement and source's springing water jets animate the place.
    for i,o in enumerate(route['laundry']):key(o,'rotation_euler',(.05*math.sin(local_t*2.7+i),.07*math.sin(local_t*2.3+i*1.6),0),frame)
    jet_wave=[.78,1.,.9,.9,.8,.8,.7,.7,.62,.62,.55,.55]
    height=jet_wave[int((ts% .5)*24)%12] if shot==6 else .82
    for o in route['jets']:
        # Transform about water level instead of raising the basin or floor.
        key(o,'scale',(1,1,height),frame);key(o,'location',(0,0,1.38*(1-height)),frame)
    dustshow=(shot==7 and 1<=ts<1.32) or (shot==16 and .79<=u<.97)
    for i,o in enumerate(route['dust']):
        visible(o,dustshow,frame)
        if dustshow:
            age=(ts-1)/.32 if shot==7 else (u-.79)/.18;age=clamp(age)
            rear=st['position']+Matrix.Rotation(h,3,'Z')@Vector((-.96,0,0))
            p=rear+Matrix.Rotation(h,3,'Z')@Vector((-.25*i-.6*age,.12*math.sin(i),.08+.40*age))
            key(o,'location',p,frame);sz=(.55+.13*i)*math.sin(age*math.pi)*.24;key(o,'scale',(sz*1.4,sz,sz*.7),frame)
    value,age=_counter_value(shot,ts)
    for val,ob in route['counter']['values'].items():visible(ob,val==value,frame)
    f=int(age*24+1e-6);pop=[.72,1.08,1.0][f] if f<3 else 1
    if shot==5 and value==0:pop=1
    hudscale=50.0/65.0
    key(route['counter']['root'],'location',(-.175*hudscale,.444*hudscale,-1.0),frame)
    key(route['counter']['root'],'scale',(pop*hudscale,)*3,frame)
    cd=camera_for_route(route,shot,local_t,duration)
    key(cam,'location',cd['position'],frame,True);key(cam,'rotation_euler',cd['rotation'],frame,True)
    cam.data.lens=cd['lens']
    if frame is not None:cam.data.keyframe_insert('lens',frame=frame)
    # Analytic contact verification never reads stale evaluated world matrices.
    R=Matrix.Rotation(h,3,'Z');error=0.
    for side in ('L','R'):
        wrist=Vector(pelvis)+R@actor['joints']['wrist_'+side].location
        ankle=Vector(pelvis)+R@actor['joints']['ankle_'+side].location
        error=max(error,(wrist-Vector(hands[side])).length,(ankle-Vector(feet[side])).length)
    route['last_contact_error']=error
    return {'bike':bc,'pelvis':pelvis,'hands':hands,'feet':feet,'contact_error':error,'counter':value,
            'gag':gag,'camera':cd,'state':st}
