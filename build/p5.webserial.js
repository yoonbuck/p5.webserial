!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):((e="undefined"!=typeof globalThis?globalThis:e||self).p5=e.p5||{},e.p5.WebSerial=t())}(this,(function(){"use strict";const e=new WeakMap;return class{constructor(){this.serialBuffer=[],this.serialConnected=!1,this.portOpen=!1,this.shouldClose=!1,this.isOpening=!1,this.lineEnding="\r\n",this.emitter=new EventTarget,this.encoder=new TextEncoder}async requestPort(e=[{usbVendorId:9025}]){try{this.port=await navigator.serial.requestPort({filters:e}),this.portInfo=this.port.getInfo(),this.emit("portavailable",this.portInfo)}catch(e){this.emit("requesterror",e)}}async getPorts(e=(e=>e[0])){const t=await navigator.serial.getPorts();let r;t.length&&(r=e(t)),r?(this.port=r,this.portInfo=this.port.getInfo(),this.emit("portavailable",this.portInfo)):this.emit("noport")}async open(e={baudRate:9600}){if(!this.port)return this.emit("openerror",new Error("Cannot open before selecting a port."));if(this.portOpen)return this.emit("openerror",new Error("Port is already open."));if(this.isOpening)return this.emit("openerror",new Error("Port is already opening."));try{await this.port.open(e),this.writer=this.port.writable.getWriter(),this.portOpen=!0,this.emit("open"),this.readLoop(),this.isOpening=!1}catch(e){this.isOpening=!1,this.emit("openerror",e)}}async close(){return this.portOpen?this.shouldClose?this.emit("closeerror",new Error("Port is already closing.")):void(this.shouldClose=!0):this.emit("closeerror",new Error("Port is already closed."))}async readLoop(){const e=this;for(;this.port.readable;){const e=this.port.readable.getReader();try{for(;;){const{value:r,done:i}=await e.read();if(this.shouldClose)return e.releaseLock(),void await t();if(i){e.releaseLock();break}r&&(this.serialBuffer=this.serialBuffer.concat(Array.from(r)),this.emit("data"))}}catch(e){this.emit("readerror",e)}}async function t(){e.writer.releaseLock(),await e.port.close(),e.portOpen=!1,e.shouldClose=!1,e.emit("close")}await t()}read(){return this.serialBuffer.length>0?this.serialBuffer.shift():-1}readChar(){return this.serialBuffer.length>0?String.fromCharCode(this.serialBuffer.shift()):null}readBytes(){let e=Uint8Array.from(this.serialBuffer);return this.serialBuffer.length=0,e}readBytesUntil(e,t=!1){if(-1===this.serialBuffer.indexOf(e.charCodeAt(0)))return t?this.readBytes():null}bufferAsString(){let e=new Array(this.serialBuffer.length);for(let t=0;t<this.serialBuffer.length;t++)e[t]=String.fromCharCode(this.serialBuffer[t]);return e.join("")}readString(){let e=this.bufferAsString();return this.serialBuffer.length=0,e}readStringUntil(e,t=!1){let r=this.bufferAsString(),i=r.indexOf(e);if(i>-1){let t=r.substr(0,i);return this.serialBuffer=this.serialBuffer.slice(i+e.length),t}return t?(this.serialBuffer.length=0,r):null}readLine(){return this.readStringUntil(this.lineEnding)}available(){return this.serialBuffer.length}clear(){this.serialBuffer.length=0}async write(e){if(!this.portOpen)return this.emit("writeerror",new Error("Cannot write: port not open."));if(!this.writer)return this.emit("writeerror",new Error("Cannot write: stream not writable"));let t;e instanceof Uint8Array?t=e:"number"==typeof e?t=new Uint8Array([e]):"string"==typeof e?t=this.encoder.encode(e):Array.isArray(e)&&(t=Uint8Array.from(e));try{await this.writer.write(t)}catch(e){this.emit("writeerror",e)}}print(e){this.write(e)}println(e){this.write(e+this.lineEnding)}setLineEnding(e){this.lineEnding=e}emit(e,t){let r=this.emitter.dispatchEvent(new CustomEvent(e,{detail:t,cancelable:!0}));e.endsWith("error")&&"error"!==e&&r&&this.emitter.dispatchEvent(new CustomEvent("error",{detail:t}))}on(t,r){let i=e=>r(e.detail,e.preventDefault.bind(e));e.set(r,i),this.emitter.addEventListener(t,i)}off(t,r){let i=e.get(r);this.emitter.removeEventListener(t,i)}static checkSupport(){return"serial"in navigator}}}));
