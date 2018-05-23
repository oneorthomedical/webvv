!function(e){var t={};function n(o){if(t[o])return t[o].exports;var i=t[o]={i:o,l:!1,exports:{}};return e[o].call(i.exports,i,i.exports,n),i.l=!0,i.exports}n.m=e,n.c=t,n.d=function(e,t,o){n.o(e,t)||Object.defineProperty(e,t,{configurable:!1,enumerable:!0,get:o})},n.r=function(e){Object.defineProperty(e,"__esModule",{value:!0})},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s=5)}([function(e,t){e.exports={fps:30,interpolation:0,autoIntensity:!1,bgColor:16711680,rightClickAllowed:!1,zoomSpeed:1.1,zoomInIsWheelDown:!0,stackTopIsWheelDown:!0,zoomIn:"+",zoomIn2:"i",zoomOut:"-",zoomOut2:"o",zoomHold:17,stackUp:"ArrowUp",stackDown:"ArrowDown",mouseClickProbe:1,mouseClickPan:2,mouseClickWindow:3,resetCamera:"r"}},function(e,t,n){"use strict";n.r(t),n.d(t,"default",function(){return i});const o=n(0);class i extends THREE.EventDispatcher{constructor(e,t,n){super();let i=this,r={NONE:0,SETPROB:1,PAN:2,WINDOW:3},s=new Map,a=(r.NONE,new THREE.Vector2),c=new THREE.Vector2,l=new THREE.Vector3,u=new THREE.Vector3;function d(e){switch(e.key){case o.zoomIn:case o.zoomIn2:i.zoom(!0);break;case o.zoomOut:case o.zoomOut2:i.zoom(!1);break;case o.resetCamera:i.reset()}}function m(e){switch(s.set(e.keyCode,!0),e.key){case"Escape":i._state=r.NONE;break;case o.stackUp:i.scrollStack(!0);break;case o.stackDown:i.scrollStack(!1)}}function h(e){s.set(e.keyCode,!1)}function f(e){switch(e.which){case o.mouseClickProbe:i._state=r.SETPROB;break;case o.mouseClickPan:i._state=r.PAN;break;case o.mouseClickWindow:i._state=r.WINDOW}a.x=e.x,a.y=e.y,document.addEventListener("mousemove",w,!1)}function p(e){i._state=r.NONE,document.removeEventListener("mousemove",w,!1)}function w(e){switch(c.x=e.x,c.y=e.y,i._state){case r.PAN:i.pan(a,c);break;case r.SETPROB:case r.WINDOW:}a=c,c=new THREE.Vector2}function g(e){var t;t=o.zoomHold,s.has(t)&&s.get(t)?(i.zoom(e.deltaY>0===o.zoomInIsWheelDown),e.preventDefault()):(i.scrollStack(e.deltaY>0===o.stackTopIsWheelDown),e.preventDefault())}function E(e){o.rightClickAllowed||e.preventDefault()}this.camera=e,this.stack=t,this.domElement=void 0!==n?n:document,this.target=new THREE.Vector3,this.noZoom=!1,this.noPan=!1,this.noRotate=!0,this.handleResize=function(){},this.update=function(){i._changed&&i.camera.updateProjectionMatrix(),this.camera.lookAt(this.target)},this.setAsResetState=function(){},this.reset=function(){},this.pan=function(e,t){if(l.subVectors(i.camera.position,i.target),this.noPan)return;let o=t.x-e.x,r=t.y-e.y;o/=n.offsetWidth,r/=n.offsetHeight,o*=(i.camera.right-i.camera.left)/i.camera.zoom,r*=(i.camera.top-i.camera.bottom)/i.camera.zoom;let s=new THREE.Vector3;s.copy(i.camera.up).setLength(r),s.add(u.copy(l).cross(i.camera.up).setLength(o)),i.camera.position.add(s),i.target.add(s),i._changed=!0},this.zoom=function(e){if(this.noZoom)return;let t=e?1/o.zoomSpeed:o.zoomSpeed;Math.abs(t-1)>1e-6&&t>0&&(this.camera.zoom/=t)},this.scrollStack=function(e){if(e){if(t.index>=t.orientationMaxIndex-1)return!1;t.index+=1}else{if(t.index<=0)return!1;t.index-=1}},this.dispose=function(){document.removeEventListener("mousedown",f,!1),document.removeEventListener("mouseup",p,!1),document.removeEventListener("wheel",g,!1),document.removeEventListener("contextmenu",E,!1),document.removeEventListener("keypress",d,!1),document.removeEventListener("keyup",h,!1),document.removeEventListener("keydown",m,!1)},document.addEventListener("mousedown",f,!1),document.addEventListener("mouseup",p,!1),document.addEventListener("wheel",g,!1),document.addEventListener("contextmenu",E,!1),document.addEventListener("keypress",d,!1),document.addEventListener("keyup",h,!1),document.addEventListener("keydown",m,!1),this.camera.position.z=1,this.handleResize(),this.update(),this.setAsResetState()}}},function(e,t){e.exports=function(){function e(e,t){"CR"!==t&&"DX"!==t&&(document.getElementById("top").innerHTML=e[0],document.getElementById("bottom").innerHTML=e[1],document.getElementById("right").innerHTML=e[2],document.getElementById("left").innerHTML=e[3])}return{buildGUI:function(t,n){let o=t._stack,i=new dat.GUI({autoPlace:!1}),r={invertRows:!1,invertColumns:!1,rotate:!1,orientation:"default",convention:"radio"};document.getElementById("my-gui-container").appendChild(i.domElement);let s=i.addFolder("Stack");s.add(t.slice,"windowWidth",1,o.minMax[1]-o.minMax[0]).step(1).listen(),s.add(t.slice,"windowCenter",o.minMax[0],o.minMax[1]).step(1).listen(),s.add(t.slice,"invert"),lut=new AMI.LutHelper("my-lut-canvases","default","linear",[[0,0,0,0],[1,1,1,1]],[[0,1],[1,1]]),lut.luts=AMI.LutHelper.presetLuts(),s.add(t.slice,"lut",lut.lutsAvailable()).onChange(function(e){lut.lut=e,t.slice.lutTexture=lut.texture}),s.add(lut,"discrete",!1).onChange(function(e){lut.discrete=e,t.slice.lutTexture=lut.texture});let a=s.add(t,"index",0,o.dimensionsIJK.z-1).step(1).listen();s.open();let c=i.addFolder("Camera");c.add(r,"invertRows").onChange(function(){n.invertRows(),e(n.directionsLabel,o.modality)}),c.add(r,"invertColumns").onChange(function(){n.invertColumns(),e(n.directionsLabel,o.modality)}),c.add(n,"angle",0,360).step(1).listen().onChange(function(){e(n.directionsLabel,o.modality)}),c.add(r,"rotate").onChange(function(){n.rotate(),e(n.directionsLabel,o.modality)}),c.add(r,"orientation",["default","axial","coronal","sagittal"]).onChange(function(i){n.orientation=i,n.update(),n.fitBox(2),t.orientation=n.stackOrientation,e(n.directionsLabel,o.modality),a.__max=t.orientationMaxIndex,t.index=Math.floor(a.__max/2)}),c.add(r,"convention",["radio","neuro"]).onChange(function(t){n.convention=t,n.update(),n.fitBox(2),e(n.directionsLabel,o.modality)})},updateLabels:e}}()},function(e,t){e.exports=function(){let e,t,n,o,i,r;function s(){n=Date.now(),(i=n-o)>e&&(o=n-i%e,r()),requestAnimationFrame(s)}return{startAnimating:function(n,i){r=i,imgHasChanged=!0,e=1e3/n,o=Date.now(),t=o,s()}}}()},function(e,t){e.exports=function(){function e(e,t){return t.extension.toUpperCase()===e.toUpperCase()}function t(e){return new Promise((t,n)=>{const o=new XMLHttpRequest;o.responseType="blob",o.onload=(()=>{"200"==o.status?t(o.response):n(o.statusText)}),o.onerror=(()=>n(o.statusText)),o.open("GET",e),o.send()})}return{readMultipleFiles:function(n,o){let i,r={},s={};var a;function c(o,i,s){return new Promise((a,c)=>{Promise.resolve().then(e=>{if(void 0!==o[s])return console.log(s+" : Files request..."),function(e,n,o){return new Promise((i,r)=>{e[o]||r("No category with this name ("+o+") in json.");let s=Promise.resolve(),a=[];for(let n=0;n<e[o].length;n++)s=s.then(i=>t("/datafiles/"+e.study+"/"+e[o][n])).then(t=>{e[o][n].split("/").pop(),a.push(new File([t],e[o][n].split("/").pop()))});s=s.then(e=>{n[o]=a,i()})})}(o,i,s)}).then(t=>{if(void 0!==o[s])return console.log(s+" : Files loading..."),function(t,o){return new Promise((i,s)=>{const a=[],c=[],u={};let d;for(let n=0;n<t[o].length;n++){let i=AMI.UtilsCore.parseUrl(t[o][n].name);e("mhd",i)?(u.header=t[o][n],d=!0):e("raw",i)?u.data=t[o][n]:c.push(t[o][n])}if(void 0!==d)void 0===u.header||void 0===u.data?s("Data seems to be 'header (mhd) + data (raw)' but data can't be found !"):a.push(function(e,t){const o=[];for(let t in e)o.push(new Promise((n,o)=>{const i=new FileReader;i.onload=(e=>{n(e.target.result)}),i.readAsArrayBuffer(e[t])}).then(function(n){return{url:e[t].name,buffer:n}}));return Promise.all(o).then(e=>n.parse(e)).then(function(e){r[t]=[],r[t].push(e)}).catch(function(e){window.console.log("oops... something went wrong while parsing the sequence..."),window.console.log(e)})}(u,o));else for(let e=0;e<c.length;e++)a.push(l(e,c,o));Promise.all(a).then(function(){i(r)}).catch(function(e){window.console.log(e),s("oops... something went wrong while using the sequence...")})})}(i,s)}).then(e=>{a()})})}function l(e,t,o){return Promise.resolve().then(function(){return new Promise(function(n,o){const i=new FileReader;i.addEventListener("load",function(e){n(e.target.result)}),i.readAsArrayBuffer(t[e])})}).then(function(o){return n.parse({url:t[e].name,buffer:o})}).then(function(e){r[o]=[],r[o].push(e)}).catch(function(e){window.console.log("Oops... something went wrong while loading the sequence..."),window.console.log(e)})}Promise.resolve().then(e=>{console.log("Json request...");const t="/"+function(){let e=[],t=window.location.search.substring(1).split("&");for(let n=0,o=t.length;n<o;n++){if(""===t[n])continue;let o=t[n].split("=");"viewer"===decodeURIComponent(o[0])&&(e[decodeURIComponent(o[0])]=decodeURIComponent(o[1]||""))}return e}().viewer;return a=t,new Promise((e,t)=>{const n=new XMLHttpRequest;n.overrideMimeType("application/json"),n.onload=(()=>{"200"==n.status?e(n.responseText):t(n.statusText)}),n.onerror=(()=>t(n.statusText)),n.open("GET",a),n.send()})}).then(e=>{i=JSON.parse(e)}).then(e=>c(i,s,"image")).then(e=>c(i,s,"fusion")).then(e=>{console.log("Files loaded."),o(r)}).catch(e=>{console.log("An error has occured:"),console.log(e)})}}}()},function(e,t,n){const o=n(0),i=n(4),r=n(3),s=n(2),a=n(1);let c,l,u,d,m,h,f,p,w,g;window.onload=function(){l=document.getElementById("r3d"),(c=new THREE.WebGLRenderer({antialias:1==o.interpolation})).setSize(l.offsetWidth,l.offsetHeight),c.setClearColor(o.bgColor,1),c.setPixelRatio(window.devicePixelRatio),l.appendChild(c.domElement),u=new Stats,l.appendChild(u.domElement),d=new THREE.Scene,m=new THREE.Scene,h=new THREE.Scene,f=new THREE.Scene,scene0TextureRender=new THREE.WebGLRenderTarget(l.clientWidth,l.clientHeight,{minFilter:THREE.LinearFilter,magFilter:THREE.NearestFilter,format:THREE.RGBAFormat}),scene1TextureRender=new THREE.WebGLRenderTarget(l.clientWidth,l.clientHeight,{minFilter:THREE.LinearFilter,magFilter:THREE.NearestFilter,format:THREE.RGBAFormat}),lutLayer0=new AMI.LutHelper("my-lut-canvases","default","linear",[[0,0,0,0],[0,1,1,1]],[[0,1],[1,1]]),lutLayer0.luts=AMI.LutHelper.presetLuts(),w=new AMI.OrthographicCamera(l.clientWidth/-2,l.clientWidth/2,l.clientHeight/2,l.clientHeight/-2,.1,1e4);let e=new AMI.VolumeLoader(l);i.readMultipleFiles(e,function(t){e.free(),e=null;let n=t.image[0].mergeSeries(t.image)[0].stack[0];(p=new AMI.StackHelper(n)).bbox.visible=!1,p.borderColor="#2196F3",p.border.visible=!1,d.add(p),g=new a.default(w,p,l),w.controls=g;let i=n.worldBoundingBox(),m=new THREE.Vector3((i[1]-i[0])/2,(i[3]-i[2])/2,(i[5]-i[4])/2),h={center:n.worldCenter().clone(),halfDimensions:new THREE.Vector3(m.x+10,m.y+10,m.z+10)},f={width:l.clientWidth,height:l.clientHeight};w.directions=[n.xCosine,n.yCosine,n.zCosine],w.box=h,w.canvas=f,w.update(),w.fitBox(2),p.slice.intensityAuto=o.autoIntensity,p.slice.interpolation=o.interpolation,p.slice.lutTexture=lutLayer0.texture,s.updateLabels(w.directionsLabel,n.modality),s.buildGUI(p,w),function(){function e(){w.canvas={width:l.offsetWidth,height:l.offsetHeight},c.setSize(l.offsetWidth,l.offsetHeight)}r.startAnimating(o.fps,function(){g.update(),c.render(d,w),u.update()}),window.addEventListener("resize",e,!1),e()}()})}}]);