"""Persist controller handles as ordinary scene metadata for cheap shot re-bakes.
The saved film never needs this registry to play; it only makes editing reproducible.
"""
import bpy,json
from mathutils import Vector,Matrix,Euler,Quaternion

def encode(x):
 if isinstance(x,bpy.types.ID):return {'@':'id','kind':type(x).__name__,'name':x.name}
 if isinstance(x,bpy.types.ShapeKey):return {'@':'shape_key','owner':x.id_data.name,'name':x.name}
 if isinstance(x,Matrix):return {'@':'matrix','value':[list(r) for r in x]}
 if isinstance(x,Vector):return {'@':'vector','value':list(x)}
 if isinstance(x,Euler):return {'@':'euler','value':list(x),'order':x.order}
 if isinstance(x,Quaternion):return {'@':'quaternion','value':list(x)}
 if isinstance(x,dict):return {'@':'dict','items':[[encode(k),encode(v)] for k,v in x.items() if not callable(v)]}
 if isinstance(x,(tuple,list,set)):return {'@':'tuple' if isinstance(x,tuple) else 'list','items':[encode(v) for v in x]}
 if x is None or isinstance(x,(bool,int,float,str)):return x
 raise TypeError('Unsupported registry type: '+type(x).__name__)

def decode(x):
 if not isinstance(x,dict) or '@' not in x:return x
 t=x['@']
 if t=='id':
  # Resolve by actual Blender class, not by guessing a filesystem/resource path.
  collections={'Object':'objects','Mesh':'meshes','Curve':'curves','TextCurve':'curves','Camera':'cameras','Armature':'armatures','Key':'shape_keys','Material':'materials','World':'worlds','Scene':'scenes','Image':'images','Action':'actions'}
  return getattr(bpy.data,collections[x['kind']])[x['name']]
 if t=='shape_key':return bpy.data.shape_keys[x['owner']].key_blocks[x['name']]
 if t=='matrix':return Matrix(x['value'])
 if t=='vector':return Vector(x['value'])
 if t=='euler':return Euler(x['value'],x['order'])
 if t=='quaternion':return Quaternion(x['value'])
 if t=='dict':return {decode(k):decode(v) for k,v in x['items']}
 if t in {'tuple','list'}:
  a=[decode(v) for v in x['items']];return tuple(a) if t=='tuple' else a
 raise ValueError(t)

def save(scene,assets):
 data=json.dumps(encode(assets),separators=(',',':'));scene['film_asset_registry']=data;return data

def load(scene):
 assets=decode(json.loads(scene['film_asset_registry']))
 if 'second' in assets:
  a=assets['second'];a['wp']=lambda p:a['M']@Vector(p)
 return assets
