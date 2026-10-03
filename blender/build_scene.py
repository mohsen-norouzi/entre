"""Rebuild the editable ENTRE scene from the adjacent scene-data.json.
Run: blender --background --python blender/build_scene.py -- --preview
"""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector

parser=argparse.ArgumentParser()
parser.add_argument('--project',type=Path,default=Path(__file__).resolve().parent.parent)
parser.add_argument('--output',type=Path)
parser.add_argument('--preview',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
ROOT=args.project;OUT=args.output or ROOT;OUT.mkdir(parents=True,exist_ok=True)
AUX=OUT if args.output else ROOT/'blender';AUX.mkdir(parents=True,exist_ok=True)
DATA=json.loads(Path(__file__).with_name('scene-data.json').read_text())
ART=DATA['artworks'];HOME=DATA['home']
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.name='ENTRE · Architectural light'
scene.unit_settings.system='METRIC';scene.unit_settings.length_unit='METERS'
scene.render.engine='CYCLES';scene.cycles.device='CPU'
scene.cycles.samples=96;scene.cycles.use_denoising=True;scene.cycles.preview_samples=16
scene.cycles.max_bounces=10;scene.cycles.transparent_max_bounces=24
scene.cycles.diffuse_bounces=4;scene.cycles.glossy_bounces=4
scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=.4

def collection(name,parent=None):
 c=bpy.data.collections.new(name);(parent or scene.collection).children.link(c);return c
architecture=collection('01 · Architecture and honed stone')
displays=collection('02 · Artwork displays — 20 editable groups')
lighting=collection('03 · Warm daylight')
cameras=collection('04 · Cameras and focus targets')

def move(obj,c):
 for old in list(obj.users_collection):old.objects.unlink(obj)
 c.objects.link(obj)

def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4

def rgb(h):return tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4))

def material(name,color,roughness,metallic=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*rgb(color),1)
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb(color),1)
 p.inputs['Roughness'].default_value=roughness;p.inputs['Metallic'].default_value=metallic
 return m
plaster=material('Warm limestone plaster','e5dfd2',.94)
bronze=material('Brushed bronze · frames and screen feet','887762',.42,.55)
edge=material('Archival print · graphite edges','51483a',.6,.25)
stone=material('Honed limestone · soft reflections','c9beaa',.36,.08)
nt=stone.node_tree;n=nt.nodes;l=nt.links;p=n.get('Principled BSDF')
coord=n.new('ShaderNodeTexCoord')
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1.8;noise.inputs['Detail'].default_value=5;noise.inputs['Roughness'].default_value=.72
l.new(coord.outputs['Object'],noise.inputs['Vector'])
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.1;ramp.color_ramp.elements[0].color=(*rgb('b7ac97'),1)
ramp.color_ramp.elements[1].position=.9;ramp.color_ramp.elements[1].color=(*rgb('d6cebf'),1)
l.new(noise.outputs['Fac'],ramp.inputs['Fac']);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
fine=n.new('ShaderNodeTexNoise');fine.inputs['Scale'].default_value=95;fine.inputs['Detail'].default_value=2
l.new(coord.outputs['Object'],fine.inputs['Vector'])
bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.15;bump.inputs['Distance'].default_value=.015
l.new(fine.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])

scrim=bpy.data.materials.new('Ivory woven scrim · translucent');scrim.use_nodes=True;scrim.diffuse_color=(*rgb('eee6d6'),.83)
n=scrim.node_tree.nodes;l=scrim.node_tree.links;n.clear()
out=n.new('ShaderNodeOutputMaterial');diffuse=n.new('ShaderNodeBsdfPrincipled')
diffuse.inputs['Roughness'].default_value=.93;diffuse.inputs['Sheen Weight'].default_value=.2
coord=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(420,3,1)
l.new(coord.outputs['UV'],mapping.inputs[0])
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1;noise.inputs['Detail'].default_value=2;l.new(mapping.outputs['Vector'],noise.inputs['Vector'])
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(*rgb('ded4be'),1);ramp.color_ramp.elements[1].color=(*rgb('f8f3e8'),1)
l.new(noise.outputs['Fac'],ramp.inputs['Fac']);l.new(ramp.outputs['Color'],diffuse.inputs['Base Color'])
translucent=n.new('ShaderNodeBsdfTranslucent');l.new(ramp.outputs['Color'],translucent.inputs['Color'])
mix=n.new('ShaderNodeMixShader');mix.inputs[0].default_value=.35;l.new(diffuse.outputs[0],mix.inputs[1]);l.new(translucent.outputs[0],mix.inputs[2])
transparent=n.new('ShaderNodeBsdfTransparent')
opacity=n.new('ShaderNodeMixShader');opacity.inputs[0].default_value=.83;l.new(transparent.outputs[0],opacity.inputs[1]);l.new(mix.outputs[0],opacity.inputs[2]);l.new(opacity.outputs[0],out.inputs[0])

# Convert the web's Y-up coordinates into Blender Z-up, placing the floor at zero.
def convert(x,y,z):return (x,-z,y+1.05)
def box(name,location,size,mat,c=architecture,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=location)
 o=bpy.context.object;o.name=name;o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(mat);move(o,c)
 if bevel:
  mod=o.modifiers.new('Soft edge highlights','BEVEL');mod.width=bevel;mod.segments=3
  mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o

def web_box(name,position,size,mat=plaster,bevel=.012):
 return box(name,convert(*position),(size[0],size[2],size[1]),mat,bevel=bevel)
web_box('Stone floor · 52 × 68 m',(0,-1.2,-12),(52,.3,68),stone,.02)
web_box('Rear plaster wall',(0,5.95,-43),(52,14,.4))
web_box('Left plaster wall',(-24,5.95,-12),(.4,14,68))
ceiling=web_box('Ceiling · hidden in editing viewport',(0,12.8,-12),(52,.3,68));ceiling.hide_set(True)
for i in range(13):
 web_box(f'Window pier {i+1:02}',(22,5.9,-40+i*4.5),(.65,14,.55))
 web_box(f'Window transom segment {i+1:02}',(22,5.3,-37.75+i*4.5),(.65,.16,3.94))
for i in range(9):web_box(f'Ceiling rib {i+1:02}',(-22+i*5.5,12.1,-12),(.12,1.1,68))

for art in ART:
 label=f"{art['id']} · {art['title']}";sub=collection(label,displays);p=art['position']
 parent=bpy.data.objects.new('ART '+label,None);sub.objects.link(parent);parent.empty_display_type='PLAIN_AXES';parent.empty_display_size=.2
 parent.location=convert(p['x'],p['y'],p['z']);parent.rotation_euler.z=p['yaw']
 for key in ['id','title','category','year','palette','description','note']:parent[key]=art[key]
 parent['source_image']=art['image'];parent['web_position']=json.dumps(p)
 center=parent.location.z
 # Leave a small clearance under the ceiling ribs instead of intersecting them.
 screen_height=12.55
 mesh=bpy.data.meshes.new(label+' · scrim mesh');w=3.4/2
 mesh.from_pydata([(-w,0,0),(w,0,0),(w,0,screen_height),(-w,0,screen_height)],[],[(0,1,2,3)]);mesh.update()
 uv=mesh.uv_layers.new(name='Woven fabric UV')
 for v,co in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):v.uv=co
 screen=bpy.data.objects.new(label+' · translucent screen',mesh);sub.objects.link(screen);screen.parent=parent;screen.location=(0,0,-center)
 screen.data.materials.append(scrim)
 foot=box(label+' · bronze foot',(0,0,0),(3.45,.14,.045),bronze,sub,.004);foot.parent=parent;foot.location=(0,0,.03-center)
 image_path=ROOT/'public'/art['image'].lstrip('/')
 im=bpy.data.images.load(str(image_path),check_existing=False);im.name=label+' · packed artwork';im.pack();im.filepath='//textures/'+image_path.name
 mat=material(label+' · printed photograph','ffffff',.83)
 n=mat.node_tree.nodes;l=mat.node_tree.links;bs=n.get('Principled BSDF')
 tex=n.new('ShaderNodeTexImage');tex.image=im;tex.label='Packed original image — replace here';tex.interpolation='Linear'
 l.new(tex.outputs['Color'],bs.inputs['Base Color']);l.new(tex.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=.4
 bs.inputs['Specular IOR Level'].default_value=.12
 for side in [-1,1]:
  print_obj=box(label+(' · front print' if side<0 else ' · reverse print'),(0,0,0),(2.78,.065,4.18),edge,sub,.004)
  print_obj.parent=parent;print_obj.location=(0,side*.085,0);print_obj.data.materials.append(mat)
  uv=print_obj.data.uv_layers.active or print_obj.data.uv_layers.new(name='Artwork UV')
  for poly in print_obj.data.polygons:
   is_face=abs(poly.normal.y)>.9;poly.material_index=1 if is_face else 0
   if is_face:
    for li in poly.loop_indices:
     co=print_obj.data.vertices[print_obj.data.loops[li].vertex_index].co
     uv.data[li].uv=(.5+co.x/2.78*(-1 if poly.normal.y>0 else 1),.5+co.z/4.18)
  for modifier in print_obj.modifiers:
   if modifier.type=='BEVEL':modifier.material=0
  for direction in [-1,1]:
   vertical=box(label+f' · frame upright {side} {direction}',(0,0,0),(.032,.095,4.244),bronze,sub,.003)
   vertical.parent=parent;vertical.location=(direction*1.406,side*.09,0)
   horizontal=box(label+f' · frame rail {side} {direction}',(0,0,0),(2.78,.095,.032),bronze,sub,.003)
   horizontal.parent=parent;horizontal.location=(0,side*.09,direction*2.106)

world=bpy.data.worlds.new('Soft warm daylight');world.use_nodes=True;scene.world=world
world.node_tree.nodes.get('Background').inputs['Color'].default_value=(*rgb('fff6e7'),1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.65

def light(name,kind,location,target,power,color,size=10):
 data=bpy.data.lights.new(name,kind);obj=bpy.data.objects.new(name,data);lighting.objects.link(obj)
 obj.location=location;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
 data.energy=power;data.color=rgb(color)
 if kind=='SUN':data.angle=math.radians(3)
 if kind=='AREA':data.shape='RECTANGLE';data.size=size;data.size_y=10
 return obj
light('Sun · warm architectural shadows','SUN',convert(24,18,10),convert(-6,-1,-16),2.7,'fff0d5')
for i in range(5):light(f'Window daylight {i+1:02}','AREA',(21.8,-13+i*13,7),(0,-11+i*13,3),5000,'fff6e7',11)
light('Entrance bounce','AREA',(-5,-15,8),(1,0,3),2000,'e8e3d9',12)
# Luminous view beyond the window, invisible to shadow rays so sunlight can enter.
window=bpy.data.materials.new('Window · luminous ivory');window.use_nodes=True
n=window.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');em.inputs['Color'].default_value=(*rgb('fff3d8'),1);em.inputs['Strength'].default_value=.8;window.node_tree.links.new(em.outputs[0],out.inputs[0])
mesh=bpy.data.meshes.new('Daylight backdrop mesh');mesh.from_pydata([(22.5,-22,0),(22.5,46,0),(22.5,46,14),(22.5,-22,14)],[],[(0,1,2,3)]);mesh.update()
o=bpy.data.objects.new('Daylight beyond the windows',mesh);lighting.objects.link(o);o.data.materials.append(window);o.visible_shadow=False

def camera(name,position,target,lens=30,fstop=2.8):
 data=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,data);cameras.objects.link(o);o.location=position
 o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
 data.lens=lens;data.sensor_width=36;data.clip_start=.1;data.clip_end=200
 focus=bpy.data.objects.new(name+' · focus target',None);cameras.objects.link(focus);focus.location=target;focus.empty_display_type='SPHERE';focus.empty_display_size=.15
 data.dof.use_dof=True;data.dof.focus_object=focus;data.dof.aperture_fstop=fstop;data.dof.aperture_blades=8
 return o
p=ART[0]['position'];focal=convert(p['x'],p['y'],p['z'])
pos=convert(HOME['x'],HOME['y'],HOME['z'])
hero=camera('Camera · entrance',pos,(pos[0],pos[1]+10,pos[2]+math.tan(HOME['pitch'])*10),25.05,1.8)
hero.data.dof.focus_object.location=focal;scene.camera=hero
camera('Camera · flower detail',(2.8,-7.8,3.2),focal,50,2)
camera('Camera · room overview',(19,-16,10),(0,15,3.5),26,8)
notes='''ENTRE — Architectural light

This file recreates the current local React/Three.js gallery. There are 20 named
ART parents. Each moves its original packed photograph, front/reverse solid
prints, bronze frame rails, woven screen, and foot as one editable group.
Artwork subjects are images on 3D prints, not sculpted flowers or stones.

All 20 textures are packed. No external downloads or texture paths are required.
Architecture, materials, lights, and cameras are separately editable.
The scrims are shortened slightly to clear the ceiling ribs without overlaps.
Lighting is reconstructed for Cycles; it will not be pixel-identical to WebGL.

Numpad 0: camera view. F12: render. Active camera: entrance.
Other cameras: flower detail and room overview. Move a camera's focus target
or change its F-Stop to adjust depth of field. Ceiling is hidden in the editing
viewport only, and remains enabled for renders.

Final render: Cycles, 1920x1080, 96 samples, denoising. Local preview is lower
resolution. Changing this file does not automatically update the website.

Source layout: scene-data.json beside build_scene.py. To rebuild locally:
blender --background --python blender/build_scene.py -- --preview
The script overwrites entre-gallery.blend; save personal scene edits separately.
Coordinate conversion: Blender (x,y,z) = web (x,-z,y+1.05).
'''
bpy.data.texts.new('START HERE — Gallery notes').write(notes)
scene['artwork_count']=20;scene['source_project']=str(ROOT);scene['design']='Full-height woven screens, bronze frames, warm daylight, honed stone'
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.clip_start=.1;area.spaces.active.clip_end=200
   area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
   area.spaces.active.shading.use_scene_world=True;area.spaces.active.shading.use_scene_lights=True
bpy.ops.object.select_all(action='DESELECT');hero.select_set(True);bpy.context.view_layer.objects.active=hero
scene.render.filepath='//blender/render.png'
bpy.context.preferences.filepaths.save_version=1
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'entre-gallery.blend'))
# Reopen the actual deliverable to validate persistence and packed images.
bpy.ops.wm.open_mainfile(filepath=str(OUT/'entre-gallery.blend'));scene=bpy.context.scene
parents=[o for o in scene.objects if o.name.startswith('ART ') and o.type=='EMPTY']
assert len(parents)==20
assert len([i for i in bpy.data.images if i.packed_file])==20
assert len([o for o in scene.objects if o.type=='CAMERA'])==3
for parent in parents:
 assert len(parent.children)==12,(parent.name,len(parent.children))
 for o in parent.children:
  if 'print' in o.name:
   assert len([p for p in o.data.polygons if p.material_index==1])==2
report={'reopened':True,'artworks':len(parents),'packed_images':20,'cameras':3,'objects':len(scene.objects),'file':str(OUT/'entre-gallery.blend')}
(AUX/'validation.json').write_text(json.dumps(report,indent=2))
if args.preview:
 scene.render.resolution_x=1200;scene.render.resolution_y=675;scene.cycles.samples=32
 scene.render.filepath=str(AUX/'preview.png');bpy.ops.render.render(write_still=True)
print('GALLERY_VERIFIED',json.dumps(report))
