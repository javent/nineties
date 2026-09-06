"""Isolate the ten stickers in the supplied s-l1200-3.jpg reference.
Pillow + NumPy + OpenCV; ready-to-use PNG/WebP files ship with the source.
Original imagery is retained. Only the tabletop and its drop shadows are removed.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw

ROOT=Path(__file__).resolve().parent.parent
PHOTO=ROOT.parent/'uploads'/'s-l1200-3.jpg'
OUT=ROOT/'artwork'/'stickers'
PUBLIC=ROOT/'public'/'assets'
QA=ROOT/'qa'/'expansion'
for p in [OUT,PUBLIC,QA]:p.mkdir(parents=True,exist_ok=True)
BOXES={
 'black-label':(49,103,384,329),
 'alien-workshop-spectrum':(386,106,764,315),
 'antihero':(767,121,1188,309),
 'dvs':(5,352,350,515),
 'independent-crossbar':(350,319,771,527),
 'element':(34,520,340,825),
 'krooked':(373,586,799,764),
}
RECTANGLES={
 'plan-b':((789,316,1158,445),13),
 'krux':((736,476,1146,552),11),
 'es':((858,574,1048,824),7),
}

def diecut(crop,name):
    rgb=np.asarray(crop.convert('RGB')).copy()
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
    # The saturated print and dark outline distinguish the stickers from the
    # pale grid background. Fill enclosed white artwork; retain a white keyline.
    ink=((np.min(rgb,axis=2)<115)|((hsv[:,:,1]>100)&(hsv[:,:,2]>65))).astype('uint8')*255
    ink[:3,:]=0;ink[-3:,:]=0;ink[:,:3]=0;ink[:,-3:]=0
    close=7 if name in ['antihero','krooked'] else 3
    ink=cv2.morphologyEx(ink,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(close,close)))
    contours,_=cv2.findContours(ink,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    mask=np.zeros(ink.shape,np.uint8)
    # Most designs have one enclosing dark outline. Krooked is separate lettering
    # printed on one shared die-cut backing, so join the closely spaced lettering.
    if name=='krooked':
        white=(np.min(rgb,axis=2)>229).astype('uint8')*255
        white_contours,_=cv2.findContours(white,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(mask,[max(white_contours,key=cv2.contourArea)],-1,255,cv2.FILLED)
    else:
        cv2.drawContours(mask,[max(contours,key=cv2.contourArea)],-1,255,cv2.FILLED)
    amount={'black-label':7,'alien-workshop-spectrum':7,'antihero':8,'dvs':7,'independent-crossbar':10,'element':8,'krooked':1}[name]
    mask=cv2.dilate(mask,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(amount*2+1,amount*2+1)))
    mask=cv2.GaussianBlur(mask,(3,3),.45)
    return np.dstack([rgb,mask])

def save(name,rgba):
    im=Image.fromarray(rgba.astype('uint8'),'RGBA')
    im=im.crop(im.getchannel('A').getbbox())
    scale=600/max(im.size);im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
    rgb=ImageEnhance.Contrast(im.convert('RGB')).enhance(1.025)
    rgb=rgb.filter(ImageFilter.UnsharpMask(radius=.65,percent=60,threshold=3));rgb.putalpha(im.getchannel('A'))
    final=Image.new('RGBA',(rgb.width+16,rgb.height+16),(240,240,233,0));final.alpha_composite(rgb,(8,8))
    final.save(OUT/f'sticker-{name}.png',optimize=True)
    final.save(PUBLIC/f'sticker-{name}.webp',format='WEBP',quality=94,method=6,exact=True)
    preview=Image.new('RGB',final.size,'#171717');preview.paste(final,(0,0),final.getchannel('A'));preview.save(QA/f'{name}.jpg',quality=94)
    print(name,final.size,(PUBLIC/f'sticker-{name}.webp').stat().st_size)
    return final

if __name__=='__main__':
    image=Image.open(PHOTO).convert('RGB');results={}
    for name,box in BOXES.items():results[name]=save(name,diecut(image.crop(box),name))
    for name,(box,radius) in RECTANGLES.items():
        crop=image.crop(box);mask=Image.new('L',crop.size,0);d=ImageDraw.Draw(mask);d.rounded_rectangle((0,0,crop.width-1,crop.height-1),radius,fill=255)
        results[name]=save(name,np.dstack([np.asarray(crop),np.asarray(mask)]))
    # Internal matte-board check; not a production texture or final deliverable.
    page=Image.new('RGB',(1200,560),'#171717');d=ImageDraw.Draw(page)
    for i,(name,im) in enumerate(results.items()):
        im=im.copy();im.thumbnail((213,226),Image.Resampling.LANCZOS)
        x=(i%5)*240+(240-im.width)//2;y=(i//5)*280+10+(226-im.height)//2
        page.paste(im,(x,y),im.getchannel('A'));d.text(((i%5)*240+12,(i//5)*280+252),name,fill='#c7c7cd')
    page.save(QA/'cutouts.jpg',quality=94)
