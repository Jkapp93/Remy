'use client';
import { useEffect, useRef } from 'react';

export default function RemyCore() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const cx = cv.getContext('2d')!;
    let animId: number;

    const SILVER = '#dce8f2';
    const ORANGE = '#f07a2e';
    const CYAN = '#00cfff';

    const L1 = [
      {label:'OFFICE',a:-90,col:SILVER},
      {label:'CRM',a:0,col:SILVER},
      {label:'PRODUCTION',a:90,col:SILVER},
      {label:'PERMITS',a:180,col:SILVER},
    ];
    const L2 = [
      {label:'VOICE BRIEF',a:-90,col:ORANGE},
      {label:'JOB NOTES',a:30,col:ORANGE},
      {label:'OBJECTIONS',a:150,col:ORANGE},
    ];
    const L3 = [
      {label:'GPS',a:-90,col:CYAN},
      {label:'WEATHER',a:0,col:CYAN},
      {label:'MAPS',a:90,col:CYAN},
      {label:'TRAFFIC',a:180,col:CYAN},
    ];

    const STARS = Array.from({length:40},()=>({
      x:Math.random()*960,y:Math.random()*600,
      s:Math.random()*0.7,a:Math.random()*0.25+0.05,
      t:Math.random()*Math.PI*2,sp:0.004+Math.random()*0.008
    }));

    const W = () => cv.offsetWidth;
    const H = () => cv.offsetHeight;
    const CX = () => W()/2;
    const CY = () => H()/2;
    const rd = (d: number) => d * Math.PI / 180;
    let t = 0;

    function rs() { if(!cv) return;
      cv.width = cv.offsetWidth * devicePixelRatio;
      cv.height = cv.offsetHeight * devicePixelRatio;
      cx.scale(devicePixelRatio, devicePixelRatio);
    }
    rs();
    window.addEventListener('resize', rs);

    function ring(x:number,y:number,r:number,lw:number,col:string,alpha:number,dash?:number[],off?:number){
      cx.save();cx.strokeStyle=col;cx.lineWidth=lw;cx.globalAlpha=alpha;
      if(dash){cx.setLineDash(dash);cx.lineDashOffset=off||0;}
      cx.beginPath();cx.arc(x,y,r,0,Math.PI*2);cx.stroke();cx.setLineDash([]);cx.restore();
    }
    function rarc(x:number,y:number,r:number,lw:number,col:string,alpha:number,from:number,to:number,cap?:CanvasLineCap){
      cx.save();cx.strokeStyle=col;cx.lineWidth=lw;cx.globalAlpha=alpha;if(cap)cx.lineCap=cap;
      cx.beginPath();cx.arc(x,y,r,rd(from),rd(to));cx.stroke();cx.restore();
    }
    function blocks(x:number,y:number,r:number,n:number,bw:number,bh:number,col:string,alpha:number,off:number){
      for(let i=0;i<n;i++){
        const a=rd(i*(360/n)+off);
        const phase=(i+Math.floor(t*5))%n;
        const lit=phase<Math.ceil(n*0.38);
        const sz=i%4===0?1.5:i%2===0?1.1:0.7;
        cx.save();cx.translate(x+Math.cos(a)*r,y+Math.sin(a)*r);cx.rotate(a+Math.PI/2);
        cx.fillStyle=col;cx.globalAlpha=lit?alpha*sz:alpha*0.06;
        cx.fillRect(-bw/2,-bh*sz/2,bw,bh*sz);cx.restore();
      }
    }
    function dotArc(x:number,y:number,r:number,from:number,to:number,n:number,col:string,alpha:number,sz:number){
      for(let i=0;i<n;i++){
        const a=rd(from+i*((to-from)/(n-1)));
        const bright=i%6===0?1:i%3===0?0.5:0.2;
        cx.save();cx.fillStyle=col;cx.globalAlpha=alpha*bright;
        cx.beginPath();cx.arc(x+Math.cos(a)*r,y+Math.sin(a)*r,sz,0,Math.PI*2);cx.fill();cx.restore();
      }
    }
    function drawShimmer(x:number,y:number,sa:number){
      cx.save();cx.translate(x,y);cx.rotate(sa);
      cx.beginPath();cx.moveTo(0,0);cx.arc(0,0,210,-rd(14),rd(14));cx.closePath();
      const g=cx.createRadialGradient(0,0,20,0,0,210);
      g.addColorStop(0,'rgba(255,248,230,0.0)');g.addColorStop(0.25,'rgba(255,248,230,0.1)');g.addColorStop(0.7,'rgba(255,248,230,0.05)');g.addColorStop(1,'rgba(255,248,230,0.0)');
      cx.fillStyle=g;cx.fill();
      cx.beginPath();cx.moveTo(0,0);cx.arc(0,0,210,-rd(2),rd(2));cx.closePath();
      const g2=cx.createRadialGradient(0,0,20,0,0,210);
      g2.addColorStop(0,'rgba(255,255,255,0.0)');g2.addColorStop(0.35,'rgba(255,255,255,0.16)');g2.addColorStop(1,'rgba(255,255,255,0.0)');
      cx.fillStyle=g2;cx.fill();cx.restore();
      [82,96,110,124,134,145,158,168,180].forEach(r=>{
        cx.save();cx.strokeStyle='rgba(255,248,225,1)';
        cx.lineWidth=r>130?3.5:2;cx.globalAlpha=r>150?0.28:r>110?0.18:0.1;cx.lineCap='round';
        cx.beginPath();cx.arc(x,y,r,sa-rd(18),sa+rd(18));cx.stroke();cx.restore();
      });
    }
    function tether(x:number,y:number,nx:number,ny:number,col:string,sr:number,ps:number,pc:number){
      const dx=nx-x,dy=ny-y,d=Math.sqrt(dx*dx+dy*dy);
      const ux=dx/d,uy=dy/d;
      const x1=x+ux*sr,y1=y+uy*sr,x2=nx-ux*24,y2=ny-uy*24;
      const isSilver=col===SILVER;
      cx.save();cx.strokeStyle=col;cx.lineWidth=isSilver?1.4:1;cx.globalAlpha=isSilver?0.5:0.3;
      cx.beginPath();cx.moveTo(x1,y1);cx.lineTo(x2,y2);cx.stroke();cx.restore();
      cx.save();cx.strokeStyle=col;cx.lineWidth=0.5;cx.globalAlpha=isSilver?0.2:0.1;
      cx.beginPath();cx.moveTo(x1-uy*5,y1+ux*5);cx.lineTo(x2-uy*5,y2+ux*5);cx.stroke();
      cx.beginPath();cx.moveTo(x1+uy*5,y1-ux*5);cx.lineTo(x2+uy*5,y2-ux*5);cx.stroke();cx.restore();
      for(let k=0;k<pc;k++){
        const p=((t*ps+k/pc)%1);
        const px=x1+(x2-x1)*p,py=y1+(y2-y1)*p;
        const fade=1-Math.abs(p-0.5)*2;
        cx.save();
        const g=cx.createRadialGradient(px,py,0,px,py,6);
        g.addColorStop(0,col+'88');g.addColorStop(1,'transparent');
        cx.fillStyle=g;cx.globalAlpha=fade*0.4;cx.beginPath();cx.arc(px,py,6,0,Math.PI*2);cx.fill();
        cx.fillStyle=col;cx.globalAlpha=fade;cx.beginPath();cx.arc(px,py,2.2,0,Math.PI*2);cx.fill();
        cx.restore();
      }
    }
    function layerNode(x:number,y:number,nd:{label:string,a:number,col:string},lr:number,rs2:number,nr:number,shimA:number){
      const a=rd(nd.a)+t*rs2;
      const nx=x+Math.cos(a)*lr,ny=y+Math.sin(a)*lr;
      const isSilver=nd.col===SILVER;
      const sA=((shimA%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
      const nA=((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
      const diff=Math.abs(((sA-nA+Math.PI*3)%(Math.PI*2))-Math.PI);
      const sh=Math.max(0,1-diff/rd(45));
      const pc=isSilver?2:3;
      const ps=isSilver?0.26:nd.col===ORANGE?0.4:0.58;
      tether(x,y,nx,ny,nd.col,80,ps,pc);
      [nr+24,nr+14,nr+7].forEach((gr,gi)=>{
        const g=cx.createRadialGradient(nx,ny,0,nx,ny,gr);
        if(isSilver){
          const alphas=[0.22,0.32,0.45];
          g.addColorStop(0,`rgba(220,232,242,${alphas[gi]})`);
        } else {
          const hexes=['0d','18','28'];
          g.addColorStop(0,nd.col+hexes[gi]);
        }
        g.addColorStop(1,'transparent');
        cx.save();cx.fillStyle=g;cx.beginPath();cx.arc(nx,ny,gr,0,Math.PI*2);cx.fill();cx.restore();
      });
      ring(nx,ny,nr+11,0.8,nd.col,isSilver?0.4+sh*0.3:0.22+sh*0.22);
      cx.save();cx.fillStyle='#010407';cx.beginPath();cx.arc(nx,ny,nr,0,Math.PI*2);cx.fill();cx.restore();
      const ig=cx.createRadialGradient(nx,ny,0,nx,ny,nr);
      if(isSilver) ig.addColorStop(0,`rgba(220,232,242,${sh>0.3?0.22:0.12})`);
      else ig.addColorStop(0,nd.col+(sh>0.3?'25':'0e'));
      ig.addColorStop(1,'transparent');
      cx.save();cx.fillStyle=ig;cx.beginPath();cx.arc(nx,ny,nr,0,Math.PI*2);cx.fill();cx.restore();
      ring(nx,ny,nr,isSilver?2.2:1.8,nd.col,isSilver?0.98:0.88);
      ring(nx,ny,nr-6,0.5,nd.col,isSilver?0.35:0.2);
      if(sh>0.08){
        cx.save();cx.strokeStyle='rgba(255,248,225,1)';cx.lineWidth=2.5;cx.globalAlpha=sh*(isSilver?0.7:0.5);cx.lineCap='round';
        cx.beginPath();cx.arc(nx,ny,nr+1,shimA-rd(38),shimA+rd(38));cx.stroke();cx.restore();
      }
      const arcS=rd(-t*55+nd.a);
      cx.save();cx.strokeStyle=nd.col;cx.lineWidth=isSilver?4:3.5;cx.globalAlpha=isSilver?1:0.92;cx.lineCap='round';
      cx.beginPath();cx.arc(nx,ny,nr+6,arcS,arcS+rd(90));cx.stroke();cx.restore();
      cx.save();cx.strokeStyle=nd.col;cx.lineWidth=1.5;cx.globalAlpha=isSilver?0.5:0.35;cx.lineCap='round';
      cx.beginPath();cx.arc(nx,ny,nr+6,arcS+rd(140),arcS+rd(185));cx.stroke();cx.restore();
      const dotA=rd(t*115+nd.a*2);
      cx.save();cx.fillStyle=nd.col;cx.globalAlpha=1;
      cx.beginPath();cx.arc(nx+Math.cos(dotA)*(nr+11),ny+Math.sin(dotA)*(nr+11),isSilver?3:2.5,0,Math.PI*2);cx.fill();cx.restore();
      cx.save();cx.fillStyle=nd.col;cx.globalAlpha=isSilver?1:0.95;
      cx.font=`700 ${isSilver?9:8.5}px 'Share Tech Mono',monospace`;
      cx.textAlign='center';cx.textBaseline='middle';
      cx.fillText(nd.label,nx,ny);cx.restore();
    }
    function drawCore(x:number,y:number){
      const p=(Math.sin(t*1.8)+1)/2;
      const p2=(Math.sin(t*2.5+1)+1)/2;
      const amb=cx.createRadialGradient(x,y,0,x,y,185);
      amb.addColorStop(0,'rgba(240,122,46,0.1)');amb.addColorStop(0.4,'rgba(240,122,46,0.03)');amb.addColorStop(1,'transparent');
      cx.save();cx.fillStyle=amb;cx.beginPath();cx.arc(x,y,185,0,Math.PI*2);cx.fill();cx.restore();
      blocks(x,y,162,62,5,14,ORANGE,0.62,-t*2);
      ring(x,y,154,0.5,ORANGE,0.1);
      blocks(x,y,143,48,4,10,ORANGE,0.42,t*3.5);
      ring(x,y,136,0.4,ORANGE,0.07);
      rarc(x,y,127,13,ORANGE,0.95,190,345,'round');
      rarc(x,y,127,3.5,'rgba(255,225,175,0.8)',0.9,190,345,'round');
      rarc(x,y,127,4.5,ORANGE,0.22,348,186,'round');
      ring(x,y,127,0.6,ORANGE,0.2);
      rarc(x,y,115,9,ORANGE,0.72,12,172,'round');
      rarc(x,y,115,2.5,'rgba(255,225,175,0.6)',0.65,12,172,'round');
      ring(x,y,109,0.4,ORANGE,0.07);
      dotArc(x,y,102,10,354,90,ORANGE,0.55,1.5);
      ring(x,y,95,0.3,ORANGE,0.06);
      for(let i=0;i<72;i++){
        const a=rd(i*5);const big=i%6===0,med=i%3===0&&!big;
        cx.save();cx.strokeStyle=ORANGE;cx.lineWidth=big?1.4:0.45;cx.globalAlpha=big?0.72:med?0.28:0.1;
        cx.beginPath();cx.moveTo(x+Math.cos(a)*(89-(big?9:med?5:2)),y+Math.sin(a)*(89-(big?9:med?5:2)));
        cx.lineTo(x+Math.cos(a)*89,y+Math.sin(a)*89);cx.stroke();cx.restore();
      }
      cx.save();cx.fillStyle='#010407';cx.beginPath();cx.arc(x,y,81,0,Math.PI*2);cx.fill();cx.restore();
      ring(x,y,81,2.2,ORANGE,0.93);
      ring(x,y,81,7,ORANGE,0.07);
      rarc(x,y,71,7,ORANGE,0.52,195,342,'round');
      rarc(x,y,71,2,'rgba(255,225,175,0.55)',0.45,195,342,'round');
      ring(x,y,61,0.7,ORANGE,0.16);
      dotArc(x,y,53,0,358,28,ORANGE,0.24,1.3);
      ring(x,y,42,0.6,ORANGE,0.12,[2,4],-t*30);
      ring(x,y,29,0.5,ORANGE,0.09);
      ring(x,y,17,0.4,ORANGE,0.07);
      const sa=rd(t*36);
      cx.save();cx.globalAlpha=0.045+p*0.022;cx.fillStyle=ORANGE;
      cx.beginPath();cx.moveTo(x,y);cx.arc(x,y,320,sa,sa+rd(46));cx.closePath();cx.fill();cx.restore();
      cx.save();cx.fillStyle=ORANGE;cx.globalAlpha=0.97;
      cx.font="900 18px 'Syne',sans-serif";cx.textAlign='center';cx.textBaseline='middle';
      cx.fillText('REMY',x,y-10);
      cx.globalAlpha=0.28;cx.font="300 5.5px 'Share Tech Mono',monospace";
      cx.fillText('CONNECTED INTELLIGENCE',x,y+10);cx.restore();
      const cp=(Math.sin(t*5)+1)/2;
      cx.save();cx.fillStyle=ORANGE;cx.globalAlpha=0.9+cp*0.1;
      cx.beginPath();cx.arc(x,y,2.8+cp*1.5,0,Math.PI*2);cx.fill();cx.restore();
    }

    function frame(){
      const w=W(),h=H(),x=CX(),y=CY();
      cx.clearRect(0,0,w,h);cx.fillStyle='#010407';cx.fillRect(0,0,w,h);
      STARS.forEach((s:any)=>{s.t+=s.sp;cx.save();cx.globalAlpha=s.a*(0.4+0.6*Math.sin(s.t));cx.fillStyle='#fff';cx.beginPath();cx.arc(s.x*(w/960),s.y*(h/600),s.s,0,Math.PI*2);cx.fill();cx.restore();});
      const shimmerAngle=t*0.38;
      ring(x,y,170,0.6,SILVER,0.3);
      ring(x,y,220,0.5,ORANGE,0.15);
      ring(x,y,276,0.5,CYAN,0.12);
      L3.forEach(n=>layerNode(x,y,n,276,0.1,20,shimmerAngle));
      L2.forEach(n=>layerNode(x,y,n,220,0.06,19,shimmerAngle));
      L1.forEach(n=>layerNode(x,y,n,170,0.03,18,shimmerAngle));
      drawCore(x,y);
      drawShimmer(x,y,shimmerAngle);
      [{col:SILVER,label:'BUSINESS FOUNDATION'},{col:ORANGE,label:'FIELD OPS'},{col:CYAN,label:'LIVE WORLD DATA'}].forEach((item,i)=>{
        const lx=w*0.06+i*(w*0.32),ly=h-20;
        cx.save();
        const g=cx.createRadialGradient(lx,ly,0,lx,ly,7);
        g.addColorStop(0,item.col+'88');g.addColorStop(1,'transparent');
        cx.fillStyle=g;cx.globalAlpha=0.7;cx.beginPath();cx.arc(lx,ly,7,0,Math.PI*2);cx.fill();
        cx.fillStyle=item.col;cx.globalAlpha=item.col===SILVER?1:0.9;cx.beginPath();cx.arc(lx,ly,2.8,0,Math.PI*2);cx.fill();
        cx.fillStyle=item.col;cx.globalAlpha=item.col===SILVER?0.75:0.45;
        cx.font="500 6.5px 'Share Tech Mono',monospace";cx.textAlign='left';cx.textBaseline='middle';
        cx.fillText(item.label,lx+12,ly);cx.restore();
      });
      t+=0.003;
      animId=requestAnimationFrame(frame);
    }
    frame();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', rs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width:'100%', height:'600px', display:'block', background:'#010407' }}
    />
  );
}
