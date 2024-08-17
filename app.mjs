import { createServer } from "http";
import { readFileSync, promises, statSync } from "fs";
import { execSync, spawn } from "child_process";
import { Readable } from "stream";
import path from "path";

const myStream = new Readable({
    objectMode: true,
    read() {},
});

let output = {
    output: "",
};

const proxy = new Proxy(output, {
    set: function (target, prop, value) {
        myStream.push(value);
        console.log(value);
        target[prop] = value;
        return true;
    },
});

let safeToDownload = true;

let fileFormat = "";
let videoName = "";
let contentType = "";

for (const file of await promises.readdir("downloads")) {
    await promises.unlink(path.join("downloads", file));
}

createServer(async (req, res) => {
    if (req.url == "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(readFileSync("./index.html", "utf8"));
    } else if (req.url == "/admin") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(readFileSync("./admin.html", "utf8"));
    } else if (req.url == "/js/script.js") {
        res.writeHead(200, { "Content-Type": "application/javascript" });
        res.end(readFileSync("./js/script.js", "utf8"));
    } else if (req.url.startsWith("/tim/")) {
        let urll = req.url.replace("/tim/", "");
        let regex = /^(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/;
        if (!regex.test(urll)) {
            res.writeHead(406, { "Content-Type": "text/plain" });
            res.end("Invalid URL");
            safeToDownload = true;
            return;
        }
        try {
            const result = execSync('yt-dlp --print "%(channel)s - %(duration>%H:%M:%S)s - %(title)s" ' + urll);
            videoName = result.toString("utf8").split(" - ").slice(2).join(" - ").trim();
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end(result.toString("utf8"));
        } catch (e) {
            res.writeHead(406, { "Content-Type": "text/plain" });
            res.end("Video not found");
        }
    } else if (req.url == "/stream") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "cache-control": "no-cache", Connection: "keep-alive" });
        myStream.pipe(res);
        res.addListener("close", () => {
            if (req.headers["main"] == "true" && safeToDownload == false) {
                console.log("Recieved broken pipe. Exiting");
                process.exit();
            }
        });
    } else if (req.url == "/format") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(videoName + "." + fileFormat);
        fileFormat = "";
        videoName = "";
    } else if (req.url.startsWith("/dl/")) {
        downloadVideo(req, res, false);
    } else if (req.url.startsWith("/dlaud/")) {
        downloadVideo(req, res, true);
    } else if (req.url == "/prod") {
        res.writeHead(200, { "Content-Type": contentType, "Content-Length": statSync("downloads/file." + fileFormat).size });
        res.end(readFileSync("downloads/file." + fileFormat));
        for (const file of await promises.readdir("downloads")) {
            await promises.unlink(path.join("downloads", file));
        }
        safeToDownload = true;
    } else if (req.url == "/reset") {
        process.exit();
    } else if (req.url.startsWith("/listformats/")) {
        let urll = req.url.replace("/listformats/", "");
        try {
            const result = execSync("yt-dlp -J " + urll);
            const json = JSON.parse(result.toString("utf8")).formats;
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(json, ["format_id", "resolution", "format_note", "ext", "vbr", "abr", "vcodec", "acodec"]));
        } catch (e) {
            res.writeHead(406, { "Content-Type": "text/plain" });
            res.end("Video not found");
            console.log(e);
            return;
        }
    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404: Page not found");
    }
}).listen(process.env.PORT || 80);

async function downloadVideo(req, res, audioOnly) {
    if (safeToDownload) {
        safeToDownload = false;
        for (const file of await promises.readdir("downloads")) {
            await promises.unlink(path.join("downloads", file));
        }
        let urll = req.url.replace(audioOnly ? "/dlaud/" : "/dl/", "");
        let args = [];
        if (audioOnly) {
            args.push("-f", "ba*", "-x");
        }
        if (req.headers["time"]) {
            const time = req.headers["time"].trim();
            let regex = /^\*((\d+:)?(\d+:)?\d+)-(((\d+:)?(\d+:)?\d+)|inf)$/;
            if (!regex.test(time)) {
                res.writeHead(406, { "Content-Type": "text/plain" });
                res.end("Invalid time");
                safeToDownload = true;
                return;
            }
            args.push("--download-sections", time);
        }
        if (req.headers["format"]) {
            const format = req.headers["format"].trim();
            let regex = /^(?:\d+(?:\+\d+)+)|(?:[a-zA-Z_*]+)$/;
            if (!regex.test(format)) {
                res.writeHead(406, { "Content-Type": "text/plain" });
                res.end("Invalid format");
                safeToDownload = true;
                return;
            }
            args.push("-f", format);
        }
        let regex = /^(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/;
        if (!regex.test(urll)) {
            res.writeHead(406, { "Content-Type": "text/plain" });
            res.end("Invalid URL");
            safeToDownload = true;
            return;
        }
        args.push("--no-playlist", "--break-on-reject", "--match-filter", "!playlist", "-o", "downloads/file.%(ext)s", urll);
        try {
            const result = spawn("yt-dlp", args);
            result.stdout.setEncoding("utf8");
            result.stdout.on("data", (data) => {
                data = data.toString("utf8").trim();
                proxy.output = data;
            });
            result.stderr.setEncoding("utf8");
            result.stderr.on("data", (data) => {
                data = data.toString("utf8").trim();
                proxy.output = data;
            });
            result.on("close", async (code) => {
                if (!code == 0) {
                    if (
                        output.output.includes(
                            "[info] Encountered a video that did not match filter, stopping due to --break-match-filter"
                        )
                    ) {
                        proxy.output = "ERROR: Playlists are not supported at this time. Please download videos individually.";
                        return;
                    }
                    proxy.output += "\nERROR: An error occured. See above for more information";
                    return;
                }
                const files = await promises.readdir("downloads");
                if (files[0] == ".DS_Store") {
                    await promises.unlink(path.join("downloads", files[0]));
                    files.shift();
                }
                fileFormat = files[0].split(".")[1];
                const ress = fileFormat;
                let targetFileFormat = req.headers["filetype"];
                if (targetFileFormat == "notwebm" && ress == "webm") {
                    targetFileFormat = "mp4";
                } else {
                    targetFileFormat = ress;
                }
                if (targetFileFormat != "keep" && targetFileFormat != ress) {
                    proxy.output = `Downloaded file was a ${ress}, converting to ${targetFileFormat}. This may take a while...\n`;
                    let args = [];
                    const child = spawn("ffmpeg", [
                        "-y",
                        "-v",
                        "quiet",
                        "-stats",
                        "-fflags",
                        "+genpts",
                        "-i",
                        "downloads/file." + ress,
                        "-r",
                        "24",
                        "downloads/file." + targetFileFormat,
                        "-hide_banner",
                        "-loglevel",
                        "error",
                    ]);
                    child.stdout.setEncoding("utf8");
                    child.stdout.on("data", (data) => {
                        data = data.toString("utf8");
                        proxy.output =
                            `Downloaded file was a ${ress}, converting to ${targetFileFormat}. This may take a while...\n` + data;
                    });
                    child.stderr.setEncoding("utf8");
                    child.stderr.on("data", (data) => {
                        data = data.toString("utf8");
                        proxy.output =
                            `Downloaded file was a ${ress}, converting to ${targetFileFormat}. This may take a while...\n` + data;
                    });
                    child.on("close", async (code) => {
                        fileFormat = code == 0 ? targetFileFormat : ress;
                        contentType = (audioOnly ? "audio/" : "video/") + fileFormat;
                        proxy.output = "Done!";
                    });
                } else {
                    contentType = (audioOnly ? "audio/" : "video/") + fileFormat;
                    proxy.output = "Done!";
                }
            });
            res.writeHead(202, { "Content-Type": "text/plain" });
            res.end("Downloading...");
        } catch (e) {
            res.writeHead(406, { "Content-Type": "text/plain" });
            res.end("Video not found");
            safeToDownload = true;
            return;
        }
    } else {
        res.writeHead(409, { "Content-Type": "text/plain" });
        res.end("A download is currently in progress. Please wait for it to finish.");
    }
}
