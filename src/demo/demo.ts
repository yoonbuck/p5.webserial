import WebSerial from "../main";

const SCROLLBACK = -2500;

const $console = document.getElementById("console");
const $clearbtn = document.getElementById("clear");
const $requestbtn = document.getElementById("request");
const $openbtn = document.getElementById("open");
const $closebtn = document.getElementById("close");
const $text = document.getElementById("input") as HTMLInputElement;
const $lineEnding = document.getElementById("lineending") as HTMLSelectElement;
const $mode = document.getElementById("mode") as HTMLSelectElement;
const $baud = document.getElementById("baud") as HTMLSelectElement;
const $sendbtn = document.getElementById("send");

function println(msg: string) {
  print(msg + "\n");
}
function print(msg: string) {
  $console.textContent = ($console.textContent + msg).substr(SCROLLBACK);
  $console.scrollTo($console.scrollLeft, 100000);
}

$clearbtn.addEventListener("click", function () {
  $console.textContent = "";
});

if (WebSerial.checkSupport()) {
  println("WebSerial support available");
} else {
  println("WebSerial not supported!");
}

const serial = new WebSerial();

serial.getPorts();
serial.on("noport", () => {
  println("No ports available. Click request to choose a port");
});

serial.on("portavailable", (info: SerialPortInfo) => {
  println("Found port:");
  println("  Product ID: " + info.usbProductId.toString(16));
  println("  Vendor ID:  " + info.usbVendorId.toString(16));
  println("Click open to connect to this port");
});

$openbtn.addEventListener("click", function () {
  println("Opening port...");
  serial.open({ baudRate: parseInt($baud.value) });
});

$closebtn.addEventListener("click", function () {
  println("Closing port...");
  serial.close();
});

serial.on("open", () => {
  println("Port opened!");
});

serial.on("close", () => {
  println("Port closed!");
});

serial.on("data", () => {
  let mode = $mode.value;
  if (mode === "line") {
    let line = serial.readLine();
    if (line) println(line);
  } else if (mode === "char") {
    while (serial.available()) print(serial.readChar());
  } else {
    while (serial.available()) println(bytestr(serial.read()));
  }
});

serial.on("requesterror", (e: CustomEvent) => {
  println("Request error.");
});

serial.on("error", (err: Error) => {
  println("Error: " + err.message);
  console.error(err);
});

$requestbtn.addEventListener("click", function () {
  serial.requestPort();
});

function bytestr(e: number) {
  return ("0" + e.toString(16)).substr(-2);
}

function le(e: string) {
  if (e === "2") {
    return "\r\n";
  } else if (e === "1") {
    return "\n";
  } else {
    return "";
  }
}

function send() {
  serial.print($text.value + le($lineEnding.value));
  $text.value = "";
}

$sendbtn.addEventListener("click", send);
$text.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    send();
  }
});
