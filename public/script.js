const form = document.getElementById("uploadForm");
const result = document.getElementById("result");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (response.ok) {
            const fileNames = data.fileNames; // Danh sách file trả về từ server
            result.innerHTML = `
                <p style="color: green;">Successfully processed ${fileNames.length} file(s).</p>
                <button id="downloadButton">Download All Files</button>
            `;

            // Add event listener to the download button
            const downloadButton = document.getElementById("downloadButton");
            downloadButton.addEventListener("click", async () => {
                const upoutputResponse = await fetch("/upoutput", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ fileNames }),
                });

                const upoutputData = await upoutputResponse.json();

                if (upoutputResponse.ok) {
                    // Tải về từng file
                    upoutputData.filePaths.forEach((filePath) => {
                        const link = document.createElement("a");
                        link.href = `/download/${filePath.split("\\").pop()}`;
                        link.download = filePath.split("\\").pop();
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    });
                } else {
                    result.innerHTML = `<p style="color: red;">${upoutputData.message}</p>`;
                }
            });
        } else {
            result.innerHTML = `<p style="color: red;">${data.message}</p>`;
        }
    } catch (err) {
        result.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
    }
});