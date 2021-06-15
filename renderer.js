// In the renderer process.
const { desktopCapturer, ipcRenderer } = require("electron");

const fs = require("fs");
const path = require("path");

// We can capture every frame buffer, but lets just get the desktop
// ["screen", "window"]

const baseDir = process.platform === "win32" ? "C:\\" : "/tmp/";

const root = document.getElementById("root");

const newDiv = document.createElement("p");
newDiv.textContent = JSON.stringify({
  os: process.platform,
  node: process.versions.node,
  v8: process.versions.v8,
  electron: process.versions.electron,
});

document.body.insertBefore(newDiv, root);

desktopCapturer
  .getSources({ types: ["screen", "window"] })
  .then(async (sources) => {
    // print each of our sources
    console.log(sources);

    try {
      fs.mkdirSync("/tmp/screenshots");
    } catch (e) {
      console.log(e);
    }

    const mappings = {};

    for (const source of sources) {
      let filepath;

      const idFileName = source.id.replace(/[\W_]+/g, "_");

      if (source.name === "Entire Screen") {
        filepath = path.join(baseDir, "screenshots", `desktop.png`);
      } else if (source.name === "screenshot-test") {
        filepath = path.join(baseDir, "screenshots", `application.png`);
      } else {
        // don't bother taking any of the other framebuffers
        filepath = path.join(baseDir, "screenshots", `${idFileName}.png`);
      }

      mappings[idFileName] = source.name;

      await renderSource(source, filepath);
    }

    fs.writeFileSync(
      path.join(baseDir, "screenshots", `mapping.json`),
      JSON.stringify(mappings)
    );

    // Quit when we're done
    ipcRenderer.send("quit");
  });

async function renderSource(source, filepath) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: source.id,
        },
      },
    });

    const track = stream.getVideoTracks()[0];
    imageCapture = new ImageCapture(track);

    const bitmap = await imageCapture.grabFrame();

    const blob = await new Promise((res) => {
      // create a canvas
      const canvas = document.createElement("canvas");
      // resize it to the size of our ImageBitmap
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;

      let ctx = canvas.getContext("bitmaprenderer");
      // draw the bitmap on the canvas
      ctx.transferFromImageBitmap(bitmap);
      // get it back as a Blob
      return canvas.toBlob(res);
    });

    const arraybuffer = await blob.arrayBuffer();
    const buf = Buffer.from(arraybuffer);

    fs.writeFileSync(filepath, buf);

    // Free the resources
    bitmap.close();

    console.log(filepath, buf);
  } catch (e) {
    console.log(e);
  }
}
