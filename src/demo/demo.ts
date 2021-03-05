import WebSerial from "../main";

const $t = document.getElementById("t");
const $c = document.getElementById("c");
const $s = document.getElementById("s");

function print(msg) {
  $t.textContent += msg + "\n";
  $t.scrollTop = $t.scrollHeight;
}

$c.addEventListener("click", function () {
  $t.textContent = "";
});

if (WebSerial.checkSupport()) {
  print("WebSerial support available");
} else {
  print("WebSerial not supported!");
}

const serial = new WebSerial();

serial.getPorts();
serial.on("noport", () => {
  print("No ports available. Click connect to choose a port");
});

serial.on("portavailable", (info: SerialPortInfo) => {
  print("Using port:");
  print("  Product ID: " + info.usbProductId.toString(16));
  print("  Vendor ID:  " + info.usbVendorId.toString(16));
  print("Opening...");
  serial.open();
});

serial.on("open", () => {
  print("opened!");
});

serial.on("data", () => {
  let line = serial.readLine();
  if (line) {
    print(line);
    $t.textContent = $t.textContent.substr(-1000);
  }
});

serial.on("readerror", (err) => {
  print("READ ERROR! See details in console");
  console.error(err);
});

$s.addEventListener("click", function () {
  serial.requestPort();
});
