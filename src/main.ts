import { collapseTextChangeRangesAcrossMultipleVersions } from "typescript";

type WebSerialEvent =
  | "noport"
  | "portavailable"
  | "open"
  | "close"
  | "error"
  | "requesterror"
  | "openerror"
  | "closeerror"
  | "readerror"
  | "writeerror"
  | "data";

type LineEnding = "\n" | "\r\n";

const callbackMap = new WeakMap<
  (detail: any, stopPropagation: () => void) => void,
  (evt: CustomEvent) => void
>();

export default class WebSerial {
  serialBuffer: number[] = [];
  serialConnected = false;
  serialPort: string;
  portOpen = false;
  shouldClose = false;
  isOpening = false;

  lineEnding: LineEnding = "\r\n";

  portInfo: SerialPortInfo;
  port: SerialPort;

  writer: WritableStreamDefaultWriter<Uint8Array>;

  emitter = new EventTarget();
  encoder = new TextEncoder();

  async requestPort(filters: SerialPortFilter[] = [{ usbVendorId: 0x2341 }]) {
    try {
      this.port = await navigator.serial.requestPort({ filters });
      this.portInfo = this.port.getInfo();
      this.emit("portavailable", this.portInfo);
    } catch (e) {
      this.emit("requesterror", e);
    }
  }

  async getPorts(
    choosePort: (ports: SerialPort[]) => SerialPort = (a) => a[0]
  ) {
    const ports = await navigator.serial.getPorts();
    let port: SerialPort;
    if (ports.length) {
      port = choosePort(ports);
    }
    if (port) {
      this.port = port;
      this.portInfo = this.port.getInfo();
      this.emit("portavailable", this.portInfo);
    } else {
      this.emit("noport");
    }
  }

  async open(options: SerialOptions = { baudRate: 9600 }) {
    if (!this.port) {
      return this.emit(
        "openerror",
        new Error("Cannot open before selecting a port.")
      );
    }
    if (this.portOpen) {
      return this.emit("openerror", new Error("Port is already open."));
    }
    if (this.isOpening) {
      return this.emit("openerror", new Error("Port is already opening."));
    }
    try {
      await this.port.open(options);
      this.writer = this.port.writable.getWriter();
      this.portOpen = true;
      this.emit("open");
      this.readLoop();
      this.isOpening = false;
    } catch (e) {
      this.isOpening = false;
      this.emit("openerror", e);
    }
  }

  async close() {
    if (!this.portOpen) {
      return this.emit("closeerror", new Error("Port is already closed."));
    }
    if (this.shouldClose) {
      return this.emit("closeerror", new Error("Port is already closing."));
    }

    this.shouldClose = true;
  }

  private async readLoop() {
    const self = this;
    while (this.port.readable) {
      const reader = this.port.readable.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (this.shouldClose) {
            reader.releaseLock();
            await stop();
            return;
          }
          if (done) {
            reader.releaseLock();
            break;
          }
          if (value) {
            this.serialBuffer = this.serialBuffer.concat(Array.from(value));
            this.emit("data");
          }
        }
      } catch (error) {
        this.emit("readerror", error);
      }
    }
    await stop();
    async function stop() {
      self.writer.releaseLock();
      await self.port.close();
      self.portOpen = false;
      self.shouldClose = false;
      self.emit("close");
      return;
    }
  }

  read(): number {
    if (this.serialBuffer.length > 0) {
      return this.serialBuffer.shift();
    } else {
      return -1;
    }
  }

  readChar(): string {
    if (this.serialBuffer.length > 0) {
      return String.fromCharCode(this.serialBuffer.shift());
    } else {
      return null;
    }
  }

  readBytes(): Uint8Array {
    let res = Uint8Array.from(this.serialBuffer);
    this.serialBuffer.length = 0;
    return res;
  }

  readBytesUntil(charToFind: string, returnAllIfNotFound = false): Uint8Array {
    let idx = this.serialBuffer.indexOf(charToFind.charCodeAt(0));
    if (idx !== -1) {
    } else {
      if (returnAllIfNotFound) {
        return this.readBytes();
      } else {
        return null;
      }
    }
  }

  private bufferAsString(): string {
    let stringBuffer = new Array<string>(this.serialBuffer.length);
    for (let i = 0; i < this.serialBuffer.length; i++) {
      stringBuffer[i] = String.fromCharCode(this.serialBuffer[i]);
    }
    return stringBuffer.join("");
  }

  readString(): string {
    let str = this.bufferAsString();
    this.serialBuffer.length = 0;
    return str;
  }

  readStringUntil(stringToFind: string, returnAllIfNotFound = false): string {
    let str = this.bufferAsString();
    let idx = str.indexOf(stringToFind);

    if (idx > -1) {
      let returnStr = str.substr(0, idx);
      this.serialBuffer = this.serialBuffer.slice(idx + stringToFind.length);
      return returnStr;
    } else {
      if (returnAllIfNotFound) {
        this.serialBuffer.length = 0;
        return str;
      } else {
        return null;
      }
    }
  }

  readLine(): string {
    return this.readStringUntil(this.lineEnding);
  }

  available(): number {
    return this.serialBuffer.length;
  }

  clear() {
    this.serialBuffer.length = 0;
  }

  async write(data: number | number[] | string | Uint8Array): Promise<void> {
    if (!this.portOpen) {
      return this.emit("writeerror", new Error("Cannot write: port not open."));
    }
    if (!this.writer) {
      return this.emit(
        "writeerror",
        new Error("Cannot write: stream not writable")
      );
    }
    let chunk: Uint8Array;
    if (data instanceof Uint8Array) {
      chunk = data;
    } else if (typeof data === "number") {
      chunk = new Uint8Array([data]);
    } else if (typeof data === "string") {
      chunk = this.encoder.encode(data);
    } else if (Array.isArray(data)) {
      chunk = Uint8Array.from(data);
    }
    try {
      await this.writer.write(chunk);
    } catch (e) {
      this.emit("writeerror", e);
    }
  }

  print(data: string) {
    this.write(data);
  }

  println(data: string) {
    this.write(data + this.lineEnding);
  }

  setLineEnding(ending: LineEnding) {
    this.lineEnding = ending;
  }

  private emit(event: WebSerialEvent, detail?: any) {
    let dnp = this.emitter.dispatchEvent(
      new CustomEvent(event, { detail, cancelable: true })
    );
    if (event.endsWith("error") && event !== "error" && dnp) {
      this.emitter.dispatchEvent(new CustomEvent("error", { detail }));
    }
  }

  on(
    event: WebSerialEvent,
    listener: (detail: any, stopPropagation: () => void) => void
  ) {
    let realListener = (evt: CustomEvent) =>
      listener(evt.detail, evt.preventDefault.bind(evt));
    callbackMap.set(listener, realListener);
    this.emitter.addEventListener(
      event,
      (realListener as unknown) as EventListener // yuck!!
    );
  }

  off(event: WebSerialEvent, listener: (detail: any) => void) {
    let realListener = callbackMap.get(listener) as unknown;
    this.emitter.removeEventListener(event, realListener as EventListener);
  }

  /**
   * Check whether the browser supports WebSerial
   */
  static checkSupport(): boolean {
    return "serial" in navigator;
  }
}
