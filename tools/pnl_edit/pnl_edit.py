#!/usr/bin/env python3
"""
P&L video editor for Vantage (web) trade-screen screen recordings.

Rewrites the floating P&L (and all coupled fields) across the segment where the
Vantage trade page is in the foreground, so the profit reads a chosen range and
moves naturally, while leaving everything else (chart, prices, DEMO badge,
audio, non-Vantage frames) untouched.

WHAT MADE IT LOOK REAL (hard-won lessons - read before reusing):
  * Font: the Vantage web UI is Inter. Panel numbers = Inter Regular ~12px.
    The chart SELL-pill number is Inter SemiBold but HORIZONTALLY CONDENSED
    (tall but narrow). We render SemiBold then squash width to fit the slot.
  * Colour: the pill text is a MUTED green ~(95,191,146) at ~0.8 opacity, NOT a
    solid saturated green. Matching this tone is what stops it looking "pasted".
  * Pill background is SEMI-TRANSPARENT (chart shows through). Never paint an
    opaque box. Instead inpaint ONLY the old green number pixels (horizontal
    interpolation) and ONLY inside the number slot - do not touch "13.88랏은"
    to its left or it gets clipped / whitened.
  * Movement: real P&L = (entry - ask) * lots * 100, so it only changes in
    multiples of (0.01 * lots * 100) = TICK. We DON'T simulate arbitrary jitter.
    We detect the ORIGINAL's real change TIMES (frame-diff on the number crop)
    and only tick on those frames -> identical rhythm (holds + bursts) to source.
  * Coupled fields recomputed every frame from one pnl value:
        equity        = BALANCE + pnl
        used_margin    (UM) is ~constant, read once
        free_margin   = equity - UM
        margin_level  = equity / UM * 100
        pct           = pnl / UM * 100

NOTE: every pixel coordinate in CONFIG is specific to THIS recording
(1920x1040, that browser zoom, that panel scroll position). For a NEW recording
re-measure them (see measure_helpers below) - the METHOD transfers, the numbers
don't.

Usage:
    python3 pnl_edit.py SOURCE.mp4 OUT.mp4 [--lo 9994 --hi 10355]
"""
import os, sys, glob, shutil, random, argparse, subprocess, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ----------------------------- CONFIG (per-recording) ------------------------
CFG = dict(
    fps=30.0789,                 # avg frame rate of the source
    balance=20047.27,            # account balance (constant; = equity - pnl)
    used_margin=10857.99,        # 여백 사용 / used margin (near-constant)
    tick=13.88,                  # 0.01 * lots(13.88) * 100  -> P&L step size
    # fonts
    inter_regular='/usr/share/fonts/opentype/inter/Inter-Regular.otf',
    inter_semibold='/usr/share/fonts/opentype/inter/Inter-SemiBold.otf',
    panel_size=12, chart_size=12,
    # colours
    green=(34,168,120),          # panel green (on white)
    green_pill=(95,191,146),     # chart pill muted green (matches UI opacity)
    black=(38,40,46),
    # right panel value rows: (clear_x0, baseline_y); all right-anchored at R_X
    R_X=1900,
    eq=(1795,797),               # 유효증거금
    pnl=(1742,828),              # 변동손익 (green, + USD + pct)
    mlvl=(1850,857),             # 마진수준 (green, keep gauge icon to its left)
    free_asset=(1795,977),       # 여유마진 (asset panel, black)
    free_ticket=(1795,669),      # 여유마진 (order ticket, black)
    pos=(1333,933),              # 손익 column (green, left-anchored)
    # chart SELL pill number slot
    chart_x0=617, chart_tw=77, chart_baseline=370,
    chart_inpaint=(613,696,356,377),   # x0,x1,y0,y1 - number slot only
    # detection
    sig_chart=(352,372,600,695),       # green-signature box 1 (chart label)
    sig_panel=(818,830,1760,1900),     # green-signature box 2 (변동손익)
    numcrop=(818,830,1748,1860),       # 변동손익 number crop for change detection
    change_thresh=4.0,
)

def _fonts(c):
    return (ImageFont.truetype(c['inter_regular'], c['panel_size']),
            ImageFont.truetype(c['inter_semibold'], c['chart_size']))

def num(x): return f"{x:,.2f}"

# ----------------------------- core frame editor -----------------------------
def edit_frame(im, pnl, c=CFG):
    fR, fS = _fonts(c)
    d = ImageDraw.Draw(im)
    eq = c['balance'] + pnl
    um = c['used_margin']
    free = eq - um
    mlvl = eq/um*100
    pct = pnl/um*100
    RX = c['R_X']; W=(255,255,255)
    def panel(spot, text, colour):
        x0, yb = spot
        d.rectangle((x0, yb-11, RX+3, yb+1), fill=W)
        d.text((RX, yb), text, font=fR, fill=colour, anchor='rs')
    panel(c['eq'],  f"{num(eq)} USD", c['black'])
    panel(c['pnl'], f"+{num(pnl)} USD ( +{pct:.2f} %)", c['green'])
    panel(c['mlvl'],f"{mlvl:.2f} %", c['green'])           # gauge icon preserved (clear starts right of it)
    panel(c['free_asset'],  f"{num(free)} USD", c['black'])
    panel(c['free_ticket'], f"{num(free)} USD", c['black'])
    # 손익 column (left anchored, green)
    px, pyb = c['pos']
    d.rectangle((px-5, pyb-12, px+65, pyb+4), fill=W)
    d.text((px, pyb), f"+{num(pnl)}", font=fR, fill=c['green'], anchor='ls')
    # chart SELL pill: inpaint old green digits (keep semi-transparent bg), then
    # draw condensed muted-green number so it matches the UI's narrow pill font.
    arr = np.asarray(im).copy()
    ix0, ix1, iy0, iy1 = c['chart_inpaint']
    sub = arr[iy0:iy1, ix0:ix1].astype(np.float32)
    r,g,b = sub[:,:,0], sub[:,:,1], sub[:,:,2]
    gm = (g-r>16)&(g-b>8)&(g>100)
    Hs, Ws, _ = sub.shape
    for y in range(Hs):
        row=sub[y]; m=gm[y]; x=0
        while x<Ws:
            if m[x]:
                xe=x
                while xe<Ws and m[xe]: xe+=1
                L=row[x-1].copy() if x>0 else (row[xe].copy() if xe<Ws else np.array([253.,253.,252.]))
                R=row[xe].copy() if xe<Ws else L
                span=xe-x+1
                for xx in range(x,xe):
                    t=(xx-x+1)/span
                    row[xx]=L*(1-t)+R*t
                x=xe
            else: x+=1
    arr[iy0:iy1, ix0:ix1]=np.clip(sub,0,255).astype('uint8')
    # render number -> horizontal-compress -> alpha-blend (muted green)
    txt=f"+{num(pnl)}USD"
    w0=int(fS.getlength(txt))+2; h=20
    t=Image.new('L',(w0,h),0)
    ImageDraw.Draw(t).text((0,16),txt,font=fS,fill=255,anchor='ls')
    t=t.resize((c['chart_tw'],h),Image.LANCZOS)
    al=np.asarray(t).astype(np.float32)/255.0
    X0=c['chart_x0']; ytop=c['chart_baseline']-16
    reg=arr[ytop:ytop+h, X0:X0+c['chart_tw']].astype(np.float32)
    col=np.array(c['green_pill'],dtype=np.float32)
    for ch in range(3):
        reg[:,:,ch]=reg[:,:,ch]*(1-al)+col[ch]*al
    arr[ytop:ytop+h, X0:X0+c['chart_tw']]=np.clip(reg,0,255).astype('uint8')
    return Image.fromarray(arr)

# ----------------------------- detection + sequence --------------------------
def gmask(s):
    r,g,b=s[:,:,0],s[:,:,1],s[:,:,2]
    return int(((g-r>25)&(g-b>15)&(g>115)).sum())

def is_vantage(a, c=CFG):
    y0,y1,x0,x1=c['sig_chart']; p0,p1,q0,q1=c['sig_panel']
    return gmask(a[y0:y1,x0:x1])>60 and gmask(a[p0:p1,q0:q1])>40

def build_sequence(files, flags, numcrops, lo, hi, c=CFG, seed=7):
    """Original change-rhythm + target [lo,hi] range, quantised to TICK."""
    random.seed(seed)
    idx=[i for i,v in enumerate(flags) if v]
    first,last=idx[0],idx[-1]; M=max(last-first,1)
    change=[False]*len(files); prev=None
    for i in range(len(files)):
        if not flags[i]: prev=None; continue
        if prev is not None and np.abs(numcrops[i]-prev).mean()>c['change_thresh']:
            change[i]=True
        prev=numcrops[i]
    n0=lo/c['tick']; n1=hi/c['tick']
    sm=lambda t: t*t*t*(t*(t*6-15)+10)
    nf=n0; seq={}
    for i in range(first,last+1):
        if change[i]:
            t=(i-first)/M
            cen=n0+(n1-n0)*sm(t)
            nf += 0.12*(cen-nf) + random.choice([1,-1,1,-1,2,-2,1,-1,3,-3])
        seq[i]=round(round(nf)*c['tick'],2)
    return seq, (first,last)

# ----------------------------- pipeline --------------------------------------
def run(src, out, lo, hi, c=CFG, workdir=None):
    tmp = workdir or tempfile.mkdtemp(prefix='pnl_')
    fdir=os.path.join(tmp,'all'); odir=os.path.join(tmp,'out')
    os.makedirs(fdir,exist_ok=True); os.makedirs(odir,exist_ok=True)
    print('extracting frames ->',fdir)
    subprocess.run(['ffmpeg','-y','-i',src,'-vsync','0','-q:v','2',
                    os.path.join(fdir,'f_%05d.jpg')],check=True,
                   stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    files=sorted(glob.glob(os.path.join(fdir,'f_*.jpg')))
    flags=[]; numcrops=[]
    y0,y1,x0,x1=c['numcrop']
    for f in files:
        a=np.array(Image.open(f).convert('RGB')).astype(int)
        flags.append(is_vantage(a,c))
        numcrops.append(a[y0:y1,x0:x1].astype(np.int16).copy())
    seq,(first,last)=build_sequence(files,flags,numcrops,lo,hi,c)
    print('editable frames %d..%d ; pnl %.2f -> %.2f'%(first,last,seq[first],seq[last]))
    for i,f in enumerate(files):
        dst=os.path.join(odir,os.path.basename(f))
        if flags[i]:
            edit_frame(Image.open(f).convert('RGB'), seq[i], c).save(dst,quality=93)
        else:
            shutil.copy(f,dst)
    print('encoding ->',out)
    subprocess.run(['ffmpeg','-y','-framerate',str(c['fps']),'-start_number','1',
                    '-i',os.path.join(odir,'f_%05d.jpg'),'-i',src,
                    '-map','0:v:0','-map','1:a:0?','-c:v','libx264',
                    '-pix_fmt','yuv420p','-crf','20','-preset','medium',
                    '-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',out],
                   check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    print('done:',out)

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--lo',type=float,default=9994.0)   # P&L start (climbs to --hi)
    ap.add_argument('--hi',type=float,default=10355.0)
    a=ap.parse_args()
    run(a.src,a.out,a.lo,a.hi)
