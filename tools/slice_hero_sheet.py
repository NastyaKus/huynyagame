import sys
from PIL import Image; import numpy as np
from collections import deque
src, out = sys.argv[1], sys.argv[2]
img=Image.open(src).convert('RGBA'); im=np.array(img).astype(int)
bg=np.array([39,25,48])
FW,FH=96,152
rows=[(76,242),(246,413),(418,577),(582,739)]   # down,left,right,up
baseline=[229,401,564,727]
cols=[(313,402),(404,494),(496,586),(588,679),(686,790)]
sheet=Image.new('RGBA',(FW*5,FH*4),(0,0,0,0))
def extract(y0,y1,x0,x1):
    cell=im[y0:y1,x0:x1].copy()
    d=np.abs(cell[:,:,:3]-bg).sum(2)
    h,w=d.shape; outside=np.zeros((h,w),bool); q=deque()
    for x in range(w):
        for y in (0,h-1): q.append((y,x))
    for y in range(h):
        for x in (0,w-1): q.append((y,x))
    while q:
        y,x=q.popleft()
        if y<0 or x<0 or y>=h or x>=w or outside[y,x] or d[y,x]>=26: continue
        outside[y,x]=True
        q.extend(((y+1,x),(y-1,x),(y,x+1),(y,x-1)))
    fg=~outside
    # keep only components >40px
    lab=np.zeros((h,w),int); n=0; keep=np.zeros((h,w),bool)
    for sy in range(h):
        for sx in range(w):
            if fg[sy,sx] and not lab[sy,sx]:
                n+=1; comp=[]; q=deque([(sy,sx)]); lab[sy,sx]=n
                while q:
                    y,x=q.popleft(); comp.append((y,x))
                    for ny,nx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
                        if 0<=ny<h and 0<=nx<w and fg[ny,nx] and not lab[ny,nx]:
                            lab[ny,nx]=n; q.append((ny,nx))
                if len(comp)>40:
                    for y,x in comp: keep[y,x]=True
    cell[:,:,3]=np.where(keep,255,0)
    return cell, keep
for r,(y0,y1) in enumerate(rows):
    for c,(x0,x1) in enumerate(cols):
        cell,keep=extract(y0,y1,x0,x1)
        ys,xs=np.nonzero(keep)
        top=ys.min(); head=keep[top:top+45]
        hx=np.nonzero(head)[1]; cx=int(round((hx.min()+hx.max())/2))
        bottom=baseline[r]-y0
        fr=Image.fromarray(cell.astype('uint8'),'RGBA')
        # paste so that cx -> FW/2 and bottom -> FH-6
        ox=FW//2-cx; oy=(FH-6)-bottom
        sx=max(0,-ox); sy=max(0,-oy)
        fr=fr.crop((sx,sy,fr.width,fr.height))
        dx=c*FW+max(0,ox); dy=r*FH+max(0,oy)
        fr=fr.crop((0,0,min(fr.width,(c+1)*FW-dx),min(fr.height,(r+1)*FH-dy)))
        sheet.alpha_composite(fr,(dx,dy))
sheet.save(out+'/hana_sheet.png')
# portraits
boxes=[('neutral',(815,80,1048,388)),('smile',(1063,80,1281,388)),('surprised',(1297,80,1522,388)),
       ('sad',(815,448,985,742)),('angry',(1000,448,1168,742)),('shy',(1182,448,1350,742)),('tired',(1365,448,1524,742))]
PW,PH=300,420
for name,(x0,y0,x1,y1) in boxes:
    crop=img.crop((x0,y0,x1,y1)); w,h=crop.size
    # fit to aspect PW/PH by cropping width
    tw=int(h*PW/PH)
    if tw<w:
        l=(w-tw)//2; crop=crop.crop((l,0,l+tw,h))
    crop=crop.resize((PW,PH),Image.LANCZOS)
    crop.save(f'{out}/portrait_hana_{name}.png')
