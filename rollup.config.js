import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import livereload from "rollup-plugin-livereload";
import { terser } from "rollup-plugin-terser";

const DEV_MODE = !!process.env.ROLLUP_WATCH;

function serve() {
  let server;
  function toExit() {
    if (server) server.kill(0);
  }
  return {
    writeBundle() {
      if (server) return;
      server = require("child_process").spawn(
        "npm",
        ["run", "start", "--", "--dev"],
        {
          stdio: ["ignore", "inherit", "inherit"],
          shell: true,
        }
      );
      process.on("SIGTERM", toExit);
      process.on("exit", toExit);
    },
  };
}

const demo = () => ({
  input: "src/demo/demo.ts",
  output: {
    file: "demo/demo.js",
    format: "iife",
    sourcemap: true,
  },
  plugins: [
    resolve({
      browser: true,
    }),
    typescript({
      sourceMap: true,
      inlineSources: true,
      target: "ES2019",
      moduleResolution: "node",
    }),
    serve(),
    livereload("demo"),
  ],
});

const build = () => [
  {
    input: "src/main.ts",
    output: {
      file: "build/p5.webserial.js",
      format: "umd",
      name: "p5.WebSerial",
      exports: "auto",
      sourcemap: false,
    },
    plugins: [
      resolve({
        browser: true,
      }),
      typescript({
        sourceMap: false,
        inlineSources: false,
        target: "ES2018",
        moduleResolution: "node",
      }),
      terser(),
    ],
  },
  {
    input: "src/demo/demo.ts",
    output: {
      file: "demo/demo.js",
      format: "iife",
      sourcemap: false,
    },
    plugins: [
      resolve({
        browser: true,
      }),
      typescript({
        sourceMap: false,
        inlineSources: false,
        target: "ES2019",
        moduleResolution: "node",
      }),
      terser(),
    ],
  },
];

export default DEV_MODE ? demo() : build();
