/**
 * 本文の画像リンク（delivery.ts から分けた・2026-09-24）。
 *
 * data-link-url / data-tracking-urls 属性を持つ `<img>` を、クリックできる `<a>` で包む。
 * 配信LP（/lp）では計測URLへのビーコンも飛ばす。
 * プレビュー（/preview）でも画像のリンクは押せるようにする（以前は配信LPだけで、プレビューでは押せなかった・点検36）。
 * ただしプレビューは「計測されません」なので、計測URLへは送らない。
 */
export function imageLinkScript(sendBeacons: boolean): string {
  const beacon = sendBeacons
    ? `
      tracks.forEach(function(t){
        try{navigator.sendBeacon(t)}catch(e){new Image().src=t}
      });`
    : ''
  return `<script>(function(){
  document.querySelectorAll('img[data-link-url]').forEach(function(img){
    var url=img.getAttribute('data-link-url');
    if(!url)return;
    var target=img.getAttribute('data-link-target')||'_blank';
    var trackRaw=img.getAttribute('data-tracking-urls');
    var tracks=[];
    try{if(trackRaw)tracks=JSON.parse(trackRaw)}catch(e){}
    var a=document.createElement('a');
    a.href=url;
    a.target=target;
    if(target==='_blank')a.rel='noopener noreferrer';
    a.style.display='inline-block';
    img.parentNode.insertBefore(a,img);
    a.appendChild(img);
    a.addEventListener('click',function(){${beacon}
    });
  });${
    sendBeacons
      ? `
  document.querySelectorAll('img[data-tracking-urls]:not([data-link-url])').forEach(function(img){
    var trackRaw=img.getAttribute('data-tracking-urls');
    var tracks=[];
    try{if(trackRaw)tracks=JSON.parse(trackRaw)}catch(e){}
    if(!tracks.length)return;
    img.style.cursor='pointer';
    img.addEventListener('click',function(){${beacon}
    });
  });`
      : ''
  }
})()</script>`
}
