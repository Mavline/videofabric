"""Conservative, render-free PNG-reuse manifest for baked Workbench cartoons.

Run with the installed Blender, never plain CPython:
  blender -b --factory-startup --disable-autoexec -t 1 -P frame_reuse_manifest.py -- \
    --blend burger-faithful-proof.blend --output proof_reuse.json \
    --accent 5.8:6.10 --accent 6.8:7.42 --accent 9.60:9.85 --accent 13.15:13.50

No render, geometry conversion, scene save, handlers, or asset edits are performed.
Sampling and deduplication are deliberately separate: a master frame can HOLD an
earlier sampled drawing, but two SAMPLED drawings share a PNG only when their
exact captured visual states match. There is no float tolerance or rounding.
Unsupported animation/effects disable BOTH sampling and deduplication globally.
This is intentionally limited to fixed-topology, fixed-material Workbench films.
"""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import time

import bpy


VERSION = 1
SUPPORTED_OBJECTS = {'MESH', 'CURVE', 'SURFACE', 'FONT', 'ARMATURE', 'EMPTY', 'CAMERA', 'LIGHT'}
SUPPORTED_MODIFIERS = {'BEVEL', 'WEIGHTED_NORMAL', 'SUBSURF', 'ARMATURE', 'SOLIDIFY'}
TRANSFORM_PATHS = {
    'location', 'rotation_euler', 'rotation_quaternion', 'rotation_axis_angle',
    'rotation_mode', 'scale', 'delta_location', 'delta_rotation_euler',
    'delta_rotation_quaternion', 'delta_scale', 'hide_render', 'hide_viewport',
    'color', 'pass_index', 'display_type', 'show_transparent',
}
POSE_PATH = re.compile(r'^pose\.bones\["(?:[^"\\]|\\.)*"\]\.(?:'
                       r'location|rotation_euler|rotation_quaternion|rotation_axis_angle|'
                       r'rotation_mode|scale|bbone_[a-z_]+)$')
CURVE_PATH = re.compile(r'^(?:splines\[\d+\]\.(?:(?:bezier_points|points)\[\d+\]\.)?'
                        r'[a-z_]+|[a-z_]+)$')
KEY_PATH = re.compile(r'^key_blocks\["(?:[^"\\]|\\.)*"\]\.(?:value|mute)$')
PRIMITIVE_TYPES = {'BOOLEAN', 'INT', 'FLOAT', 'STRING', 'ENUM'}


def identity(value):
    if value is None:
        return None
    lib = getattr(value, 'library', None)
    return [value.bl_rna.identifier, value.name_full, lib.filepath if lib else '']


def primitive(value):
    """An exact, JSON-safe representation. Non-finite values fail closed."""
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError('non-finite state value')
        return value
    if isinstance(value, set):
        return sorted(value)
    if isinstance(value, bpy.types.ID):
        return identity(value)
    # mathutils and bpy_prop_array expose Python's sequence protocol without
    # necessarily exposing an explicit __iter__ attribute.
    try:
        return [primitive(v) for v in iter(value)]
    except TypeError as exc:
        raise TypeError('unsupported state value ' + type(value).__name__) from exc


def scalars(owner, exclude=()):
    """All primitive RNA values, including read-only computed geometry fields."""
    result = {}
    for prop in owner.bl_rna.properties:
        if prop.identifier in exclude or prop.type not in PRIMITIVE_TYPES:
            continue
        result[prop.identifier] = primitive(getattr(owner, prop.identifier))
    return result


def matrix(value):
    return [[float(x) for x in row] for row in value]


def digest(value):
    # Python's JSON float encoder is lossless (round-trips each binary float).
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                    ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def file_digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def all_ids():
    seen = set()
    for prop in bpy.data.bl_rna.properties:
        if prop.type != 'COLLECTION':
            continue
        for item in getattr(bpy.data, prop.identifier):
            if isinstance(item, bpy.types.ID) and item.as_pointer() not in seen:
                seen.add(item.as_pointer())
                yield item
                tree = getattr(item, 'node_tree', None)
                if tree is not None and tree.as_pointer() not in seen:
                    seen.add(tree.as_pointer())
                    yield tree


def action_curves(action):
    if action is None:
        return []
    # Blender 4.3's legacy Actions; newer layered Actions fail closed.
    if not hasattr(action, 'fcurves'):
        raise ValueError('layered Action is unsupported')
    if getattr(action, 'is_action_layered', False) and len(getattr(action, 'layers', [])):
        raise ValueError('layered Action is unsupported')
    return list(action.fcurves)


def owner_curves(owner):
    ad = getattr(owner, 'animation_data', None)
    if ad is None:
        return []
    actions = [ad.action] if ad.action else []
    for track in ad.nla_tracks:
        for strip in track.strips:
            if strip.type != 'CLIP':
                raise ValueError('non-CLIP NLA strip is unsupported')
            if strip.action:
                actions.append(strip.action)
    return [fc for action in actions for fc in action_curves(action)]


def supported_path(owner, path):
    if isinstance(owner, bpy.types.Object):
        return path in TRANSFORM_PATHS or bool(POSE_PATH.fullmatch(path))
    if isinstance(owner, bpy.types.Curve):
        return bool(CURVE_PATH.fullmatch(path))
    if isinstance(owner, bpy.types.Camera):
        return bool(re.fullmatch(r'(?:dof\.)?[a-z_]+', path))
    if isinstance(owner, bpy.types.Key):
        return bool(KEY_PATH.fullmatch(path)) or path == 'eval_time'
    if isinstance(owner, bpy.types.World):
        return path == 'color'
    if isinstance(owner, bpy.types.Collection):
        return path in {'hide_render', 'hide_viewport'}
    # Materials, nodes, mesh/rest-bone/lattice geometry, render settings, custom
    # properties, caches, geometry nodes, etc. are intentionally unsupported.
    return False


class Capture:
    def __init__(self, scene, view_layer):
        self.scene = scene
        self.view_layer = view_layer
        self.flags = set()
        self.objects = sorted(scene.objects, key=lambda o: o.name_full)
        self.animated_paths = {}
        self.static_data = {}
        self._preflight()

    def flag(self, reason):
        self.flags.add(reason)

    def _preflight(self):
        s = self.scene
        if s.render.engine != 'BLENDER_WORKBENCH':
            self.flag('unsupported render engine: ' + s.render.engine)
        if len([layer for layer in s.view_layers if layer.use]) != 1:
            self.flag('multiple or zero enabled render view layers')
        if s.use_nodes and s.node_tree and s.render.use_compositing:
            self.flag('compositor enabled')
        if s.sequence_editor and s.render.use_sequencer and len(s.sequence_editor.sequences_all):
            self.flag('sequencer enabled')
        if getattr(s.render, 'use_motion_blur', False):
            self.flag('motion blur enabled')
        if s.rigidbody_world:
            self.flag('rigid-body simulation')
        for name in ('frame_change_pre', 'frame_change_post', 'depsgraph_update_pre',
                     'depsgraph_update_post', 'render_pre', 'render_post', 'render_init'):
            if getattr(bpy.app.handlers, name):
                self.flag('registered handler: ' + name)
        for image in bpy.data.images:
            if image.source in {'MOVIE', 'SEQUENCE'}:
                self.flag('time-varying image: ' + image.name_full)
        for owner in all_ids():
            ad = getattr(owner, 'animation_data', None)
            if ad and ad.drivers:
                self.flag('drivers: ' + owner.name_full)
            try:
                paths = sorted({fc.data_path for fc in owner_curves(owner)})
                for path in paths:
                    if not supported_path(owner, path):
                        self.flag('unsupported animated path: ' + owner.name_full + ':' + path)
                    else:
                        try:
                            primitive(owner.path_resolve(path))
                        except Exception as exc:
                            self.flag('unreadable animated path: ' + owner.name_full + ':' + path
                                      + ' (' + str(exc) + ')')
                if paths:
                    self.animated_paths[owner.as_pointer()] = paths
            except Exception as exc:
                self.flag('unsupported animation: ' + owner.name_full + ' (' + str(exc) + ')')
        for ob in self.objects:
            if ob.type not in SUPPORTED_OBJECTS:
                self.flag('unsupported object type: ' + ob.name_full + ':' + ob.type)
            if ob.instance_type != 'NONE':
                self.flag('object instancing: ' + ob.name_full)
            if ob.particle_systems:
                self.flag('particle system: ' + ob.name_full)
            for mod in ob.modifiers:
                if mod.type not in SUPPORTED_MODIFIERS:
                    self.flag('unsupported modifier: ' + ob.name_full + ':' + mod.type)
                if mod.show_render != mod.show_viewport:
                    self.flag('render/viewport modifier mismatch: ' + ob.name_full + ':' + mod.name)
            if ob.type == 'MESH' and ob.data.shape_keys and not ob.data.shape_keys.use_relative:
                # eval_time is read but absolute key interpolation is not covered.
                self.flag('absolute shape keys: ' + ob.name_full)
            if ob.type in {'CURVE', 'SURFACE', 'FONT'}:
                for field in ('bevel_object', 'taper_object', 'text_on_curve'):
                    if getattr(ob.data, field, None):
                        self.flag('external curve dependency: ' + ob.name_full + ':' + field)
        # Render-only constraints/dependencies cannot safely be evaluated through
        # Blender's viewport depsgraph. Membership mismatches are checked per frame.

    def render_membership(self):
        allowed, viewport_blocked = set(), set()

        def walk(layer, render_blocked=False, viewport_hidden=False):
            render_blocked = render_blocked or layer.exclude or layer.collection.hide_render
            viewport_hidden = viewport_hidden or layer.hide_viewport or layer.collection.hide_viewport
            if not render_blocked:
                for ob in layer.collection.objects:
                    allowed.add(ob.name_full)
                    if viewport_hidden:
                        viewport_blocked.add(ob.name_full)
            for child in layer.children:
                walk(child, render_blocked, viewport_hidden)

        walk(self.view_layer.layer_collection)
        visible = []
        visibility = []
        for ob in self.objects:
            shown = ob.name_full in allowed and not ob.hide_render
            visibility.append([ob.name_full, shown])
            if shown:
                visible.append(ob)
                if (ob.hide_viewport or ob.name_full in viewport_blocked) and ob.type not in {'EMPTY', 'ARMATURE'}:
                    self.flag('render-visible object disabled in viewport depsgraph: ' + ob.name_full)
        return visible, visibility

    def evaluated(self, owner, depsgraph):
        return owner.evaluated_get(depsgraph)

    def curve_state(self, curve):
        data = {'properties': scalars(curve), 'splines': []}
        for spline in curve.splines:
            sp = {'properties': scalars(spline), 'points': [], 'bezier_points': []}
            for point in spline.points:
                sp['points'].append(scalars(point))
            for point in spline.bezier_points:
                sp['bezier_points'].append(scalars(point))
            data['splines'].append(sp)
        # Font format (material index, kerning, bold, italic, etc.) matters too.
        if hasattr(curve, 'body_format'):
            data['body_format'] = [scalars(item) for item in curve.body_format]
            data['text_boxes'] = [scalars(item) for item in curve.text_boxes]
        return data

    def data_state(self, ob, evaluated):
        original = ob.data
        if original is None:
            return None
        key = original.as_pointer()
        animated = key in self.animated_paths
        if not animated and key in self.static_data:
            return self.static_data[key]
        data = evaluated.data
        if ob.type in {'CURVE', 'SURFACE', 'FONT'}:
            value = self.curve_state(data)
        elif ob.type == 'CAMERA':
            value = {'properties': scalars(data), 'dof': scalars(data.dof),
                     'focus_object': identity(data.dof.focus_object)}
        elif ob.type == 'LIGHT':
            value = scalars(data)
        else:
            # Mesh topology, normals, material assignments and armature rest data
            # are fixed in this supported contract, namespaced by blend SHA-256.
            value = identity(original)
        result = digest(value)
        if not animated:
            self.static_data[key] = result
        return result

    def shape_state(self, ob, evaluated):
        if not ob.data or not getattr(ob.data, 'shape_keys', None):
            return None
        keys = evaluated.data.shape_keys or ob.data.shape_keys
        return [scalars(keys, {'name', 'name_full'}),
                [[block.name, block.value, block.mute, block.interpolation,
                  block.relative_key.name if block.relative_key else None]
                 for block in keys.key_blocks]]

    def rig_state(self, original, depsgraph):
        rig = self.evaluated(original, depsgraph)
        # Pose matrices cover constraints/IK; primitive bone properties also cover
        # animated B-Bone curvature/ease/scale settings that matrices alone miss.
        bones = [[bone.name, matrix(bone.matrix), scalars(bone)] for bone in rig.pose.bones]
        if original.hide_viewport:
            self.flag('required armature disabled in viewport depsgraph: ' + original.name_full)
        return [identity(original), matrix(rig.matrix_world), bones]

    def evaluate(self, frame, full=True):
        s = self.scene
        s.frame_set(frame)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        visible, visibility = self.render_membership()
        camera = s.camera
        if camera is None:
            self.flag('scene has no camera')
            camera_state = None
        else:
            evaluated_camera = self.evaluated(camera, depsgraph)
            cd = evaluated_camera.data
            camera_state = [identity(camera), matrix(evaluated_camera.matrix_world),
                            scalars(cd), scalars(cd.dof), identity(cd.dof.focus_object)]
            if cd.dof.focus_object:
                focus = self.evaluated(cd.dof.focus_object, depsgraph)
                camera_state.append(matrix(focus.matrix_world))
        text_state = []
        for ob in visible:
            if ob.type == 'FONT':
                ev = self.evaluated(ob, depsgraph)
                text_state.append([ob.name_full, self.data_state(ob, ev)])
        # Always keep camera, text/content substitutions and visibility changes
        # frame-accurate, even when they land between the normal held drawings.
        guard = digest([camera_state, visibility, text_state])
        if not full:
            return guard, None
        state = {'camera': camera_state, 'visibility': visibility, 'objects': [], 'rigs': [],
                 'world': scalars(s.world) if s.world else None}
        rigs = {}
        for ob in visible:
            if ob.type in {'EMPTY', 'ARMATURE', 'CAMERA'}:
                continue
            ev = self.evaluated(ob, depsgraph)
            object_state = [identity(ob), matrix(ev.matrix_world), list(ev.color),
                            ev.display_type, ev.show_transparent, ev.pass_index,
                            self.data_state(ob, ev), self.shape_state(ob, ev),
                            [[slot.link, identity(slot.material)] for slot in ev.material_slots]]
            for mod in ob.modifiers:
                if mod.type == 'ARMATURE' and mod.show_render and mod.object:
                    rigs[mod.object.name_full] = mod.object
            # Capture supported animated scalar values as a belt-and-braces check
            # alongside world matrices. Omit hidden owners deliberately: their
            # transforms cannot render, while visible dependents are evaluated.
            paths = self.animated_paths.get(ob.as_pointer(), [])
            if paths:
                object_state.append([[path, primitive(ev.path_resolve(path))] for path in paths])
            state['objects'].append(object_state)
        state['rigs'] = [self.rig_state(rigs[name], depsgraph) for name in sorted(rigs)]
        return guard, digest(state)


def parse_range(text, cast):
    parts = text.split(':')
    if len(parts) != 2:
        raise argparse.ArgumentTypeError('expected START:END')
    lo, hi = (cast(part) for part in parts)
    if lo > hi:
        raise argparse.ArgumentTypeError('range start must be <= end')
    return lo, hi


def arguments(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--blend', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    p.add_argument('--scene')
    p.add_argument('--start', type=int)
    p.add_argument('--end', type=int)
    p.add_argument('--hold-fps', type=float, default=12)
    p.add_argument('--accent', action='append', default=[], type=lambda v: parse_range(v, float),
                   help='inclusive seconds from scene.frame_start; keep every master frame in window')
    p.add_argument('--accent-frame', action='append', default=[], type=lambda v: parse_range(v, int),
                   help='inclusive absolute Blender frame range')
    p.add_argument('--progress-every', type=int, default=120)
    return p.parse_args(argv)


def build_manifest(args):
    started = time.monotonic()
    path = args.blend.expanduser().resolve()
    source_hash = file_digest(path)
    bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False, use_scripts=False)
    scene = bpy.data.scenes[args.scene] if args.scene else bpy.context.scene
    bpy.context.window.scene = scene
    layer = next((layer for layer in scene.view_layers if layer.use), scene.view_layers[0])
    bpy.context.window.view_layer = layer
    start = args.start if args.start is not None else scene.frame_start
    end = args.end if args.end is not None else scene.frame_end
    if end < start:
        raise ValueError('--end must be >= --start')
    fps = scene.render.fps / scene.render.fps_base
    ratio = fps / args.hold_fps if args.hold_fps > 0 else 0
    if ratio < 1 or abs(ratio - round(ratio)) > 1e-9:
        raise ValueError('--hold-fps must divide the master fps exactly (use 12 or 24 for 24 fps)')
    step = round(ratio)
    accents = set()
    for lo, hi in args.accent:
        first = math.ceil(scene.frame_start + lo * fps - 1e-8)
        last = math.floor(scene.frame_start + hi * fps + 1e-8)
        accents.update(range(max(start, first), min(end, last) + 1))
    for lo, hi in args.accent_frame:
        accents.update(range(max(start, lo), min(end, hi) + 1))
    capture = Capture(scene, layer)
    seen = {}
    rows = []
    previous_guard = None
    selected = canonical = None
    selected_hash = None
    forced = []
    for frame in range(start, end + 1):
        try:
            guard, _ = capture.evaluate(frame, full=False)
            scheduled = (frame - scene.frame_start) % step == 0 or frame in accents or frame == start
            changed = previous_guard is not None and guard != previous_guard
            if scheduled or changed or capture.flags:
                if changed and not scheduled:
                    forced.append(frame)
                _, state_hash = capture.evaluate(frame, full=True)
                selected = frame
                selected_hash = state_hash
                canonical = frame if capture.flags else seen.setdefault(state_hash, frame)
            rows.append({'frame': frame, 'sample_frame': selected, 'canonical_frame': canonical,
                         'state_sha256': selected_hash, 'held': selected != frame})
            previous_guard = guard
        except Exception as exc:
            capture.flag('capture error at frame ' + str(frame) + ': ' + repr(exc))
            rows.append({'frame': frame, 'sample_frame': frame, 'canonical_frame': frame,
                         'state_sha256': None, 'held': False})
        if args.progress_every and (frame - start + 1) % args.progress_every == 0:
            print('MANIFEST_PROGRESS', frame - start + 1, '/', end - start + 1,
                  'unique', len(seen), 'flags', len(capture.flags), flush=True)
    if file_digest(path) != source_hash:
        raise RuntimeError('source blend changed during scan; discard and rerun against the finalized file')
    if capture.flags:
        # A late-discovered unsupported state invalidates earlier reuse too.
        # Never emit a partially optimistic manifest.
        for row in rows:
            row.update(sample_frame=row['frame'], canonical_frame=row['frame'], held=False,
                       state_sha256=None)
    unique = sorted({row['canonical_frame'] for row in rows})
    sampled = sorted({row['sample_frame'] for row in rows})
    manifest = {
        'schema': 'blender-frame-reuse', 'version': VERSION,
        'source': {'blend': str(path), 'sha256': source_hash, 'blender': bpy.app.version_string,
                   'scene': scene.name, 'view_layer': layer.name},
        'render': {'engine': scene.render.engine,
                   'width': scene.render.resolution_x, 'height': scene.render.resolution_y,
                   'percentage': scene.render.resolution_percentage,
                   'aa': scene.display.render_aa,
                   'settings_sha256': digest([scalars(scene.render, {'filepath'}),
                                               scalars(scene.display), scalars(scene.display.shading),
                                               scalars(scene.view_settings)])},
        'timing': {'start': start, 'end': end, 'fps': scene.render.fps,
                   'fps_base': scene.render.fps_base, 'master_fps': fps,
                   'requested_hold_fps': args.hold_fps, 'hold_step': step,
                   'accent_seconds': args.accent, 'accent_frame_ranges': args.accent_frame,
                   'accent_frames': sorted(accents), 'guard_forced_frames': forced,
                   'sampling_applied': not bool(capture.flags)},
        'safety': {'exact_float_state': True, 'static_topology_and_materials_required': True,
                   'unsupported_state_flags': sorted(capture.flags),
                   'fallback_unique_every_master_frame': bool(capture.flags),
                   'dedupe_applied': not bool(capture.flags),
                   'note': 'Holds intentionally sample poses; dedupe only equates captured sampled states. '
                           'No pixels were rendered or compared. Unsupported states use unique master frames.'},
        'counts': {'master_frames': len(rows), 'sampled_drawings': len(sampled),
                   'canonical_renders': len(unique), 'identical_sample_reuses': len(sampled) - len(unique),
                   'held_master_frames': len(rows) - len(sampled),
                   'total_png_renders_avoided': len(rows) - len(unique)},
        'canonical_render_frames': unique, 'timeline': rows,
        'elapsed_seconds': round(time.monotonic() - started, 3),
    }
    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + '.tmp-' + str(os.getpid()))
    temporary.write_text(json.dumps(manifest, indent=2) + '\n')
    temporary.replace(output)
    print('MANIFEST_READY', json.dumps({'output': str(output), 'counts': manifest['counts'],
                                       'unsupported_state_flags': sorted(capture.flags),
                                       'elapsed_seconds': manifest['elapsed_seconds']}), flush=True)
    return manifest


if __name__ == '__main__':
    args = arguments(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    build_manifest(args)
