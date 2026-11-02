import sys, os
from PIL import Image, ImageDraw; import numpy as np
from scipy import ndimage
SRC=sys.argv[1]; OUT=sys.argv[2]; os.makedirs(OUT,exist_ok=True)
img=Image.open(SRC).convert('RGBA'); A=np.array(img).astype(int)

def cut(box, tol=30, minsz=25, pad=1, keepfar=False):
    x0,y0,x1,y1=box; c=A[y0:y1,x0:x1].copy(); rgb=c[:,:,:3]
    border=np.concatenate([rgb[0],rgb[-1],rgb[:,0],rgb[:,-1]])
    bg=np.median(border,0)
    d=np.abs(rgb-bg).sum(2)
    near=d<tol
    lab,n=ndimage.label(near)
    edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    outside=np.isin(lab,list(edge))
    fg=~outside
    lab2,n2=ndimage.label(fg)
    objs=ndimage.find_objects(lab2)
    sizes=ndimage.sum(fg,lab2,range(1,n2+1))
    if n2==0: return None
    big=int(np.argmax(sizes))
    by,bx=objs[big]
    keepids=[]
    for i,(sl,sz) in enumerate(zip(objs,sizes)):
        h=sl[0].stop-sl[0].start; w=sl[1].stop-sl[1].start
        if i!=big:
            if sz<minsz or h<=3 or w<=3: continue
            if sl[0].stop<by.start-3 or sl[0].start>by.stop+3 or sl[1].stop<bx.start-3 or sl[1].start>bx.stop+3:
                if not keepfar: continue
        keepids.append(i+1)
    keep=np.isin(lab2,keepids)
    c[:,:,3]=np.where(keep,255,0)
    ys,xs=np.nonzero(keep)
    if len(xs)==0: return None
    return Image.fromarray(c[max(0,ys.min()-pad):ys.max()+1+pad, max(0,xs.min()-pad):xs.max()+1+pad].astype('uint8'),'RGBA')

def softkey(box):
    x0,y0,x1,y1=box; c=A[y0:y1,x0:x1].copy(); rgb=c[:,:,:3]
    border=np.concatenate([rgb[0],rgb[-1],rgb[:,0],rgb[:,-1]]); bg=np.median(border,0)
    d=np.abs(rgb-bg).sum(2)
    c[:,:,3]=np.clip((d-28)*255/50,0,255)
    return Image.fromarray(c.astype('uint8'),'RGBA')
def frame(box): return img.crop(box)

res={}
# companions grids
def grid(name, xs, idle, ys):
    cells=[]
    for r in range(4):
        row=[]
        for c in range(5):
            bx=(xs[c],ys[r],xs[c+1],ys[r+1]) if c<4 else (idle[0],ys[r],idle[1],ys[r+1])
            row.append(cut(bx,tol=38))
        cells.append(row)
    res[name]=cells
grid('ren',[206,245,292,337,383],[400,450],[60,117,182,247,320])
grid('miyu',[981,1020,1067,1112,1158],[1175,1225],[60,117,182,247,320])
for n,b in {'ren_neutral':(474,32,601,158),'ren_smile':(615,32,743,158),'ren_surprised':(474,190,601,316),'ren_angry':(615,190,743,316),
            'miyu_neutral':(1247,32,1380,158),'miyu_smile':(1394,32,1526,158),'miyu_sad':(1247,190,1380,316),'miyu_angry':(1394,190,1526,316)}.items():
    frame(b).save(f'{OUT}/portrait_{n}.png')
npcs=['aoki','fuji','kana','jin','takeda','sota','toru','girl']
cx=[58,152,247,337,432,523,614,712]
for i,n in enumerate(npcs):
    s=cut((cx[i]-42,391,cx[i]+42,471),tol=40)
    s.save(f'{OUT}/npc_{n}.png')
px=[22,116,210,304,398,492,586,678]
for i,n in enumerate(npcs):
    frame((px[i]+2,517,px[i]+84,595)).save(f'{OUT}/portrait_{n}.png')
for n,b in {'swarm':(796,400,886,545),'thread':(882,395,972,545),'doll':(972,400,1062,545),'eye':(1062,400,1150,545),'crystal':(1150,400,1240,545),'boss':(1252,371,1520,565)}.items():
    s=softkey(b) if n=='boss' else None
    s=s or cut(b,tol=(48 if n=='boss' else 30),minsz=(30 if n=='boss' else 40),keepfar=(n=='boss')); s.save(f'{OUT}/enemy_{n}.png')
icx=[42,94,149,204,258,313,372]; icy=[886,936,986]
k=0
for y in icy:
    for x in icx:
        s=cut((x-26,y-26,x+26,y+26),tol=30,minsz=10); s.save(f'{OUT}/icon_{k:02d}.png'); k+=1
efx=[468,563,653,743,843,945]; names=['slash','heal','fire','ice','elec','dark']
for i,n in enumerate(names):
    cut((efx[i]-50,888,efx[i]+50,962),tol=30,minsz=6,keepfar=True).save(f'{OUT}/fx_{n}.png')
    cut((efx[i]-50,962,efx[i]+50,1010),tol=30,minsz=6,keepfar=True).save(f'{OUT}/fx_{n}_small.png')
for n,b in {'street':(1114,641,1309,722),'alley':(1324,641,1519,722),'rooftop':(1114,743,1309,812),'club':(1324,743,1519,812)}.items():
    frame(b).save(f'{OUT}/bgsrc_{n}.png')
for n,b in {'apartment':(18,640,226,772),'street':(242,640,420,772),'konbini':(433,640,596,772),'alley':(610,640,752,772),'rooftop':(768,640,924,772),'club':(937,640,1090,772)}.items():
    frame(b).save(f'{OUT}/tileref_{n}.png')
# sheets for companions
import pickle
FW,FH=96,152
for name,cells in res.items():
    sheet=Image.new('RGBA',(FW*5,FH*4),(0,0,0,0))
    for r,row in enumerate(cells):
        hs=[c.height for c in row]
        for c,s in enumerate(row):
            sc=2.4
            s2=s.resize((round(s.width*sc),round(s.height*sc)),Image.NEAREST)
            dx=c*FW+(FW-s2.width)//2; dy=r*FH+(FH-6)-s2.height
            sheet.alpha_composite(s2,(max(c*FW,dx),max(r*FH,dy)))
    sheet.save(f'{OUT}/{name}_sheet.png')
    print(name,[[ (s.width,s.height) for s in row] for row in cells])
