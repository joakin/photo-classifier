const http = require("http");
const fs = require("fs");
const path = require("path");

let folder = process.argv.slice(2)[0];

if (folder) {
  let stat = fs.statSync(folder, { throwIfNoEntry: false });
  if (!stat || !stat.isDirectory()) throw new Error("Not a folder");
} else throw new Error("Couldn't get the folder");

const server = http.createServer(async (req, res) => {
  if (req.url === "/") {
    fs.createReadStream("./index.html").pipe(res);
  } else if (req.url === "/files-and-folders") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getFilesAndFolders(folder)));
  } else if (req.url === "/move") {
    try {
      let { file, folder } = await getJSONBody(req);
      let newFile = await move(file, folder);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ file: newFile }));
    } catch (e) {
      console.error(e);
      plain(res, 500, e.message);
    }
  } else {
    let file = decodeURIComponent(req.url);
    let stat = fs.statSync(file, { throwIfNoEntry: false });
    if (!stat || stat.isDirectory()) plain(res, 404, "not found");
    else {
      let total = stat.size;
      if (req.headers.range) {
          let range = req.headers.range;
          let parts = range.replace(/bytes=/, "").split("-");
          let partialStart = parts[0];
          let partialEnd = parts[1];

          let start = parseInt(partialStart, 10);
          let end = partialEnd ? parseInt(partialEnd, 10) : total-1;
          let chunksize = (end-start)+1;
          let readStream = fs.createReadStream(file, {start: start, end: end});
          res.writeHead(206, {
              'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
              'Accept-Ranges': 'bytes', 'Content-Length': chunksize
          });
          readStream.pipe(res);
      } else {
          fs.createReadStream(file).pipe(res);
      }
    }
  }
});

function plain(res, code, text) {
  res.writeHead(code, { "Content-Type": "text/plain" });
  res.end(text);
}

server.listen(8000);

function getFilesAndFolders(dir) {
  let results = { files: [], folders: [] };

  fs.readdirSync(dir).forEach((file) => {
    if (file === ".DS_Store") return;

    file = path.join(dir, file);
    let stat = fs.statSync(file);

    if (stat && stat.isDirectory()) {
      results.folders.push(file);
    } else results.files.push(file);
  });

  return results;
}

function getJSONBody(request) {
  return new Promise((res, rej) => {
    let body = [];
    request
      .on("error", (err) => {
        rej(err);
      })
      .on("data", (chunk) => {
        body.push(chunk);
      })
      .on("end", () => {
        body = Buffer.concat(body).toString();
        let data = JSON.parse(body);
        res(data);
      });
  });
}

function move(file, folder) {
  return new Promise((res, rej) => {
    let fileName = path.basename(file);
    let newFile = path.join(folder, fileName);
    fs.rename(file, newFile, (err) => {
      if (err) rej(err);
      else res(newFile);
    });
  });
}
