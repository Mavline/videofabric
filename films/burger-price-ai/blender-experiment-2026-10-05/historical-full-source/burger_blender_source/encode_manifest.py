"""Assemble the exact 24-fps timeline using explicit canonical mappings."""
import argparse,json,subprocess,os
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--manifest',type=Path,required=True);p.add_argument('--frames',type=Path,required=True);p.add_argument('--audio',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--original-dip',action='store_true');a=p.parse_args()
m=json.loads(a.manifest.read_text());dest=a.frames/'master_sequence';dest.mkdir(exist_ok=True)
missing=[f for f in m['canonical_render_frames'] if not(a.frames/f'frame_{f:06d}.png').exists()]
assert not missing,{'missing_canonical_frames':missing}
for i,row in enumerate(m['timeline'],1):
 src=a.frames/f"frame_{row['canonical_frame']:06d}.png";target=dest/f'frame_{i:06d}.png'
 if target.exists():target.unlink()
 os.link(src,target)
fps=m['timing']['master_fps'];duration=len(m['timeline'])/fps
vf="scale=in_range=full:out_range=tv:out_color_matrix=bt709"
if a.original_dip:vf="fade=t=out:st=45.875:d=0.75:enable='between(t,45.875,47)',fade=t=in:st=47:d=0.375:enable='between(t,47,47.375)',"+vf
filters=['-vf',vf]
subprocess.run(['ffmpeg','-v','error','-xerror','-y','-framerate',str(fps),'-i',str(dest/'frame_%06d.png'),'-i',str(a.audio)]+filters+['-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-color_range','tv','-c:a','aac','-b:a','192k','-movflags','+faststart','-t',str(duration),str(a.output)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size','-show_entries','stream=codec_name,width,height,avg_frame_rate,nb_frames','-of','json',str(a.output)]))
assert abs(float(probe['format']['duration'])-duration)<.001
assert int(next(s['nb_frames'] for s in probe['streams'] if s['codec_name']=='h264'))==len(m['timeline'])
a.output.with_suffix('.validation.json').write_text(json.dumps({'expected_duration':duration,'master_frames':len(m['timeline']),'canonical_frames':len(m['canonical_render_frames']),'probe':probe},indent=2));print(json.dumps(probe,indent=2))
