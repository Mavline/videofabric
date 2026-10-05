#!/usr/bin/env python3
"""Faithful source-instrument adaptation for 18 s Blender proof.
Reads event timing exported from proof_score.js. Original instrument formulas
ported from supplied music.js; NumPy/SciPy rendering replaces WebAudio only.
"""
from pathlib import Path
import re,json,subprocess,numpy as np
from scipy.signal import butter,sosfilt
from scipy.io import wavfile
ROOT=Path(__file__).resolve().parent; S=48000; TAU=2*np.pi
R=np.random.default_rng(20261004);mix=np.zeros((18*S,2));cache={}
def tim(d):return np.arange(max(1,round(d*S)))/S
def hz(n):
 if isinstance(n,(int,float)):return n
 m=re.match(r'([A-G])([b#]?)(-?\d)',n); semi={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[m[1]]+(1 if m[2]=='#' else -1 if m[2]=='b' else 0)
 return 440*2**((12*(int(m[3])+1)+semi-69)/12)
def filt(y,f,kind='lowpass'):return sosfilt(butter(2,f,kind,fs=S,output='sos'),y)
def env(t,amp,att,dec):return np.where(t<att,t/att,np.exp(np.log(1e-5/max(amp,1e-4))*np.maximum(t-att,0)/dec))*amp
def put(at,y,v=1,pan=0,music=False):
 if music and 6.15<=at<12:y=filt(y,1500)
 i=round(at*S);n=min(len(y),len(mix)-i)
 if n<=0:return
 p=(pan+1)*np.pi/4;mix[i:i+n,0]+=y[:n]*v*np.cos(p);mix[i:i+n,1]+=y[:n]*v*np.sin(p)
def pluck(note,dec=None,bright=.45):
 f=hz(note);dec=dec or min(1.1,max(.2,.9*(110/f)**.6));key=(note,dec,bright)
 if key in cache:return cache[key]
 n=round((dec+.05)*S);y=np.zeros(n);exc=int(np.ceil(S/f));rho=10**(-3/(dec*f));lp=0;delay=S/f-.5
 for i in range(n):
  v=0.
  if i<exc:lp+=bright*(R.uniform(-1,1)-lp);v=lp
  d=i-delay
  if d>=1:
   j=int(d);a=d-j;v+=rho*.5*(y[j]+(y[j+1]-y[j])*a+y[j-1]+(y[j]-y[j-1])*a)
  y[i]=v
 y/=max(1e-9,np.max(np.abs(y)));q=min(len(y),int(.03*S));y[-q:]*=np.linspace(1,0,q)
 y=filt(y,min(10000,f*12));cache[key]=y;return y

def xylo(note,v):
 f=hz(note);dec=min(.9,max(.22,.6*np.sqrt(700/f)));t=tim(dec+.05);y=np.zeros(len(t))
 for k,a,d in [(1,1,1),(3,.3,.35),(6.27,.09,.12)]:
  if f*k<15000:y+=np.sin(TAU*f*k*t)*env(t,v*.7*a,.001,dec*d)
 y+=filt(R.normal(size=len(t)),(min(12000,f*2.8),min(18000,f*4.2)),'bandpass')*env(t,v*.35,.0004,.006)
 return y*.6

def noise(d,f=2000,band=True):
 t=tim(d);y=R.uniform(-1,1,len(t));return filt(y,(max(40,f*.6),min(20000,f*1.4)),'bandpass') if band else filt(y,f)
def metal(parts,v):
 t=tim(max(p[2] for p in parts)+.02);return sum(np.sin(TAU*f*t)*env(t,v*a,.0006,d) for f,a,d in parts)*.6*.62
BIKE=[(2600,1,.35),(2622,.7,.33),(5900,.45,.24),(5941,.3,.22),(7300,.3,.16)]
REG=[(2100,1,.6),(2113,.6,.55),(5300,.5,.35),(5327,.3,.3)]
def tone(d,f0,f1,v):
 t=tim(d);freq=f0*(f1/f0)**np.minimum(1,t/d);p=TAU*np.cumsum(freq)/S;return np.sin(p)*env(t,v,.002,d-.002)*.62
def clink(f,v):
 t=tim(.10);return np.sin(TAU*f*t+1.6*np.sin(TAU*f*1.47*t)*np.exp(-t/.015))*env(t,v*.7,.0006,.08)*.62

def render(e):
 typ=e['type'];a=e['args'];at=a[0]
 if typ in ('bass','pizz'):
  _,n,v,*op=a;o=op[0] if op else {};put(at,pluck(n,o.get('dec'),o.get('bright',.45)),v*(.3 if typ=='bass' else .6),o.get('pan',0),not o.get('open',False))
 elif typ=='pah':
  _,notes,v,*op=a;o=op[0] if op else {}
  for i,n in enumerate(notes):put(at,pluck(n,o.get('dec',.35)),v*1.5*.26,[-.3,.1,.35,-.12][i%4],True)
 elif typ=='xylo':put(at,xylo(a[1],a[2]),1,.05,True)
 elif typ=='clar':
  phrase,end,v,*op=a;o=op[0] if op else {};at=phrase[0][0];rel=o.get('rel',.07);t=tim(end-at+rel);f=np.full(len(t),hz(phrase[0][1]));base=f[0]
  for i,pt in enumerate(phrase[1:],1):
   ta=pt[0]-at;d=pt[2] if len(pt)>2 else .004;frac=np.clip((t-ta)/d,0,1);ff=hz(phrase[i-1][1])*(hz(pt[1])/hz(phrase[i-1][1]))**frac;f=np.where(t>=ta,ff,f)
  f*=1+o.get('vib',.005)*np.clip((t-.15)/.30,0,1)*np.sin(TAU*o.get('rate',5)*t);p=TAU*np.cumsum(f)/S
  y=sum((k**-1.5 if k%2 else .04/k)*np.sin(k*p) for k in range(1,32));y=filt(y,min(3600,max(900,base*4)))
  en=np.interp(t,[0,o.get('att',.025),end-at,end-at+rel],[0,v*.4,v*.4*.9,0]);put(at,y*en*.5,1,o.get('pan',0),True)
 elif typ=='cym':
  _,v,d,*op=a;o=op[0] if op else {};t=tim(d+.05);put(at,filt(R.normal(size=len(t)),4500,'highpass')*env(t,v,.006,d)*.8,1,.3,True)
 elif typ=='bike':put(at,metal(BIKE,a[1]),1,-.15)
 elif typ=='tone':put(at,tone(a[1],a[2],a[3],a[4]))
 elif typ=='clink':put(at,clink(a[1],a[2]),1,a[3])
 elif typ=='tock':
  _,v,f=a;t=tim(.09);put(at,(np.sin(TAU*f*t)+.20*np.sin(TAU*f*1.42*t))*env(t,v,.0007,.035)*.8)
 elif typ=='skid':
  t=tim(.27);freq=2500*(700/2500)**np.minimum(1,t/.25);y=noise(.27,1500);yy=np.sin(TAU*np.cumsum(freq)/S)*y
  put(at,yy*(.7+.3*np.sin(TAU*30*t))*np.sin(np.pi*t/.27)*a[1]*1.8)
 elif typ=='zip':
  t=tim(.13);put(at,noise(.13,2000)*(.7+.3*np.sin(TAU*t/.012))*env(t,a[1],.002,.12)*.8,1,-.2)
 elif typ=='snatch':
  t=tim(.08);put(at,filt(R.normal(size=len(t)),1800,'highpass')*env(t,.25,.004,.075)*.62);put(at,pluck('C5',bright=.7),.4*.6,.15)
 elif typ=='kaching':
  put(at,metal(REG,a[1]),1,.2);t=tim(.06);put(at,noise(.06,3200)*env(t,a[1]*.7,.0008,.055)*.62,1,.2);put(at,tone(.05,110,100,a[1]*.9))
 elif typ=='chomp':
  t=tim(.05);put(at,noise(.05,2450)*env(t,a[1],.0008,.049)*2);put(at,tone(.09,140,80,a[1]*.9))
 elif typ=='squelch':
  t=tim(.06);put(at,noise(.06,400,False)*env(t,a[1],.006,.054)*1.5,1,.1)
 else:raise Exception(typ)
conf=json.loads((ROOT/'faithful_audio_source/events.json').read_text())
for e in conf['events']:render(e)
# Low-level, stereo short room and longer dark return like the source band.
room=mix.copy()
for d,g in [(.027,.10),(.073,.065),(.131,.045),(.271,.025),(.419,.015)]:
 k=int(d*S);s=mix[:-k,::-1];room[k:]+=np.column_stack([filt(s[:,0],4400),filt(s[:,1],4400)])*g
room[:400]*=np.linspace(0,1,400)[:,None];room[-int(.25*S):]*=np.linspace(1,0,int(.25*S))[:,None]
wavfile.write(ROOT/'faithful_score_premaster.wav',S,room.astype(np.float32))
subprocess.run(['ffmpeg','-v','error','-y','-i',str(ROOT/'faithful_score_premaster.wav'),'-af','highpass=f=26,bass=g=-4:f=140,equalizer=f=3000:t=q:w=0.7:g=5,treble=g=3:f=8000,acompressor=threshold=0.125:ratio=2:attack=6:release=200,alimiter=limit=0.66:level=0,loudnorm=I=-18.5:TP=-2.5:LRA=8','-ar','48000','-c:a','pcm_s24le',str(ROOT/'faithful_score.wav')],check=True)
(ROOT/'faithful_score_timing.json').write_text(json.dumps(conf,indent=2));print(ROOT/'faithful_score.wav')
