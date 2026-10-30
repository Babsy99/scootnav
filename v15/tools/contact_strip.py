from PIL import Image,ImageDraw,ImageFont
import os
os.chdir('/workspace/scootnav-app/shots/v15')
L=[('09-style-dark','Dark'),('09-style-light','Light (Positron)'),('09-style-satellite','Satellite (Esri)'),
('10-arrow-S','Arrow S'),('10-arrow-M','Arrow M'),('10-arrow-L','Arrow L'),('10-arrow-XL','Arrow XL'),
('11-text-normal','Text Normal'),('11-text-large','Text Large'),('11-text-xl','Text XL'),
('12-settings-before-reload','Settings before reload'),('13-settings-after-reload','Settings after reload'),
('06-saved-first-bare-number','Saved place first'),('02-gmh-not-set','Get Me Home: not set')]
W,H=300,650;HD=34;cols=7
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',17)
out=Image.new('RGB',(cols*W+(cols+1)*8,2*(H+HD)+3*8),(30,30,30));d=ImageDraw.Draw(out)
for i,(n,t) in enumerate(L):
  im=Image.open(n+'.png').convert('RGB').resize((W,H),Image.LANCZOS)
  x=8+(i%cols)*(W+8);y=8+(i//cols)*(H+HD+8)
  d.text((x+4,y+7),t,fill=(255,255,255),font=f);out.paste(im,(x,y+HD))
out.save('v15-contact-strip.jpg',quality=85,optimize=True)
print(out.size,os.path.getsize('v15-contact-strip.jpg'))
