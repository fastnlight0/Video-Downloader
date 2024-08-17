let badStart = false;
let badEnd = false;
document.getElementById("toggleButton").addEventListener("click", function () {
    var div = document.getElementById("toggleDiv");
    if (div.classList.contains("show")) {
        div.classList.remove("show");
    } else {
        div.classList.add("show");
    }
});

// Custom start time text box
document.querySelectorAll('input[name="startR"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
        document.getElementById("customStartInput").disabled = this.value !== "2";
    });
});

// custom end time text box
document.querySelectorAll('input[name="endR"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
        document.getElementById("customEndInput").disabled = this.value !== "2";
    });
});

// custom file type text box
document.querySelectorAll('input[name="filetypeR"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
        document.getElementById("customTypeInput").disabled = this.value !== "3";
    });
});
// custom format text box
document.querySelectorAll('input[name="formatR"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
        document.getElementById("customFormatInput").disabled = this.value !== "2";
    });
});

// regex for time input

// Select the input element
let startBox = document.getElementById("customStartInput");
let endBox = document.getElementById("customEndInput");

// Function to validate the input
function validateInput(input) {
    // Regular expression for HH:MM:SS, MM:SS, or SS format
    let regex = /^((\d+:)?(\d+:)?\d+)?$/;
    return regex.test(input);
}

// Add an event listener for input change
startBox.addEventListener("input", function () {
    if (!validateInput(this.value)) {
        // If the input is not valid, add a red border and tooltip
        badStart = true;
        document.getElementById("customInputTooltip").style.opacity = 1;
        this.style.border = "4px solid red";
    } else {
        // If the input is valid, remove the red border and tooltip
        badStart = false;
        document.getElementById("customInputTooltip").style.opacity = badEnd ? 1 : 0;
        this.style.border = "";
        this.title = "";
    }
});
endBox.addEventListener("input", function () {
    if (!validateInput(this.value)) {
        // If the input is not valid, add a red border and tooltip
        badEnd = true;
        document.getElementById("customInputTooltip").style.opacity = 1;
        this.style.border = "4px solid red";
    } else {
        // If the input is valid, remove the red border and tooltip
        badEnd = false;
        document.getElementById("customInputTooltip").style.opacity = badStart ? 1 : 0;
        this.style.border = "";
        this.title = "";
    }
});

// download code
document.getElementById("durl").addEventListener("keyup", function (event) {
    event.preventDefault();
    if (event.key === "Enter") {
        document.getElementById("db").click();
    }
});
function dl(audioOnly) {
    document.getElementById("durl").hidden = true;
    document.getElementById("db").hidden = true;
    document.getElementById("dba").hidden = true;
    document.getElementById("formatsTable").hidden = true;
    document.getElementById("toggleButton").hidden = true;
    document.getElementById("toggleDiv").classList.remove("show");
    document.getElementById("mainTxt").innerHTML = audioOnly ? "Starting audio only download..." : "Starting download...";
    fetch("tim/" + document.getElementById("durl").value)
        .then((res) => {
            if (res.ok) {
                return res.text();
            }
            return "0";
        })
        .then((txt) => {
            if (txt == "0") {
                document.getElementById("mainTxt").innerHTML = "Invalid URL";
                setTimeout(() => {
                    document.getElementById("mainTxt").innerHTML = "Enter URL below:";
                }, 2000);
                document.getElementById("durl").hidden = false;
                document.getElementById("db").hidden = false;
                document.getElementById("dba").hidden = false;
                document.getElementById("toggleButton").hidden = false;
                throw new Error("Invalid URL");
            }
            document.getElementById("mainTxt").innerHTML = txt;
        })
        .then(() => {
            document.getElementById("output").hidden = false;
            let heads = {};
            if (!(badStart || badEnd)) {
                heads.time = `*${
                    document.querySelector('input[name="startR"]:checked').value == "1"
                        ? "0"
                        : document.getElementById("customStartInput").value
                }-${
                    document.querySelector('input[name="endR"]:checked').value == "1"
                        ? "inf"
                        : document.getElementById("customEndInput").value
                }`;
            }
            if (document.querySelector('input[name="filetypeR"]:checked').value == "3") {
                heads.filetype = document.getElementById("customTypeInput").value;
            } else {
                heads.filetype = document.querySelector('input[name="filetypeR"]:checked').value == "1" ? "notwebm" : "keep";
            }
            if (document.querySelector('input[name="formatR"]:checked').value == "2") {
                heads.format = document.getElementById("customFormatInput").value;
            }
            fetch((audioOnly ? "/dlaud/" : "/dl/") + document.getElementById("durl").value, { headers: heads }).then(
                async function (res) {
                    if (res.status != 202) {
                        document.getElementById("durl").hidden = false;
                        document.getElementById("db").hidden = false;
                        document.getElementById("dba").hidden = false;
                        document.getElementById("toggleButton").hidden = false;
                        document.getElementById("output").hidden = true;
                        document.getElementById("mainTxt").innerHTML = await res.text();
                        return;
                    }
                    return res.blob();
                }
            );
            fetch("/stream", { headers: { main: true } })
                .then((res) => res.body)
                .then((body) => {
                    const reader = body.getReader();
                    reader.read().then(async function processText({ done, value }) {
                        if (done) {
                            console.log("Stream complete");
                            return;
                        }
                        let string = new TextDecoder().decode(value);
                        string = string.replace(/(?:\r\n|\r|\n)/g, "<br>");
                        console.log(string);
                        document.getElementById("output").innerHTML = string;
                        if (string === "Done!") {
                            document.getElementById("mainTxt").innerHTML =
                                "Download complete! Please wait as the file is being transferred to your device.";
                            document.getElementById("dlProgContainer").hidden = false;
                            document.getElementById("dlProg").hidden = false;
                            document.getElementById("dlProgLabel").hidden = false;
                            let response = await fetch("/prod");
                            const reader = response.body.getReader();
                            const contentLength = +response.headers.get("Content-Length");
                            let receivedLength = 0;
                            let chunks = [];
                            while (true) {
                                const { done, value } = await reader.read();

                                if (done) {
                                    break;
                                }

                                chunks.push(value);
                                receivedLength += value.length;

                                const percentComplete = Math.round((receivedLength / contentLength) * 100);
                                console.log(`Received ${receivedLength} of ${contentLength} (${percentComplete}%)`);

                                document.getElementById("dlProg").style.width = `${percentComplete}%`;
                                document.getElementById("dlProgLabel").innerHTML = `${percentComplete}%`;
                            }

                            let blob = new Blob(chunks);
                            fetch("/format")
                                .then((res) => res.text())
                                .then((text) => {
                                    reader.cancel();
                                    var url = window.URL.createObjectURL(blob);
                                    let dlBtn = document.getElementById("redownloada");
                                    document.getElementById("redownload").hidden = false;
                                    dlBtn.href = url;
                                    dlBtn.download = text;
                                    dlBtn.click();
                                });
                        } else if (string.includes("ERROR")) {
                            reader.cancel();
                            document.getElementById("mainTxt").innerHTML = "An error occured. See below for more information";
                            document.getElementById("durl").hidden = false;
                            document.getElementById("db").hidden = false;
                            document.getElementById("dba").hidden = false;
                            document.getElementById("toggleButton").hidden = false;
                            return;
                        }
                        reader.read().then(processText);
                    });
                });
        })
        .catch((err) => {
            console.log(err);
        });
}
document.getElementById("db").addEventListener("click", () => {
    dl(false);
});
document.getElementById("dba").addEventListener("click", () => {
    dl(true);
});

document.getElementById("listFormatsBtn").addEventListener("click", () => {
    document.getElementById("durl").hidden = true;
    document.getElementById("db").hidden = true;
    document.getElementById("dba").hidden = true;
    document.getElementById("toggleButton").hidden = true;
    document.getElementById("formatsTable").hidden = true;
    document.getElementById("toggleDiv").classList.remove("show");
    document.getElementById("mainTxt").innerHTML = "Fetching available formats...";
    fetch("listformats/" + document.getElementById("durl").value)
        .then((res) => {
            if (res.ok) {
                return res.text();
            }
            return "0";
        })
        .then((txt) => {
            if (txt == "0") {
                document.getElementById("mainTxt").innerHTML = "Invalid URL";
                setTimeout(() => {
                    document.getElementById("mainTxt").innerHTML = "Enter URL below:";
                }, 2000);
                document.getElementById("durl").hidden = false;
                document.getElementById("db").hidden = false;
                document.getElementById("dba").hidden = false;
                document.getElementById("toggleButton").hidden = false;
                throw new Error("Invalid URL");
            }
            buildHtmlTable(JSON.parse(txt), "#formatsTable");
            document.getElementById("formatsTable").hidden = false;
            document.getElementById("mainTxt").innerHTML = "Enter URL below:";
            document.getElementById("durl").hidden = false;
            document.getElementById("db").hidden = false;
            document.getElementById("dba").hidden = false;
            document.getElementById("toggleButton").hidden = false;
            document.getElementById("toggleDiv").classList.add("show");
        });
});

function buildHtmlTable(data, selector) {
    var columns = addAllColumnHeaders(data, selector);

    for (var i = 0; i < data.length; i++) {
        var row = document.createElement("tr");
        for (var colIndex = 0; colIndex < columns.length; colIndex++) {
            var cellValue = data[i][columns[colIndex]] || "";
            var cell = document.createElement("td");
            cell.textContent = cellValue;
            row.appendChild(cell);
        }
        document.querySelector(selector).appendChild(row);
    }
}

// Adds a header row to the table and returns the set of columns.
function addAllColumnHeaders(data, selector) {
    var columnSet = [];
    var headerTr = document.createElement("tr");

    for (var i = 0; i < data.length; i++) {
        var rowHash = data[i];
        for (var key in rowHash) {
            if (columnSet.indexOf(key) === -1) {
                columnSet.push(key);
                var th = document.createElement("th");
                th.textContent = key;
                headerTr.appendChild(th);
            }
        }
    }
    document.querySelector(selector).appendChild(headerTr);

    return columnSet;
}
