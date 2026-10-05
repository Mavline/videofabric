"""True-volume cartoon cast. Blender 4.x, Z up, face +X, left/right +/-Y.
create_character(name, kind='youth', position=(0,0,0)) returns an editable actor.
position is the ROOT/PELVIS world position (standing pelvis height is 1.24).
pose_character endpoints are WORLD ankle/wrist coordinates, not soles/fingertips.
All animation is ordinary transform, curve-point, or visibility keyframes.
No handlers, image planes, dependencies, or third-party assets.
"""
import bpy, math
from mathutils import Vector, Matrix

PALETTE={'skin':'F3BD91','blush':'D88979','red':'C73531','redlight':'E34536','green':'194E41','greenlight':'346B50','hair':'E5AF4F','hairdark':'BE8339','teal':'2D706D','tealdark':'20514D','cream':'FFF1CE','white':'FFFAE9','ink':'253537','iris':'6A9794','pink':'DF7894','pinklight':'EA92A8','brown':'734835','sole':'3E352F','ear':'D38C6E'}

def rgba(c):
    h=PALETTE.get(c,c).lstrip('#'); a=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in a)+(1,)

def finish(o,name,color,parent=None):
    o.name=name; o.color=rgba(color); o.parent=parent
    if hasattr(o.data,'polygons'):
        for p in o.data.polygons:p.use_smooth=True
    return o

def empty(n,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=parent;o.empty_display_size=.08;return o

def sphere(n,loc,scale,c,parent=None,seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=20,location=(0,0,0));o=finish(bpy.context.object,n,c,parent);o.location=loc;o.scale=scale;return o

def curve(n,pts,c='ink',width=.012,parent=None,cyclic=False):
    cu=bpy.data.curves.new(n,'CURVE');cu.dimensions='3D';cu.resolution_u=18;cu.bevel_depth=width;cu.bevel_resolution=3
    sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1);sp.use_cyclic_u=cyclic
    for p,co in zip(sp.bezier_points,pts):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(n,cu);bpy.context.collection.objects.link(o);return finish(o,n,c,parent)

def mesh_obj(n,verts,faces,c,parent=None,sub=0):
    m=bpy.data.meshes.new(n);m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new(n,m);bpy.context.collection.objects.link(o);finish(o,n,c,parent)
    if sub:m=o.modifiers.new('Hand shaped soft surface','SUBSURF');m.levels=sub;m.render_levels=sub
    return o

def ring_body(n,rings,c,parent=None,sides=40,sub=1):
    """Rings are (z, front_x, back_x, halfwidth_y), shaped around actual volume."""
    vs=[]
    for z,front,back,w in rings:
        for i in range(sides):
            a=2*math.pi*i/sides;co=math.cos(a);si=math.sin(a)
            x=(front+back)/2+(front-back)/2*co
            vs.append((x,w*si,z))
    fs=[]
    for j in range(len(rings)-1):
        for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;fs.append((a,b,b+sides,a+sides))
    fs.append(tuple(range(sides-1,-1,-1)));fs.append(tuple((len(rings)-1)*sides+i for i in range(sides)))
    return mesh_obj(n,vs,fs,c,parent,sub)

def spindle(n,radii,c,parent=None):
    return ring_body(n,[(z,r,-r,r) for z,r in radii],c,parent,sides=24,sub=1)

def tuft(n,pts,c,parent):
    # Three dimensional swept tapered locks, rather than planar triangles.
    vs=[];fs=[];N=10
    for k,(co,r) in enumerate(pts):
        co=Vector(co)
        direction=Vector(pts[min(k+1,len(pts)-1)][0])-Vector(pts[max(k-1,0)][0]);direction.normalize()
        u=direction.cross(Vector((0,0,1)))
        if u.length<.1:u=direction.cross(Vector((0,1,0)))
        u.normalize();v=direction.cross(u).normalized()
        for j in range(N):vs.append(tuple(co+r*(math.cos(2*math.pi*j/N)*u+.6*math.sin(2*math.pi*j/N)*v)))
    for k in range(len(pts)-1):
        for j in range(N):a=k*N+j;b=k*N+(j+1)%N;fs.append((a,b,b+N,a+N))
    fs.append(tuple(range(N-1,-1,-1)));fs.append(tuple((len(pts)-1)*N+j for j in range(N)))
    return mesh_obj(n,vs,fs,c,parent,1)

def _key(o,prop,frame):
    if frame is not None:o.keyframe_insert(data_path=prop,frame=frame)

def _set_visible(o,visible,frame):
    o.hide_render=not visible;o.hide_viewport=not visible
    _key(o,'hide_render',frame);_key(o,'hide_viewport',frame)

def _link(o,a,b,frame):
    a=Vector(a);b=Vector(b);d=b-a;o.location=a;o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y');o.scale=(1,1,d.length)
    for prop in ('location','rotation_quaternion','scale'):_key(o,prop,frame)

def _ik(a,b,l1,l2,pole):
    a=Vector(a);b=Vector(b);delta=b-a;d=max(.001,min(delta.length,l1+l2-.003));axis=delta.normalized();target=a+axis*d
    x=(l1*l1-l2*l2+d*d)/(2*d);h=math.sqrt(max(0,l1*l1-x*x));p=Vector(pole)-a;p=p-axis*p.dot(axis)
    if p.length<.001:p=Vector((1,0,0))-axis*axis.x
    return a+axis*x+p.normalized()*h,target

def create_character(name,kind='youth',position=(0,0,0)):
    vendor=kind=='vendor';root=empty(name+' | PELVIS',position);parts={};joints={};head=empty(name+' | HEAD',(0,0,1.26 if not vendor else 1.40),root);joints['head']=head
    actor={'root':root,'joints':joints,'parts':parts,'kind':kind,'name':name,'rest_pelvis_height':1.24,'arm_lengths':(.59,.58),'leg_lengths':(.545,.545),'expressions':{},'brows':[],'eyes':[],'base_head_height':head.location.z}
    def S(key,loc,scale,c,p=root):
        o=sphere(name+' | '+key,loc,scale,c,p);parts[key]=o;return o
    # Deliberately irregular head silhouette: broad forehead, cheeks, soft muzzle, tapered jaw.
    if not vendor:
        rings=[(-.47,.10,-.13,.08),(-.43,.23,-.25,.22),(-.34,.32,-.34,.34),(-.20,.37,-.39,.40),(-.04,.34,-.43,.43),(.15,.33,-.43,.425),(.32,.27,-.38,.36),(.43,.15,-.29,.26),(.49,-.01,-.14,.09),(.50,-.07,-.09,.015)]
    else:
        rings=[(-.52,.05,-.12,.055),(-.48,.24,-.23,.19),(-.36,.32,-.30,.28),(-.18,.29,-.33,.32),(.02,.29,-.36,.355),(.23,.27,-.36,.34),(.42,.17,-.28,.24),(.49,-.01,-.14,.06)]
    head_rings=list(rings)
    parts['head_mesh']=ring_body(name+' | sculpted cranial jaw volume',rings,'skin',head,48,2)
    S('neck',(-.06,0,.90 if not vendor else 1.0),(.15,.16,.22),'skin')
    shirt='pink' if vendor else 'red'
    rings=[(-.14,.16,-.19,.22),(-.09,.24,-.22,.29),(.14,.29,-.23,.31),(.42,.25,-.22,.31),(.68,.20,-.22,.34),(.79,.09,-.16,.27),(.84,.04,-.12,.13)]
    if vendor:rings=[(z*1.13,f*.93,b*.95,w*.95) for z,f,b,w in rings]
    parts['torso']=ring_body(name+' | tailored shirt volume',rings,shirt,root,40,2)
    # Embroidered neckline and a curving hem follow the entire body.
    S('hips',(-.025,0,-.11),(.25,.28,.20),'teal' if not vendor else 'tealdark')
    if vendor:
        # Convex white apron sits on the chest and rounds the belly, never a camera-facing plane.
        apronrings=[(-.22,.255,.19,.19),(-.14,.29,.19,.25),(.08,.31,.23,.26),(.40,.28,.22,.23),(.65,.225,.18,.15)]
        parts['apron']=ring_body(name+' | curved linen apron',apronrings,'cream',root,32,1)
        for sign in (-1,1):curve(name+f' | apron strap {sign}',[(.12,sign*.24,.82),(.22,sign*.20,.61),(.27,sign*.16,.39)],'white',.035,root)
        curve(name+' | apron pocket',[(.303,-.12,.08),(.32,-.11,-.01),(.33,.10,-.01),(.308,.12,.08)],'hairdark',.008,root)
    # Head landmarks exist on both sides and occupy space around the skull.
    for side,sign in [('L',-1),('R',1)]:
        y=sign*(.40 if not vendor else .325)
        ear=S('ear '+side,(-.13,y,-.04),(.115,.094,.158),'skin',head)
        inner=S('ear concha '+side,(-.115,y+sign*.077,-.038),(.060,.024,.098),'ear',head)
        curve(name+' | ear fold '+side,[(-.13,y+sign*.099,.023),(-.08,y+sign*.103,.006),(-.10,y+sign*.107,-.059)],'hairdark',.009,head)
        # Eye axes splay by 22 degrees across the convex face, making exact profile readable.
        eyey=sign*(.219 if not vendor else .172);eyez=.16 if not vendor else .19
        eye=empty(name+' | orbit '+side,(.277,eyey,eyez),head);eye.rotation_euler.z=sign*.42;actor['eyes'].append(eye)
        S('eyewhite '+side,(.022,0,0),(.107,.119,.166),'white',eye)
        S('iris '+side,(.117,-sign*.003,-.006),(.018,.060,.088),'iris',eye)
        S('pupil '+side,(.134,-sign*.003,-.003),(.012,.033,.055),'ink',eye)
        S('eyeglint '+side,(.145,-.015,.023),(.008,.014,.020),'white',eye)
        curve(name+' | upper eyelid '+side,[(.055,-.101,.092),(.096,-.055,.148),(.103,.022,.159),(.066,.098,.09)],'hairdark' if not vendor else 'ink',.013,eye)
        brow=curve(name+' | expressive brow '+side,[(.32,sign*.095,.354),(.352,sign*.187,.385),(.285,sign*.285,.353)],'hairdark' if not vendor else 'ink',.021,head);actor['brows'].append(brow)
        # Warm cheek patches are inset thin convex volumes, oriented to the skull side.
        # Flush curved cheek patch fitted to the actual head surface.
        cverts=[];cf=[];cy=sign*(.238 if vendor else .286);cz=-.13
        def surface_x(y,z):
            for ri in range(len(head_rings)-1):
                if head_rings[ri][0]<=z<=head_rings[ri+1][0]:
                    t=(z-head_rings[ri][0])/(head_rings[ri+1][0]-head_rings[ri][0]);v=[head_rings[ri][j]*(1-t)+head_rings[ri+1][j]*t for j in (1,2,3)];f,b,w=v
                    return (f+b)/2+(f-b)/2*math.sqrt(max(.01,1-(y/w)**2))
            return .26
        # Use explicit cranium profile; torso rings above are unrelated.
        for rr in range(5):
            r=max(.001,rr/4)
            for j in range(24):
                a=j*2*math.pi/24;y=cy+.069*r*math.cos(a);z=cz+.039*r*math.sin(a)
                # Ring radius near cheek: anterior .355, posterior -.40, width .415.
                x=surface_x(y,z)+.005
                cverts.append((x,y,z))
        for rr in range(4):
            for j in range(24):a=rr*24+j;b=rr*24+(j+1)%24;cf.append((a,b,b+24,a+24))
        parts['cheek flush '+side]=mesh_obj(name+' | flush cheek '+side,cverts,cf,'blush',head,1)
    # Nose has a bridge, bulb, alae, nostrils: distinctive silhouette at every azimuth.
    S('nose bridge',(.352,0,.062 if not vendor else .09),(.12,.086,.19 if not vendor else .23),'skin',head)
    S('nose bulb',(.468 if not vendor else .50,0,-.004 if not vendor else -.01),(.169 if not vendor else .195,.139 if not vendor else .13,.125 if not vendor else .14),'skin',head)
    for sign in (-1,1):
        S('nose wing '+str(sign),(.406,sign*.10,-.044),(.087,.057,.069),'skin',head)
        S('nostril '+str(sign),(.464,sign*.095,-.081),(.030,.023,.012),'hairdark',head)
    # Muzzle follows a curved smile arc, both corners continuing into the cheeks.
    expressions={}
    expressions['smile']=[curve(name+' | smile',[(.312,-.163,-.258),(.329,-.10,-.295),(.337,0,-.31),(.329,.10,-.295),(.312,.163,-.258)],'ink',.014,head)]
    expressions['worry']=[curve(name+' | worry mouth',[(.310,-.14,-.309),(.349,-.055,-.266),(.349,.035,-.27),(.316,.14,-.301)],'ink',.014,head)]
    expressions['surprise']=[S('surprised mouth',(.325,0,-.29),(.021,.077,.085),'ink',head)]
    expressions['talk']=[S('talk mouth',(.323,0,-.284),(.025,.115,.066),'ink',head),S('talk tongue',(.345,0,-.322),(.010,.065,.019),'blush',head)]
    expressions['laugh']=[S('laugh mouth',(.322,0,-.276),(.028,.143,.10),'ink',head),S('laugh teeth',(.354,0,-.227),(.021,.112,.026),'white',head),S('laugh tongue',(.341,0,-.330),(.023,.072,.026),'blush',head)]
    actor['expressions']=expressions
    if vendor:
        # A narrower adult jaw needs its own mouth wrap, not the youth's coordinates.
        for objects in expressions.values():
            for obj in objects:
                if obj.type=='CURVE':
                    for point in obj.data.splines[0].bezier_points:
                        point.co.x=surface_x(point.co.y,point.co.z)+.008
                else:obj.location.x-=.018
    # Union the facial masses into ONE continuous organic sculpture. Object outlines
    # cannot reveal primitive construction seams because those surfaces are removed.
    skin_keys=['head_mesh','nose bridge','nose bulb','nose wing -1','nose wing 1']
    bpy.ops.object.select_all(action='DESELECT')
    for key in skin_keys:parts[key].select_set(True)
    bpy.context.view_layer.objects.active=parts['head_mesh']
    bpy.ops.object.convert(target='MESH');bpy.ops.object.join()
    sculpt=bpy.context.object;sculpt.name=name+' | unified face sculpture'
    rem=sculpt.modifiers.new('Organic union','REMESH');rem.mode='VOXEL';rem.voxel_size=.015;rem.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=rem.name)
    sm=sculpt.modifiers.new('Soft sculpt finish','SMOOTH');sm.factor=.8;sm.iterations=4
    bpy.ops.object.modifier_apply(modifier=sm.name)
    for key in skin_keys:parts.pop(key,None)
    parts['head_mesh']=sculpt

    if vendor:
        # Mature, lanky vendor: swept grey locks and a classic white kitchen cap.
        for s in (-1,1):
            tuft(name+f' | temple hair {s}',[((-.18,s*.31,.24),.09),((-.22,s*.35,.08),.075),((-.13,s*.33,-.09),.008)],'ink',head)
            must=S('moustache '+str(s),(.319,s*.085,-.174),(.058,.112,.055),'ink',head);must.rotation_euler.x=s*.20
        S('chef band',(-.035,0,.48),(.37,.36,.093),'white',head)
        for i,(x,y,z,sc) in enumerate([(-.19,-.18,.67,(.23,.23,.22)),(-.18,.18,.69,(.25,.22,.24)),(.10,-.16,.70,(.25,.23,.24)),(.11,.16,.72,(.25,.23,.25)),(-.025,0,.83,(.27,.28,.23))]):S('chef puff '+str(i),(x,y,z),sc,'white',head)
    else:
        # Sculpted blond locks visible beneath cap from front, side, and back.
        for s in (-1,1):
            tuft(name+f' | temple curl {s}',[((-.02,s*.335,.34),.116),((.10,s*.388,.22),.098),((.065,s*.403,.07),.040),((.13,s*.375,.09),.003)],'hair',head)
            tuft(name+f' | cheek lock {s}',[((-.21,s*.344,.28),.11),((-.29,s*.373,.12),.074),((-.28,s*.357,.0),.003)],'hair',head)
        for i,(y,z,tip) in enumerate([(-.18,.37,.25),(.0,.405,.29),(.19,.365,.27)]):
            tuft(name+f' | forehead lock {i}',[((.18,y,z+.065),.083),((.30,y-.025,z),.070),((.315,y+.022,tip),.005)],'hair',head)
        parts['cap']=ring_body(name+' | green wool cap',[(.347,.31,-.40,.405),(.405,.325,-.425,.435),(.49,.30,-.42,.418),(.61,.22,-.36,.337),(.67,.08,-.26,.23),(.69,-.06,-.13,.06)],'green',head,48,2)
        # Curved elliptical brim has full thickness and projects FORWARD along +X.
        S('cap brim',(.37,0,.377),(.395,.425,.051),'green',head)
        S('cap button',(-.095,0,.689),(.054,.051,.025),'greenlight',head)
        curve(name+' | cap front seam',[(.23,-.335,.410),(.32,-.19,.425),(.343,0,.432),(.32,.19,.425),(.23,.335,.410)],'greenlight',.009,head)
        # The seam follows the dome rather than bridging across empty air.
        for s in (-1,1):curve(name+f' | cap panel seam {s}',[(-.09,0,.687),(.10,s*.14,.635),(.21,s*.23,.535),(.27,s*.24,.426)],'greenlight',.006,head)
    # Articulated rigid-length segment geometry, each mesh modeled along local +Z.
    for side,sign in [('L',-1),('R',1)]:
        for key in ('shoulder','elbow','wrist','hip','knee','ankle'):joints[key+'_'+side]=empty(name+' | '+key+' '+side,parent=root)
        parts['upperarm_'+side]=spindle(name+' | upper arm '+side,[(0,.095),(.06,.115),(.35,.103),(.78,.084),(1,.072)],'skin',root)
        parts['sleeve_'+side]=spindle(name+' | sleeve '+side,[(0,.11),(.06,.16),(.25,.166),(.47,.139),(.52,.123)],shirt,root)
        parts['forearm_'+side]=spindle(name+' | forearm '+side,[(0,.078),(.1,.085),(.34,.080),(.82,.060),(1,.059)],'skin',root)
        S('elbow_'+side,(0,0,0),(.085,.088,.085),'skin')
        hand=empty(name+' | mitten hand '+side,parent=root);parts['hand_'+side]=hand
        S('palm_'+side,(.006,0,-.033),(.090,.083,.119),'skin',hand)
        S('fingers_'+side,(.034,0,-.092),(.095,.080,.058),'skin',hand)
        S('thumb_'+side,(.083,-sign*.055,-.016),(.064,.040,.075),'skin',hand)
        for k in range(2):curve(name+f' | finger crease {side}{k}',[(.109,-.025+k*.038,-.084),(.120,-.019+k*.038,-.064)],'ear',.004,hand)
        legcolor='tealdark' if vendor else 'skin'
        parts['thigh_'+side]=spindle(name+' | thigh '+side,[(0,.12),(.06,.13),(.45,.115),(.9,.081),(1,.078)],legcolor,root)
        parts['shin_'+side]=spindle(name+' | shin '+side,[(0,.08),(.13,.092),(.47,.083),(.86,.063),(1,.06)],legcolor,root)
        if not vendor:parts['shortleg_'+side]=spindle(name+' | shorts leg '+side,[(0,.137),(.07,.151),(.44,.156),(.70,.139)],'teal',root)
        S('knee_'+side,(0,0,0),(.088,.088,.085),legcolor)
        foot=empty(name+' | shoe group '+side,parent=root);parts['foot_'+side]=foot
        if not vendor:S('sock_'+side,(0,0,.058),(.071,.075,.115),'white',foot)
        S('shoe_'+side,(.065,0,-.052),(.206,.118,.093),'brown',foot)
        S('sole_'+side,(.069,0,-.111),(.207,.119,.029),'sole',foot)
        curve(name+' | shoe welt '+side,[(.245,-.05,-.087),(.264,0,-.085),(.245,.05,-.087)],'hairdark',.006,foot)
    _build_deforming_limbs(actor)
    pose_character(actor,position,0)
    return actor

def _build_deforming_limbs(actor):
    """Continuous skin and trouser meshes, smoothly weighted across elbow/knee."""
    root=actor['root'];parts=actor['parts'];vendor=actor['kind']=='vendor'
    ar=bpy.data.armatures.new(actor['name']+' organic limb rig');rig=bpy.data.objects.new(actor['name']+' | armature',ar);bpy.context.collection.objects.link(rig);rig.parent=root;rig.show_in_front=False
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    chains=[]
    for side,sign in [('L',-1),('R',1)]:
        for typ,lens,start in [('arm',actor['arm_lengths'],(.005,sign*.315,.68*(1.13 if vendor else 1))),('leg',actor['leg_lengths'],(-.025,sign*.172,-.01))]:
            a=Vector(start);b=a+Vector((0,0,-lens[0]));c=b+Vector((0,0,-lens[1]));bn=[]
            for i,(u,v) in enumerate([(a,b),(b,c)]):
                bone=ar.edit_bones.new(f'{typ}_{side}_{i}');bone.head=u;bone.tail=v
                if i:bone.parent=ar.edit_bones[bn[0]];bone.use_connect=True
                bn.append(bone.name)
            chains.append((typ,side,lens,a,b,c,bn))
    bpy.ops.object.mode_set(mode='OBJECT');actor['rig']=rig;actor['skin_chains']={}
    for typ,side,lens,a,b,c,bn in chains:
        total=sum(lens);vs=[];fs=[];weights=[];N=16;steps=28
        for k in range(steps+1):
            d=total*k/steps;t=d/total
            if typ=='arm':
                r=.108*(1-t)+.063*t + .012*math.sin(math.pi*t)
                # Soft elbow, with radius continuing through the joint.
            else:r=.125*(1-t)+.059*t+.006*math.sin(3*math.pi*t)
            if k in (0,steps):r*=.78
            for j in range(N):
                ang=2*math.pi*j/N;vs.append(tuple(a+Vector((r*math.cos(ang),r*math.sin(ang),-d))))
                w=max(0,min(1,(d-lens[0]+.11)/.22));weights.append((1-w,w))
        for k in range(steps):
            for j in range(N):aa=k*N+j;bb=k*N+(j+1)%N;fs.append((aa,bb,bb+N,aa+N))
        fs.append(tuple(range(N-1,-1,-1)));fs.append(tuple(steps*N+j for j in range(N)))
        obj=mesh_obj(actor['name']+f' | continuous {typ} {side}',vs,fs,'tealdark' if vendor and typ=='leg' else 'skin',root,0)
        groups=[obj.vertex_groups.new(name=x) for x in bn]
        for i,ww in enumerate(weights):
            for g,w in zip(groups,ww):
                if w>0:g.add([i],w,'REPLACE')
        mod=obj.modifiers.new('Smooth articulated skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
        sub=obj.modifiers.new('Silky limb finish','SUBSURF');sub.levels=1;sub.render_levels=1
        parts[f'continuous_{typ}_{side}']=obj;actor['skin_chains'][typ+'_'+side]=bn
        old=('upperarm_','forearm_','elbow_') if typ=='arm' else ('thigh_','shin_','knee_')
        for prefix in old:
            old_obj=parts[prefix+side];ref=empty(old_obj.name+' pose reference',parent=root)
            parts[prefix+side]=ref;bpy.data.objects.remove(old_obj,do_unlink=True)

def _pose_chain(actor,typ,side,a,b,c,frame):
    rig=actor['rig'];bn=actor['skin_chains'][typ+'_'+side]
    # Direct rest-relative matrices avoid dependency graph evaluations while baking.
    parent_matrix=None;parent_rest=None
    for bone_name,start,end in zip(bn,(a,b),(b,c)):
        pb=rig.pose.bones[bone_name];q=(Vector(end)-Vector(start)).to_track_quat('Y','Z')
        desired=Matrix.LocRotScale(Vector(start),q,Vector((1,1,1)))
        rest=pb.bone.matrix_local
        basis=rest.inverted() @ desired if parent_matrix is None else rest.inverted() @ parent_rest @ parent_matrix.inverted() @ desired
        pb.rotation_mode='QUATERNION';pb.matrix_basis=basis
        parent_matrix=desired;parent_rest=rest
        for prop in ('location','rotation_quaternion','scale'):_key(pb,prop,frame)

def pose_character(actor,pelvis,heading=0,hand_targets=None,foot_targets=None,head_heading=None,expression='smile',frame=None,torso_pitch=0,head_pitch=0):
    """Pose with analytic two-bone IK. Target keys: L/R; +/-Y sides. Endpoints world XYZ.
    Heading/head_heading: radians around world Z from +X; head_heading is absolute.
    Targets clamp to reachable lengths; inspect joints for actual results. Ground ankle .14.
    torso_pitch/head_pitch optional radians about local Y (positive bends forward).
    """
    root=actor['root'];parts=actor['parts'];joints=actor['joints'];root.location=pelvis;root.rotation_euler=(0,0,heading)
    _key(root,'location',frame);_key(root,'rotation_euler',frame)
    inv=Matrix.Rotation(-heading,3,'Z');p=Vector(pelvis)
    local=lambda v:inv@(Vector(v)-p)
    vendor=actor['kind']=='vendor';h=actor['base_head_height'];head=joints['head'];head.location=(math.sin(torso_pitch)*h,0,math.cos(torso_pitch)*h)
    head.rotation_euler=(0,head_pitch,(head_heading-heading) if head_heading is not None else 0)
    _key(head,'location',frame);_key(head,'rotation_euler',frame)
    # Torso pitch is optional; neck and upper-body embellishments follow that pitch.
    for key in ['torso','neck','apron']:
        if key in parts:parts[key].rotation_euler.y=torso_pitch;_key(parts[key],'rotation_euler',frame)
    for side,sign in [('L',-1),('R',1)]:
        shoulder=Vector((.005,sign*.315,.68*(1.13 if vendor else 1)));shoulder=Matrix.Rotation(torso_pitch,3,'Y')@shoulder
        wrist=local(hand_targets[side]) if hand_targets and side in hand_targets else Vector((.075,sign*.365,-.38))
        elbow,wrist=_ik(shoulder,wrist,*actor['arm_lengths'],(-.40,sign*.53,.28))
        _pose_chain(actor,'arm',side,shoulder,elbow,wrist,frame)
        for key,v in [('shoulder',shoulder),('elbow',elbow),('wrist',wrist)]:joints[key+'_'+side].location=v;_key(joints[key+'_'+side],'location',frame)
        for key in ('upperarm_','sleeve_'):_link(parts[key+side],shoulder,elbow,frame)
        _link(parts['forearm_'+side],elbow,wrist,frame)
        parts['elbow_'+side].location=elbow;_key(parts['elbow_'+side],'location',frame)
        hand=parts['hand_'+side];hand.location=wrist;hand.rotation_mode='QUATERNION';hand.rotation_quaternion=(elbow-wrist).to_track_quat('Z','Y')
        _key(hand,'location',frame);_key(hand,'rotation_quaternion',frame)
        hip=Vector((-.025,sign*.172,-.01));ankle=local(foot_targets[side]) if foot_targets and side in foot_targets else Vector((.01,sign*.20,.14-p.z))
        knee,ankle=_ik(hip,ankle,*actor['leg_lengths'],(.85,sign*.22,-.55))
        _pose_chain(actor,'leg',side,hip,knee,ankle,frame)
        for key,v in [('hip',hip),('knee',knee),('ankle',ankle)]:joints[key+'_'+side].location=v;_key(joints[key+'_'+side],'location',frame)
        _link(parts['thigh_'+side],hip,knee,frame);_link(parts['shin_'+side],knee,ankle,frame)
        if 'shortleg_'+side in parts:_link(parts['shortleg_'+side],hip,knee,frame)
        parts['knee_'+side].location=knee;_key(parts['knee_'+side],'location',frame)
        foot=parts['foot_'+side];foot.location=ankle;_key(foot,'location',frame)
    ex='worry' if expression in ('worried','sad','frown') else 'surprise' if expression in ('shocked','surprised','oh') else expression
    if ex not in actor['expressions']:ex='smile'
    for expr,objects in actor['expressions'].items():
        for o in objects:_set_visible(o,expr==ex,frame)
    for i,brow in enumerate(actor['brows']):
        brow.location.z=.045 if ex in ('surprise','laugh') else 0
        brow.rotation_euler.x=((-.12 if i==0 else .12) if ex=='worry' else 0)
        _key(brow,'location',frame);_key(brow,'rotation_euler',frame)
    return actor


def blink_character(actor, amount, frame=None):
    """Optional classic-cartoon blink/squint, preserving face and eye proportions.

    amount=0 is open, amount=1 is closed. At >=.5, replace the open eye
    geometry with a curved ink eyelid seated on the actual facial sculpture.
    This is an intentional snappy animation substitution, not a squash of the
    eyeballs. Use it after pose_character when baking, once for each blink key.
    Ordinary visibility keyframes are constant, so saved .blend files need no
    script or frame handler. Calling pose_character does not reset the blink.
    """
    amount=max(0.0,min(1.0,float(amount)))
    if 'blink_controls' not in actor:
        head=actor['joints']['head'];face=actor['parts']['head_mesh']
        from mathutils.bvhtree import BVHTree
        face_tree=BVHTree.FromPolygons([v.co for v in face.data.vertices],[tuple(p.vertices) for p in face.data.polygons],all_triangles=False)
        open_objects=[];closed_lines=[];vendor=actor['kind']=='vendor'
        for index,eye in enumerate(actor['eyes']):
            open_objects.extend(o for o in eye.children_recursive if o.type in {'MESH','CURVE'})
            cy=eye.location.y;cz=eye.location.z;points=[]
            # Arc opens downward (the happy/bliss closed-eye expression in source).
            # Project each point to the true head surface so exact profiles remain
            # seated on the face, rather than leaving floating flattened eye discs.
            for step in range(7):
                t=step/6;y=cy+(t-.5)*(.140 if vendor else .191);z=cz+.045*math.sin(math.pi*t)-.024
                co,normal,polygon,distance=face_tree.ray_cast(Vector((1.5,y,z)),Vector((-1,0,0)))
                if co is not None:x=co.x+.010
                else:
                    w=.345 if vendor else .425;front=.28 if vendor else .335;back=-.36 if vendor else -.43
                    x=(front+back)/2+(front-back)/2*math.sqrt(max(.01,1-(y/w)**2))+.012
                points.append((x,y,z))
            lid=curve(actor['name']+f' | closed eyelid {index}',points,'ink',.0135,head)
            lid.hide_render=True;lid.hide_viewport=True;closed_lines.append(lid)
        actor['blink_controls']={'open_objects':open_objects,'closed_lines':closed_lines}
    closed=amount>=.5
    controls=actor['blink_controls']
    for obj in controls['open_objects']:_set_visible(obj,not closed,frame)
    for obj in controls['closed_lines']:_set_visible(obj,closed,frame)
    if frame is not None:
        for obj in controls['open_objects']+controls['closed_lines']:
            action=obj.animation_data.action if obj.animation_data else None
            if action:
                for fc in action.fcurves:
                    if fc.data_path in {'hide_render','hide_viewport'}:
                        points=fc.keyframe_points
                        # Sequential bakes append at the tail: O(1) in the common
                        # case, retaining earlier-frame overwrite semantics.
                        if points and abs(points[-1].co[0]-frame)<.0001:
                            points[-1].interpolation='CONSTANT'
                        else:
                            for key in points:
                                if abs(key.co[0]-frame)<.0001:
                                    key.interpolation='CONSTANT'
                                    break
    actor['blink_amount']=amount
    return actor
