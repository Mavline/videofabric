"""Volumetric cartoon street and two independent burger shops.

Z is up. Street runs along +X, road is Y -2..1, sidewalk Y 1..4.
Public API: build_street(); create_shop(name, origin, kind, price).
All returned anchors are actual Blender empties parented to their shop root.
No scene, camera, render or color-management settings are changed here.
"""
import bpy, math, random
from mathutils import Vector
from pathlib import Path

PALETTE = {
    'ink':'243E40', 'cream':'FFF2D8', 'paper':'FFFBEF', 'sky':'DDE7EC',
    'road':'C4B6B1', 'paving':'DED0C0', 'paving_light':'E9DFD1', 'curb':'B8C4BD',
    'lawn':'B4D6AD', 'lawn_dark':'9FC8A3', 'leaf':'A7C9A4', 'leaf_light':'C1D7AB',
    'leaf_dark':'81AD94', 'trunk':'8B9C83', 'fence':'BAD3C5', 'fence_shadow':'95B5A7',
    'yellow':'E5CD78', 'yellow_light':'F4E1A0', 'yellow_shadow':'CCB265',
    'pink':'DCA7BE', 'pink_dark':'BF829E', 'teal':'509D9F', 'teal_light':'93C9C5',
    'teal_dark':'2D626A', 'copper':'CA906E', 'copper_light':'E0B495', 'orange':'E6A364',
    'glass':'BFE8E0', 'glass_dark':'8FC7C3', 'wood':'B99575', 'wood_dark':'857968',
    'stone':'D9D3C4', 'stone_shadow':'BDBCB2', 'coral':'D8ADA0', 'lilac':'B7B8CB',
    'water':'8BCACB', 'water_light':'CAEEE3', 'gold':'E9B735', 'red':'AD493E',
    'register':'386C70', 'screen':'BCDFC8', 'chalk':'E7ECD4'
}
_cache = {}

def rgba(value):
    h=PALETTE.get(value,value).lstrip('#')
    def linear(c):
        n=int(c,16)/255.0
        return n/12.92 if n<=.04045 else ((n+.055)/1.055)**2.4
    return tuple(linear(h[i:i+2]) for i in (0,2,4))+(1.0,)

def _finish(obj, name, color, loc, parent=None):
    obj.name=name; obj.location=loc; obj.parent=parent
    if color: obj.color=rgba(color)
    return obj

def empty(name, loc=(0,0,0), parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o)
    o.empty_display_type='PLAIN_AXES'; o.empty_display_size=.15
    o.location=loc; o.parent=parent
    return o

def box(name, loc, dims, color, bevel=.025, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o=bpy.context.object; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        m=o.modifiers.new('Rounded handmade edges','BEVEL'); m.width=bevel; m.segments=2
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return _finish(o,name,color,loc,parent)

def sphere(name, loc, scale, color, parent=None, segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=8,radius=1)
    o=bpy.context.object; o.scale=scale
    for p in o.data.polygons:p.use_smooth=True
    return _finish(o,name,color,loc,parent)

def cylinder(name,loc,radius,depth,color,parent=None,vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth)
    o=bpy.context.object
    m=o.modifiers.new('Soft rims','BEVEL');m.width=min(.028,radius*.18);m.segments=2
    o.modifiers.new('Rim normals','WEIGHTED_NORMAL')
    return _finish(o,name,color,loc,parent)

def rod(name,a,b,radius,color,parent=None,vertices=12):
    a,b=Vector(a),Vector(b);o=cylinder(name,(a+b)/2,radius,(b-a).length,color,parent,vertices)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

def curve(name,points,color,width=.025,parent=None,cyclic=False):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=8
    cu.bevel_depth=width;cu.bevel_resolution=2
    sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for p,co in zip(sp.bezier_points,points):
        p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    sp.use_cyclic_u=cyclic
    o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);o.parent=parent;o.color=rgba(color)
    return o

def mesh(name,verts,faces,color,parent=None,bevel=0):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.parent=parent;o.color=rgba(color)
    if bevel:
        m=o.modifiers.new('Soft manufactured edges','BEVEL');m.width=bevel;m.segments=2
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def text(name,body,loc,size=.3,color='ink',parent=None,bold=False,max_width=None):
    key='bold' if bold else 'regular'
    if key not in _cache:
        filename='DejaVuSans'+('-Bold' if bold else '')+'.ttf'
        bundled=Path(__file__).resolve().parent/'fonts'/filename
        file=str(bundled if bundled.exists() else Path('/usr/share/fonts/truetype/dejavu')/filename)
        _cache[key]=bpy.data.fonts.load(file) if Path(file).exists() else bpy.data.fonts.get('Bfont')
    cu=bpy.data.curves.new(name,'FONT');cu.body=body;cu.size=size;cu.align_x='CENTER';cu.align_y='CENTER'
    cu.font=_cache[key];cu.extrude=.003;cu.bevel_depth=.001;cu.resolution_u=4
    o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o)
    o.parent=parent;o.location=loc;o.rotation_euler=(math.pi/2,0,0);o.color=rgba(color)
    if max_width:
        bpy.context.view_layer.update()
        if o.dimensions.x>max_width:o.scale*=max_width/o.dimensions.x
    return o

def disc_front(name,loc,radius,depth,color,parent=None):
    o=cylinder(name,loc,radius,depth,color,parent,32);o.rotation_euler.x=math.pi/2;return o

def _gable(name,w,d,z,peak,color,parent):
    v=[(-w/2,-d/2,z),(w/2,-d/2,z),(0,-d/2,peak),(-w/2,d/2,z),(w/2,d/2,z),(0,d/2,peak)]
    return mesh(name,v,[(0,1,2),(5,4,3),(0,3,4,1),(0,2,5,3),(1,4,5,2)],color,parent,.025)

def _window(name,x,y,z,w,h,parent,curtains=False):
    box(name+' recessed glass',(x,y,z),(w,.09,h),'glass',.015,parent)
    for dx in [-w/2,w/2]:box(name+' outer jamb',(x+dx,y-.065,z),(.095,.16,h+.12),'cream',.012,parent)
    for dz in [-h/2,h/2]:box(name+' cross sill',(x,y-.075,z+dz),(w+.18,.20,.09),'cream',.012,parent)
    box(name+' mullion',(x,y-.12,z),(.05,.08,h),'cream',.008,parent)
    box(name+' transom',(x,y-.13,z),(w,.08,.05),'cream',.008,parent)
    if curtains:
        for s in [-1,1]:
            mesh(name+' cloth curtain',[(x+s*w*.47,y-.16,z+h*.47),(x+s*w*.20,y-.16,z+h*.47),(x+s*w*.47,y-.16,z-h*.45)],[(0,1,2)],'pink',parent)
    box(name+' deep sill',(x,y-.17,z-h/2-.075),(w+.26,.37,.12),'cream',.025,parent)

def tree(name,loc,height=4.5,crown='leaf',kind='round',parent=None):
    root=empty(name,loc,parent)
    cylinder(name+' trunk',(0,0,height*.30),.13,height*.6,'trunk',root,10)
    rod(name+' branch L',(0,0,height*.36),(-.55,.05,height*.66),.07,'trunk',root,10)
    rod(name+' branch R',(0,0,height*.45),(.5,-.04,height*.70),.065,'trunk',root,10)
    if kind=='column':
        sphere(name+' tall canopy',(0,0,height*.77),(.70,.72,height*.36),crown,root)
        sphere(name+' canopy side',(.30,-.10,height*.64),(.63,.64,height*.25),'leaf_light',root)
    else:
        for co,sc,c in [((-.56,0,height*.72),(1.04,.88,height*.24),crown),((.51,.12,height*.74),(.9,.8,height*.23),'leaf_light'),((0,.02,height*.89),(.96,.90,height*.24),crown)]:
            sphere(name+' leafy crown',co,sc,c,root)
    return root

def flower_planter(name,loc,width=1.2,parent=None):
    root=empty(name,loc,parent)
    box(name+' tapered trough',(0,0,.23),(width,.57,.45),'copper_light',.075,root)
    box(name+' earth',(0,0,.465),(width*.9,.45,.055),'wood_dark',.02,root)
    for i in range(5):
        x=-width*.38+i*width*.19
        sphere(name+' leaf',(x,0,.59),(.19,.20,.19),'leaf_dark',root,12)
        cylinder(name+' stem',(x,0,.69),.018,.30,'trunk',root,8)
        sphere(name+' flower',(x,-.02,.85+(.05 if i%2 else 0)),(.105,.10,.075),'pink' if i%2 else 'cream',root,12)
    return root

def fence(name,x0,x1,y,height=.96,parent=None):
    root=empty(name,(0,0,0),parent)
    for z in [.33,.74]:box(name+' rail',((x0+x1)/2,y+.035,z),(x1-x0,.12,.08),'fence_shadow',.012,root)
    for i in range(int((x1-x0)/.29)+1):
        x=x0+i*.29
        verts=[(x-.07,y-.045,0),(x+.07,y-.045,0),(x+.07,y-.045,height-.13),(x,y-.045,height),(x-.07,y-.045,height-.13)]
        o=mesh(name+' pointed pale picket',verts,[(0,1,2,3,4)],'fence',root)
        m=o.modifiers.new('Picket thickness','SOLIDIFY');m.thickness=.095
    return root

def cottage(name,loc,width=4.1,wall='yellow_light',roof='copper',height=3.4):
    root=empty(name,loc)
    box(name+' foundation',(0,0,.2),(width+.22,3.25,.40),'stone',.05,root)
    box(name+' plaster walls',(0,0,height/2+.18),(width,3.05,height),wall,.045,root)
    _gable(name+' hipped gable roof',width+.46,3.5,height+.15,height+1.45,roof,root)
    # Separate edgeboards, chimney, door recess, shutters, porch and glazed windows.
    for sx in [-1,1]:rod(name+' roof bargeboard',(sx*(width/2+.23),-1.79,height+.15),(0,-1.79,height+1.45),.075,'cream',root)
    box(name+' chimney',(width*.3,.4,height+1.1),(.44,.56,1.24),'stone',.025,root)
    box(name+' chimney cap',(width*.3,.4,height+1.76),(.56,.67,.16),'cream',.02,root)
    box(name+' deep door',(.0,-1.548,1.22),(.8,.10,2.07),'leaf_dark',.025,root)
    box(name+' door frame',(0,-1.61,2.28),(.97,.13,.11),'cream',.01,root)
    for x in [-.46,.46]:box(name+' door jamb',(x,-1.61,1.24),(.10,.14,2.2),'cream',.01,root)
    sphere(name+' door knob',(.25,-1.69,1.2),(.045,.038,.045),'gold',root,12)
    box(name+' step',(0,-1.90,.14),(1.24,.7,.23),'stone',.03,root)
    _window(name+' left window',-width*.31,-1.57,2.04,.90,1.20,root,True)
    _window(name+' right window',width*.31,-1.57,2.04,.90,1.20,root,True)
    # Side window has real depth and is visible during perspective tracking.
    side=empty(name+' side window',(width/2+.025,.15,2.0),root);side.rotation_euler.z=math.pi/2
    _window(name+' side',0,0,0,.88,1.16,side)
    return root

def bench(name,loc,rot=0):
    root=empty(name,loc);root.rotation_euler.z=rot
    for i in range(4):box(name+' seat slat',(0,-.22+i*.15,.51),(1.95,.13,.09),'wood',.025,root)
    for i in range(3):box(name+' back slat',(0,.40,.89+i*.16),(1.95,.10,.12),'wood',.025,root)
    for x in [-.72,.72]:
        rod(name+' leg',(x,-.28,.05),(x,-.22,.48),.07,'teal_dark',root)
        rod(name+' upright',(x,.36,.05),(x,.41,1.29),.07,'teal_dark',root)
        curve(name+' arm',[(x,-.30,.76),(x,-.24,.87),(x,.3,.87),(x,.4,.8)],'teal_dark',.048,root)
    return root

def lamppost(name,loc,height=4.5):
    root=empty(name,loc)
    cylinder(name+' base',(0,0,.15),.23,.3,'fence_shadow',root)
    cylinder(name+' tapered foot',(0,0,.44),.135,.65,'fence_shadow',root)
    cylinder(name+' pole',(0,0,height*.48),.065,height-.30,'fence_shadow',root)
    curve(name+' curved neck',[(0,0,height-.22),(0,0,height+.18),(.34,0,height+.4),(.63,0,height+.12)],'fence_shadow',.065,root)
    cylinder(name+' pendant rim',(.63,0,height+.015),.25,.10,'teal_dark',root)
    sphere(name+' milkglass globe',(.63,0,height-.16),(.19,.19,.20),'cream',root)
    return root

def fountain(name,loc):
    root=empty(name,loc)
    cylinder(name+' foot',(0,0,.10),1.55,.20,'stone_shadow',root,40)
    cylinder(name+' basin',(0,0,.33),1.37,.50,'stone',root,40)
    cylinder(name+' blue water',(0,0,.605),1.19,.055,'water',root,40)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.29,minor_radius=.105,major_segments=40,minor_segments=8)
    _finish(bpy.context.object,name+' rolled basin rim','cream',(0,0,.61),root)
    cylinder(name+' pedestal',(0,0,.96),.22,.75,'stone',root)
    cylinder(name+' upper saucer',(0,0,1.39),.66,.15,'stone',root,32)
    sphere(name+' finial',(0,0,1.63),(.15,.15,.23),'stone',root)
    for i in range(8):
        ang=i*math.tau/8
        pts=[(0,0,1.82),(.34*math.cos(ang),.34*math.sin(ang),2.35),(.72*math.cos(ang),.72*math.sin(ang),1.97),(1.01*math.cos(ang),1.01*math.sin(ang),.68)]
        curve(name+' arcing water jet',pts,'water_light',.035,root)
    return root

def commercial_block(name,loc):
    root=empty(name,loc)
    for x,w,h,c in [(-3.5,3.0,5.5,'coral'),(0,3.6,6.5,'stone'),(3.5,3.0,4.9,'teal_light')]:
        box(name+' masonry bay',(x,0,h/2),(w,3.4,h),c,.045,root)
        box(name+' cornice',(x,-.02,h),(w+.3,3.6,.25),'cream',.04,root)
        box(name+' plinth',(x,-1.72,.28),(w+.1,.16,.4),'stone_shadow',.01,root)
        for xx in [-.65,.65]:
            for zz in [2.95,4.43] if h<6 else [3.4,5.15]:
                _window(name+' upper',x+xx,-1.755,zz,.73,.99,root)
        # Commercial lower display windows and offset recessed door.
        _window(name+' storefront',x-.55,-1.77,1.20,1.05,1.47,root)
        box(name+' shop door',(x+.75,-1.78,1.17),(.72,.10,1.94),'teal_dark',.02,root)
        box(name+' door glass',(x+.75,-1.85,1.44),(.5,.07,1.13),'glass',.015,root)
        box(name+' ground fascia',(x,-1.90,2.3),(w-.20,.20,.34),'cream',.03,root)
    text(name+' books sign','BOOKS',(-3.5,-2.02,2.3),.22,'wood_dark',root,True)
    text(name+' cafe sign','CORNER CAFE',(3.5,-2.02,2.3),.19,'wood_dark',root,True)
    # Tall center clock with dimensional trim rather than printed scenery.
    disc_front(name+' clock backing',(0,-1.84,6.0),.59,.16,'cream',root)
    disc_front(name+' clock face',(0,-1.94,6.0),.48,.035,'paper',root)
    for i in range(12):
        ang=i*math.tau/12
        rod(name+' clock tick',(.37*math.sin(ang),-1.97,6+.37*math.cos(ang)),(.43*math.sin(ang),-1.97,6+.43*math.cos(ang)),.012,'wood_dark',root,8)
    rod(name+' clock minute',(0,-2,6),(.0,-2,6.30),.020,'wood_dark',root)
    rod(name+' clock hour',(0,-2.01,6),(-.21,-2.01,6.10),.026,'wood_dark',root)
    sphere(name+' clock axle',(0,-2.03,6),(.045,.025,.045),'wood_dark',root,12)
    return root

def park_arch(name,loc):
    root=empty(name,loc)
    for s in [-1,1]:
        box(name+' stone pier',(s*1.4,0,1.15),(.42,.60,2.3),'stone',.05,root)
        box(name+' base',(s*1.4,0,.18),(.70,.83,.35),'stone_shadow',.05,root)
        box(name+' capital',(s*1.4,0,2.25),(.64,.82,.22),'cream',.04,root)
    curve(name+' arched wrought iron',[(-1.4,0,2.28),(-1.18,0,3.12),(0,0,3.6),(1.18,0,3.12),(1.4,0,2.28)],'fence_shadow',.085,root)
    for i in range(-5,6):
        x=i*.22;z=2.9+.44*math.sqrt(max(0,1-(x/1.35)**2))
        rod(name+' arch spoke',(x,0,z-.24),(x,0,z+.05),.025,'fence_shadow',root)
    box(name+' small park plaque',(0,-.05,2.96),(1.38,.11,.37),'cream',.06,root)
    text(name+' park lettering','TOWN PARK',(0,-.12,2.96),.16,'wood_dark',root,True)
    return root

def _awning(name,width,depth,z,color1,color2,parent,style='scallop'):
    # Individual extruded cloth strips make the slope and scallop edge genuinely 3D.
    count=9 if width<4.8 else 11; sw=width/count
    for i in range(count):
        x0=-width/2+i*sw; x1=x0+sw+.006; y0=-1.46;y1=y0-depth
        mesh(name+' canvas stripe',[(x0,y0,z),(x1,y0,z),(x1,y1,z-.32),(x0,y1,z-.32),
            (x0,y0,z-.025),(x1,y0,z-.025),(x1,y1,z-.345),(x0,y1,z-.345)],
            [(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7)],color1 if i%2==0 else color2,parent,.005)
        # Rounded valance consists of a true half-cylinder-shaped cloth hem mesh.
        pts=[(x0,y1-.015,z-.32),(x1,y1-.015,z-.32)]
        pts += [(x0+sw/2+sw/2*math.cos(a),y1-.015,z-.40-.14*math.sin(a)) for a in [j*math.pi/8 for j in range(9)]]
        ob=mesh(name+' scalloped hanging valance',pts,[tuple(range(len(pts)))],color1 if i%2==0 else color2,parent)
        sol=ob.modifiers.new('Fabric thickness','SOLIDIFY');sol.thickness=.022
    for x in [-width/2,width/2]:rod(name+' canvas support',(x,-1.40,z-.73),(x,-1.46-depth,z-.35),.025,'wood_dark',parent)

def _register(name,loc,parent):
    root=empty(name,loc,parent)
    body=box(name+' metal casing',(0,.09,.26),(.78,.65,.44),'register',.07,root)
    box(name+' black drawer recess',(0,-.247,.07),(.73,.045,.17),'ink',.015,root)
    drawer=box(name+' SLIDING CASH DRAWER',(0,-.29,.075),(.68,.45,.13),'teal_dark',.035,root)
    box(name+' drawer grip',(0,-.532,.075),(.25,.045,.035),'cream',.012,root).parent=drawer
    # Keep grip world-to-local consistent with the drawer so it travels with it.
    grip=bpy.data.objects.get(name+' drawer grip');grip.location=(0,-.242,0)
    face=box(name+' keypad deck',(0,-.08,.485),(.72,.54,.085),'teal_dark',.026,root)
    face.rotation_euler.x=math.radians(12)
    keys=[]
    for row in range(3):
        for col in range(3):
            key=box(name+f' KEY {row*3+col+1}',(-.245+col*.175,-.235+row*.15,.516+row*.032),(.135,.115,.065),'cream',.018,root)
            key.rotation_euler.x=math.radians(12);keys.append(key)
            digit=text(name+f' KEY LABEL {row*3+col+1}',str(row*3+col+1),(0,0,.037),.062,'teal_dark',key,True)
            digit.rotation_euler=(0,0,0)
    key=box(name+' TOTAL KEY',(.27,-.08,.55),(.10,.38,.065),'orange',.018,root);keys.append(key)
    rod(name+' display stem',(.18,.22,.41),(.18,.22,.83),.045,'register',root)
    box(name+' display frame',(.18,.20,.83),(.59,.14,.28),'teal_dark',.035,root)
    box(name+' green display',(.18,.115,.83),(.48,.035,.18),'screen',.008,root)
    display=text(name+' display digits','0.00',(.18,.088,.832),.13,'ink',root,True)
    box(name+' receipt slit',(-.21,.23,.50),(.18,.09,.045),'ink',.012,root)
    receipt=box(name+' removable receipt',(-.21,.24,.68),(.15,.022,.33),'paper',.005,root)
    for j in range(3):box(name+' receipt ink',(-.21,.225,.65+j*.058),(.105,.008,.01),'wood_dark',.001,root)
    return {'root':root,'body':body,'drawer':drawer,'keys':keys,'display':display,'receipt':receipt}

def _phone(name,loc,parent):
    root=empty(name,loc,parent)
    box(name+' phone base',(0,0,.12),(.48,.39,.22),'teal_dark',.06,root)
    disc=cylinder(name+' dial',(0,-.045,.25),.135,.055,'cream',root,20)
    for i in range(8):
        a=i*math.tau/8;cylinder(name+' dial hole',(.092*math.cos(a),-.045+.092*math.sin(a),.28),.017,.007,'ink',root,8)
    handset=empty(name+' HANDSET',(0,.035,.37),root)
    curve(name+' receiver grip',[(-.23,0,-.02),(-.13,0,.08),(.13,0,.08),(.23,0,-.02)],'teal_dark',.07,handset)
    for x in [-.22,.22]:sphere(name+' earpiece',(x,0,-.01),(.10,.10,.095),'teal_dark',handset)
    pts=[(.29+.045*math.sin(i*math.pi/2),.06+.045*math.cos(i*math.pi/2),.30-i*.008) for i in range(26)]
    cord=curve(name+' coiled cable',pts,'teal_dark',.013,root)
    return {'root':root,'handset':handset,'cord':cord}

def create_shop(name, origin, kind='timber', price='$5.69'):
    """Create either 'timber'/'first' or 'trailer'/'second'; root faces SW (-X,-Y).

    Animation-ready members:
      vendor_anchor: local (0,0,.28); buyer_anchor: (0,-2.45,.12)
      contact_anchor: (0,-1.35,1.95); burger_anchor: (-.30,-1.48,1.82)
      cash_drawer: slide its local Y from -.29 toward -.65
      keys: lower chosen key Z by .04 for a key press
      price_text: FONT data.body can be changed; price_sign: whole card
      handset: whole removable receiver; coin tray and actual change coins
    """
    start=set(bpy.data.objects)
    root=empty(name,origin);root.rotation_euler.z=-math.pi/4
    trailer=kind in ('trailer','second','teal')
    w=4.6 if trailer else 4.4
    primary='teal' if trailer else 'yellow';edge='teal_light' if trailer else 'yellow_light'
    box(name+' floor',(0,0,.14),(w,2.65,.28),'wood',.07,root)
    box(name+' back interior wall',(0,1.28,1.91),(w,.16,3.6),edge,.06,root)
    # Actual open service aperture: no front wall exists between sill and lintel.
    box(name+' solid front lower apron',(0,-1.27,1.04 if trailer else .87),(w,.18,1.20 if trailer else 1.54),primary,.12 if trailer else .085,root)
    box(name+' left structural side',(-w/2+.10,0,1.87),(.20,2.64,3.48),primary,.07,root)
    box(name+' right structural side',(w/2-.10,0,1.87),(.20,2.64,3.48),primary,.07,root)
    for x in [-w/2+.15,w/2-.15]:
        box(name+' service window upright',(x,-1.38,2.59),(.18,.20,1.98),edge,.035,root)
    box(name+' service top lintel',(0,-1.34,3.62),(w,.23,.20),edge,.04,root)
    counter=box(name+' thick projecting counter',(0,-1.40,1.72),(w+.25,.76,.16),'cream',.055,root)
    box(name+' warm counter edge',(0,-1.81,1.70),(w+.3,.08,.13),'wood',.025,root)
    box(name+' interior back worktop',(0,.91,1.57),(w-.25,.67,.12),'cream',.025,root)
    box(name+' back cupboard doors',(0,1.0,.83),(w-.36,.5,1.38),primary,.025,root)
    for xx in [-1.12,0,1.12]:
        box(name+' cupboard joint',(xx,.738,.9),(.018,.01,1.16),edge,.001,root)
        sphere(name+' cupboard knob',(xx+.20,.708,1.19),(.04,.028,.04),'cream',root,12)
    # A genuine side window cut into an applied raised frame (back glass remains opaque stylized glass).
    _window(name+' back service window',0,1.165,2.69,1.47,1.04,root)
    box(name+' shelf',(-1.22,.83,2.57),(1.27,.68,.095),'wood',.022,root)
    for j in range(3):cylinder(name+' paper cup',(-1.58+j*.31,.73,2.76),.09,.28,'cream',root,12)
    for xx,c in [(.98,'red'),(1.32,'gold')]:
        cylinder(name+' sauce bottle',(xx,.81,1.84),.07,.42,c,root,12)
        cylinder(name+' sauce bottle cap',(xx,.81,2.08),.035,.10,'cream',root,10)
    # Modelled planking and fascia make the first shop a little timber kiosk.
    if not trailer:
        for i in range(17):
            xx=-w/2+.13+i*(w-.26)/16
            box(name+' vertical tongue and groove',(xx,-1.376,.91),(.024,.022,1.36),'yellow_shadow',.002,root)
        sidewindow=empty(name+' side window frame',(w/2+.02,.18,2.66),root);sidewindow.rotation_euler.z=math.pi/2
        _window(name+' side glazed window',0,0,0,1.0,1.04,sidewindow,True)
        box(name+' side raised sign',(w/2+.04,-.04,1.60),(.06,1.18,.40),'cream',.035,root)
        sidetext=text(name+' side word','FRESH',(.0,0,0),.20,'wood_dark',None,True)
        sidetext.parent=sidewindow;sidetext.location=(.20,-.10,-1.06)
        for s in [-1,1]:
            for yy in [-.87,-.40,.07,.54,1.01]:
                box(name+' side timber seam',(s*(w/2+.005),yy,1.86),(.022,.022,3.37),'yellow_shadow',.002,root)
        _gable(name+' warm pitched roof',w+.50,3.10,3.71,4.39,'copper',root)
        for s in [-1,1]:
            rod(name+' cream gable bargeboard',(s*(w/2+.27),-1.60,3.70),(0,-1.60,4.43),.06,'cream',root)
        for xx in [-1.4,-.7,.0,.7,1.4]:
            # restrained raised roof seams visible in 3/4 views
            zz=4.40-abs(xx)/(w/2+.25)*.69
            rod(name+' roof standing seam',(xx,-1.52,zz),(xx,1.52,zz),.022,'copper_light',root)
        _awning(name,w+.52,.73,3.63,'pink','cream',root)
        sign=box(name+' roof title board',(0,-1.65,4.56),(3.92,.18,.67),'cream',.055,root)
        text(name+' BURGERS letters','BURGERS',(0,-1.758,4.56),.44,'red',root,True,max_width=3.55)
        signpos=(0,-1.80,3.98)
    else:
        # Rounded lower panel and a real barrel-vault copper roof, distinct in plan and silhouette.
        sideframe=empty(name+' trailer side details',(w/2+.06,.2,0),root);sideframe.rotation_euler.z=math.pi/2
        for xx in [-.46,.46]:
            disc_front(name+' round porthole rim',(xx,-.015,2.64),.37,.095,'cream',sideframe)
            disc_front(name+' round porthole glass',(xx,-.075,2.64),.285,.035,'glass',sideframe)
            rod(name+' round porthole mullion',(xx,-.10,2.37),(xx,-.10,2.91),.025,'cream',sideframe)
        box(name+' side badge',(0,-.04,1.55),(1.43,.08,.57),'cream',.20,sideframe)
        text(name+' side badge lettering','BURGER BAR',(0,-.091,1.56),.16,'teal_dark',sideframe,True)
        for z in [.46,1.00,1.45]:
            box(name+' aluminum body piping',(0,-1.392,z),(w-.13,.033,.033),'teal_light',.012,root)
        for side in [-1,1]:
            wheelroot=empty(name+' OUTSIDE WHEEL', (side*(w/2+.07),.25,.45),root)
            wheelroot.rotation_euler.z=side*math.pi/2
            disc_front(name+' visible trailer tire',(0,0,0),.43,.22,'ink',wheelroot)
            disc_front(name+' polished wheel hub',(0,-.13,0),.25,.04,'stone',wheelroot)
            disc_front(name+' wheel hubcap',(0,-.16,0),.11,.035,'cream',wheelroot)
            # Raised curved fender hugs the outside wheel without hiding the whole tire.
            curve(name+' rounded wheel fender',[(.5*math.cos(a),-.15,.5*math.sin(a)) for a in [j*math.pi/12 for j in range(13)]],'teal_light',.08,wheelroot)
        steps=24;verts=[]
        for yy in [-1.61,1.61]:
            for j in range(steps+1):
                a=math.pi*j/steps
                verts.append(((w/2+.17)*math.cos(a),yy,3.68+.88*math.sin(a)))
        mesh(name+' rounded teal front roof fascia',[(v[0],-1.53,v[2]-.07) for v in verts[:steps+1]], [tuple(range(steps+1))],'teal_light',root)
        mesh(name+' rounded teal rear roof fascia',[(v[0],1.53,v[2]-.07) for v in verts[:steps+1]], [tuple(range(steps+1))],'teal',root)
        faces=[(j,j+1,steps+2+j,steps+1+j) for j in range(steps)]
        roof=mesh(name+' barrel copper roof',verts,faces,'copper',root)
        sol=roof.modifiers.new('Curved roof thickness','SOLIDIFY');sol.thickness=.11
        for pp in roof.data.polygons:pp.use_smooth=True
        for yy in [-1.64,1.64]:
            curve(name+' rolled curved roof rim',[(v[0],yy,v[2]) for v in verts[:steps+1]],'copper_light',.07,root)
        for yy in [-1.08,-.43,.23,.90]:
            curve(name+' copper roof seam',[(v[0],yy,v[2]+.027) for v in verts[:steps+1]],'copper_light',.023,root)
        _awning(name,w+.42,.67,3.63,'orange','cream',root)
        # Circular enamel brand medallion reads differently from the timber shop's horizontal board.
        disc_front(name+' round enamel brand',(0,-1.70,4.54),.64,.13,'teal_dark',root)
        disc_front(name+' cream brand center',(0,-1.78,4.54),.53,.035,'cream',root)
        text(name+' round brand text','BURGERS',(0,-1.813,4.54),.20,'teal_dark',root,True,max_width=.99)
        text(name+' round brand tiny star','*',(0,-1.821,4.81),.25,'orange',root,True)
        # Big price card hangs beside round sign, above awning but within window-facing shot.
        signpos=(1.25,-1.79,4.08)
        rod(name+' towbar',(w/2,0,.45),(w/2+1.0,0,.40),.075,'stone_shadow',root)
        sphere(name+' tow coupling',(w/2+1.06,0,.4),(.16,.13,.12),'stone_shadow',root)
    price_root=empty(name+' PRICE SIGN',signpos,root)
    board=box(name+' yellow enamel price card',(0,0,0),(1.72,.095,.65),'F7E36B',.065,price_root)
    price_text=text(name+' PRICE TEXT',price,(0,-.059,-.005),.46,'ink',price_root,True,max_width=1.53)
    for x in [-.71,.71]:
        sphere(name+' sign fixing',(x,-.058,.22),(.025,.012,.025),'cream',price_root,10)
    # Counter props and independent movable parts for the cash/counting gag.
    reg=_register(name+' REGISTER',(1.32,-1.36,1.82),root)
    phone=_phone(name+' PHONE',(-1.48,-1.36,1.82),root)
    tray=cylinder(name+' change tray',(-.60,-1.64,1.815),.23,.034,'gold',root,24)
    change=[]
    for j,((xx,yy),cents,rad,c) in enumerate(zip([(-.66,-1.64),(-.52,-1.60),(-.57,-1.72)],[25,5,1],[.075,.067,.055],['stone','stone','copper'])):
        coin=cylinder(name+f' CHANGE COIN {cents} CENTS',(xx,yy,1.846+j*.004),rad,.022,c,root,20)
        coin['cents']=cents;change.append(coin)
        digit=text(name+f' COIN {cents} LABEL',str(cents),(0,0,.013),.057 if cents==25 else .069,'wood_dark',coin,True)
        digit.rotation_euler=(0,0,0)
    burger_tray=box(name+' removable burger serving tray',(.12,-1.42,1.82),(.81,.55,.055),'cream',.08,root)
    # Chalk A-frame at shop edge, kept clear of the buyer and cycle lane.
    boardroot=empty(name+' SIDEWALK MENU',(-2.80,-.82,0),root);boardroot.rotation_euler.z=-.10
    panel=box(name+' chalk menu',(0,0,.86),(.72,.12,1.23),'teal_dark',.04,boardroot);panel.rotation_euler.x=-.10
    for x in [-.40,.40]:
        rod(name+' menu front leg',(x,-.10,.05),(x,.02,1.54),.045,'wood',boardroot)
        rod(name+' menu rear leg',(x,.51,.05),(x,.02,1.54),.045,'wood',boardroot)
    for z in [.23,1.49]:box(name+' menu wood trim',(0,-.09,z),(.88,.13,.09),'wood',.02,boardroot)
    text(name+' menu word','BURGERS',(0,-.085,1.12),.125,'chalk',boardroot,True)
    for z,ww in [(.84,.39),(.68,.46),(.52,.32)]:box(name+' chalk flourish',(0,-.092,z),(ww,.012,.022),'chalk',.002,boardroot)
    anchors={
        'vendor_anchor':empty(name+' VENDOR ANCHOR',(0,0,.28),root),
        'buyer_anchor':empty(name+' BUYER ANCHOR',(0,-2.45,.12),root),
        'contact_anchor':empty(name+' CONTACT ANCHOR',(0,-1.35,1.95),root),
        'burger_anchor':empty(name+' BURGER ANCHOR',(.12,-1.42,1.88),root),
        'payment_anchor':empty(name+' PAYMENT ANCHOR',(-.55,-1.60,1.95),root),
        'register_anchor':empty(name+' REGISTER ANCHOR',(1.30,-1.38,2.35),root),
        'price_anchor':empty(name+' PRICE ANCHOR',signpos,root),
        'bike_anchor':empty(name+' BIKE ANCHOR',(-1.3,-2.7,.12),root)
    }
    bpy.context.view_layer.update()
    result={'root':root,'kind':kind,'origin':tuple(origin),'counter':counter,
            'price_sign':price_root,'price_text':price_text,'register':reg['root'],
            'register_parts':reg,'cash_drawer':reg['drawer'],'drawer':reg['drawer'],
            'keys':reg['keys'],'register_display':reg['display'],'receipt':reg['receipt'],
            'coin_tray':tray,'coins':change,'burger_tray':burger_tray,'phone':phone['root'],
            'handset':phone['handset'],'phone_parts':phone,'anchors':anchors}
    result.update(anchors);result['objects']=list(set(bpy.data.objects)-start)
    return result

def build_street():
    """Build the route, returning shops, landmark roots, route anchors and every new object."""
    before=set(bpy.data.objects);random.seed(19)
    landscape=empty('STREET ENVIRONMENT')
    box('Continuous pastel ground',(16,5,-.18),(72,42,.30),'lawn',.06,landscape)
    box('Asphalt road',(16,-1.05,-.03),(68,4.1,.12),'road',.025,landscape)
    box('Raised pedestrian sidewalk',(16,2.48,.035),(68,2.98,.15),'paving',.03,landscape)
    box('Long beveled curb',(16,.965,.075),(68,.18,.25),'curb',.025,landscape)
    # Large slab joints communicate a receding ground plane; subtle, never a screen-space grid.
    for xx in range(-17,51,2):
        box('Sidewalk expansion seam',(xx,2.47,.116),(.018,2.83,.008),'C6BBAE',0,landscape)
    for yy in [1.77,3.12]:box('Lengthwise sidewalk seam',(16,yy,.117),(68,.014,.008),'CBBFB2',0,landscape)
    # Stylized irregular wear is geometry on the road, not a flat background painting.
    for xx in [-9,-2,4,10,20,25,36,43]:
        curve('Soft road repair',[(xx,-2.4,.037),(xx+.6,-2.28,.038),(xx+1,-2.37,.038),(xx+1.45,-2.13,.038)],'CBBFBA',.018,landscape)
    # Low distant landforms and trees establish parallax behind the inhabited street.
    for i,(x,y,s) in enumerate([(-10,16,7),(2,20,8),(15,22,10),(30,22,11),(45,18,8)]):
        sphere('Distant rolling hill '+str(i),(x,y,.10),(s,5,2.5),'CBD2CE',landscape,20)
    cottages=[]
    for n,loc,w,c,r,h in [('Willow cottage',(-5,7.2,0),4.2,'yellow_light','copper_light',3.1),('Rose cottage',(1.5,7.5,0),4.35,'coral','lilac',3.35),('Mint cottage',(7.2,7.6,0),3.75,'teal_light','copper_light',3.0)]:
        cottages.append(cottage(n,loc,w,c,r,h))
    fence('Cottage picket fence',-9,9.3,4.38,1.03,landscape)
    # Little gates and path slabs form a normal inhabited neighborhood, with equal visual care throughout.
    for xx in [-5,1.5,7.2]:
        box('Cottage garden path',(xx,5.0,.03),(1.05,2.0,.06),'stone',.03,landscape)
        flower_planter('Window garden '+str(xx),(xx-1.6,4.82,0),.9,landscape)
    for x,y,h,k in [(-10,7.3,5.0,'round'),(-1.8,9,5.1,'column'),(10.5,7.8,5.0,'round'),(17.4,9.0,5.5,'column'),(22,11.7,5.9,'round'),(34.9,8.5,5.0,'column'),(39.8,7,5.6,'round'),(44,10,5.2,'column')]:
        tree('Street tree '+str(x),(x,y,0),h,'leaf',k,landscape)
    # Park sequence: winding walk, shallow basin with arcing water, benches and open iron arch.
    park=empty('FOUNTAIN PARK',(0,0,0),landscape)
    box('Park stone walk',(18.8,6.5,.04),(7.8,1.3,.08),'stone',.05,park)
    box('Park approach path',(20.6,5.1,.035),(1.3,3.6,.07),'stone',.05,park)
    fountain_root=fountain('Town fountain',(19.6,7.3,0))
    bench('Fountain bench',(16.7,5.9,0),-.12)
    bench('Garden bench',(22.4,7.8,0),-.65)
    arch=park_arch('Park entrance arch',(22.7,5.05,0))
    # Discrete clipped hedges set behind curb, low enough not to hide actions.
    for xx,yy,sx in [(11,5.15,.8),(17.0,8.9,1.0),(22.1,9.3,1.4),(36.3,5.2,1.3),(40.8,4.8,1.3)]:
        box('Soft clipped hedge',(xx,yy,.52),(sx*2,.80,1.04),'lawn_dark',.30,landscape)
    block=commercial_block('Clock corner shops',(27.9,10.0,0))
    cottages.append(cottage('Lavender bakery house',(38.4,8.0,0),5.15,'lilac','copper_light',4.2))
    text('Bakery window word','BAKERY',(38.4,6.35,2.52),.28,'wood_dark',None,True)
    # Hanging flower tubs and lamp rhythm animate the travelling view with varied depths.
    for xx,yy,h in [(-8.5,3.87,4.2),(4.5,4.0,4.5),(18.1,4.05,4.7),(25.0,4.1,4.5),(36.3,3.95,4.5)]:lamppost('Street lamp '+str(xx),(xx,yy,0),h)
    for xx,yy in [(11.0,3.8),(23.5,4.1),(34.7,4.5)]:flower_planter('Street planter '+str(xx),(xx,yy,0),1.25,landscape)
    # Mailbox is a small normal street landmark, not a socioeconomic cue.
    mail=empty('Public postbox',(4.8,3.72,0),landscape)
    cylinder('Postbox base',(0,0,.48),.065,.92,'fence_shadow',mail)
    box('Rounded public postbox',(0,0,1.14),(.52,.45,.56),'teal_light',.15,mail)
    box('Postbox mail slot',(0,-.23,1.20),(.33,.018,.045),'teal_dark',.012,mail)
    shop1=create_shop('SUNNY TIMBER BURGERS',(14,4,0),'timber','$5.69')
    shop2=create_shop('COPPER CURVE BURGERS',(31,4,0),'trailer','$6.89')
    anchors={
        'cottages':empty('ROUTE COTTAGES',(3,-.30,0)),
        'park':empty('ROUTE PARK',(19,-.30,0)),
        'clock_corner':empty('ROUTE CLOCK CORNER',(26,-.30,0)),
        'first_stop':shop1['buyer_anchor'],'second_stop':shop2['buyer_anchor'],
    }
    for ob in set(bpy.data.objects)-before:
        if ob is not landscape and ob.parent is None:
            ob.parent=landscape
    bpy.context.view_layer.update()
    return {'root':landscape,'shops':[shop1,shop2],'shop1':shop1,'shop2':shop2,
            'route_anchors':anchors,'cottages':cottages,'fountain':fountain_root,
            'arch':arch,'commercial_block':block,'objects':list(set(bpy.data.objects)-before)}
