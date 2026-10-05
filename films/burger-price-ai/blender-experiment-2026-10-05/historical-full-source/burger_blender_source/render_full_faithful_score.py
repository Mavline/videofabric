#!/usr/bin/env python3
"""Render the 110 s source-faithful score with an immutable 18 s PCM opening.
Requires render_faithful_score.py, full_score_timing.json, faithful_score.wav,
NumPy, SciPy and ffmpeg. Foley timing follows the final 18-scene cue sheet.
"""
from pathlib import Path
import argparse, json, hashlib, wave, subprocess
import numpy as np
BASE=Path(__file__).resolve().parent
# Load the already delivered synth definitions, without executing its renderer.
exec((BASE/'render_faithful_score.py').read_text().split('conf=json.loads')[0],globals())
from scipy.signal import sawtooth
orig_render=render
mix=np.zeros((110*S,2),dtype=np.float64)


def put(at,y,v=1,pan=0,music=False):
    if music and (34<=at<41 or 65<=at<81):y=filt(y,1500)
    if music:
        if 47<=at<65:v*=.80
        elif 65<=at<81:v*=.84
        elif 98<=at<110:v*=.66
    i=round(at*S);n=min(len(y),len(mix)-i)
    if n<=0:return
    p=(pan+1)*np.pi/4;mix[i:i+n,0]+=y[:n]*v*np.cos(p);mix[i:i+n,1]+=y[:n]*v*np.sin(p)

def softedge(y,attack=.004,release=.02):
    y=y.copy();a=min(len(y)//2,round(attack*S));r=min(len(y)//2,round(release*S))
    if a:y[:a]*=np.linspace(0,1,a)
    if r:y[-r:]*=np.linspace(1,0,r)
    return y

def sweepnoise(d,f0,f1):
    t=tim(d);raw=R.uniform(-1,1,len(t));a=filt(raw,(max(40,f0*.55),min(19000,f0*1.6)),'bandpass');b=filt(raw,(max(40,f1*.55),min(19000,f1*1.6)),'bandpass');u=t/d
    return a*(1-u)+b*u

def ks_glide(note,target,glide,dec=.5,bright=.45):
    f0=hz(note);f1=hz(target);t=tim(dec+.05);y=np.zeros(len(t));exc=int(np.ceil(S/f0));lp=0
    for i,tt in enumerate(t):
        f=f0*(f1/f0)**min(1,tt/glide);rho=10**(-3/(dec*f));v=0
        if i<exc:lp+=bright*(R.uniform(-1,1)-lp);v=lp
        d=i-(S/f-.5)
        if d>=1:
            j=int(d);a=d-j;v+=rho*.5*(y[j]+(y[j+1]-y[j])*a+y[j-1]+(y[j]-y[j-1])*a)
        y[i]=v
    y/=max(1e-9,abs(y).max());return softedge(filt(y,min(10000,max(f0,f1)*12)),0,.03)

def fullclar(a):
    phrase,end,v,*op=a;o=op[0] if op else {};at=phrase[0][0];rel=o.get('rel',.07);t=tim(end-at+rel);f=np.full(len(t),hz(phrase[0][1]));base=f[0]
    for i,pt in enumerate(phrase[1:],1):
        ta=pt[0]-at;d=pt[2] if len(pt)>2 else .004;frac=np.clip((t-ta)/d,0,1);ff=hz(phrase[i-1][1])*(hz(pt[1])/hz(phrase[i-1][1]))**frac;f=np.where(t>=ta,ff,f)
    f*=1+o.get('vib',.005)*np.clip((t-.15)/.30,0,1)*np.sin(TAU*o.get('rate',5)*t);p=TAU*np.cumsum(f)/S
    if o.get('wave')=='brassSaw':y=sum(k**-1.05*np.sin(k*p) for k in range(1,24))*.65
    else:y=sum((k**-1.5 if k%2 else .04/k)*np.sin(k*p) for k in range(1,32))
    y=filt(y,o.get('cut',min(3600,max(900,base*4))))
    if o.get('breath',.06):y+=sweepnoise(len(t)/S,min(5000,base*5),min(5000,base*5))*o.get('breath',.06)
    en=np.interp(t,[0,o.get('att',.025),end-at,end-at+rel],[0,v*.4,v*.4*o.get('sus',.9),0])
    for pt in phrase[1:]:
        if len(pt)<3:
            ta=pt[0]-at;gate=1-.6*np.maximum(0,1-abs(t-ta)/.02);en*=gate
    put(at,y*en*.5,1,o.get('pan',0),True)

def render_event(e):
    kind=e['type'];a=e['args'];at=e['time']
    if kind=='clar':fullclar(a);return
    if kind=='pizz' and len(a)>3 and a[3].get('glide'):
        o=a[3];put(at,ks_glide(a[1],o['glide'][0],o['glide'][1],o.get('dec',.5),o.get('bright',.45)),a[2]*.6,o.get('pan',0),True);return
    if kind=='skid' and len(a)>2 and a[2]:
        t=tim(.27);put(at,sweepnoise(.27,1150,450)*(.7+.3*np.sin(TAU*30*t))*np.sin(np.pi*t/.27)*a[1]);return
    if kind=='tock':
        _,v,f,*op=a;o=op[0] if op else {};t=tim(.09);put(at,(np.sin(TAU*f*t)+.20*np.sin(TAU*f*1.42*t))*env(t,v,.0007,.035)*.8,1,o.get('pan',0));return
    supported={'pizz','bass','pah','xylo','clar','cym','bike','tone','clink','tock','skid','zip','snatch','kaching','chomp','squelch'}
    if kind in supported:orig_render(e);return
    if kind=='freewheel':
        t=tim(.006);put(at,filt(R.normal(size=len(t)),6000,'highpass')*env(t,a[1],.0003,.002)*.62,1,a[2])
    elif kind=='scribble':
        _,d,f0,f1,v=a;t=tim(d);y=sweepnoise(d,(f0+f1)/2,(f0+f1)/2);put(at,y*(.25+.75*np.maximum(0,np.sin(TAU*52*t)))*env(t,v,.002,d)*.62,1,.15)
    elif kind=='gulp':
        t=tim(.15);p=TAU*np.cumsum(300*(120/300)**np.minimum(1,t/.12)*(1+.12*np.sin(TAU*25*t)))/S
        put(at,np.sin(p)*env(t,a[1],.003,.145)*.62)
    elif kind=='fountain':
        t=tim(.24);amp=np.interp(t,[0,.004,.06,.22,.24],[0,a[1],a[1]*.6,0,0]);put(at,sweepnoise(.24,4000,3300)*amp*.62,.8,.2)
    elif kind=='sniff':
        for j in range(2):
            t=tim(.06);put(at+j*.09,sweepnoise(.06,1600+j*600,2600+j*600)*env(t,a[1],.004,.055)*.62,1,.1)
    elif kind=='snare':
        t=tim(.07);put(at,sweepnoise(.07,3200,3200)*env(t,a[1],.0008,.04)*.62)
    elif kind=='swhistle':
        _,d,f0,f1,v=a;t=tim(d+.03);freq=f0*(f1/f0)**np.minimum(1,t/d);p=TAU*np.cumsum(freq)/S;en=np.interp(t,[0,.008,d-.02,d+.03],[0,v,v*.9,0]);put(at,(np.sin(p)+.12*np.sin(2*p))*en*.62)
    elif kind=='boing':
        t=tim(.55);freq=220+(88*(30/88)**np.minimum(1,t/.5))*np.sin(TAU*12*t);p=TAU*np.cumsum(freq)/S;y=filt(.6*np.sin(p)+.6*sawtooth(p),3500);put(at,y*env(t,a[1],.003,.5)*.62)
    elif kind=='subDrop':
        _,f0,f1,d,v=a;put(at,tone(d,f0,f1,v))
    elif kind=='hum':
        _,end,v=a;d=end-at;t=tim(d);p=TAU*np.cumsum(55+1.2*np.sin(TAU*2*t))/S;y=filt(sawtooth(p),300)*(1+.25*np.sin(TAU*2*t));en=np.interp(t,[0,.15,d-.15,d],[0,v,v,0]);put(at,y*en*.5)
    elif kind=='rustle':
        _,d,v=a;t=tim(d);y=sweepnoise(d,3000,3300);flutter=(.2+.8*np.maximum(0,np.sin(TAU*110*t)))*(.5+.5*np.sin(TAU*13.7*t)**2);put(at,softedge(y*flutter*v*.20,.03,.08),1,.12)
    elif kind=='gobble':
        t=tim(.012);put(at,filt(R.normal(size=len(t)),2500,'highpass')*env(t,a[1]*.7,.0003,.004)*.62);put(at,tone(.14,120,80,a[1]));put(at+.07,tone(.10,90,60,a[1]*.6))
    elif kind=='squeak':
        _,d,v=a;t=tim(d);f=300*3**(t/d)*(1+.025*np.sin(TAU*41*t));p=TAU*np.cumsum(f)/S;y=.45*np.sin(3*p)+.14*np.sin(4*p);en=np.interp(t,[0,.006,d*.7,d],[0,v,v*.8,0]);put(at,y*en*.62)
    elif kind=='whirr':
        _,d,v=a;t=tim(d);put(at,softedge(sweepnoise(d,600,900)*(.675+.325*np.sin(TAU*40*t))*v*.62,.004,.03))
    elif kind=='clunk':
        put(at,tone(.06,150,140,a[1]));t=tim(.012);put(at,filt(R.normal(size=len(t)),2200,'highpass')*env(t,a[1]*.7,.0003,.004)*.62)
    elif kind=='ratchet':
        _,f,v=a;t=tim(.02);put(at,sweepnoise(.02,f,f)*env(t,v,.0004,.01)*.62,1,.2)
    elif kind=='fmBell':
        _,f,v,*op=a;o=op[0] if op else {};d=o.get('dec',.6);t=tim(d+.03);phase=TAU*f*t+o.get('index',1.5)*np.sin(TAU*f*o.get('ratio',1.41)*t)*np.exp(-t/(d*.12));put(at,np.sin(phase)*env(t,v,.0006,d)*.62)
    elif kind=='typeClick':
        t=tim(.005);put(at,filt(R.normal(size=len(t)),3000,'highpass')*env(t,a[1],.0002,.0015)*.62);put(at,tone(.03,1800,1800,a[1]*.3))
    elif kind=='flutter':
        t=tim(.25);y=sweepnoise(.25,1000,3000)*(.2+.8*np.maximum(0,np.sin(TAU*14*t)))*env(t,a[1],.004,.245)*.62;put(at,y,1,.1)
    elif kind=='paperSnap':
        t=tim(.04);put(at,sweepnoise(.04,2800,1600)*env(t,a[1],.0005,.015)*.62,1,.2)
    elif kind=='phone':
        _,d,v=a
        for k,x in enumerate(np.arange(0,d,.025)):
            f=1400 if k%2 else 1100;put(at+x,metal([(f,1,.22),(f*2.76,.25,.07),(f*5.4,.1,.03)],v*(.7 if k else 1)),1,.25)
    elif kind=='sigh':
        t=tim(.72);put(at,sweepnoise(.72,1200,420)*env(t,a[1],.10,.6)*.62)
    elif kind=='key':
        t=tim(.01);put(at,sweepnoise(.01,2500,2500)*env(t,a[1],.0003,.005)*.62,1,-.2);put(at,tone(.04,120,110,a[1]*.5))
    elif kind=='whoosh':
        _,d,v=a;t=tim(d);put(at,filt(R.normal(size=len(t)),1800,'highpass')*env(t,v,.004,d*.4)*.62)
    elif kind=='whip':
        _,v,p=a;t=tim(.014);put(at,filt(R.normal(size=len(t)),3000,'highpass')*env(t,v,.0003,.005)*.62,1,p);t=tim(.14);put(at,sweepnoise(.14,1200,4500)*env(t,v*.5,.006,.12)*.62,1,max(-1,p-.3))
    else:raise ValueError('Unsupported event '+kind)


def resolved_event(event):
    """Treat event.time as the editable cue anchor; shift absolute phrase times too."""
    e=json.loads(json.dumps(event));a=e['args'];kind=e['type']
    old=a[0][0][0] if kind=='clar' else a[0];delta=e['time']-old
    if kind=='clar':
        for pt in a[0]:pt[0]+=delta
        a[1]+=delta
    else:
        a[0]+=delta
        if kind=='hum':a[1]+=delta
    return e


def pcm24_read(path):
    with wave.open(str(path),'rb') as f:
        assert (f.getframerate(),f.getnchannels(),f.getsampwidth())==(48000,2,3)
        return f.readframes(f.getnframes())


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--timing',type=Path,default=BASE/'full_score_timing.json');ap.add_argument('--out',type=Path,default=BASE/'full_faithful_score.wav');a=ap.parse_args()
    conf=json.loads(a.timing.read_text());assert conf['duration']==110
    prefix=BASE/conf['immutable_prefix']['file'];actual=hashlib.sha256(prefix.read_bytes()).hexdigest()
    if actual!=conf['immutable_prefix']['sha256']:raise RuntimeError('Locked opening file changed; update timing hash only after explicit approval')
    for event in conf['events']:
        assert event['time']>=18,'Opening must not be resynthesized'
        render_event(resolved_event(event))
    room=mix.copy()
    for d,g in [(.027,.10),(.073,.065),(.131,.045),(.271,.025),(.419,.015)]:
        k=int(d*S);src=mix[:-k,::-1];room[k:]+=np.column_stack([filt(src[:,0],4400),filt(src[:,1],4400)])*g
    room[-480:]*=np.linspace(1,0,480)[:,None]
    raw=BASE/'full_faithful_tail_premaster.wav';tail=BASE/'full_faithful_tail_master.wav'
    wavfile.write(raw,S,room[18*S:].astype(np.float32))
    # Master only the continuation; the accepted opening never enters any DSP.
    af='highpass=f=26,bass=g=-4:f=140,equalizer=f=3000:t=q:w=0.7:g=5,treble=g=3:f=8000,acompressor=threshold=0.125:ratio=2:attack=6:release=200,alimiter=limit=0.66:level=0,loudnorm=I=-19.0:TP=-3.5:LRA=8'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(raw),'-af',af,'-ar','48000','-c:a','pcm_s24le',str(tail)],check=True)
    prefix_bytes=pcm24_read(prefix);tail_bytes=pcm24_read(tail)
    assert len(prefix_bytes)==18*S*2*3;assert len(tail_bytes)==92*S*2*3
    staged=a.out.with_name(a.out.stem+'.pending.wav')
    with wave.open(str(staged),'wb') as f:
        f.setnchannels(2);f.setsampwidth(3);f.setframerate(S);f.writeframesraw(prefix_bytes);f.writeframesraw(tail_bytes)
    result=pcm24_read(staged);assert result[:len(prefix_bytes)]==prefix_bytes,'Opening PCM mismatch'
    staged.replace(a.out)
    report={'file':str(a.out),'duration':110,'format':'stereo 48kHz/24-bit PCM WAV','opening_pcm_frames':864000,'opening_pcm_sha256':hashlib.sha256(prefix_bytes).hexdigest(),'opening_bit_exact':True,'event_count':len(conf['events']),'status':conf['status'],'mix':'Original motifs and source-instrument Python port; provisional later Foley'}
    a.out.with_suffix('.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))

if __name__=='__main__':main()
