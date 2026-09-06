"""Extract the user-provided sticker photographs into die-cut RGBA textures.
Run from the project root; requires Pillow, NumPy, and OpenCV.
The ready-to-use PNGs ship with the project; this is an optional editing utility.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT=Path(__file__).resolve().parent.parent
PHOTO=ROOT.parent/'uploads'/'s-l1200-2.jpg'
OUT=ROOT/'artwork'/'stickers'
QA=ROOT/'qa'/'sticker-extraction'
OUT.mkdir(parents=True,exist_ok=True)
QA.mkdir(parents=True,exist_ok=True)
BOXES={
 'creature':(325,232,638,392),
 'rainbow-melt':(714,55,890,334),
 'vans':(646,339,949,490),
 'toy-machine':(29,491,347,791),
 'spitfire':(414,440,666,754),
 'alien-workshop':(0,824,292,1169),
 'journeys':(307,773,643,1154),
 '187-killer-pads':(643,905,966,1100),
}

def save_texture(name,rgba,add_border=False):
    rgba=Image.fromarray(rgba.astype('uint8'),'RGBA')
    box=rgba.getchannel('A').getbbox()
    if not box:raise ValueError(f'Empty mask: {name}')
    rgba=rgba.crop(box)
    # High-quality interpolation smooths the photographed die-cut edges. This does
    # not purport to recover detail that was absent from the supplied photograph.
    scale=600/max(rgba.size)
    size=tuple(max(1,round(v*scale)) for v in rgba.size)
    rgba=rgba.resize(size,Image.Resampling.LANCZOS)
    rgb=ImageEnhance.Color(rgba.convert('RGB')).enhance(1.07)
    rgb=ImageEnhance.Contrast(rgb).enhance(1.055)
    rgb=rgb.filter(ImageFilter.UnsharpMask(radius=.8,percent=90,threshold=3))
    rgb.putalpha(rgba.getchannel('A'))
    pad=8
    output=Image.new('RGBA',(rgb.width+pad*2,rgb.height+pad*2),(238,235,216,0))
    output.alpha_composite(rgb,(pad,pad))
    output.save(OUT/f'sticker-{name}.png',optimize=True)
    # Two matte colors make subtle masking halos visible during QA.
    preview=Image.new('RGB',output.size,'#394330');preview.paste(output,(0,0),output.getchannel('A'));preview.save(QA/f'{name}-isolated.jpg',quality=92)
    print(name,output.size)

def isolate_peach(crop):
    rgb=np.asarray(crop.convert('RGB')).copy()
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
    # Only peach pixels connected to the OUTSIDE are removed. Warm colors inside
    # the white sticker contour (skin, pink stripes, fire) are deliberately kept.
    bg=((hsv[:,:,0]>=2)&(hsv[:,:,0]<=24)&(hsv[:,:,1]>=55)&(hsv[:,:,1]<=210)&(hsv[:,:,2]>=60)).astype(np.uint8)
    n,labels=cv2.connectedComponents(bg,8)
    exterior=np.unique(np.r_[labels[0,:],labels[-1,:],labels[:,0],labels[:,-1]])
    exterior=exterior[exterior!=0]
    alpha=(~np.isin(labels,exterior)).astype(np.uint8)*255
    n,l,stats,_=cv2.connectedComponentsWithStats(alpha,8)
    largest=1+int(np.argmax(stats[1:,cv2.CC_STAT_AREA]))
    keep=np.zeros(n,dtype=bool);keep[largest]=True
    # Keep tiny, deliberate drips close to the main design, not photo noise.
    x,y,w,h,area=stats[largest]
    for i in range(1,n):
        xx,yy,ww,hh,aa=stats[i]
        if aa>max(16,area*.002) and xx>=x-10 and xx+ww<=x+w+10 and yy>=y-10 and yy+hh<=y+h+12:keep[i]=True
    alpha=(keep[l]*255).astype('uint8')
    # Mask antialiasing only; the printed graphic remains the supplied artwork.
    alpha=cv2.GaussianBlur(alpha,(3,3),.35)
    return np.dstack((rgb,alpha))

def rectangle(image,name,quad,width,height):
    source=np.float32(quad)
    target=np.float32([[0,0],[width-1,0],[width-1,height-1],[0,height-1]])
    warp=cv2.warpPerspective(np.asarray(image),cv2.getPerspectiveTransform(source,target),(width,height),flags=cv2.INTER_CUBIC)
    mask=np.full((height,width),255,np.uint8)
    # A 1 px radius softens corners without changing the printed border.
    mask[0,0]=mask[0,-1]=mask[-1,0]=mask[-1,-1]=100
    save_texture(name,np.dstack((warp,mask)))

if __name__=='__main__':
    image=Image.open(PHOTO).convert('RGB')
    for name,box in BOXES.items():save_texture(name,isolate_peach(image.crop(box)))
    rectangle(image,'pat-duffy',[[116,168],[278,168],[284,447],[120,449]],324,560)
    rectangle(image,'zumiez',[[695,552],[927,534],[946,856],[717,874]],428,600)
