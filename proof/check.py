import json,urllib.request,sys
P={'scooter':'custom_1793329303348','ebike':'custom_1793329310347'}
R={'R1 Fenway→Back Bay':((-71.0915,42.3466),(-71.0776,42.3505)),
   'R2 Fenway→Central Sq':((-71.0915,42.3466),(-71.1037,42.3656)),
   'R3 Coolidge→Nubian':((-71.1215,42.3420),(-71.0838,42.3294)),
   'R4 Esplanade-adjacent Back Bay→MGH':((-71.0896,42.3511),(-71.0700,42.3620))}
BAD_SCOOT={'path','footway','cycleway','pedestrian','track','bridleway','steps'}
out={}
for mode,pid in P.items():
  for name,(a,b) in R.items():
    u=f"https://brouter.de/brouter?lonlats={a[0]},{a[1]}|{b[0]},{b[1]}&profile={pid}&alternativeidx=0&format=geojson&timode=2"
    d=json.load(urllib.request.urlopen(u,timeout=40))
    f=d['features'][0];p=f['properties'];msgs=p['messages'][1:]
    against=[];paths=[];foot=[];contra=[]
    for m in msgs:
      t=dict(x.split('=',1) for x in m[9].split() if '=' in x)
      hw=t.get('highway','');rev=t.get('reversedirection')=='yes'
      ow=t.get('oneway','')
      wrong=(rev and ow in('yes','true','1')) or (not rev and ow=='-1')
      if wrong: (contra if (t.get('oneway:bicycle')=='no' or 'opposite' in m[9] or ':oneway=-1' in m[9] or ':oneway=no' in m[9]) else against).append(m[9])
      if hw in BAD_SCOOT: paths.append(hw+' '+m[9][:60])
      if hw=='footway' and t.get('bicycle') not in('yes','designated'): foot.append(m[9])
    r=dict(length_m=int(p['track-length']),time_s=int(p['total-time']),against_flow_untagged=len(against),contraflow_tagged=len(contra),path_like_segments=len(paths),footway_no_bike=len(foot),path_examples=paths[:3],against_examples=against[:2])
    out[f'{mode} | {name}']=r
    json.dump(d,open(f"{mode}_{name.split()[0]}.geojson",'w'))
    print(mode,name,{k:v for k,v in r.items() if 'examples' not in k}, r['path_examples'][:2], r['against_examples'][:1])
json.dump(out,open('summary.json','w'),indent=1)
