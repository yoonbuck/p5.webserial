type WebSerialEvent =
  | "noport"
  | "portavailable"
  | "open"
  | "close"
  | "readerror"
  | "data";

const callbackMap = new WeakMap<
  (detail: any) => void,
  ({ detail: any }) => void
>();

export default class WebSerial {
  serialBuffer: number[] = [];
  serialConnected = false;
  serialPort: string;
  portOpen = false;

  portInfo: SerialPortInfo;
  port: SerialPort;

  emitter = new EventTarget();

  async requestPort(filters: SerialPortFilter[] = [{ usbVendorId: 0x2341 }]) {
    this.port = await navigator.serial.requestPort({ filters });
    this.portInfo = this.port.getInfo();
    this.emit("portavailable", this.portInfo);
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
      throw new Error(
        "Call getPorts() or requestPort() before open() to select a port."
      );
    }
    await this.port.open(options);
    this.portOpen = true;
    this.emit("open");

    this.readLoop();
  }

  async close() {
    if (!this.portOpen) {
      throw new Error("");
    }
    await this.port.close();
    this.portOpen = false;
    this.emit("close");
  }

  private async readLoop() {
    while (this.port.readable) {
      const reader = this.port.readable.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
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
    let res = new Uint8Array(this.serialBuffer);
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
    return this.readStringUntil("\r\n");
  }

  available(): number {
    return this.serialBuffer.length;
  }

  clear() {
    this.serialBuffer.length = 0;
  }

  private emit(event: WebSerialEvent, detail?: any) {
    this.emitter.dispatchEvent(new CustomEvent(event, { detail }));
  }

  on(event: WebSerialEvent, listener: (detail: any) => void) {
    let realListener = ({ detail }) => listener(detail);
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
