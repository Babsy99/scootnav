# ScootNav route-legality proof. Usage: BRH=<brouter base> python3 check.py <scooter_id> <ebike_id>
# Coordinates in the saved geojson are rounded to 5 decimals (~1 m) to keep proof files small and free of stray digit runs.
import json,urllib.request,sys,os,math
H=os.environ.get('BRH','https://brouter.de/brouter')
P={'scooter':sys.argv[1],'ebike':sys.argv[2]} if len(sys.argv)>2 else {'scooter':'custom_1793395612683','ebike':'custom_1793395613689'}
R={'R1 Fenway→Back Bay':((-71.0915,42.3466),(-71.0776,42.3505)),
   'R2 Fenway→Central Sq':((-71.0915,42.3466),(-71.1037,42.3656)),
   'R3 Coolidge→Nubian':((-71.1215,42.3420),(-71.0838,42.3294)),
   'R4 Esplanade-adjacent Back Bay→MGH':((-71.0896,42.3511),(-71.0700,42.3620)),
   'R5 South End→Jackson Sq':((-71.0833,42.3416),(-71.0991,42.3235)),
   'CommAve BU→Kenmore':((-71.1170,42.3501),(-71.0990,42.3490)),
   'V14 Kenmore→Alley937 drop-off':((-71.0951,42.3489),(-71.0962,42.34455))}
# Private Alley 937, OSM way 618227766 (highway=service, service=alley, no access tag)
WAY=[(42.3441723,-71.0976347),(42.3441951,-71.097553),(42.3443975,-71.0967815),(42.3444204,-71.0967009),(42.3445032,-71.0963713),(42.3444607,-71.0963232),(42.3446759,-71.0955275),(42.3447065,-71.0954707),(42.3447522,-71.0954619),(42.3448111,-71.0954835),(42.3448517,-71.0955039),(42.3450399,-71.0956003),(42.3450599,-71.0956094),(42.3451529,-71.0956594)]
def segd(p,a,b):
  k=math.cos(math.radians(p[0]));ax,ay,bx,by,px,py=a[1]*k,a[0],b[1]*k,b[0],p[1]*k,p[0];dx,dy=bx-ax,by-ay
  t=max(0,min(1,((px-ax)*dx+(py-ay)*dy)/((dx*dx+dy*dy) or 1e-12)));return math.hypot(px-(ax+t*dx),py-(ay+t*dy))*111320
def onway(p):return min(segd(p,WAY[i],WAY[i+1]) for i in range(len(WAY)-1))
BAD_SCOOT={'path','footway','cycleway','pedestrian','track','bridleway','steps'}
def rnd(d):
  f=d['features'][0]
  f['geometry']['coordinates']=[[round(c[0],5),round(c[1],5)]+c[2:] for c in f['geometry']['coordinates']]
  for m in f['properties'].get('messages',[])[1:]:
    m[0]=str(round(int(m[0]),-1));m[1]=str(round(int(m[1]),-1))
  return d
out={'engine':H.replace('http://localhost:17777','local BRouter 1.7.10 (OSM segments W75_N40)'),'profiles':P}
for mode,pid in P.items():
  for name,(a,b) in R.items():
    u=f"{H}?lonlats={a[0]},{a[1]}|{b[0]},{b[1]}&profile={pid}&alternativeidx=0&format=geojson&timode=2"
    for _t in range(6):
        try: d=json.load(urllib.request.urlopen(u,timeout=60)); break
        except Exception as e:
            if _t==5: print('FAILED',u,getattr(e,'read',lambda:b'')()[:200]); raise
            __import__('time').sleep(6)
    f=d['features'][0];p=f['properties'];msgs=p['messages'][1:]
    against=[];paths=[];foot=[];contra=[];priv=[];alley=[]
    for m in msgs:
      t=dict(x.split('=',1) for x in m[9].split() if '=' in x)
      hw=t.get('highway','');rev=t.get('reversedirection')=='yes'
      ow=t.get('oneway','')
      wrong=(rev and ow in('yes','true','1')) or (not rev and ow=='-1')
      if wrong: (contra if (t.get('oneway:bicycle')=='no' or 'opposite' in m[9] or ':oneway=-1' in m[9] or ':oneway=no' in m[9]) else against).append(m[9])
      if hw in BAD_SCOOT: paths.append(hw+' '+m[9][:60])
      if hw=='footway' and t.get('bicycle') not in('yes','designated'): foot.append(m[9])
      if t.get('access') in('private','no') or t.get('vehicle') in('private','no') or t.get('bicycle') in('private','no'): priv.append(m[9])
      if t.get('service')=='alley': alley.append(m[9])
    c=f['geometry']['coordinates']
    w937=sum(1 for i in range(len(c)-1) if onway(((c[i][1]+c[i+1][1])/2,(c[i][0]+c[i+1][0])/2))<2.0)
    r=dict(length_m=int(p['track-length']),time_s=int(p['total-time']),against_flow_untagged=len(against),contraflow_tagged=len(contra),path_like_segments=len(paths),footway_no_bike=len(foot),private_segments=len(priv),alley_segments=len(alley),segments_on_way_618227766=w937,path_examples=paths[:3],against_examples=against[:2])
    out[f'{mode} | {name}']=r
    json.dump(rnd(d),open(f"{mode}_{name.split()[0]}.geojson",'w'))
    print(mode,name,{k:v for k,v in r.items() if 'examples' not in k}, r['path_examples'][:2], r['against_examples'][:1])
json.dump(out,open('summary.json','w'),indent=1,ensure_ascii=False)
