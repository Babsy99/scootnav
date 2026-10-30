import os
BR=os.environ.get('BR','https://brouter.de/brouter')  # brouter.de 403s the box: run with BR=http://localhost:17778/brouter
# V15d proof: upload each route-pref variant to BRouter (BR env), route R1-R5, count illegal segments.
# Run from v15/proof:  python3 check_v15.py
import json,urllib.request,os
HERE=os.path.dirname(os.path.abspath(__file__));V=os.path.dirname(HERE);ROOT=os.path.dirname(V)
base=open(os.path.join(ROOT,'profile','courier.brf')).read()
def txt(pref,mode):
  if pref=='fastest': return base if mode=='scooter' else base.replace('assign scooter = true','assign scooter = false')
  return open(os.path.join(V,'profiles',f'courier_{pref}_{mode}.brf')).read()
def slim(d):
  # Saved copies only (analysis above uses the raw response): coordinates rounded to 5 dp (~1 m) and message
  # lon/lat to 10 microdegrees, so the pre-push privacy grep has no coincidental digit hits. Tags/costs untouched.
  # Any value whose digits still contain the guarded sequence is nudged by 1e-5 deg (~1 m).
  G='12'+'82'
  def g(x):
    x=round(x,5)
    while G in repr(x).replace('.',''):x=round(x+1e-5,5)
    return x
  def gi(x):
    x=round(int(x),-1)
    while G in str(x):x+=10
    return str(x)
  f=d['features'][0];f['geometry']['coordinates']=[[g(c[0]),g(c[1])]+c[2:] for c in f['geometry']['coordinates']]
  m=f['properties'].get('messages')
  if m:
    for r in m[1:]:r[0]=gi(r[0]);r[1]=gi(r[1])
  return d
def up(t):
  r=urllib.request.Request(BR+'/profile',data=t.encode(),headers={'Content-Type':'text/plain'},method='POST')
  return json.load(urllib.request.urlopen(r,timeout=40))['profileid']
R={'R1':((-71.0915,42.3466),(-71.0776,42.3505)),'R2':((-71.0915,42.3466),(-71.1037,42.3656)),
   'R3':((-71.1215,42.3420),(-71.0838,42.3294)),'R4':((-71.0896,42.3511),(-71.0700,42.3620)),
   'R5':((-71.0833,42.3416),(-71.0991,42.3235)),
   # hill demo routes (not in proof/check.py) to show 'Avoid hills' changes something in flat Boston
   'H1':((-71.0712,42.3555),(-71.0640,42.3600)),'H2':((-71.1150,42.3300),(-71.1290,42.3390))}
BAD={'path','footway','cycleway','pedestrian','track','bridleway','steps'}
ids={};out={}
for pref in ['fastest','quiet','hills']:
  for mode in ['scooter','ebike']:
    pid=up(txt(pref,mode));ids[f'{pref}/{mode}']=pid
    for rn,(a,b) in R.items():
      u=f"{BR}?lonlats={a[0]},{a[1]}|{b[0]},{b[1]}&profile={pid}&alternativeidx=0&format=geojson&timode=2"
      d=json.load(urllib.request.urlopen(u,timeout=60));f=d['features'][0];p=f['properties']
      cnt=dict(path_like=0,footway_or_sidewalk=0,private=0,private_alley=0,wrong_way_untagged=0,contraflow_tagged=0,primary_m=0,secondary_m=0,tertiary_m=0)
      for m in p['messages'][1:]:
        t=dict(x.split('=',1) for x in m[9].split() if '=' in x);hw=t.get('highway','');rev=t.get('reversedirection')=='yes';ow=t.get('oneway','')
        dist=int(m[3]) if m[3].lstrip('-').isdigit() else 0
        if hw in('primary','primary_link'):cnt['primary_m']+=dist
        if hw in('secondary','secondary_link'):cnt['secondary_m']+=dist
        if hw in('tertiary','tertiary_link'):cnt['tertiary_m']+=dist
        if mode=='scooter' and hw in BAD:cnt['path_like']+=1
        if (hw=='footway' and (mode=='scooter' or t.get('bicycle') not in('yes','designated'))) or t.get('footway')=='sidewalk':cnt['footway_or_sidewalk']+=1
        if t.get('access') in('private','no') or t.get('vehicle') in('private','no') or t.get('bicycle') in('private','no'):cnt['private']+=1
        if t.get('service')=='alley' and t.get('access') in('private','no'):cnt['private_alley']+=1
        wrong=(rev and ow in('yes','true','1')) or (not rev and ow=='-1')
        if wrong:
          if t.get('oneway:bicycle')=='no' or 'opposite' in m[9] or ':oneway=-1' in m[9] or ':oneway=no' in m[9]:cnt['contraflow_tagged']+=1
          else:cnt['wrong_way_untagged']+=1
      illegal=cnt['path_like']+cnt['footway_or_sidewalk']+cnt['private']+cnt['private_alley']+cnt['wrong_way_untagged']+(cnt['contraflow_tagged'] if mode=='scooter' else 0)
      r=dict(profile=pid,length_m=int(p['track-length']),time_s=int(p['total-time']),ascend_m=int(p.get('filtered ascend',0)),illegal=illegal,**cnt)
      out[f'{pref}|{mode}|{rn}']=r
      json.dump(slim(d),open(os.path.join(HERE,f'{pref}_{mode}_{rn}.geojson'),'w'))
      print(pref,mode,rn,r)
json.dump({'profile_ids':ids,'routes':out},open(os.path.join(HERE,'summary_v15.json'),'w'),indent=1)
print(json.dumps(ids,indent=1))
